import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {COMPOSITE_ARMOR_HP, COMPOSITE_ARMOR_II_HP, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {fittedTotal} from '../content/fitting';
import {maxArmorAt} from '../content/skills';

// Step 34 of design/content-tree.md: Composite Armor II, the tier step of
// Composite Armor (rule 3). 150 armor HP, not 100, behind Armor Layering V.
// 2,250 MARKS at the station market; one only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (armorLayering: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering, navigation: 0, cargoTrim: 0},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
// Hull armor (content/hulls.ts baseArmor).
const FERRIER_ARMOR = 80;
const GANTRY_ARMOR = 110;

test('catalog: Composite Armor II is a utility module for 2,250 MARKS behind Armor Layering V', () => {
  expect(COMPOSITE_ARMOR_II_HP).toBe(150);
  expect(MODULES.composite_armor_ii).toMatchObject({
    name: 'Composite Armor II',
    group: 'Armor',
    tier: 2,
    slot: 'utility',
    basePrice: 2250,
    statBadge: '+150 armor',
    stats: {armorHp: 150},
    requires: {skill: 'armorLayering', level: 5},
  });
  expect(MODULES.composite_armor_ii.maxOwned).toBeUndefined(); // one only
  // Half as much armor again as the first tier, which needs no skill.
  expect(MODULES.composite_armor.stats).toEqual({armorHp: COMPOSITE_ARMOR_HP});
  expect(MODULES.composite_armor.requires).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'miner_mk3', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'bulk_hold_ii', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({armorLayering: 4}, 'composite_armor_ii')).toBe('Armor Layering V');
  expect(missingSkill({armorLayering: 5}, 'composite_armor_ii')).toBeNull();
  // On a Gantry next to the first tier, the two add up.
  expect(fittedTotal(['miner_mk1', 'composite_armor', 'composite_armor_ii', null, 'light_cannon'], 'armorHp')).toBe(250);
  // A Ferrier at Armor Layering V: 345 with the II, 270 with the first tier.
  expect(maxArmorAt(FERRIER_ARMOR, 150, 5)).toBe(345);
  expect(maxArmorAt(FERRIER_ARMOR, COMPOSITE_ARMOR_HP, 5)).toBe(270);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

/** The HUD's armor readout in space, "345/345". */
async function hudArmor(page: Page): Promise<string | null> {
  const m = (await page.innerText('body')).match(/ARMOR\s*\n\s*(\d+\/\d+)/);
  return m ? m[1] : null;
}

test('market: at Armor Layering IV the Composite Armor II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-composite_armor_ii');
  await expect(card).toContainText('Composite Armor II');
  await expect(card).toContainText('+150 armor');
  await expect(card).toContainText('Needs Armor Layering V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The first tier next to it needs no skill.
  await expect(page.getByTestId('market-card-composite_armor').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('composite armor II: at Armor Layering V bought into a free slot, 345 armor on a Ferrier, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-composite_armor_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('composite_armor_ii');
  expect((await readSave(page))!.marks).toBe(before.marks - 2250);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  // Ship stats: (80 + 150) x 1.5 at Armor Layering V.
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-armor')).toContainText('345 HP');
  await expect(page.getByTestId('ship-stat-armor')).toContainText('(+265)');
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted. In space the HUD shows the armor, full.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted).toContain('composite_armor_ii');
  await undock(page);
  await expect.poll(() => hudArmor(page)).toBe('345/345');
  expectClean(problems);
});

test('space: a Composite Armor II in the hangar, not fitted, adds no armor', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), fitting: {hangar: {composite_armor_ii: 1}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await undock(page);
  await expect.poll(() => hudArmor(page)).toBe(`${FERRIER_ARMOR}/${FERRIER_ARMOR}`);
  expectClean(problems);
});

test('space: a Gantry with both tiers of Composite Armor has 110 + 250 = 360 armor', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS_AT(0),
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'gantry',
    fitting: {hangar: {}, fitted: ['miner_mk1', 'composite_armor', 'composite_armor_ii', null, 'light_cannon'], loadouts: {}},
  });
  await enterGame(page);
  await undock(page);
  await expect.poll(() => hudArmor(page)).toBe(`${GANTRY_ARMOR + 250}/${GANTRY_ARMOR + 250}`);
  expectClean(problems);
});
