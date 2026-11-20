/*
 * The header menu (the hamburger on a phone), the footer, the cookie notice,
 * the 404 page, Talk to sales and E1 Cloud specifications (WEB-cloud-specs).
 */
import { test, expect, openMenu, isPhone, expectScrolledTo } from "./fixtures.mjs";

const MENU = [["Overview", "overview-2.html"], ["Solutions", "solutions.html"], ["Academy", "academy.html"], ["Contact us", "shape-e1.html"], ["About us", "about.html"]];

for (const [label, href] of MENU) {
  test(`menu: ${label} opens ${href} and is marked as the current page`, async ({ page }, testInfo) => {
    await page.goto(href === "index.html" ? "/about.html" : "/index.html");
    await openMenu(page, testInfo);
    await page.locator(".nav-links").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/" + href.replace(".", "\\.") + "$"));
    await expect(page.locator(`.nav-links a[href="${href}"]`)).toHaveAttribute("aria-current", "page");
    await expect(page.locator("body")).not.toHaveClass(/nav-open/);
  });
}

test("menu: on a phone the hamburger opens and closes it; on a desktop every link is on screen", async ({ page }, testInfo) => {
  await page.goto("/index.html");
  const toggle = page.locator(".nav-toggle");
  const nav = page.locator(".site-header .nav");
  if (!isPhone(testInfo)) {
    await expect(toggle).toBeHidden();
    for (const [label] of MENU) await expect(page.locator(".nav-links").getByRole("link", { name: label, exact: true })).toBeInViewport();
    return;
  }
  await expect(nav).toHaveCSS("opacity", "0");
  await expect(nav).toHaveCSS("pointer-events", "none");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toHaveCSS("opacity", "1");
  await expect(page.locator(".nav-links a", { hasText: "Solutions" })).toBeInViewport();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toHaveCSS("pointer-events", "none");
});

test("the brand goes home; the header stays on screen while scrolling", async ({ page }) => {
  await page.goto("/about.html");
  await page.mouse.wheel(0, 2500);
  await expect(page.locator(".site-header")).toHaveClass(/is-scrolled/);
  await expect(page.locator(".site-header")).toBeInViewport();
  await page.locator(".site-header .brand").click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

const FOOTER = [
  ["Overview", /\/overview-2\.html$/], ["Solutions", /\/solutions\.html$/], ["Academy", /\/academy\.html$/], ["Get E1", /\/download\.html$/],
  ["Pricing", /\/download\.html#pricing$/], ["User guide", /\/guide\.html$/], ["About us", /\/about\.html$/], ["Contact us", /\/shape-e1\.html$/],
  ["Contact sales", /\/contact-sales\.html$/], ["Your account", /\/account\.html$/], ["Legal notice", /\/legal\.html$/],
  ["Terms of use", /\/terms\.html$/], ["License agreement", /\/e1-terms\.html$/], ["Security", /\/security\.html$/]
];
for (const [label, url] of FOOTER) {
  test(`footer: ${label}`, async ({ page }) => {
    await page.goto("/solutions.html");
    await page.locator(".site-footer").getByRole("link", { name: label, exact: true }).first().click();
    await expect(page).toHaveURL(url);
    await expect(page.locator("h1").first()).toBeAttached();
  });
}

test("footer: LinkedIn opens in a new tab; the footer is in the page's language", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator(".site-footer a", { hasText: "LinkedIn" })).toHaveAttribute("target", "_blank");
  await page.goto("/de/index.html");
  await expect(page.locator(".site-footer .footer-legal a").first()).toHaveAttribute("href", /^de\//);
});

test.describe("cookie notice", () => {
  test.use({ cookieNotice: true });
  test("shown once, OK hides it for good, Cookies in the footer shows it again", async ({ page }) => {
    await page.goto("/index.html");
    const notice = page.getByRole("dialog", { name: "Cookies" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("No tracking, no advertising.");
    await notice.getByRole("button", { name: "OK" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(notice).toHaveCount(0);
    await page.goto("/about.html");
    await expect(notice).toHaveCount(0);
    await page.locator(".site-footer a[data-cookie-settings]").click();
    await expect(notice).toBeVisible();
    await expect(page).toHaveURL(/\/about\.html$/);
  });
});

test("an address that does not exist shows the 404 page with a way back", async ({ page }) => {
  const res = await page.goto("/no-such-page.html");
  expect(res.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();
  await page.locator(".site-header .brand").click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test("the working files of the repository are not served", async ({ request }) => {
  for (const p of ["/tools/guides/build.py", "/docs/TESTS.md"]) expect((await request.get(p)).status()).toBe(404);
});

test("Talk to sales: write to sales by email (the page has no form)", async ({ page }) => {
  await page.goto("/contact-sales.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Talk to sales.");
  await expect(page.getByRole("link", { name: "sales@lanxtor.com" })).toHaveAttribute("href", "mailto:sales@lanxtor.com");
  expect(await page.locator("main form").count()).toBe(0);
  await page.getByRole("link", { name: "licenses and prices" }).click();
  await expect(page).toHaveURL(/\/download\.html#pricing$/);
});

test("E1 Cloud specifications: the page menu jumps to each part, the questions open and close", async ({ page }) => {
  await page.goto("/cloud-specifications.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E1 Cloud specifications.");
  for (const id of ["security", "backups", "faq"]) {
    await page.locator(`.cs-nav a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expectScrolledTo(page.locator(`#${id}`));
  }
  const q = page.locator("#faq details").first();
  await q.locator("summary").click();
  await expect(q).toHaveAttribute("open", "");
  await q.locator("summary").click();
  await expect(q).not.toHaveAttribute("open", "");
  // Linked from Get E1 (WEB-cloud-specs).
  await page.goto("/download.html");
  await page.locator('main a[href="cloud-specifications.html"]').first().click();
  await expect(page).toHaveURL(/\/cloud-specifications\.html$/);
});
