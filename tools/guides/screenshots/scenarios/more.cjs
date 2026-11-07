const tree = (p) => p.getByRole('tree');
const toSheet = async (p) => { await p.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab', { name: /Assets/ }).click(); await p.waitForTimeout(800); };
const conf = async (p, section) => { await p.getByRole('navigation', { name: 'Application' }).getByRole('button', { name: 'Configuration' }).click(); await p.waitForTimeout(800); if (section) { await p.getByRole('navigation', { name: 'Configuration sections' }).getByRole('button', { name: new RegExp('^' + section) }).click(); await p.waitForTimeout(1000); } };
async function sym(p, name) { const s = p.locator(`[data-pick="symbol"][aria-label="${name}"]`); await s.waitFor(); const b = await s.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
module.exports = {
  async drawing(h) {
    const p = h.page; await h.open(); await toSheet(p);
    const tb = p.getByRole('toolbar', { name: 'Drawing' });
    await h.shot('sheet-toolbar', { clip: [p.locator('.editor').locator('.drawing-chrome, [role=toolbar]').first(), tb], pad: 6 }).catch(() => {});
    await p.getByRole('button', { name: 'Object', exact: true }).click();
    const aw = p.getByRole('dialog', { name: 'Add asset' }); await aw.waitFor();
    await aw.getByRole('tree', { name: 'Asset class' }).getByRole('treeitem', { name: 'Pump', exact: true }).locator('.cfg-row-main').click();
    await p.waitForTimeout(600);
    await h.shot('asset-window');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await tb.getByRole('button', { name: 'Layers' }).click();
    await p.waitForTimeout(400);
    await h.shot('layers-menu', { clip: p.getByRole('menu', { name: 'Layers' }), pad: 40 });
    await p.keyboard.press('Escape');
    const a = await sym(p, 'Pump1');
    await p.mouse.click(a.x, a.y); await p.waitForTimeout(500);
    await h.shot('sheet-selected');
    await p.keyboard.press('Escape'); await p.mouse.click(a.x, a.y, { button: 'right' }); await p.waitForTimeout(500);
    await p.getByRole('menuitem', { name: /^Highlight flow/ }).first().click();
    await p.waitForTimeout(800);
    await h.shot('flow-highlight');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: 'Connector', exact: true }).click();
    await p.waitForTimeout(400);
    await h.mark(p.getByRole('button', { name: 'Connector', exact: true }));
    await h.shot('connector-on');
  },
  async alex(h) {
    const p = h.page; await h.open(); await toSheet(p);
    await p.getByRole('button', { name: 'Turn Alex on' }).click();
    await p.waitForTimeout(4000);
    await h.shot('alex-on');
    await p.getByRole('tab', { name: 'Cloud AI' }).click();
    await p.waitForTimeout(800);
    await h.shot('cloud-ai');
  },
  async query(h) {
    const p = h.page; await h.open();
    await tree(p).locator('[data-node-id="project:assets"]').first().click({ button: 'right', position: { x: 40, y: 10 } });
    await p.getByRole('menuitem', { name: 'Query', exact: true }).click();
    await h.shot('query-submenu', { clip: p.getByRole('menu', { name: 'Query' }), pad: 60 });
    await p.getByRole('menu', { name: 'Query' }).getByRole('menuitem', { name: 'New query…' }).click();
    const v = p.getByLabel('Query view'); await v.waitFor(); await p.waitForTimeout(800);
    await h.shot('query-view');
    await v.getByRole('button', { name: 'Columns' }).click();
    await p.waitForTimeout(500);
    await h.shot('query-columns');
    await p.keyboard.press('Escape'); await p.mouse.click(700, 880);
    const fb = v.getByRole('button', { name: /^Filter/ }).first();
    if (await fb.count()) { await fb.click(); await p.waitForTimeout(600); await h.shot('query-filter'); }
  },
  async documents(h) {
    const p = h.page; await h.open();
    await p.request.post('http://localhost:5173/api/query/templates/save', { data: { project: 'project', savedFor: 'project', name: 'Pumps', definition: { name: 'Pumps', source: { type: 'below', classes: ['plant.class.equipment.pump.centrifugal'] }, columns: [{ source: 'attribute', attr: 'plant.attr.design-pressure' }] } } });
    await tree(p).getByRole('treeitem', { name: /^Revisions(,|$)/ }).click({ button: 'right' });
    await p.getByRole('menuitem', { name: 'New document…' }).click();
    const picker = p.getByRole('dialog', { name: 'New object in Revisions' }); await picker.waitFor();
    await h.shot('new-document-dialog', { clip: picker });
    await picker.getByRole('textbox', { name: 'Search classes' }).fill('list');
    await picker.getByRole('option', { name: /^List document/ }).click();
    const named = picker.getByRole('textbox', { name: 'Name' }); if (await named.count()) await named.fill('Pump list');
    await picker.getByRole('button', { name: 'Create' }).click();
    const panel = p.getByRole('region', { name: 'Revisions' }); await panel.waitFor();
    await panel.getByRole('group', { name: 'What this list shows' }).getByRole('combobox', { name: 'Saved query' }).selectOption({ label: 'Pumps' });
    await panel.getByRole('button', { name: 'New revision' }).click();
    await p.waitForTimeout(400);
    await h.shot('revision-new-form');
    await panel.getByRole('form', { name: 'New revision' }).getByRole('button', { name: 'Add revision' }).click();
    await p.waitForTimeout(600);
    p.once('dialog', (d) => d.accept());
    await panel.getByRole('button', { name: 'Issue A' }).click();
    await panel.getByRole('button', { name: 'PDF of A' }).waitFor({ timeout: 15000 });
    await p.waitForTimeout(600);
    await h.shot('document-issued');
  },
  async sheetPdf(h) {
    const p = h.page; await h.open(); await toSheet(p);
    await p.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await p.getByRole('menuitem', { name: 'Export PDF…' }).click();
    await p.waitForTimeout(1200);
    await h.shot('sheet-pdf-dialog');
  },
  async datasheet(h) {
    const p = h.page; await h.open();
    await p.waitForTimeout(1500); await tree(p).getByRole('treeitem', { name: /^Pump1/ }).first().click();
    await p.locator('.menubar').getByRole('button', { name: 'Data', exact: true }).click();
    await p.getByRole('menuitem', { name: 'Datasheet…' }).click();
    await p.waitForTimeout(1500);
    await h.shot('datasheet');
  },
  async config(h) {
    const p = h.page; await h.open(); await conf(p);
    const secs = await p.getByRole('navigation', { name: 'Configuration sections' }).getByRole('button').allInnerTexts();
    console.log('CONF', JSON.stringify(secs));
    for (const s of secs) { const n = s.split('\n')[0].trim(); try { await p.getByRole('navigation', { name: 'Configuration sections' }).getByRole('button', { name: new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click(); await p.waitForTimeout(1000); await h.shot('config-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-')); } catch (e) { console.log('skip', n); } }
  },
  async org(h) {
    const p = h.page; await h.open();
    await p.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await p.getByRole('menuitem', { name: 'Organization…' }).click();
    await p.waitForTimeout(1500);
    await h.shot('organization-dialog');
  },
};
