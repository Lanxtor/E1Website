/*
 * System requirements for an own installation, and the servers behind the E1 Cloud:
 * Get E1's "Your cloud" box opens the requirements, which recommend dedicated cores and warn
 * against burstable databases, so a customer does not pick a database that makes E1 slow.
 */
import { test, expect, expectScrolledTo } from "./fixtures.mjs";

test("Get E1 → Your cloud: System requirements opens the sizes, the database rules and the questions", async ({ page }) => {
  await page.goto("/download.html");
  const box = page.locator("#own-servers");
  const tile = box.getByRole("link", { name: /System requirements/ });
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toBeVisible();
  await expect(tile).toContainText("The database, servers and storage your installation needs");
  await tile.click();
  await expect(page).toHaveURL(/\/installation-requirements\.html$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("System requirements for your own installation.");

  // The sizes, by engineers at once.
  const sizes = page.getByRole("table", { name: "Recommended sizes" });
  await expect(sizes.getByRole("row")).toHaveCount(5);
  const fifty = sizes.getByRole("row", { name: /Up to 50/ });
  await expect(fifty).toContainText("4 dedicated vCores, 16 GB, with a standby in another zone");
  await expect(fifty).toContainText("256 GB SSD, 1,100 IOPS");

  // The page menu jumps to the database: what to choose and what not to.
  await page.locator('.cs-nav a[href="#database"]').click();
  await expect(page).toHaveURL(/#database$/);
  await expectScrolledTo(page.locator("#database"));
  await expect(page.locator("#database")).toContainText("General Purpose (D2ds_v6 for a trial, D4ds_v6 for up to 50 engineers)");
  await expect(page.locator("#database .cs-avoid li").first()).toContainText("Burstable or shared-core databases");

  // A question opens and closes.
  await page.locator('.cs-nav a[href="#faq"]').click();
  const q = page.locator("#faq details", { hasText: "Why not a cheaper burstable database?" });
  await q.locator("summary").click();
  await expect(q).toHaveAttribute("open", "");
  await expect(q).toContainText("CPU credits");
  await q.locator("summary").click();
  await expect(q).not.toHaveAttribute("open", "");

  // Back to Get E1's Your cloud box.
  await page.getByRole("link", { name: "Your cloud" }).first().click();
  await expect(page).toHaveURL(/\/download\.html#own-servers$/);

  // Nothing wider than the screen (the sizes table scrolls inside its own frame).
  await page.goto("/installation-requirements.html");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize().width + 1);
});

test("E1 Cloud specifications: the servers behind it, linked to the system requirements", async ({ page }) => {
  await page.goto("/cloud-specifications.html");
  await page.locator('.cs-nav a[href="#performance"]').click();
  const card = page.locator(".cs-servers");
  await expect(card.getByRole("heading", { name: "The servers behind it" })).toBeVisible();
  await expect(card).toContainText("General Purpose on the newest Intel generation: dedicated cores only");
  await expect(card).toContainText("2 to 96 dedicated vCores and 8 to 384 GB of memory, raised with the engineers working at once");
  // No size of one moment is promised: the card stays true when the database grows.
  await expect(card).not.toContainText("4 dedicated vCores and 16 GB");
  // On a phone Alex's button floats over the card's last line: scroll it to the middle, as a person would.
  const link = card.getByRole("link", { name: "system requirements" });
  await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await link.click();
  await expect(page).toHaveURL(/\/installation-requirements\.html$/);
});

for (const [lang, h1, tile] of [
  ["de", "Systemanforderungen für Ihre eigene Installation.", "Systemanforderungen"],
  ["fr", "Configuration requise pour votre propre installation.", "Configuration requise"],
  ["es", "Requisitos del sistema para tu propia instalación.", "Requisitos del sistema"],
  ["no", "Systemkrav for din egen installasjon.", "Systemkrav"],
  ["zh", "自有安装的系统要求。", "系统要求"],
]) {
  test(`/${lang}/download.html: the Your cloud box opens the translated system requirements`, async ({ page }) => {
    await page.goto(`/${lang}/download.html`);
    await page.locator("#own-servers").getByRole("link", { name: new RegExp(tile) }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/installation-requirements\\.html$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    await expect(page.locator("table.cs-table tbody tr")).toHaveCount(4);
  });
}
