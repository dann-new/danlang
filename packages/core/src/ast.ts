/**
 * The shapes a .dan file turns into. Everything here is plain JSON (no functions, no RegExp objects), so a compiled
 * program can be saved, sent to the Studio, or diffed in a test.
 */

/** Where something was written. `line` and `col` start at 1. */
export type Pos = { file: string; line: number; col: number };

/** A test on one branch line (the part after `when`). */
export type Cond =
  /** `intent == schedule_task`, `intent == [a, b]` (any of them), optionally `>= 0.9` (a number or a `let` name). */
  | { kind: "is"; field: string; values: string[]; min?: number | string; pos: Pos }
  /** `has amount`: a `check` on the message text (a regex, or code the host app provides). */
  | { kind: "has"; check: string; pos: Pos }
  /** `asked order_number_question`: the bot's previous reply was this `ask`. Stops asking the same question twice. */
  | { kind: "asked"; ask: string; pos: Pos }
  | { kind: "not"; cond: Cond }
  | { kind: "and" | "or"; left: Cond; right: Cond };

/** What a branch does when it is chosen (the part after `->`). */
export type Leaf =
  /** Hand the message to the LLM. */
  | { kind: "model" }
  /**
   * A fixed polite "I can't help with that". One text is picked at random. `from` is set when the texts come from a
   * `let` (e.g. `-> refuse off_topic_messages`); the linker fills `texts` from it.
   */
  | { kind: "refuse"; texts: string[]; from?: string }
  /** A fixed answer. One text is picked at random. */
  | { kind: "reply"; texts: string[]; from?: string }
  /** Ask for a missing detail. `id` lets `asked <id>` notice the answer on the next turn. */
  | { kind: "ask"; id: string; texts: string[]; from?: string }
  /** The host app answers with its own code (e.g. an order lookup). No LLM. */
  | { kind: "direct"; name: string }
  /** Continue inside another flow (its branches become this branch's children). */
  | { kind: "flow"; flow: string }
  /** Move the conversation up `levels` nodes (or to the top), then check the same message again from there. */
  | { kind: "uproot"; levels: number | "all" };

export type Branch = {
  id: string;
  /** "else" always passes. */
  when: Cond | "else";
  leaf?: Leaf;
  children: Branch[];
  /** The `# comment` at the end of the line, shown in the Studio. */
  label?: string;
  pos: Pos;
};

export type Flow = { name: string; branches: Branch[]; pos: Pos };

export type CheckDef = { name: string; pos: Pos } & ({ host: true } | { host: false; source: string; flags: string });

/** One parsed file, before `use` lines are followed. */
export type FileAst = {
  file: string;
  uses: { path: string; pos: Pos }[];
  /** `let sure = 0.8` (a number) or `let hello = ["Hi!", "Hello!"]` / `let hello = "Hi!"` (messages). */
  lets: { name: string; value: number | string[]; pos: Pos }[];
  /** `field topic = [greeting "says hello", other]`: values, with optional descriptions for the classifier. */
  fields: { name: string; values: string[]; describe: Record<string, string>; question?: string; pos: Pos }[];
  /** `confidence = 80%`: the minimum confidence every `==` test needs unless it says `>= ...` itself. */
  confidence?: { value: number; pos: Pos };
  checks: CheckDef[];
  flows: Flow[];
};

/** A whole program: every file linked together. This is what the engine and the Studio read. */
export type Program = {
  entry: string;
  files: string[];
  lets: Record<string, number | string[]>;
  fields: Record<string, string[]>;
  /** Descriptions and the question for each field, for building a classifier request. */
  fieldInfo: Record<string, { question?: string; describe: Record<string, string> }>;
  /** From `confidence = ...`. When missing, the engine uses DEFAULT_CONFIDENCE. */
  confidence?: number;
  checks: Record<string, CheckDef>;
  /** Every `ask` id and its texts, collected from the tree. */
  asks: Record<string, string[]>;
  flows: Record<string, Flow>;
};
