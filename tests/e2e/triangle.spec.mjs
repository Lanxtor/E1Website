/*
 * The triangle (owner, 2026-11-19): the E1 Guide in the app, the user guides
 * and the Academy's films are always linked to each other, so a person can
 * read, watch, or be shown in E1, whichever they prefer.
 *
 * - User guide → film and E1: every taught feature has "Watch the lesson" (to
 *   the course player at its lesson) and "Show me how in E1" (E1 at its E1
 *   Guide lesson, ?guide=…).
 * - Film → user guide and E1: under the video, Overview has "Read more: …" for
 *   each feature of the lesson and "Show me how in E1".
 * - E1 → user guide and film: Lanxtor/E1 tests/e2e/web/guideAcademyLinks.spec.mjs.
 */
import { test, expect } from "./fixtures.mjs";

test("a feature of the user guide links to its Academy lesson and to E1's Show me how", async ({ page }) => {
  await page.goto("/guide-drawing.html#draw-sheet-view");
  const section = page.locator("section#draw-sheet-view");
  const learn = section.locator(".g-learn");
  await expect(learn).toBeVisible();
  const watch = learn.getByRole("link", { name: /^Watch the lesson: / });
  await expect(watch).toHaveAttribute("href", "training.html?course=first-pid&lesson=first-pid-01");
  const show = learn.getByRole("link", { name: /^Show me how in E1: / });
  await expect(show).toHaveAttribute("href", /^https:\/\/app\.lanxtor\.com\/\?guide=[\w-]+$/);
  await expect(show).toHaveAttribute("target", "_blank");
  // Watch the lesson opens the course player at that lesson.
  await page.goto("/training.html?course=first-pid&lesson=first-pid-01&demo=1");
  await expect(page.locator("[data-lesson] h2")).toHaveText("Finding your way around a 2D space · A tour of the drawing's bar and palette");
});

test("every available feature that a lesson films has Watch the lesson in the user guide", async ({ page }) => {
  await page.goto("/academy.html");
  const taught = await page.evaluate(() => window.E1_SYLLABUS.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.flatMap((l) => l.features.map((f) => ({ page: f.page, lesson: l.id }))))));
  expect(taught.length).toBeGreaterThan(400);
  const byPage = {};
  for (const t of taught) (byPage[t.page.split("#")[0]] ||= []).push(t);
  const missing = [];
  for (const [file, items] of Object.entries(byPage)) {
    const html = await (await page.request.get("/" + file)).text();
    for (const t of items) {
      const anchor = t.page.split("#")[1];
      const at = html.indexOf(`id="${anchor}"`);
      const end = html.indexOf("</section>", at);
      if (at < 0 || !html.slice(at, end).includes(`lesson=${t.lesson}"`)) missing.push(t.page);
    }
  }
  expect(missing).toEqual([]);
});

test("a lesson in the course player links to the user guide and to E1's Show me how", async ({ page }) => {
  await page.goto("/training.html?course=getting-started&lesson=getting-started-06&demo=1");
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.getByRole("heading", { name: "Read more, or let E1 show you" })).toBeVisible();
  const read = lesson.getByRole("link", { name: "Read more in the user guide: The E1 window" });
  await expect(read).toHaveAttribute("href", "guide-getting-started.html#gs-layout");
  const show = lesson.locator(".lesson-guide li", { hasText: "Read more: The E1 window" }).getByRole("link", { name: "Show me how in E1" });
  await expect(show).toHaveAttribute("href", "https://app.lanxtor.com/?guide=window-tour");
  await expect(show).toHaveAttribute("target", "_blank");
});
