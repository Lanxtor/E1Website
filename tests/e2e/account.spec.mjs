/*
 * The account page (account.html) with the E1 server mocked:
 * WEB-account-page, WEB-overview, WEB-licenses, WEB-usage, WEB-organizations,
 * WEB-projects, WEB-permissions, the Downloads cards (WEB-download), the
 * Academy part (WEB-academy, WEB-certificates) and the profile.
 */
import { test, expect, mockApi, respond, isPhone, expectScrolledTo } from "./fixtures.mjs";
import { overview, trainingList } from "./data.mjs";

function server(extra = {}) {
  return {
    "GET /api/account/overview": overview(),
    "GET /api/training": trainingList(),
    ...extra
  };
}

test("signed in: overview, licenses, usage, organizations, projects, permissions, billing and downloads", async ({ page }) => {
  await mockApi(page, server());
  await page.goto("/account.html");
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
  await expect(page.locator("[data-user-email]")).toHaveText("kari.nordmann@example.com");
  await expect(page.locator("[data-avatar]")).toHaveText("KN");
  await expect(page.locator("[data-demo-banner]")).toBeHidden();

  // WEB-overview: six tiles.
  const tiles = page.locator("[data-overview] .stat");
  await expect(tiles).toHaveCount(6);
  await expect(tiles.nth(0)).toContainText("License");
  await expect(tiles.nth(0)).toContainText("Editor");
  await expect(tiles.nth(1)).toContainText("120");
  await expect(tiles.nth(1)).toContainText("37 requests this period");
  await expect(tiles.nth(2)).toContainText("5.0 GB");
  await expect(tiles.nth(2)).toContainText("40 GB of 100 GB for the organization");
  await expect(tiles.nth(3)).toContainText("Standard");
  await expect(tiles.nth(3)).toContainText("Active");
  await expect(tiles.nth(4)).toContainText("2");
  await expect(tiles.nth(5)).toContainText("2");

  // WEB-licenses.
  await expect(page.locator("[data-my-license] h3")).toHaveText("Editor");
  await expect(page.locator("[data-my-license]")).toContainText("Full use of E1");
  const seats = page.locator("[data-seats] tbody tr");
  await expect(seats).toHaveCount(2);
  await expect(seats.nth(0)).toContainText("Editor");
  await expect(seats.nth(0)).toContainText("Yours");
  await expect(seats.nth(0)).toContainText("3 of 4");
  await expect(seats.nth(1)).toContainText("9 of 10");
  await expect(seats.nth(1).locator(".meter")).toHaveClass(/is-high/);

  // WEB-usage.
  await expect(page.locator("[data-ai-usage]")).toContainText("120 credits used by you");
  await expect(page.locator("[data-ai-usage]")).toContainText("Your monthly cap: 300 credits");
  await expect(page.locator("[data-ai-usage]")).toContainText("Organization: 900 credits of 1,200 included");
  await expect(page.locator("[data-ai-usage]")).toContainText("GPT-4.1");
  await expect(page.locator("[data-storage]")).toContainText("5.0 GB stored by you");
  await expect(page.locator("[data-storage]")).toContainText("Ammonia plant");

  // WEB-organizations.
  const orgs = page.locator("[data-orgs] tbody tr");
  await expect(orgs).toHaveCount(2);
  await expect(orgs.nth(0)).toContainText("Fjord Process AS");
  await expect(orgs.nth(0)).toContainText("Current");
  await expect(orgs.nth(0)).toContainText("Owner");
  await expect(orgs.nth(1)).toContainText("Reviewer");
  await expect(orgs.nth(1).getByRole("button", { name: "Switch" })).toBeVisible();

  // WEB-projects.
  const projects = page.locator("[data-projects] tbody tr");
  await expect(projects).toHaveCount(2);
  await expect(projects.nth(0)).toContainText("Ammonia plant");
  await expect(projects.nth(0)).toContainText("Lead engineer");
  await expect(projects.nth(0)).toContainText("5,120");

  // WEB-permissions.
  await expect(page.locator("[data-org-roles]")).toContainText("Owner");
  await expect(page.locator("[data-groups]")).toContainText("Hydrogen team");
  await expect(page.locator("[data-permissions] code")).toHaveText(["org.manage-members", "project.create"]);
  await expect(page.locator("[data-packages]")).toContainText("Core");

  // Billing.
  await expect(page.locator("[data-plan]")).toContainText("Standard");
  await expect(page.locator("[data-payment]")).toContainText("$3,180.00");
  await expect(page.locator("[data-payment]")).toContainText("Card ending 1881");
  await expect(page.locator("[data-invoices] tbody tr")).toHaveCount(1);

  // Downloads: the same cards as Get E1.
  await expect(page.locator("#downloads [data-download-card]")).toHaveCount(4);
  await expect(page.locator("[data-release-line]")).toHaveText("stable channel");

  // Open E1 in the browser (ACC-browser).
  await expect(page.locator("[data-open-app]")).toHaveAttribute("href", "https://app.lanxtor.com");

  // The header says Account from now on, also on other pages.
  await expect(page.locator(".nav-actions a", { hasText: "Account" })).toHaveAttribute("href", "account.html");
  await page.goto("/about.html");
  await expect(page.locator(".nav-actions a", { hasText: "Account" })).toBeAttached();
});

