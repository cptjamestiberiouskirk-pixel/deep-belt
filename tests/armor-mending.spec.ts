import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {ARMOR_MENDING_HP_PER_SEC, armorMendRateAt, SKILLS} from '../content/skills';

// Step 48 of design/content-tree.md (designed in step 41): Armor Mending, a rank 2
// Defense skill after Armor Layering V. Armor comes back in space at 0.2 HP a
// second per level, so 1 HP/s at V, after the same 4 s without a hit that holds
// the shield back, and never past max armor. Hull still comes back only at a station.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (armorLayering: number, armorMending: number, gunnery = 0) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering, armorMending, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0},
});

test('catalog: Armor Mending is a rank 2 Defense skill after Armor Layering V, 0.2 armor HP a second per level', () => {
  expect(SKILLS.armorMending).toEqual({id: 'armorMending', name: 'Armor Mending', category: 'Defense', rank: 2, prerequisites: [{skill: 'armorLayering', level: 5}]});
  expect(ARMOR_MENDING_HP_PER_SEC).toBe(0.2);
  // Every level pinned, to 0.1 so 3 x 0.2 reads 0.6 and not 0.6000000000000001.
  expect([0, 1, 2, 3, 4, 5].map(armorMendRateAt)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: at Armor Layering IV, Armor Mending shows under Defense and needs Armor Layering V', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4, 0)});
  await enterGame(page);
  await openSkills(page);
  const card = page.getByTestId('skill-card-armorMending');
  await expect(page.getByTestId('skill-category-Defense')).toContainText('ARMOR MENDING');
  await expect(card).toContainText('Needs: Armor Layering V');
  await expect(card).toContainText('+0.0 armor HP/s in space (hull only at a station)');
  await expect(card.getByRole('button', {name: 'NEEDS ARMOR LAYERING V'})).toBeDisabled();
  expectClean(problems);
});

test('skills screen: at Armor Layering V, level I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5, 0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);
  const card = page.getByTestId('skill-card-armorMending');
  await expect(card.getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'armorMending', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at level V the card shows 1 armor HP a second', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5, 5)});
  await enterGame(page);
  await openSkills(page);
  await expect(page.getByTestId('skill-card-armorMending')).toContainText('+1.0 armor HP/s in space (hull only at a station)');
  expectClean(problems);
});

type Ship = {shield: number; armor: number; maxArmor: number; hull: number; docked: boolean};
const player = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Ship);
const vael = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.vaelPirate() as {isAlive: boolean});

/**
 * Fights the Vael Heavy Pirate Frigate in a Ferrier with a Lance Driver II at
 * Gunnery V and Armor Layering V (120 max armor, no armor module), which wins
 * with no hull lost (design/content-tree.md, step 39's table), and returns the
 * ship right after the kill. Nothing else in the Vael Belt fires at it after that.
 * (A Lance Driver at Gunnery III with no armor module loses this fight.)
 */
async function winVaelFight(page: Page, armorMending: number): Promise<Ship> {
  await openWithSave(page, {...BASE, ...SKILLS_AT(5, armorMending, 5), fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'lance_driver_ii'], loadouts: {}}, missionIndex: 3, missionStatus: 'completed', hasGatePermit: true});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  await flyTo(page, 'Vael Belt');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Heavy Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Heavy Pirate Frigate/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  // Ends at the kill, or early if the ship is lost (towed home, so docked).
  await expect.poll(async () => !(await vael(page)).isAlive || (await player(page)).docked, {timeout: 180_000, intervals: [100]}).toBe(true);
  const p = await player(page);
  expect(p.docked, 'the ship should win, not be towed home').toBe(false);
  // The fight has to take armor down, or there is nothing to mend (PLAYBOOK "Probing a module's effect").
  expect(p.maxArmor).toBe(120);
  expect(p.armor, 'the fight should leave armor down').toBeLessThan(p.maxArmor - 20);
  return p;
}

test('in play, untrained: armor stays where the fight left it', async ({page}) => {
  test.setTimeout(300_000);
  await winVaelFight(page, 0);
  // Past the 4 s delay, then 10 s more: the shield comes back, armor does not.
  await page.waitForTimeout(6000);
  const a = await player(page);
  await page.waitForTimeout(10_000);
  const b = await player(page);
  expect(b.shield, 'the shield still regenerates').toBeGreaterThan(a.shield);
  expect(b.armor).toBe(a.armor);
  expect(b.hull).toBe(a.hull);
});

test('in play, Armor Mending V: armor comes back at 1 HP a second up to max armor, and hull does not', async ({page}) => {
  test.setTimeout(400_000);
  const k = await winVaelFight(page, 5);
  await page.waitForTimeout(6000);
  const a = await player(page);
  await page.waitForTimeout(10_000);
  const b = await player(page);
  // 10 s at 1 HP/s; the game caps a frame at 0.05 s, so a slow frame can only lose a little.
  expect(b.armor - a.armor).toBeGreaterThan(8);
  expect(b.armor - a.armor).toBeLessThan(10.5);
  expect(b.hull, 'hull comes back only at a station').toBe(k.hull);
  // It stops at max armor and stays there.
  await expect.poll(async () => (await player(page)).armor, {timeout: 140_000, intervals: [1000]}).toBe(120);
  await page.waitForTimeout(3000);
  expect((await player(page)).armor).toBe(120);
});
