/**
 * Follows `use` lines from the entry file and merges every file into one Program. File access is passed in
 * (`load`), so this runs anywhere: Node, the browser, React Native, an edge function.
 */
import type { Branch, FileAst, Program } from "./ast";
import { DanError } from "./errors";
import { parse } from "./parser";

export type Loader = (path: string) => string;

/** Joins a relative `use` path onto the folder of the file that wrote it. Plain string work, no `node:path`. */
export function resolvePath(fromFile: string, rel: string): string {
  if (rel.startsWith("/")) return normalize(rel);
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  return normalize(dir ? `${dir}/${rel}` : rel);
}

function normalize(p: string): string {
  const abs = p.startsWith("/");
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(part);
  }
  return (abs ? "/" : "") + out.join("/");
}

export function link(entryFile: string, load: Loader, entryFlow = "main"): Program {
  const program: Program = { entry: entryFlow, files: [], lets: {}, fields: {}, checks: {}, asks: {}, flows: {} };
  const seen = new Set<string>();

  const visit = (file: string) => {
    if (seen.has(file)) return; // a file used twice (or a use loop) is read once
    seen.add(file);
    let text: string;
    try {
      text = load(file);
    } catch {
      throw new DanError(`Could not read "${file}".`, { file, line: 1, col: 1 });
    }
    const ast = parse(text, file);
    program.files.push(file);
    merge(program, ast);
    for (const u of ast.uses) {
      const target = resolvePath(file, u.path);
      try {
        visit(target);
      } catch (e) {
        if (e instanceof DanError && e.pos.file === target && e.message.includes("Could not read"))
          throw new DanError(`Could not find "${u.path}" (looked for ${target}).`, u.pos);
        throw e;
      }
    }
  };
  visit(normalize(entryFile));
  return program;
}

/** Links a program from in-memory sources, e.g. `{ "main.dan": "...", "bills.dan": "..." }`. Handy for tests and the Studio. */
export function linkSources(sources: Record<string, string>, entryFile = "main.dan", entryFlow = "main"): Program {
  return link(
    entryFile,
    (p) => {
      const text = sources[p];
      if (text === undefined) throw new Error("missing");
      return text;
    },
    entryFlow,
  );
}

function merge(p: Program, ast: FileAst) {
  const dup = (kind: string, name: string, where: { file: string; line: number }, pos: FileAst["flows"][number]["pos"]) => {
    throw new DanError(`${kind} "${name}" is already defined at ${where.file}:${where.line}.`, pos);
  };
  const letPos: Record<string, { file: string; line: number }> = {};
  for (const l of ast.lets) {
    if (l.name in p.lets) dup("let", l.name, letPos[l.name] ?? { file: "?", line: 0 }, l.pos);
    p.lets[l.name] = l.value;
    letPos[l.name] = l.pos;
  }
  for (const f of ast.fields) {
    if (f.name in p.fields) throw new DanError(`field "${f.name}" is defined twice.`, f.pos);
    p.fields[f.name] = f.values;
  }
  for (const c of ast.checks) {
    const prev = p.checks[c.name];
    if (prev) dup("check", c.name, prev.pos, c.pos);
    p.checks[c.name] = c;
  }
  for (const f of ast.flows) {
    const prev = p.flows[f.name];
    if (prev) dup("flow", f.name, prev.pos, f.pos);
    p.flows[f.name] = f;
    collectAsks(p, f.branches);
  }
}

function collectAsks(p: Program, branches: Branch[]) {
  for (const b of branches) {
    if (b.leaf?.kind === "ask") {
      const prev = p.asks[b.leaf.id];
      if (prev && prev.join("\u0000") !== b.leaf.texts.join("\u0000"))
        throw new DanError(`ask "${b.leaf.id}" is used again with different texts. Give it a new id.`, b.pos);
      p.asks[b.leaf.id] = b.leaf.texts;
    }
    collectAsks(p, b.children);
  }
}
