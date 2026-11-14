---
title: How sure?
summary: Only follow a rule when the classifier is sure enough. Otherwise let the AI handle it.
---

# How sure?

The classifier doesn't just guess the topic. It also says **how sure** it is, as a number from `0` to `1`:

| Number | Means |
|---|---|
| `1` | 100% sure |
| `0.9` | 90% sure |
| `0.5` | 50/50, a coin flip |
| `0` | no idea |

If the classifier is only 50% sure a message is about orders, you probably don't want to answer with an order update. It's safer to
let the big AI read it.

## Writing "sure enough": `>=`

Add `>=` and a number after the field. `>=` means **"at least"**.

```dan
field topic = [orders, other]

flow main
  order: when topic == orders >= 0.8 -> reply "Here's where your order is."
  open: else -> model
```

Read it as: *"when the topic is orders, and the classifier is **at least 80% sure**, reply with the order status."*

Try it: set **topic** to `orders`, then slide the **sure** bar below and above 0.8.

## Give the number a name

You'll often use the same number in many rules. Save it with `let` so you only change it in one place:

```dan
field topic = [orders, returns, other]

let sure = 0.8

flow main
  order: when topic == orders >= sure -> reply "Here's where your order is."
  return: when topic == returns >= sure -> reply "Let's start your return."
  open: else -> model
```

If later you think 0.8 is too strict, change `let sure = 0.7` and every rule follows.

## When to use it

- **Use it** on rules that answer without the AI (`reply`, `direct`, `refuse`). A wrong guess here gives the person a
  wrong answer.
- **You can skip it** on rules that send the message to the AI anyway (`model`), because the AI reads the message
  itself.

> **Good habit:** be extra careful with "refuse" rules. Saying "I can't help" to a real customer is worse than letting
> the AI answer. A good starting point is `0.9` (90% sure) before refusing.

<details>
<summary>Test yourself: the classifier is 0.75 sure. Does <code>when topic == orders >= 0.8</code> fit?</summary>

No. 0.75 is less than 0.8, so the rule is skipped and danlang moves to the next one.

</details>
