/*
 * WEB-pricing: the plans on Get E1 (download.html#pricing), prices billed
 * yearly or monthly in USD, EUR, GBP or NOK, remembered in the browser; the
 * live price list and plan features from the E1 server when it answers.
 */
import { test, expect, mockApi, readJson } from "./fixtures.mjs";
import { sitePrices } from "./data.mjs";

const RATES = readJson("assets/data/rates.json").rates;
/* The same rounding as pricing.js: a price list, not a conversion. */
function nice(x) {
  const step = x < 100 ? 5 : x < 1000 ? 10 : x < 10000 ? 100 : 500;
  return Math.max(step, Math.round(x / step) * step);
}
const toCur = { EUR: 1 / RATES.USD, GBP: RATES.GBP / RATES.USD, NOK: RATES.NOK / RATES.USD };
const digits = (n) => n.toLocaleString("en-US");

const standard = (page) => page.locator('#pricing [data-product="editor"]');
const essentials = (page) => page.locator('#pricing [data-product="editor-basic"]');

test("/pricing and /pricing.html lead to the plans on Get E1", async ({ page }) => {
  for (const p of ["/pricing", "/pricing.html"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/download\.html#pricing$/);
    await expect(page.getByRole("heading", { name: "Choose a plan for your organization" })).toBeVisible();
  }
});

test("prices in each currency, yearly and monthly, remembered after reload", async ({ page }) => {
  await page.goto("/download.html#pricing");
  await expect(standard(page)).toHaveText("$795");
  await expect(page.locator('[data-currency-switch] button[data-cur="USD"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-currency-note]")).toHaveText("Prices in US dollars");
  await expect(page.locator("#pricing [data-year-total]").nth(2)).toHaveText("$9,540 per user a year");

  for (const cur of ["EUR", "GBP", "NOK"]) {
    await page.locator(`[data-currency-switch] button[data-cur="${cur}"]`).click();
    await expect(page.locator(`[data-currency-switch] button[data-cur="${cur}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(standard(page)).toContainText(digits(nice(795 * toCur[cur])));
    await expect(essentials(page)).toContainText(digits(nice(349 * toCur[cur])));
  }
  await expect(page.locator("[data-currency-note]")).toContainText("Prices in Norwegian kroner");

  // Billed monthly.
  await page.locator('[data-billing-switch] button[data-billing="monthly"]').click();
  await expect(page.locator('[data-billing-switch] button[data-billing="monthly"]')).toHaveAttribute("aria-pressed", "true");
  await expect(standard(page)).toContainText(digits(nice(955 * toCur.NOK)));
  await expect(page.locator("#pricing [data-billed]").first()).toHaveText("Per user / month, billed monthly");
  await expect(page.locator("#pricing [data-year-total]").first()).toHaveText("No yearly commitment");

  // Remembered.
  await page.reload();
  await expect(page.locator('[data-currency-switch] button[data-cur="NOK"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-billing-switch] button[data-billing="monthly"]')).toHaveAttribute("aria-pressed", "true");
  await expect(standard(page)).toContainText(digits(nice(955 * toCur.NOK)));

  // Back to USD, billed yearly.
  await page.locator('[data-currency-switch] button[data-cur="USD"]').click();
  await page.locator('[data-billing-switch] button[data-billing="yearly"]').click();
  await expect(standard(page)).toHaveText("$795");
  await expect(page.locator("#pricing [data-billed]").first()).toHaveText("Per user / month, billed yearly");
});

test("the currency chosen on one page is used on the others (Academy)", async ({ page }) => {
  await page.goto("/download.html#pricing");
  await page.locator('[data-currency-switch] button[data-cur="EUR"]').click();
  await page.goto("/academy.html");
  await expect(page.locator('[data-product="academy"]')).toContainText(digits(nice(750 * toCur.EUR)));
  await expect(page.locator('[data-product="academy"]')).toContainText("€");
});

test.describe("a German visitor", () => {
  test("sees euros first on the German page", async ({ page }) => {
    await page.goto("/de/download.html#pricing");
    await expect(page.locator('[data-currency-switch] button[data-cur="EUR"]')).toHaveAttribute("aria-pressed", "true");
    await expect(standard(page)).toContainText("€");
  });
});

test.describe("a visitor in London", () => {
  test.use({ timezoneId: "Europe/London" });
  test("sees pounds first", async ({ page }) => {
    await page.goto("/download.html#pricing");
    await expect(page.locator('[data-currency-switch] button[data-cur="GBP"]')).toHaveAttribute("aria-pressed", "true");
    await expect(standard(page)).toContainText("£");
  });
});

test("the live price list and plan features of the E1 server replace the page's", async ({ page }) => {
  await mockApi(page, {
    "GET /api/site/prices": { products: [{ id: "editor", usd: 800, usdMonthly: 960 }] },
    "GET /api/site/plan-features": { columns: ["university", "essentials", "standard", "enterprise"], rows: [{ id: "branches", plans: { university: true, essentials: true, standard: true, enterprise: true } }] }
  });
  await page.goto("/download.html#pricing");
  await expect(standard(page)).toHaveText("$800");
  const row = page.locator('tr[data-plan-feature="branches"] td');
  await expect(row.nth(1)).toHaveAttribute("data-yes", "");
  await page.locator('[data-billing-switch] button[data-billing="monthly"]').click();
  await expect(standard(page)).toHaveText("$960");
});

test("the plan table scrolls inside its box on a phone, not the page", async ({ page }) => {
  await page.goto("/download.html#pricing");
  await expect(page.locator(".pricing-scroll")).toBeVisible();
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(w).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "Contact sales" }).first().click();
  await expect(page).toHaveURL(/\/contact-sales\.html$/);
});

/* Products the operator console shows on the website that the page has no place for. */
const NEW_PRODUCTS = [
  { id: "plant-package", name: "Plant package", kind: "one_time", period: "one_time", description: "A ready-made plant to start from.", usd: 990 },
  { id: "site-license", name: "Site license", kind: "license", period: "month", description: "Every engineer on one site.", usd: 50, usdMonthly: 60 }
];
const more = (page) => page.getByRole("region", { name: "Also on the price list" });

test("a product shown on the website that the page has no place for is listed with its price, in the chosen currency and billing", async ({ page }) => {
  await mockApi(page, { "GET /api/site/prices": sitePrices(NEW_PRODUCTS) });
  await page.goto("/download.html#pricing");
  await expect(standard(page)).toHaveText("$800");
  await expect(more(page)).toBeVisible();
  const pkg = more(page).getByRole("article", { name: "Plant package" });
  const site = more(page).getByRole("article", { name: "Site license" });
  await expect(pkg).toContainText("A ready-made plant to start from.");
  await expect(pkg.locator(".price")).toHaveText("$990");
  await expect(pkg).toContainText("One-time");
  await expect(site.locator(".price")).toHaveText("$50");
  await expect(site).toContainText("Per user / month, billed yearly");
  // Products the page already shows are not listed twice.
  await expect(more(page).getByRole("article")).toHaveCount(2);
  await expect(page.locator('#pricing [data-product="editor"]')).toHaveCount(1);

  // Another currency, then billed monthly.
  await page.locator('[data-currency-switch] button[data-cur="EUR"]').click();
  await expect(pkg.locator(".price")).toHaveText(new RegExp(digits(nice(990 * toCur.EUR))));
  await expect(pkg.locator(".price")).toContainText("€");
  await page.locator('[data-billing-switch] button[data-billing="monthly"]').click();
  await expect(site.locator(".price")).toHaveText(new RegExp(digits(nice(60 * toCur.EUR))));
  await expect(site).toContainText("Per user / month, billed monthly");
  await expect(pkg.locator(".price")).toHaveText(new RegExp(digits(nice(990 * toCur.EUR))));

  // Kept after a reload; nothing wider than the screen on a phone.
  await page.reload();
  await expect(site.locator(".price")).toHaveText(new RegExp(digits(nice(60 * toCur.EUR))));
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(w).toBeLessThanOrEqual(1);
});

test("without the server, or with only the page's own products, nothing is added to the price list", async ({ page }) => {
  await page.goto("/download.html#pricing");
  await expect(standard(page)).toHaveText("$795");
  await expect(page.locator("[data-more-products]")).toBeHidden();
  await mockApi(page, { "GET /api/site/prices": sitePrices() });
  await page.reload();
  await expect(standard(page)).toHaveText("$800");
  await expect(page.locator("[data-more-products]")).toBeHidden();
  await expect(more(page)).toHaveCount(0);
});

test("a German visitor sees a new product in euros, with the page's words in German", async ({ page }) => {
  await mockApi(page, { "GET /api/site/prices": sitePrices(NEW_PRODUCTS) });
  await page.goto("/de/download.html#pricing");
  const list = page.locator("[data-more-products]");
  await expect(list).toBeVisible();
  await expect(list.getByRole("article", { name: "Plant package" }).locator(".price")).toContainText("€");
  await expect(list.getByRole("heading", { name: "Ebenfalls in der Preisliste" })).toBeVisible();
  await expect(list.getByRole("article", { name: "Plant package" })).toContainText("Einmalig");
});
