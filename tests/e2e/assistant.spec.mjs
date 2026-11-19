/*
 * WEB-assistant: "Ask Alex" on every page. Questions are typed or picked
 * from the suggestions; answers come from POST <apiBase>/api/site/assistant
 * (mocked here, nothing is sent). The conversation follows the visitor from
 * page to page in this tab; New conversation clears it.
 */
import { test, expect, mockApi } from "./fixtures.mjs";

function assistant(answers) {
  const asked = [];
  return {
    asked,
    routes: {
      "POST /api/site/assistant": (req) => {
        const body = req.postDataJSON();
        asked.push(body);
        const last = body.messages[body.messages.length - 1].content;
        return { reply: answers[last] || "E1 is plant engineering software. See [Get E1](download.html)." };
      }
    }
  };
}

test("open Alex, click a suggested question, type another, follow a link in the answer", async ({ page }) => {
  const a = assistant({ "What does E1 cost?": "Standard is **$795** per user a month, billed yearly.\n\n- Editor\n- Viewer" });
  await mockApi(page, a.routes);
  await page.goto("/about.html");
  await page.locator(".alex-launcher").click();
  const panel = page.getByRole("dialog", { name: "Ask Alex" });
  await expect(panel).toBeVisible();
  await expect(panel.locator(".alex-msg.alex-bot").first()).toContainText("Hi, I'm Alex.");
  const chips = panel.locator(".alex-suggest button");
  expect(await chips.count()).toBeGreaterThanOrEqual(3);

  await panel.locator(".alex-suggest button", { hasText: "What does E1 cost?" }).click();
  await expect(panel.locator(".alex-msg.alex-me")).toHaveText("What does E1 cost?");
  await expect(panel.locator(".alex-msg.alex-bot b")).toHaveText("$795");
  await expect(panel.locator(".alex-msg.alex-bot li")).toHaveText(["Editor", "Viewer"]);
  // New suggestions follow the question, without the one asked.
  await expect(panel.locator(".alex-suggest button", { hasText: "What does E1 cost?" })).toHaveCount(0);
  expect(await panel.locator(".alex-suggest button").count()).toBeGreaterThanOrEqual(3);
  expect(a.asked[0]).toMatchObject({ lang: "en", page: "about.html", messages: [{ role: "user", content: "What does E1 cost?" }] });

  // Typed, sent with Enter; the whole conversation goes with it.
  await panel.getByRole("textbox", { name: "Your question" }).fill("Does it run on a Mac?");
  await panel.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(panel.locator(".alex-msg.alex-me").nth(1)).toHaveText("Does it run on a Mac?");
  await expect(panel.locator(".alex-msg.alex-bot").last()).toContainText("plant engineering software");
  expect(a.asked[1].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);

  // The conversation follows to the next page.
  await panel.getByRole("link", { name: "Get E1" }).click();
  await expect(page).toHaveURL(/\/download\.html$/);
  await page.locator(".alex-launcher").click();
  await expect(page.getByRole("dialog", { name: "Ask Alex" }).locator(".alex-msg.alex-me")).toHaveCount(2);
});

test("the send button sends; an empty question is not sent", async ({ page }) => {
  const a = assistant({});
  await mockApi(page, a.routes);
  await page.goto("/index.html");
  await page.locator(".alex-launcher").click();
  const panel = page.getByRole("dialog", { name: "Ask Alex" });
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.locator(".alex-msg.alex-me")).toHaveCount(0);
  await panel.getByRole("textbox", { name: "Your question" }).fill("Hello");
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.locator(".alex-msg.alex-me")).toHaveText("Hello");
  expect(a.asked).toHaveLength(1);
});

test("New conversation clears it; Close and Escape close the panel; reload keeps the conversation", async ({ page }) => {
  await mockApi(page, assistant({}).routes);
  await page.goto("/index.html");
  await page.locator(".alex-launcher").click();
  const panel = page.getByRole("dialog", { name: "Ask Alex" });
  await panel.getByRole("textbox", { name: "Your question" }).fill("Hi");
  await panel.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(panel.locator(".alex-msg.alex-bot")).toHaveCount(1);
  await page.reload();
  await page.locator(".alex-launcher").click();
  await expect(panel.locator(".alex-msg.alex-me")).toHaveText("Hi");
  await panel.getByRole("button", { name: "New conversation" }).click();
  await expect(panel.locator(".alex-msg.alex-me")).toHaveCount(0);
  await expect(panel.locator(".alex-msg.alex-bot")).toContainText("Hi, I'm Alex.");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.locator(".alex-launcher").click();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
});

test("not connected, busy or failing: Alex says so", async ({ page }) => {
  const states = [
    [503, "I'm not connected yet."],
    [429, "That was a lot of questions in a short time."],
    [500, "Sorry, I couldn't answer just now."]
  ];
  let i = 0;
  await page.route("https://app.lanxtor.com/api/site/assistant", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    const [status] = states[i++];
    return route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" });
  });
  await page.goto("/index.html");
  await page.locator(".alex-launcher").click();
  const panel = page.getByRole("dialog", { name: "Ask Alex" });
  for (let n = 0; n < states.length; n++) {
    await panel.getByRole("textbox", { name: "Your question" }).fill("Question " + n);
    await panel.getByRole("textbox", { name: "Your question" }).press("Enter");
    await expect(panel.locator(".alex-msg.alex-bot").nth(n)).toContainText(states[n][1]);
  }
});

test("Alex speaks the page's language (German)", async ({ page }) => {
  const a = assistant({});
  await mockApi(page, a.routes);
  await page.goto("/de/index.html");
  await page.locator(".alex-launcher").click();
  const panel = page.locator(".alex-panel");
  await expect(panel).toBeVisible();
  await panel.locator("textarea").fill("Was kostet E1?");
  await panel.locator("textarea").press("Enter");
  await expect(panel.locator(".alex-msg.alex-me")).toHaveText("Was kostet E1?");
  await expect.poll(() => a.asked.length).toBe(1);
  expect(a.asked[0].lang).toBe("de");
});

test("Alex speaks the page's language (Chinese)", async ({ page }) => {
  const a = assistant({});
  await mockApi(page, a.routes);
  await page.goto("/zh/index.html");
  await page.locator(".alex-launcher").click();
  const panel = page.locator(".alex-panel");
  await expect(panel).toBeVisible();
  await panel.locator("textarea").fill("E1 多少钱？");
  await panel.locator("textarea").press("Enter");
  await expect(panel.locator(".alex-msg.alex-me")).toHaveText("E1 多少钱？");
  await expect.poll(() => a.asked.length).toBe(1);
  expect(a.asked[0].lang).toBe("zh");
});

test("the panel fits the screen (a phone's, too)", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator(".alex-launcher").click();
  const box = await page.locator(".alex-panel").boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  await expect(page.locator(".alex-panel textarea")).toBeInViewport();
});
