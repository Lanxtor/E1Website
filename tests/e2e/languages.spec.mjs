/*
 * WEB-languages: the website in English, German, French, Spanish,
 * Norwegian and Simplified Chinese. The language menu in the header (inside the menu on a phone)
 * opens the same page in the chosen language, the choice is remembered, and
 * a first visit follows the browser's language.
 */
import { test, expect, openMenu, mockApi } from "./fixtures.mjs";
import { overview, trainingList } from "./data.mjs";

const HERO = {
  en: "Plant engineering, at the speed of thought.",
  de: "Anlagenplanung in Gedankenschnelle.",
  fr: "L'ingénierie d'installations, à la vitesse de la pensée.",
  es: "Ingeniería de plantas, a la velocidad del pensamiento.",
  no: "Anleggsprosjektering i tankens hastighet.",
  zh: "工厂工程设计，快如思维。"
};
const NAMES = { en: "English", de: "Deutsch", fr: "Français", es: "Español", no: "Norsk", zh: "中文" };

async function pick(page, testInfo, code) {
  await openMenu(page, testInfo);
  const toggle = page.locator(".lang-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.locator(`.lang-menu a[data-lang-pick="${code}"]`).click();
}

for (const code of ["de", "fr", "es", "no", "zh"]) {
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

test("a page without translations stays where it is when a language is picked, and the other pages follow the choice", async ({ page }, testInfo) => {
  await page.goto("/guide-account.html#web-languages");
  await openMenu(page, testInfo);
  await page.locator(".lang-toggle").click();
  await expect(page.locator("[data-lang-note]")).toHaveText("This page is in English only. The language you pick is used on the other pages.");
  await page.locator('.lang-menu a[data-lang-pick="de"]').click();
  await expect(page).toHaveURL(/\/guide-account\.html#web-languages$/);
  await expect(page.locator('.lang-menu a[data-lang-pick="de"]')).toHaveAttribute("aria-current", "true");
  await page.goto("/about.html");
  await expect(page).toHaveURL(/\/de\/about\.html$/);
});

test("account page: picking a language keeps the profile and what is typed in it", async ({ page }, testInfo) => {
  await mockApi(page, { "GET /api/account/overview": overview(), "GET /api/training": trainingList() });
  await page.goto("/account.html#profile");
  await page.locator("[data-profile-given]").fill("Pouria");
  await openMenu(page, testInfo);
  await page.locator(".lang-toggle").click();
  await page.locator('.lang-menu a[data-lang-pick="no"]').click();
  await expect(page).toHaveURL(/\/account\.html#profile$/);
  await expect(page.locator("[data-profile-given]")).toHaveValue("Pouria");
});

/*
 * Simplified Chinese (/zh/): every translated page is in Chinese, reached from
 * a Chinese browser, and laid out without the header or the text spilling over.
 */
const ZH_PAGES = ["index.html", "solutions.html", "academy.html", "download.html", "about.html", "contact-sales.html",
  "cloud-specifications.html", "installation-requirements.html", "security.html", "privacy.html", "terms.html", "legal.html", "shape-e1.html"];
const HAN = /[一-鿿]/;

for (const locale of ["zh-CN", "zh-TW", "zh"]) {
  test.describe(`first visit in a ${locale} browser`, () => {
    test.use({ locale });
    test("the English home page opens in Simplified Chinese", async ({ page }) => {
      await page.goto("/index.html");
      await expect(page).toHaveURL(/\/zh\/index\.html$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
      await expect(page.locator("h1").first()).toHaveText(HERO.zh);
    });
  });
}

for (const name of ZH_PAGES) {
  test(`/zh/${name}: the heading, the title and the menu are in Chinese, in Chinese fonts, nothing spills over`, async ({ page }, testInfo) => {
    await page.goto(`/zh/${name}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    // The heading may be only a name (E1 Academy); the text under it is Chinese.
    await expect(page.locator("main, #main, body").first()).toContainText(HAN);
    const han = await page.evaluate(() => (document.body.innerText.match(/[\u4e00-\u9fff]/g) || []).length);
    expect(han).toBeGreaterThan(200);
    expect(await page.title()).toMatch(HAN);
    const font = await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/PingFang SC/);
    expect(font).toMatch(/Microsoft YaHei/);
    // Nothing wider than the window (a phone's too).
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(wide).toBeLessThanOrEqual(1);
    await openMenu(page, testInfo);
    await expect(page.locator(".nav-links a", { hasText: HAN }).first()).toBeVisible();
    await expect(page.locator(".lang-toggle span")).toHaveText("ZH");
  });
}

test("/zh/: the header stays one row on a desktop, as in English", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "the phone has the menu button");
  await page.goto("/index.html");
  const en = await page.locator(".site-header").boundingBox();
  await page.goto("/zh/index.html");
  const zh = await page.locator(".site-header").boundingBox();
  expect(Math.abs(zh.height - en.height)).toBeLessThanOrEqual(4);
  // Every link of the menu on the same line.
  const tops = await page.locator(".nav-links > li:visible").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops.map((t) => Math.round(t / 8))).size).toBe(1);
});

test("中文 from the keyboard: Enter on the language button, Tab to 中文, Enter; Back keeps Chinese", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "the keyboard is a desktop's");
  await page.goto("/about.html");
  await page.locator(".lang-toggle").focus();
  await page.keyboard.press("Enter");
  const zh = page.locator('.lang-menu a[data-lang-pick="zh"]');
  await expect(zh).toBeVisible();
  for (let i = 0; i < 8 && !(await zh.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(zh).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/zh\/about\.html$/);
  await expect(page.locator("h1").first()).toHaveText(HAN);
  // The browser's Back button leads to the English address, which keeps the chosen Chinese.
  await page.goBack();
  await expect(page).toHaveURL(/\/zh\/about\.html$/);
});

test("/zh/: Get E1 prices start in US dollars and the currency can be changed", async ({ page }) => {
  await page.goto("/zh/download.html");
  const usd = page.locator('[data-currency-switch] button[data-cur="USD"]');
  await expect(usd).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-currency-switch] button[data-cur="EUR"]').click();
  await expect(page.locator('[data-currency-switch] button[data-cur="EUR"]')).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator('[data-currency-switch] button[data-cur="EUR"]')).toHaveAttribute("aria-pressed", "true");
});
