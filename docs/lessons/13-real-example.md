---
title: A complete example
summary: Read a whole chatbot for an online shop, step by step.
---

# A complete example: a shop assistant

Let's read a whole chatbot from top to bottom. It helps customers of a small **online shop**. It's made up for this
lesson, but it uses every idea you've learned, and you now know every word in it.

```dan
# What the classifier tells us about each message.
field source = [classifier, fallback]
field topic = [greeting, orders, returns, off_topic, other]
field action = [track_order, return_item, other]

# The classifier must be at least this sure, unless a rule says otherwise.
confidence = 80%

# An order number has at least 4 digits.
check order_number = /\d{4,}/

let hello_messages = [
  "Hi! How can I help with your order today?",
  "Hello! Ask me about an order or a return.",
]

let off_topic_messages = [
  "Sorry, I can only help with orders and returns.",
  "That's outside what I do! Ask me about an order or a return.",
]

let order_number_question = [
  "Sure! What's your order number? It's in your confirmation email.",
  "Happy to help! Which order is it? The number starts with #.",
]

flow main
  classifier-down: when source == fallback -> model
  hello: when topic == greeting -> reply hello_messages
  off-topic: when topic == off_topic >= 90% -> refuse off_topic_messages
  shop: when topic == [orders, returns] -> shop
  open: else -> model

flow shop
  track: when action == track_order
    has-number: when has order_number -> direct track_order
    answer: when asked order_number_question -> model
    ask-number: else -> ask order_number_question
  return: when action == return_item
    has-number: when has order_number -> model
    answer: when asked order_number_question -> model
    ask-number: else -> ask order_number_question
  open: else -> model
```

## Reading it line by line

**The fields.** The classifier tells the bot three things: whether the classifier worked (`source`), what the
message is about (`topic`), and what the customer wants done (`action`).

**`classifier-down`.** If the classifier is broken or too slow, your app sets `source` to `fallback`. The bot plays
it safe and lets the big AI answer everything. This rule is first on purpose.

**`hello`.** A greeting gets a friendly reply, picked at random from two. Free.

**`off-topic`.** If the classifier is **very** sure (90%) the message has nothing to do with the shop, the bot
politely says no, for free. Not sure enough? It falls through to the AI, because turning away a real customer by
mistake is bad.

**`shop`.** Anything about orders or returns jumps to the `shop` flow.

**`track`.** *"Where is my order?"*
- has an order number? → the shop's own system looks it up (`direct track_order`). No AI, so it's free and always
  correct.
- answering our question? → the AI reads the answer
- otherwise → ask for the order number, free

**`return`.** *"I want to return something"*: the same pattern. With an order number, the AI helps with the return.
Without one, the bot asks first.

**`open`.** Everything else → the big AI.

## The money it saves

Greetings, off-topic messages, order lookups and "what's your order number?" questions are all answered without
the big AI. Only the messages that really need thinking cost money.

## Try these in the Try it page

Press **Try it Yourself** under the example, then:

| Message | topic | action | Result |
|---|---|---|---|
| "hi!" | greeting | other | reply (free) |
| "where is my order?" | orders | track_order | ask for the number (free) |
| "where is order 48213?" | orders | track_order | direct track_order (free) |
| "I want to return order 48213" | returns | return_item | model |
| "what's the weather?" | off_topic (95% sure) | other | refuse (free) |

<details>
<summary>Test yourself: the classifier is only 70% sure a message is a greeting. What happens?</summary>

`hello` needs at least 80% (the `confidence` at the top), so it's skipped. `off-topic` and `shop` don't fit either, so `open: else` sends it to the
big AI.

</details>
