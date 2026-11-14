import { describe, expect, test } from "vitest";
import { check, createEngine, linkSources, parse, resolvePath } from "../index";

const HEAD = "field intent = [greet, bills, other]\n";
const run = (src: string) => linkSources({ "main.dan": HEAD + src });
const errors = (src: string) => check(run(src)).filter((d) => d.severity === "error").map((d) => d.message);

describe("parser", () => {
  test("nesting, comments as labels, reply lists, and/or/not", () => {
    const ast = parse(
      [
        "flow main",
        '  hi: when intent is greet -> reply ["Hi!", "Hello!"]   # say hi',
        "  b: when intent is bills and not (intent is other or intent is greet)",
        "    x: else -> model",
        "  open: else -> model",
      ].join("\n"),
    );
    const [hi, b] = ast.flows[0]!.branches;
    expect(hi).toMatchObject({ id: "hi", label: "say hi", leaf: { kind: "reply", texts: ["Hi!", "Hello!"] } });
    expect(b!.children[0]).toMatchObject({ id: "x", when: "else" });
    expect(b!.when).toMatchObject({ kind: "and", right: { kind: "not", cond: { kind: "or" } } });
  });

  test("errors point at the line and column, in plain words", () => {
    expect(() => parse("flow main\n  hi: when intent -> model")).toThrow(/main\.dan:2:\d+: Expected `is` or `in`/);
    expect(() => parse("flow main\n\thi: else -> model")).toThrow(/tabs/);
    expect(() => parse('flow main\n  hi: else -> reply "oops')).toThrow(/closing quote/);
    expect(() => parse("flow main\n  a: when intent is x\n      c: else -> model\n    b: else -> model")).toThrow(/does not line up/);
    expect(() => parse("  stray: else -> model")).toThrow(/not inside a `flow`/);
    expect(() => parse("nope x")).toThrow(/Unknown statement/);
  });

  test("checks: regex or host", () => {
    const ast = parse("check money = /\\d+ ?php/i\ncheck range = host");
    expect(ast.checks).toMatchObject([{ name: "money", host: false, source: "\\d+ ?php", flags: "i" }, { name: "range", host: true }]);
  });
});

describe("checker", () => {
  test("a clean program", () => {
    expect(check(run("flow main\n  hi: when intent is greet -> reply \"Hi\"\n  open: else -> model"))).toEqual([]);
  });

  test("typos are caught with a fix in the message", () => {
    expect(errors("flow main\n  a: when intnet is greet -> model\n  b: else -> model")[0]).toMatch(/Unknown field "intnet"/);
    expect(errors("flow main\n  a: when intent is gret -> model\n  b: else -> model")[0]).toMatch(/not a value of field intent/);
    expect(errors("flow main\n  a: when has money -> model\n  b: else -> model")[0]).toMatch(/Unknown check "money"/);
    expect(errors("flow main\n  a: when asked q -> model\n  b: else -> model")[0]).toMatch(/Unknown ask "q"/);
    expect(errors("flow main\n  a: when intent is greet >= sure -> model\n  b: else -> model")[0]).toMatch(/let sure/);
    expect(errors("flow main\n  a: else -> bils")[0]).toMatch(/"bils" is not a flow/);
  });

  test("structure mistakes", () => {
    expect(errors("flow main\n  a: else -> model\n  b: when intent is greet -> model")[0]).toMatch(/never be reached/);
    expect(errors("flow main\n  a: when intent is greet\n  b: else -> model")[0]).toMatch(/does nothing/);
    expect(errors("flow main\n  a: when intent is greet >= 1.5 -> model\n  b: else -> model")[0]).toMatch(/between 0 and 1/);
    expect(errors("flow main\n  a: else -> other\nflow other\n  b: else -> main")[0]).toMatch(/loop forever/);
    expect(errors("flow start\n  a: else -> model")[0]).toMatch(/no `flow main`/);
  });

  test("warnings: missing else, unused flow", () => {
    const ds = check(run("flow main\n  a: when intent is greet -> model\nflow spare\n  b: else -> model"));
    expect(ds.map((d) => d.severity)).toEqual(["warning", "warning"]);
  });
});

describe("linking and engine", () => {
  test("use follows relative paths across folders", () => {
    expect(resolvePath("flows/main.dan", "../shared/bills.dan")).toBe("shared/bills.dan");
    const p = linkSources({
      "app/main.dan": 'use "./sub/bills.dan"\n' + HEAD + "flow main\n  b: when intent is bills -> bills\n  open: else -> model",
      "app/sub/bills.dan": 'flow bills\n  pay: else -> reply "Paid"',
    }, "app/main.dan");
    const d = createEngine(p, { pick: () => 0 }).decide({ text: "", facts: { intent: "bills" } });
    expect(d).toMatchObject({ kind: "reply", text: "Paid", path: "b/pay" });
  });

  test("a missing use file says which line asked for it", () => {
    expect(() => linkSources({ "main.dan": 'use "./nope.dan"' })).toThrow(/main\.dan:1:1: Could not find "\.\/nope\.dan"/);
  });

  test("the engine refuses a program with errors, or a host check without code", () => {
    expect(() => createEngine(run("flow main\n  a: when intnet is greet -> model"))).toThrow(/has errors/);
    expect(() => createEngine(linkSources({ "main.dan": "check r = host\nflow main\n  a: when has r -> model\n  b: else -> model" }))).toThrow(/marked host/);
  });

  test("nothing matches: falls to the model with a no-match path", () => {
    const e = createEngine(run("flow main\n  a: when intent is greet\n    x: when intent is bills -> model\n  b: when intent is bills -> model"));
    expect(e.decide({ text: "", facts: { intent: "greet" } })).toMatchObject({ kind: "model", path: "a/no-match" });
    expect(e.decide({ text: "", facts: { intent: "other" } })).toMatchObject({ kind: "model", path: "no-match" });
  });

  test("missing confidence counts as 0", () => {
    const e = createEngine(run("flow main\n  a: when intent is greet >= 0.5 -> reply \"hi\"\n  b: else -> model"));
    expect(e.decide({ text: "", facts: { intent: "greet" } }).kind).toBe("model");
    expect(e.decide({ text: "", facts: { intent: "greet" }, confidence: { intent: 0.6 } }).kind).toBe("reply");
  });
});
