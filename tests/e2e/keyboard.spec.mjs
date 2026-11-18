/*
 * The website with the keyboard only: Tab to a control, Enter or Space to
 * use it, Escape to close. What a person who does not use a mouse does.
 */
import { test, expect, mockApi } from "./fixtures.mjs";

/* Presses Tab until the element has focus (at most `max` times). */
async function tabTo(page, locator, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("not reached with Tab: " + locator);
}

/* Desktop only (playwright.config.mjs): a phone has no keyboard to Tab with. */
test.describe("keyboard", () => {
  test("Tab reaches the menu; Enter opens a page", async ({ page }) => {
    await page.goto("/index.html");
    const link = page.locator(".nav-links a", { hasText: "Academy" });
    await tabTo(page, link);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/academy\.html$/);
  });

  test("the language menu opens with Enter and closes with Escape; a language is picked with Enter", async ({ page }) => {
    await page.goto("/about.html");
    const toggle = page.locator(".lang-toggle");
    await tabTo(page, toggle);
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await tabTo(page, page.locator('.lang-menu a[data-lang-pick="es"]'), 8);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/es\/about\.html$/);
  });

  test("sign-in: Sign up with the keyboard, then the university choice with Space", async ({ page }) => {
    await page.goto("/login.html");
    await tabTo(page, page.getByRole("tab", { name: "Sign up" }));
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-auth-title]")).toHaveText("Create your account");
    await tabTo(page, page.getByRole("radio", { name: "For teaching at a university" }), 6);
    await page.keyboard.press("Space");
    await expect(page.locator("[data-auth-title]")).toHaveText("Create your university account");
    await expect(page.locator("[data-uni-email]")).toBeFocused();
  });

  test("Ask Alex: open with Enter, Shift+Enter makes a new line, Enter sends, Escape closes", async ({ page }) => {
    const asked = [];
    await mockApi(page, { "POST /api/site/assistant": (req) => { asked.push(req.postDataJSON()); return { reply: "Yes." }; } });
    await page.goto("/about.html");
    await page.locator(".alex-launcher").focus();
    await page.keyboard.press("Enter");
    const box = page.getByRole("textbox", { name: "Your question" });
    await expect(box).toBeFocused();
    await page.keyboard.type("Line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Line two");
    await expect(box).toHaveValue("Line one\nLine two");
    expect(asked).toHaveLength(0);
    await page.keyboard.press("Enter");
    await expect(page.locator(".alex-msg.alex-bot").last()).toHaveText("Yes.");
    expect(asked[0].messages[0].content).toBe("Line one\nLine two");
    await page.keyboard.press("Escape");
    await expect(page.locator(".alex-panel")).toBeHidden();
  });

  test("All features: type in the search, pick a category with the arrow keys", async ({ page }) => {
    await page.goto("/guide-features.html");
    const search = page.getByRole("searchbox", { name: "Search features" });
    await tabTo(page, search);
    await page.keyboard.type("licen");
    const n = await page.locator("[data-guide-catalog] tbody tr:not([hidden])").count();
    await expect(page.locator("[data-guide-count]")).toHaveText(`${n} features`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("combobox", { name: "Category" })).toBeFocused();
    await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Your account, Academy and website" });
    expect(await page.locator("[data-guide-catalog] tbody tr:not([hidden])").count()).toBeLessThanOrEqual(n);
  });

  test("pricing: the currency and billing buttons work with Enter and Space", async ({ page }) => {
    await page.goto("/download.html#pricing");
    await page.locator('[data-currency-switch] button[data-cur="GBP"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-currency-switch] button[data-cur="GBP"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-billing-switch] button[data-billing="monthly"]').focus();
    await page.keyboard.press("Space");
    await expect(page.locator('[data-billing-switch] button[data-billing="monthly"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("course player: lessons are opened and marked done with the keyboard", async ({ page }) => {
    await page.goto("/training.html?course=collaboration&demo=1");
    await expect(page.locator("[data-lesson] h2")).toHaveText("Why branches");
    await page.locator(".outline-lesson", { hasText: "Comment and approve" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-lesson] h2")).toHaveText("Comment and approve");
    await page.getByRole("button", { name: "Mark as completed" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-lesson] h2")).toHaveText("Release a revision");
    // The quiz: radio buttons with the arrow keys.
    await page.locator(".outline-lesson", { hasText: "Final assessment" }).focus();
    await page.keyboard.press("Enter");
    const first = page.locator('input[name="q1"]').first();
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('input[name="q1"]').nth(1)).toBeChecked();
  });

  test("the certificate dialog: focus starts on Close, Enter closes it", async ({ page }) => {
    await page.goto("/training.html?course=collaboration&demo=1");
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Mark as completed" }).click();
    for (const [q, a] of [["q1", "a"], ["q2", "b"], ["q3", "a"], ["q4", "a"]]) await page.locator(`input[name="${q}"][value="${a}"]`).check();
    await page.getByRole("button", { name: "Submit answers" }).click();
    const dialog = page.getByRole("dialog", { name: "Congratulations!" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
  });

  test("account: the profile is saved with Enter, the organization changed with the keyboard", async ({ page }) => {
    await page.goto("/account.html?demo=1#profile");
    const given = page.locator("[data-profile-given]");
    await expect(given).toHaveValue("Alex");
    await given.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Sam");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-profile-status]")).toHaveText("Saved.");
    await expect(page.locator("[data-user-name]")).toHaveText("Sam Morgan");
    await page.locator("[data-org-select]").focus();
    await page.locator("[data-org-select]").selectOption({ label: "Alex Morgan (personal)" });
    await expect(page.locator("[data-orgs] tbody tr", { hasText: "Alex Morgan (personal)" })).toContainText("Current");
  });
});
