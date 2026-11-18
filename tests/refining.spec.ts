import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {BASE_REFINE_OUTPUT, prerequisiteText, refineOutputAt, REFINING_BONUS_PER_LEVEL, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 15 of design/content-tree.md: Refining, the first Industry skill. Each level
// adds one refined good to every 50-ore batch (25 untrained, 30 at V), for all four
// ores. Rank 2, after Mining II. Step 14 made refined sales draw Notice first.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (mining: number, refining = 0) => ({
  skills: {mining, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, navigation: 0, cargoTrim: 0, refining},
});

test('catalog: Refining is a rank 2 Industry skill after Mining II', () => {
  expect(SKILLS.refining).toEqual({
    id: 'refining',
    name: 'Refining',
    category: 'Industry',
    rank: 2,
    prerequisites: [{skill: 'mining', level: 2}],
  });
  expect(prerequisiteText(unmetPrerequisites({mining: 1}, 'refining'))).toBe('Mining II');
  expect(unmetPrerequisites({mining: 2}, 'refining')).toEqual([]);
  expect(BASE_REFINE_OUTPUT).toBe(25);
  expect(REFINING_BONUS_PER_LEVEL).toBe(1);
  expect([0, 1, 2, 3, 4, 5].map(refineOutputAt)).toEqual([25, 26, 27, 28, 29, 30]);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: before Mining II, Refining shows under Industry, says what it needs and what it gives', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  await openSkills(page);
  const industry = page.getByTestId('skill-category-Industry');
  await expect(industry).toContainText('REFINING');
  await expect(industry).toContainText('Needs: Mining II');
  await expect(industry.getByRole('button', {name: 'NEEDS MINING II', exact: true})).toBeDisabled();
  await expect(industry).toContainText('50 ore -> 25 refined (+0%)');
  expectClean(problems);
});

test('skills screen: at Mining II, Refining I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);
  await expect(page.getByTestId('skill-category-Industry').getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await page.getByTestId('skill-card-refining').getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'refining', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

/** Opens the Refinery (R) and refines the first row, Ferrite; returns the screen's batch line. */
async function refineFerrite(page: Page): Promise<string> {
  const line = page.getByText(/^50 Ore -> \d+ Refined in/);
  await settle(page);
  // Right after loading a key can be swallowed: press R until the Refinery shows, but
  // never once it does, since R inside the Refinery starts a refine.
  await expect(async () => {
    if (!(await line.isVisible())) await page.keyboard.press('r');
    await expect(line).toBeVisible({timeout: 1000});
  }).toPass({timeout: 15_000});
  const text = await line.innerText();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.inventory?.ferrite, {timeout: 15_000}).toBe(0);
  return text;
}

test('refinery: at Refining V, 50 Ferrite makes 30 Tritanium, and the Refinery says so', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 5), cargoFerrite: 50, cargoTritanium: 0});
  await enterGame(page);
  expect(await refineFerrite(page)).toMatch(/^50 Ore -> 30 Refined in 3\.0s/);
  await expect.poll(async () => (await readSave(page))!.inventory?.tritanium, {timeout: 15_000}).toBe(30);
  expectClean(problems);
});

test('refinery: a save from before Refining loads it at 0, and 50 Ferrite makes 25 Tritanium', async ({page}) => {
  const problems = watch(page);
  // No refining key, as a save written before step 15.
  await openWithSave(page, {...BASE, skills: {mining: 2, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, navigation: 0, cargoTrim: 0}, cargoFerrite: 50, cargoTritanium: 0});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.skills.refining).toBe(0);
  expect(await refineFerrite(page)).toMatch(/^50 Ore -> 25 Refined in 3\.0s/);
  await expect.poll(async () => (await readSave(page))!.inventory?.tritanium, {timeout: 15_000}).toBe(25);
  expectClean(problems);
});
