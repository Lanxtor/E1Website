/*
 * The Academy: the public page (WEB-academy-public), the course player
 * (WEB-course-player, training.html), certificates (WEB-certificates) and the
 * public certificate page (WEB-certificate-page, certificate.html).
 *
 * The course player and the certificate page are tried end to end in the
 * preview (?demo=1: the same functions as with the server, the learner's
 * progress kept in the browser), and against a mocked E1 server.
 */
import { test, expect, mockApi, respond } from "./fixtures.mjs";

test("the public Academy page shows the syllabus: paths in order, courses with lessons, the level filter, the price", async ({ page }) => {
  await page.goto("/academy.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E1 Academy.");
  const syl = page.locator("[data-syllabus]");
  // The totals come from the syllabus the user guides build.
  const totals = await page.evaluate(() => window.E1_SYLLABUS.totals);
  expect(totals.paths).toBe(6);
  expect(totals.courses).toBeGreaterThanOrEqual(20);
  await expect(syl.locator(".syllabus-totals")).toContainText(totals.courses + "courses");
  await expect(syl.locator(".syllabus-totals")).toContainText(totals.lessons + "lessons");
  // Six paths, in order, each a link to its section.
  const steps = syl.locator(".path-sequence li");
  await expect(steps).toHaveCount(6);
  await expect(steps.first()).toContainText("Foundations");
  await expect(steps.last()).toContainText("Configuration and administration");
  await steps.nth(3).getByRole("link").click();
  await expect(page).toHaveURL(/#path-electrical$/);
  await expect(page.getByRole("heading", { name: "Electrical and wiring" })).toBeInViewport();
  // A course shows its outcome, and its lessons with their minutes.
  const course = syl.locator("#course-first-pid");
  await expect(course.getByRole("heading", { name: "Your first P&ID" })).toBeVisible();
  await expect(course).toContainText("Afterwards:");
  await expect(course.locator(".syllabus-lessons li").first()).toBeHidden();
  await course.locator("summary", { hasText: "Lessons" }).click();
  await expect(course.locator(".syllabus-lessons li").first()).toBeVisible();
  await expect(course.locator(".syllabus-lessons li").last()).toContainText("Assessment");
  await expect(course.getByRole("link", { name: "Open the course" })).toHaveAttribute("href", "training.html?course=first-pid");
  // The level filter.
  await syl.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(syl.getByRole("button", { name: "Advanced", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(syl.locator('.syllabus-course[data-level="Beginner"]')).toHaveCount(0);
  await expect(syl.locator('.syllabus-course[data-level="Advanced"]').first()).toBeVisible();
  await syl.getByRole("button", { name: "All levels" }).click();
  await expect(syl.locator(".syllabus-course")).toHaveCount(totals.courses);
  await expect(page.locator('[data-product="academy"]')).toHaveText("$750");
});

test("the Academy page in German shows the same syllabus, and its courses open the player", async ({ page }) => {
  await page.goto("/de/academy.html");
  await expect(page.getByRole("heading", { name: "Der Lehrplan" })).toBeVisible();
  await expect(page.locator("[data-syllabus] .path-sequence li")).toHaveCount(6);
  // A path's link stays on the German page.
  await page.locator("[data-syllabus] .path-sequence li").nth(2).getByRole("link").click();
  await expect(page).toHaveURL(/\/de\/academy\.html#path-instrumentation$/);
  await page.locator("#course-safety").getByRole("link", { name: "Open the course" }).click();
  await expect(page).toHaveURL(/\/training\.html\?course=safety$/);
});

test("course player: watch, mark lessons done, pass the assessment, get the certificate, share it", async ({ page }) => {
  await page.goto("/training.html?course=review-markups&demo=1");
  await expect(page.locator("[data-demo-banner]")).toBeVisible();
  await expect(page.locator("[data-course-title]")).toHaveText("Review and markups");
  await expect(page.locator("[data-course-meta]")).toContainText("Documents and project control · Intermediate");
  await expect(page.locator("[data-course-progress]")).toContainText("0 of 5 lessons completed");

  // The first lesson opens with its video.
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("Redlining a 2D space · Markup settings");
  await expect(lesson.locator("video[data-video] source")).toHaveAttribute("src", "assets/clips/hero.mp4");

  // Mark as completed moves on to the next lesson.
  for (const [title, next] of [["Redlining a 2D space · Markup settings", "Answering markups"], ["Answering markups", "Review rounds"], ["Review rounds", "Marked-up prints · Markups as PDF comments"], ["Marked-up prints · Markups as PDF comments", "Final assessment"]]) {
    await expect(lesson.locator("h2")).toHaveText(title);
    await lesson.getByRole("button", { name: "Mark as completed" }).click();
    await expect(lesson.locator("h2")).toHaveText(next);
  }
  await expect(page.locator("[data-course-progress]")).toContainText("4 of 5 lessons completed");
  await expect(page.locator(".outline-lesson.is-done")).toHaveCount(4);
  await expect(page.locator(".outline-module", { hasText: "Mark up" }).locator(".outline-count")).toHaveText("2/2");

  // The assessment: unanswered questions are named; wrong answers fail.
  const quiz = page.locator("[data-quiz]");
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.locator("[data-quiz-note]")).toHaveText("4 questions are not answered yet.");
  for (const q of ["q1", "q2", "q3", "q4"]) await quiz.locator(`input[name="${q}"][value="c"]`).check();
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.locator(".quiz-result.is-fail")).toContainText("You need 75% to pass");
  await expect(quiz.locator(".quiz-q.is-wrong")).toHaveCount(4);

  // Right answers pass and issue the certificate.
  for (const [q, a] of [["q1", "a"], ["q2", "b"], ["q3", "a"], ["q4", "a"]]) await quiz.locator(`input[name="${q}"][value="${a}"]`).check();
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  const dialog = page.getByRole("dialog", { name: "Congratulations!" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Review and markups");
  await expect(dialog.getByRole("link", { name: "Add to LinkedIn profile" })).toHaveAttribute("href", /linkedin\.com\/profile\/add/);

  // Escape closes it; the course now says it is done.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-course-done]")).toContainText("You completed this course.");
  await expect(page.locator("[data-course-progress]")).toContainText("5 of 5 lessons completed");

  // After a reload the progress is still there.
  await page.reload();
  await expect(page.locator("[data-course-done]")).toContainText("You completed this course.");

  // The certificate page.
  await page.getByRole("link", { name: "View and share your certificate" }).click();
  await expect(page).toHaveURL(/certificate\.html\?id=[^&]+&demo=1$/);
  await expect(page.locator("[data-verify]")).toContainText("Verified certificate.");
  await expect(page.locator("[data-verify]")).toContainText("Review and markups");
  await expect(page.locator("[data-cert-figure] svg")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("id");

  // And it is listed on the account page (WEB-certificates).
  await page.goto("/account.html?demo=1#academy-certificates");
  await expect(page.locator("[data-academy-certificates]")).toContainText(id);
  await expect(page.locator("[data-academy-certificates] tbody tr", { hasText: "Review and markups" })).toHaveCount(1);
});

test("course player: the outline opens any lesson, Previous and Next move through them, the address follows", async ({ page }) => {
  await page.goto("/training.html?course=getting-started&demo=1");
  const lesson = page.locator("[data-lesson]");
  // Continues where the learner left off (the preview starts in lesson 6, at 3:10).
  await expect(lesson.locator("h2")).toHaveText("A tour of the E1 window · The left rail");
  await expect(lesson.locator("[data-player-status]")).toHaveText("Continuing at 3:10.");
  await expect(lesson.getByRole("button", { name: "Start from the beginning" })).toBeVisible();
  await page.locator(".outline-lesson", { hasText: "The terms and license agreement" }).click();
  await expect(lesson.locator("h2")).toHaveText("The terms and license agreement");
  await expect(page).toHaveURL(/lesson=getting-started-05/);
  await expect(page.locator('.outline-lesson[aria-current="step"]')).toContainText("The terms and license agreement");
  await lesson.getByRole("button", { name: "Next lesson" }).click();
  await expect(lesson.locator("h2")).toHaveText("A tour of the E1 window · The left rail");
  await lesson.getByRole("button", { name: "Previous" }).click();
  await expect(lesson.locator("h2")).toHaveText("The terms and license agreement");
  // The address opens the lesson directly, also after reload.
  await page.reload();
  await expect(lesson.locator("h2")).toHaveText("The terms and license agreement");
});

test("course player: speed, bookmarks, notes at a moment, the transcript and the lesson's user guide features", async ({ page }) => {
  await page.goto("/training.html?course=first-pid&demo=1");
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("Finding your way around a 2D space · A tour of the drawing's bar and palette");
  const video = lesson.locator("video[data-video]");

  // Speed: the video plays at it, and the next lesson too.
  await lesson.getByLabel("Playback speed").selectOption("1.5");
  await expect.poll(() => video.evaluate((v) => v.playbackRate)).toBe(1.5);

  // Overview: the lesson's features in the user guide.
  const guide = lesson.locator(".lesson-guide a");
  await expect(guide.first()).toHaveText("Open a 2D space, zoom and pan");
  await expect(guide.first()).toHaveAttribute("href", "guide-drawing.html#draw-sheet-view");

  // Transcript: a time moves the video there.
  await lesson.getByRole("tab", { name: "Transcript" }).click();
  await expect(lesson.getByRole("tab", { name: "Transcript" })).toHaveAttribute("aria-selected", "true");
  const line = lesson.locator(".transcript li").nth(1);
  await expect(line).toContainText("Open a 2D space");
  await line.locator("[data-seek]").click();
  await expect(lesson.locator("[data-player-status]")).toContainText("At ");

  // A bookmark at this moment: listed, and marked in the outline.
  await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThan(0);
  await video.evaluate((v) => { v.currentTime = 2; });
  await lesson.getByRole("button", { name: "Bookmark this moment" }).click();
  await expect(lesson.locator("[data-player-status]")).toHaveText("Bookmarked at 0:02.");
  await expect(page.locator('.outline-lesson[aria-current="step"] .outline-mark')).toHaveText("Bookmarked");
  await lesson.getByRole("tab", { name: /Bookmarks/ }).click();
  await expect(lesson.locator('[data-panel="bookmarks"] .note-item')).toHaveCount(1);

  // A note at a moment: Add a note here pauses and opens My notes.
  await lesson.getByRole("button", { name: "Add a note here" }).click();
  await expect(lesson.getByRole("tab", { name: /My notes/ })).toHaveAttribute("aria-selected", "true");
  await lesson.getByRole("button", { name: "Save note" }).click();
  await expect(lesson.locator("[data-note-msg]")).toHaveText("Write something first.");
  await lesson.getByLabel(/A note at/).fill("Space and drag pans; the wheel zooms where the pointer is.");
  await lesson.getByRole("button", { name: "Save note" }).click();
  await expect(lesson.locator("[data-note-msg]")).toHaveText("Note saved at 0:02.");
  const note = lesson.locator('[data-panel="notes"] .note-item');
  await expect(note).toHaveCount(1);
  await expect(note).toContainText("the wheel zooms");
  await expect(lesson.locator("[data-count-notes]")).toHaveText("1");

  // Edit it, then it is kept after a reload, with the bookmark and the speed.
  await note.getByRole("button", { name: "Edit" }).click();
  await note.getByLabel("Note").fill("Space and drag pans.");
  await note.getByRole("button", { name: "Save" }).click();
  await expect(lesson.locator('[data-panel="notes"] .note-item')).toContainText("Space and drag pans.");
  await page.reload();
  await lesson.getByRole("tab", { name: /My notes/ }).click();
  await expect(lesson.locator('[data-panel="notes"] .note-item')).toContainText("Space and drag pans.");
  await expect(lesson.getByLabel("Playback speed")).toHaveValue("1.5");
  await expect(page.locator(".outline-lesson .outline-mark")).toHaveCount(1);

  // Both are on the account page, and open the lesson at their moment.
  await page.goto("/account.html?demo=1#academy-notes");
  const mine = page.locator("#academy-notes");
  await expect(mine).toBeVisible();
  const myNote = mine.locator(".mine-list a", { hasText: "Space and drag pans." });
  await expect(myNote).toContainText("Your first P&ID");
  await expect(myNote).toHaveAttribute("href", "training.html?course=first-pid&lesson=first-pid-01&t=2&demo=1");
  await myNote.click();
  await expect(page.locator("[data-lesson] h2")).toHaveText("Finding your way around a 2D space · A tour of the drawing's bar and palette");
  await expect.poll(() => page.locator("video[data-video]").evaluate((v) => Math.round(v.currentTime))).toBe(2);

  // Delete the note; the bookmark is removed from the Bookmarks tab.
  const lesson2 = page.locator("[data-lesson]");
  await lesson2.getByRole("tab", { name: /My notes/ }).click();
  await lesson2.locator('[data-panel="notes"] .note-item').getByRole("button", { name: "Delete" }).click();
  await expect(lesson2.locator('[data-panel="notes"] .note-item')).toHaveCount(0);
  await lesson2.getByRole("tab", { name: /Bookmarks/ }).click();
  await lesson2.locator('[data-panel="bookmarks"]').getByRole("button", { name: "Remove" }).click();
  await expect(lesson2.locator('[data-panel="bookmarks"] .note-item')).toHaveCount(0);
  await expect(page.locator(".outline-lesson .outline-mark")).toHaveCount(0);
});

test("course player: a bookmark in another lesson opens that lesson at its moment", async ({ page }) => {
  // The preview has a bookmark at 2:00 in lesson 6 of Getting started.
  await page.goto("/training.html?course=getting-started&lesson=getting-started-02&demo=1");
  const lesson = page.locator("[data-lesson]");
  await lesson.getByRole("tab", { name: /Bookmarks/ }).click();
  await lesson.locator('[data-panel="bookmarks"] [data-goto]').click();
  await expect(lesson.locator("h2")).toHaveText("A tour of the E1 window · The left rail");
  // The preview's clip is 5 s long, so the bookmark at 2:00 lands at its end.
  await expect.poll(() => lesson.locator("video[data-video]").evaluate((v) => v.currentTime)).toBeGreaterThan(4);
});

test("course player with the server: the Academy not in the plan shows the free preview, locks the rest and offers it", async ({ page }) => {
  const course = {
    key: "locked", title: "A course", summary: "Not in the plan.", level: "Advanced", access: "available", price: { amount: 750, currency: "USD" }, durationMinutes: 20,
    progress: { percent: 0, completedLessons: 0, totalLessons: 3, status: "not_started", nextLessonId: "l1" },
    modules: [{ title: "Module", lessons: [
      { id: "l1", type: "video", title: "Course overview", durationSeconds: 240, preview: true, locked: false },
      { id: "l2", type: "video", title: "Loop diagrams", durationSeconds: 600, locked: true },
      { id: "l3", type: "quiz", title: "Final assessment", durationSeconds: 600, locked: true }
    ] }]
  };
  await mockApi(page, {
    "GET /api/training/courses/locked": { csrf: "t", course, certificate: null },
    "GET /api/training/lessons/l1": { id: "l1", type: "video", title: "Course overview", completed: false, position: 0, media: { url: "assets/clips/hero.mp4", type: "video/mp4" }, notes: [], resources: [] },
    "POST /api/training/courses/locked/checkout": { url: "" }
  });
  await page.goto("/training.html?course=locked");
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("Course overview");
  await expect(page.locator(".outline-lesson", { hasText: "Course overview" })).toContainText("Free preview");
  await expect(lesson.getByRole("button", { name: "Mark as completed" })).toHaveCount(0);
  await expect(lesson.getByRole("button", { name: "Bookmark this moment" })).toHaveCount(0);
  await page.locator(".outline-lesson", { hasText: "Loop diagrams" }).click();
  await expect(lesson.locator(".lesson-locked")).toContainText("This lesson is part of the E1 Academy.");
  await page.locator(".outline-lesson", { hasText: "Final assessment" }).click();
  await expect(lesson.locator("form")).toHaveCount(0);
  const buy = page.locator("[data-buy]");
  await expect(buy).toContainText("$750.00");
  await buy.getByRole("button", { name: "Get the Academy" }).click();
  await expect(buy.locator("[data-buy-note]")).toHaveText("Online payment is coming soon. Until then, contact us and we will add the course to your account.");
});

test("course player: an unknown course says so; no course goes to the Academy on the account page", async ({ page }) => {
  await page.goto("/training.html?course=nope&demo=1");
  await expect(page.locator("[data-error-text]")).toHaveText("There is no course with this address.");
  await page.goto("/training.html");
  await expect(page).toHaveURL(/\/account\.html#academy-courses$/);
});

test("course player with the server: signed out asks to sign in and returns to the course", async ({ page }) => {
  await mockApi(page, { "GET /api/training/courses/e1-fundamentals": respond(401, { error: { code: "unauthenticated", message: "Sign in." } }) });
  await page.goto("/training.html?course=e1-fundamentals");
  await expect(page.getByRole("heading", { name: "Sign in to take this course" })).toBeVisible();
  await expect(page.locator("[data-login]")).toHaveAttribute("href", /^login\.html\?return=.*training\.html%3Fcourse%3De1-fundamentals/);
});

test("course player with the server: progress is saved with POST, the certificate comes from the server", async ({ page }) => {
  const course = {
    key: "mini", title: "A short course", summary: "Two lessons.", level: "Beginner", access: "included", durationMinutes: 5,
    progress: { percent: 0, completedLessons: 0, totalLessons: 2, status: "not_started", nextLessonId: "m1" },
    modules: [{ title: "Only module", lessons: [
      { id: "m1", type: "video", title: "First lesson", durationSeconds: 60, completed: false, module: "Only module" },
      { id: "m2", type: "quiz", title: "Final assessment", durationSeconds: 600, completed: false, module: "Only module" }
    ] }]
  };
  const posted = [];
  await mockApi(page, {
    "GET /api/training/courses/mini": { csrf: "t1", course, certificate: null },
    "GET /api/training/lessons/m1": { id: "m1", type: "video", title: "First lesson", completed: false, position: 0, media: { url: "assets/clips/hero.mp4", type: "video/mp4" }, notes: ["Watch it."], resources: [] },
    "GET /api/training/lessons/m2": { id: "m2", type: "quiz", title: "Final assessment", passMark: 50, score: null, questions: [{ id: "x", text: "Two plus two?", options: [{ id: "a", text: "Four" }, { id: "b", text: "Five" }] }] },
    "POST /api/training/lessons/m1/progress": (req) => {
      posted.push(req.postDataJSON());
      return { lesson: { id: "m1", completed: true, position: 0 }, course: { key: "mini", progress: { percent: 50, completedLessons: 1, totalLessons: 2, status: "in_progress", nextLessonId: "m2" } }, certificate: null };
    },
    "POST /api/training/lessons/m2/quiz": (req) => {
      posted.push(req.postDataJSON());
      return { passed: true, score: 100, passMark: 50, results: [{ id: "x", correct: true }],
        course: { key: "mini", progress: { percent: 100, completedLessons: 2, totalLessons: 2, status: "completed" } },
        certificate: { id: "E1C-MINI-0001", courseTitle: "A short course", holderName: "Kari Nordmann", issuedAt: "2027-07-30T10:00:00Z" } };
    }
  });
  await page.goto("/training.html?course=mini");
  await expect(page.locator("[data-demo-banner]")).toBeHidden();
  await page.getByRole("button", { name: "Mark as completed" }).click();
  await expect(page.locator("[data-lesson] h2")).toHaveText("Final assessment");
  await page.getByLabel("Four").check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("dialog", { name: "Congratulations!" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("link", { name: "View and share your certificate" })).toHaveAttribute("href", "certificate.html?id=E1C-MINI-0001");
  expect(posted).toEqual([{ position: 0, completed: true }, { answers: { x: "a" } }]);
});

test("certificate page: verify, share, copy the link, download the image, print", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.goto("/certificate.html?id=E1C-7KQ3-M9XP-2DWA&demo=1");
  await expect(page.locator("[data-verify]")).toContainText("Verified certificate.");
  await expect(page.locator("[data-verify]")).toContainText("Projects and the explorer");
  await expect(page).toHaveTitle(/Projects and the explorer — certificate of Alex Morgan/);
  await expect(page.locator('[data-share="linkedinProfile"]')).toHaveAttribute("href", /certId=E1C-7KQ3-M9XP-2DWA/);
  await expect(page.locator('[data-share="x"]')).toHaveAttribute("href", /^https:\/\/x\.com\/intent\/tweet/);
  await expect(page.locator('[data-share="facebook"]')).toHaveAttribute("href", /facebook\.com\/sharer/);
  await expect(page.locator('[data-share="email"]')).toHaveAttribute("href", /^mailto:\?subject=/);

  await page.locator("[data-copy]").click();
  await expect(page.locator("[data-copy-label]")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(baseURL + "/certificate.html?id=E1C-7KQ3-M9XP-2DWA");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image (PNG)" }).click();
  expect((await download).suggestedFilename()).toBe("LANXTOR-E1-certificate-E1C-7KQ3-M9XP-2DWA.png");

  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
});

test("certificate page with the server: anyone can verify it; unknown and revoked say so", async ({ page }) => {
  await mockApi(page, {
    "GET /api/training/certificates/E1C-GOOD": { id: "E1C-GOOD", status: "valid", holderName: "Kari Nordmann", courseTitle: "E1 Fundamentals", issuedAt: "2027-06-10T10:00:00Z", issuer: "LANXTOR" },
    "GET /api/training/certificates/E1C-OLD": { id: "E1C-OLD", status: "revoked", holderName: "Kari Nordmann", courseTitle: "E1 Fundamentals", issuedAt: "2027-06-10T10:00:00Z" }
  });
  await page.goto("/certificate.html?id=E1C-GOOD");
  await expect(page.locator("[data-verify]")).toContainText("Issued by LANXTOR to Kari Nordmann");
  await expect(page.locator("[data-demo-banner]")).toBeHidden();
  await page.goto("/certificate.html?id=E1C-OLD");
  await expect(page.locator("[data-verify]")).toContainText("This certificate has been revoked.");
  await expect(page.locator(".cert-side")).toBeHidden();
  await page.goto("/certificate.html?id=E1C-MISSING");
  await expect(page.getByRole("heading", { name: "Certificate not found" })).toBeVisible();
  await page.goto("/certificate.html");
  await expect(page.getByRole("heading", { name: "Certificate not found" })).toBeVisible();
});

test("certificate page: the server cannot be reached, Try again", async ({ page }) => {
  let up = false;
  await mockApi(page, {
    "GET /api/training/certificates/E1C-GOOD": () => up
      ? { id: "E1C-GOOD", status: "valid", holderName: "Kari Nordmann", courseTitle: "E1 Fundamentals", issuedAt: "2027-06-10T10:00:00Z" }
      : respond(500, { error: { code: "internal", message: "-" } })
  });
  await page.goto("/certificate.html?id=E1C-GOOD");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  up = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-verify]")).toContainText("Verified certificate.");
});
