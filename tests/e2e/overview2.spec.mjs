/*
 * Overview 2 (index.html, the home page): the overview page designed from the research.
 * A visitor reads the hero, watches the platform build again and again, plays and pauses a clip of E1, jumps through the Branches
 * clip by its chapters, switches the living diagram and Alex's modes (mouse
 * and arrow keys), and uses the on-this-page bar. With reduce motion or
 * Save-Data nothing starts by itself.
 */
import { test, expect } from "./fixtures.mjs";

const CLIPS = [
  "web-overview-legacy-import", "web-overview-one-model", "web-overview-branches",
  "web-overview-animate-pid", "web-overview-animate-circuit", "web-overview-alex",
  "web-overview-feed-to-wiring", "web-overview-checks-history", "web-overview-access-tasks"
];

const playing = (v) => v.evaluate((el) => !el.paused && el.readyState > 2);

test("Overview 2: one title and three pillars in the hero, and the platform builds again and again", async ({ page }) => {
  await page.goto("/index.html");
  const hero = page.locator(".o2-hero");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E1. The plant engineering platform.");
  await expect(hero.locator(".hero-pillars span")).toHaveText(["Single Source of Truth", "Cloud native", "AI native"]);
  // Nothing else between the pillars and the platform: no lead, buttons, facts or branch chip.
  await expect(hero.locator(".o2-lead, .o2-kicker, .o2-actions, .o2-facts, a, button")).toHaveCount(0);
  await expect(page.getByText("open branches")).toHaveCount(0);
  const twin = page.locator("[data-twin]");
  // Every engineer joins, the picture holds, and then it builds again from the start.
  await expect(twin.locator(".tw-who.is-on")).toHaveCount(5, { timeout: 45_000 });
  await expect(twin.locator(".tw-who.is-on")).toHaveCount(0, { timeout: 15_000 });
  await expect(twin.locator(".tw-who.is-on")).toHaveCount(5, { timeout: 45_000 });
});

test("Overview 2: a clip of E1 plays while on screen, and its Pause button stops it", async ({ page }) => {
  await page.goto("/index.html");
  const fig = page.locator("#import [data-clip]");
  await fig.scrollIntoViewIfNeeded();
  const video = fig.locator("video");
  await expect.poll(() => playing(video), { timeout: 15_000 }).toBe(true);
  const button = fig.getByRole("button", { name: /^Pause the clip/ });
  await button.click();
  await expect.poll(() => video.evaluate((el) => el.paused)).toBe(true);
  await expect(fig.getByRole("button", { name: /^Play the clip/ })).toHaveText("▶ Play");
  // Scrolled away and back, a clip the visitor paused stays paused.
  await page.locator("#secure").scrollIntoViewIfNeeded();
  await fig.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  expect(await video.evaluate((el) => el.paused)).toBe(true);
  await fig.getByRole("button", { name: /^Play the clip/ }).click();
  await expect.poll(() => playing(video), { timeout: 10_000 }).toBe(true);
});

test("Overview 2: the chapters of the Branches clip jump to their step", async ({ page }) => {
  await page.goto("/index.html#branches");
  const chapters = page.getByLabel("Chapters of the clip");
  const buttons = chapters.getByRole("button");
  await expect(buttons).toHaveCount(4);
  const third = buttons.nth(2);
  const t = Number(await third.getAttribute("data-t"));
  expect(t).toBeGreaterThan(0);
  await third.click();
  await expect(third).toHaveAttribute("aria-pressed", "true");
  const at = await page.locator("#clip-branches video").evaluate((v) => v.currentTime);
  expect(at).toBeGreaterThanOrEqual(t - 0.1);
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "false");
  await buttons.first().click();
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
});

