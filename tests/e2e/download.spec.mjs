/*
 * WEB-download, ACC-desktop-app, ACC-browser: the four buttons at the top of
 * Get E1 and the download cards (download.html and Downloads on the account
 * page) are built from the release manifest: the one in the downloads
 * storage (E1_CONFIG.releases), else assets/data/releases.json.
 */
import { test, expect, readJson, isPhone } from "./fixtures.mjs";

const LOCAL = readJson("assets/data/releases.json");
const STORAGE = "https://e1downloads.blob.core.windows.net/releases/releases.json";

function firstFile(key) {
  return (LOCAL.platforms[key].files || []).find((f) => f.url);
}

test("Get E1: each button reads the release manifest", async ({ page }) => {
  await page.goto("/download.html");
  for (const key of ["mac", "windows"]) {
    const btn = page.locator(`[data-get-os="${key}"]`);
    const file = firstFile(key);
    if (file) {
      await expect(btn).toHaveAttribute("href", file.url);
      await expect(btn).toHaveAttribute("download", "");
      await expect(btn).not.toHaveAttribute("aria-disabled", "true");
      await expect(btn.locator("[data-get-meta]")).toContainText(file.label);
      await expect(btn).toHaveAttribute("title", "SHA-256 " + file.sha256);
    } else {
      await expect(btn).toHaveAttribute("aria-disabled", "true");
      await expect(btn.locator("[data-get-meta]")).toHaveText("Coming soon");
    }
  }
  for (const key of ["ipad", "phone"]) {
    const btn = page.locator(`[data-get-os="${key}"]`);
    const store = LOCAL.platforms[key].store;
    if (store.url) {
      await expect(btn).toHaveAttribute("href", store.url);
      await expect(btn).toHaveAttribute("target", "_blank");
    } else {
      await expect(btn).toHaveAttribute("aria-disabled", "true");
      await expect(btn).toHaveClass(/is-soon/);
      await expect(btn.locator("[data-get-meta]")).toHaveText(store.label + " · Coming soon");
    }
  }
});

test("Downloads on the account page: one card per platform from the same manifest", async ({ page }) => {
  await page.goto("/account.html?demo=1#downloads");
  // The download cards: one per platform, files not published read "Coming soon".
  const cards = page.locator("[data-downloads] [data-download-card]");
  await expect(cards).toHaveCount(Object.keys(LOCAL.platforms).length);
  for (const [key, p] of Object.entries(LOCAL.platforms)) {
    const card = page.locator(`[data-downloads] [data-download-card="${key}"]`);
    await expect(card.locator("h3")).toHaveText(p.name);
    await expect(card).toContainText(p.requirements);
    for (const f of p.files || []) {
      if (f.url) await expect(card.locator(`a[href="${f.url}"]`)).toHaveText(f.label);
      else await expect(card.getByText(f.label + " · Coming soon")).toBeVisible();
    }
  }
});

test("the iPad button, not published yet, opens the E1 Reviewer guide", async ({ page }) => {
  test.skip(Boolean(LOCAL.platforms.ipad.store.url), "E1 Reviewer is published");
  await page.goto("/download.html");
  // Marked aria-disabled ("Coming soon"), yet a visitor can still click it.
  await page.locator('[data-get-os="ipad"]').click({ force: true });
  await expect(page).toHaveURL(/\/guide-reviewer\.html$/);
  await expect(page.locator("h1").first()).toBeVisible();
});

for (const lang of ["", "de/", "fr/", "es/", "no/"]) {
  test(`/${lang}download.html: a button not published yet stays on this page`, async ({ page }) => {
    test.skip(Boolean(LOCAL.platforms.phone.store.url), "E1 Mobile is published");
    // Regression: on /de/download.html the phone button led to the English page.
    await page.goto(`/${lang}download.html`);
    const btn = page.locator('[data-get-os="phone"]');
    await expect(btn).toHaveAttribute("aria-disabled", "true");
    await btn.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`/${lang.replace("/", "\\/")}download\\.html#get-now$`));
    await expect(page.locator("#get-now")).toBeVisible();
  });
}

test("a newer manifest in the downloads storage wins, and a published app opens its store", async ({ page }) => {
  const manifest = JSON.parse(JSON.stringify(LOCAL));
  manifest.channel = "beta";
  manifest.platforms.phone.store = { label: "App Store", url: "https://apps.apple.com/app/e1-mobile/id000000001" };
  manifest.platforms.mac.files = [{ label: "Apple silicon (.dmg)", arch: "arm64", url: "https://e1downloads.blob.core.windows.net/releases/e1/test/E1-test-arm64.dmg", size: 1048576, sha256: "ab".repeat(32) }];
  await page.route(STORAGE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifest) }));
  await page.goto("/download.html");
  const phone = page.locator('[data-get-os="phone"]');
  await expect(phone).toHaveAttribute("href", manifest.platforms.phone.store.url);
  await expect(phone).toHaveAttribute("target", "_blank");
  await expect(phone).not.toHaveClass(/is-soon/);
  await expect(phone.locator("[data-get-meta]")).toHaveText("Download on the App Store");
  await expect(page.locator('[data-get-os="mac"] [data-get-meta]')).toHaveText("Apple silicon (.dmg) · 1.0 MB");
  // The account page's card changes with it.
  await page.goto("/account.html?demo=1#downloads");
  await expect(page.locator('[data-downloads] [data-download-card="phone"] a')).toHaveAttribute("href", manifest.platforms.phone.store.url);
  await expect(page.locator("[data-release-line]")).toHaveText("beta channel");
});

