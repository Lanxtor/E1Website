# Working on the E1 website

## Pre-launch: no history before day zero (owner's standing rule)

E1 (app), the E1 website and E1 Reviewer for iPad (`Lanxtor/E1`, `Lanxtor/E1Website`, `Lanxtor/E1iPad`) go live together at the **end of February 2027**. Until then everything is under construction and the website is a preview.

- **Day zero is 1 March 2027.** From a user's point of view, nothing existed before it and nothing has a history.
- **Record no history before then:** no release notes, changelogs, "what's new", "new in version …", "previously …", migration notes or deprecation notices, and no version numbers that suggest earlier releases. Rename, move or remove things freely; leave no trace of the old form in anything a user sees.
- **No backward compatibility:** no migrations or compatibility shims for old data, settings, routes or file formats; change them in place.
- Internal working records (roadmap stages with `done`/`doneOn`, git history, design docs) stay as they are: they track the build, not product history.
- At day zero all of this is reset: versions start at their first number and history starts then.

## The user guides, the app and the E1 Guide are kept current together

The user guides (`tools/guides/`, rules in `docs/USER-GUIDES.md`) describe every feature of E1 (`Lanxtor/E1`). The app's **E1 Guide** (Alex's guide mode, `src/ui/trainer/lessons.mjs` in `Lanxtor/E1`) shows bubbles on the app's controls and links each one to a guide feature **by its id**.

- Every change to E1 that a user can see updates its guide feature here, and its E1 Guide lesson in `Lanxtor/E1`.
- Never rename or remove a feature id, and keep its `anchor` stable. If one must change, update the E1 Guide's lessons in the same week.
- After changing the guides: `python3 tools/guides/build.py --check`, then in `Lanxtor/E1` run `node scripts/sync-guide-links.mjs` and its check (`npx vitest run tests/client/trainerKnowledge.test.mjs`).
- A new guide feature for something on screen gets an E1 Guide step too.
