import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {BOOSTER_EFFICIENCY_CUT, boosterCapAt, prerequisiteText, SKILLS, unmetPrerequisites} from '../content/skills';
import {MODULES} from '../content/modules';

// Step 13 of design/content-tree.md: Booster Efficiency, a Defense skill. Each
// level cuts the Shield Booster's Cap per cycle by 8% (25 to 15 at V), so an
// active booster drains the capacitor more slowly. Rank 2, after Shield Operation II.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (shieldOp: number, boosterEfficiency = 0) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp, boosterEfficiency, navigation: 0, cargoTrim: 0},
});
const BOOSTED = {fitting: {hangar: {}, fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], loadouts: {}}};

test('catalog: Booster Efficiency is a rank 2 Defense skill after Shield Operation II', () => {
  expect(SKILLS.boosterEfficiency).toEqual({
    id: 'boosterEfficiency',
    name: 'Booster Efficiency',
    category: 'Defense',
    rank: 2,
    prerequisites: [{skill: 'shieldOp', level: 2}],
  });
  expect(prerequisiteText(unmetPrerequisites({shieldOp: 1}, 'boosterEfficiency'))).toBe('Shield Operation II');
  expect(unmetPrerequisites({shieldOp: 2}, 'boosterEfficiency')).toEqual([]);
  expect(BOOSTER_EFFICIENCY_CUT).toBe(0.08);
  // One booster's Cap per cycle at levels 0 to 5, and two boosters' together.
  const levels = [0, 1, 2, 3, 4, 5];
  expect(levels.map((l) => boosterCapAt(MODULES.shield_booster.stats.capPerCycle!, l))).toEqual([25, 23, 21, 19, 17, 15]);
  expect(levels.map((l) => boosterCapAt(50, l))).toEqual([50, 46, 42, 38, 34, 30]);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: before Shield Operation II, Booster Efficiency says what it needs and what it gives', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  await openSkills(page);
  const defense = page.getByTestId('skill-category-Defense');
  await expect(defense).toContainText('BOOSTER EFFICIENCY');
  await expect(defense).toContainText('Needs: Shield Operation II');
  await expect(defense.getByRole('button', {name: 'NEEDS SHIELD OPERATION II', exact: true})).toBeDisabled();
  await expect(defense).toContainText('-0% booster Cap (25 Cap a cycle)');
  expectClean(problems);
});

test('skills screen: at Shield Operation II, Booster Efficiency I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);
  // Scoped to the card: Armor Mending, also under Defense, needs Armor Layering V (step 48).
  await expect(page.getByTestId('skill-card-boosterEfficiency').getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await page.getByTestId('skill-card-boosterEfficiency').getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'boosterEfficiency', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

type Probe = {capacitor: number; boosterActive: boolean};
const probe = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Probe);

/** Turns the booster on in space and returns the Cap its first cycle took. */
async function boosterDrop(page: Page): Promise<number> {
  let before = NaN;
  // Keys right after undocking can be swallowed: press until the booster is on,
  // but never once it is on, or a late press would turn it off again.
  await expect(async () => {
    if (!(await probe(page)).boosterActive) {
      before = (await probe(page)).capacitor;
      await page.keyboard.press('3');
    }
    await expect.poll(async () => (await probe(page)).boosterActive, {timeout: 1000}).toBe(true);
  }).toPass({timeout: 15_000});
  return before - (await probe(page)).capacitor;
}

// Cap comes back at 2.5 a second, so a reading taken a few frames late is off by under 1.5.
test('space: at Booster Efficiency V the booster takes 15 Cap a cycle, and its button says so', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 5), ...BOOSTED});
  await enterGame(page);
  await undock(page);
  const drop = await boosterDrop(page);
  expect(Math.abs(drop - 15)).toBeLessThanOrEqual(1.5);
  await expect(page.locator('button[title^="Boost [3]"]')).toHaveAttribute('title', /, 15 Cap\)$/);
  expectClean(problems);
});

test('space: a save from before Booster Efficiency loads it at 0, and the booster takes 25 Cap', async ({page}) => {
  const problems = watch(page);
  // No boosterEfficiency key, as a save written before step 13.
  await openWithSave(page, {...BASE, skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 2, navigation: 0, cargoTrim: 0}, ...BOOSTED});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.skills.boosterEfficiency).toBe(0);
  await undock(page);
  const drop = await boosterDrop(page);
  expect(Math.abs(drop - 25)).toBeLessThanOrEqual(1.5);
  await expect(page.locator('button[title^="Boost [3]"]')).toHaveAttribute('title', /, 25 Cap\)$/);
  expectClean(problems);
});
