/**
 * Turns a program into a drawable tree: the message at the top, then every rule. Jumps into another flow are
 * expanded in place, so the tree shows the whole route (and node paths match the engine's `decision.path`).
 */
import type { Branch, Cond, Leaf, Program } from "@danlang/core";

export type NodeKind = "message" | "decision" | "free" | "ask" | "model";

export type TreeNode = {
  path: string;
  name: string;
  /** Short line under the name: what the rule does. */
  sub: string;
  kind: NodeKind;
  when: string;
  file?: string;
  line?: number;
  children: TreeNode[];
  x: number;
  y: number;
};

export function condText(c: Cond | "else"): string {
  if (c === "else") return "else";
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
      const min = c.min === undefined ? "" : typeof c.min === "number" ? ` >= ${Math.round(c.min * 100)}%` : ` >= ${c.min}`;
      return `${c.field} == ${v}${min}`;
    }
  }
}

function leafInfo(leaf: Leaf): { kind: NodeKind; sub: string } {
  switch (leaf.kind) {
    case "model":
      return { kind: "model", sub: "big AI" };
    case "reply":
      return { kind: "free", sub: "fixed reply" };
    case "direct":
      return { kind: "free", sub: `app code: ${leaf.name}` };
    case "ask":
      return { kind: "ask", sub: "asks first" };
    case "refuse":
      return { kind: "ask", sub: "refused" };
    case "flow":
      return { kind: "decision", sub: `→ flow ${leaf.flow}` };
  }
}

function build(program: Program, branches: Branch[], parent: string, seen: Set<string>): TreeNode[] {
  return branches.map((b) => {
    const path = parent ? `${parent}/${b.id}` : b.id;
    let children: TreeNode[] = [];
    let info: { kind: NodeKind; sub: string };
    if (b.leaf?.kind === "flow" && program.flows[b.leaf.flow] && !seen.has(b.leaf.flow)) {
      children = build(program, program.flows[b.leaf.flow]!.branches, path, new Set([...seen, b.leaf.flow]));
      info = { kind: "decision", sub: b.label ?? `flow ${b.leaf.flow}` };
    } else if (b.leaf) {
      info = leafInfo(b.leaf);
    } else {
      children = build(program, b.children, path, seen);
      info = { kind: "decision", sub: b.label ?? condText(b.when) };
    }
    return { path, name: b.id, sub: info.sub, kind: info.kind, when: condText(b.when), file: b.pos.file, line: b.pos.line, children, x: 0, y: 0 };
  });
}

export const GAP_X = 118;
export const GAP_Y = 120;

/** Places leaves side by side and centers each parent over its children. Returns the root and the canvas size. */
export function layout(program: Program): { root: TreeNode; width: number; height: number } {
  const main = program.flows[program.entry];
  const root: TreeNode = {
    path: "",
    name: "Message",
    sub: "a new message",
    kind: "message",
    when: "",
    children: main ? build(program, main.branches, "", new Set([program.entry])) : [],
    x: 0,
    y: 0,
  };
  let nextX = 0;
  let maxDepth = 0;
  const place = (n: TreeNode, depth: number) => {
    n.y = depth * GAP_Y + 60;
    maxDepth = Math.max(maxDepth, depth);
    if (!n.children.length) {
      n.x = nextX * GAP_X + GAP_X / 2;
      nextX++;
      return;
    }
    n.children.forEach((c) => place(c, depth + 1));
    n.x = (n.children[0]!.x + n.children[n.children.length - 1]!.x) / 2;
  };
  place(root, 0);
  return { root, width: Math.max(nextX * GAP_X, 600), height: (maxDepth + 1) * GAP_Y + 60 };
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