test("the account menu jumps to each section", async ({ page }, testInfo) => {
  await mockApi(page, server());
  await page.goto("/account.html");
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
  for (const id of ["projects", "usage", "downloads", "licenses"]) {
    await page.locator(`.account-nav a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expectScrolledTo(page.locator(`#${id} h2`));
  }
  if (isPhone(testInfo)) {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(w).toBeLessThanOrEqual(1);
  }
});

test("an address with #section opens there after loading, also after reload", async ({ page }) => {
  await mockApi(page, server());
  await page.goto("/account.html#permissions");
  await expect(page.locator("[data-groups]")).toContainText("Hydrogen team");
  await page.reload();
  await expect(page.locator("[data-groups]")).toContainText("Hydrogen team");
  await expect(page.locator("#permissions")).toBeAttached();
});

test("switch organization with the Switch button and with the menu", async ({ page }) => {
  let org = "org-fjord";
  const switched = [];
  await mockApi(page, {
    "GET /api/training": respond(404, { error: { code: "not_found", message: "No training." } }),
    "GET /api/account/overview": () => overview(org === "org-delta"
      ? { org: { id: "org-delta", name: "Delta Utilities" }, license: { type: "reviewer", name: "Reviewer", assignedAt: "2027-06-01T00:00:00Z" } }
      : {}),
    "POST /auth/switch": (req) => { const b = req.postDataJSON(); switched.push(b.org); org = b.org; return { ok: true }; }
  });
  await page.goto("/account.html");
  await expect(page.locator("[data-my-license] h3")).toHaveText("Editor");
  await page.locator("[data-orgs]").getByRole("button", { name: "Switch" }).click();
  await expect(page.locator("[data-my-license] h3")).toHaveText("Reviewer");
  await expect(page.locator("[data-orgs] tbody tr").nth(1)).toContainText("Current");
  await expect(page.locator("[data-org-select]")).toHaveValue("org-delta");

  await page.locator("[data-org-select]").selectOption("org-fjord");
  await expect(page.locator("[data-my-license] h3")).toHaveText("Editor");
  expect(switched).toEqual(["org-delta", "org-fjord"]);
});

test("Open E1 in the browser goes to the organization's E1, and only to an address of the E1 Cloud", async ({ page }) => {
  // Each organization may have its E1 at its own address under app.lanxtor.com (E1 design 43.1).
  let org = "org-fjord";
  const at = { "org-fjord": "https://us1.app.lanxtor.com", "org-delta": "https://app.lanxtor.com" };
  await mockApi(page, {
    "GET /api/training": respond(404, { error: { code: "not_found", message: "No training." } }),
    "GET /api/account/overview": () => overview({ server: at[org], ...(org === "org-delta" ? { org: { id: "org-delta", name: "Delta Utilities" } } : {}) }),
    "POST /auth/switch": (req) => { org = req.postDataJSON().org; return { ok: true, server: at[org] }; }
  });
  await page.goto("/account.html");
  await expect(page.locator("[data-open-app]")).toHaveAttribute("href", "https://us1.app.lanxtor.com");
  await page.locator("[data-org-select]").selectOption("org-delta");
  await expect(page.locator("[data-org-select]")).toHaveValue("org-delta");
  await expect(page.locator("[data-open-app]")).toHaveAttribute("href", "https://app.lanxtor.com");

  // An address that is not the E1 Cloud's is never offered, whoever names it.
  for (const server of ["https://evil.example", "https://app.lanxtor.com.evil.example", "http://us1.app.lanxtor.com", "javascript:alert(1)"]) {
    at["org-delta"] = server;
    await page.reload();
    await expect(page.locator("[data-org-select]")).toHaveValue("org-delta");
    await expect(page.locator("[data-open-app]"), server).toHaveAttribute("href", "https://app.lanxtor.com");
  }
});

test("profile: save the first and last name; an empty name is refused", async ({ page }) => {
  const saved = [];
  await mockApi(page, server({
    "POST /api/account/profile": (req) => { saved.push({ body: req.postDataJSON(), csrf: req.headers()["x-e1-csrf"] }); return { ok: true }; }
  }));
  await page.goto("/account.html#profile");
  const given = page.locator("[data-profile-given]");
  const family = page.locator("[data-profile-family]");
  await expect(given).toHaveValue("Kari");
  await expect(family).toHaveValue("Nordmann");

  await given.fill("");
  await family.fill("  ");
  await page.locator("[data-profile-save]").click();
  await expect(page.locator("[data-profile-status]")).toHaveText("Type your first name, your last name or both.");
  expect(saved).toEqual([]);

  await given.fill("Ingrid");
  await family.fill("Berg");
  await family.press("Enter");
  await expect(page.locator("[data-profile-status]")).toHaveText("Saved.");
  await expect(page.locator("[data-user-name]")).toHaveText("Ingrid Berg");
  await expect(page.locator("[data-avatar]")).toHaveText("IB");
  expect(saved.map((x) => x.body)).toEqual([{ givenName: "Ingrid", familyName: "Berg" }]);
  expect(saved[0].csrf, "the server's CSRF token goes with the change").toMatch(/^csrf-token-/);
});

test("profile: the server refuses the name, the page says why", async ({ page }) => {
  await mockApi(page, server({
    "POST /api/account/profile": respond(400, { error: { code: "invalid", message: "The name is too long." } })
  }));
  await page.goto("/account.html#profile");
  await page.locator("[data-profile-given]").fill("X");
  await page.locator("[data-profile-save]").click();
  await expect(page.locator("[data-profile-status]")).toHaveText("The name is too long.");
  await expect(page.locator("[data-profile-save]")).toBeEnabled();
});

test("profile picture: upload, then remove", async ({ page }) => {
  await mockApi(page, server({
    "POST /api/account/picture": { picture: "assets/img/hero-avatar.png" },
    "DELETE /api/account/picture": { ok: true }
  }));
  await page.goto("/account.html#profile");
  await expect(page.locator("[data-picture-remove]")).toBeHidden();
  await page.locator("[data-picture-input]").setInputFiles("assets/img/icon-192.png");
  await expect(page.locator("[data-profile-status]")).toHaveText("Picture saved.");
  await expect(page.locator("[data-avatar] img")).toHaveAttribute("src", "assets/img/hero-avatar.png");
  await expect(page.locator("[data-picture-label]")).toHaveText("Change picture");
  await page.locator("[data-picture-remove]").click();
  await expect(page.locator("[data-profile-status]")).toHaveText("Picture removed.");
  await expect(page.locator("[data-avatar]")).toHaveText("KN");
  await expect(page.locator("[data-picture-remove]")).toBeHidden();
});

test("nobody signed in: the page asks to log in, and the header says Log in", async ({ page }) => {
  // Signed in on this browser before; the session has ended since.
  await page.goto("/about.html");
  await page.evaluate(() => localStorage.setItem("e1_signed_in", "1"));
  await mockApi(page, { "GET /api/account/overview": respond(401, { error: { code: "unauthenticated", message: "Sign in." } }) });
  await page.goto("/account.html");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("e1_signed_in"))).toBeNull();
  await page.locator('[data-state="signed-out"] a', { hasText: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\.html$/);
  await expect(page.locator(".nav-actions a", { hasText: "Log in" })).toBeAttached();
});

