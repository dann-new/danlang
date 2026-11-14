---
name: danlang
description: Read, write, edit and debug danlang (.dan) chat-routing files, and wire @danlang/core into an app. Use whenever a .dan file is involved, or the user mentions danlang, a chat routing tree, Jev routing, or deciding when a chatbot should call the LLM.
---

# danlang

danlang decides what a chatbot does with each message. A classifier (any small model or rule set) answers **fields** about the
message with a confidence; a `.dan` file is a tree of rules; the engine walks it from `flow main`, top to bottom,
and takes the **first** rule that fits. Only the `model` action calls the LLM; every other action is free.

## Syntax (complete)

```dan
field intent "What is it about?" = [       # a fact the classifier answers + every allowed value
  greeting "Says hello.",                  # optional descriptions (sent to the classifier)
  orders "About an existing order.",
  other,
]
confidence = 80%                           # min confidence for every == test (default 80% if omitted)
let sure = 0.8                             # a named number (95% and 0.95 are the same)
let hello = ["Hi!", "Hello!"]              # named messages (one picked at random); may span lines:
let sorry = [
  "Sorry, I only help with your orders.",
  "That's outside what I do!",
]
# A check is a regex on the message text. Never put a comment on a check line.
check order_number = /\d{4,}/
# The app supplies this check in code.
check in_hours = host

flow main                                  # every program starts at flow main
  hi: when intent == greeting -> reply hello
  order: when intent == orders >= sure        # no "->": the rules under it decide
    has-num: when has order_number -> direct order_status
    ask-num: else -> ask order_number_question
  no: when intent == other >= 0.9 -> refuse sorry
  open: else -> model                      # always end each level with else

let order_number_question = ["What's your order number?", "Which order is it?"]
```

Other files: `use "./other.dan"` at the top (path relative to the file). Names (flows, lets, checks) are global
and must be unique across all files.

**Rule line:** `name: when <test> -> <action>` | `name: else -> <action>` | `name: when <test>` + indented rules.
Names: letters, digits, `_`, `-`; unique within one level. Indent with spaces (2 per level), never tabs.

**Tests:**
- `field == value`, `field == [a, b]` (any of). Needs confidence >= the rule's own `>= 90%` / `>= 0.9` / `>= let_name`,
  else the program's `confidence = ...`, else 80%. A fact passed with no confidence counts as 100%.
- `has check_name`
- `asked message_list` (the bot's previous reply was one of that `ask`'s messages)
- `and`, `or`, `not`, `( )` (`and` binds tighter than `or`)

`=` only declares (`let`, `field`, `check`). `==` only compares. `is`/`in`/`=` in a test is an error.

**Actions** (after `->`):

| Action | Meaning | LLM? |
|---|---|---|
| `model` | let the LLM answer | yes |
| `reply X` / `refuse X` | send one message | no |
| `ask X` | ask for a missing detail; enables `asked X` next turn | no |
| `direct handler` | app code answers (returns the handler name) | no |
| `flow_name` | continue in that flow (path keeps growing) | depends |
| `uproot` / `uproot(2)` / `uproot(all)` | leave the node the chat waits at, go up N levels (or to the top), re-check the same message there | depends |

`X` = a `let` name, `"text"`, or `["a", "b"]`. `ask list_name` uses the list name as the ask id.

## Conversations (state)

- After `ask`, the conversation **waits at the node that contains the rule**. The next message is checked from that
  node's rules, not from `main`, so short answers ("3pm", "friday") still land there even if the classifier calls
  them `other`.
- While waiting, every `check` that matched is **remembered** (`has time` stays true). Any action other than `ask`
  finishes the task: back to the top, memory cleared.
- The app must pass state along: `const d = engine.decide({ ..., state }); state = d.state;`
  (`START` = the top). `d.startedAt` and `d.moves` show where it resumed and any uproots.
- `uproot` is not allowed in the top rules of `flow main`.

## Patterns

Missing-detail pattern (use for every "do something" action): wait until every detail is there.

```dan
field action = [book, other]
check date = /\b(monday|friday|tomorrow)\b/i
check time = /\b\d{1,2}\s?(am|pm)\b/i
check never_mind = /\b(never ?mind|cancel)\b/i

flow main
  booking: when action == book
    ready: when has date and has time -> model
    stop: when has never_mind -> uproot(all)
    need-date: when has time -> ask "What day?"
    need-time: when has date -> ask "What time?"
    need-both: else -> ask ["What day and time?", "When should it be?"]
  open: else -> model
```

Safety rules to follow when writing trees:
- Put "classifier failed" first (e.g. `when source == fallback -> model`).
- Set `confidence` once; add a stricter `>= 90%` on `refuse` rules.
- When unsure what the user wants, route to `model`, not to a fixed reply.
- Give replies 2-3 phrasings so the bot doesn't sound robotic.
- Split a flow into its own flow/file once it has more than ~3 levels.

## Checking your work

After editing `.dan` files, check them. Errors stop the engine; each message says how to fix it.

```ts
import { readFileSync } from "node:fs";
import { link, check, formatDiagnostic } from "@danlang/core";
const program = link("path/to/main.dan", (p) => readFileSync(p, "utf8"));
console.log(check(program).map(formatDiagnostic).join("\n") || "no problems");
```

Common fixes: `Unknown field` → declare `field`; `not a value of field` → use a listed value; `Unknown message list`
→ add the `let`; `can never be reached` → move `else` last; `does nothing` → add `-> action` or child rules;
`loop forever` → remove a flow jump cycle; `between 0 and 1` → write 0.8 not 80.

## Using it in an app

```ts
import { link, createEngine } from "@danlang/core";
const engine = createEngine(link("bot/main.dan", load), { checks: { in_hours: (turn) => true } });
const d = engine.decide({
  text, facts: { intent: "orders" }, confidence: { intent: 0.93 }, lastReply,
});
// d.kind: "model" | "reply" | "refuse" | "ask" | "direct"; d.text (reply/refuse/ask); d.name (direct);
// d.path e.g. "order/has-num"; d.trace = every rule tested.
```

`@danlang/core` is pure TypeScript (no Node/DOM/network): Next.js routes, edge functions, browsers, React Native.
No file system? Use `linkSources({ "main.dan": text, ... })`. Build the engine once; `decide()` is sync.
Tests: `createEngine(program, { pick: () => 0 })` makes message choice deterministic.

Full beginner lessons: the danlang docs site (repo `docs/lessons`).
