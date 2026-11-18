/*
 * WEB-user-guides: the user guide (guide.html), a page per category
 * (guide-*.html), the catalog of every feature with its search and filters
 * (guide-features.html) and the roadmap (guide-roadmap.html). The E1 Guide
 * in the app links to each feature by its anchor, so every anchor must exist.
 */
import { test, expect, readJson, expectScrolledTo } from "./fixtures.mjs";

const DATA = readJson("assets/data/user-guide-features.json");
const FEATURES = DATA.features;
/* A feature's page, without the #anchor its address carries. */
const pageOf = (f) => f.page.split("#")[0];

/* The features this suite was asked to cover, opened by their anchors. */
const WEBSITE = ["WEB-account-page", "WEB-overview", "WEB-licenses", "WEB-usage", "WEB-organizations", "WEB-projects", "WEB-permissions",
  "WEB-download", "WEB-cloud-specs", "WEB-pricing", "WEB-academy", "WEB-course-player", "WEB-certificates", "WEB-certificate-page",
  "WEB-user-guides", "WEB-academy-public", "WEB-assistant", "WEB-languages", "ACC-browser", "ACC-desktop-app", "ACC-desktop-updates"];

test("every feature's anchor is on its guide page (the E1 Guide's links)", async ({ request }) => {
  const pages = new Map();
  const missing = [];
  for (const f of FEATURES) {
    const p = pageOf(f);
    if (!pages.has(p)) pages.set(p, await (await request.get("/" + p)).text());
    if (!new RegExp(`id="${f.anchor}"`).test(pages.get(p))) missing.push(`${f.id} → ${p}#${f.anchor}`);
    if (f.page.includes("#") && f.page !== `${p}#${f.anchor}`) missing.push(`${f.id}: page ${f.page} and anchor ${f.anchor} differ`);
  }
  expect(missing).toEqual([]);
});

for (const id of WEBSITE) {
  test(`${id}: its part of the guide opens from its address`, async ({ page }) => {
    const f = FEATURES.find((x) => x.id === id);
    expect(f, `${id} is in the guides`).toBeTruthy();
    await page.goto(`/${pageOf(f)}#${f.anchor}`);
    const part = page.locator(`[id="${f.anchor}"]`);
    await expect(part).toBeVisible();
    await expectScrolledTo(part);
    await expect(part).toContainText(f.title);
  });
}

test("the user guide lists every category and each opens its page", async ({ page }) => {
  await page.goto("/guide.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E1 user guide");
  for (const c of DATA.categories) await expect(page.locator(`main a[href="${c.page}"]`).first()).toBeAttached();
  const c = DATA.categories.find((x) => x.id === "account");
  await page.locator(`main a[href="${c.page}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(c.page.replace(".", "\\.") + "$"));
  await expect(page.locator("h1").first()).toBeVisible();
});

test("a guide page's contents list jumps to each part", async ({ page }) => {
  await page.goto("/guide-account.html");
  for (const anchor of ["web-usage", "web-assistant", "web-languages"]) {
    await page.locator(`main a[href="#${anchor}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
    await expectScrolledTo(page.locator(`#${anchor}`));
  }
});

test("All features: search, category and status filters, with the count", async ({ page }) => {
  await page.goto("/guide-features.html");
  const rows = page.locator("[data-guide-catalog] tbody tr");
  const visible = page.locator("[data-guide-catalog] tbody tr:not([hidden])");
  const count = page.locator("[data-guide-count]");
  await expect(count).toHaveText(`${FEATURES.length} features`);
  await expect(rows).toHaveCount(FEATURES.length);

  await page.getByRole("searchbox", { name: "Search features" }).fill("certificate");
  const n = await visible.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(FEATURES.length);
  await expect(count).toHaveText(`${n} feature${n === 1 ? "" : "s"}`);
  for (const t of await visible.allTextContents()) expect(t.toLowerCase()).toContain("certificate");

  await page.getByRole("searchbox", { name: "Search features" }).fill("");
  await page.getByRole("combobox", { name: "Category" }).selectOption("account");
  const inAccount = FEATURES.filter((f) => f.category === "account").length;
  await expect(visible).toHaveCount(inAccount);
  await page.getByRole("combobox", { name: "Status" }).selectOption("available");
  await expect(visible).toHaveCount(FEATURES.filter((f) => f.category === "account" && f.status === "available").length);

  await page.getByRole("searchbox", { name: "Search features" }).fill("zzzz-nothing");
  await expect(count).toHaveText("0 features");

  // A feature row opens its part of the guide.
  await page.getByRole("searchbox", { name: "Search features" }).fill("");
  await page.getByRole("combobox", { name: "Status" }).selectOption("");
  await page.getByRole("searchbox", { name: "Search features" }).fill("WEB-assistant");
  await expect(visible).toHaveCount(1);
  await visible.getByRole("link", { name: "Alex on the website: ask and follow the suggestions" }).click();
  await expect(page).toHaveURL(/guide-account\.html#web-assistant$/);
  await expectScrolledTo(page.locator("#web-assistant"));
});

test("All features opens preset from its address (?status=planned)", async ({ page }) => {
  await page.goto("/guide-features.html?status=planned");
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("planned");
  await expect(page.locator("[data-guide-catalog] tbody tr:not([hidden])")).toHaveCount(FEATURES.filter((f) => f.status === "planned").length);
});

test("the roadmap page lists the stages and is linked from the user guide", async ({ page }) => {
  await page.goto("/guide.html");
  await page.locator('main a[href="guide-roadmap.html"]').first().click();
  await expect(page).toHaveURL(/guide-roadmap\.html$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Under development and roadmap");
  expect(await page.locator("main h2").count()).toBeGreaterThan(5);
  // Every milestone of the app's roadmap has its heading.
  const headings = (await page.locator("main h2").allTextContents()).join("\n");
  for (const m of readJson("tools/guides/roadmap.json").app.milestones) expect(headings).toContain(m.title.replace(/&/g, "&"));
});

test("User guide in the footer opens the guide", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator(".site-footer a", { hasText: "User guide" }).click();
  await expect(page).toHaveURL(/\/guide\.html$/);
});
