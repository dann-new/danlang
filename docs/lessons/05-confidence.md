---
title: How sure?
summary: Set how sure the classifier must be, once for everything, and change it for single rules.
---

# How sure?

The classifier doesn't just guess the topic. It also says **how sure** it is:

| It says | Means |
|---|---|
| `100%` (or `1`) | completely sure |
| `90%` (or `0.9`) | very sure |
| `50%` (or `0.5`) | a coin flip |
| `0%` (or `0`) | no idea |

If the classifier is only 50% sure a message is about orders, you don't want to answer with an order update. It's
safer to let the big AI read it.

danlang lets you write these numbers as percentages (`95%`) or as decimals (`0.95`). They mean the same thing.

## One setting for everything: `confidence`

Write `confidence` once, at the top of your file. Every `==` test then needs the classifier to be at least that sure:

```dan
confidence = 80%

field topic = [greeting, orders, other]

flow main
  hi: when topic == greeting -> reply "Hi!"
  order: when topic == orders -> reply "Here's where your order is."
  open: else -> model
```

Read it as: *"only follow a rule when the classifier is at least 80% sure."*

Try it: set **topic** to `orders`, then slide the **sure** bar below and above 80%.

## If you don't set it

You don't have to write `confidence`. If it's missing, danlang uses **80%**. That's a safe starting point for most
bots.

## Different for one rule: `>=`

Sometimes one rule needs to be stricter, or more relaxed, than the rest. Add `>=` and a number to that rule. `>=`
means **"at least"**:

```dan
confidence = 80%

field topic = [greeting, off_topic, other]

flow main
  hi: when topic == greeting >= 60% -> reply "Hi!"
  no: when topic == off_topic >= 95% -> refuse "Sorry, I only help with your orders."
  open: else -> model
```

- `hi` is relaxed (60%). A wrong "Hi!" does no harm.
- `no` is strict (95%). Turning away a real customer by mistake is bad.
- Every other `==` test uses the 80% from the top.

So the rule is simple: **the rule's own `>=` wins. If it has none, `confidence` is used. If that's missing too, 80%.**

## Give a number a name

You can also save a number with `let` and use the name after `>=`:

```dan
let strict = 95%

field topic = [off_topic, other]

flow main
  no: when topic == off_topic >= strict -> refuse "Sorry, I only help with your orders."
  open: else -> model
```

## Facts your app sets

Some fields aren't guessed by the classifier at all. Your app knows them for sure (for example, *"is the
classifier working?"*). A fact that comes without a "how sure" number counts as **100% sure**, so `confidence` never
blocks it.

> **Good habit:** use a high number (90% or more) on `refuse` rules, and a normal one everywhere else. When in doubt,
> letting the big AI answer is safer than a wrong fixed answer.

<details>
<summary>Test yourself: <code>confidence = 80%</code>, and a rule says <code>>= 70%</code>. The classifier is 75% sure. Does the rule fit?</summary>

Yes. The rule's own `>= 70%` wins over the 80% at the top, and 75% is at least 70%.

</details>
