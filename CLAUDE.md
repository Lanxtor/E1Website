# Working on the E1 website

## Pre-launch: no history before day zero (owner's standing rule)

E1 (app), the E1 website, E1 Reviewer for iPad and E1 Mobile for iPhone and Android (`Lanxtor/E1`, `Lanxtor/E1Website`, `Lanxtor/E1iPad`, `Lanxtor/E1Phone`) go live together on **Wednesday 19 May 2027**. Until then everything is under construction and the website is a preview.

- **Day zero is 19 May 2027.** From a user's point of view, nothing existed before it and nothing has a history.
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

## Published apps are updated everywhere at once (owner's rule)

When an app is published (desktop installer, E1 Reviewer for iPad, E1 Mobile), every place on the website that offers it changes in the same change: the buttons at the top of Get E1 (`download.html`), the cards under Downloads on the account page (`account.html`), the release manifest (`assets/data/releases.json` here and E1's seed `deploy/downloads/releases.json`) and the user guide. Details: `docs/AZURE-INTEGRATION.md` ("Downloads").

## Checks

- Run `npm run test:e2e` (the screen tests, `docs/TESTS.md`) before pushing a change to a page; never push with them failing, skipped or weakened. `python3 tools/guides/build.py --check` must pass too.

## When the work is done, push it to main (owner's standing rule)

Every chat, whatever its topic (a bug fix, a requirement, a new feature or a page or screen), finishes the same way. **No pull request is needed, and there is no need to ask what to do next:** when the work is done, push it straight to `main`, whatever branch the session was told to develop on. This rule is the owner's explicit permission.

Before pushing to `main`, all of these must hold:

1. **The browser screen test for the chat's topic exists and passes** (Playwright, `tests/e2e/<page or feature>.spec.mjs`, see `docs/TESTS.md`), doing what a person does on the screen and checking the result there. For a bug it is written first, reproduces the bug as reported, fails without the fix and passes with it, so that bug can never come back unseen. No bug fix, requirement or feature reaches `main` without it.
2. `npm run test:e2e` passes as a whole, and `python3 tools/guides/build.py --check` passes (see "Checks" above).
3. Everything works and there are no open questions for the owner. If there is a decision only the owner can make, ask first and do not push.

Then: commit on the session branch, `git fetch origin main`, merge or rebase onto it, run the tests again, and `git push origin HEAD:main` (also push the session branch). If the push is rejected because main moved, fetch and merge again; never force-push main. In the final summary, say what was pushed to `main` and which tests were added and pass.
