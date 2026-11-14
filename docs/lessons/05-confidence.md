---
title: How sure?
summary: Only follow a rule when Jev is sure enough. Otherwise let the AI handle it.
---

# How sure?

Jev doesn't just guess the topic. It also says **how sure** it is, as a number from `0` to `1`:

| Number | Means |
|---|---|
| `1` | 100% sure |
| `0.9` | 90% sure |
| `0.5` | 50/50, a coin flip |
| `0` | no idea |

If Jev is only 50% sure a message is about taxes, you probably don't want to answer with a tax report. It's safer to
let the big AI read it.

## Writing "sure enough": `>=`

Add `>=` and a number after the field. `>=` means **"at least"**.

```dan
field topic = [taxes, other]

flow main
  tax: when topic = taxes >= 0.8 -> reply "Here is your tax summary."
  open: else -> model
```

Read it as: *"when the topic is taxes, and Jev is **at least 80% sure**, reply with the tax summary."*

Try it: set **topic** to `taxes`, then slide the **sure** bar below and above 0.8.

## Give the number a name

You'll often use the same number in many rules. Save it with `let` so you only change it in one place:

```dan
field topic = [taxes, invoices, other]

let sure = 0.8

flow main
  tax: when topic = taxes >= sure -> reply "Here is your tax summary."
  invoice: when topic = invoices >= sure -> reply "Let's make an invoice."
  open: else -> model
```

If later you think 0.8 is too strict, change `let sure = 0.7` and every rule follows.

## When to use it

- **Use it** on rules that answer without the AI (`reply`, `direct`, `refuse`). A wrong guess here gives the person a
  wrong answer.
- **You can skip it** on rules that send the message to the AI anyway (`model`), because the AI reads the message
  itself.

> **Good habit:** be extra careful with "refuse" rules. Saying "I can't help" to a real customer is worse than letting
> the AI answer. JuanStack uses `0.9` (90% sure) before refusing.

<details>
<summary>Test yourself: Jev is 0.75 sure. Does <code>when topic = taxes >= 0.8</code> fit?</summary>

No. 0.75 is less than 0.8, so the rule is skipped and danlang moves to the next one.

</details>
