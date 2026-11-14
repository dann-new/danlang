# danlang

A small language for **chat routing**: write how an AI assistant decides what to do with a message in plain,
readable `.dan` files. Cheap answers first (a small classifier or simple rules), the expensive LLM only when needed.

**See it:** `pnpm studio` opens the Studio at http://localhost:3200: your tree as nodes, and a test chat that routes messages through the real classifier.

**Learn it:** run `pnpm dev:docs` and open http://localhost:3100 (lessons with Try it examples), or read `docs/lessons/`.

Status: **v0, step 1** (parser, checker, engine). Next: CLI (`dan check`, `dan test`), providers (classifier and LLM
adapters), the localhost Studio, and SKILL.md / AGENTS.md for AI assistants.

## Example

```dan
field topic = [greeting, orders, off_topic, other]
field action = [track_order, other]
let sure = 0.8

check order_number = /\d{4,}/

let order_number_question = [
  "Sure! What's your order number?",
  "Happy to help! Which order is it?",
]

flow main
  hello: when topic == greeting >= sure -> reply ["Hi!", "Hello! How can I help?"]
  off-topic: when topic == off_topic >= 0.9 -> refuse "Sorry, I can only help with orders."
  orders: when topic == orders -> orders
  open: else -> model

flow orders
  track: when action == track_order >= sure
    has-number: when has order_number -> direct track_order
    answer: when asked order_number_question -> model
    ask-number: else -> ask order_number_question
  open: else -> model
```

The engine starts at `flow main`, goes top to bottom, and takes the **first** branch whose test passes, until it
reaches an action after `->`.

## Syntax (v0)

| Statement | Meaning |
|---|---|
| `use "./file.dan"` | Include another file (relative path). |
| `field name "question?" = [a "meaning", b, c]` | A fact the classifier answers and its allowed values (descriptions optional, sent to the classifier). Typos are caught. |
| `confidence = 80%` | Minimum classifier confidence for every `==` test (default 80%). A rule's own `>= 90%` overrides it. |
| `let name = 0.8` | A named number (`95%` = `0.95`). |
| `let name = ["Hi!", "Hello!"]` | A list of messages (may span lines). One is picked at random. |
| `check name = /regex/i` | A test on the message text. Comments are not allowed on this line. |
| `check name = host` | A test the app provides in code (e.g. needs today's date). |
| `flow name` | A list of branches. `main` is where every message starts. |

Branch: `id: when <test> -> <action>`, or `id: else -> <action>`, or a test with branches indented under it.

Tests: `field == value`, `field == [a, b]` (any of them), either with `>= 0.8` or `>= sure`; `has check`;
`asked message_list`; combined with `and`, `or`, `not`, `( )`.

Actions: `model` (LLM), `reply "text"`, `refuse "text"`, `ask id "text"` (texts may be a list; one is picked),
`direct name` (the app answers in code), or a flow name (continue there).

## Using it

```ts
import { readFileSync } from "node:fs";
import { link, check, createEngine } from "@danlang/core";

const program = link("bot/main.dan", (p) => readFileSync(p, "utf8"));
const problems = check(program); // errors and warnings, each with file:line:col and how to fix it
const engine = createEngine(program, { checks: { orders_online: () => true } });

const d = engine.decide({
  text: "where is my order?",
  facts: { topic: "orders", action: "track_order" },
  confidence: { topic: 0.95, action: 0.92 },
});
// d = { kind: "ask", ask: "order_number_question", text: "...", path: "orders/track/ask-number", trace: [...] }
```

`@danlang/core` is pure TypeScript with no Node, browser or network code, so it runs in Next.js routes, edge
functions, browsers and React Native. No extra server.

## Repo

- `packages/core`: parser → linker → checker → engine. `pnpm verify` runs typecheck + tests.
- `docs/lessons`: 14 beginner lessons (the website shows these; every example is tested).
- `apps/docs`: the Next.js website (private, never published).
- `apps/studio`: the Studio, a local tool (private, never published). Needs `.env.local` (see `.env.example`).
- `packages/vscode`: editor colors (`pnpm vscode:install`).
- `examples/shop`: a two-file shop assistant, tested end to end.
