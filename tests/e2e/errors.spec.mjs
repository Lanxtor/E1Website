/*
 * What a visitor sees when something goes wrong or is not there yet: a
 * refused picture, an organization that cannot be switched to, a billing
 * portal not connected, a lesson that cannot be loaded, a course not owned.
 * And the course player's own saving of the video position.
 */
import { test, expect, mockApi, respond } from "./fixtures.mjs";
import { overview, trainingList } from "./data.mjs";
import fs from "node:fs";
import path from "node:path";

function server(extra = {}) {
  return { "GET /api/account/overview": overview(), "GET /api/training": trainingList(), ...extra };
}

test("profile picture: a file that is not a picture is refused with the reason", async ({ page }, testInfo) => {
  await mockApi(page, server({ "POST /api/account/picture": { picture: "x.png" } }));
  await page.goto("/account.html#profile");
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
  const txt = path.join(testInfo.outputDir, "notes.txt");
  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  fs.writeFileSync(txt, "not a picture");
  await page.locator("[data-picture-input]").setInputFiles(txt);
  await expect(page.locator("[data-profile-status]")).toHaveText("Choose a picture: a PNG, JPEG, GIF or WebP photo.");
  await expect(page.locator("[data-avatar]")).toHaveText("KN");
});

test("profile picture: a broken image file is refused", async ({ page }, testInfo) => {
  await mockApi(page, server({ "POST /api/account/picture": { picture: "x.png" } }));
  await page.goto("/account.html#profile");
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
  const bad = path.join(testInfo.outputDir, "broken.png");
  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  fs.writeFileSync(bad, "this is not really a png");
  await page.locator("[data-picture-input]").setInputFiles(bad);
  await expect(page.locator("[data-profile-status]")).toHaveText("This file could not be read as a picture. Choose a PNG, JPEG, GIF or WebP photo.");
});

test("profile picture: the server refuses it, the page says why", async ({ page }) => {
  await mockApi(page, server({ "POST /api/account/picture": respond(413, { error: { code: "too_large", message: "The picture is too large." } }) }));
  await page.goto("/account.html#profile");
  await expect(page.locator("[data-user-name]")).toHaveText("Kari Nordmann");
  await page.locator("[data-picture-input]").setInputFiles("assets/img/icon-192.png");
  await expect(page.locator("[data-profile-status]")).toHaveText("The picture is too large.");
  await expect(page.locator("[data-picture-remove]")).toBeHidden();
});

test("an organization that cannot be switched to: a message, and the page stays as it was", async ({ page }) => {
  await mockApi(page, server({ "POST /auth/switch": respond(403, { error: { code: "forbidden", message: "You are no longer a member of Delta Utilities." } }) }));
  await page.goto("/account.html#organizations");
  const messages = [];
  page.on("dialog", (d) => { messages.push(d.message()); d.accept(); });
  await page.locator("[data-orgs]").getByRole("button", { name: "Switch" }).click();
  await expect.poll(() => messages).toEqual(["You are no longer a member of Delta Utilities."]);
  await expect(page.locator("[data-orgs] tbody tr").first()).toContainText("Current");
  await expect(page.locator("[data-my-license] h3")).toHaveText("Editor");
});

