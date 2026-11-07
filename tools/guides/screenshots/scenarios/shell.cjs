module.exports = {
  async overview(h) {
    const p = h.page; await h.open();
    await h.shot('shell-overview');
    // numbered tour
    await h.mark([p.locator('.menubar'), p.getByRole('navigation', { name: 'Application' }), p.getByRole('tree'), p.getByRole('tablist', { name: 'Open tabs' }), p.locator('.editor-panel, .editor').first(), p.locator('.chat-panel, .side-panel, aside').last(), p.locator('footer.statusbar')], { label: ['1','2','3','4','5','6','7'] });
    await h.shot('shell-tour');
  },
  async menus(h) {
    const p = h.page; await h.open();
    for (const m of ['File', 'Edit', 'View', 'Insert', 'Data', 'Help']) {
      await p.locator('.menubar').getByRole('button', { name: m, exact: true }).click();
      const menu = p.getByRole('menu', { name: m });
      await menu.waitFor();
      await h.shot('menu-' + m.toLowerCase(), { clip: [menu, p.locator('.menubar').getByRole('button', { name: m, exact: true })], pad: 12 });
      await p.keyboard.press('Escape'); await p.mouse.click(700, 500); await p.waitForTimeout(200);
    }
  },
  async helpDialogs(h) {
    const p = h.page; await h.open();
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();
    await p.getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
    const d = p.getByRole('dialog', { name: 'Keyboard shortcuts' }); await d.waitFor();
    await h.shot('help-shortcuts', { clip: d });
    await p.keyboard.press('Escape'); await p.mouse.click(5, 890);
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();
    await p.getByRole('menuitem', { name: 'About E1' }).click();
    const a = p.getByRole('dialog', { name: 'E1' }); await a.waitFor();
    await h.shot('help-about', { clip: a });
    await a.getByRole('button', { name: 'Close' }).click();
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();
    await p.getByRole('menuitem', { name: 'Under construction' }).click();
    await p.waitForTimeout(1500);
    await h.shot('help-under-construction');
  },
  async palette(h) {
    const p = h.page; await h.open();
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(500);
    await h.shot('palette-open');
    await p.keyboard.type('P-0');
    await p.waitForTimeout(700);
    await h.shot('palette-search');
  },
  async rail(h) {
    const p = h.page; await h.open();
    const rail = p.getByRole('navigation', { name: 'Application' });
    await h.shot('rail', { clip: rail, pad: 2 });
    for (const [n, f] of [['Inbox', 'place-inbox'], ['Configuration', 'place-configuration'], ['Settings', 'place-settings'], ['Signed-in user', 'place-account']]) {
      await rail.getByRole('button', { name: new RegExp('^' + n) }).first().click();
      await p.waitForTimeout(1200);
      await h.shot(f);
    }
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
  async statusbar(h) {
    const p = h.page; await h.open();
    const sb = p.locator('.status-bar, .statusbar').first();
    await h.shot('statusbar', { clip: sb, pad: 0 });
  },
};
