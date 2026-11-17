/*
 * WEB-languages: the website in English, German, French, Spanish and
 * Norwegian. The language menu in the header (inside the menu on a phone)
 * opens the same page in the chosen language, the choice is remembered, and
 * a first visit follows the browser's language.
 */
import { test, expect, openMenu } from "./fixtures.mjs";

const HERO = {
  en: "Plant engineering, at the speed of thought.",
  de: "Anlagenplanung in Gedankenschnelle.",
  fr: "L'ingénierie d'installations, à la vitesse de la pensée.",
  es: "Ingeniería de plantas, a la velocidad del pensamiento.",
  no: "Anleggsprosjektering i tankens hastighet."
};
const NAMES = { en: "English", de: "Deutsch", fr: "Français", es: "Español", no: "Norsk" };

async function pick(page, testInfo, code) {
  await openMenu(page, testInfo);
  const toggle = page.locator(".lang-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.locator(`.lang-menu a[data-lang-pick="${code}"]`).click();
}

for (const code of ["de", "fr", "es", "no"]) {
  test(`switch to ${NAMES[code]} and back to English, remembered after reload`, async ({ page }, testInfo) => {
    await page.goto("/solutions.html");
    await pick(page, testInfo, code);
    await expect(page).toHaveURL(new RegExp(`/${code}/solutions\\.html$`));
    await expect(page.locator("html")).toHaveAttribute("lang", code === "no" ? /^(no|nb)/ : new RegExp("^" + code));
    await expect(page.locator(".lang-toggle span")).toHaveText(code.toUpperCase());

    // Remembered: the English page now sends the visitor to the chosen language.
    await page.goto("/index.html");
    await expect(page).toHaveURL(new RegExp(`/${code}/index\\.html$`));
    await expect(page.locator("h1").first()).toHaveText(HERO[code]);
    await page.reload();
    await expect(page.locator("h1").first()).toHaveText(HERO[code]);

    // The header's links stay in the language.
    await openMenu(page, testInfo);
    await expect(page.locator(".nav-links a", { hasText: /./ }).first()).toHaveAttribute("href", new RegExp(`^${code}/`));

    await pick(page, testInfo, "en");
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page).not.toHaveURL(new RegExp(`/${code}/`));
    await expect(page.locator("h1").first()).toHaveText(HERO.en);
  });
}

test("the menu closes with Escape and with a click elsewhere", async ({ page }, testInfo) => {
  await page.goto("/index.html");
  await openMenu(page, testInfo);
  const toggle = page.locator(".lang-toggle");
  await toggle.click();
  await expect(page.locator(".lang-switch")).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".lang-switch")).not.toHaveClass(/is-open/);
  await toggle.click();
  await expect(page.locator(".lang-switch")).toHaveClass(/is-open/);
  // A click elsewhere: an empty spot of the header (the open menu covers the page on a phone).
  await page.locator(".site-header .container").click({ position: { x: 2, y: 2 } });
  await expect(page.locator(".lang-switch")).not.toHaveClass(/is-open/);
});

test("the current language is marked in the menu", async ({ page }, testInfo) => {
  await page.goto("/fr/about.html");
  await openMenu(page, testInfo);
  await page.locator(".lang-toggle").click();
  await expect(page.locator('.lang-menu a[aria-current="true"]')).toHaveText("Français");
  for (const [c, n] of Object.entries(NAMES)) await expect(page.locator(`.lang-menu a[data-lang-pick="${c}"]`)).toHaveText(n);
});

test.describe("first visit in a German browser", () => {
  test.use({ locale: "de-DE" });
  test("the English home page opens in German; a shared /fr/ link stays French", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page).toHaveURL(/\/de\/index\.html$/);
    await expect(page.locator("h1").first()).toHaveText(HERO.de);
    await page.evaluate(() => localStorage.removeItem("e1.lang"));
    await page.goto("/fr/index.html");
    await expect(page).toHaveURL(/\/fr\/index\.html$/);
  });
});

test("a page without translations offers the home page in each language, without this page's #part", async ({ page }, testInfo) => {
  // Regression: account.html#academy-courses linked to de/index.html#academy-courses.
  await page.goto("/guide-account.html#web-languages");
  await openMenu(page, testInfo);
  await page.locator(".lang-toggle").click();
  await expect(page.locator('.lang-menu a[data-lang-pick="de"]')).toHaveAttribute("href", "de/index.html");
  await expect(page.locator('.lang-menu a[data-lang-pick="en"]')).toHaveAttribute("href", "guide-account.html#web-languages");
  await page.locator('.lang-menu a[data-lang-pick="de"]').click();
  await expect(page).toHaveURL(/\/de\/index\.html$/);
});
