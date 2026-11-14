---
title: Waiting and uproot
summary: Make the bot wait at a step until it has what it needs, and let people leave with uproot.
---

# Waiting and uproot

Real requests often come in pieces. Someone types *"Book a meeting with Ana"* but leaves out the day and the time.
A good assistant doesn't give up, and it doesn't start over either. It **waits** at that step and asks until it has
everything.

## Asking makes the bot wait

When a rule says `ask`, the bot asks its question and then **waits at the rule group that question is in**. The
next message isn't checked from the top. It's checked from that same group.

```dan
field action = [book, other]

check date = /\b(monday|tuesday|wednesday|thursday|friday|tomorrow)\b/i
check time = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i

flow main
  booking: when action == book
    ready: when has date and has time -> reply "Booked! See you then."
    need-date: when has time -> ask "Got the time. What day?"
    need-time: when has date -> ask "Got the day. What time?"
    need-both: else -> ask "Sure! What day and time?"
  open: else -> model
```

Here's a conversation with this bot:

| Person says | What happens | Bot says |
|---|---|---|
| "Book a meeting with Ana" | `booking`, no day, no time → `need-both`. **Waits at `booking`.** | "Sure! What day and time?" |
| "3pm" | Checked from `booking`. Has a time, no day → `need-date`. **Still waiting.** | "Got the time. What day?" |
| "Friday" | Checked from `booking`. Has a day, and **remembers** the 3pm → `ready`. | "Booked! See you then." |

Notice message 2 and 3: on their own, "3pm" and "Friday" don't say anything about booking. The classifier wouldn't
call them `book`. That doesn't matter, because the bot is waiting at `booking`, so it never goes back to the top
to ask.

Try it: press **Try it Yourself**, set **action** to `book`, and send the three messages one after another. The
**Conversation** box shows where the bot is waiting.

## It remembers what it found

While the bot waits at a step, everything its checks found is **remembered**. In the table above, "Friday" fits
`ready` because the time from "3pm" is still remembered.

Once a rule does anything other than `ask` (a reply, the big AI, your app's code...), the task is **finished**. The
bot forgets what it found and goes back to the top for the next message.

## If the answer doesn't help, it asks again

If someone answers *"hmm, not sure"*, nothing new is found, so `need-both` fits again and the bot asks again. It
stays put until it gets what it needs, or until the person leaves.

## Leaving: `uproot`

People change their mind. *"Never mind"*. The bot shouldn't keep asking for a day and time forever. Use `uproot` to
**move up and out** of the step:

```dan
field action = [book, other]

check date = /\b(monday|tuesday|wednesday|thursday|friday|tomorrow)\b/i
check time = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i
check never_mind = /\b(never ?mind|cancel|forget it)\b/i

flow main
  booking: when action == book
    ready: when has date and has time -> reply "Booked! See you then."
    stop: when has never_mind -> uproot(all)
    need-date: when has time -> ask "Got the time. What day?"
    need-time: when has date -> ask "Got the day. What time?"
    need-both: else -> ask "Sure! What day and time?"
  open: else -> model
```

Now *"never mind"* fits `stop`. The bot leaves `booking`, goes back to the top, and **checks the same message
again from there**. Here it lands on `open`, so the big AI answers it like normal chat (*"No problem! Anything
else?"*).

| You write | The bot moves |
|---|---|
| `uproot` | up **1** level (to the group above) |
| `uproot(2)` | up **2** levels |
| `uproot(all)` | all the way back to the **top** |

Put the `stop` rule **above** the `need-...` rules. Remember: the first rule that fits wins, and `need-both` uses
`else`, which always fits.

> `uproot` can't be used in the top rules of `flow main`. There's nothing above them to go up to, and danlang will
> tell you so.

## The pattern to copy

Almost every "do something" task looks like this:

```text
  task: when action == do_something
    ready: when has detail_1 and has detail_2 -> model     # everything is here: go
    stop: when has never_mind -> uproot(all)               # they changed their mind
    need-1: when has detail_2 -> ask "...detail 1?"        # one piece missing
    need-2: when has detail_1 -> ask "...detail 2?"        # the other piece missing
    need-both: else -> ask "...detail 1 and detail 2?"     # nothing yet
```

<details>
<summary>Test yourself: the bot is waiting at <code>booking</code> and the person says "tomorrow at 10am". What happens?</summary>

Both checks find something in that one message, so `ready` fits: *"Booked! See you then."* The task is finished and
the bot goes back to the top.

</details>
