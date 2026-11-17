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
