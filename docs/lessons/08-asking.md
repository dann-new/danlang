---
title: Asking questions
summary: Ask for missing details, and don't ask the same question twice.
---

# Asking questions

People often leave things out. Someone types *"I want to return something"* but doesn't say which order. Instead of paying the big AI
to figure that out, your bot can simply **ask**.

## `ask`

```dan
field action = [return_item, other]

let order_number_question = [
  "Sure! What's your order number?",
  "Happy to help! Which order is it? The number is in your email.",
]

flow main
  return: when action == return_item -> ask order_number_question
  open: else -> model
```

`ask` works like `reply` (it picks one message at random), but it also **remembers** that a question was asked. That
matters for the next part.

## Don't ask twice: `asked`

The person answers: *"The blue shoes"*. The classifier still thinks this is about a return. Without care, the bot would ask
*"What's your order number?"* **again**, and again, forever. Annoying!

The test `asked` fixes this. It is true when **the bot's last message was that question**:

```dan
field action = [return_item, other]

let order_number_question = [
  "Sure! What's your order number?",
  "Happy to help! Which order is it? The number is in your email.",
]

flow main
  return: when action == return_item
    answer: when asked order_number_question -> model
    ask-number: else -> ask order_number_question
  open: else -> model
```

Now:

1. *"I want to return something"* → not asked yet → the bot **asks** for the order number.
2. *"It's order 48213"* → we **just asked** → the AI reads the answer and does the rest.

Try it: run it once, then paste the bot's question into **Bot's last message** and run again.

## The usual pattern

Most "do something" rules end up looking like this:

```text
  return: when action == return_item >= sure
    has-number: when has order_number -> model     # all details given: let the AI handle it
    answer: when asked order_number_question -> model  # they're answering our question
    ask-number: else -> ask order_number_question  # details missing: ask (free!)
```

`has order_number` checks if the message already has an order number in it. You'll learn it in the next lesson, **Checks**.

<details>
<summary>Test yourself: why does <code>answer:</code> come before <code>ask-number:</code>?</summary>

Because danlang uses the first rule that fits. `ask-number` uses `else`, which always fits, so anything below it
would never run. The more specific rule must come first.

</details>
