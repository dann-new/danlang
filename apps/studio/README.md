# danlang Studio

A local tool to **see** a `.dan` tree as nodes and **test** how messages are routed. Never published.

```bash
pnpm studio        # from the repo root → http://localhost:3200
```

## What it does

- Draws every folder under `examples/` that has a `main.dan` (pick one at the top). The files are re-read every
  2 seconds, so edits show up live.
- **Hover** a node to see its rule, with the file and line.
- **Type a test message**: the Studio asks the real classifier, runs your tree, and lights up the path it took.
  Rules that were tested and didn't fit get a dashed outline. Each answer shows the classifier's guesses (with how
  sure it was), the rule path, the time and the cost.
- Fields **with descriptions** are asked to the classifier. Fields **without** (like `source`) get a dropdown, so
  you play the app. `check name = host` checks get a checkbox.
- Optional: also ask the big AI when a rule says `model` (costs money, off by default).

## Keys (`.env.local`)

The Studio reads the repo's root `.env.local` (linked as `apps/studio/.env.local`). It's gitignored. Names are
listed in `.env.example`.

| Name | Needed? | What for | Where to get it |
|---|---|---|---|
| `JEV_API_KEY` | Yes, to test messages | The classifier (Jev, through OpenRouter's Decisions API) | openrouter.ai → **Keys** → **Create Key** |
| `OPENROUTER_API_KEY` | Only for "Also ask the big AI" | The big AI answer (through OpenRouter) | openrouter.ai → **Keys** → **Create Key** |

Without `JEV_API_KEY`, the header shows "classifier ✗" and every message takes the classifier-failed path (`source =
fallback`), which is still useful for testing that path.

✅ Done when: the header shows `classifier ✓`, and sending "hi" lights up a path.

## Private examples

`examples/juanstack/` is gitignored: put private trees there (or any gitignored folder under `examples/`) to test
them without committing.
