// Usage: node run.cjs <scenarioFile> [names...]
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
// Environment: E1_GUIDE_WORK = a work folder holding store/base.json (the demo workspace);
// screenshots go to $E1_GUIDE_WORK/shots. BASE = the running app (default http://localhost:5173/).
// See docs/USER-GUIDES.md, Screenshots. Run with NODE_PATH pointing at an E1 checkout's node_modules.
const S = process.env.E1_GUIDE_WORK || path.resolve('guide-work');
const OUT = S + '/shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:5173/';
const scen = require(path.resolve(process.argv[2]));
const only = process.argv.slice(3);

function helpers(page, log) {
  const h = {
    page,
    async ready() { await page.locator('.save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); },
    async open(url = BASE) {
      await page.goto(url);
      // A new user accepts the E1 Terms and License Agreement first.
      const terms = page.getByRole('checkbox', { name: /accept the E1 Terms and License Agreement/ });
      if (await terms.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
        await terms.check();
        await page.getByRole('button', { name: 'Accept and continue' }).click();
      }
      await h.ready();
    },
    reset() {
      const store = S + '/store';
      for (const name of fs.readdirSync(store)) if (name !== 'base.json') fs.rmSync(path.join(store, name), { recursive: true, force: true });
      fs.copyFileSync(store + '/base.json', store + '/db.json');
    },
    async mark(locators, opts = {}) {
      const boxes = [];
      for (const l of [].concat(locators)) { const b = (l && l.width !== undefined) ? l : await l.first().boundingBox(); if (b) boxes.push(b); }
      await page.evaluate(({ boxes, pad, label }) => {
        boxes.forEach((b, i) => {
          const d = document.createElement('div'); d.className = '__guide_mark';
          Object.assign(d.style, { position: 'fixed', left: (b.x - pad) + 'px', top: (b.y - pad) + 'px', width: (b.width + 2 * pad) + 'px', height: (b.height + 2 * pad) + 'px', border: '3px solid #ff3b6b', borderRadius: '6px', zIndex: 2147483647, pointerEvents: 'none', boxShadow: '0 0 0 3px rgba(255,59,107,.25)' });
          if (boxes.length > 1 || label) { const n = document.createElement('span'); n.textContent = label ? label[i] ?? (i + 1) : (i + 1); Object.assign(n.style, { position: 'absolute', left: (b.width > 60 ? 6 : -12) + 'px', top: (b.width > 60 ? 6 : -12) + 'px', background: '#ff3b6b', color: '#fff', font: '700 14px/24px system-ui', minWidth: '24px', height: '24px', borderRadius: '12px', textAlign: 'center', padding: '0 4px', boxShadow: '0 1px 3px rgba(0,0,0,.5)' }); d.appendChild(n); }
          document.body.appendChild(d);
        });
      }, { boxes, pad: opts.pad ?? 4, label: opts.label });
    },
    async unmark() { await page.evaluate(() => document.querySelectorAll('.__guide_mark').forEach((e) => e.remove())); },
    async shot(name, opts = {}) {
      if (!opts.keepPointer) await page.mouse.move(1439, 470);
      await page.waitForTimeout(opts.wait ?? 400);
      const png = `${OUT}/${name}.png`;
      let clip;
      if (opts.clip) {
        const els = [].concat(opts.clip); let x1 = 1e9, y1 = 1e9, x2 = 0, y2 = 0;
        for (const l of els) { const b = (l && l.width !== undefined) ? l : await l.first().boundingBox(); if (!b) continue; x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.width); y2 = Math.max(y2, b.y + b.height); }
        const pad = opts.pad ?? 4; const vp = page.viewportSize();
        clip = { x: Math.max(0, x1 - pad), y: Math.max(0, y1 - pad) }; clip.width = Math.min(vp.width, x2 + pad) - clip.x; clip.height = Math.min(vp.height, y2 + pad) - clip.y;
      }
      await page.screenshot({ path: png, clip });
      await h.unmark();
      log.push(name);
      console.log('shot', name);
    },
  };
  return h;
}

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, fn] of Object.entries(scen)) {
    if (only.length && !only.includes(name)) continue;
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    const log = [];
    const h = helpers(page, log);
    h.reset();
    try { await fn(h); console.log('OK', name); }
    catch (e) { console.log('FAIL', name, e.message.split('\n').slice(0, 6).join(' | ')); await page.screenshot({ path: `${OUT}/_fail-${name}.png` }); }
    await ctx.close();
  }
  await b.close();
})();
