---
title: Your first flow
summary: Rules are read from top to bottom. The first one that fits wins.
---

# Your first flow

A **flow** is a list of rules. Every danlang file needs one flow called `main`. That's where every message starts.

```dan
flow main
  open: else -> reply "Hello from danlang!"
```

Try it: whatever you type, the bot answers *"Hello from danlang!"*.

## The parts of a rule

Each rule is one line, pushed in by **two spaces** under the flow:

```text
  open:   else   ->   reply "Hello from danlang!"
  ────    ────   ──   ─────────────────────────────
  name    when?  then what to do
```

| Part | What it means |
|---|---|
| `open:` | The rule's **name**. You choose it. It helps you find the rule later. End it with a colon `:`. |
| `else` | **When** to use this rule. `else` means "always" or "in every other case". |
| `->` | Read it as **"then"**. |
| `reply "..."` | **What to do**: send this message back. |

## Top to bottom, first one wins

When a message comes in, danlang reads your rules **from the top down** and uses the **first rule that fits**. It
stops there and ignores the rest.

```dan
field topic = [greeting, thanks, other]

flow main
  say-hi: when topic == greeting -> reply "Hi!"
  say-welcome: when topic == thanks -> reply "You're welcome!"
  open: else -> model
```

- A greeting → the first rule fits → *"Hi!"*.
- A thank-you → the first rule doesn't fit, the second one does → *"You're welcome!"*.
- Anything else → only `else` fits → the big AI answers.

Try it and change the **topic** dropdown to see each rule win.

## Always end with `else`

Put an `else` rule **last**. It catches every message the rules above did not. If you forget it, danlang still works
(it sends the message to the AI), but it will remind you to add one.

> **Why last?** Because `else` always fits. Any rule written under it can never be reached, like a door behind a
> wall. danlang will tell you if that happens.

## Indentation (the spaces at the start)

The spaces at the start of a line matter. They show which rules belong to which flow.

- The `flow` line starts at the very left.
- Its rules start with **2 spaces**.
- Use spaces, not the Tab key. (The danlang editor extension does this for you.)

## Comments

Anything after a `#` is a note for humans. danlang ignores it.

```dan
# This bot only says hello.
flow main
  open: else -> reply "Hello!"   # the only rule
```

<details>
<summary>Test yourself: a message matches rule 2 and rule 4. Which one is used?</summary>

Rule 2. danlang uses the first rule that fits, reading from the top.

</details>
