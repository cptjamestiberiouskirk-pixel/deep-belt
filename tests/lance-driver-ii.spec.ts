import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, flyTo, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {LANCE_DRIVER_II_DAMAGE, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {toLegacy, type Slots} from '../content/fitting';

// Step 38 of design/content-tree.md: Lance Driver II, the tier step of the Lance
// Driver (rule 3). 70 damage a shot, not 47, for the same 4 s cycle, 12 km and
// 14 Cap, behind Gunnery V. 3,750 MARKS at the station market; one only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (gunnery: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0},
});
const fitting = (fitted: Slots) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN: Slots = ['miner_mk1', null, null, 'light_cannon'];
const LANCE_II: Slots = ['miner_mk1', null, null, 'lance_driver_ii'];

test('catalog: Lance Driver II is a weapon for 3,750 MARKS behind Gunnery V, the last module card', () => {
  expect(LANCE_DRIVER_II_DAMAGE).toBe(70);
  expect(MODULES.lance_driver_ii).toMatchObject({
    name: 'Lance Driver II',
    group: 'Projectile weapons',
    tier: 3,
    slot: 'weapon',
    basePrice: 3750,
    statBadge: '70 dmg / 4s',
    stats: {damage: 70, cycleSec: 4, rangeKm: 12, capPerCycle: 14},
    requires: {skill: 'gunnery', level: 5},
  });
  expect(MODULES.lance_driver_ii.maxOwned).toBeUndefined(); // one only
  // The first tier is unchanged: the same cycle, range and Cap, two thirds the damage.
  expect(MODULES.lance_driver.stats).toEqual({damage: 47, cycleSec: 4, rangeKm: 12, capPerCycle: 14});
  expect(MODULES.lance_driver.requires).toEqual({skill: 'gunnery', level: 2});
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({gunnery: 4}, 'lance_driver_ii')).toBe('Gunnery V');
  expect(missingSkill({gunnery: 5}, 'lance_driver_ii')).toBeNull();
  // Any fitted weapon arms the same Fire controls as the Light Cannon.
  const legacy = toLegacy({hangar: {}, fitted: LANCE_II, loadouts: {}});
  expect(legacy.upgrades.cannon).toBe(true);
  expect(legacy.fittedSlots.slot4Cannon).toBe(true);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('market: at Gunnery IV the Lance Driver II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-lance_driver_ii');
  await expect(card).toContainText('Lance Driver II');
  await expect(card).toContainText('70 dmg / 4s');
  await expect(card).toContainText('Needs Gunnery V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The first tier next to it needs only Gunnery II.
  await expect(page.getByTestId('market-card-lance_driver').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('lance driver II: at Gunnery V bought, fitted in place of the cannon, hits for 105, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Buy: the Ferrier's weapon slot holds the Light Cannon, so it waits in the hangar.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-lance_driver_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText('Lance Driver II stored')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar.lance_driver_ii).toBe(1);
  expect((await readSave(page))!.marks).toBe(before.marks - 3750);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  // Fit: unfit the cannon, then fit Lance Driver II from the hangar list.
  await openTab(page, '2', /^FITTING$/);
  await settle(page);
  await page.getByTestId('fitting-slot-3').getByRole('button', {name: 'Unfit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBeNull();
  await page.getByTestId('hangar-lance_driver_ii').getByRole('button', {name: 'Fit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBe('lance_driver_ii');
  await expect(page.getByTestId('fitting-slot-3')).toContainText('Lance Driver II');
  // Gunnery V on a Ferrier: 70 x 1.5 = 105.
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('105 dmg / 4s');
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted, same damage.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted[3]).toBe('lance_driver_ii');
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('105 dmg / 4s');
  expectClean(problems);
});

type Pirate = {isAlive: boolean; shield: number; armor: number; hull: number};
const pirate = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate() as Pirate);

// Gunnery 0 keeps the number whole: one shot is 70. The Belt Two pirate's shield
// (84) doesn't regenerate, so its first drop is one shot.
test('lance driver II: in space, one shot takes 70 off the Belt Two pirate\'s shield', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...fitting(LANCE_II)});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Belt Two');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
  const full = (await pirate(page)).shield;
  expect(full).toBe(84);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  // The next shot is 4 s after the first, so the first value under 84 is one shot.
  await expect.poll(async () => (await pirate(page)).shield, {timeout: 60_000, intervals: [100]}).toBeLessThan(full);
  expect(full - (await pirate(page)).shield).toBe(LANCE_DRIVER_II_DAMAGE);
  expectClean(problems);
});
