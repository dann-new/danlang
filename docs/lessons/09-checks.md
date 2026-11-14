---
title: Checks
summary: Look inside the message itself, for example for an order number.
---

# Checks

Fields come from the classifier. But sometimes you want to look at the **words in the message yourself**. For example: *does the
message have an order number in it?*

That's what a **check** is for.

## Writing a check

```text
check order_number = /\d+/
```

This creates a check called `order_number`. The part between the slashes `/.../` is a **pattern** (programmers call it a
"regex"). It describes what to look for. `\d+` means "one or more digits", so any number.

Then use it in a rule with `has`:

```dan
field action = [return_item, other]

check order_number = /\d+/

flow main
  return: when action == return_item
    has-number: when has order_number -> reply "Got it, starting your return!"
    ask-number: else -> ask "What's your order number?"
  open: else -> model
```

Try it: type *"return order 48213"* and then *"return my shoes"*.

## Patterns you can copy

You don't need to learn patterns deeply. Here are useful ones you can copy:

| You want to find... | Pattern | Matches |
|---|---|---|
| any number | `/\d+/` | "500", "1500" |
| a price with decimals | `/\d[\d,]*\.\d\d/` | "19.99", "1,250.00" |
| a word (any case) | `/\bhello\b/i` | "Hello", "HELLO" |
| one of several words | `/\b(today\|tomorrow\|bukas)\b/i` | "today", "Bukas" |
| a time | `/\d{1,2}(:\d{2})?\s?(am\|pm)/i` | "2pm", "10:30 AM" |

- `i` at the end means **ignore upper/lower case**.
- `\b` means **the edge of a word**, so `hello` doesn't match inside "othello".
- `|` means **or**.

> **Tip:** Ask an AI assistant: *"Write a regex that matches email addresses"*. Paste the answer between
> the slashes. Then test it here.

## Checks your app does: `host`

Some checks need information danlang doesn't have, like **today's date** or the **user's account**. Mark those as
`host`. It means "my app will do this check in its own code":

```text
check is_business_hours = host
```

Your app's developer writes this check in the app. In the **Try it** page, a checkbox lets you pretend it passed or
not.

## One rule for check lines

Don't put a `# comment` at the end of a `check` line, because `#` could be part of the pattern. Put the comment on
the line above instead:

```text
# Any order number.
check order_number = /\d+/
```

<details>
<summary>Test yourself: write a check called <code>greeting</code> that finds the word "hi" or "hello" in any case.</summary>

```text
check greeting = /\b(hi|hello)\b/i
```

</details>
