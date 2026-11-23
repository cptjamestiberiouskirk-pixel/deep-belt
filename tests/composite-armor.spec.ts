import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {COMPOSITE_ARMOR_HP, MARKET_MODULE_IDS, MODULES} from '../content/modules';
import {fittedTotal} from '../content/fitting';

// Step 12 of design/content-tree.md: Composite Armor, a utility module and a
// side-grade to the Shield Booster. It adds flat armor that uses no Cap, but
// armor never regenerates and the station charges to repair it. One only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
// A Ferrier's own armor (content/hulls.ts baseArmor).
const FERRIER_ARMOR = 80;

test('catalog: Composite Armor is a utility module for 900 MARKS that adds armor', () => {
  expect(MODULES.composite_armor).toMatchObject({
    name: 'Composite Armor',
    slot: 'utility',
    basePrice: 900,
    statBadge: `+${COMPOSITE_ARMOR_HP} armor`,
    stats: {armorHp: COMPOSITE_ARMOR_HP},
  });
  expect(MODULES.composite_armor.maxOwned).toBeUndefined(); // one only
  expect(MODULES.composite_armor.requires).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'bulk_hold', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'light_cannon', 'lance_driver']);
  expect(fittedTotal(['miner_mk1', 'composite_armor', 'shield_booster', 'light_cannon'], 'armorHp')).toBe(COMPOSITE_ARMOR_HP);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

/** The HUD's armor readout in space, "180/180". */
async function hudArmor(page: Page): Promise<string | null> {
  const m = (await page.innerText('body')).match(/ARMOR\s*\n\s*(\d+\/\d+)/);
  return m ? m[1] : null;
}

test('composite armor: bought into a free slot, shown in Ship stats and the HUD, kept on reload, and unfitted', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  const full = FERRIER_ARMOR + COMPOSITE_ARMOR_HP;

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-composite_armor');
  await expect(card).toContainText(`+${COMPOSITE_ARMOR_HP} armor`);
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('composite_armor');
  expect((await readSave(page))!.marks).toBe(before.marks - 900);
  await page.keyboard.press('Escape');

  // Ship stats: the hull's 80 plus the module's armor.
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-armor')).toContainText(`${full} HP`);
  await expect(page.getByTestId('ship-stat-armor')).toContainText(`(+${COMPOSITE_ARMOR_HP})`);
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted. Then in space the HUD shows the armor, full.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted).toContain('composite_armor');
  await undock(page);
  await expect.poll(() => hudArmor(page)).toBe(`${full}/${full}`);

  // Unfit it at the station: back to the hull's own armor, and to the hangar.
  await expect(async () => {
    await page.keyboard.press('f');
    await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 1500});
  }).toPass({timeout: 30_000});
  await openTab(page, '2', /^FITTING$/);
  const slot = (await readSave(page))!.fitting.fitted.indexOf('composite_armor');
  await page.getByTestId(`fitting-slot-${slot}`).getByRole('button', {name: 'Unfit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar.composite_armor).toBe(1);
  await expect(page.getByTestId('ship-stat-armor')).toContainText(`${FERRIER_ARMOR} HP`);
  await expect(page.getByTestId('ship-stat-armor')).not.toContainText('(+');
  await page.keyboard.press('Escape');
  await undock(page);
  await expect.poll(() => hudArmor(page)).toBe(`${FERRIER_ARMOR}/${FERRIER_ARMOR}`);
  expectClean(problems);
});

test('composite armor: one only, so the market offers no second one', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, fitting: {hangar: {}, fitted: ['miner_mk1', 'composite_armor', null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-composite_armor');
  await expect(card).toContainText('Composite Armor');
  await expect(card).toContainText('Owned');
  await expect(card.getByRole('button', {name: 'Buy'})).toHaveCount(0);
  expectClean(problems);
});
