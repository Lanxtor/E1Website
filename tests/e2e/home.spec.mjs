/*
 * Contact us (shape-e1.html) and the campaign tag that travels from a tagged
 * link to the sign-up. The home page itself (the Overview) is tested in
 * overview2.spec.mjs.
 */
import { test, expect, API } from "./fixtures.mjs";

test("Contact us: write to sales or to support; the guides and the prices are linked", async ({ page }) => {
  await page.goto("/shape-e1.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact us.");
  await expect(page.getByRole("link", { name: "sales@lanxtor.com" })).toHaveAttribute("href", "mailto:sales@lanxtor.com");
  await expect(page.getByRole("link", { name: "support@lanxtor.com" })).toHaveAttribute("href", "mailto:support@lanxtor.com");
  await page.getByRole("link", { name: "Browse the user guides →" }).click();
  await expect(page).toHaveURL(/\/account\.html#academy-guides$/);
  await page.goto("/shape-e1.html");
  await page.getByRole("link", { name: "See licenses and prices →" }).click();
  await expect(page).toHaveURL(/\/download\.html#pricing$/);
});

test("Contact us in German: the email addresses stay the same", async ({ page }) => {
  await page.goto("/de/shape-e1.html");
  await expect(page.locator('a[href="mailto:sales@lanxtor.com"]').first()).toBeVisible();
  await expect(page.locator('a[href="mailto:support@lanxtor.com"]').first()).toBeVisible();
});

test("a campaign tag goes from page to page with the visitor, up to the sign-up", async ({ page }, testInfo) => {
  await page.goto("/index.html?utm_source=linkedin&utm_medium=social&utm_campaign=launch");
  // Links to the site's pages carry it; outside links and mail links do not.
  await expect(page.locator('.site-footer a[href^="about.html"]')).toHaveAttribute("href", "about.html?utm_source=linkedin&utm_medium=social&utm_campaign=launch");
  await expect(page.locator('.site-footer a[href*="linkedin.com/company"]')).toHaveAttribute("href", "https://www.linkedin.com/company/lanxtor/");
  // Get E1, then Log in, then Sign up.
  if (testInfo.project.name === "phone") await page.locator(".header-cta").click();
  else await page.locator(".nav-actions .btn-primary").click();
  await expect(page).toHaveURL(/\/download\.html\?utm_source=linkedin&utm_medium=social&utm_campaign=launch$/);
  if (testInfo.project.name === "phone") await page.locator(".nav-toggle").click();
  await page.locator(".nav-actions a", { hasText: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\.html\?utm_source=linkedin/);
  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.locator("[data-auth-submit]")).toHaveAttribute("href", new RegExp("^" + API.replace(/\./g, "\\.") + "/auth/login\\?.*&signup=1&utm_source=linkedin&utm_medium=social&utm_campaign=launch$"));
});

test("without a campaign tag the links stay plain", async ({ page }) => {
  await page.goto("/index.html?ref=x");
  await expect(page.locator('.site-footer a[href^="about.html"]')).toHaveAttribute("href", "about.html");
});
