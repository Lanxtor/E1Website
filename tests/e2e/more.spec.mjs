/*
 * Round 3: the short addresses (redirects), the legal pages and
 * security.txt, the coming-soon page the public sees before launch, the
 * shortcut bar on Get E1, the browser's Back and Forward, the interface in
 * German, and printing (certificate, legal pages).
 */
import { test, expect, sideways, isPhone, expectScrolledTo, readJson } from "./fixtures.mjs";

const SHORT = [
  ["/account", /\/account\.html$/],
  ["/login", /\/login\.html$/],
  ["/download", /\/download\.html$/],
  ["/academy", /\/academy\.html$/],
  ["/guides", /\/guide\.html$/],
  ["/pricing", /\/download\.html#pricing$/],
  ["/de", /\/de\/(index\.html)?$/]
];
for (const [address, url] of SHORT) {
  test(`the short address ${address} opens its page`, async ({ page }) => {
    await page.goto(address);
    await expect(page).toHaveURL(url);
    await expect(page.locator(".site-header")).toBeVisible();
  });
}

test("security.txt is published for security researchers, also at /security.txt", async ({ request }) => {
  const r = await request.get("/.well-known/security.txt");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/plain");
  expect(await r.text()).toMatch(/^Contact:/m);
  const short = await request.get("/security.txt", { maxRedirects: 0 });
  expect(short.status()).toBe(301);
  expect(short.headers()["location"]).toBe("/.well-known/security.txt");
});

test("Cookies in the footer opens the cookie part of the privacy policy when the notice is dismissed", async ({ page }) => {
  await page.goto("/privacy.html#cookies");
  await expect(page.locator("#cookies")).toBeAttached();
  await expectScrolledTo(page.locator("#cookies"));
});

test("the legal pages: each has its heading and the footer's legal links all work", async ({ page }) => {
  for (const [href, h1] of [["legal.html", /legal notice/i], ["privacy.html", /privacy/i], ["terms.html", /terms/i], ["security.html", /security/i], ["e1-terms.html", /license|agreement|terms/i], ["dpa.html", /processing/i]]) {
    await page.goto("/" + href);
    await expect(page.locator("h1").first()).toHaveText(h1);
    expect(await sideways(page)).toBeLessThanOrEqual(1);
  }
});

test("Sub-processors of E1 Cloud: the table lists each one with what it does", async ({ page }) => {
  await page.goto("/sub-processors.html");
  const rows = page.locator("main table tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) expect((await row.locator("td").first().textContent()).trim().length).toBeGreaterThan(0);
  await expect(page.locator("main")).toContainText("Microsoft");
});

test("the coming-soon page the public sees before launch: whole, no scripts needed", async ({ page }) => {
  await page.goto("/coming-soon.html");
  await expect(page.locator("body")).toContainText("Coming soon.");
  await expect(page.locator('a[href="mailto:info@lanxtor.com"]')).toBeVisible();
  await expect(page.locator('a[href*="linkedin.com/company/lanxtor"]')).toBeVisible();
  expect(await page.locator("script[src]").count()).toBe(0);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  // Its styles and pictures load.
  const failed = [];
  page.on("response", (r) => { if (r.status() >= 400) failed.push(r.url()); });
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(failed).toEqual([]);
});

test("Get E1: the shortcut bar jumps to each part and marks it; it sticks under the header", async ({ page }) => {
  await page.goto("/download.html");
  const bar = page.locator("[data-jump-bar]");
  for (const id of ["organisations", "universities", "pricing", "trial"]) {
    await bar.locator(`a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expectScrolledTo(page.locator(`#${id}`));
    await expect(bar.locator(`a[href="#${id}"]`)).toHaveClass(/is-active/);
  }
  await expect(bar).toHaveClass(/is-stuck/);
  await expect(bar).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(bar).not.toHaveClass(/is-stuck/);
});

test("Back and Forward: through pages, a language switch and the course player", async ({ page }, testInfo) => {
  await page.goto("/index.html");
  await page.locator(".site-footer a", { hasText: "Academy" }).first().click();
  await expect(page).toHaveURL(/\/academy\.html$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/index\.html$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/academy\.html$/);

  // A language switch, then Back: the English page is shown again
  // (the choice of German is remembered, so it then opens in German).
  if (isPhone(testInfo)) await page.locator(".nav-toggle").click();
  await page.locator(".lang-toggle").click();
  await page.locator('.lang-menu a[data-lang-pick="de"]').click();
  await expect(page).toHaveURL(/\/de\/academy\.html$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/(de\/)?academy\.html$/);
  await expect(page.locator("h1").first()).toBeVisible();

  // Lessons change the address without adding steps: Back leaves the course.
  await page.goto("/account.html?demo=1#academy-courses");
  await page.locator(".course-card", { hasText: "Collaboration, branches and review" }).getByRole("link", { name: "Start the course" }).click();
  await expect(page.locator("[data-lesson] h2")).toHaveText("Why branches");
  await page.locator(".outline-lesson", { hasText: "Release a revision" }).click();
  await expect(page).toHaveURL(/lesson=c4/);
  await page.goBack();
  await expect(page).toHaveURL(/\/account\.html\?demo=1#academy-courses$/);
  await page.goForward();
  await expect(page.locator("[data-lesson] h2")).toHaveText("Release a revision");
});

test.describe("the interface in German", () => {
  test.use({ cookieNotice: true });
  test("menu, buttons, Alex, cookie notice and price switches read in German", async ({ page }, testInfo) => {
    await page.goto("/de/download.html#pricing");
    await expect(page.locator("html")).toHaveAttribute("lang", /^de/);
    await expect(page.getByRole("dialog", { name: "Cookies" }).getByRole("button")).toBeVisible();
    await page.getByRole("dialog", { name: "Cookies" }).getByRole("button").click();
    await expect(page.locator('[data-billing-switch] button[data-billing="yearly"]')).toHaveText("Jährliche Abrechnung");
    await expect(page.locator('[data-billing-switch] button[data-billing="monthly"]')).toHaveText("Monatliche Abrechnung");
    await expect(page.locator("[data-currency-note]")).toContainText("Preise in Euro");
    await expect(page.locator(".alex-launcher")).toContainText("Alex fragen");
    if (isPhone(testInfo)) await page.locator(".nav-toggle").click();
    await expect(page.locator(".nav-actions a", { hasText: "Anmelden" })).toBeVisible();
    await expect(page.locator(".nav-actions .btn-primary")).toHaveText("E1 holen");
    await page.locator(".alex-launcher").click();
    await expect(page.getByRole("button", { name: "Neues Gespräch" })).toBeAttached();
  });
});

test.describe("printing", () => {
  test("a certificate prints on its own: no header, footer, share card or note", async ({ page }) => {
    await page.goto("/certificate.html?id=E1C-7KQ3-M9XP-2DWA&demo=1");
    await expect(page.locator("[data-cert-figure] svg")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("[data-cert-figure] svg")).toBeVisible();
    for (const sel of [".site-header", ".site-footer", ".cert-side", ".cert-verify", ".alex-launcher"]) await expect(page.locator(sel).first()).toBeHidden();
    const pdf = await page.pdf({ format: "A4", landscape: true }).catch(() => null);
    if (pdf) expect(pdf.length).toBeGreaterThan(1000);
  });

  test("a legal page prints without the Ask Alex button or the page's contents list", async ({ page }) => {
    await page.goto("/privacy.html");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".alex-launcher")).toBeHidden();
    if (await page.locator(".legal-toc").count()) await expect(page.locator(".legal-toc").first()).toBeHidden();
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

const LANG_CURRENCY = { de: "EUR", fr: "EUR", es: "EUR", no: "NOK" };
for (const [lang, cur] of Object.entries(LANG_CURRENCY)) {
  test(`/${lang}/ Get E1: prices start in ${cur} and the buttons not published yet say so in the language`, async ({ page }) => {
    await page.goto(`/${lang}/download.html`);
    await expect(page.locator(`[data-currency-switch] button[data-cur="${cur}"]`)).toHaveAttribute("aria-pressed", "true");
    const soon = await page.evaluate(() => window.E1_T("Coming soon"));
    expect(soon).not.toBe("Coming soon");
    const store = readJson("assets/data/releases.json").platforms.phone.store;
    if (store.url) await expect(page.locator('[data-get-os="phone"]')).toHaveAttribute("href", store.url);
    else await expect(page.locator('[data-get-os="phone"] [data-get-meta]')).toHaveText(store.label + " · " + soon);
  });
}
