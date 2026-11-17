import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {freeFerriteAt, miningNoticePerSec, prerequisiteText, saleNotice, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 11 of design/content-tree.md: Low Profile, an Extraction skill. Each level
// lets 80 more Ferrite sell at once without drawing Notice and cuts the mining
// laser's Notice by 10%, so fewer raider waves come. Rank 2, after Mining II.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (mining: number, lowProfile = 0) => ({
  skills: {mining, laserTuning: 0, lowProfile, gunnery: 0, chargeControl: 0, shieldOp: 0, navigation: 0, cargoTrim: 0},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};

test('catalog: Low Profile is a rank 2 Extraction skill after Mining II', () => {
  expect(SKILLS.lowProfile).toEqual({
    id: 'lowProfile',
    name: 'Low Profile',
    category: 'Extraction',
    rank: 2,
    prerequisites: [{skill: 'mining', level: 2}],
  });
  expect(prerequisiteText(unmetPrerequisites({mining: 1}, 'lowProfile'))).toBe('Mining II');
  expect(unmetPrerequisites({mining: 2}, 'lowProfile')).toEqual([]);
  // Ferrite sold at once without Notice, levels 0 to 5.
  expect([0, 1, 2, 3, 4, 5].map(freeFerriteAt)).toEqual([200, 280, 360, 440, 520, 600]);
  // A full Ferrier hold: 1,200 Notice (capped at 100 in game) untrained, none at level V.
  expect(saleNotice(600, 0)).toBe(1200);
  expect(saleNotice(600, 5)).toBe(0);
  expect(saleNotice(300, 1)).toBe(60);
  // Mining Notice a second, levels 0 to 5.
  expect([0, 1, 2, 3, 4, 5].map(miningNoticePerSec)).toEqual([0.8, 0.72, 0.64, 0.56, 0.48, 0.4]);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('skills screen: before Mining II Low Profile says what it needs and what it gives', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  const extraction = page.getByTestId('skill-category-Extraction');
  await expect(extraction).toContainText('LOW PROFILE');
  await expect(extraction).toContainText('Needs: Mining II');
  // Exact: a substring match would also find Laser Tuning's "NEEDS MINING III".
  await expect(extraction.getByRole('button', {name: 'NEEDS MINING II', exact: true})).toBeDisabled();
  await expect(extraction).toContainText('Sell 200 Ferrite unnoticed, -0% mining Notice (0.80/s)');
  expectClean(problems);
});

test('skills screen: at Mining II, Low Profile I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  const extraction = page.getByTestId('skill-category-Extraction');
  // Laser Tuning still needs Mining III, so exactly one Extraction skill shows a Needs button.
  await expect(extraction.getByRole('button', {name: /^NEEDS/})).toHaveCount(1);
  await page.getByTestId('skill-card-lowProfile').getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'lowProfile', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

/** Sells the whole Ferrite hold at the market (its first card) and returns Notice right after. */
async function sellFerrite(page: Page) {
  await openTab(page, '1', 'MARKET');
  // Wait out the officer's line, or Enter skips it instead of selling.
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  return page.evaluate(() => Math.round((window as any).__DEEP_BELT_PROBE__.player().notice as number));
}

test('market: at Low Profile V a 600 Ferrite sale draws no Notice and no raider wave', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 5), ...PLAIN, cargoFerrite: 600});
  await enterGame(page);
  expect(await sellFerrite(page)).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  // A wave comes on the first frame in space when Notice is at 100; give it 3 s, then read once.
  await page.waitForTimeout(3000);
  expect(await page.getByText(/Raider wave inbound/).count()).toBe(0);
  expectClean(problems);
});

test('market: a save from before Low Profile loads it at 0, and a 600 Ferrite sale brings a raider wave', async ({page}) => {
  const problems = watch(page);
  // The seeded skills have no lowProfile key, as a save written before step 11.
  await openWithSave(page, {...BASE, skills: {mining: 2, laserTuning: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, navigation: 0, cargoTrim: 0}, ...PLAIN, cargoFerrite: 600});
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))!.skills.lowProfile).toBe(0);
  expect(await sellFerrite(page)).toBe(100);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
  expectClean(problems);
});
