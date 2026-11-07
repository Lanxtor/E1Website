const B = process.env.SITE || 'http://localhost:8000/';
const go = async (h, path, name, opts = {}) => { await h.page.goto(B + path); await h.page.waitForTimeout(opts.wait || 1800); if (opts.full) await h.page.screenshot({ path: `${(process.env.E1_GUIDE_WORK || 'guide-work') + '/shots'}/${name}.png`, fullPage: false }); else await h.shot(name); };
module.exports = {
  async site(h) {
    const p = h.page;
    await p.goto(B + 'index.html'); await p.waitForTimeout(1200); await p.getByRole('button', { name: 'OK', exact: true }).first().click().catch(() => console.log('no banner'));
    await go(h, 'login.html', 'web-login');
    await go(h, 'account.html?demo=1#overview', 'web-account-overview');
    for (const s of ['academy', 'academy-guides', 'academy-certificates', 'licenses', 'usage', 'organizations', 'projects', 'permissions', 'billing', 'downloads']) {
      await p.goto(B + 'account.html?demo=1#' + s); await p.waitForTimeout(1500);
      await p.evaluate((id) => document.getElementById(id)?.scrollIntoView(), s); await p.waitForTimeout(600);
      await h.shot('web-account-' + s);
    }
    await go(h, 'training.html?demo=1&course=e1-fundamentals', 'web-training');
    await go(h, 'download.html', 'web-download');
    await go(h, 'shape-e1.html?demo=1', 'web-shape-e1');
    await go(h, 'academy.html', 'web-academy');
  },
};
