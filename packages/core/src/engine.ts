/**
 * Runs a program on one chat turn. Pure and synchronous: no network, no clock. The host app first gets the facts
 * (simple rules, a small classifier model, or both), then asks the engine which branch wins. The engine never calls an
 * LLM; it answers `{ kind: "model" }` and the host does.
 *
 * Conversations: when a rule `ask`s, the conversation STAYS at the node that rule is in. The next message is checked
 * from there (not from the top), and details already found there (`has date`...) are remembered. `uproot` moves the
 * conversation up and checks the message again from there. Any other action finishes and goes back to the top.
 * Pass `decision.state` back as `turn.state` on the next message.
 */
import type { Branch, Cond, Leaf, Program } from "./ast";
import { check } from "./checker";
import { formatDiagnostic } from "./errors";

/** Where a conversation is waiting, and the details (`check` names) already found while waiting there. */
export type ConversationState = { at: string[]; found: string[] };

export const START: ConversationState = { at: [], found: [] };

/** What the engine knows about one message. */
export type Turn = {
  text: string;
  /** Classifier answers, e.g. { topic: "orders", action: "track_order" }. */
  facts: Record<string, string | undefined>;
  /**
   * How sure the classifier is about each fact, 0..1. A fact with no confidence given (e.g. set by your own code)
   * counts as certain (1).
   */
  confidence?: Record<string, number | undefined>;
  /** The assistant's previous reply, for `asked <id>`. */
  lastReply?: string;
  /** The previous decision's `state`. Leave it out to start at the top. */
  state?: ConversationState;
};

/** One branch the engine looked at, in order. The Studio draws this. */
export type Step = { path: string; matched: boolean };

/** An `uproot` that happened during this message: the conversation left `from` and continued at `to` ("" = top). */
export type Move = { from: string; to: string };

export type Decision = (
  | { kind: "model" }
  | { kind: "refuse"; text: string }
  | { kind: "reply"; text: string }
  | { kind: "ask"; ask: string; text: string }
  | { kind: "direct"; name: string }
) & {
  path: string;
  trace: Step[];
  /** Where this message started ("" = the top). */
  startedAt: string;
  moves: Move[];
  /** Give this back as `turn.state` with the next message. */
  state: ConversationState;
};

export type EngineOptions = {
  /** Code for every `check name = host`. */
  checks?: Record<string, (turn: Turn) => boolean>;
  /** Picks one text from a list. Defaults to random; pass `() => 0` for tests. */
  pick?: (count: number) => number;
};

/** The minimum confidence for a `==` test when the program sets no `confidence = ...` and the rule no `>= ...`. */
export const DEFAULT_CONFIDENCE = 0.8;

/** Stops a program that uproots in circles. */
const MAX_MOVES = 8;

export type Engine = { program: Program; decide: (turn: Turn) => Decision };

