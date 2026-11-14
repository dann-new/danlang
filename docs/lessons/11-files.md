---
title: Many files
summary: Split a big bot into small files with use.
---

# Many files

A real bot can have hundreds of rules. One giant file is hard to read. Split it into **small files**, one per topic,
and connect them with `use`.

## `use`

```text
# main.dan
use "./money.dan"
use "./schedule.dan"

field topic = [money, schedule, other]

flow main
  money: when topic == money -> money_rules
  schedule: when topic == schedule -> schedule_rules
  open: else -> model
```

```text
# money.dan
flow money_rules
  open: else -> reply "Let's talk money."
```

```text
# schedule.dan
flow schedule_rules
  open: else -> reply "Let's check your calendar."
```

`use "./money.dan"` means *"also read the file money.dan, in the same folder"*. Everything inside it (flows,
messages, checks) can then be used in this file.

## Writing the file path

| You write | It means |
|---|---|
| `"./money.dan"` | `money.dan` in the **same folder** |
| `"./topics/money.dan"` | `money.dan` in the folder `topics` |
| `"../shared/greetings.dan"` | go **up one folder**, then into `shared` |

## Good ways to split

- **One file per topic:** `money.dan`, `schedule.dan`, `support.dan`.
- **A shared file** for messages and fields used everywhere: `shared.dan`.
- Keep `main.dan` short: just the fields and the first decision.

## Names must be unique

Every flow, `let` and `check` name must be different across **all** files. If two files both have `let sure`,
danlang tells you where both are, so you can rename one.

<details>
<summary>Test yourself: <code>main.dan</code> is in <code>bot/</code>. How does it use <code>bot/topics/tax.dan</code>?</summary>

```text
use "./topics/tax.dan"
```

</details>
