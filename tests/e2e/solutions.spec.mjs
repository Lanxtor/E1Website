/*
 * Solutions: the feature catalog on Solutions (search, category filters,
 * Clear filters, the empty state) and the questions on every solution page
 * (each opens and closes).
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, ROOT } from "./fixtures.mjs";

const shown = (page) => page.locator("[data-catalog-list] .catalog-item:not(.is-hidden)");

test("Solutions: a category shows only its features, a search narrows it, nothing found offers Clear filters", async ({ page }) => {
  await page.goto("/solutions.html");
  const all = await page.locator("[data-catalog-list] .catalog-item").count();
  expect(all).toBeGreaterThan(10);
  await expect(shown(page)).toHaveCount(all);
  const filters = page.getByRole("group", { name: "Filter by category" });
  await expect(filters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

  // A category: only its features, the chip pressed.
  await filters.getByRole("button", { name: "Collaboration" }).click();
  await expect(filters.getByRole("button", { name: "Collaboration" })).toHaveAttribute("aria-pressed", "true");
  await expect(filters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  await expect(shown(page)).toHaveCount(5);
  for (const item of await shown(page).all()) expect(await item.getAttribute("data-category")).toContain("collaboration");

  // Typed: within the category.
  const search = page.getByRole("searchbox", { name: "Search features" });
  await search.fill("branch");
  await expect(shown(page).first()).toBeVisible();
  for (const item of await shown(page).all()) expect((await item.getAttribute("data-category")) || "").toContain("collaboration");
  expect(await shown(page).count()).toBeLessThan(5);

  // Nothing matches: the empty state, and Clear filters brings everything back.
  await search.fill("zzz-no-such-feature");
  await expect(page.getByRole("heading", { name: "No features match." })).toBeVisible();
  await expect(page.locator("[data-catalog-list]")).toBeHidden();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(filters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  await expect(shown(page)).toHaveCount(all);
  await expect(page.getByRole("heading", { name: "No features match." })).toBeHidden();

  // A search across all categories, and the search box's own clear (Escape).
  await search.fill("loop");
  await expect(shown(page).first()).toBeVisible();
  expect(await shown(page).count()).toBeLessThan(all);
  await search.press("Escape");
  await expect(shown(page)).toHaveCount(all);
});

const SOLUTION_PAGES = fs.readdirSync(ROOT).filter((f) => /^solution-.*\.html$/.test(f)).sort();

for (const file of SOLUTION_PAGES) {
  test(`${file}: every question opens and closes`, async ({ page }) => {
    await page.goto(`/${file}`);
    const questions = page.locator("main details");
    const n = await questions.count();
    expect(n, "questions on the page").toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const q = questions.nth(i);
      await q.locator("summary").click();
      await expect(q).toHaveAttribute("open", "");
      await expect(q.locator("p").first()).toBeVisible();
      await q.locator("summary").click();
      await expect(q).not.toHaveAttribute("open", "");
    }
  });
}

test("every solution page is reached from the Solutions catalog", async ({ page }) => {
  await page.goto("/solutions.html");
  const hrefs = await page.locator("main a[href^='solution-']").evaluateAll((as) => as.map((a) => a.getAttribute("href").split(/[?#]/)[0]));
  for (const file of SOLUTION_PAGES) expect(hrefs, file).toContain(file);
  expect(fs.existsSync(path.join(ROOT, SOLUTION_PAGES[0]))).toBe(true);
});
