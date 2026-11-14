---
title: Asking questions
summary: Ask for missing details, and don't ask the same question twice.
---

# Asking questions

People often leave things out. Someone types *"Log an expense"* but doesn't say how much. Instead of paying the big AI
to figure that out, your bot can simply **ask**.

## `ask`

```dan
field action = [log_expense, other]

let amount_question = [
  "Sure! How much was it, and who did you pay?",
  "Got it! How much did you spend, and on what?",
]

flow main
  expense: when action = log_expense -> ask amount_question
  open: else -> model
```

`ask` works like `reply` (it picks one message at random), but it also **remembers** that a question was asked. That
matters for the next part.

## Don't ask twice: `asked`

The person answers: *"Meralco"*. Jev still thinks this is about logging an expense. Without care, the bot would ask
*"How much was it?"* **again**, and again, forever. Annoying!

The test `asked` fixes this. It is true when **the bot's last message was that question**:

```dan
field action = [log_expense, other]

let amount_question = [
  "Sure! How much was it, and who did you pay?",
  "Got it! How much did you spend, and on what?",
]

flow main
  expense: when action = log_expense
    answer: when asked amount_question -> model
    ask-amount: else -> ask amount_question
  open: else -> model
```

Now:

1. *"Log an expense"* → not asked yet → the bot **asks** how much.
2. *"Meralco, 1500"* → we **just asked** → the AI reads the answer and does the rest.

Try it: run it once, then paste the bot's question into **Bot's last message** and run again.

## The usual pattern

Most "do something" rules end up looking like this:

```text
  expense: when action = log_expense >= sure
    has-amount: when has amount -> model           # all details given: let the AI prepare it
    answer: when asked amount_question -> model    # they're answering our question
    ask-amount: else -> ask amount_question        # details missing: ask (free!)
```

`has amount` checks if the message already has a number in it. You'll learn it in the next lesson, **Checks**.

<details>
<summary>Test yourself: why does <code>answer:</code> come before <code>ask-amount:</code>?</summary>

Because danlang uses the first rule that fits. `ask-amount` uses `else`, which always fits, so anything below it
would never run. The more specific rule must come first.

</details>