test("the storage cannot be read and neither can the local copy: the page says so", async ({ page }) => {
  await page.route("**/assets/data/releases.json", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/account.html?demo=1#downloads");
  await expect(page.locator("[data-downloads]")).toHaveText("Downloads are not available right now.");
});

test.describe("a visitor on Windows", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", { get: () => "Win32" });
      Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => ({ platform: "Windows" }) });
    });
  });
  test("sees Windows first, marked as their system", async ({ page }) => {
    test.skip(!firstFile("windows"), "no Windows installer published");
    await page.goto("/download.html");
    await expect(page.locator("[data-get-now] [data-get-os]").first()).toHaveAttribute("data-get-os", "windows");
    await page.goto("/account.html?demo=1#downloads");
    const first = page.locator("[data-downloads] [data-download-card]").first();
    await expect(first).toHaveAttribute("data-download-card", "windows");
    await expect(first).toHaveClass(/is-mine/);
    await expect(first.locator(".badge")).toHaveText("Your system");
  });
});

test("Get E1 in the header leads to the download page from any page", async ({ page }, testInfo) => {
  await page.goto("/about.html");
  // On a phone the button sits next to the menu; on a desktop at the end of the menu.
  await page.locator(isPhone(testInfo) ? ".header-cta" : ".nav-actions .btn-primary").click();
  await expect(page).toHaveURL(/\/download\.html$/);
  await expect(page.locator("#get-now")).toBeVisible();
});

test("Open E1 in the browser: the guide's ACC-browser part is there", async ({ page }) => {
  await page.goto("/guide-access.html#acc-browser");
  await expect(page.locator("#acc-browser")).toBeVisible();
  await expect(page.locator("#acc-desktop-app")).toBeAttached();
  await expect(page.locator("#acc-desktop-updates")).toBeAttached();
});

/* The notes for IT under each button, as written on the page. */
const IT_NOTES = {
  mac: ["Package", "Signed", "Install", "Asks for", "Updates", "On the Mac"],
  windows: ["Package", "Install", "Signed", "Integrity", "Updates", "On the PC"],
  ipad: ["From", "Microsoft Intune", "Asks for", "Tracking", "On the iPad", "Notifications"],
  phone: ["From", "Microsoft Intune", "Asks for", "Tracking", "On the iPhone", "Notifications"]
};

test("Get E1: under each button, its notes for IT, in its own column and on screen", async ({ page }) => {
  await page.goto("/download.html");
  const width = page.viewportSize().width;
  for (const [key, terms] of Object.entries(IT_NOTES)) {
    const col = page.locator(`[data-get-col="${key}"]`);
    const btn = col.locator(`[data-get-os="${key}"]`);
    const notes = col.locator('dl.get-it[aria-label="For IT"]');
    await notes.scrollIntoViewIfNeeded();
    await expect(notes).toBeVisible();
    await expect(notes.locator("dt")).toHaveText(terms);
    for (const dd of await notes.locator("dd").all()) expect((await dd.textContent()).trim().length).toBeGreaterThan(3);
    // Under its own button, inside the screen.
    const b = await btn.boundingBox(), n = await notes.boundingBox();
    expect(n.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
    expect(Math.abs((n.x + n.width / 2) - (b.x + b.width / 2))).toBeLessThan(Math.max(b.width, n.width) / 2);
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.x + n.width).toBeLessThanOrEqual(width + 1);
  }
  // The facts IT asks for first.
  await expect(page.locator('[data-get-col="mac"] .get-it')).toContainText("notarized by Apple");
  await expect(page.locator('[data-get-col="windows"] .get-it code')).toHaveText(["/S", "E1_NO_UPDATES=1"]);
  await expect(page.locator('[data-get-col="windows"] .get-it')).toContainText("SHA-256");
  await expect(page.locator('[data-get-col="ipad"] .get-it')).toContainText("No analytics or advertising SDKs");
});

test("Get E1: what is ready and what is still in preparation, as it stands", async ({ page }) => {
  await page.goto("/download.html");
  const note = (key, term) => page.locator(`[data-get-col="${key}"] .get-it dt`, { hasText: term }).locator("xpath=following-sibling::dd[1]");
  // The Windows installer is signed.
  await expect(note("windows", "Signed")).toHaveText("Lanxtor LLC, with Microsoft Artifact Signing");
  // On the iPad, app protection and app configuration work; selective wipe is still being checked.
  await expect(note("ipad", "Microsoft Intune")).toHaveText("App protection policies and app configuration; selective wipe: in preparation");
  // On the iPhone, Intune is still in preparation.
  await expect(note("phone", "Microsoft Intune")).toHaveText("App protection policies, app configuration and selective wipe: in preparation");
  // Neither app is in the App Store yet.
  for (const key of ["ipad", "phone"]) await expect(page.locator(`[data-get-os="${key}"] [data-get-meta]`)).toHaveText("App Store · Coming soon");
});

