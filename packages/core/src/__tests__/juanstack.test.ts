/**
 * The JuanStack example must decide exactly like JuanStack's hand-written tree (apps/web/src/ai/juan-tree.ts).
 * Every case below is ported from apps/web/src/ai/__tests__/juan-tree.test.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { check, createEngine, link, type Turn } from "../index";

const EXAMPLE = fileURLToPath(new URL("../../../../examples/juanstack/main.dan", import.meta.url));
const program = link(EXAMPLE, (p) => readFileSync(p, "utf8"));

// Wednesday, Oct 22, 2026 (Manila). The host's `plain_range` check: same rules as JuanStack's scheduleRange().
const TODAY = "2026-10-22";
function plainRange(text: string): boolean {
  const t = text.toLowerCase();
  let found = 0;
  if (/\bnext week\b|\bsusunod na linggo\b/.test(t)) found++;
  else if (/\b(this|the) week\b|\bngayong linggo\b|\bthis coming week\b/.test(t)) found++;
  if (/\btomorrow\b|\bbukas\b/.test(t)) found++;
  if (/\btoday\b|\btonight\b|\bngayon(g araw)?\b(?! ?linggo)/.test(t)) found++;
  return found === 1;
}

const engine = createEngine(program, { checks: { plain_range: (turn) => plainRange(turn.text) }, pick: () => 0 });
const ASK = program.asks;

type In = {
  text?: string;
  intent?: string;
  intentConfidence?: number;
  action?: string;
  actionConfidence?: number;
  source?: string;
  lastAssistantText?: string;
};
/** Same defaults as JuanStack's test helper `input()`. */
function decide(over: In) {
  const i = { text: "", intent: "business_qa", intentConfidence: 0.95, action: "other", actionConfidence: 1, source: "jev", ...over };
  const turn: Turn = {
    text: i.text,
    facts: { intent: i.intent, action: i.action, source: i.source },
    confidence: { intent: i.intentConfidence, action: i.actionConfidence },
    ...(i.lastAssistantText ? { lastReply: i.lastAssistantText } : {}),
  };
  return engine.decide(turn);
}

test("the example has no errors or warnings", () => {
  expect(check(program)).toEqual([]);
  expect(TODAY).toBe("2026-10-22");
});

describe("direct answers (no Gemini)", () => {
  test("tax due goes straight to the tax engine", () => {
    const d = decide({ text: "magkano tax ko ngayong quarter?", intent: "bir_forms", action: "tax_due" });
    expect(d).toMatchObject({ kind: "direct", path: "money/tax-due", name: "tax_due" });
  });
  test("returns to approve", () => {
    expect(decide({ text: "anything to approve?", intent: "bir_forms", action: "returns_to_approve", source: "rules" }).kind).toBe("direct");
  });
  test("money summary", () => {
    expect(decide({ text: "how much did I earn this month?", action: "money_summary" })).toMatchObject({ kind: "direct", name: "money_summary" });
  });
  test("schedule for tomorrow is read directly", () => {
    const d = decide({ text: "what's on my schedule tomorrow?", intent: "schedule_task", action: "schedule_read" });
    expect(d).toMatchObject({ kind: "direct", name: "schedule_read", path: "schedule/read/plain-range" });
  });
  test("schedule for an unusual range goes to the model", () => {
    expect(decide({ text: "what do I have on the 30th?", intent: "schedule_task", action: "schedule_read" }).kind).toBe("model");
  });
});

describe("missing details are asked for", () => {
  test("an expense with no amount", () => {
    const d = decide({ text: "log expense for meralco", action: "log_expense" });
    expect(d).toMatchObject({ kind: "ask", ask: "expense_question" });
    if (d.kind === "ask") expect(d.text).toContain("₱1,500 to Meralco");
  });
  test("an expense with an amount goes to the model", () => {
    expect(decide({ text: "log a ₱1,500 expense for ink", action: "log_expense" }).kind).toBe("model");
  });
  test("never asks the same question twice in a row", () => {
    expect(decide({ text: "Meralco", action: "log_expense", lastAssistantText: ASK.expense_question![0] }).kind).toBe("model");
  });
  test("a meeting with no day or time", () => {
    expect(decide({ text: "schedule a meeting with Ana", intent: "schedule_task", action: "schedule_create" })).toMatchObject({ kind: "ask", ask: "when_question" });
  });
  test("a meeting with a day goes to the model", () => {
    expect(decide({ text: "schedule a call with Ana friday", intent: "schedule_task", action: "schedule_create" }).kind).toBe("model");
  });
});

