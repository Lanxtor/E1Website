/*
 * Every page a visitor can open: the pages in sitemap.xml and the pages
 * reached from them (account, sign-in, course player, certificate, the
 * guide's catalog and roadmap). Each one loads with no error on the page,
 * every internal link on it leads to a page that exists (and to the part of
 * it a #fragment names), every image on it loads, and on a phone it does not
 * scroll sideways.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, sitemapPaths, sideways, isPhone, ROOT } from "./fixtures.mjs";

const EXTRA = [
  "/account.html", "/login.html", "/training.html?course=getting-started&demo=1", "/certificate.html?id=E1C-7KQ3-M9XP-2DWA&demo=1",
  "/guide-features.html", "/guide-roadmap.html", "/industries.html", "/dpa.html", "/sub-processors.html", "/e1-terms.html", "/training.html"
].filter((p) => fs.existsSync(path.join(ROOT, p.split("?")[0])));

const PAGES = [...new Set([...sitemapPaths(), ...EXTRA])];

/* The sign-in page is on its own: header, no footer. */
const NO_FOOTER = ["/login.html"];

/*
 * Clips not made yet: a clip (<figure class="clip" data-src>) whose file is
 * missing keeps its still placeholder (main.js), so the page stays whole.
 */
const PLANNED = /^\/assets\/clips\/[^/]+\.mp4$/;

/* Fragments a page's script reads instead of an element (main.js initAuthTabs). */
const SCRIPT_FRAGMENTS = { "/login.html": ["signup", "university"] };

/* Each address is checked once per worker. */
const checked = new Map();
async function status(request, url) {
  if (!checked.has(url)) checked.set(url, request.get(url, { maxRedirects: 5 }).then(async (r) => ({ status: r.status(), text: /html/.test(r.headers()["content-type"] || "") ? await r.text() : "" })));
  return checked.get(url);
}

function hasAnchor(html, id) {
  const e = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(id|name)=["']${e}["']`).test(html);
}

for (const p of PAGES) {
  test(`page ${p}`, async ({ page, request, baseURL }, testInfo) => {
    const failed = [];
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.origin === new URL(baseURL).origin && r.status() >= 400 && !PLANNED.test(u.pathname)) failed.push(r.status() + " " + u.pathname);
    });
    const res = await page.goto(p, { waitUntil: "load" });
    expect(res.status(), "the page answers").toBe(200);
    await expect(page.locator("h1").first()).toBeAttached();
    await expect(page.locator(".site-header")).toBeVisible();
    if (!NO_FOOTER.includes(p)) await expect(page.locator(".site-footer")).toBeAttached();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Every file the page loaded exists.
    expect(failed, "files the page loaded").toEqual([]);

    // No sideways scroll on a phone (or anywhere).
    if (isPhone(testInfo)) expect(await sideways(page), "page wider than the phone screen (px)").toBeLessThanOrEqual(1);

    // Images, including lazy ones not on screen yet.
    const images = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("img[src], source[srcset], video[poster], link[rel~=icon]").forEach((el) => {
        const v = el.getAttribute("src") || el.getAttribute("poster") || el.getAttribute("href") || (el.getAttribute("srcset") || "").split(/\s+/)[0];
        if (v && !v.startsWith("data:") && !v.startsWith("blob:")) out.push(new URL(v, document.baseURI).href);
      });
      return out;
    });
    const origin = new URL(baseURL).origin;
    const missingImages = [];
    for (const src of new Set(images)) {
      if (!src.startsWith(origin)) continue;
      const r = await status(request, src);
      if (r.status !== 200) missingImages.push(r.status + " " + src.slice(origin.length));
    }
    expect(missingImages, "images that do not load").toEqual([]);

    // Internal links lead to a page that exists, and to the named part of it.
    const here = page.url().split("#")[0];
    const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")]
      .map((a) => ({ href: a.getAttribute("href"), abs: a.href }))
      .filter((l) => l.href && !/^(mailto:|tel:|javascript:)/i.test(l.href)));
    const broken = [];
    const ids = new Set(await page.evaluate(() => [...document.querySelectorAll("[id],[name]")].map((e) => e.id || e.getAttribute("name"))));
    for (const l of links) {
      if (!l.abs.startsWith(origin)) continue;
      const [target, frag] = l.abs.split("#");
      if (target === here || target === here.split("?")[0] && !l.abs.includes("?")) {
        if (frag && !ids.has(decodeURIComponent(frag))) broken.push("#" + frag + " (on this page)");
        continue;
      }
      const r = await status(request, target);
      if (r.status !== 200) { broken.push(r.status + " " + l.href); continue; }
      const scripted = (SCRIPT_FRAGMENTS[new URL(target).pathname] || []).includes(frag);
      if (frag && r.text && !scripted && !hasAnchor(r.text, decodeURIComponent(frag))) broken.push("missing #" + frag + " in " + l.href);
    }
    expect([...new Set(broken)], "broken internal links").toEqual([]);
  });
}
