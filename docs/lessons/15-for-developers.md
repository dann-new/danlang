---
title: For developers
summary: Install danlang and run your .dan files from your app's code.
---

# For developers

This lesson is for the person who connects danlang to an app. If you only write `.dan` files, you can skip it.

## Install

```bash
pnpm add @danlang/core
```

You only get the language itself: a few small TypeScript files, no dependencies. The docs website and lessons are
**not** included.

## Run a message

```ts
import { readFileSync } from "node:fs";
import { link, check, createEngine } from "@danlang/core";

// 1. Read your .dan files (main.dan and everything it uses).
const program = link("bot/main.dan", (path) => readFileSync(path, "utf8"));

// 2. Optional: list mistakes. createEngine refuses to start if there are errors.
for (const problem of check(program)) console.log(problem.message);

// 3. Start the engine. Give code for every `check name = host`.
const engine = createEngine(program, {
  checks: { is_business_hours: () => new Date().getHours() < 17 },
});

// 4. For each message: get the facts (from your classifier or your own rules), then decide.
const decision = engine.decide({
  text: "where is my order?",
  facts: { topic: "orders", action: "track_order" },
  confidence: { topic: 0.95, action: 0.92 },
  lastReply: previousBotMessage, // for `asked`
});
```

## What you get back

```ts
switch (decision.kind) {
  case "model":  /* call your LLM */ break;
  case "reply":  /* send decision.text */ break;
  case "refuse": /* send decision.text, maybe log it */ break;
  case "ask":    /* send decision.text; decision.ask is the list's name */ break;
  case "direct": /* run your handler named decision.name */ break;
}
decision.path;  // e.g. "returns/return/ask-number" (great for logs)
decision.trace; // every rule tested, in order, and whether it fit
```

## Where it runs

`@danlang/core` has no Node, browser or network code. It runs in Next.js route handlers, edge functions, the browser,
and React Native. No server of its own.

In serverless code without a file system, bundle the `.dan` files as strings and use `linkSources`:

```ts
import { linkSources, createEngine } from "@danlang/core";
import main from "./bot/main.dan?raw"; // or read them at build time

const engine = createEngine(linkSources({ "main.dan": main }));
```

Build the engine once (outside the request handler) and reuse it: `decide()` is synchronous and takes microseconds.

## Random messages in tests

Pass `pick` to always choose the same message:

```ts
createEngine(program, { pick: () => 0 }); // always the first message
```
