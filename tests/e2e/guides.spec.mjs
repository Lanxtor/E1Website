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

test("GS-units: the unit system is chosen in Project settings; the status bar has no unit chip", async ({ page }) => {
  await page.goto("/guide-getting-started.html#gs-units");
  const part = page.locator("#gs-units");
  await expectScrolledTo(part);
  await expect(part.locator("dl")).toContainText("Settings → Project settings → Units");
  await expect(part).not.toContainText("status bar");
  const bar = page.locator("#gs-status-bar");
  await expect(bar).not.toContainText(/unit/i);
  await expect(bar.locator("img")).toHaveAttribute("alt", /appearance switch/);
});

test("DRAW-select, DRAW-pipelines, DRAW-symbol-menu: a double-click on a line opens its window; Show in tree takes its pipe run", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-select");
  const select = page.locator("#draw-select");
  await expectScrolledTo(select);
  await expect(select).toContainText("Double-click a pipe, selected or not.");
  await expect(select).toContainText("Its window opens on Attributes");
  await expect(select).toContainText("Shift and double-click adds its whole run");
  const pipelines = page.locator("#draw-pipelines");
  await expect(pipelines).toContainText("once more, the line's window opens on Attributes");
  const menus = page.locator("#draw-symbol-menu");
  await expect(menus).toContainText("Show in tree selects the line's pipe run in the explorer, from any of its segments");
});

test("DRAW-place-symbol, DRAW-arrange, DRAW-clipboard: a symbol put on a pipe goes into it, placed, dragged or pasted", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-place-symbol");
  const place = page.locator("#draw-place-symbol");
  await expectScrolledTo(place);
  await expect(place).toContainText("or just beside it where the valve would cover it");
  await expect(place).toContainText("the part upstream runs into its inlet, the part downstream out of its outlet");
  await expect(place).toContainText("Two clicks across a pipe put the valve into the pipe the same way");
  const arrange = page.locator("#draw-arrange");
  await expect(arrange).toContainText("Drag a valve that is connected to nothing onto a pipe");
  await expect(arrange).toContainText("the pipe is split around it, connected on both sides");
  const clipboard = page.locator("#draw-clipboard");
  await expect(clipboard).toContainText("Drag the copy onto a pipe and it goes into the line, connected on both sides");
});

test("DRAW-line-style: the line types are listed with how each is drawn; the PDF and DEXPI export are named", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-line-style");
  const style = page.locator("#draw-line-style");
  await expectScrolledTo(style);
  await expect(style).toContainText("the signal lines of ISA-5.1, and heat-traced and jacketed pipes");
  await expect(style).toContainText("choose Pneumatic signal");
  await expect(style.getByRole("heading", { name: "The line types" })).toBeVisible();
  const types = style.locator("table").nth(1).locator("tbody tr td:first-child");
  await expect(types).toHaveText(["Solid, Dashed", "Pneumatic signal", "Electric signal", "Capillary tube", "Hydraulic signal", "Electromagnetic or sonic signal",
    "Software or data link", "Mechanical link", "Undefined signal", "Heat-traced pipe", "Jacketed pipe"]);
  await expect(style).toContainText("The PDF and the DEXPI file draw the line with its marks.");
});

test("DRAW-tags-labels, DRAW-attribute-labels, DRAW-select: labels typed over, dragged with a leader and reset; attributes changed in the Selection panel", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-tags-labels");
  const labels = page.locator("#draw-tags-labels");
  await expectScrolledTo(labels);
  await expect(labels).toContainText("Double-click a pump's tag (or its name) on the drawing");
  await expect(labels).toContainText("one another object has is refused, with that object's name under the field");
  await expect(labels).toContainText("Double-click a line number and type a new one.");
  await expect(labels).toContainText("Far from its line a thin leader joins the number to the line");
  await expect(labels).toContainText("Reset label position");
  const values = page.locator("#draw-attribute-labels");
  await expect(values).toContainText("far from the pump a thin leader joins them");
  await expect(values).toContainText("Right-click the label → Reset label position.");
  const select = page.locator("#draw-select");
  await expect(select).toContainText("Click a value in that list, for example Material");
  await expect(select).toContainText("Service, Nominal size, Fluid, Pipe class");
  await expect(select).toContainText("Heat tracing opens a list with None, Electric, Steam, Hot water and Hot oil");
});
