---
title: Actions
summary: Everything a rule can do after the arrow.
---

# Actions

The part after `->` is the **action**: what the bot does when the rule fits. There are six.

| Action | What happens | Uses the big AI? |
|---|---|---|
| `model` | The big AI reads the message and answers. | **Yes** (costs money) |
| `reply messages` | Send one of your messages. | No (free) |
| `refuse messages` | Politely say "I can't help with that". | No (free) |
| `ask messages` | Ask for a missing detail (see **Asking questions**). | No (free) |
| `direct name` | Your app answers with its own code, like an order tracker. | No (free) |
| `flow-name` | Continue inside another flow. | Depends |

## `model`

```text
open: else -> model
```

Use it for anything the bot can't answer with a fixed message: open questions, messages that need thinking, or when
the classifier isn't sure.

## `reply` and `refuse`

They work the same way. The difference is the **meaning**: `refuse` tells your app "this was turned down", so it can
count those or show them differently.

```dan
field topic = [greeting, off_topic, other]

let hellos = ["Hi!", "Hello there!"]
let sorry = ["Sorry, I only help with shopping questions."]

flow main
  hi: when topic == greeting -> reply hellos
  no: when topic == off_topic -> refuse sorry
  open: else -> model
```

## `direct`

Some answers need real data: *"Where is my order?"*. A fixed message can't know that, but your app can work it
out with its own code, for free.

```text
order: when topic == orders >= sure -> direct order_status
```

danlang tells your app "do `order_status`", and the app's code does the work. The name is up to you and your developer.

## Jumping to another flow

When a group of rules gets big, give it its own flow and jump to it by writing its name:

```dan
field topic = [food, other]
field meal = [breakfast, lunch]

flow main
  food: when topic == food -> food_rules
  open: else -> model

flow food_rules
  morning: when meal == breakfast -> reply "Coffee and toast!"
  open: else -> reply "Let's find something tasty."
```

This does exactly the same as putting the rules under `food:`, but each flow stays short and easy to read. The path
is still `food/morning`.

> A flow can't jump back to itself, directly or through other flows, because it would go round in circles forever.
> danlang will stop you if you try.

<details>
<summary>Test yourself: which actions never use the big AI?</summary>

`reply`, `refuse`, `ask` and `direct`. Only `model` calls the big AI. A jump to another flow depends on the rules in
that flow.

</details>