test("Get E1: the four buttons sit side by side on a desktop and one under the other on a phone", async ({ page }, testInfo) => {
  await page.goto("/download.html");
  // Measured once the page has settled: the fonts loaded and the buttons filled from the release
  // manifest, the columns where they stay (two readings in a row the same).
  await page.evaluate(() => document.fonts.ready);
  const measure = async () => {
    const found = [];
    for (const key of Object.keys(IT_NOTES)) found.push(await page.locator(`[data-get-col="${key}"]`).boundingBox());
    return JSON.stringify(found);
  };
  let last = "";
  await expect.poll(async () => { const now = await measure(); const same = now === last; last = now; return same; }, { intervals: [150], timeout: 10_000 }).toBe(true);
  const boxes = JSON.parse(last);
  const sameRow = boxes.every((b) => Math.abs(b.y - boxes[0].y) < 5);
  if (isPhone(testInfo)) expect(sameRow).toBe(false);
  else expect(sameRow).toBe(true);
  // Never overlapping.
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    const overlap = a.x < c.x + c.width - 1 && c.x < a.x + a.width - 1 && a.y < c.y + c.height - 1 && c.y < a.y + a.height - 1;
    expect(overlap, `columns ${i} and ${j} overlap`).toBe(false);
  }
});

test.describe("a visitor on Windows", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", { get: () => "Win32" });
      Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => ({ platform: "Windows" }) });
    });
  });
  test("the Windows notes for IT move first with their button", async ({ page }) => {
    await page.goto("/download.html");
    const first = page.locator("[data-get-now] [data-get-col]").first();
    await expect(first).toHaveAttribute("data-get-col", "windows");
    await expect(first.locator("[data-get-os]")).toHaveAttribute("data-get-os", "windows");
    await expect(first.locator(".get-it dt").first()).toHaveText("Package");
    await expect(first.locator(".get-it")).toContainText("Windows 10 or 11");
  });
});

const IT_ALL = ["Network", "Data", "Sign-in", "AI", "Telemetry", "Trial", "Certifications", "Questions"];

test("For IT: every app — network hosts, data, sign-in, AI, telemetry, trial, certifications, questions", async ({ page }) => {
  await page.goto("/download.html");
  const block = page.getByRole("region", { name: "For IT: every app" });
  await block.scrollIntoViewIfNeeded();
  await expect(block).toBeVisible();
  await expect(block.locator(".get-it-grid dt")).toHaveText(IT_ALL);
  await expect(block.locator(".get-it-grid dd").first().locator("code")).toHaveText(["app.lanxtor.com", "e1downloads.blob.core.windows.net", "login.microsoftonline.com", "*.ciamlogin.com"]);
  // The hosts the page names are the ones the site itself talks to.
  const config = await page.evaluate(() => window.E1_CONFIG);
  expect(new URL(config.apiBase).host).toBe("app.lanxtor.com");
  expect(new URL(config.releases).host).toBe("e1downloads.blob.core.windows.net");
  await expect(block.getByRole("link", { name: "support@lanxtor.com" })).toHaveAttribute("href", "mailto:support@lanxtor.com");
  // Fits the screen.
  const b = await block.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
});

const IT_LINKS = [["E1 Cloud specifications", /\/cloud-specifications\.html$/], ["Data processing agreement", /\/dpa\.html$/], ["Sub-processors", /\/sub-processors\.html$/], ["Security", /\/security\.html$/], ["Privacy", /\/privacy\.html$/], ["Contact sales", /\/contact-sales\.html$/]];
for (const [name, url] of IT_LINKS) {
  test(`For IT: every app — ${name} opens its page`, async ({ page }) => {
    await page.goto("/download.html");
    const block = page.getByRole("region", { name: "For IT: every app" });
    await block.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

for (const lang of ["de", "fr", "es", "no"]) {
  test(`/${lang}/download.html has the notes for IT under each button and the For IT block`, async ({ page }) => {
    await page.goto(`/${lang}/download.html`);
    for (const key of Object.keys(IT_NOTES)) {
      const notes = page.locator(`[data-get-col="${key}"] dl.get-it`);
      await expect(notes).toBeAttached();
      await expect(notes.locator("dt")).toHaveCount(IT_NOTES[key].length);
    }
    const all = page.locator("section.get-it-all");
    await expect(all.locator(".get-it-grid dt")).toHaveCount(IT_ALL.length);
    await expect(all.locator("code", { hasText: "app.lanxtor.com" })).toBeAttached();
  });
}
