/**
 * Turns the text of one .dan file into a FileAst. Line based: each line is one statement, and indentation (spaces
 * only) nests branches under their parent, like Python.
 */
import type { Branch, CheckDef, Cond, FileAst, Leaf, Pos } from "./ast";
import { DanError } from "./errors";

type Tok =
  | { t: "ident"; v: string; col: number }
  | { t: "num"; v: number; col: number }
  | { t: "str"; v: string; col: number }
  | { t: "op"; v: string; col: number };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;
const BRANCH_ID = /^([A-Za-z0-9_][A-Za-z0-9_-]*):(?=\s|$)/;
const OPS = ["->", ">=", "==", "[", "]", ",", "(", ")", "="];

/** Splits off a trailing `# comment` that is not inside a string. Returns [code, comment]. */
function splitComment(line: string): [string, string | undefined] {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr && c === "\\") i++;
    else if (c === '"') inStr = !inStr;
    else if (!inStr && c === "#") return [line.slice(0, i), line.slice(i + 1).trim() || undefined];
  }
  return [line, undefined];
}

function tokenize(src: string, offset: number, pos: (col: number) => Pos): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const col = offset + i + 1;
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === '"') {
      let v = "";
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          const n = src[i + 1]!;
          v += n === "n" ? "\n" : n;
          i += 2;
        } else v += src[i++];
      }
      if (i >= src.length) throw new DanError("This text has no closing quote (\").", pos(col));
      i++;
      toks.push({ t: "str", v, col });
      continue;
    }
    const num = /^\d+(\.\d+)?(%?)/.exec(src.slice(i));
    if (num) {
      // `95%` is the same as 0.95.
      toks.push({ t: "num", v: num[2] ? Number(num[0].slice(0, -1)) / 100 : Number(num[0]), col });
      i += num[0].length;
      continue;
    }
    const id = IDENT.exec(src.slice(i));
    if (id) {
      toks.push({ t: "ident", v: id[0], col });
      i += id[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      toks.push({ t: "op", v: op, col });
      i += op.length;
      continue;
    }
    throw new DanError(`Unexpected character "${c}".`, pos(col));
  }
  return toks;
}

/** A tiny cursor over one line's tokens. */
class Cursor {
  i = 0;
  constructor(
    readonly toks: Tok[],
    readonly pos: (col: number) => Pos,
    readonly endCol: number,
  ) {}
  peek(): Tok | undefined {
    return this.toks[this.i];
  }
  here(): Pos {
    return this.pos(this.peek()?.col ?? this.endCol);
  }
  isWord(v: string): boolean {
    const t = this.peek();
    return t?.t === "ident" && t.v === v;
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return t?.t === "op" && t.v === v;
  }
  ident(what: string): string {
    const t = this.peek();
    if (t?.t !== "ident") throw new DanError(`Expected ${what}.`, this.here());
    this.i++;
    return t.v;
  }
  op(v: string): void {
    if (!this.isOp(v)) throw new DanError(`Expected "${v}".`, this.here());
    this.i++;
  }
  done(): boolean {
    return this.i >= this.toks.length;
  }
  end(): void {
    if (!this.done()) throw new DanError("Unexpected words at the end of this line.", this.here());
  }
}

// ---- Conditions: or > and > not > atom ----------------------------------------------------------------------

function parseCond(c: Cursor): Cond {
  let left = parseAnd(c);
  while (c.isWord("or")) {
    c.i++;
    left = { kind: "or", left, right: parseAnd(c) };
  }
  return left;
}

function parseAnd(c: Cursor): Cond {
  let left = parseNot(c);
  while (c.isWord("and")) {
    c.i++;
    left = { kind: "and", left, right: parseNot(c) };
  }
  return left;
}

function parseNot(c: Cursor): Cond {
  if (c.isWord("not")) {
    c.i++;
    return { kind: "not", cond: parseNot(c) };
  }
  if (c.isOp("(")) {
    c.i++;
    const inner = parseCond(c);
    c.op(")");
    return inner;
  }
  return parseAtom(c);
}

function parseAtom(c: Cursor): Cond {
  const pos = c.here();
  const word = c.ident("a test such as `intent is ...`, `has <check>` or `asked <ask id>`");
  if (word === "has") return { kind: "has", check: c.ident("a check name after `has`"), pos };
  if (word === "asked") return { kind: "asked", ask: c.ident("an ask id after `asked`"), pos };
  let values: string[];
  if (c.isWord("is") || c.isWord("in") || c.isOp("="))
    throw new DanError(`Use "==" to compare, like \`${word} == value\` or \`${word} == [a, b]\`.`, c.here());
  if (!c.isOp("==")) throw new DanError(`Expected "==" after "${word}", like \`${word} == value\`.`, c.here());
  c.i++;
  if (c.isOp("[")) {
    c.i++;
    values = [c.ident("a value")];
    while (c.isOp(",")) {
      c.i++;
      values.push(c.ident("a value"));
    }
    c.op("]");
  } else {
    values = [c.ident(`a value after \`${word} =\``)];
  }
  let min: number | string | undefined;
  if (c.isOp(">=")) {
    c.i++;
    const t = c.peek();
    if (t?.t === "num") min = t.v;
    else if (t?.t === "ident") min = t.v;
    else throw new DanError("Expected a confidence after `>=` (a number like 0.8, or a `let` name).", c.here());
    c.i++;
  }
  return { kind: "is", field: word, values, ...(min !== undefined ? { min } : {}), pos };
}

