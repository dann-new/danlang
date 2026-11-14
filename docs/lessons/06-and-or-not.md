---
title: And, or, not
summary: Combine tests to make a rule more exact.
---

# And, or, not

Sometimes one test isn't enough. You can join tests with three small words.

| Word | The rule fits when... |
|---|---|
| `and` | **both** tests are true |
| `or` | **at least one** test is true |
| `not` | the test is **false** |

## `and`: both must be true

```dan
field topic = [orders, other]
field mood = [happy, angry]

flow main
  angry-order: when topic == orders and mood == angry -> reply "Sorry about your order. Let's sort it out together."
  open: else -> model
```

Only a message that is about orders **and** angry gets this reply.

## `or`: one is enough

```dan
field topic = [orders, returns, other]
field mood = [happy, angry]

flow main
  careful: when topic == orders or mood == angry -> model
  open: else -> reply "Happy to help!"
```

## `not`: the opposite

```dan
field mood = [happy, angry, neutral]

flow main
  cheerful: when not mood == angry -> reply "Great to hear from you!"
  open: else -> model
```

## Using brackets

When you mix `and` with `or`, use round brackets `( )` to make your meaning clear, just like in math:

```text
when topic == orders and (mood == angry or mood == neutral)
```

Without brackets, `and` is done first. Brackets make it easy for the next person to read, so use them whenever you
mix the two.

<details>
<summary>Test yourself: write a test for "the topic is orders but the mood is not happy".</summary>

```text
when topic == orders and not mood == happy
```

</details>
