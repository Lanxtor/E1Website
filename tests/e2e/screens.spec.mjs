/*
 * Other screen sizes than the two projects: a small phone (320 px wide), a
 * tablet in portrait and landscape, and a window that is made narrower and
 * wider while a page is open. No page may scroll sideways; the menu must
 * work at every width.
 */
import { test, expect, sitemapPaths, sideways } from "./fixtures.mjs";

/* English and German (the longest words) pages, plus the account and sign-in pages. */
const PAGES = sitemapPaths().filter((p) => !/^\/(fr|es|no)\//.test(p)).concat(["/login.html", "/account.html?demo=1", "/training.html?course=e1-fundamentals&demo=1", "/certificate.html?id=E1C-7KQ3-M9XP-2DWA&demo=1", "/guide-features.html"]);

const SIZES = [
  ["small phone", { width: 320, height: 568 }],
  ["tablet portrait", { width: 768, height: 1024 }]
];

for (const [name, viewport] of SIZES) {
  test.describe(name, () => {
    test.use({ viewport });
    test(`no page scrolls sideways (${viewport.width} px)`, async ({ page }) => {
      test.setTimeout(240_000);
      const wide = [];
      for (const p of PAGES) {
        await page.goto(p);
        await expect(page.locator(".site-header")).toBeVisible();
        const over = await sideways(page);
        if (over > 1) {
          const culprit = await page.evaluate(() => {
            const w = document.documentElement.clientWidth;
            const el = [...document.querySelectorAll("body *")].find((e) => {
              const r = e.getBoundingClientRect();
              return r.right > w + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("[class*=scroll], .cs-nav-track, .page-jump, pre, table");
            });
            return el ? el.tagName.toLowerCase() + "." + [...el.classList].join(".") : "?";
          });
          wide.push(`${p}: ${over}px (${culprit})`);
        }
      }
      expect(wide).toEqual([]);
    });
  });
}

test.describe("tablet landscape", () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test("the menu, Get E1 and the plans fit", async ({ page }) => {
    await page.goto("/download.html#pricing");
    expect(await sideways(page)).toBeLessThanOrEqual(1);
    const toggle = page.locator(".nav-toggle");
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator(".nav-links a", { hasText: "Solutions" })).toBeInViewport();
    } else {
      await expect(page.locator(".nav-links a", { hasText: "Solutions" })).toBeInViewport();
    }
    await expect(page.locator('[data-currency-switch] button[data-cur="EUR"]')).toBeVisible();
  });
});

test.describe("a window made narrower and wider", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("the header switches between the full menu and the hamburger, and both work", async ({ page }) => {
    await page.goto("/about.html");
    const toggle = page.locator(".nav-toggle");
    await expect(toggle).toBeHidden();
    await expect(page.locator(".nav-links a", { hasText: "Solutions" })).toBeInViewport();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toggle).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(1);
    await toggle.click();
    await expect(page.locator(".site-header .nav")).toHaveCSS("opacity", "1");
    await page.locator(".nav-links a", { hasText: "Solutions" }).click();
    await expect(page).toHaveURL(/\/solutions\.html$/);

    await toggle.click();
    await expect(page.locator(".site-header .nav")).toHaveCSS("opacity", "1");
    // Wider again with the menu open: the full menu shows, nothing covers the page.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(toggle).toBeHidden();
    await expect(page.locator(".nav-links a", { hasText: "About us" })).toBeInViewport();
    await page.locator(".nav-links a", { hasText: "About us" }).click();
    await expect(page).toHaveURL(/\/about\.html$/);
  });

  test("the Alex panel follows the window from wide to narrow", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(".alex-launcher").click();
    const panel = page.locator(".alex-panel");
    await expect(panel).toBeVisible();
    await page.setViewportSize({ width: 360, height: 700 });
    await expect.poll(async () => {
      const b = await panel.boundingBox();
      return b.x >= 0 && b.x + b.width <= 361;
    }).toBe(true);
    await expect(panel.locator("textarea")).toBeInViewport();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel.locator("textarea")).toBeInViewport();
  });
});
