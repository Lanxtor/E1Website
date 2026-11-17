/*
 * Shared set-up of the screen tests.
 *
 * - Nothing leaves the test machine: every request that is not to the local
 *   test server is answered here. The E1 server (E1_CONFIG.apiBase,
 *   https://app.lanxtor.com) answers 503 unless a test mocks it with
 *   mockApi(); the release manifest in the downloads storage answers 404, so
 *   the pages use assets/data/releases.json; anything else is aborted.
 * - A test fails on any error a page throws, and on any Content Security
 *   Policy violation (the server sends the site's real policy).
 * - The cookie notice is acknowledged unless a test asks for it
 *   (test.use({ cookieNotice: true })).
 */
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const API = "https://app.lanxtor.com";

export const test = base.extend({
  cookieNotice: [false, { option: true }],
  /** Errors the page threw (and CSP violations); checked after each test. */
  pageErrors: async ({}, use) => { await use([]); },
  /** Every request a page sent to the E1 server: { method, path, body }. */
  apiCalls: async ({}, use) => { await use([]); },

  context: async ({ context, cookieNotice }, use) => {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.fallback();
      if (url.origin === API) {
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "The E1 cloud is not available in the tests." } }) });
      }
      if (url.hostname === "e1downloads.blob.core.windows.net" && url.pathname.endsWith("/releases.json")) {
        return route.fulfill({ status: 404, body: "" });
      }
      return route.abort("blockedbyclient");
    });
    if (!cookieNotice) {
      await context.addInitScript(() => {
        try { if (!localStorage.getItem("e1.cookies")) localStorage.setItem("e1.cookies", "necessary"); } catch (e) { /* storage blocked */ }
      });
    }
    await use(context);
  },

  page: async ({ page, pageErrors, apiCalls }, use) => {
    page.on("pageerror", (err) => pageErrors.push(String(err && err.stack || err)));
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) pageErrors.push("CSP: " + msg.text());
    });
    page.on("request", (req) => {
      if (req.url().startsWith(API)) {
        apiCalls.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postData() });
      }
    });
    await use(page);
    expect(pageErrors, "errors on the page").toEqual([]);
  }
});

export { expect };

/**
 * Answers the E1 server's routes for this page:
 *   mockApi(page, { "GET /api/account/overview": data, "POST /auth/logout": { ok: true } })
 * A value may be a function (request) => body, or { status, body } via respond().
 * Routes not listed answer 404 with the server's error shape.
 */
export async function mockApi(page, routes) {
  await page.route(API + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const origin = (await req.headerValue("origin")) || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Accept, X-E1-CSRF",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    const key = req.method() + " " + url.pathname;
    let hit = routes[key];
    if (hit === undefined) {
      return route.fulfill({ status: 404, contentType: "application/json", headers: cors, body: JSON.stringify({ error: { code: "not_found", message: "No such route." } }) });
    }
    if (typeof hit === "function") hit = await hit(req, url);
    const r = hit && hit.__respond ? hit : { status: 200, body: hit };
    return route.fulfill({ status: r.status, contentType: "application/json", headers: cors, body: JSON.stringify(r.body) });
  });
}

/** A response with its own status: respond(401, { error: {...} }). */
export function respond(status, body) {
  return { __respond: true, status, body };
}

/** The site's pages listed in sitemap.xml, as paths ("/de/index.html"). */
export function sitemapPaths() {
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

/** The page scrolls sideways (wider than the screen)? */
export async function sideways(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export function isPhone(testInfo) {
  return testInfo.project.name === "phone";
}

/** Opens the menu on a phone (the hamburger), nothing on a desktop. */
export async function openMenu(page, testInfo) {
  if (isPhone(testInfo)) {
    if (/nav-open/.test((await page.locator("body").getAttribute("class")) || "")) return;
    await page.locator(".nav-toggle").click();
    await expect(page.locator("body")).toHaveClass(/nav-open/);
  }
}

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}