export function createEngine(program: Program, options: EngineOptions = {}): Engine {
  const errors = check(program).filter((d) => d.severity === "error");
  if (errors.length) throw new Error(`This .dan program has errors:\n${errors.map(formatDiagnostic).join("\n")}`);

  const checks: Record<string, (turn: Turn) => boolean> = {};
  const textChecks: string[] = [];
  for (const c of Object.values(program.checks)) {
    if (c.host) {
      const fn = options.checks?.[c.name];
      if (!fn) throw new Error(`check "${c.name}" is marked host, but no code was given for it in createEngine({ checks }).`);
      checks[c.name] = fn;
    } else {
      const re = new RegExp(c.source, c.flags.replace("g", "")); // no "g": .test() must not keep state
      checks[c.name] = (turn) => re.test(turn.text);
      textChecks.push(c.name);
    }
  }
  const pick = options.pick ?? ((n: number) => Math.floor(Math.random() * n));
  const choose = (texts: string[]) => texts[Math.min(texts.length - 1, Math.max(0, pick(texts.length)))]!;

  /** The rules under the node at `at` (the top's rules for []), or null if the node no longer exists. */
  const rulesAt = (at: string[]): Branch[] | null => {
    let branches = program.flows[program.entry]!.branches;
    for (const id of at) {
      const b = branches.find((x) => x.id === id);
      if (!b) return null;
      if (b.leaf?.kind === "flow") branches = program.flows[b.leaf.flow]!.branches;
      else if (b.children.length) branches = b.children;
      else return null;
    }
    return branches;
  };

  const decide = (turn: Turn): Decision => {
    const trace: Step[] = [];
    const moves: Move[] = [];
    const nowFound = textChecks.filter((name) => checks[name]!(turn));

    let at = turn.state && rulesAt(turn.state.at) ? turn.state.at : [];
    let found = new Set(at.length ? [...(turn.state?.found ?? []), ...nowFound] : nowFound);
    const startedAt = at.join("/");

    const test = (cond: Cond): boolean => {
      switch (cond.kind) {
        case "and":
          return test(cond.left) && test(cond.right);
        case "or":
          return test(cond.left) || test(cond.right);
        case "not":
          return !test(cond.cond);
        case "has":
          return found.has(cond.check) || checks[cond.check]!(turn);
        case "asked":
          return turn.lastReply !== undefined && (program.asks[cond.ask] ?? []).includes(turn.lastReply);
        case "is": {
          const value = turn.facts[cond.field];
          if (value === undefined || !cond.values.includes(value)) return false;
          // The rule's own `>= ...`, else the program's `confidence = ...`, else the default.
          const min =
            cond.min === undefined
              ? (program.confidence ?? DEFAULT_CONFIDENCE)
              : typeof cond.min === "string"
                ? (program.lets[cond.min] as number)
                : cond.min;
          return (turn.confidence?.[cond.field] ?? 1) >= min;
        }
      }
    };

    type Hit = { leaf: Leaf; path: string[] };
    const walk = (branches: Branch[], path: string[]): Hit | null => {
      for (const b of branches) {
        const here = [...path, b.id];
        const matched = b.when === "else" || test(b.when);
        trace.push({ path: here.join("/"), matched });
        if (!matched) continue;
        if (b.leaf?.kind === "flow") return walk(program.flows[b.leaf.flow]!.branches, here) ?? { leaf: { kind: "model" }, path: [...here, "no-match"] };
        if (b.leaf) return { leaf: b.leaf, path: here };
        return walk(b.children, here) ?? { leaf: { kind: "model" }, path: [...here, "no-match"] };
      }
      return null;
    };

    const finish = (leaf: Leaf, path: string[], state: ConversationState): Decision => {
      const base = { path: path.join("/"), trace, startedAt, moves, state };
      switch (leaf.kind) {
        case "refuse":
          return { kind: "refuse", text: choose(leaf.texts), ...base };
        case "reply":
          return { kind: "reply", text: choose(leaf.texts), ...base };
        case "ask":
          return { kind: "ask", ask: leaf.id, text: choose(leaf.texts), ...base };
        case "direct":
          return { kind: "direct", name: leaf.name, ...base };
        default:
          return { kind: "model", ...base };
      }
    };

    for (let hop = 0; hop <= MAX_MOVES; hop++) {
      const hit = walk(rulesAt(at)!, at);
      if (!hit) return finish({ kind: "model" }, at.length ? [...at, "no-match"] : ["no-match"], START);
      if (hit.leaf.kind === "uproot") {
        // The rule sits in the node `hit.path` minus its own name. Go up from that node, then check the message again.
        const node = hit.path.slice(0, -1);
        const levels = hit.leaf.levels;
        const to = levels === "all" ? [] : node.slice(0, Math.max(0, node.length - levels));
        moves.push({ from: node.join("/"), to: to.join("/") });
        at = to;
        if (!at.length) found = new Set(nowFound);
        continue;
      }
      // An ask waits at the node it's in, remembering what was found. Anything else finishes: back to the top.
      const state: ConversationState =
        hit.leaf.kind === "ask" ? { at: hit.path.slice(0, -1), found: [...found] } : START;
      return finish(hit.leaf, hit.path, state);
    }
    return finish({ kind: "model" }, ["too-many-uproots"], START);
  };

  return { program, decide };
}
