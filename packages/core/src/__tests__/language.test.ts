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
        '  hi: when intent = greet -> reply ["Hi!", "Hello!"]   # say hi',
        "  b: when intent = bills and not (intent = other or intent = greet)",
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
    expect(() => parse("flow main\n  hi: when intent -> model")).toThrow(/main\.dan:2:\d+: Expected "=" after "intent"/);
    expect(() => parse("flow main\n\thi: else -> model")).toThrow(/tabs/);
    expect(() => parse('flow main\n  hi: else -> reply "oops')).toThrow(/closing quote/);
    expect(() => parse("flow main\n  a: when intent = x\n      c: else -> model\n    b: else -> model")).toThrow(/does not line up/);
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
    expect(check(run("flow main\n  hi: when intent = greet -> reply \"Hi\"\n  open: else -> model"))).toEqual([]);
  });

  test("typos are caught with a fix in the message", () => {
    expect(errors("flow main\n  a: when intnet = greet -> model\n  b: else -> model")[0]).toMatch(/Unknown field "intnet"/);
    expect(errors("flow main\n  a: when intent = gret -> model\n  b: else -> model")[0]).toMatch(/not a value of field intent/);
    expect(errors("flow main\n  a: when has money -> model\n  b: else -> model")[0]).toMatch(/Unknown check "money"/);
    expect(errors("flow main\n  a: when asked q -> model\n  b: else -> model")[0]).toMatch(/Unknown ask "q"/);
    expect(errors("flow main\n  a: when intent = greet >= sure -> model\n  b: else -> model")[0]).toMatch(/let sure/);
    expect(errors("flow main\n  a: else -> bils")[0]).toMatch(/"bils" is not a flow/);
  });

  test("structure mistakes", () => {
    expect(errors("flow main\n  a: else -> model\n  b: when intent = greet -> model")[0]).toMatch(/never be reached/);
    expect(errors("flow main\n  a: when intent = greet\n  b: else -> model")[0]).toMatch(/does nothing/);
    expect(errors("flow main\n  a: when intent = greet >= 1.5 -> model\n  b: else -> model")[0]).toMatch(/between 0 and 1/);
    expect(errors("flow main\n  a: else -> other\nflow other\n  b: else -> main")[0]).toMatch(/loop forever/);
    expect(errors("flow start\n  a: else -> model")[0]).toMatch(/no `flow main`/);
  });

  test("warnings: missing else, unused flow", () => {
    const ds = check(run("flow main\n  a: when intent = greet -> model\nflow spare\n  b: else -> model"));
    expect(ds.map((d) => d.severity)).toEqual(["warning", "warning"]);
  });
});

describe("linking and engine", () => {
  test("use follows relative paths across folders", () => {
    expect(resolvePath("flows/main.dan", "../shared/bills.dan")).toBe("shared/bills.dan");
    const p = linkSources({
      "app/main.dan": 'use "./sub/bills.dan"\n' + HEAD + "flow main\n  b: when intent = bills -> bills\n  open: else -> model",
      "app/sub/bills.dan": 'flow bills\n  pay: else -> reply "Paid"',
    }, "app/main.dan");
    const d = createEngine(p, { pick: () => 0 }).decide({ text: "", facts: { intent: "bills" } });
    expect(d).toMatchObject({ kind: "reply", text: "Paid", path: "b/pay" });
  });

  test("a missing use file says which line asked for it", () => {
    expect(() => linkSources({ "main.dan": 'use "./nope.dan"' })).toThrow(/main\.dan:1:1: Could not find "\.\/nope\.dan"/);
  });

  test("the engine refuses a program with errors, or a host check without code", () => {
    expect(() => createEngine(run("flow main\n  a: when intnet = greet -> model"))).toThrow(/has errors/);
    expect(() => createEngine(linkSources({ "main.dan": "check r = host\nflow main\n  a: when has r -> model\n  b: else -> model" }))).toThrow(/marked host/);
  });

  test("nothing matches: falls to the model with a no-match path", () => {
    const e = createEngine(run("flow main\n  a: when intent = greet\n    x: when intent = bills -> model\n  b: when intent = bills -> model"));
    expect(e.decide({ text: "", facts: { intent: "greet" } })).toMatchObject({ kind: "model", path: "a/no-match" });
    expect(e.decide({ text: "", facts: { intent: "other" } })).toMatchObject({ kind: "model", path: "no-match" });
  });

  test("missing confidence counts as 0", () => {
    const e = createEngine(run("flow main\n  a: when intent = greet >= 0.5 -> reply \"hi\"\n  b: else -> model"));
    expect(e.decide({ text: "", facts: { intent: "greet" } }).kind).toBe("model");
    expect(e.decide({ text: "", facts: { intent: "greet" }, confidence: { intent: 0.6 } }).kind).toBe("reply");
  });
});

describe("messages in let", () => {
  test("a let list (even over several lines) feeds reply, refuse and ask, picked at random", () => {
    const p = run(
      [
        "let hello = [",
        '  "Hi!",       # friendly',
        '  "Hello!",',
        "]",
        'let one = "Just one"',
        "flow main",
        "  hi: when intent = greet -> reply hello",
        "  b: when intent = bills -> ask one",
        "  open: else -> refuse one",
      ].join("\n"),
    );
    expect(p.lets.hello).toEqual(["Hi!", "Hello!"]);
    expect(check(p)).toEqual([]);
    const e = createEngine(p, { pick: (n) => n - 1 });
    expect(e.decide({ text: "", facts: { intent: "greet" } })).toMatchObject({ kind: "reply", text: "Hello!" });
    expect(e.decide({ text: "", facts: { intent: "bills" } })).toMatchObject({ kind: "ask", ask: "one", text: "Just one" });
    expect(e.decide({ text: "", facts: { intent: "bills" }, lastReply: "Just one" }).kind).toBe("ask");
  });

  test("random pick uses every message over many turns", () => {
    const e = createEngine(run('let hi = ["a", "b", "c"]\nflow main\n  x: else -> reply hi'));
    const seen = new Set(Array.from({ length: 200 }, () => (e.decide({ text: "", facts: {} }) as { text: string }).text));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
  });

  test("mistakes with message lists", () => {
    expect(errors("flow main\n  x: else -> reply nope")[0]).toMatch(/Unknown message list "nope"/);
    expect(errors("let n = 5\nflow main\n  x: else -> reply n")[0]).toMatch(/is a number/);
    expect(errors('let m = ["a"]\nflow main\n  x: when intent = greet >= m -> model\n  y: else -> model')[0]).toMatch(/holds messages/);
    expect(() => parse("flow main\n  x: when intent is greet -> model")).toThrow(/Use "=" here/);
    expect(() => parse('let m = [\n  "a",\n')).toThrow(/never closed/);
  });
});
