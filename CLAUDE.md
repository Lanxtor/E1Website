# Working on the E1 website

## The user guides, the app and the E1 Trainer are kept current together

The user guides (`tools/guides/`, rules in `docs/USER-GUIDES.md`) describe every feature of E1 (`Lanxtor/E1`). The app's **E1 Trainer** (Alex's trainer mode, `src/ui/trainer/lessons.mjs` in `Lanxtor/E1`) shows bubbles on the app's controls and links each one to a guide feature **by its id**.

- Every change to E1 that a user can see updates its guide feature here, and its trainer lesson in `Lanxtor/E1`.
- Never rename or remove a feature id, and keep its `anchor` stable. If one must change, update the trainer's lessons in the same week.
- After changing the guides: `python3 tools/guides/build.py --check`, then in `Lanxtor/E1` run `node scripts/sync-guide-links.mjs` and its check (`npx vitest run tests/client/trainerKnowledge.test.mjs`).
- A new guide feature for something on screen gets a trainer step too.
