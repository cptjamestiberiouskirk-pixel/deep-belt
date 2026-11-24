import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {LANCE_DRIVER_II_DAMAGE, LIGHT_CANNON_II_DAMAGE, MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {toLegacy, type Slots} from '../content/fitting';

// Step 39 of design/content-tree.md: Light Cannon II, the tier step of the Light
// Cannon (rule 3). 45 damage a shot, not 30, for the same 3 s cycle, 8 km and
// 8 Cap, behind Gunnery V. 1,500 MARKS at the station market; one only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (gunnery: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0},
});
const fitting = (fitted: Slots) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN: Slots = ['miner_mk1', null, null, 'light_cannon'];
const CANNON_II: Slots = ['miner_mk1', null, null, 'light_cannon_ii'];

test('catalog: Light Cannon II is a weapon for 1,500 MARKS behind Gunnery V, the card after the Light Cannon', () => {
  expect(LIGHT_CANNON_II_DAMAGE).toBe(45);
  expect(MODULES.light_cannon_ii).toMatchObject({
    name: 'Light Cannon II',
    group: 'Projectile weapons',
    tier: 2,
    slot: 'weapon',
    basePrice: 1500,
    statBadge: '45 dmg / 3s',
    stats: {damage: 45, cycleSec: 3, rangeKm: 8, capPerCycle: 8},
    requires: {skill: 'gunnery', level: 5},
  });
  expect(MODULES.light_cannon_ii.maxOwned).toBeUndefined(); // one only
  // The first tier is unchanged: the same cycle, range and Cap, two thirds the damage.
  expect(MODULES.light_cannon.stats).toEqual({damage: 30, cycleSec: 3, rangeKm: 8, capPerCycle: 8});
  expect(MODULES.light_cannon.requires).toBeUndefined();
  // Step 38's order: per second it stays under Lance Driver II (15 against 17.5), and it costs less.
  expect(LIGHT_CANNON_II_DAMAGE / 3).toBeLessThan(LANCE_DRIVER_II_DAMAGE / 4);
  expect(MODULES.light_cannon_ii.basePrice).toBeLessThan(MODULES.lance_driver_ii.basePrice);
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'miner_mk3', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'bulk_hold_ii', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({gunnery: 4}, 'light_cannon_ii')).toBe('Gunnery V');
  expect(missingSkill({gunnery: 5}, 'light_cannon_ii')).toBeNull();
  // Any fitted weapon arms the same Fire controls as the Light Cannon.
  const legacy = toLegacy({hangar: {}, fitted: CANNON_II, loadouts: {}});
  expect(legacy.upgrades.cannon).toBe(true);
  expect(legacy.fittedSlots.slot4Cannon).toBe(true);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('market: at Gunnery IV the Light Cannon II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-light_cannon_ii');
  await expect(card).toContainText('Light Cannon II');
  await expect(card).toContainText('45 dmg / 3s');
  await expect(card).toContainText('1,500');
  await expect(card).toContainText('Needs Gunnery V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('light cannon II: at Gunnery V bought, fitted in place of the cannon, hits for 68, kept on reload', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...fitting(PLAIN)});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Buy: the Ferrier's weapon slot holds the Light Cannon, so it waits in the hangar.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-light_cannon_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText('Light Cannon II stored')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar.light_cannon_ii).toBe(1);
  expect((await readSave(page))!.marks).toBe(before.marks - 1500);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  // Fit: unfit the cannon, then fit Light Cannon II from the hangar list.
  await openTab(page, '2', /^FITTING$/);
  await settle(page);
  await page.getByTestId('fitting-slot-3').getByRole('button', {name: 'Unfit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBeNull();
  await page.getByTestId('hangar-light_cannon_ii').getByRole('button', {name: 'Fit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBe('light_cannon_ii');
  await expect(page.getByTestId('fitting-slot-3')).toContainText('Light Cannon II');
  expect((await readSave(page))!.fitting.hangar).toEqual({light_cannon: 1});
  // Gunnery V on a Ferrier: 45 x 1.5 = 67.5, rounded to 68.
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('68 dmg / 3s');
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted, same damage.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted[3]).toBe('light_cannon_ii');
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText('68 dmg / 3s');
  expectClean(problems);
});

// The probe's role split (step 39): at Gunnery V a raider (60 shield, 40 armor,
// 30 hull) takes two Light Cannon II shots of 68, three s apart, the same count as
// Lance Driver II's four-second 105s, so the cannon clears a wave first. The
// Target panel shows shield and hull: after the first shot 0/60 and 30/30, and
// the second kills; the shots are counted from the Cap. A damage or HP change that
// makes it one shot or three fails here.
test('light cannon II: at Gunnery V a raider dies to the second shot', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...fitting(CANNON_II), cargoFerrite: 240});
  await enterGame(page);
  // Dumping ore on the market brings a raider wave.
  await openTab(page, '1', 'Sell cargo');
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  const alive = () => page.evaluate(() => ((window as any).__DEEP_BELT_PROBE__.raiders() as unknown[]).length);
  await expect.poll(alive, {timeout: 20_000}).toBe(2);
  // Picked from the Overview, not with Tab: the raiders come in about 7.5 km out.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText(/^Raider \d+$/).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider/);
  const raiderHp = async () => {
    const text = await page.innerText('body');
    const s = text.match(/SHIELD\s*\n\s*(\d+)\/60\b/);
    const h = text.match(/HULL\s*\n\s*(\d+)\/30\b/);
    return s && h ? `${s[1]}/${h[1]}` : null;
  };
  await expect.poll(raiderHp).toBe('60/30');
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  // The panel shows no armor, so the shots are counted too: each takes 8 Cap at
  // once, while Cap refills at about 2.5 a second.
  const cap = () => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player().capacitor as number);
  let lastCap = await cap();
  let shots = 0;
  await page.keyboard.press('2');
  // Every shield/hull reading until the first raider is gone. A reading counts only
  // while both raiders are alive before and after it, so it is never the second one's.
  const seen: string[] = ['60/30'];
  await expect.poll(async () => {
    const before = await alive();
    const hp = await raiderHp();
    const after = await alive();
    // Cap is read last: a shot that kills before the read above shows in it, and one
    // after leaves `after` at 2, so the next poll counts it.
    const c = await cap();
    if (lastCap - c > 4) shots++;
    lastCap = c;
    if (before === 2 && after === 2 && hp && hp !== seen[seen.length - 1]) seen.push(hp);
    return after;
  }, {timeout: 60_000, intervals: [100]}).toBe(1);
  expect(seen).toEqual(['60/30', '0/30']);
  expect(shots).toBe(2);
  expectClean(problems);
});
