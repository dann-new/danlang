---
title: What is danlang?
summary: A simple language for telling a chatbot what to do with each message.
---

# What is danlang?

danlang is a **simple language for telling a chatbot what to do** with each message it gets.

You write the rules in a plain text file that ends in `.dan`. The chatbot reads your file and follows it, like a
new employee following a checklist.

## A picture to keep in mind

Think of a **receptionist** at a busy office. People walk in with all kinds of questions. The receptionist has a
sheet of paper on the desk:

- If someone asks *"Where is my order?"* → look up the order and say where it is.
- If someone wants to *book a meeting* but did not say when → ask *"What day and time?"*
- If someone asks *"What's the capital of France?"* → politely say *"Sorry, I only help with your orders."*
- **Anything else** → call the expert (the expensive one).

That sheet of paper is your `.dan` file. The **expert** is a big AI like Gemini or ChatGPT. The receptionist only
calls the expert when the sheet says so.

## Why would I want this?

**1. It saves money.** Big AIs charge for every message. Many questions are simple and always get the same kind
of answer. danlang answers those for free and only sends the hard ones to the big AI.

**2. You can read it.** The rules are not hidden inside complicated code. Anyone on the team can open the file and
understand what the chatbot will do.

**3. You can test it.** You can try a message and see exactly which rule was picked, and why.

## What it looks like

Here is a tiny but complete danlang file. Don't worry about understanding every word yet. Just notice how it reads
almost like English.

```dan
field topic = [greeting, weather, other]

let hello_messages = ["Hi there!", "Hello! How can I help?", "Hey! 👋"]

flow main
  say-hi: when topic == greeting -> reply hello_messages
  open: else -> model
```

In plain words, this file says:

- A message can be about a **greeting**, the **weather**, or **something else**.
- If it's a greeting, reply with **one of these three hellos** (picked at random, so it sounds human).
- For **anything else**, let the big AI answer (`model`).

Press **Try it Yourself** under the example to play with it.

## Who decides what a message is "about"?

Before danlang runs, a small, cheap helper AI looks at the message and guesses what it is about. We call this
helper the **classifier**. It says things like *"this message is a greeting, and I'm 95% sure."*

You can use any classifier you like: a small AI model, a service you pay for, or even simple keyword rules.
danlang doesn't care where the guess comes from.

danlang then uses that guess to pick the right rule. You'll learn how in the next lessons.

## What you will learn

| Lesson | You will learn to... |
|---|---|
| Your first flow | write rules that run from top to bottom |
| Messages | give the bot many ways to say the same thing |
| Fields | use what the classifier tells you about a message |
| How sure? | set how sure the classifier must be, for everything or one rule |
| And, or, not | combine rules |
| Rules inside rules | make a tree of decisions |
| Asking questions | ask for missing details, without asking twice |
| Checks | look for words or numbers in the message |
| Waiting and uproot | wait at a step until the details are there, and let people leave |
| Actions | everything a rule can do |
| Many files | split a big bot into smaller files |
| Fixing mistakes | understand danlang's error messages |
| A complete example | read a whole chatbot for an online shop |

<details>
<summary>Test yourself: in the receptionist picture, who is the "expert"?</summary>

The big, expensive AI (like Gemini). danlang only calls it when a rule says `model`.

</details>
