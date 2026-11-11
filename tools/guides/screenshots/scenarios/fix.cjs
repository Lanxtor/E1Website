// statusbar writes statusbar-full.png; make-statusbar.py turns it into the two-strip statusbar.png.
module.exports = {
  async menus(h) {
    const p = h.page; await h.open();
    for (const m of ['File', 'Edit', 'Help']) {
      const b = p.locator('.menubar').getByRole('button', { name: m, exact: true });
      await b.click();
      const menu = p.getByRole('menu', { name: m }); await menu.waitFor();
      await p.mouse.move(1430, 600); await p.waitForTimeout(200);
      await h.shot('menu-' + m.toLowerCase(), { clip: [menu, b], pad: 1 });
      await p.keyboard.press('Escape'); await p.mouse.click(1430, 600); await p.waitForTimeout(200);
    }
  },
  async treeMenus(h) {
    const p = h.page; await h.open();
    const tree = p.getByRole('tree');
    for (const [loc, name] of [[tree.getByRole('treeitem', { name: 'Assets', exact: true }).last(), 'tree-menu-assets'], [tree.locator('[data-node-id="project"]').first(), 'tree-menu-project'], [tree.getByRole('treeitem', { name: 'Pump1', exact: true }), 'tree-menu-object']]) {
      await loc.click({ button: 'right', position: { x: 40, y: 10 } });
      const m = p.getByRole('menu').first(); await m.waitFor();
      await p.mouse.move(1430, 600); await p.waitForTimeout(200);
      await h.shot(name, { clip: m, pad: 1 });
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    }
  },
  async symbolMenu(h) {
    const p = h.page; await h.open();
    await p.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab', { name: /Assets/ }).click();
    const s = p.locator('[data-pick="symbol"][aria-label="Pump1"]'); await s.waitFor(); const bb = await s.boundingBox();
    await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { button: 'right' });
    const m = p.getByRole('menu').first(); await m.waitFor(); await p.mouse.move(1430, 600); await p.waitForTimeout(200);
    await h.shot('symbol-menu', { clip: m, pad: 1 });
  },
  async shortcuts(h) {
    const p = h.page; await h.open();
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();
    await p.getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
    const d = p.getByRole('dialog', { name: 'Keyboard shortcuts' }); await d.waitFor();
   
    await h.shot('help-shortcuts', { clip: d, pad: 2 });
  },
  async underConstruction(h) {
    const p = h.page; await h.open();
    await p.locator('.menubar').getByRole('button', { name: 'Help' }).click();
    await p.getByRole('menuitem', { name: 'Under construction' }).click();
    await p.waitForTimeout(1500);
    await h.shot('help-under-construction');
  },
  async alex(h) {
    const p = h.page; await h.open();
    await p.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab', { name: /Assets/ }).click();
    await p.getByRole('button', { name: 'Let Alex help' }).click();
    await p.waitForTimeout(4000);
    await h.shot('alex-on');
  },
  async cloudAi(h) {
    const p = h.page; await h.open();
    await p.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab', { name: /Assets/ }).click();
    await p.locator('[data-tour="alex-mode-ask"]').click();
    await p.waitForTimeout(1000);
    await h.shot('cloud-ai');
  },
  async rail(h) {
    const p = h.page; await h.open();
    const rail = p.getByRole('navigation', { name: 'Application' });
    const btns = [rail.getByRole('button', { name: /^Inbox/ }), rail.getByRole('button', { name: 'Explorer' }), rail.getByRole('button', { name: 'Alex' }), rail.getByRole('button', { name: 'Configuration' }), rail.getByRole('button', { name: 'Settings' }), rail.getByRole('button', { name: 'Signed-in user' })];
    await h.mark(btns, { pad: 2, label: ['1', '2', '3', '4', '5', '6'] });
    await h.shot('rail');
  },
  async configModel(h) {
    const p = h.page; await h.open();
    await p.getByRole('navigation', { name: 'Application' }).getByRole('button', { name: /^Configuration/ }).first().click();
    await p.getByRole('navigation', { name: 'Configuration sections' }).getByRole('button', { name: /AI help/ }).click();
    await p.waitForTimeout(1200);
    await h.shot('config-cloud-ai-model');
  },
  async places(h) {
    const p = h.page; await h.open();
    const rail = p.getByRole('navigation', { name: 'Application' });
    for (const [n, f] of [['Inbox', 'place-inbox'], ['Configuration', 'place-configuration'], ['Settings', 'place-settings'], ['Signed-in user', 'place-account']]) {
      await rail.getByRole('button', { name: new RegExp('^' + n) }).first().click();
      await p.waitForTimeout(1200);
      await h.shot(f);
    }
  },
  async tour(h) {
    const p = h.page; await h.open();
    const box = async (l) => l.first().boundingBox();
    const tabs = await box(p.getByRole('tablist', { name: 'Open tabs' }));
    const editor = await box(p.locator('.editor'));
    const work = { x: editor.x, y: tabs.y + tabs.height + 2, width: editor.width, height: editor.y + editor.height - tabs.y - tabs.height - 4 };
    await h.mark([p.locator('.menubar'), p.getByRole('navigation', { name: 'Application' }), p.getByRole('tree'), tabs, work, p.locator('aside.side-panel'), p.locator('footer.statusbar')], { label: ['1', '2', '3', '4', '5', '6', '7'], pad: 0 });
    await h.shot('shell-tour');
  },
  async statusbar(h) {
    const p = h.page; await h.open();
    await h.shot('statusbar-full', { clip: p.locator('footer.statusbar'), pad: 0 });
  },
};
