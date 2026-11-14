---
title: A real example
summary: Read JuanStack's real chatbot, step by step.
---

# A real example: Juan

**Juan** is the AI assistant inside JuanStack, an app for Filipino businesses. Here's a shortened version of
Juan's real danlang file. You now know every word in it.

```dan
# What Jev can tell us about a message.
field source = [rules, jev, fallback]
field intent = [bir_forms, schedule_task, business_qa, out_of_scope]
field action = [tax_due, log_expense, schedule_read, other]

# How sure Jev must be.
let sure = 0.8
let very_sure = 0.9

check amount = /(₱|php)\s?\d|\d[\d,]*\s?(pesos?|php)?/i

let off_topic_messages = [
  "I can only help with your business: your schedule, Books, money and BIR forms.",
  "Sorry, that's outside what I do! Ask me about taxes, invoices or your schedule.",
]

let expense_question = [
  "Sure! How much was it, and who did you pay?",
  "Got it! How much did you spend, and on what?",
]

flow main
  jev-down: when source == fallback -> model
  off-topic: when intent == out_of_scope >= very_sure and action == other -> refuse off_topic_messages
  money: when intent == [bir_forms, business_qa] -> bills
  open: else -> model

flow bills
  tax-due: when action == tax_due >= sure -> direct tax_due
  expense: when action == log_expense >= sure
    has-amount: when has amount -> model
    answer: when asked expense_question -> model
    ask-amount: else -> ask expense_question
  open: else -> model
```

## Reading it line by line

**The fields.** Jev tells Juan three things: where the answer came from (`source`), the general topic (`intent`) and
the exact request (`action`).

**`jev-down`.** If Jev is broken or too slow, `source` is `fallback`. Juan plays it safe and lets the AI answer
everything. This rule is first on purpose.

**`off-topic`.** If Jev is **very** sure (90%) the message has nothing to do with business, Juan politely refuses,
for free. Not sure enough? It falls through to the AI, because refusing a real customer by mistake is bad.

**`money`.** Anything about BIR forms or business questions jumps to the `bills` flow.

**`tax-due`.** *"How much tax do I owe?"* → the app's tax calculator answers (`direct`). No AI, so it's free and
always correct.

**`expense`.** *"Log an expense"*:
- has an amount? → the AI prepares the expense card
- answering our question? → the AI reads the answer
- otherwise → ask *"How much was it?"*, free

**`open`.** Everything else → the AI.

## The money it saves

Out of every 10 messages, many are greetings, tax questions, schedule checks, or missing-detail questions. Each of
those is answered without the big AI. Only the hard ones cost money.

## Try these in the Try it page

| Message | intent | action | Result |
|---|---|---|---|
| "magkano tax ko?" | bir_forms | tax_due | direct tax_due |
| "log expense for ink" | business_qa | log_expense | ask (free) |
| "log ₱500 for ink" | business_qa | log_expense | model |
| "capital of France?" | out_of_scope (0.95) | other | refuse (free) |

The full version, with schedules and invoices, is in the danlang repo under `examples/juanstack`.
