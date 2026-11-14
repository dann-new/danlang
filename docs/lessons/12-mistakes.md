---
title: Fixing mistakes
summary: danlang tells you what's wrong, where, and how to fix it.
---

# Fixing mistakes

Everyone makes mistakes. danlang checks your file **before** it runs and tells you:

- **where** the problem is (file, line number, column)
- **what** is wrong
- **how** to fix it, in plain words

An **error** must be fixed; the bot won't run until it is. A **warning** is a friendly heads-up; the bot still runs.

Try this broken example. The **Problems** box in the Try it page lists every mistake:

```dan-broken
field mood = [happy, angry]

flow main
  calm: when mod = angry -> reply "Sorry!"
  open: else -> reply hellos
```

## The most common mistakes

| You see | What it means | Fix |
|---|---|---|
| `Unknown field "mod"` | A typo in a field name, or you forgot `field`. | Fix the spelling, or add `field mod = [...]`. |
| `"angy" is not a value of field mood` | A typo in an answer. | Use one of the allowed answers it lists. |
| `Unknown message list "hellos"` | You used a name that has no `let`. | Add `let hellos = ["Hi!"]`. |
| `can never be reached` | A rule is below an `else`. | Move the `else` rule to the bottom. |
| `does nothing` | A rule has no `->` and nothing under it. | Add `-> model` (or another action), or rules under it. |
| `Use "=" here` | You wrote `is` or `in`. | Write `mood = angry`. |
| `Indentation does not line up` | The spaces at the start are uneven. | Make rules at the same level start at the same column. |
| `Use spaces, not tabs` | A Tab key was used. | Replace it with spaces. |
| `has no closing quote` | A message is missing its ending `"`. | Add the `"` at the end. |
| `loop forever` | Flow A jumps to B and B jumps back to A. | Remove one of the jumps. |
| `A confidence must be between 0 and 1` | You wrote `>= 80` instead of `>= 0.8`. | Use 0.8 for 80%. |

## Warnings you may see

| You see | Means |
|---|---|
| `has no else at the end` | Messages that fit no rule go to the AI. Add `open: else -> model` to make that clear. |
| `flow ... is never used` | Nothing jumps to this flow. Delete it or jump to it. |
| `check ... is never used` | No rule uses this check with `has`. |

<details>
<summary>Test yourself: fix the broken example above.</summary>

```text
field mood = [happy, angry]

let hellos = ["Hi!", "Hello!"]

flow main
  calm: when mood = angry -> reply "Sorry!"
  open: else -> reply hellos
```

</details>
