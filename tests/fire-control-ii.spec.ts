import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, flyTo, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {FIRE_CONTROL_DAMAGE_PCT, FIRE_CONTROL_II_DAMAGE_PCT, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {fittedTotal, type Slots} from '../content/fitting';

// Step 35 of design/content-tree.md: Fire Control Relay II, the tier step of the
// Fire Control Relay (rule 3). +30% weapon damage, not +20%, behind Gunnery V.
// 2,750 MARKS at the station market; one only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (gunnery: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0},
});
const fitting = (fitted: Slots) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN: Slots = ['miner_mk1', null, null, 'light_cannon'];
const RELAY_II: Slots = ['miner_mk1', 'fire_control_ii', null, 'light_cannon'];
const CANNON = MODULES.light_cannon.stats.damage!;

test('catalog: Fire Control Relay II is a utility module for 2,750 MARKS behind Gunnery V', () => {
  expect(FIRE_CONTROL_II_DAMAGE_PCT).toBe(30);
  expect(MODULES.fire_control_ii).toMatchObject({
    name: 'Fire Control Relay II',
    group: 'Fire control',
    tier: 2,
    slot: 'utility',
    basePrice: 2750,
    statBadge: '+30% weapon damage',
    stats: {damagePct: 30},
    requires: {skill: 'gunnery', level: 5},
  });
  expect(MODULES.fire_control_ii.maxOwned).toBeUndefined(); // one only
  // The first tier needs no skill.
  expect(MODULES.fire_control.stats).toEqual({damagePct: FIRE_CONTROL_DAMAGE_PCT});
  expect(MODULES.fire_control.requires).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({gunnery: 4}, 'fire_control_ii')).toBe('Gunnery V');
  expect(missingSkill({gunnery: 5}, 'fire_control_ii')).toBeNull();
  expect(fittedTotal(RELAY_II, 'damagePct')).toBe(30);
  // On a Gantry next to the first tier, the two add up.
  expect(fittedTotal(['miner_mk1', 'fire_control', 'fire_control_ii', null, 'light_cannon'], 'damagePct')).toBe(50);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('market: at Gunnery IV the Fire Control Relay II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-fire_control_ii');
  await expect(card).toContainText('Fire Control Relay II');
  await expect(card).toContainText('+30% weapon damage');
  await expect(card).toContainText('Needs Gunnery V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The first tier next to it needs no skill.
  await expect(page.getByTestId('market-card-fire_control').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('fire control II: at Gunnery V bought into a free slot, the Cannon hits for 59, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Without it, Gunnery V: 30 x 1.5 = 45.
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('45 dmg / 3s');
  await page.keyboard.press('Escape');

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-fire_control_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('fire_control_ii');
  expect((await readSave(page))!.marks).toBe(before.marks - 2750);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  // With it: 30 x 1.5 x 1.3 = 58.5, shown as 59.
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('59 dmg / 3s');
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('(+29)');
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted, same damage.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted).toContain('fire_control_ii');
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('59 dmg / 3s');
  expectClean(problems);
});

test('ship stats: a Gantry with both tiers of relay adds 50%, so the Cannon hits for 45 at Gunnery 0', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS_AT(0),
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'gantry',
    ...fitting(['miner_mk1', 'fire_control', 'fire_control_ii', null, 'light_cannon']),
  });
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('45 dmg / 3s');
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('(+15)');
  expectClean(problems);
});

type Pirate = {isAlive: boolean; shield: number; armor: number; hull: number};
const pirate = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate() as Pirate);

// Gunnery 0 keeps the numbers whole: 30 x 1.3 = 39. The Belt Two pirate's shield
// doesn't regenerate, so its first drop is one shot.
test('fire control II: in space, a Light Cannon shot takes 39 off the Belt Two pirate\'s shield', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...fitting(RELAY_II)});
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
  await expect.poll(async () => (await pirate(page)).shield, {timeout: 60_000}).toBeLessThan(full);
  expect(full - (await pirate(page)).shield).toBe(Math.round(CANNON * 1.3));
  expect(Math.round(CANNON * 1.3)).toBe(39);
  expectClean(problems);
});
