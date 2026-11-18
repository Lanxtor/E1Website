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

test("the public Academy page shows the courses and what the Academy costs", async ({ page }) => {
  await page.goto("/academy.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E1 Academy.");
  for (const title of ["E1 Fundamentals", "Collaboration, branches and review", "Process design in E1", "Instrumentation and electrical"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.locator('[data-product="academy"]')).toHaveText("$750");
});

test("course player: watch, mark lessons done, pass the assessment, get the certificate, share it", async ({ page }) => {
  await page.goto("/training.html?course=collaboration&demo=1");
  await expect(page.locator("[data-demo-banner]")).toBeVisible();
  await expect(page.locator("[data-course-title]")).toHaveText("Collaboration, branches and review");
  await expect(page.locator("[data-course-progress]")).toContainText("0 of 5 lessons completed");

  // The first lesson opens with its video.
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("Why branches");
  await expect(lesson.locator("video[data-video] source")).toHaveAttribute("src", "assets/clips/hero.mp4");

  // Mark as completed moves on to the next lesson.
  for (const [title, next] of [["Why branches", "Pull, push and merge"], ["Pull, push and merge", "Comment and approve"], ["Comment and approve", "Release a revision"], ["Release a revision", "Final assessment"]]) {
    await expect(lesson.locator("h2")).toHaveText(title);
    await lesson.getByRole("button", { name: "Mark as completed" }).click();
    await expect(lesson.locator("h2")).toHaveText(next);
  }
  await expect(page.locator("[data-course-progress]")).toContainText("4 of 5 lessons completed");
  await expect(page.locator(".outline-lesson.is-done")).toHaveCount(4);

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
  await expect(dialog).toContainText("Collaboration, branches and review");
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
  await expect(page.locator("[data-verify]")).toContainText("Collaboration, branches and review");
  await expect(page.locator("[data-cert-figure] svg")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("id");

  // And it is listed on the account page (WEB-certificates).
  await page.goto("/account.html?demo=1#academy-certificates");
  await expect(page.locator("[data-academy-certificates]")).toContainText(id);
  await expect(page.locator("[data-academy-certificates] tbody tr", { hasText: "Collaboration, branches and review" })).toHaveCount(1);
});

test("course player: the outline opens any lesson, Previous and Next move through them, the address follows", async ({ page }) => {
  await page.goto("/training.html?course=e1-fundamentals&demo=1");
  const lesson = page.locator("[data-lesson]");
  // Continues where the learner left off (the preview starts at lesson 6).
  await expect(lesson.locator("h2")).toHaveText("Properties, tags and the catalog");
  await page.locator(".outline-lesson", { hasText: "Create a project" }).click();
  await expect(lesson.locator("h2")).toHaveText("Create a project");
  await expect(page).toHaveURL(/lesson=f4/);
  await expect(page.locator('.outline-lesson[aria-current="step"]')).toContainText("Create a project");
  await lesson.getByRole("button", { name: "Next lesson" }).click();
  await expect(lesson.locator("h2")).toHaveText("Place equipment and lines");
  await lesson.getByRole("button", { name: "Previous" }).click();
  await expect(lesson.locator("h2")).toHaveText("Create a project");
  // The address opens the lesson directly, also after reload.
  await page.reload();
  await expect(lesson.locator("h2")).toHaveText("Create a project");
});

test("course player: a course to buy shows its free preview, locks the rest and offers to buy it", async ({ page }) => {
  await page.goto("/training.html?course=instrumentation-electrical&demo=1");
  const lesson = page.locator("[data-lesson]");
  await expect(lesson.locator("h2")).toHaveText("Course overview");
  await expect(page.locator(".outline-lesson", { hasText: "Course overview" })).toContainText("Free preview");
  await expect(lesson.getByRole("button", { name: "Mark as completed" })).toHaveCount(0);
  await page.locator(".outline-lesson", { hasText: "Loop diagrams" }).click();
  await expect(lesson.locator(".lesson-locked")).toContainText("This lesson is part of the full course.");
  const buy = page.locator("[data-buy]");
  await expect(buy).toContainText("$149.00");
  await buy.getByRole("button", { name: "Buy the course" }).click();
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
  await expect(page.locator("[data-verify]")).toContainText("Process design in E1");
  await expect(page).toHaveTitle(/Process design in E1 — certificate of Alex Morgan/);
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
