# Screen tests

Playwright tests that use the website as a visitor does (click, type, pick from menus and dialogs) and check what is on screen. They live in `tests/e2e/`.

```sh
npm ci                 # once: installs @playwright/test
npm run test:e2e       # all tests, desktop (1440x900) and phone (iPhone 15), in Chromium
npx playwright test account --project=phone   # one file, one screen size
```

Chromium: `npx playwright install chromium` once on a new machine. Where a Chromium of another version is already installed, point the tests at it: `E1_CHROMIUM=/path/to/chrome npm run test:e2e`.

## How they run

- `tests/e2e/server.mjs` serves the repository on a free port the way Azure Static Web Apps does, following `staticwebapp.config.json`: the global headers (the Content Security Policy too), redirects (`/pricing` → `download.html#pricing`, `user-guides.html` → the Academy), `/tools/*` and `/docs/*` answer 404, and the 404 page.
- `tests/e2e/fixtures.mjs`: nothing leaves the machine. The E1 server (`https://app.lanxtor.com`) answers 503 unless a test answers its routes with `mockApi()` (shapes in `tests/e2e/data.mjs`); the release manifest in the downloads storage answers 404, so `assets/data/releases.json` is used; every other outside address is blocked. A test fails on any error the page throws and on any CSP violation.
- The course player and certificate page also run in the preview (`?demo=1`), where `assets/js/e1-api.js` answers with its own example data.

## What is covered

| File | What a visitor does |
| --- | --- |
| `pages.spec.mjs` | Every page in `sitemap.xml` and the pages reached from them: loads with no error, every internal link and `#part` exists, every image loads, no sideways scroll on a phone. |
| `navigation.spec.mjs` | The header menu (hamburger on a phone), the footer, the cookie notice, the 404 page, Talk to sales, E1 Cloud specifications (`WEB-cloud-specs`). |
| `languages.spec.mjs` | `WEB-languages`: the language menu, the choice remembered, a first visit in the browser's language. |
| `download.spec.mjs` | `WEB-download`, `ACC-desktop-app`, `ACC-browser`: Get E1's four buttons and the download cards from the release manifest. |
| `pricing.spec.mjs` | `WEB-pricing`: currencies, billed yearly or monthly, remembered; the live price list and plan features; a product of the price list the table has no place for, under "Also on the price list". |
| `login.spec.mjs` | Log in and sign up, the university email check, Sign in with Microsoft. |
| `account.spec.mjs` | `WEB-account-page`, `WEB-overview`, `WEB-licenses`, `WEB-usage`, `WEB-organizations`, `WEB-projects`, `WEB-permissions`, billing, profile, sign-out, errors. |
| `academy.spec.mjs` | `WEB-academy-public`, `WEB-academy`, `WEB-course-player`, `WEB-certificates`, `WEB-certificate-page`. |
| `guides.spec.mjs` | `WEB-user-guides`: every feature's anchor (the E1 Guide's links), the catalog's search and filters, the roadmap. |
| `solutions.spec.mjs` | The feature catalog on Solutions (category filters, search, nothing found and Clear filters, Escape), every solution page reached from it, and every question on each solution page opening and closing. |
| `assistant.spec.mjs` | `WEB-assistant`: Ask Alex, suggested and typed questions, the conversation kept between pages. |
| `home.spec.mjs` | The home page's platform being built and Meet Alex (also with reduce motion), Contact us, a campaign tag going from page to page up to the sign-up. |
| `screens.spec.mjs` | A 320 px phone and a tablet (no page scrolls sideways), and a window made narrower and wider while a page is open. |
| `keyboard.spec.mjs` | The keyboard only (desktop): Tab, Enter, Space, the arrow keys and Escape in the menu, sign-in, Alex, the catalog, pricing, the course player and the account page. |
| `errors.spec.mjs` | What a visitor sees when something fails or is not there yet: refused pictures, an organization that cannot be switched to, billing not connected, lessons that cannot load, saving the place in a video, native Share. |

Against a real E1 server and the operator console, E1's own `tests/e2e/postgres/operatorWebsite.spec.mjs` (Lanxtor/E1) runs these pages for what the two share: prices and plan features from the console, sign-up with a campaign tag, the account page, Ask Alex with Product knowledge, the university check, Sign in with Microsoft.

Not covered by a screen test: the desktop app's own updates (`ACC-desktop-updates`, in the E1 app; only its guide part is checked), real downloads and store pages, the E1 server's sign-in, and clips that are not made yet (a missing clip keeps its still).

## When they run

Before pushing a change to a page (CLAUDE.md, "Checks"), and once a night on GitHub (`.github/workflows/tests.yml`, also by hand: Actions → Website screen tests → Run workflow). Not on every push, to keep GitHub minutes down. A failed nightly run keeps its report as an artifact for a week.

A bug fix starts with a test that shows the bug and fails; the fix makes it pass, and the test stays.
