import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {FIRE_CONTROL_DAMAGE_PCT, MARKET_MODULE_IDS, MODULES} from '../content/modules';
import {fittedTotal, type Slots} from '../content/fitting';

// Step 16 of design/content-tree.md: the Fire Control Relay, a utility module
// that adds 20% to the fitted weapon's damage. A raider wave costs HP for as
// long as it lasts, so more damage shortens it; the slot then holds no hold
// space, booster or armor. One only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
// Gunnery 0 keeps the numbers whole: a Light Cannon hits for 30, or 36 with the relay.
const NO_SKILLS = {skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, refining: 0, signalAnalysis: 0}};
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN: Slots = ['miner_mk1', null, null, 'light_cannon'];
const RELAY: Slots = ['miner_mk1', 'fire_control', null, 'light_cannon'];
const CANNON = MODULES.light_cannon.stats.damage!;
const BOOSTED = Math.round(CANNON * (1 + FIRE_CONTROL_DAMAGE_PCT / 100));

test('catalog: the Fire Control Relay is a utility module for 1100 MARKS that adds 20% weapon damage', () => {
  expect(FIRE_CONTROL_DAMAGE_PCT).toBe(20);
  expect(MODULES.fire_control).toMatchObject({
    name: 'Fire Control Relay',
    slot: 'utility',
    basePrice: 1100,
    statBadge: '+20% weapon damage',
    stats: {damagePct: 20},
  });
  expect(MODULES.fire_control.maxOwned).toBeUndefined(); // one only
  expect(MODULES.fire_control.requires).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'bulk_hold', 'shield_booster', 'composite_armor', 'fire_control', 'light_cannon', 'lance_driver']);
  expect(fittedTotal(RELAY, 'damagePct')).toBe(20);
  expect(fittedTotal(PLAIN, 'damagePct')).toBe(0);
  expect([CANNON, BOOSTED]).toEqual([30, 36]);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('fire control: bought into a free slot, and Ship stats shows the Cannon\'s damage with it and without', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...NO_SKILLS, ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;

  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText(`${CANNON} dmg / 3s`);
  await expect(page.getByTestId('ship-stat-cannon')).not.toContainText('(+');
  await page.keyboard.press('Escape');

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-fire_control');
  await expect(card).toContainText('Fire Control Relay');
  await expect(card).toContainText('+20% weapon damage');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('fire_control');
  expect((await readSave(page))!.marks).toBe(before.marks - 1100);
  await page.keyboard.press('Escape');

  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText(`${BOOSTED} dmg / 3s`);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText(`(+${BOOSTED - CANNON})`);
  expectClean(problems);
});

test('fire control: one only, so the market offers no second one', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...fitting(RELAY)});
  await enterGame(page);
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-fire_control');
  await expect(card).toContainText('Fire Control Relay');
  await expect(card.getByRole('button', {name: 'Buy'})).toHaveCount(0);
  await expect(card).toContainText('Owned');
  expectClean(problems);
});

type Pirate = {isAlive: boolean; shield: number; armor: number; hull: number};
const pirate = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate() as Pirate);

// The Belt Two pirate's shield doesn't regenerate, so its first drop is one shot.
for (const c of [{name: 'without the relay', fitted: PLAIN, hit: CANNON}, {name: 'with the relay', fitted: RELAY, hit: BOOSTED}]) {
  test(`fire control: in space, a Light Cannon shot ${c.name} takes ${c.hit} off the Belt Two pirate's shield`, async ({page}) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...NO_SKILLS, ...fitting(c.fitted)});
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
    expect(full - (await pirate(page)).shield).toBe(c.hit);
    expectClean(problems);
  });
}
