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

test("PRJ-tree-rows, PRJ-rename, COL-history: a double-click on a project opens its page, as one click does; its History has Undo this change", async ({ page }) => {
  await page.goto("/guide-projects.html#prj-tree-rows");
  const rows = page.locator('[id="prj-tree-rows"]');
  const project = rows.getByRole("row").filter({ has: page.getByRole("cell", { name: "Project", exact: true }) });
  await expect(project).toContainText("Its page, the same as one click, with Members and Export at the top");
  await expect(rows).not.toContainText("Its data sheet");
  const rename = page.locator('[id="prj-rename"]');
  await expect(rename).toContainText("or click the project and edit its name on its page");
  await expect(rename).not.toContainText("data sheet");
  await page.goto("/guide-collaboration.html#col-history");
  await expect(page.locator('[id="col-history"]')).toContainText("A project's page has a History tab too: every change in the project, each with what it changed and Undo this change.");
});

test("GS-getting-started: Steps for names every answer, and what each of the three newest gives", async ({ page }) => {
  await page.goto("/guide-getting-started.html#gs-getting-started");
  const part = page.locator("#gs-getting-started");
  await expectScrolledTo(part);
  const row = part.locator("tr", { hasText: "Steps for:" });
  await expect(row).toContainText("Process engineering, Instrumentation and control, Electrical, Maintenance and modifications, I manage engineers, I administer E1 or Just looking");
  await expect(row).toContainText("Maintenance and modifications gives the steps on branches, reviews, tasks and an object’s history");
  await expect(row).toContainText("I manage engineers those on progress, the deliverable set, signing off a revision and the Inbox");
  await expect(row).toContainText("I administer E1 those on a new project, Project settings, Configuration, an attribute of your own, roles and your account");
  await expect(row).toContainText("the five of Just looking before you choose");
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

test("DRAW-place-symbol, DRAW-arrange, DRAW-symbol-menu: one click for a valve, R and F on the ghost, sliding along the pipe, standard sizes, one Flip", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-place-symbol");
  const place = page.locator("#draw-place-symbol");
  await expectScrolledTo(place);
  // One click for a valve, an instrument or a fitting; two for equipment; the ghost turned and flipped first.
  await expect(place.locator(".g-summary")).toContainText("A valve, an instrument or a fitting is placed with one click, at its standard size; equipment takes two clicks");
  await expect(place).toContainText("Click to place it; on a line it goes into the line. R turns it and F flips it before the click.");
  await expect(place).toContainText("Click to set the inlet, then the outlet; on a line it goes into the line. F flips it before the click.");
  await expect(place).toContainText("The pipe lights up, and the ghost of the valve already lies along it");
  await expect(place).toContainText("The next valve is placed with that one click");
  await expect(place).toContainText("strainers and in-line filters, steam traps, rupture discs, flame arrestors and sight glasses");
  await expect(place).toContainText("The ghost turns a quarter turn clockwise each time you press R");
  await expect(place).toContainText("the second pump is placed mirrored");
  await expect(place).not.toContainText("F flips the symbol.");
  // Sliding, Alt, sizes, the one Flip and the name.
  const arrange = page.locator("#draw-arrange");
  await expect(arrange).toContainText("It stays on its pipe and slides along it");
  await expect(arrange).toContainText("Drag it along its line; hold Alt to take it off the line.");
  await expect(arrange).toContainText("the pipe closes into one line again");
  await expect(arrange).toContainText("A pipe you shaped by hand keeps its bends, and both pipes keep their line numbers");
  await expect(arrange).toContainText("it steps to the next of its standard sizes");
  await expect(arrange).toContainText("Small, Standard, Large and Extra large");
  await expect(arrange).toContainText("dragging one resizes them all in one step");
  await expect(arrange).toContainText("exactly as right-click → Flip ▸ Horizontal does");
  await expect(arrange).toContainText("Shift+F does the same");
  await expect(arrange).toContainText("Its name stays upright");
  await expect(page.locator("#draw-symbol-menu .g-summary")).toContainText("Flip ▸, Rotate ▸, Size ▸, Shape ▸");
  // The three ways in stay linked: the film and E1.
  for (const section of [place, arrange]) {
    await expect(section.getByRole("link", { name: /Show me how in E1/ })).toHaveAttribute("href", /app\.lanxtor\.com\/\?guide=/);
    await expect(section.getByRole("link", { name: /Watch the lesson/ })).toBeVisible();
  }
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
  await expect(select).toContainText("the project's own pick list where it has one");
  await expect(labels).toContainText("A wire's number is typed over the same way");
  // E1 Reviewer draws the same: its guide says so and links back here.
  await page.goto("/guide-reviewer.html#ipad-sheets");
  const ipad = page.locator("#ipad-sheets");
  await expect(ipad).toContainText("a line has its type's marks");
  await expect(ipad).toContainText("joined to it by a thin leader");
  await ipad.getByRole("link", { name: "Line style, thickness and colour" }).click();
  await expectScrolledTo(page.locator("#draw-line-style"));
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
  await expect(steps.filter({ hasText: "with the hint" })).toContainText("the line is routed around what is in its way, as shown before the click");
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

test("DRAW-edit-line, DRAW-line-style: the grips of a line, Join lines, Break line, Straighten, Reset route and Line kind, with Watch the lesson and Show me how in E1", async ({ page }) => {
  const f = FEATURES.find((x) => x.id === "DRAW-edit-line");
  expect(f, "DRAW-edit-line is in the guides").toBeTruthy();
  await page.goto(`/${pageOf(f)}#${f.anchor}`);
  const part = page.locator("section#draw-edit-line");
  await expect(part).toBeVisible();
  await expectScrolledTo(part);
  await expect(part.getByRole("heading", { level: 2 })).toHaveText("Shape a line: bends, ends, join, break and straighten");
  const steps = part.locator("table.g-steps tbody tr");
  await expect(steps).toHaveCount(12);
  await expect(steps.filter({ hasText: "Shift-click its other segments" })).toContainText("a segment that is not selected has none");
  await expect(steps.filter({ hasText: "Drag a bend grip sideways" })).toContainText("the next bend slides with it");
  await expect(steps.filter({ hasText: "Remove bend" })).toContainText("The line itself is not deleted");
  await expect(steps.filter({ hasText: "where another pipe already ends" })).toContainText("already ends a pipe: a nozzle takes one pipe.");
  await expect(steps.filter({ hasText: "or onto empty 2D space" })).toContainText("the end is a free end at that place");
  for (const label of ["Break line", "Join lines", "Straighten", "Reset route"]) await expect(part.locator(".ui", { hasText: label }).first()).toBeVisible();
  await expect(steps.filter({ hasText: "Drag one of the valves the hand-shaped pipe ends on" })).toContainText("The pipe keeps the bends you gave it");
  await expect(part.locator(".g-learn").getByRole("link", { name: /^Watch the lesson: / })).toHaveAttribute("href", /^training\.html\?course=first-pid&lesson=[\w-]+$/);
  await expect(part.locator(".g-learn").getByRole("link", { name: /^Show me how in E1: / })).toHaveAttribute("href", "https://app.lanxtor.com/?guide=sheet-edit-line");

  // Related → Line style, where Line kind is told.
  await part.locator(".g-related").getByRole("link", { name: "Line style, thickness and colour" }).click();
  const style = page.locator("section#draw-line-style");
  await expectScrolledTo(style);
  await expect(style.locator("table.g-steps tbody tr").filter({ hasText: "Line kind" })).toContainText("becomes a line of that kind");

  await expect(style.locator("table.g-steps tbody tr").filter({ hasText: "Line kind" })).toContainText("beside the heading Line");
  await expect(page.locator("section#draw-arrange")).toContainText("shows only its title, so it does not lie over the drawing");

  // The catalog lists it.
  await page.goto("/guide-features.html");
  await expect(page.locator("body")).toContainText("Shape a line: bends, ends, join, break and straighten");
});

test("DRAW-command-search, DRAW-quick-swap, DRAW-clipboard, GS-shortcuts: the tool keys, Ctrl+K, paste at the pointer and Swap symbol are in the guide, each with its lesson and Show me how in E1", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-command-search");
  const search = page.locator("#draw-command-search");
  await expectScrolledTo(search);
  await expect(search.getByRole("heading", { level: 2 })).toHaveText("Tool keys and the command search (Ctrl+K)");
  for (const [key, tool] of [["P", "Flow lines"], ["L", "Logic"], ["C", "Cable"], ["W", "Wire"], ["T", "Text"], ["G", "Tag"], ["A", "Add…"], ["B", "Frame"]]) {
    await expect(search.locator("tr", { has: page.locator("kbd", { hasText: new RegExp(`^${key}$`) }) }).filter({ hasText: tool }), `${key} is ${tool}`).toHaveCount(1);
  }
  await expect(search).toContainText("Everything is listed before you type");
  await expect(search).toContainText("Search symbols and commands…");
  await expect(search).toContainText("Select something on the drawing first.");
  await expect(search.getByRole("link", { name: /Watch the lesson/ })).toBeVisible();
  await expect(search.getByRole("link", { name: /Show me how in E1/ })).toHaveAttribute("href", /\?guide=sheet-keys-search$/);
  // The contents list of the page jumps to both new parts.
  await page.locator('a[href="#draw-quick-swap"]').first().click();
  const swap = page.locator("#draw-quick-swap");
  await expectScrolledTo(swap);
  await expect(swap.getByRole("heading", { level: 2 })).toHaveText("Swap a symbol for another of its class");
  await expect(swap).toContainText("Globe valve, Ball valve and the other valves, all shown at once");
  await expect(swap).toContainText("Both pipes are still connected; its name and tag have not changed");
  await expect(swap.getByRole("link", { name: /Show me how in E1/ })).toHaveAttribute("href", /\?guide=sheet-quick-swap$/);
  await expect(swap.getByRole("link", { name: /Watch the lesson/ })).toBeVisible();
  const clipboard = page.locator("#draw-clipboard");
  await expect(clipboard).toContainText("The copies land with their middle under the pointer, and the pipe between them is copied with them");
  await expect(clipboard).toContainText("The copy lands where you right-clicked");
  await expect(page.locator("#draw-symbol-menu")).toContainText("Search symbols and commands…");
  // The shortcuts list has the keys, and its link opens the new part.
  await page.goto("/guide-getting-started.html#gs-shortcuts");
  const keys = page.locator("#gs-shortcuts");
  await expect(keys.locator("tr", { hasText: "Draw Flow lines, Logic, Cable or Wire" })).toContainText("P, L, C, W");
  await expect(keys.locator("tr", { hasText: "Search symbols and commands on the drawing" })).toContainText("Ctrl+K");
  await keys.getByRole("link", { name: "Tool keys and the command search" }).click();
  await expect(page).toHaveURL(/guide-drawing\.html#draw-command-search$/);
  // Both are found in All features.
  await page.goto("/guide-features.html");
  await page.getByRole("searchbox").first().fill("Swap a symbol");
  await expect(page.locator("main").getByRole("link", { name: /Swap a symbol for another of its class/ }).first()).toBeVisible();
});

/*
 * Documents around the P&ID (E1, 2026-11-20): the standard lists of every
 * project, holds on the drawing and the legend sheet. Each opens from its
 * address (the E1 Guide's Read more), shows its steps with the labels as on
 * screen, and has Watch the lesson and Show me how in E1.
 */
const PID_DOCUMENTS = [
  { id: "LIST-standard-lists", lesson: "list-standard-lists", says: ["Line list", "Valve list", "Equipment list", "Instrument index", "Hold list", "Excel (.xlsx)", "Saved query"] },
  { id: "WF-hold-cloud", lesson: "wf-hold-cloud", says: ["Put on hold…", "Edit hold…", "Close hold", "HOLD H1", "Hold list", "Open holds", "Closed holds", "All holds", "never used again", "Export PDF", "Open PDF", "Hold clouds", "Show holds"] },
  { id: "DOC-legend-sheet", lesson: "doc-legend-sheet", says: ["Legend sheet", "Refresh", "Export PDF", "Symbols in use", "Line types in use", "Tag letters in use", "ISO 10628-2"] },
];
for (const { id, lesson, says } of PID_DOCUMENTS) {
  test(`${id}: opens from its address with its steps, Watch the lesson and Show me how in E1`, async ({ page }) => {
    const f = FEATURES.find((x) => x.id === id);
    expect(f, `${id} is in the guides`).toBeTruthy();
    expect(f.status).toBe("available");
    await page.goto(`/${pageOf(f)}#${f.anchor}`);
    const part = page.locator(`[id="${f.anchor}"]`);
    await expect(part).toBeVisible();
    await expectScrolledTo(part);
    await expect(part.getByRole("heading", { level: 2 })).toHaveText(f.title);
    await expect(part.locator(".g-status")).toHaveText("Available");
    for (const text of says) await expect(part, `${id} says ${text}`).toContainText(text);
    expect(await part.locator("table.g-steps tbody tr").count()).toBeGreaterThanOrEqual(6);
    await expect(part.getByRole("link", { name: /^Watch the lesson/ })).toHaveAttribute("href", /training\.html\?course=/);
    await expect(part.getByRole("link", { name: /^Show me how in E1/ })).toHaveAttribute("href", `https://app.lanxtor.com/?guide=${lesson}`);
    /* Every Related link leads to a part that exists. */
    for (const link of await part.locator(".g-related a").all()) {
      const href = await link.getAttribute("href");
      const [file, anchor] = href.startsWith("#") ? [pageOf(f), href.slice(1)] : href.split("#");
      const html = await (await page.request.get("/" + file)).text();
      expect(html, `${id}: ${href}`).toContain(`id="${anchor}"`);
    }
  });
}

test("the catalog finds the new features: hold cloud, legend sheet, standard lists", async ({ page }) => {
  await page.goto("/guide-features.html");
  for (const [words, id] of [["hold cloud", "WF-hold-cloud"], ["legend sheet", "DOC-legend-sheet"], ["standard lists", "LIST-standard-lists"]]) {
    const f = FEATURES.find((x) => x.id === id);
    await page.getByRole("searchbox").first().fill(words);
    await expect(page.locator(`a[href="${f.page}"]`).first()).toBeVisible();
  }
});

/*
 * A screenshot that declares another shape than its file makes the page jump
 * when it loads: a link to a part further down (the E1 Guide's Read more,
 * guide-documents.html#doc-legend-sheet) then lands above or below its part.
 */
test("every guide screenshot declares the shape of its file, so the page does not jump when it loads", async ({ request }) => {
  const fs = await import("node:fs");
  const shapeOf = (file) => {
    const b = fs.readFileSync(file);
    const kind = b.toString("latin1", 12, 16);
    if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
    if (kind === "VP8L") { const bits = b.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
    return null;
  };
  const wrong = [];
  let seen = 0;
  for (const c of DATA.categories) {
    const html = await (await request.get("/" + c.page)).text();
    for (const m of html.matchAll(/<img src="(assets\/img\/guides\/[^"]+\.webp)"[^>]*?width="(\d+)" height="(\d+)"/g)) {
      const real = shapeOf(new URL(`../../${m[1]}`, import.meta.url));
      if (!real) continue;
      seen += 1;
      const declared = Number(m[2]) / Number(m[3]);
      if (Math.abs(real[0] / real[1] - declared) / (real[0] / real[1]) > 0.02) wrong.push(`${c.page}: ${m[1]} says ${m[2]}×${m[3]}, is ${real[0]}×${real[1]}`);
    }
  }
  expect(seen).toBeGreaterThan(50);
  expect(wrong).toEqual([]);
});
