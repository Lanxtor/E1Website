/*
 * login.html: no password is typed on the website. Log in / Sign up switch
 * the box; Continue goes to the E1 server's sign-in (never followed here);
 * sign-up for a university checks the email as it is typed.
 */
import { test, expect, mockApi, API } from "./fixtures.mjs";

test("Log in and Sign up tabs, with the address of the E1 sign-in", async ({ page, baseURL }) => {
  await page.goto("/login.html");
  const submit = page.locator("[data-auth-submit]");
  await expect(page.locator("[data-auth-title]")).toHaveText("Welcome back");
  await expect(submit).toHaveText("Continue to sign in");
  await expect(submit).toHaveAttribute("href", API + "/auth/login?return=" + encodeURIComponent(baseURL + "/account.html"));

  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-auth-title]")).toHaveText("Create your account");
  await expect(submit).toHaveText("Create your account");
  await expect(submit).toHaveAttribute("href", /\/auth\/login\?return=.*&signup=1$/);
  await expect(page.locator("[data-trial-promo]")).toBeVisible();

  await page.getByRole("tab", { name: "Log in" }).click();
  await expect(page.locator("[data-auth-title]")).toHaveText("Welcome back");
  await expect(page.locator("[data-signup-kind]")).toBeHidden();
});

test("Sign up: Create your account makes the account only; the free 30-day trial is a choice of its own", async ({ page }) => {
  await page.goto("/login.html");
  const trial = page.getByRole("link", { name: "Start your free 30-day trial" });
  await expect(trial).toBeHidden();
  await page.getByRole("tab", { name: "Sign up" }).click();
  // The main button signs up without a trial: someone who waits to be invited is not pushed into one.
  const create = page.getByRole("link", { name: "Create your account" });
  await expect(create).toHaveClass(/btn-primary/);
  await expect(create).toHaveAttribute("href", /\/auth\/login\?return=.*&signup=1$/);
  await expect(create).not.toHaveAttribute("href", /trial=1/);
  await expect(trial).toBeVisible();
  await expect(trial).toHaveAttribute("href", /\/auth\/login\?return=.*&signup=1&trial=1$/);
  await expect(page.locator("[data-auth-lead]")).toHaveText("Create your E1 account. Join your team when they invite you, or start your free 30-day trial, for you and your team.");
  await expect(page.getByText("No trial yet? Your account is ready all the same: join your team when they invite you, and start your trial in E1 whenever you want.")).toBeVisible();
  // For a university: no trial button.
  await page.getByRole("radio", { name: "For teaching at a university" }).click();
  await expect(trial).toBeHidden();
  await page.getByRole("tab", { name: "Log in" }).click();
  await expect(trial).toBeHidden();
});

test("the trial panel shows Mac, Windows, iPad and iPhone for Editors, Reviewers and Invited Viewers", async ({ page }) => {
  await page.goto("/login.html#signup");
  const rows = page.locator("[data-trial-promo] .tp-row");
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect(rows.nth(i).locator(".tp-chip")).toHaveText(["Mac", "Windows", "iPad", "iPhone"]);
    await expect(rows.nth(i).locator(".tp-chip-iphone svg")).toBeVisible();
  }
  await expect(page.locator("[data-trial-promo] .tp-note")).toHaveText("The apps for iPad and iPhone are coming to the App Store.");
});

test("login.html#signup opens on Sign up; a campaign tag goes with the sign-in", async ({ page }) => {
  await page.goto("/login.html?utm_source=newsletter&utm_campaign=launch#signup");
  await expect(page.locator("[data-auth-title]")).toHaveText("Create your account");
  await expect(page.locator("[data-auth-submit]")).toHaveAttribute("href", /&signup=1&utm_source=newsletter&utm_campaign=launch$/);
});

test("a return address brings the visitor back after signing in", async ({ page, baseURL }) => {
  await page.goto("/login.html?return=" + encodeURIComponent("training.html?course=x"));
  await expect(page.locator("[data-auth-submit]")).toHaveAttribute("href", API + "/auth/login?return=" + encodeURIComponent(baseURL + "/training.html?course=x"));
});

test("university sign-up: the email is checked as it is typed; a personal email is refused", async ({ page }) => {
  await mockApi(page, {
    "GET /api/site/university": (req, url) => {
      const email = url.searchParams.get("email");
      if (email.endsWith("@gmail.com")) return { state: "public-mail" };
      return { state: "open", university: { name: "NTNU", country: "Norway" } };
    }
  });
  await page.goto("/login.html#university");
  await expect(page.locator("[data-auth-title]")).toHaveText("Create your university account");
  await expect(page.getByRole("radio", { name: "For teaching at a university" })).toHaveAttribute("aria-checked", "true");
  const email = page.locator("[data-uni-email]");
  const submit = page.locator("[data-auth-submit]");

  await email.fill("someone@gmail.com");
  await expect(page.locator("[data-uni-result]")).toHaveText("Use your university email address, not a personal one.");
  await expect(submit).toHaveAttribute("aria-disabled", "true");

  await email.fill("kari@stud.ntnu.no");
  await expect(page.locator("[data-uni-result]")).toHaveText("✓ NTNU, Norway uses E1 already. You join it.");
  await expect(submit).toHaveAttribute("aria-disabled", "false");
  await expect(submit).toHaveAttribute("href", /&university=1&login_hint=kari%40stud\.ntnu\.no$/);

  // Back to a company.
  await page.getByRole("radio", { name: "For my company" }).click();
  await expect(page.locator("[data-uni-check]")).toBeHidden();
  await expect(page.locator("[data-auth-title]")).toHaveText("Create your account");
});

test("Sign in with Microsoft shows when the E1 server offers it", async ({ page }) => {
  await mockApi(page, { "GET /auth/providers": { microsoft: true } });
  await page.goto("/login.html");
  await expect(page.locator("[data-auth-microsoft]")).toBeVisible();
  await expect(page.locator("[data-auth-microsoft]")).toHaveAttribute("href", /^https:\/\/app\.lanxtor\.com\/auth\/login\/microsoft\?return=/);
});

test("Sign in with Microsoft stays hidden when the server does not offer it", async ({ page }) => {
  await mockApi(page, { "GET /auth/providers": { microsoft: false } });
  await page.goto("/login.html");
  await expect(page.locator("[data-auth-title]")).toHaveText("Welcome back");
  await expect(page.locator("[data-auth-microsoft]")).toBeHidden();
});

test("Log in in the header opens the sign-in page", async ({ page }, testInfo) => {
  await page.goto("/index.html");
  if (testInfo.project.name === "phone") await page.locator(".nav-toggle").click();
  await page.locator(".nav-actions a", { hasText: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\.html$/);
});
