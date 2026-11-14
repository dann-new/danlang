---
title: Fields
summary: Fields are the facts the classifier tells you about a message, like its topic.
---

# Fields

Before danlang runs, a small helper AI (the **classifier**) reads the message and tells you some facts about it. For example:

> "This message is about **orders**, and the person wants to **know where theirs is**."

Each fact is called a **field**. You tell danlang which fields exist and what answers they can have.

## Declaring a field

```text
field topic = [orders, returns, other]
```

This says: *there's a fact called `topic`, and its answer is always one of `orders`, `returns` or `other`.*

You can have as many fields as you need:

```text
field topic = [orders, returns, other]
field mood = [happy, angry, neutral]
```

## Using a field in a rule: `when`

To use a rule only for certain messages, write `when`, then the field, `==`, and the answer:

```dan
field mood = [happy, angry, neutral]

flow main
  calm-down: when mood == angry -> reply "I'm really sorry about that. Let me help."
  open: else -> model
```

Read it as: *"when the mood is angry, then reply 'I'm really sorry...'"*.

Try it and switch **mood** to `angry`.

## `=` and `==` are different

This trips up almost everyone at first, so here's the simple rule:

| Sign | Read it as | Used for | Example |
|---|---|---|---|
| `=` | "**is set to**" | giving something a name: `let`, `field`, `check` | `let sure = 0.8` |
| `==` | "**is equal to?**" (a question) | testing a message in a rule | `when mood == angry` |

One `=` **gives** a value. Two `==` **ask** about a value. If you mix them up, danlang tells you:
*Use "==" to compare.*

## One of several answers

To match **any of several** answers, put them in a list:

```dan
field topic = [orders, returns, shipping, weather]

flow main
  shopping: when topic == [orders, returns] -> reply "Let's sort out your purchase!"
  open: else -> model
```

`topic == [orders, returns]` means *"the topic is orders **or** returns"*.

## Why declare fields at all?

Because it **catches typos**. If you write `when mood == angy`, danlang tells you right away:

```text
"angy" is not a value of field mood. Allowed: happy, angry, neutral.
```

Without this, the rule would silently never work, and you'd spend an hour wondering why.

## Where do the answers come from?

From your classifier. You decide which fields exist, as long as your classifier (a small AI model, simple keyword
rules, or anything else) can answer them. A common setup is two fields: `topic` (what it's about) and `action` (what
the person wants done).

In the **Try it** page, you play the part of the classifier: you pick the answers from the dropdowns.

<details>
<summary>Test yourself: write a rule that replies "Hello!" when <code>topic</code> is <code>greeting</code>.</summary>

```text
say-hi: when topic == greeting -> reply "Hello!"
```

</details>
