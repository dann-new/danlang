/**
 * Turns a program into a drawable tree, laid out left to right: the message on the left, then every rule. Jumps into
 * another flow are expanded in place, so node paths match the engine's `decision.path`.
 */
import type { Branch, Cond, Leaf, Program } from "@danlang/core";

export type NodeKind = "message" | "decision" | "free" | "ask" | "model" | "uproot";

export type TreeNode = {
  path: string;
  name: string;
  /** Short line under the name: what the rule does. */
  sub: string;
  kind: NodeKind;
  when: string;
  /** Every message this rule can say (one is picked at random). */
  texts: string[];
  file?: string;
  line?: number;
  children: TreeNode[];
  x: number;
  y: number;
};

export const NODE_W = 200;
export const NODE_H = 52;
const COL = 270;
const ROW = 70;
const PAD = 32;

export function condText(c: Cond | "else"): string {
  if (c === "else") return "otherwise";
  switch (c.kind) {
    case "and":
    case "or":
      return `${condText(c.left)} ${c.kind} ${condText(c.right)}`;
    case "not":
      return `not ${condText(c.cond)}`;
    case "has":
      return `has ${c.check}`;
    case "asked":
      return `asked ${c.ask}`;
    case "is": {
      const v = c.values.length === 1 ? c.values[0] : `[${c.values.join(", ")}]`;
      const min = c.min === undefined ? "" : typeof c.min === "number" ? ` ≥ ${Math.round(c.min * 100)}%` : ` ≥ ${c.min}`;
      return `${c.field} = ${v}${min}`;
    }
  }
}

function leafInfo(leaf: Leaf): { kind: NodeKind; sub: string; texts: string[] } {
  switch (leaf.kind) {
    case "model":
      return { kind: "model", sub: "big AI answers", texts: [] };
    case "reply":
      return { kind: "free", sub: `fixed reply · ${leaf.texts.length} msg`, texts: leaf.texts };
    case "direct":
      return { kind: "free", sub: `app code: ${leaf.name}`, texts: [] };
    case "ask":
      return { kind: "ask", sub: `asks & waits · ${leaf.texts.length} msg`, texts: leaf.texts };
    case "refuse":
      return { kind: "ask", sub: `refuses · ${leaf.texts.length} msg`, texts: leaf.texts };
    case "uproot":
      return { kind: "uproot", sub: leaf.levels === "all" ? "back to the top" : `up ${leaf.levels} level${leaf.levels === 1 ? "" : "s"}`, texts: [] };
    case "flow":
      return { kind: "decision", sub: `→ flow ${leaf.flow}`, texts: [] };
  }
}

function build(program: Program, branches: Branch[], parent: string, seen: Set<string>): TreeNode[] {
  return branches.map((b) => {
    const path = parent ? `${parent}/${b.id}` : b.id;
    let children: TreeNode[] = [];
    let info: { kind: NodeKind; sub: string; texts: string[] };
    if (b.leaf?.kind === "flow" && program.flows[b.leaf.flow] && !seen.has(b.leaf.flow)) {
      children = build(program, program.flows[b.leaf.flow]!.branches, path, new Set([...seen, b.leaf.flow]));
      info = { kind: "decision", sub: condText(b.when), texts: [] };
    } else if (b.leaf) {
      info = leafInfo(b.leaf);
    } else {
      children = build(program, b.children, path, seen);
      info = { kind: "decision", sub: condText(b.when), texts: [] };
    }
    return { path, name: b.id, sub: info.sub, kind: info.kind, when: condText(b.when), texts: info.texts, file: b.pos.file, line: b.pos.line, children, x: 0, y: 0 };
  });
}

/** Columns by depth, leaves stacked top to bottom, each parent centered on its children. */
export function layout(program: Program): { root: TreeNode; width: number; height: number } {
  const main = program.flows[program.entry];
  const root: TreeNode = {
    path: "",
    name: "Message",
    sub: "a new message arrives",
    kind: "message",
    when: "",
    texts: [],
    children: main ? build(program, main.branches, "", new Set([program.entry])) : [],
    x: 0,
    y: 0,
  };
  let nextRow = 0;
  let maxDepth = 0;
  const place = (n: TreeNode, depth: number) => {
    n.x = PAD + depth * COL;
    maxDepth = Math.max(maxDepth, depth);
    if (!n.children.length) {
      n.y = PAD + nextRow * ROW;
      nextRow++;
      return;
    }
    n.children.forEach((c) => place(c, depth + 1));
    n.y = (n.children[0]!.y + n.children[n.children.length - 1]!.y) / 2;
  };
  place(root, 0);
  return { root, width: PAD * 2 + maxDepth * COL + NODE_W, height: PAD * 2 + Math.max(0, nextRow - 1) * ROW + NODE_H };
}

export function flatten(n: TreeNode): TreeNode[] {
  return [n, ...n.children.flatMap(flatten)];
}

/** The rule's block of source text (its line plus the indented lines under it), for the hover card. */
export function sourceBlock(sources: Record<string, string>, file?: string, line?: number): string {
  if (!file || !line) return "";
  const lines = (sources[file] ?? "").split("\n");
  const first = lines[line - 1] ?? "";
  const indent = first.length - first.trimStart().length;
  const out = [first];
  for (let i = line; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trim() && l.length - l.trimStart().length <= indent) break;
    out.push(l);
  }
  while (out.length && !out[out.length - 1]!.trim()) out.pop();
  return out.map((l) => l.slice(indent)).join("\n");
}
