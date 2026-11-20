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

test("DRAW-connector: the guide tells that the Connector routes the line, shows it first and is one step to undo", async ({ page }) => {
  const f = FEATURES.find((x) => x.id === "DRAW-connector");
  await page.goto(`/${pageOf(f)}#${f.anchor}`);
  const part = page.locator(`[id="${f.anchor}"]`);
  await expect(part).toBeVisible();
  await expectScrolledTo(part);
  const steps = part.locator("table.g-steps tbody tr");
  await expect(steps.filter({ hasText: "the route that will be drawn is shown" })).toHaveCount(1);
  await expect(steps.filter({ hasText: "around the symbol and the lines in its way" })).toHaveCount(1);
  await expect(steps.filter({ hasText: "Click a nozzle, then click another nozzle" })).toContainText("The same routed pipe as a drag draws");
  await expect(steps.filter({ hasText: "press Ctrl+Z once" })).toContainText("The whole line is gone");
  /* The catalog finds it by what it now does. */
  await page.goto("/guide-features.html");
  await expect(page.locator("body")).toContainText("routed around what is in the way");
});

test("DRAW-live-checks, DRAW-layout-check: what is marked while drawing with its fix, and the layout warnings, each with Watch the lesson and Show me how in E1", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-live-checks");
  const live = page.locator("section#draw-live-checks");
  await expectScrolledTo(live);
  await expect(live.getByRole("heading", { level: 2 })).toHaveText("Checks while drawing");
  await expect(live).toContainText("This pipe ends in the open. Connect it to a nozzle or another pipe, or end it at an off-page connector.");
  for (const fix of ["Delete the open pipe", "Flip the flow of the chain", "Use DN 80 on both", "Rename to P-102", "Connect to off-page connector…"]) await expect(live).toContainText(fix);
  await expect(live).toContainText("At a tee: a branch in another pipe class than its header");
  await expect(live.locator(".g-learn").getByRole("link", { name: /^Watch the lesson: / })).toHaveAttribute("href", /^training\.html\?course=process-design&lesson=[\w-]+$/);
  await expect(live.locator(".g-learn").getByRole("link", { name: /^Show me how in E1: / })).toHaveAttribute("href", "https://app.lanxtor.com/?guide=sheet-live-checks");

  // Related → Layout check, on the same page.
  await live.locator(".g-related").getByRole("link", { name: "Layout check" }).click();
  const layout = page.locator("section#draw-layout-check");
  await expectScrolledTo(layout);
  await expect(layout.getByRole("heading", { level: 2 })).toHaveText("Layout check");
  await expect(layout).toContainText("PID-1 has 4 major equipment items, more than 3");
  await expect(layout).toContainText("Major equipment on a 2D space");
  await expect(layout).toContainText("The main flow on PID-1 runs right to left. Draw the process from left to right.");
  await expect(layout).toContainText("incoming connectors belong on the left edge");
  await expect(layout.locator(".g-learn").getByRole("link", { name: /^Show me how in E1: / })).toHaveAttribute("href", "https://app.lanxtor.com/?guide=sheet-piping-check");

  // Check piping names both.
  const check = page.locator("section#draw-piping-check");
  await expect(check.locator(".g-related").getByRole("link", { name: "Checks while drawing" })).toHaveAttribute("href", /#draw-live-checks$/);
  await expect(check).not.toContainText("as markers on the drawing");
});
