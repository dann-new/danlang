---
name: danlang
description: Read, write, edit and debug danlang (.dan) chat-routing files, and wire @danlang/core into an app. Use whenever a .dan file is involved, or the user mentions danlang, a chat routing tree, Jev routing, or deciding when a chatbot should call the LLM.
---

# danlang

danlang decides what a chatbot does with each message. A classifier (e.g. Jev) answers **fields** about the
message with a confidence; a `.dan` file is a tree of rules; the engine walks it from `flow main`, top to bottom,
and takes the **first** rule that fits. Only the `model` action calls the LLM; every other action is free.

## Syntax (complete)

```dan
field intent = [greeting, taxes, other]    # a fact the classifier answers + every allowed value
let sure = 0.8                             # a named number
let hello = ["Hi!", "Hello!"]              # named messages (one picked at random); may span lines:
let sorry = [
  "Sorry, I only help with business.",
  "That's outside what I do!",
]
# A check is a regex on the message text. Never put a comment on a check line.
check amount = /\d[\d,]*/i
# The app supplies this check in code.
check in_hours = host

flow main                                  # every program starts at flow main
  hi: when intent == greeting -> reply hello
  tax: when intent == taxes >= sure        # no "->": the rules under it decide
    has-num: when has amount -> direct tax_summary
    ask-num: else -> ask amount_question
  no: when intent == other >= 0.9 -> refuse sorry
  open: else -> model                      # always end each level with else

let amount_question = ["How much was it?", "What was the amount?"]
```

Other files: `use "./other.dan"` at the top (path relative to the file). Names (flows, lets, checks) are global
and must be unique across all files.

**Rule line:** `name: when <test> -> <action>` | `name: else -> <action>` | `name: when <test>` + indented rules.
Names: letters, digits, `_`, `-`; unique within one level. Indent with spaces (2 per level), never tabs.

**Tests:**
- `field == value`, `field == [a, b]` (any of), optional `>= 0.8` or `>= let_name` (confidence; missing = 0)
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

`X` = a `let` name, `"text"`, or `["a", "b"]`. `ask list_name` uses the list name as the ask id.

## Patterns

Missing-detail pattern (use for every "do something" action):

```dan
field action = [log_expense, other]
let sure = 0.8
check amount = /\d/
let expense_question = ["How much was it, and who did you pay?", "How much did you spend?"]

flow main
  expense: when action == log_expense >= sure
    has-amount: when has amount -> model
    answer: when asked expense_question -> model
    ask-amount: else -> ask expense_question
  open: else -> model
```

Safety rules to follow when writing trees:
- Put "classifier failed" first (e.g. `when source == fallback -> model`).
- Use `>=` on every rule that answers without the LLM; use a higher bar (0.9) for `refuse`.
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
  text, facts: { intent: "taxes" }, confidence: { intent: 0.93 }, lastReply,
});
// d.kind: "model" | "reply" | "refuse" | "ask" | "direct"; d.text (reply/refuse/ask); d.name (direct);
// d.path e.g. "tax/has-num"; d.trace = every rule tested.
```

`@danlang/core` is pure TypeScript (no Node/DOM/network): Next.js routes, edge functions, browsers, React Native.
No file system? Use `linkSources({ "main.dan": text, ... })`. Build the engine once; `decide()` is sync.
Tests: `createEngine(program, { pick: () => 0 })` makes message choice deterministic.

Full beginner lessons: the danlang docs site (repo `docs/lessons`).
