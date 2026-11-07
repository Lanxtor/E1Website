# E1 user guides

The user guides are the *User guides* of the Academy on the account page (`account.html#academy-guides`). They describe every feature of E1 from a user's point of view. They are written to be used three ways:

1. **By people learning E1:** where a feature is, what to do, what to expect.
2. **As human workflow test descriptions:** every step has an action and an expected result, with the exact labels on screen, so a tester can follow it and record pass or fail. Each feature names the manual-review checks that test it (`Lanxtor/E1`, `docs/3-implementation/manual-review.md`).
3. **As the outline of the training videos:** the categories are the video series, the features are the episodes, and each feature has a training topic (`assets/data/user-guide-features.json`).

Started 2026-11-07. Keeping them current is a standing job: every change to E1 that a user can see updates its guide in the same week.

## Files

| File | What |
| --- | --- |
| `tools/guides/categories.json` | The 12 categories, their order, summary and icon. Their order is the order of the training series. |
| `tools/guides/features/<category>.json` | The catalog: one entry per feature (schema below). |
| `tools/guides/src/<category>.html` | The guide text: one `<section class="g-feature">` per feature. |
| `tools/guides/roadmap.json` | The app's and the website's roadmaps, exported from `Lanxtor/E1` (below). |
| `tools/guides/build.py` | Builds the pages and the data file. |
| `guide.html`, `guide-<category>.html`, `guide-features.html`, `guide-roadmap.html` | **Generated.** Never edit them by hand. |
| `assets/data/user-guide-features.json` | **Generated.** The whole catalog as data. |
| `assets/img/guides/*.webp` | The screenshots. |
| `assets/css/guides.css`, `assets/js/guides.js` | Layout of the guide pages; the catalog filter. |

Build and check after every change:

```
python3 tools/guides/build.py --check
```

It fails on a duplicate feature id, an unknown status, a feature whose section is missing, a related feature that does not exist, a broken link or anchor, a missing image, or an image without alt text.

## A feature entry

```json
{
  "id": "DRAW-connector",
  "title": "Draw pipes, signals and cables with Connector",
  "summary": "One sentence: what it does for the user.",
  "anchor": "draw-connector",
  "status": "available",
  "since": "2026-11-04",
  "updated": "2026-11-06",
  "roadmap": ["M3.3"],
  "checks": ["B4"],
  "related": ["DRAW-place-symbol", "DRAW-off-page"],
  "roles": "Editor license; a project role that may edit drawings",
  "training": { "topic": "Drawing pipes and signals", "level": "Beginner", "minutes": 4 },
  "screenshots": ["connector-on.webp"]
}
```