/* The billing period is a calendar month (UTC) and an invoice is dated by a
   day: both read the same in New York (the tests' time zone) as in Oslo, not
   the day before. */
for (const timezoneId of ["America/New_York", "Asia/Tokyo"]) {
  test(`billing period and invoice dates are calendar days, also in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US", timezoneId });
    const page = await context.newPage();
    await context.addInitScript(() => { try { localStorage.setItem("e1.cookies", "necessary"); } catch (e) { /* storage blocked */ } });
    await context.route(/^https:\/\/(?!app\.lanxtor\.com)/, (route) => route.abort("blockedbyclient"));
    const data = overview();
    data.billing.invoices = [
      { id: "LX-2027-0007", date: "2027-07-01", amount: 3180, currency: "USD", status: "paid", url: "" },
      { id: "LX-2027-0008", date: "2027-08-01T00:00:00Z", amount: 990, currency: "EUR", status: "open", url: "" }
    ];
    await mockApi(page, server({ "GET /api/account/overview": data }));
    await page.goto("/account.html#billing");
    await expect(page.locator("[data-usage-period]")).toHaveText("This billing period: Jul 1, 2027 – Aug 1, 2027.");
    await expect(page.locator("[data-plan]")).toContainText("Current period Jul 1, 2027 – Aug 1, 2027");
    await expect(page.locator("[data-payment]")).toContainText("Next invoice Aug 1, 2027");
    const rows = page.locator("[data-invoices] tbody tr");
    await expect(rows.nth(0).locator("td").nth(1)).toHaveText("Jul 1, 2027");
    await expect(rows.nth(1).locator("td").nth(1)).toHaveText("Aug 1, 2027");
    await context.close();
  });
}

/* The session ends while the page is open (it ran out, or the person signed
   out elsewhere): whatever they do next asks them to sign in again, instead
   of an error next to data the page can no longer change. */
for (const [what, route, act] of [
  ["Save the name", "POST /api/account/profile", async (page) => { await page.locator("[data-profile-given]").fill("Ingrid"); await page.locator("[data-profile-save]").click(); }],
  ["upload a picture", "POST /api/account/picture", (page) => page.locator("[data-picture-input]").setInputFiles("assets/img/icon-192.png")],
  ["remove the picture", "DELETE /api/account/picture", (page) => page.locator("[data-picture-remove]").click()],
  ["Switch organization", "POST /auth/switch", (page) => page.locator("[data-orgs]").getByRole("button", { name: "Switch" }).click()],
  ["Manage billing", "POST /api/account/billing/portal", (page) => page.getByRole("button", { name: "Manage billing" }).click()]
]) {
  test(`the session ended: ${what} asks to sign in again, and the header says Log in`, async ({ page }) => {
    const data = overview();
    data.user.picture = "assets/img/hero-avatar.png";
    data.billing.portal = true;
    await mockApi(page, server({
      "GET /api/account/overview": data,
      [route]: respond(401, { error: { code: "unauthenticated", message: "Sign in first." } })
    }));
    let alerted = "";
    page.on("dialog", (box) => { alerted = box.message(); box.dismiss(); });
    await page.goto("/account.html#profile");
    await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
    await expect(page.locator(".nav-actions a.btn", { hasText: "Account" })).toBeAttached();
    await act(page);
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    await expect(page.locator("[data-user-name]")).toBeHidden();
    await expect(page.locator(".nav-actions a.btn", { hasText: "Log in" })).toHaveAttribute("href", "login.html");
    await expect(page.locator(".lang-menu a[data-lang-pick=\"en\"]")).toHaveText("English");
    expect(await page.evaluate(() => localStorage.getItem("e1_signed_in"))).toBeNull();
    expect(alerted).toBe("");
  });
}

test("the server cannot be reached: the page says so, and Try again loads it", async ({ page }) => {
  let up = false;
  await mockApi(page, {
    "GET /api/account/overview": () => up ? overview() : respond(500, { error: { code: "internal", message: "The E1 cloud had a problem." } }),
    "GET /api/training": respond(404, { error: { code: "not_found", message: "-" } })
  });
  await page.goto("/account.html");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.locator("[data-error-text]")).toHaveText("The E1 cloud had a problem.");
  up = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
});

test("Log out signs out and returns to the home page", async ({ page }) => {
  let out = 0;
  await mockApi(page, server({ "POST /auth/logout": () => { out++; return { ok: true }; } }));
  await page.goto("/account.html");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
  expect(out).toBe(1);
  await expect(page.locator(".nav-actions a", { hasText: "Log in" })).toHaveAttribute("href", "login.html");
});

test("Manage billing opens the billing provider's portal", async ({ page, baseURL }) => {
  await mockApi(page, server({ "POST /api/account/billing/portal": { url: baseURL + "/legal.html?portal=1" } }));
  await page.goto("/account.html#billing");
  await page.getByRole("button", { name: "Manage billing" }).click();
  await expect(page).toHaveURL(/\/legal\.html\?portal=1$/);
});

test("a member who does not manage billing sees who does, and no invoices", async ({ page }) => {
  await mockApi(page, {
    "GET /api/account/overview": overview({ billing: { canManage: false, invoices: [] } }),
    "GET /api/training": trainingList()
  });
  await page.goto("/account.html#billing");
  await expect(page.locator("[data-payment]")).toContainText("Only owners and billing administrators");
  await expect(page.locator("[data-invoices]")).toContainText("Invoices are visible to the organization's billing administrators.");
  await expect(page.getByRole("button", { name: "Manage billing" })).toHaveCount(0);
});

test("no license and no projects: the page says so", async ({ page }) => {
  await mockApi(page, {
    "GET /api/account/overview": overview({ license: null, projects: [], orgs: [{ id: "org-fjord", name: "Fjord Process AS", role: "member", license: null }], groups: [], roles: { org: [], permissions: [] } }),
    "GET /api/training": trainingList()
  });
  await page.goto("/account.html");
  await expect(page.locator("[data-my-license] h3")).toHaveText("No license");
  await expect(page.locator("[data-projects]")).toHaveText("No projects yet. Create one in E1.");
  await expect(page.locator("[data-groups]")).toContainText("You are not in a group.");
  await expect(page.locator("[data-permissions]")).toHaveText("None at organization level.");
  await expect(page.locator(".org-switch")).toBeHidden();
});

test("WEB-academy and WEB-certificates on the account page", async ({ page }) => {
  await mockApi(page, server());
  await page.goto("/account.html#academy");
  const stats = page.locator("[data-academy-stats] .stat");
  await expect(stats).toHaveCount(4);
  await expect(stats.nth(0)).toContainText("1");
  await expect(stats.nth(0)).toContainText("of 2 in your plan");
  await expect(stats.nth(3)).toContainText("Certificates");

  const cont = page.locator(".continue-card");
  await expect(cont).toContainText("E1 Fundamentals");
  await expect(cont).toContainText("Next: Place equipment and lines");
  await expect(cont).toHaveAttribute("href", "training.html?course=e1-fundamentals&lesson=f5");

  const cards = page.locator(".course-card");
  await expect(cards).toHaveCount(3);
  // A course of the syllabus is in its learning path; the others under More courses.
  await expect(page.locator("#path-process .course-card")).toContainText("Process design in E1");
  await expect(page.locator("#path-process .path-step")).toHaveText("Path 2");
  await expect(page.locator("#path-more .course-card")).toHaveCount(2);
  const locked = cards.filter({ hasText: "Instrumentation and electrical" });
  await expect(locked).toHaveClass(/is-locked/);
  await expect(locked).toContainText("$149.00");
  await expect(locked.getByRole("link", { name: "See the course" })).toBeVisible();
  await expect(cards.filter({ hasText: "Process design in E1" }).getByRole("link", { name: "View certificate" })).toHaveAttribute("href", "certificate.html?id=E1C-TEST-0001");

  const cert = page.locator("[data-academy-certificates] tbody tr");
  await expect(cert).toHaveCount(1);
  await expect(cert).toContainText("Process design in E1");
  await expect(cert).toContainText("E1C-TEST-0001");
  const linkedin = cert.getByRole("link", { name: "Add to LinkedIn" });
  await expect(linkedin).toHaveAttribute("href", /linkedin\.com\/profile\/add\?startTask=CERTIFICATION_NAME.*certId=E1C-TEST-0001/);
  await expect(linkedin).toHaveAttribute("target", "_blank");

  // The user guides (WEB-user-guides) are linked from the Academy.
  await expect(page.locator("#academy-guides .guide-card")).toHaveCount(16);
  await page.locator("#academy-guides .guide-card", { hasText: "Your account, Academy and website" }).click();
  await expect(page).toHaveURL(/\/guide-account\.html$/);
});

test("the preview (?demo=1) says it is a preview", async ({ page }) => {
  await page.goto("/account.html?demo=1");
  await expect(page.locator("[data-demo-banner]")).toBeVisible();
  await expect(page.locator("[data-user-name]")).toHaveText("Alex Morgan");
});

test("user-guides.html leads to the user guides in the Academy", async ({ page }) => {
  await mockApi(page, server());
  await page.goto("/user-guides.html");
  await expect(page).toHaveURL(/\/account\.html#academy-guides$/);
  await expect(page.locator("#academy-guides")).toBeAttached();
});