test("Overview 2: the living diagram and Alex's modes switch by click and by arrow keys", async ({ page }) => {
  await page.goto("/index.html#living");
  const pid = page.getByRole("tab", { name: "P&ID" });
  const circuit = page.getByRole("tab", { name: "Single line diagram" });
  await expect(pid).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-pid")).toBeVisible();
  await circuit.click();
  await expect(page.locator("#panel-circuit")).toBeVisible();
  await expect(page.locator("#panel-pid")).toBeHidden();
  await expect.poll(() => playing(page.locator("#panel-circuit video")), { timeout: 15_000 }).toBe(true);
  await circuit.press("ArrowLeft");
  await expect(pid).toBeFocused();
  await expect(page.locator("#panel-pid")).toBeVisible();
  expect(await page.locator("#panel-circuit video").evaluate((v) => v.paused)).toBe(true);

  const modes = page.getByRole("tablist", { name: "Alex's modes" });
  await modes.scrollIntoViewIfNeeded();
  await modes.getByRole("tab", { name: "Agent" }).click();
  await expect(page.getByRole("heading", { name: "Agent: does the work." })).toBeVisible();
  await expect(page.getByText("✕ Not moved: the arrangement is protected")).toBeVisible();
  await modes.getByRole("tab", { name: "Agent" }).press("ArrowRight");
  await expect(page.getByRole("heading", { name: "Plan: thinks it through." })).toBeVisible();
  await modes.getByRole("tab", { name: "Plan" }).press("Home");
  await expect(page.getByRole("heading", { name: "Ask: instant answers." })).toBeVisible();
});

test("Overview 2: the on-this-page bar takes the visitor to a section and marks it", async ({ page }) => {
  await page.goto("/index.html");
  const bar = page.getByRole("navigation", { name: "On this page" });
  await expect(bar.getByRole("link")).toHaveCount(10);
  await bar.getByRole("link", { name: "FEED to wiring" }).click();
  await expect(page).toHaveURL(/#wiring$/);
  await expect(page.getByRole("heading", { name: "One instrument, from the P&ID to the terminal." })).toBeInViewport();
  await expect(bar.getByRole("link", { name: "FEED to wiring" })).toHaveAttribute("aria-current", "true");
  await bar.getByRole("link", { name: "Ownership and tasks" }).click();
  await expect(page.getByRole("heading", { name: "Every object has an owner. Every question gets an answer." })).toBeInViewport();
});

test("Overview 2: every clip, still and device screen is there, and nothing scrolls sideways", async ({ page, request }) => {
  await page.goto("/index.html");
  for (const name of CLIPS) {
    for (const ext of [".webm", ".web.mp4", ".poster.webp"]) {
      const res = await request.get(`/assets/clips/overview2/${name}${ext}`);
      expect(res.status(), `${name}${ext}`).toBe(200);
    }
    await expect(page.locator(`video[poster$="${name}.poster.webp"]`)).toHaveCount(1);
  }
  await expect(page.locator("img[src$='missing.svg']")).toHaveCount(0);
  for (const img of await page.locator("#mobile img, [data-twin] img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
});

test.describe("with reduce motion on", () => {
  test.use({ reducedMotion: "reduce" });
  test("Overview 2: the platform shows its end at once and no clip starts by itself", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("[data-twin] .tw-who.is-on")).toHaveCount(5);
    await page.waitForTimeout(8000);
    await expect(page.locator("[data-twin] .tw-who.is-on")).toHaveCount(5);
    const fig = page.locator("#import [data-clip]");
    await fig.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await fig.locator("video").evaluate((el) => el.paused)).toBe(true);
    // The still and its Play button are there; Play starts the clip.
    await fig.getByRole("button", { name: /^Play the clip/ }).click();
    await expect.poll(() => playing(fig.locator("video")), { timeout: 15_000 }).toBe(true);
    // The one-model views are all shown, not waiting for a reveal.
    await expect(page.locator(".o2-model")).not.toHaveClass(/is-wait/);
  });
});

test("Overview 2: with Save-Data on, clips show their still until the visitor presses Play", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
  });
  await page.goto("/index.html");
  const fig = page.locator("#wiring [data-clip]");
  await fig.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  expect(await fig.locator("video").evaluate((el) => el.paused)).toBe(true);
  await fig.getByRole("button", { name: /^Play the clip/ }).click();
  await expect.poll(() => playing(fig.locator("video")), { timeout: 15_000 }).toBe(true);
});
