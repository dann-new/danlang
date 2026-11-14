/** The multi-file example in examples/shop: read from disk, linked, and run end to end. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { check, createEngine, link, type Turn } from "../index";

const MAIN = fileURLToPath(new URL("../../../../examples/shop/main.dan", import.meta.url));
const program = link(MAIN, (p) => readFileSync(p, "utf8"));

let online = true;
const engine = createEngine(program, { checks: { orders_online: () => online }, pick: () => 0 });

type In = { text?: string; topic?: string; action?: string; sure?: number; source?: string; lastReply?: string };
function decide(i: In) {
  const turn: Turn = {
    text: i.text ?? "",
    facts: { source: i.source ?? "classifier", topic: i.topic ?? "other", action: i.action ?? "other" },
    confidence: { topic: i.sure ?? 0.95, action: i.sure ?? 0.95 },
    ...(i.lastReply ? { lastReply: i.lastReply } : {}),
  };
  return engine.decide(turn);
}

test("the example has no errors or warnings", () => {
  expect(check(program)).toEqual([]);
  expect(program.files.map((f) => f.split("/").pop())).toEqual(["main.dan", "shop.dan"]);
});

describe("free answers", () => {
  test("greeting", () => {
    expect(decide({ text: "hi!", topic: "greeting" })).toMatchObject({ kind: "reply", path: "hello", text: "Hi! How can I help with your order today?" });
  });
  test("tracking without a number asks for it", () => {
    expect(decide({ text: "where is my order?", topic: "orders", action: "track_order" })).toMatchObject({
      kind: "ask",
      ask: "order_number_question",
      path: "shop/track/ask-number",
    });
  });
  test("tracking with a number is looked up by the app", () => {
    online = true;
    expect(decide({ text: "where is order 48213?", topic: "orders", action: "track_order" })).toMatchObject({ kind: "direct", name: "track_order" });
  });
  test("very sure off-topic is refused", () => {
    expect(decide({ text: "weather?", topic: "off_topic", sure: 0.95 })).toMatchObject({ kind: "refuse", path: "off-topic" });
  });
});

describe("goes to the AI", () => {
  test("order system offline: the AI handles the lookup", () => {
    online = false;
    expect(decide({ text: "where is order 48213?", topic: "orders", action: "track_order" })).toMatchObject({ kind: "model", path: "shop/track/has-number" });
    online = true;
  });
  test("answering our question", () => {
    const asked = program.asks.order_number_question![1]!;
    expect(decide({ text: "the blue shoes", topic: "returns", action: "return_item", lastReply: asked }).path).toBe("shop/return/answer");
  });
  test("a return with a number", () => {
    expect(decide({ text: "return order 48213", topic: "returns", action: "return_item" })).toMatchObject({ kind: "model", path: "shop/return/has-number" });
  });
  test("unsure off-topic is not refused", () => {
    expect(decide({ text: "weather?", topic: "off_topic", sure: 0.7 })).toMatchObject({ kind: "model", path: "open" });
  });
  test("unsure classifier: below the global confidence (80%), the topic test fails", () => {
    expect(decide({ text: "order", topic: "orders", action: "track_order", sure: 0.5 }).path).toBe("open");
  });
  test("classifier down: everything goes to the AI", () => {
    expect(decide({ text: "hi", topic: "greeting", source: "fallback" })).toMatchObject({ kind: "model", path: "classifier-down" });
  });
});

test("the trace lists every rule tested, in order", () => {
  const d = decide({ text: "where is my order?", topic: "orders", action: "track_order" });
  expect(d.trace.filter((s) => s.matched).map((s) => s.path)).toEqual(["shop", "shop/track", "shop/track/ask-number"]);
});