- `status`: `available` (in E1 today), `under-development` (being built now), `planned` (on the roadmap, not started), `placeholder` (the control is on screen but opens *Under construction*), `preview` (website: preview data until the E1 cloud answers), `parked` (stopped by decision).
- `since`: the date the feature was delivered (the roadmap's `doneOn`, or the merge date). `updated`: the date it last changed in a way a user sees. Both `YYYY-MM-DD`. Leave out what is not known; never guess.
- `roadmap`: the roadmap stage ids (`src/ui/shell/roadmap.js` in `Lanxtor/E1`). `checks`: the manual-review check ids.
- `anchor` is the `id` of the feature's `<section>` in `src/<category>.html`.

## A feature section

```html
<section class="g-feature" id="draw-connector">
  <h2>Draw pipes, signals and cables with Connector</h2>
  <div class="g-meta"><span class="g-status available">Available</span><span>Since 2026-11-04</span><span>Updated 2026-11-06</span><span class="g-id">DRAW-connector</span><span>Roadmap M3.3</span><span>Review check B4</span></div>
  <p class="g-summary">What it is and why you use it, in two or three sentences.</p>
  <dl class="g-facts">
    <dt>Where</dt><dd>Drawing toolbar → <span class="ui">Connector</span></dd>
    <dt>Who</dt><dd>Editor license and a project role that may edit drawings</dd>
    <dt>Before you start</dt><dd>A sheet is open.</dd>
  </dl>
  <h3>Steps</h3>
  <div class="g-table-wrap"><table class="g-steps">
    <thead><tr><th>#</th><th>Action</th><th>Expected result</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Click <span class="ui">Connector</span>.</td><td>The button is highlighted …</td></tr>
    </tbody>
  </table></div>
  <figure class="g-shot"><img src="assets/img/guides/connector-on.webp" alt="…" width="2160" height="1350" loading="lazy"><figcaption>…</figcaption></figure>
  <p class="g-note">…</p>
  <p class="g-warn">…</p>
  <p class="g-related">Related: <a href="guide-drawing.html#draw-place-symbol">Place a symbol</a></p>
</section>
```

## Writing rules

- **Exact labels.** Every label, menu item, button and message is written exactly as on screen, with its capitalization and ellipsis (`New asset…`), in `<span class="ui">`. Take it from the code, never from memory.
- **One action per step, and what you should see.** The expected result is observable: what appears, what changes, what is refused and with which message. A tester must be able to say pass or fail.
- **Paths:** menus as *File → Project settings…*, right-click menus as *right-click Assets → New asset…*, submenus with ▸ where the app shows one.
- **Keys:** Windows first, Mac in brackets: <kbd>Ctrl+K</kbd> (<kbd>⌘K</kbd>).
- **Honest status.** Describe what E1 does today. What is not built yet is marked *Under development* or *Planned*, and a limitation of today's version goes in a `g-warn` box. Never describe a planned feature as available (manual-review check W3).
- **Links between features:** every feature links the features it depends on and the ones that follow from it (`related`, and a *Related* line). Use the feature ids.
- **Plain English**, short sentences, no internal terms (no file names, milestone codes only in the metadata line).

## Screenshots

Screenshots are taken from the running app with Playwright, 1440 × 900 at device scale 2, in the default dark appearance, on the demo project *Demo Plant* of the organization *Demo Company* (the test fixture `tests/fixtures/workspace-drawn-sheet.json` of `Lanxtor/E1` with its project renamed). They are stored as WebP (quality 82; full screens scaled to 2160 × 1350). A red frame marks what the step is about; numbered frames are explained in the caption. A screenshot that no longer matches the screen is retaken in the same change that updates the text.

To retake them (`tools/guides/screenshots/`):

```
python3 tools/guides/screenshots/make-demo-store.py ../E1 /tmp/guide-work      # the demo workspace
(cd ../E1 && E1_DB=/tmp/guide-work/store/db.json E1_AI_MODE=off npx vite --port 5173)   # in another window
python3 -m http.server 8000                                                     # this site, for the web scenario
E1_GUIDE_WORK=/tmp/guide-work NODE_PATH=../E1/node_modules node tools/guides/screenshots/run.cjs tools/guides/screenshots/scenarios/shell.cjs
python3 tools/guides/screenshots/towebp.py /tmp/guide-work/shots assets/img/guides
```

Each scenario file (`shell`, `objects`, `more`, `web`) is a list of named flows; name one after the file to run only that flow. Every flow starts from the demo workspace again. `CHROMIUM=<path>` uses another Chromium. Screens that need sign-in, several people or a model (the Organization dialog, live refresh, Cloud AI answers) are taken on the Azure app instead, where those work.

## Keeping the guides current

Once a week, and whenever a change a user can see reaches `main` of `Lanxtor/E1` or of this repository:

1. Export the roadmaps from `Lanxtor/E1` into `tools/guides/roadmap.json`:
   ```
   node --input-type=module -e "
   import { MILESTONES, ROADMAP_UPDATED } from './src/ui/shell/roadmap.js';
   import { WEBSITE_MILESTONES, WEBSITE_ROADMAP_UPDATED } from './docs/website/roadmap.mjs';
   const pick = (ms) => ms.map(m => ({ id: m.id, title: m.title, summary: m.summary, mvp: m.mvp, stages: m.stages.map(s => ({ id: s.id, title: s.title, done: s.done, doneOn: s.doneOn || null, visible: s.visible, tryIt: s.tryIt })) }));
   console.log(JSON.stringify({ app: { updated: ROADMAP_UPDATED, milestones: pick(MILESTONES) }, website: { updated: WEBSITE_ROADMAP_UPDATED, milestones: pick(WEBSITE_MILESTONES) } }, null, 1));
   " > ../E1Website/tools/guides/roadmap.json
   ```
2. Read what changed (`git log --since=… --format='%ad %s' --date=short` in both repositories, and the roadmap stages newly marked done). For each change a user can see: update the feature's steps, screenshot and `updated` date, or add a new feature; a stage that is now done changes its features from `under-development` or `planned` to `available` with `since` set to its `doneOn`.
3. Run `python3 tools/guides/build.py --check` and commit the sources with the generated pages.

## Open points (2026-11-07)

Found while writing the guides; each is noted in its guide.

- Manual-review checks that no longer match the app: A1 (there is no *Workspace* row since 2026-11-07; Lines is a group under Assets), C7 (Delete moves an object to the Bin; the preview of what goes with it is at *Delete permanently…*), D5 (*Update from Excel…* changes existing rows only; new rows need *Data → Import Excel…*), E4 (the Revisions filter is a placeholder), G4 (framing a region of a sheet is only possible through Cloud AI or the API), B7 (*Configuration → Shapes → Standard* filters the shape list; it is not a drawing standard for the project).
- *File → New project* shows <kbd>Ctrl+N</kbd>, but the key does nothing.
- *Insert → Asset…* does nothing: no part of the sheet view handles it (checked in `SheetView2D.jsx`, 2026-11-07). The toolbar's *Object* button with *Asset* places symbols.
- Website: the installers, the billing portal, the Academy courses and certificates, and the support phone number are not live yet.
