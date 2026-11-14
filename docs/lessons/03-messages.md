---
title: Messages
summary: Save your replies in a list. The bot picks one at random, so it sounds like a person.
---

# Messages

A real person doesn't say the exact same sentence every time. If your bot always says *"Hello! How can I help?"*,
people notice it's a robot.

danlang lets you write **many ways to say the same thing**. Each time, it **picks one at random**.

## Saving messages with `let`

`let` gives a name to something so you can use it later. Here we give the name `hello_messages` to a list of
greetings:

```dan
let hello_messages = ["Hi there!", "Hello! How can I help?", "Hey! What can I do for you?"]

flow main
  open: else -> reply hello_messages
```

Try it and press **Run** a few times. You'll get a different greeting each time.

### The rules for a list

- The list goes between square brackets `[` and `]`.
- Each message goes between double quotes `"..."`.
- Put a comma `,` between messages.

## Long lists over several lines

When messages are long, put each one on its own line. This is much easier to read:

```dan
let sorry_messages = [
  "Sorry, I can only help with your orders.",
  "That's outside what I do, but ask me about orders or returns!",
  "I'm the shop assistant, so I can't help with that one.",
]

flow main
  open: else -> refuse sorry_messages
```

A comma after the last message is fine. danlang doesn't mind.

## Quotes inside a message

If your message itself has double quotes in it, put a backslash `\` before each one:

```dan
let tips = ["Try asking: \"Where is my order?\""]

flow main
  open: else -> reply tips
```

## Just one message

You can also save a single message, or write it straight into the rule:

```dan
let goodbye = "See you soon!"

flow main
  bye: else -> reply goodbye
```

```dan
flow main
  bye: else -> reply "See you soon!"
```

Both do the same thing. Using `let` is nicer when you use the same message in many places, or when the message is
long.

## `let` for numbers

`let` can also hold a number. You'll use this in the lesson **How sure?**:

```text
let sure = 0.8
```

<details>
<summary>Test yourself: what's wrong with <code>let hi = ["Hi!" "Hello!"]</code>?</summary>

The comma is missing between the two messages. It should be `["Hi!", "Hello!"]`.

</details>
