# danlang (for AI coding agents)

This package runs danlang `.dan` chat-routing files. The complete syntax, patterns, safety rules and API are in
[SKILL.md](./SKILL.md) next to this file. Read it before writing or editing any `.dan` file.

Quick reminders:
- `=` declares (`let`, `field`, `check`); `==` compares in rules (`when intent == orders >= 0.8`).
- First matching rule wins, top to bottom; end every level with `name: else -> ...`.
- Only `model` calls the LLM. `reply` / `refuse` / `ask` / `direct` are free.
- After editing, run `check(link(...))` from `@danlang/core` and fix every error it reports.