describe("create an invoice", () => {
  test("no amount yet: fixed question", () => {
    expect(decide({ text: "create an invoice", action: "create_invoice", source: "rules" })).toMatchObject({
      kind: "ask",
      ask: "invoice_question",
      path: "money/invoice/ask-details",
    });
  });
  test("an amount goes to the model", () => {
    expect(decide({ text: "invoice Acme ₱25,000 for October bookkeeping", action: "create_invoice" }).kind).toBe("model");
  });
  test("the answer to our question goes to the model", () => {
    expect(decide({ text: "Acme, bookkeeping", action: "create_invoice", lastAssistantText: ASK.invoice_question![0] }).kind).toBe("model");
  });
  test("an unsure invoice action goes to the model", () => {
    expect(decide({ text: "invoice", action: "create_invoice", actionConfidence: 0.5 }).kind).toBe("model");
  });
});

describe("safety", () => {
  test("unsure action goes to the model", () => {
    expect(decide({ text: "may meeting ba ako bukas", intent: "schedule_task", action: "schedule_create", actionConfidence: 0.61 }).kind).toBe("model");
  });
  test("action that does not fit the intent goes to the model", () => {
    expect(decide({ text: "x", intent: "schedule_task", action: "tax_due" })).toMatchObject({ kind: "model", path: "schedule/open" });
  });
  test("Jev down: everything goes to the model", () => {
    expect(decide({ intent: "business_qa", action: "tax_due", source: "fallback" })).toMatchObject({ kind: "model", path: "jev-down" });
  });
  test("clearly off-topic gets a fixed reply", () => {
    const d = decide({ text: "what is the capital of france", intent: "out_of_scope", intentConfidence: 0.96, action: "other" });
    expect(d.kind).toBe("refuse");
    if (d.kind === "refuse") expect(d.text).toContain('"How much tax do I owe?"');
  });
  test("off-topic but unsure goes to the model", () => {
    expect(decide({ intent: "out_of_scope", intentConfidence: 0.7, action: "other" }).kind).toBe("model");
  });
  test("2307 always goes to the model", () => {
    expect(decide({ text: "make a 2307", intent: "bir_forms", action: "make_2307" })).toMatchObject({ kind: "model", path: "money/2307" });
  });
  test("open questions go to the model", () => {
    expect(decide({ text: "how do I grow my law firm", action: "other" })).toMatchObject({ kind: "model", path: "money/open" });
  });
});

describe("the regex checks match JuanStack's helpers", () => {
  const has = (name: string, text: string) => createEngine(program, { checks: { plain_range: () => false } }) && new RegExp(
    (program.checks[name] as { source: string }).source,
    (program.checks[name] as { flags: string }).flags,
  ).test(text);
  test("amount", () => {
    expect(has("amount", "₱500 to Meralco")).toBe(true);
    expect(has("amount", "1,500 for ink")).toBe(true);
    expect(has("amount", "log expense for meralco")).toBe(false);
  });
  test("day_or_time (Tagalog 'may' is not the month)", () => {
    expect(has("day_or_time", "bukas ng 2pm")).toBe(true);
    expect(has("day_or_time", "on friday")).toBe(true);
    expect(has("day_or_time", "may meeting with Ana")).toBe(false);
  });
});

test("the trace lists every branch tested, in order (for the Studio)", () => {
  const d = decide({ text: "create an invoice", action: "create_invoice" });
  expect(d.trace.filter((s) => s.matched).map((s) => s.path)).toEqual(["money", "money/invoice", "money/invoice/ask-details"]);
  expect(d.trace[0]).toEqual({ path: "jev-down", matched: false });
});
