/** Conversations: ask stays at its node, details are remembered there, uproot moves up. */
import { describe, expect, test } from "vitest";
import { check, createEngine, linkSources, START, type ConversationState, type Decision } from "../index";

const BOT = `
field action = [book, cancel_all, other]

check date = /\\b(monday|tuesday|friday|tomorrow|\\d{1,2}\\/\\d{1,2})\\b/i
check time = /\\b\\d{1,2}(:\\d{2})?\\s?(am|pm)\\b/i
check never_mind = /\\b(never ?mind|cancel|forget it)\\b/i

flow main
  booking: when action == book -> booking
  open: else -> model

flow booking
  ready: when has date and has time -> direct book_meeting
  stop: when has never_mind -> uproot(all)
  need-date: when has time -> ask "What date?"
  need-time: when has date -> ask "What time?"
  need-both: else -> ask "What date and time?"
`;

const program = linkSources({ "main.dan": BOT });
const engine = createEngine(program, { pick: () => 0 });

/** Plays a whole chat; each message passes the previous state. */
function chat(...messages: [string, string][]): Decision[] {
  let state: ConversationState = START;
  return messages.map(([text, action]) => {
    const d = engine.decide({ text, facts: { action }, state });
    state = d.state;
    return d;
  });
}

test("the bot has no problems", () => expect(check(program)).toEqual([]));

describe("asking until the details are there", () => {
  test("only a time: ask for the date and WAIT at booking", () => {
    const [d] = chat(["schedule my appointment with Mr Tan at 3pm", "book"]);
    expect(d).toMatchObject({ kind: "ask", text: "What date?", path: "booking/need-date" });
    expect(d!.state).toEqual({ at: ["booking"], found: ["time"] });
  });

  test("the answer is checked from booking, and the time is remembered", () => {
    // Turn 2: the classifier thinks "friday" is "other", but we're waiting at booking, so the top isn't used.
    const [, d2] = chat(["meet Mr Tan at 3pm", "book"], ["friday", "other"]);
    expect(d2).toMatchObject({ kind: "direct", name: "book_meeting", path: "booking/ready", startedAt: "booking" });
    expect(d2!.state).toEqual(START); // done: back to the top
  });

  test("no useful answer: it stays and asks again", () => {
    const [, d2, d3] = chat(["book a meeting", "book"], ["hmm", "other"], ["at 10am", "other"]);
    expect(d2).toMatchObject({ kind: "ask", text: "What date and time?", startedAt: "booking" });
    expect(d3).toMatchObject({ kind: "ask", text: "What date?" });
    expect(d3!.state.found).toEqual(["time"]);
  });

  test("everything in one message goes straight through", () => {
    const [d] = chat(["book Mr Tan tomorrow 2pm", "book"]);
    expect(d).toMatchObject({ kind: "direct", path: "booking/ready", startedAt: "" });
  });
});

describe("uproot", () => {
  test("never mind: back to the top, and the message is handled there", () => {
    const [, d2] = chat(["book a meeting", "book"], ["never mind", "other"]);
    expect(d2!.moves).toEqual([{ from: "booking", to: "" }]);
    expect(d2).toMatchObject({ kind: "model", path: "open", state: START });
  });

  test("uproot(1) goes up one level and uproot(2) two", () => {
    const src = `
field x = [a, b]
flow main
  outer: when x == a
    inner: when x == a
      up1: when has one -> uproot
      up2: when has two -> uproot(2)
      wait: else -> ask "?"
    after-up1: else -> reply "outer caught it"
  open: else -> reply "top caught it"

check one = /one/
check two = /two/
`;
    const e = createEngine(linkSources({ "main.dan": src }), { pick: () => 0 });
    const waiting = e.decide({ text: "", facts: { x: "a" } }).state;
    expect(waiting.at).toEqual(["outer", "inner"]);
    // After uproot(1) we're at "outer": its rules are checked again with the same facts (x == a → inner again → ...).
    const d1 = e.decide({ text: "one", facts: { x: "b" }, state: waiting });
    expect(d1.moves).toEqual([{ from: "outer/inner", to: "outer" }]);
    expect(d1).toMatchObject({ kind: "reply", text: "outer caught it" });
    const d2 = e.decide({ text: "two", facts: { x: "b" }, state: waiting });
    expect(d2.moves).toEqual([{ from: "outer/inner", to: "" }]);
    expect(d2).toMatchObject({ kind: "reply", text: "top caught it" });
  });

  test("uproot at the top of main is an error, and bad levels don't parse", () => {
    const errs = check(linkSources({ "main.dan": "flow main\n  x: else -> uproot" })).map((d) => d.message);
    expect(errs[0]).toMatch(/nowhere to go up/);
    expect(() => linkSources({ "main.dan": "flow main\n  a: else\n    x: else -> uproot(0)" })).toThrow(/uproot\(1\)/);
  });

  test("an old state that points to a removed node starts at the top", () => {
    const d = engine.decide({ text: "hi", facts: { action: "other" }, state: { at: ["gone"], found: [] } });
    expect(d).toMatchObject({ startedAt: "", path: "open" });
  });

  test("uprooting in circles stops safely", () => {
    const src = "field x = [a]\nflow main\n  l: when x == a\n    back: else -> uproot\n  open: else -> model";
    const e = createEngine(linkSources({ "main.dan": src }));
    expect(e.decide({ text: "", facts: { x: "a" } }).path).toBe("too-many-uproots");
  });
});
