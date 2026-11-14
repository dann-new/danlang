/** The lesson 2 example in examples/first-flow: read from disk, checked, and run. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { check, createEngine, link } from "../index";

const MAIN = fileURLToPath(new URL("../../../../examples/first-flow/main.dan", import.meta.url));
const program = link(MAIN, (p) => readFileSync(p, "utf8"));
const engine = createEngine(program);

const decide = (topic: string, sure = 0.95) => engine.decide({ text: "", facts: { topic }, confidence: { topic: sure } });

test("the example has no errors or warnings", () => {
  expect(check(program)).toEqual([]);
});

test("every topic has a description for the classifier", () => {
  expect(Object.keys(program.fieldInfo.topic!.describe).sort()).toEqual([...program.fields.topic!].sort());
});

test("first rule that fits wins", () => {
  expect(decide("greeting")).toMatchObject({ kind: "reply", path: "say-hi", text: "Hi!" });
  expect(decide("thanks")).toMatchObject({ kind: "reply", path: "say-welcome", text: "You're welcome!" });
  expect(decide("other")).toMatchObject({ kind: "model", path: "open" });
});

test("an unsure greeting goes to the big AI", () => {
  expect(decide("greeting", 0.5)).toMatchObject({ kind: "model", path: "open" });
});