// ---- Leaves ------------------------------------------------------------------------------------------------

function parseTexts(c: Cursor): string[] {
  const t = c.peek();
  if (t?.t === "str") {
    c.i++;
    return [t.v];
  }
  if (c.isOp("[")) {
    c.i++;
    const out: string[] = [];
    while (!c.isOp("]")) {
      const s = c.peek();
      if (s?.t !== "str") throw new DanError('Expected a message in quotes, like "Hello!".', c.here());
      out.push(s.v);
      c.i++;
      if (c.isOp(",")) c.i++; // a comma after the last message is fine
      else break;
    }
    c.op("]");
    if (!out.length) throw new DanError("This list has no messages.", c.here());
    return out;
  }
  throw new DanError('Expected a message in quotes, or a list like ["Hi!", "Hello!"].', c.here());
}

/** Messages written right here ("Hi!" or ["Hi!", "Hello!"]), or the name of a `let` that holds them. */
function parseMessages(c: Cursor): { texts: string[]; from?: string } {
  const t = c.peek();
  if (t?.t === "ident") {
    c.i++;
    return { texts: [], from: t.v };
  }
  return { texts: parseTexts(c) };
}

function parseLeaf(c: Cursor): Leaf {
  const word = c.ident("what to do: model, reply, ask, refuse, direct, or a flow name");
  switch (word) {
    case "model":
      return { kind: "model" };
    case "reply":
      return { kind: "reply", ...parseMessages(c) };
    case "refuse":
      return { kind: "refuse", ...parseMessages(c) };
    case "ask": {
      // `ask order_question` (a let), `ask order_number "Which order?"` (an id + messages), or just `ask "How much?"`.
      const first = c.peek();
      if (first?.t === "str" || c.isOp("[")) {
        const texts = parseTexts(c);
        return { kind: "ask", id: `"${texts[0]}"`, texts };
      }
      const id = c.ident("a message list after `ask`, like `ask order_question`");
      if (c.done()) return { kind: "ask", id, texts: [], from: id };
      return { kind: "ask", id, ...parseMessages(c) };
    }
    case "direct":
      return { kind: "direct", name: c.ident("a handler name after `direct`") };
    default:
      return { kind: "flow", flow: word };
  }
}

// ---- Lines ---------------------------------------------------------------------------------------------------

type Container = { indent: number; children: Branch[]; childIndent?: number };

/** How many "[" are still open on this line (brackets inside quotes don't count). */
function openBrackets(code: string): number {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inStr && c === "\\") i++;
    else if (c === '"') inStr = !inStr;
    else if (!inStr && c === "[") depth++;
    else if (!inStr && c === "]") depth--;
  }
  return depth;
}

/**
 * Lets a `let` list span several lines:
 *   let hello = [
 *     "Hi!",
 *     "Hello!",
 *   ]
 * The lines are joined into one (keeping the first line's number for errors). Comments inside are dropped.
 */
function joinLists(lines: string[], file: string): { raw: string; lineNo: number }[] {
  const out: { raw: string; lineNo: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!/^(let|field)\s/.test(raw)) {
      out.push({ raw, lineNo: i + 1 });
      continue;
    }
    let [code] = splitComment(raw);
    const start = i;
    while (openBrackets(code) > 0) {
      i++;
      if (i >= lines.length)
        throw new DanError("This list is never closed. Add a \"]\" at the end.", { file, line: start + 1, col: 1 });
      code += " " + splitComment(lines[i]!)[0].trim();
    }
    out.push({ raw: code, lineNo: start + 1 });
  }
  return out;
}

