import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {BULK_HOLD_II_BONUS, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {fittedSpeedMult, fittedTotal} from '../content/fitting';

// Step 40 of design/content-tree.md: Bulk Hold II, the tier step of the Bulk Hold
// (rule 3). +1,350 hold, not +900, for the same 20% speed, behind Cargo Trim V.
// 4,000 MARKS at the station market; one only. Fitted with the Bulk Hold, the two
// slowdowns add up.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (cargoTrim: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 2, cargoTrim},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
// Base holds (content/hulls.ts): a Ferrier holds 600 m³.
const FERRIER_HOLD = 600;
const PAIR = ['miner_mk1', 'bulk_hold', 'bulk_hold_ii', 'light_cannon'] as const;

test('catalog: Bulk Hold II is a utility module for 4,000 MARKS behind Cargo Trim V, the card after the Bulk Hold', () => {
  expect(BULK_HOLD_II_BONUS).toBe(1350);
  expect(MODULES.bulk_hold_ii).toMatchObject({
    name: 'Bulk Hold II',
    group: 'Cargo expanders',
    tier: 3,
    slot: 'utility',
    basePrice: 4000,
    statBadge: '+1,350 hold, -20% speed',
    stats: {cargoM3: 1350, speedPct: -20},
    requires: {skill: 'cargoTrim', level: 5},
  });
  expect(MODULES.bulk_hold_ii.maxOwned).toBeUndefined(); // one only
  // The first tier is unchanged: 900 for the same 20%, no skill, one only.
  expect(MODULES.bulk_hold.stats).toEqual({cargoM3: 900, speedPct: -20});
  expect(MODULES.bulk_hold.requires).toBeUndefined();
  expect(MODULES.bulk_hold.maxOwned).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'miner_mk3', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'bulk_hold_ii', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({cargoTrim: 4}, 'bulk_hold_ii')).toBe('Cargo Trim V');
  expect(missingSkill({cargoTrim: 5}, 'bulk_hold_ii')).toBeNull();
  // Alone it costs the Bulk Hold's 20%; with the Bulk Hold the two add up to 40%.
  expect(fittedSpeedMult(['miner_mk1', 'bulk_hold_ii', null, 'light_cannon'])).toBe(0.8);
  expect(fittedTotal([...PAIR], 'cargoM3')).toBe(2250);
  expect(fittedSpeedMult([...PAIR])).toBeCloseTo(0.6, 10);
  // A Gantry's three utility slots with both and an Expanded Hold II: 3,000 more, still 40%.
  const gantry = ['miner_mk1', 'bulk_hold', 'bulk_hold_ii', 'expanded_hold_ii', 'light_cannon'] as const;
  expect(fittedTotal([...gantry], 'cargoM3')).toBe(3000);
  expect(fittedSpeedMult([...gantry])).toBeCloseTo(0.6, 10);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('market: at Cargo Trim IV the Bulk Hold II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-bulk_hold_ii');
  await expect(card).toContainText('Bulk Hold II');
  await expect(card).toContainText('+1,350 hold, -20% speed');
  await expect(card).toContainText('4,000');
  await expect(card).toContainText('Needs Cargo Trim V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The first tier next to it needs no skill.
  await expect(page.getByTestId('market-card-bulk_hold').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('bulk hold II: at Cargo Trim V bought into a free slot, a Ferrier holds 1,950 m³ at 20% less speed, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  expect(before.cargoMax).toBe(FERRIER_HOLD);

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-bulk_hold_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('bulk_hold_ii');
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks - 4000);
  expect(after.cargoMax).toBe(FERRIER_HOLD + 1350);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  const checkFitting = async () => {
    await openTab(page, '2', /^FITTING$/);
    await expect(page.getByTestId('ship-stat-cargo')).toContainText('1,950 m³');
    await expect(page.getByTestId('ship-stat-cargo')).toContainText('(+1,350)');
    // Navigation II (Cargo Trim's prerequisite) adds 20% (content/flight.ts), so
    // 88 x 1.2 x 0.8 = 84.5 px/s = 1.69 km/s; the -20% is the module's own. The value holds
    // its change in a nested span, so match the row as a whole.
    await expect(page.getByText('Max speed', {exact: true}).locator('..')).toHaveText('Max speed1.69 km/s(-20%)');
    await page.keyboard.press('Escape');
  };
  await checkFitting();

  // Reload (docked): still fitted, the hold still 1,950.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  const reloaded = (await readSave(page))!;
  expect(reloaded.fitting.fitted).toContain('bulk_hold_ii');
  expect(reloaded.cargoMax).toBe(FERRIER_HOLD + 1350);
  await checkFitting();
  expectClean(problems);
});

test('hold: a Ferrier with the Bulk Hold and II fitted holds 2,850 m³ at 40% less speed', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), fitting: {hangar: {}, fitted: [...PAIR], loadouts: {}}});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(2850);
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cargo')).toContainText('2,850 m³');
  await expect(page.getByTestId('ship-stat-cargo')).toContainText('(+2,250)');
  // With Navigation II: 88 x 1.2 x 0.6 = 63.4 px/s = 1.27 km/s.
  await expect(page.getByText('Max speed', {exact: true}).locator('..')).toHaveText('Max speed1.27 km/s(-40%)');
  expectClean(problems);
});
