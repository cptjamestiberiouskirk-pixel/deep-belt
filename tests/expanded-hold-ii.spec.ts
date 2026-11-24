import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {EXPANDED_HOLD_II_BONUS, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {EXPANDER_BONUS} from '../constants';
import {fittedSpeedMult, fittedTotal} from '../content/fitting';

// Step 36 of design/content-tree.md: Expanded Hold II, the tier step of the
// Expanded Hold (rule 3). +750 hold, not +500, behind Navigation V. 2,125 MARKS
// at the station market; one only. The Bulk Hold stays the side-grade.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (navigation: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation, cargoTrim: 0},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
// Base holds (content/hulls.ts): a Ferrier holds 600 m³.
const FERRIER_HOLD = 600;

test('catalog: Expanded Hold II is a utility module for 2,125 MARKS behind Navigation V', () => {
  expect(EXPANDED_HOLD_II_BONUS).toBe(750);
  expect(MODULES.expanded_hold_ii).toMatchObject({
    name: 'Expanded Hold II',
    group: 'Cargo expanders',
    tier: 2,
    slot: 'utility',
    basePrice: 2125,
    statBadge: '+750 hold',
    stats: {cargoM3: 750},
    requires: {skill: 'navigation', level: 5},
  });
  expect(MODULES.expanded_hold_ii.maxOwned).toBeUndefined(); // one only
  // Half as much hold again as the first tier, which needs no skill and can be owned three times.
  expect(MODULES.expanded_hold.stats).toEqual({cargoM3: EXPANDER_BONUS});
  expect(MODULES.expanded_hold.requires).toBeUndefined();
  expect(MODULES.expanded_hold.maxOwned).toBe(3);
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'bulk_hold_ii', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({navigation: 4}, 'expanded_hold_ii')).toBe('Navigation V');
  expect(missingSkill({navigation: 5}, 'expanded_hold_ii')).toBeNull();
  // A Ferrier's two utility slots: 1,250 with one of each tier, 1,000 with two of the first.
  expect(fittedTotal(['miner_mk1', 'expanded_hold', 'expanded_hold_ii', 'light_cannon'], 'cargoM3')).toBe(1250);
  expect(fittedTotal(['miner_mk1', 'expanded_hold', 'expanded_hold', 'light_cannon'], 'cargoM3')).toBe(1000);
  // A Gantry's three: two of the first tier and the II add up to 1,750.
  expect(fittedTotal(['miner_mk1', 'expanded_hold', 'expanded_hold', 'expanded_hold_ii', 'light_cannon'], 'cargoM3')).toBe(1750);
  // A straight upgrade: no slowdown, where the Bulk Hold's 900 costs 20% speed.
  expect(fittedSpeedMult(['miner_mk1', 'expanded_hold_ii', null, 'light_cannon'])).toBe(1);
  expect(MODULES.bulk_hold.stats).toEqual({cargoM3: 900, speedPct: -20});
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('market: at Navigation IV the Expanded Hold II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-expanded_hold_ii');
  await expect(card).toContainText('Expanded Hold II');
  await expect(card).toContainText('+750 hold');
  await expect(card).toContainText('Needs Navigation V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The first tier next to it needs no skill.
  await expect(page.getByTestId('market-card-expanded_hold').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('expanded hold II: at Navigation V bought into a free slot, a Ferrier holds 1,350 m³, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  expect(before.cargoMax).toBe(FERRIER_HOLD);

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-expanded_hold_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('expanded_hold_ii');
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks - 2125);
  expect(after.cargoMax).toBe(FERRIER_HOLD + 750);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  const checkFitting = async () => {
    await openTab(page, '2', /^FITTING$/);
    await expect(page.getByTestId('ship-stat-cargo')).toContainText('1,350 m³');
    await expect(page.getByTestId('ship-stat-cargo')).toContainText('(+750)');
    await page.keyboard.press('Escape');
  };
  await checkFitting();

  // Reload (docked): still fitted, and the hold is still 1,350.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  const reloaded = (await readSave(page))!;
  expect(reloaded.fitting.fitted).toContain('expanded_hold_ii');
  expect(reloaded.cargoMax).toBe(FERRIER_HOLD + 750);
  await checkFitting();
  expectClean(problems);
});

test('hold: an Expanded Hold II in the hangar, not fitted, adds no hold', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), fitting: {hangar: {expanded_hold_ii: 1}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(FERRIER_HOLD);
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cargo')).toContainText('600 m³');
  await expect(page.getByTestId('ship-stat-cargo')).not.toContainText('(+');
  expectClean(problems);
});

test('hold: a Ferrier with one of each tier fitted holds 600 + 500 + 750 = 1,850 m³', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), fitting: {hangar: {}, fitted: ['miner_mk1', 'expanded_hold', 'expanded_hold_ii', 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(1850);
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cargo')).toContainText('1,850 m³');
  await expect(page.getByTestId('ship-stat-cargo')).toContainText('(+1,250)');
  expectClean(problems);
});
