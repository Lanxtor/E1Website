const tree = (p) => p.getByRole('tree');
const assetsRow = (p) => tree(p).getByRole('treeitem', { name: 'Assets', exact: true }).last();
async function openPump(h, tab) {
  const p = h.page;
  await tree(p).getByRole('treeitem', { name: 'Pump1', exact: true }).dblclick();
  await p.getByRole('heading', { name: 'Pump1', level: 1 }).waitFor();
  if (tab) await p.getByRole('tablist', { name: 'Object views' }).getByRole('tab', { name: new RegExp('^' + tab) }).click();
  await p.waitForTimeout(600);
}
async function sym(p, name) { const s = p.locator(`[data-pick="symbol"][aria-label="${name}"]`); await s.waitFor(); const b = await s.boundingBox(); return { s, x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
module.exports = {
  async newAsset(h) {
    const p = h.page; await h.open();
    await assetsRow(p).click({ button: 'right', position: { x: 40, y: 10 } });
    await p.getByRole('menuitem', { name: 'New asset…' }).click();
    const d = p.getByRole('dialog', { name: 'New object in Assets' }); await d.waitFor();
    await h.shot('new-asset-dialog', { clip: d });
    await d.getByRole('textbox', { name: 'Search classes' }).fill('centrifugal');
    await d.getByRole('tree', { name: 'Classes' }).getByRole('button', { name: 'Centrifugal pump', exact: true }).click();
    await p.waitForTimeout(400);
    await h.shot('new-asset-centrifugal', { clip: d });
    await d.getByRole('button', { name: 'Create' }).click();
    await p.waitForTimeout(1200);
    await h.shot('object-new-pump');
  },
  async objectTabs(h) {
    const p = h.page; await h.open();
    await openPump(h);
    await h.shot('object-page');
    const tabs = p.getByRole('tablist', { name: 'Object views' });
    const names = await tabs.getByRole('tab').allInnerTexts();
    console.log('TABS', JSON.stringify(names));
    for (const n of names) {
      const first = n.trim().split('\n')[0]; const t = tabs.getByRole('tab', { name: new RegExp('^' + first) });
      await t.click(); await p.waitForTimeout(700);
      await h.shot('object-tab-' + n.trim().split('\n')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
  },
  async deepView(h) {
    const p = h.page; await h.open();
    if (!(await assetsRow(p).getAttribute('aria-expanded'))?.includes('true')) await assetsRow(p).getByRole('button').first().click().catch(() => {});
    await tree(p).getByRole('treeitem', { name: 'V3', exact: true }).click({ button: 'right' });
    await p.getByRole('menuitem', { name: 'Open', exact: true }).click();
    await p.getByRole('tablist', { name: 'Object views' }).getByRole('tab', { name: 'Deep view' }).click();
    const view = p.getByRole('region', { name: 'Deep view' });
    await view.getByRole('button', { name: 'Expand all' }).click();
    await view.getByRole('status').filter({ hasText: 'nothing more to show' }).waitFor();
    await view.getByRole('textbox', { name: 'Find in view' }).fill('Pump1');
    await view.getByRole('button', { name: /^Pump1, / }).click();
    await view.getByRole('textbox', { name: 'Find in view' }).fill('');
    await view.getByRole('button', { name: 'Highlight route' }).click();
    await view.getByRole('button', { name: 'Fit' }).click();
    await p.locator('.object-window-pane').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(300);
    await h.mark(p.locator('[data-tour="deep-view-tools"]'), { pad: 4 });
    await h.shot('object-tab-deep-view', { clip: view, pad: 6 });
  },
  async comments(h) {
    const p = h.page; await h.open();
    await openPump(h, 'Chat');
    const box = p.getByRole('textbox', { name: 'Chat message' });
    await box.click(); await p.keyboard.type('Check the design pressure against #V3', { delay: 30 }); await p.waitForTimeout(500);
    await p.getByRole('listbox', { name: 'Objects' }).getByRole('button', { name: /V3/ }).first().click().catch(()=>{}); await p.waitForTimeout(300);
    await box.press('Control+Enter');
    await p.waitForTimeout(800);
    const comments = p.getByRole('list', { name: 'Chat' });
    await comments.getByRole('button', { name: 'Reply' }).click();
    await p.getByRole('textbox', { name: 'Reply' }).fill('16 bar(g), same as V3.');
    await p.getByRole('button', { name: 'Reply', exact: true }).last().click();
    await p.waitForTimeout(500);
    await comments.getByRole('button', { name: /^Like/ }).first().click();
    await p.waitForTimeout(500);
    await h.shot('comments-thread');
    await p.getByRole('button', { name: 'New task…' }).first().click().catch(() => {});
    await p.waitForTimeout(500);
    const f = p.getByRole('form', { name: 'New task' });
    if (await f.count()) { await p.getByRole('textbox', { name: 'Task title' }).fill('Check the seal'); await h.shot('task-new', { clip: f, pad: 8 }); await f.getByRole('button', { name: 'Create task' }).click(); await p.waitForTimeout(600); }
    await p.getByRole('navigation', { name: 'Application' }).getByRole('button', { name: /^Inbox/ }).click();
    await p.waitForTimeout(1000);
    await h.shot('inbox');
    await p.getByRole('tablist', { name: 'Inbox views' }).getByRole('tab', { name: 'I assigned' }).click();
    await p.waitForTimeout(600);
    await h.shot('inbox-assigned');
  },
  async history(h) {
    const p = h.page; await h.open();
    await openPump(h);
    // rename via heading? use F2 on tree
    await tree(p).getByRole('treeitem', { name: 'Pump1', exact: true }).click();
    await p.keyboard.press('F2');
    await p.keyboard.press('Control+a'); await p.keyboard.type('Feed pump'); await p.keyboard.press('Enter');
    await p.waitForTimeout(1000);
    await tree(p).getByRole('treeitem', { name: 'Feed pump', exact: true }).dblclick().catch(() => {});
    await p.waitForTimeout(800);
    const tabs = p.getByRole('tablist', { name: 'Object views' });
    await tabs.getByRole('tab', { name: /^History/ }).click().catch(() => {});
    await p.waitForTimeout(800);
    await h.shot('object-history');
  },
  async sheetPin(h) {
    const p = h.page; await p.setViewportSize({ width: 1440, height: 1100 }); await h.open();
    await p.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab', { name: /Assets/ }).click();
    const { x, y } = await sym(p, 'Pump1');
    await p.mouse.click(x, y, { button: 'right' });
    const m = p.getByRole('menu').first(); await m.waitFor();
    
    await p.getByRole('menuitem', { name: 'Chat here' }).click();
    const f = p.getByRole('form', { name: 'Pin a message' }); await f.waitFor();
    await f.getByRole('textbox', { name: 'Chat message' }).fill('Check the NPSH margin');
    await h.shot('pin-form', { clip: f, pad: 40 });
    await f.getByRole('button', { name: 'Pin message' }).click();
    await p.waitForTimeout(1000);
    await h.mark(tree(p).getByRole('treeitem', { name: /^Pump1, Needs review/ }));
    await h.shot('pin-needs-review');
  },
  async packages(h) {
    const p = h.page; await h.open();
    await tree(p).locator('[data-node-id="project"]').first().click({ position: { x: 40, y: 10 } });
    await p.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await p.getByRole('menuitem', { name: 'Project settings…' }).click();
    await p.waitForTimeout(1500);
    await h.shot('project-settings');
    const sections = await p.locator('.editor h2, .editor h3').allInnerTexts();
    console.log('SECTIONS', JSON.stringify(sections));
  },
};
