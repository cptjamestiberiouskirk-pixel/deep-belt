import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, launch, mineState, openWithSave, readSave, RICH, selectTarget, settle, targetPanel, tuneLaser, watch} from './helpers';
import {LASER_TUNING_CUT, minerCycleAt, prerequisiteText, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 10 of design/content-tree.md: Laser Tuning, an Extraction skill. Each
// level cuts the mining cycle by 4%, so ore comes faster. Rank 2, after Mining III.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (mining: number, laserTuning = 0) => ({
  skills: {mining, laserTuning, gunnery: 0, chargeControl: 0, shieldOp: 0, navigation: 0, cargoTrim: 0},
});

test('catalog: Laser Tuning is a rank 2 Extraction skill after Mining III, cutting the cycle 4% a level', () => {
  expect(SKILLS.laserTuning).toEqual({
    id: 'laserTuning',
    name: 'Laser Tuning',
    category: 'Extraction',
    rank: 2,
    prerequisites: [{skill: 'mining', level: 3}],
  });
  expect(prerequisiteText(unmetPrerequisites({mining: 2}, 'laserTuning'))).toBe('Mining III');
  expect(unmetPrerequisites({mining: 3}, 'laserTuning')).toEqual([]);
  expect(LASER_TUNING_CUT).toBe(0.04);
  // The MK1's 10 s cycle and the MK2's 8 s, at levels 0 to 5, to 0.1 s.
  expect([0, 1, 2, 3, 4, 5].map((l) => minerCycleAt(10, l))).toEqual([10, 9.6, 9.2, 8.8, 8.4, 8]);
  expect([0, 1, 2, 3, 4, 5].map((l) => minerCycleAt(8, l))).toEqual([8, 7.7, 7.4, 7, 6.7, 6.4]);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('skills screen: before Mining III Laser Tuning says what it needs; at Mining III I queues for 100 MARKS and 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  const extraction = page.getByTestId('skill-category-Extraction');
  await expect(extraction).toContainText('LASER TUNING');
  await expect(extraction).toContainText('Needs: Mining III');
  await expect(extraction.getByRole('button', {name: 'NEEDS MINING III'})).toBeDisabled();
  await expect(extraction).toContainText('-0% cycle time (Miner MK1: 10.0 s)');
  expectClean(problems);
});

test('skills screen: at Mining III, Laser Tuning I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(3)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  const extraction = page.getByTestId('skill-category-Extraction');
  await expect(extraction.getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await extraction.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'laserTuning', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('ship stats: Laser Tuning V shows an 8.0 s mining cycle on the MK1', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(3, 5)});
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  await expect(page.getByText('Mining cycle', {exact: true}).locator('..')).toHaveText('Mining cycle8.0 s');
  expectClean(problems);
});

test('mining: at Laser Tuning V the MK1 cycles in 8 s, not 10, and the ore arrives', async ({page}) => {
  test.setTimeout(120_000);
  const problems = await launch(page, SKILLS_AT(3, 5));
  await flyTo(page, 'Belt One');
  await selectTarget(page, /Asteroid/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 30_000}).toMatch(/Locked/);
  await tuneLaser(page);
  const held = async () => Number((await page.innerText('body')).match(/(\d+)\/\d+m³/)![1]);
  const before = await held();
  await page.keyboard.press('1');
  // The Mine button's cycle comes from the same function that ends a cycle in flight.
  await expect.poll(() => mineState(page), {timeout: 5_000}).toMatch(/cycling \d+\/8s/);
  await expect.poll(held, {timeout: 15_000}).toBeGreaterThan(before);
  expectClean(problems);
});
