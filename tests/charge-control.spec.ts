import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {CHARGE_CONTROL_CUT, prerequisiteText, skillLevels, SKILLS, unmetPrerequisites, weaponCycleAt} from '../content/skills';
import {MODULES} from '../content/modules';

// Step 7 of design/content-tree.md: the first new skill, Charge Control. Each
// level cuts the weapon cycle by 4% (until 2026-11-16 it cut Cap per shot, which
// the balance probe found changed no fight). It is rank 2 (twice the training time)
// and needs Gunnery III, so it is the first skill with a prerequisite.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
// The four skills a save had before step 7: Charge Control is missing and loads at 0.
const OLD_SKILLS = (gunnery: number) => ({mining: 0, gunnery, shieldOp: 0, navigation: 0});
const ZERO = {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, signalAnalysis: 0};

test('catalog: Charge Control is a rank 2 Gunnery skill after Gunnery III, cutting the weapon cycle 4% a level', () => {
  expect(SKILLS.chargeControl).toEqual({
    id: 'chargeControl',
    name: 'Charge Control',
    category: 'Gunnery',
    rank: 2,
    prerequisites: [{skill: 'gunnery', level: 3}],
  });
  expect(prerequisiteText(unmetPrerequisites({gunnery: 2}, 'chargeControl'))).toBe('Gunnery III');
  expect(unmetPrerequisites({gunnery: 3}, 'chargeControl')).toEqual([]);
  expect(CHARGE_CONTROL_CUT).toBe(0.04);
  // Cycle seconds at levels 0 to 5, to 0.1 s: at V a shot every 0.8 of the time, 25% more damage a second.
  const levels = [0, 1, 2, 3, 4, 5];
  expect(levels.map((l) => weaponCycleAt(MODULES.lance_driver.stats.cycleSec!, l))).toEqual([4, 3.8, 3.7, 3.5, 3.4, 3.2]);
  expect(levels.map((l) => weaponCycleAt(MODULES.light_cannon.stats.cycleSec!, l))).toEqual([3, 2.9, 2.8, 2.6, 2.5, 2.4]);
  // A save from before a skill existed loads it at 0.
  expect(skillLevels({mining: 2, gunnery: 3})).toEqual({...ZERO, mining: 2, gunnery: 3});
  expect(skillLevels(undefined)).toEqual(ZERO);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: before Gunnery III, Charge Control says what it needs and Enter does not queue it', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, skills: OLD_SKILLS(2)});
  await enterGame(page);
  // The old save is written back with Charge Control at 0.
  await expect.poll(async () => (await readSave(page))!.skills).toEqual({...ZERO, gunnery: 2});
  await openSkills(page);

  const gunnery = page.getByTestId('skill-category-Gunnery');
  await expect(gunnery).toContainText('CHARGE CONTROL');
  await expect(gunnery).toContainText('Needs: Gunnery III');
  await expect(gunnery.getByRole('button', {name: 'NEEDS GUNNERY III'})).toBeDisabled();

  // Keyboard order is Mining, Laser Tuning, Low Profile, Gunnery, Charge Control: Enter on the fifth is refused.
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await settle(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000); // past one autosave
  expect((await readSave(page))!.trainingQueue).toEqual([]);
  // The keys work: back up to Mining, and Enter queues it.
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.trainingQueue.map((q: {skillId: string}) => q.skillId)).toEqual(['mining']);
  expectClean(problems);
});

test('skills screen: at Gunnery III, Charge Control I queues for 100 MARKS and takes 2:00, twice a rank 1 skill', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, skills: OLD_SKILLS(3)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);

  const gunnery = page.getByTestId('skill-category-Gunnery');
  // The "Needs:" line stays once met (design 4.5); only the button changes.
  await expect(gunnery).toContainText('Needs: Gunnery III');
  await expect(gunnery.getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await gunnery.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'chargeControl', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('charge control V: the fitted Lance Driver fires every 3.2 s, not 4, and a reload keeps the level', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    skills: {...OLD_SKILLS(3), chargeControl: 5},
    fitting: {hangar: {light_cannon: 1}, fitted: ['miner_mk1', null, null, 'lance_driver'], loadouts: {}},
  });
  await enterGame(page);

  // Ship stats on the Fitting screen read the same weapon stats combat uses.
  const cannonRow = async () => {
    await settle(page);
    await page.keyboard.press('2');
    await expect(page.getByTestId('fitting-slot-3')).toContainText('Lance Driver');
    // Gunnery III on a Ferrier: 47 × 1.3 = 61.1, shown as 61.
    await expect(page.getByText('61 dmg / 3.2s · 14 Cap')).toBeVisible();
  };
  await cannonRow();
  await expect.poll(async () => (await readSave(page))!.skills.chargeControl).toBe(5);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect((await readSave(page))!.skills.chargeControl).toBe(5);
  await cannonRow();
  expectClean(problems);
});
