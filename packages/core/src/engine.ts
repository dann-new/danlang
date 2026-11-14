/**
 * Runs a program on one chat turn. Pure and synchronous: no network, no clock. The host app first gets the facts
 * (simple rules, a small classifier model, or both), then asks the engine which branch wins. The engine never calls an LLM;
 * it answers `{ kind: "model" }` and the host does.
 */
import type { Branch, Cond, Leaf, Program } from "./ast";
import { check } from "./checker";
import { formatDiagnostic } from "./errors";

/** What the engine knows about one message. */
export type Turn = {
  text: string;
  /** Classifier answers, e.g. { topic: "orders", action: "track_order" }. */
  facts: Record<string, string | undefined>;
  /** How sure the classifier is about each fact, 0..1. Missing counts as 0 for `>=` tests. */
  confidence?: Record<string, number | undefined>;
  /** The assistant's previous reply, for `asked <id>`. */
  lastReply?: string;
};

/** One branch the engine looked at, in order. The Studio draws this. */
export type Step = { path: string; matched: boolean };

export type Decision = (
  | { kind: "model" }
  | { kind: "refuse"; text: string }
  | { kind: "reply"; text: string }
  | { kind: "ask"; ask: string; text: string }
  | { kind: "direct"; name: string }
) & { path: string; trace: Step[] };

export type EngineOptions = {
  /** Code for every `check name = host`. */
  checks?: Record<string, (turn: Turn) => boolean>;
  /** Picks one text from a list. Defaults to random; pass `() => 0` for tests. */
  pick?: (count: number) => number;
};

export type Engine = { program: Program; decide: (turn: Turn) => Decision };

export function createEngine(program: Program, options: EngineOptions = {}): Engine {
  const errors = check(program).filter((d) => d.severity === "error");
  if (errors.length) throw new Error(`This .dan program has errors:\n${errors.map(formatDiagnostic).join("\n")}`);

  const checks: Record<string, (turn: Turn) => boolean> = {};
  for (const c of Object.values(program.checks)) {
    if (c.host) {
      const fn = options.checks?.[c.name];
      if (!fn) throw new Error(`check "${c.name}" is marked host, but no code was given for it in createEngine({ checks }).`);
      checks[c.name] = fn;
    } else {
      const re = new RegExp(c.source, c.flags.replace("g", "")); // no "g": .test() must not keep state
      checks[c.name] = (turn) => re.test(turn.text);
    }
  }
  const pick = options.pick ?? ((n: number) => Math.floor(Math.random() * n));
  const choose = (texts: string[]) => texts[Math.min(texts.length - 1, Math.max(0, pick(texts.length)))]!;

  const test = (cond: Cond, turn: Turn): boolean => {
    switch (cond.kind) {
      case "and":
        return test(cond.left, turn) && test(cond.right, turn);
      case "or":
        return test(cond.left, turn) || test(cond.right, turn);
      case "not":
        return !test(cond.cond, turn);
      case "has":
        return checks[cond.check]!(turn);
      case "asked":
        return turn.lastReply !== undefined && (program.asks[cond.ask] ?? []).includes(turn.lastReply);
      case "is": {
        const value = turn.facts[cond.field];
        if (value === undefined || !cond.values.includes(value)) return false;
        if (cond.min === undefined) return true;
        const min = typeof cond.min === "string" ? (program.lets[cond.min] as number) : cond.min;
        return (turn.confidence?.[cond.field] ?? 0) >= min;
      }
    }
  };

  type Hit = { leaf: Leaf; path: string[] } | null;

  const decide = (turn: Turn): Decision => {
    const trace: Step[] = [];
    const walk = (branches: Branch[], path: string[]): Hit | "no-match" => {
      for (const b of branches) {
        const here = [...path, b.id];
        const matched = b.when === "else" || test(b.when, turn);
        trace.push({ path: here.join("/"), matched });
        if (!matched) continue;
        if (b.leaf?.kind === "flow") return walk(program.flows[b.leaf.flow]!.branches, here);
        if (b.leaf) return { leaf: b.leaf, path: here };
        return walk(b.children, here);
      }
      return path.length ? ({ leaf: { kind: "model" }, path: [...path, "no-match"] } as Hit) : "no-match";
    };
    const hit = walk(program.flows[program.entry]!.branches, []);
    if (hit === "no-match" || hit === null) return { kind: "model", path: "no-match", trace };
    const path = hit.path.join("/");
    const leaf = hit.leaf;
    switch (leaf.kind) {
      case "model":
      case "flow": // unreachable: flows are followed above
        return { kind: "model", path, trace };
      case "refuse":
        return { kind: "refuse", text: choose(leaf.texts), path, trace };
      case "reply":
        return { kind: "reply", text: choose(leaf.texts), path, trace };
      case "ask":
        return { kind: "ask", ask: leaf.id, text: choose(leaf.texts), path, trace };
      case "direct":
        return { kind: "direct", name: leaf.name, path, trace };
    }
  };

  return { program, decide };
}