export function parse(text: string, file = "main.dan"): FileAst {
  const ast: FileAst = { file, uses: [], lets: [], fields: [], checks: [], flows: [] };
  const lines = joinLists(text.split(/\r?\n/), file);
  let stack: Container[] | null = null; // set while inside a flow

  lines.forEach(({ raw, lineNo }) => {
    const at = (col: number): Pos => ({ file, line: lineNo, col });
    // A `check` line holds a raw regex, which may contain # or ". Read it whole: no end-of-line comment there.
    const isCheck = /^check\s/.test(raw);
    const [code, comment] = isCheck ? [raw.trimEnd(), undefined] : splitComment(raw);
    if (!code.trim()) return;
    const tab = /^[ ]*\t/.exec(code);
    if (tab) throw new DanError("Use spaces, not tabs, to indent.", at(tab[0].length));
    const indent = code.length - code.trimStart().length;
    const body = code.trim();

    if (indent === 0) {
      stack = null;
      const toks = isCheck ? [{ t: "ident" as const, v: "check", col: 1 }] : tokenize(body, 0, at);
      const c = new Cursor(toks, at, body.length + 1);
      const kw = c.ident("a statement: use, let, field, confidence, check or flow");
      const pos = at(1);
      if (kw === "use") {
        const s = c.peek();
        if (s?.t !== "str") throw new DanError('Expected a file in quotes, like use "./orders.dan".', c.here());
        c.i++;
        c.end();
        ast.uses.push({ path: s.v, pos });
      } else if (kw === "let") {
        const name = c.ident("a name after `let`");
        c.op("=");
        const v = c.peek();
        let value: number | string[];
        if (v?.t === "num") {
          c.i++;
          value = v.v;
        } else if (v?.t === "str" || c.isOp("[")) {
          value = parseTexts(c);
        } else {
          throw new DanError('A `let` holds a number (let sure = 0.8) or messages (let hi = ["Hi!", "Hello!"]).', c.here());
        }
        c.end();
        ast.lets.push({ name, value, pos });
      } else if (kw === "field") {
        // field topic = [greeting, other]
        // field topic "Which topic fits?" = [greeting "The person says hello.", other "Anything else."]
        const name = c.ident("a field name after `field`");
        let question: string | undefined;
        const q = c.peek();
        if (q?.t === "str") {
          question = q.v;
          c.i++;
        }
        c.op("=");
        c.op("[");
        const values: string[] = [];
        const describe: Record<string, string> = {};
        while (!c.isOp("]")) {
          const v = c.ident("a value");
          values.push(v);
          const d = c.peek();
          if (d?.t === "str") {
            describe[v] = d.v;
            c.i++;
          }
          if (c.isOp(",")) c.i++;
          else break;
        }
        c.op("]");
        c.end();
        if (!values.length) throw new DanError("A field needs at least one value.", pos);
        ast.fields.push({ name, values, describe, ...(question ? { question } : {}), pos });
      } else if (kw === "confidence") {
        c.op("=");
        const v = c.peek();
        if (v?.t !== "num") throw new DanError("Write it like `confidence = 80%` or `confidence = 0.8`.", c.here());
        c.i++;
        c.end();
        if (ast.confidence) throw new DanError("`confidence` is set twice in this file.", pos);
        ast.confidence = { value: v.v, pos };
      } else if (kw === "check") {
        // `check amount = /regex/flags` or `check plain_range = host`. Read the raw text: regexes don't tokenize.
        const m = /^check\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(body);
        if (!m) throw new DanError("Write a check as `check name = /regex/i` or `check name = host`.", pos);
        const [, name, rhs] = m as unknown as [string, string, string];
        let def: CheckDef;
        if (rhs === "host") def = { name, host: true, pos };
        else {
          const re = /^\/(.*)\/([a-z]*)$/.exec(rhs);
          if (!re) throw new DanError("A check is a regex between slashes, like /\\d+/i, or the word host.", pos);
          def = { name, host: false, source: re[1]!, flags: re[2]!, pos };
        }
        ast.checks.push(def);
      } else if (kw === "flow") {
        const name = c.ident("a flow name after `flow`");
        c.end();
        const flow = { name, branches: [] as Branch[], pos };
        ast.flows.push(flow);
        stack = [{ indent: 0, children: flow.branches }];
      } else {
        throw new DanError(`Unknown statement "${kw}". Expected use, let, field, confidence, check or flow.`, pos);
      }
      return;
    }

    // An indented line: a branch inside the current flow.
    if (!stack) throw new DanError("This line is indented but is not inside a `flow`.", at(indent + 1));
    const s: Container[] = stack;
    while (s.length > 1 && s[s.length - 1]!.indent >= indent) s.pop();
    const parent = s[s.length - 1]!;
    if (parent.childIndent === undefined) parent.childIndent = indent;
    else if (parent.childIndent !== indent)
      throw new DanError(
        `Indentation does not line up: expected ${parent.childIndent} spaces like the branches above it.`,
        at(indent + 1),
      );

    const idm = BRANCH_ID.exec(body);
    if (!idm) throw new DanError("A branch starts with its name and a colon, like `track: when ...`.", at(indent + 1));
    const id = idm[1]!;
    const restOffset = indent + idm[0].length;
    const c = new Cursor(tokenize(body.slice(idm[0].length), restOffset, at), at, code.length + 1);
    let when: Cond | "else";
    if (c.isWord("else")) {
      c.i++;
      when = "else";
    } else if (c.isWord("when")) {
      c.i++;
      when = parseCond(c);
    } else throw new DanError("After the branch name, write `when <test>` or `else`.", c.here());
    let leaf: Leaf | undefined;
    if (c.isOp("->")) {
      c.i++;
      leaf = parseLeaf(c);
    }
    c.end();
    const branch: Branch = { id, when, children: [], pos: at(indent + 1), ...(leaf ? { leaf } : {}), ...(comment ? { label: comment } : {}) };
    parent.children.push(branch);
    s.push({ indent, children: branch.children });
  });

  return ast;
}
