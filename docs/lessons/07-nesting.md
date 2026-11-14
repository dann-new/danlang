---
title: Rules inside rules
summary: Put rules under a rule to make a tree of decisions.
---

# Rules inside rules

Real conversations have steps. First you find out **what** the person wants, then you look at the **details**.

In danlang you can put rules **under** another rule. Push them in **two more spaces**:

```dan
field topic = [food, other]
field meal = [breakfast, lunch, dinner]

flow main
  food: when topic == food
    morning: when meal == breakfast -> reply "Coffee and pandesal!"
    noon: when meal == lunch -> reply "Adobo sounds good."
    open: else -> reply "Let's find something tasty."
  open: else -> model
```

## How it works

1. danlang checks `food:`. Is the topic food?
2. If **yes**, it goes **inside** and checks the rules under it, top to bottom, same as before.
3. If **no**, it skips everything inside and moves to the next rule at the same level (`open:`).

Notice that `food:` has **no** `->`. A rule either does something (`->`) **or** has rules under it. Never both.

## Drawing it as a tree

The file above is really a tree:

```text
main
├─ food ─────────── topic == food?
│  ├─ morning ───── breakfast → "Coffee and pandesal!"
│  ├─ noon ──────── lunch → "Adobo sounds good."
│  └─ open ──────── anything else → "Let's find something tasty."
└─ open ─────────── anything else → AI
```

The **path** to a rule is its names joined with `/`. For example `food/noon`. danlang shows you the path it took, so
you always know why the bot answered the way it did.

## Rules inside need their own `else`

Each group of rules should end with its own `else`. Otherwise, if nothing inside fits, danlang sends the message to
the AI and reminds you to add one.

## How deep can it go?

As deep as you like. But if it goes more than three levels, it's usually easier to read if you move the inner part
into its own flow. You'll learn that in **Actions** (jumping to another flow) and **Many files**.

<details>
<summary>Test yourself: topic is <code>food</code> and meal is <code>dinner</code>. What's the reply?</summary>

*"Let's find something tasty."* It goes into `food`, `morning` and `noon` don't fit, so the inner `open: else` wins.
The path is `food/open`.

</details>
