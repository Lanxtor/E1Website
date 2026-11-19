# Working on the E1 website

## Pre-launch: no history before day zero (owner's standing rule)

E1 (app), the E1 website, E1 Reviewer for iPad and E1 Mobile for iPhone and Android (`Lanxtor/E1`, `Lanxtor/E1Website`, `Lanxtor/E1iPad`, `Lanxtor/E1Phone`) go live together on **Wednesday 19 May 2027**. Until then everything is under construction and the website is a preview.

- **Day zero is 19 May 2027.** From a user's point of view, nothing existed before it and nothing has a history.
- **Record no history before then:** no release notes, changelogs, "new in version …", "previously …", migration notes or deprecation notices, and no version numbers that suggest earlier releases. Rename, move or remove things freely; leave no trace of the old form in anything a user sees.
- **Exception, What's new (owner's decision, 19 November 2026):** E1's **Help → What's new** (`src/ui/shell/whatsNew.js` in `Lanxtor/E1`) lists every update with its date and time and one line for each new feature and each bug fix. Every change a user can see, and every bug fix they could meet, in any of the four repositories, adds its line there in the same change (`tests/client/whatsNew.test.mjs` checks it).
- **No backward compatibility:** no migrations or compatibility shims for old data, settings, routes or file formats; change them in place.
- Internal working records (roadmap stages with `done`/`doneOn`, git history, design docs) stay as they are: they track the build, not product history.
- At day zero all of this is reset: versions start at their first number and history starts then.

## The user guides, the app and the E1 Guide are kept current together

The user guides (`tools/guides/`, rules in `docs/USER-GUIDES.md`) describe every feature of E1 (`Lanxtor/E1`). The app's **E1 Guide** (Alex's guide mode, `src/ui/trainer/lessons.mjs` in `Lanxtor/E1`) shows bubbles on the app's controls and links each one to a guide feature **by its id**.

- Every change to E1 that a user can see updates its guide feature here, and its E1 Guide lesson in `Lanxtor/E1`.
- Never rename or remove a feature id, and keep its `anchor` stable. If one must change, update the E1 Guide's lessons in the same week.
- After changing the guides: `python3 tools/guides/build.py --check`, then in `Lanxtor/E1` run `node scripts/sync-guide-links.mjs` and its check (`npx vitest run tests/client/trainerKnowledge.test.mjs`).
- A new guide feature for something on screen gets an E1 Guide step too.

## The E1 Guide, the user guides and the Academy films are always linked (owner's rule)

A person can read about a feature, be shown it in E1, or watch its film, whichever they prefer, from any of the three (owner, 2026-11-19):

- **Guide → film and E1:** every taught feature in the user guide has **Watch the lesson** (the course player at its lesson) and **Show me how in E1** (E1 at its E1 Guide lesson, `https://app.lanxtor.com/?guide=<lesson>`); `tools/guides/build.py` adds them from `assets/js/academy-syllabus.js` and `tools/guides/e1-guide.json`.
- **Film → guide and E1:** every lesson in the course player has **Read more** for each feature it teaches and **Show me how in E1**.
- **E1 → guide and film:** in `Lanxtor/E1`, every **Read more** of the E1 Guide has **Watch the lesson** next to it.

Keep it so: a change to the guides or the syllabus (`tools/academy/syllabus.json`) runs, in this order, `python3 tools/guides/build.py`, `python3 tools/academy/build.py`, then in `Lanxtor/E1` `node scripts/sync-guide-links.mjs` (it writes `tools/guides/e1-guide.json` here), then `python3 tools/guides/build.py --check` and `python3 tools/academy/build.py --check` here. Every available feature is in one Academy lesson or listed under `guideOnly` (the build fails otherwise). Tests: `tests/e2e/triangle.spec.mjs` here, `tests/e2e/web/guideAcademyLinks.spec.mjs` in `Lanxtor/E1`.

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