test("Manage billing when the billing portal is not connected yet", async ({ page }) => {
  await mockApi(page, server({ "POST /api/account/billing/portal": {} }));
  await page.goto("/account.html#billing");
  const messages = [];
  page.on("dialog", (d) => { messages.push(d.message()); d.accept(); });
  await page.getByRole("button", { name: "Manage billing" }).click();
  await expect.poll(() => messages).toEqual(["The billing portal is not connected yet."]);
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeEnabled();
  await expect(page).toHaveURL(/\/account\.html#billing$/);
});

test("an organization without online payment says so", async ({ page }) => {
  await mockApi(page, { "GET /api/account/overview": overview({ billing: { canManage: true, portal: false, invoices: [] } }), "GET /api/training": trainingList() });
  await page.goto("/account.html#billing");
  await expect(page.locator("[data-payment]")).toContainText("Online payment is coming soon.");
  await expect(page.locator("[data-invoices]")).toHaveText("No invoices yet.");
});

test("a trial and a license file are shown with the plan", async ({ page }) => {
  const sub = { ...overview().subscription, status: "trialing", trialEndsAt: "2027-08-14T00:00:00Z", source: "license_file", addOns: ["Plant package", "Academy"] };
  await mockApi(page, { "GET /api/account/overview": overview({ subscription: sub }), "GET /api/training": trainingList() });
  await page.goto("/account.html#billing");
  await expect(page.locator("[data-plan] .badge")).toHaveText("Trial");
  await expect(page.locator("[data-plan]")).toContainText("Trial ends");
  await expect(page.locator("[data-plan]")).toContainText("Licensed by a signed license file");
  await expect(page.locator("[data-plan]")).toContainText("Add-ons: Plant package, Academy");
});

test("the Academy before the server has courses: the syllabus, not an error", async ({ page }) => {
  await mockApi(page, {
    "GET /api/account/overview": overview({ academy: { courses: [], certificates: [] } }),
    "GET /api/training": respond(404, { error: { code: "not_found", message: "-" } })
  });
  await page.goto("/account.html#academy");
  await expect(page.locator("[data-academy-courses] .course-card", { hasText: "Getting started with E1" })).toBeVisible();
  await expect(page.locator("[data-academy-certificates]")).toContainText("No certificates yet.");
});

test("course cards lead into the course player", async ({ page }) => {
  await page.goto("/account.html?demo=1#academy-courses");
  const card = page.locator(".course-card", { hasText: "Review and markups" });
  await card.getByRole("link", { name: "Start the course" }).click();
  await expect(page).toHaveURL(/training\.html\?course=review-markups&demo=1$/);
  await expect(page.locator("[data-course-title]")).toHaveText("Review and markups");
  await page.goBack();
  await page.locator(".continue-card").click();
  await expect(page).toHaveURL(/training\.html\?course=getting-started&lesson=getting-started-06&demo=1$/);
  await expect(page.locator("[data-lesson] h2")).toHaveText("A tour of the E1 window · The left rail");
});

test("course player: a lesson that cannot be loaded says why; others still open", async ({ page }) => {
  const course = {
    key: "k", title: "K course", summary: "-", level: "Beginner", access: "included", durationMinutes: 3,
    progress: { percent: 0, completedLessons: 0, totalLessons: 2, status: "not_started", nextLessonId: "a" },
    modules: [{ title: "M", lessons: [{ id: "a", type: "video", title: "Lesson A", durationSeconds: 60, module: "M" }, { id: "b", type: "video", title: "Lesson B", durationSeconds: 60, module: "M" }] }]
  };
  await mockApi(page, {
    "GET /api/training/courses/k": { course, certificate: null },
    "GET /api/training/lessons/a": respond(500, { error: { code: "internal", message: "The lesson could not be loaded." } }),
    "GET /api/training/lessons/b": { id: "b", type: "video", title: "Lesson B", completed: false, position: 0, media: { url: "assets/clips/hero.mp4" }, notes: ["Notes for B."], resources: [{ name: "Exercise B.e1", url: "assets/data/releases.json" }] }
  });
  await page.goto("/training.html?course=k");
  await expect(page.locator("[data-lesson] .notice")).toHaveText("The lesson could not be loaded.");
  await page.locator(".outline-lesson", { hasText: "Lesson B" }).click();
  await expect(page.locator("[data-lesson] video")).toBeVisible();
  await expect(page.locator("[data-lesson] .lesson-notes")).toHaveText("Notes for B.");
  await expect(page.getByRole("heading", { name: "Exercise files" })).toBeVisible();
  await expect(page.locator("[data-lesson] .mini-list a", { hasText: "Download" })).toHaveAttribute("download", "");
});

test("course player: the place in the video is saved when the learner goes back and pauses", async ({ page }) => {
  const course = {
    key: "v", title: "V course", summary: "-", level: "Beginner", access: "included", durationMinutes: 3,
    progress: { percent: 0, completedLessons: 0, totalLessons: 1, status: "in_progress", nextLessonId: "v1" },
    modules: [{ title: "M", lessons: [{ id: "v1", type: "video", title: "The video", durationSeconds: 120, module: "M" }] }]
  };
  const saved = [];
  await mockApi(page, {
    "GET /api/training/courses/v": { course, certificate: null },
    // Watched up to second 20 before (on another device).
    "GET /api/training/lessons/v1": { id: "v1", type: "video", title: "The video", completed: false, position: 20, media: { url: "assets/clips/hero.mp4", type: "video/mp4" }, notes: [], resources: [] },
    "POST /api/training/lessons/v1/progress": (req) => { const b = req.postDataJSON(); saved.push(b); return { lesson: { id: "v1", completed: b.completed, position: b.position }, course: { key: "v", progress: course.progress }, certificate: null }; }
  });
  await page.goto("/training.html?course=v");
  const video = page.locator("[data-video]");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThan(0);
  // The learner goes back to the second second with the video's controls, plays and pauses.
  await video.evaluate((v) => { v.muted = true; v.currentTime = 1; return v.play().catch(() => {}); });
  await video.evaluate((v) => v.pause());
  await expect.poll(() => saved.length).toBeGreaterThan(0);
  expect(saved[0].completed).toBe(false);
  expect(saved[0].position).toBeLessThan(5);
});

test("course player: notes and bookmarks that cannot be loaded or saved say so, and the lesson still plays", async ({ page }) => {
  const course = {
    key: "mini", title: "A short course", summary: "One lesson.", level: "Beginner", access: "included", durationMinutes: 5,
    progress: { percent: 0, completedLessons: 0, totalLessons: 1, status: "not_started", nextLessonId: "m1" },
    modules: [{ title: "Only module", lessons: [{ id: "m1", type: "video", title: "First lesson", durationSeconds: 60, completed: false }] }]
  };
  await mockApi(page, {
    "GET /api/training/courses/mini": { csrf: "t1", course, certificate: null },
    "GET /api/training/lessons/m1": { id: "m1", type: "video", title: "First lesson", completed: false, position: 0, media: { url: "assets/clips/hero.mp4", type: "video/mp4" }, notes: [], resources: [] },
    "POST /api/training/notes": respond(500, { error: { code: "internal", message: "Your note could not be saved. Try again." } }),
    "POST /api/training/bookmarks": respond(500, { error: { code: "internal", message: "The bookmark could not be saved. Try again." } })
  });
  await page.goto("/training.html?course=mini");
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("First lesson");
  await expect(lesson.locator("video[data-video]")).toBeVisible();
  await lesson.getByRole("button", { name: "Bookmark this moment" }).click();
  await expect(lesson.locator("[data-player-status]")).toHaveText("The bookmark could not be saved. Try again.");
  await lesson.getByRole("tab", { name: /My notes/ }).click();
  await lesson.getByLabel(/A note at/).fill("Keep this.");
  await lesson.getByRole("button", { name: "Save note" }).click();
  await expect(lesson.locator("[data-note-msg]")).toHaveText("Your note could not be saved. Try again.");
  await expect(lesson.getByLabel(/A note at/)).toHaveValue("Keep this.");
});

test("certificate page: native Share on a device that offers it", async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.share = (data) => { window.__shared.push({ title: data.title, url: data.url, text: data.text }); return Promise.resolve(); };
    navigator.canShare = () => false;
  });
  await page.goto("/certificate.html?id=E1C-7KQ3-M9XP-2DWA&demo=1");
  const share = page.locator("[data-native-share]");
  await expect(share).toBeVisible();
  await share.click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toMatch(/certificate\.html\?id=E1C-7KQ3-M9XP-2DWA$/);
  expect(shared[0].text).toContain("Projects and the explorer");
});

test("the assistant cannot be reached at all: Alex says so, and asking again works", async ({ page }) => {
  let up = false;
  await page.route("https://app.lanxtor.com/api/site/assistant", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    if (!up) return route.abort("internetdisconnected");
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ reply: "Back online." }) });
  });
  await page.goto("/index.html");
  await page.locator(".alex-launcher").click();
  const box = page.getByRole("textbox", { name: "Your question" });
  await box.fill("Hello?");
  await box.press("Enter");
  await expect(page.locator(".alex-msg.alex-bot").last()).toContainText("I'm not connected yet.");
  up = true;
  await box.fill("Hello again");
  await box.press("Enter");
  await expect(page.locator(".alex-msg.alex-bot").last()).toHaveText("Back online.");
});

test("an address in a language folder that does not exist shows the 404 page", async ({ page }) => {
  const res = await page.goto("/de/no-such-page.html");
  expect(res.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();
  // The 404 page's own links work from inside the folder.
  await page.locator(".site-footer a", { hasText: "Academy" }).first().click();
  await expect(page).toHaveURL(/\/academy\.html$/);
});
