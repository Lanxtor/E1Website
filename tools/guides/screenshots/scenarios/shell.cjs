module.exports = {
  async overview(h) {
    const p = h.page; await h.open();
    await h.shot('shell-overview');
    // numbered tour
    await h.mark([p.locator('.menubar'), p.getByRole('navigation', { name: 'Application' }), p.getByRole('tree'), p.getByRole('tablist', { name: 'Open tabs' }), p.locator('.editor-panel, .editor').first(), p.locator('.chat-panel, .side-panel, aside').last(), p.locator('footer.statusbar')], { label: ['1','2','3','4','5','6','7'] });
    await h.shot('shell-tour');
  },
  async helpDialogs(h) {
    const p = h.page; await h.open();
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();

    await p.getByRole('menuitem', { name: 'About E1' }).click();
    const a = p.getByRole('dialog', { name: 'E1' }); await a.waitFor();
    await h.shot('help-about', { clip: a });
    await a.getByRole('button', { name: 'Close' }).click();
  },
  async hidePanels(h) {
    const p = h.page; await h.open();
    await p.getByRole('button', { name: 'Hide explorer' }).click();
    await p.waitForTimeout(300);
    const rail = p.getByRole('navigation', { name: 'Application' });
    await rail.getByRole('button', { name: 'Alex and Cloud AI' }).click();
    await p.waitForTimeout(500);
    await h.mark([rail.getByRole('button', { name: 'Explorer' }), rail.getByRole('button', { name: 'Alex and Cloud AI' })]);
    await h.shot('panels-hidden');
  },
};
