# danlang (for AI coding agents)

This package runs danlang `.dan` chat-routing files. The complete syntax, patterns, safety rules and API are in
[SKILL.md](./SKILL.md) next to this file. Read it before writing or editing any `.dan` file.

Quick reminders:
- `=` declares (`let`, `field`, `confidence`, `check`); `==` compares in rules (`when intent == orders`, optionally `>= 90%`).
- `confidence = 80%` sets the minimum for every `==` test (80% if omitted); a rule's own `>=` overrides it.
- First matching rule wins, top to bottom; end every level with `name: else -> ...`.
- After `ask` the chat waits at that node (pass `decision.state` back as `turn.state`); `uproot(n|all)` leaves it.
- Only `model` calls the LLM. `reply` / `refuse` / `ask` / `direct` are free.
- After editing, run `check(link(...))` from `@danlang/core` and fix every error it reports.
