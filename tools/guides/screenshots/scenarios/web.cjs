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
      await p.evaluate((id) => { document.getElementById(id)?.scrollIntoView(); document.querySelectorAll('[class*=alex-launcher]').forEach((e) => e.style.display = 'none'); }, s); await p.waitForTimeout(600);
      await h.shot('web-account-' + s);
    }
    await p.goto(B + 'training.html?demo=1&course=e1-fundamentals'); await p.waitForTimeout(1800); await h.shot('web-training', { clip: { x: 0, y: 0, width: 1440, height: 505 } });
    await go(h, 'download.html', 'web-download');
    await go(h, 'academy.html', 'web-academy');
  },
  // Alex on the website after "What does E1 cost?". The answer is written by a language model on the
  // E1 server; here it is a fixed answer from the website's own prices, so the picture needs no server.
  async assistant(h) {
    const p = h.page;
    const reply = 'E1 is licensed per user, per month:\n\n'
      + '- **Viewer**: open, search and export\n- **Reviewer**: also comments, approvals and Alex\n'
      + '- **Editor Basic** or **Editor**: also editing, with 300 or 2,000 AI credits\n\n'
      + 'For teaching, a University organization has Editor and Viewer licenses by the month. See [licenses and prices](download.html#pricing).';
    await p.route('**/api/site/assistant', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply }) }));
    await p.goto(B + 'index.html'); await p.waitForTimeout(1200); await p.getByRole('button', { name: 'OK', exact: true }).first().click().catch(() => console.log('no banner'));
    await p.goto(B + 'academy.html'); await p.waitForTimeout(1500);
    await p.getByRole('button', { name: 'Ask Alex' }).first().click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'What does E1 cost?', exact: true }).click(); await p.waitForTimeout(1500);
    await h.shot('web-assistant');
  },
};
