# danlang

A small language for **chat routing**: write how an AI assistant decides what to do with a message in plain,
readable `.dan` files. Cheap answers first (rules, a classifier like Jev), the expensive LLM only when needed.

Status: **v0, step 1** (parser, checker, engine). Next: CLI (`dan check`, `dan test`), providers (OpenRouter/Jev,
Gemini, ...), the localhost Studio, and SKILL.md / AGENTS.md for AI assistants.

## Example

```dan
use "./bills.dan"

field intent = [bir_forms, business_qa, schedule_task, out_of_scope]
field action = [tax_due, log_expense, other]
let sure = 0.8

flow main
  off-topic: when intent is out_of_scope >= 0.9 -> refuse "I can only help with your business."
  bir-money: when intent in [bir_forms, business_qa] -> bills   # a comment here becomes the label
  open: else -> model

# bills.dan
check amount = /₱|\d[\d,]*/i

flow bills
  tax-due: when action is tax_due >= sure -> direct tax_due
  expense: when action is log_expense >= sure
    has-amount: when has amount -> model
    answer: when asked expense_amount -> model
    ask-amount: else -> ask expense_amount ["How much was it?", "How much did you pay?"]
  open: else -> model
```

The engine starts at `flow main`, goes top to bottom, and takes the **first** branch whose test passes, until it
reaches an action after `->`.

## Syntax (v0)

| Statement | Meaning |
|---|---|
| `use "./file.dan"` | Include another file (relative path). |
| `field name = [a, b, c]` | A fact the classifier answers, and its allowed values. Typos are caught. |
| `let name = 0.8` | A named number (used for confidences). |
| `check name = /regex/i` | A test on the message text. Comments are not allowed on this line. |
| `check name = host` | A test the app provides in code (e.g. needs today's date). |
| `flow name` | A list of branches. `main` is where every message starts. |

Branch: `id: when <test> -> <action>`, or `id: else -> <action>`, or a test with branches indented under it.

Tests: `field is value`, `field in [a, b]`, either with `>= 0.8` or `>= sure`; `has check`; `asked ask_id`;
combined with `and`, `or`, `not`, `( )`.

Actions: `model` (LLM), `reply "text"`, `refuse "text"`, `ask id "text"` (texts may be a list; one is picked),
`direct name` (the app answers in code), or a flow name (continue there).

## Using it

```ts
import { readFileSync } from "node:fs";
import { link, check, createEngine } from "@danlang/core";

const program = link("flows/main.dan", (p) => readFileSync(p, "utf8"));
const problems = check(program); // errors and warnings, each with file:line:col and how to fix it
const engine = createEngine(program, { checks: { plain_range: (turn) => /* app code */ true } });

const d = engine.decide({
  text: "log expense for meralco",
  facts: { intent: "business_qa", action: "log_expense", source: "jev" },
  confidence: { intent: 0.95, action: 0.92 },
});
// d = { kind: "ask", ask: "expense_amount", text: "...", path: "bir-money/expense/ask-amount", trace: [...] }
```

`@danlang/core` is pure TypeScript with no Node, browser or network code, so it runs in Next.js routes, edge
functions, browsers and React Native. No extra server.

## Repo

- `packages/core`: parser → linker → checker → engine. `pnpm verify` runs typecheck + tests.
- `examples/juanstack`: JuanStack's chat tree ported to danlang; its tests prove it decides exactly like the original.
