import {expect, test} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {prerequisiteText, SKILL_CATEGORY_ORDER, SKILLS, unmetPrerequisites, type SkillDef} from '../content/skills';

// Step 5 of design/content-tree.md: skills get a category, a rank and
// prerequisites (4.5). The four existing skills are rank 1 with none, so their
// times and costs do not change.

test('skills model: the four first skills are rank 1 with no prerequisites, one per category', () => {
  // Charge Control (step 7, tests/charge-control.spec.ts) is the first that is not.
  const firstFour = [SKILLS.mining, SKILLS.gunnery, SKILLS.shieldOp, SKILLS.navigation];
  for (const def of firstFour) {
    expect(def.rank, def.id).toBe(1);
    expect(def.prerequisites, def.id).toEqual([]);
    expect(SKILL_CATEGORY_ORDER).toContain(def.category);
  }
  expect(firstFour.map((d) => d.category)).toEqual(['Extraction', 'Gunnery', 'Defense', 'Navigation']);
  expect(SKILLS.chargeControl.category).toBe('Gunnery');
});

test('skills model: a prerequisite counts as met only at its level', () => {
  // A test catalog: the real one has no prerequisites yet.
  const catalog: Record<string, SkillDef> = {
    ...SKILLS,
    navigation: {...SKILLS.navigation, prerequisites: [{skill: 'mining', level: 2}, {skill: 'gunnery', level: 1}]},
  };
  expect(unmetPrerequisites({}, 'navigation', catalog)).toEqual(catalog.navigation.prerequisites);
  expect(unmetPrerequisites({mining: 1, gunnery: 1}, 'navigation', catalog)).toEqual([{skill: 'mining', level: 2}]);
  expect(unmetPrerequisites({mining: 2, gunnery: 3}, 'navigation', catalog)).toEqual([]);
  expect(prerequisiteText(catalog.navigation.prerequisites, catalog)).toBe('Mining II, Gunnery I');
  expect(unmetPrerequisites({}, 'mining')).toEqual([]);
});

test('skills: the Skills screen has a header per category, and training time and cost are unchanged', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true, skills: {mining: 0, gunnery: 0, shieldOp: 0, navigation: 0}});
  await enterGame(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();

  const headers = page.locator('[data-testid^="skill-category-"]');
  await expect(headers).toHaveCount(4);
  expect(await headers.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual([
    'skill-category-Extraction',
    'skill-category-Gunnery',
    'skill-category-Defense',
    'skill-category-Navigation',
  ]);
  await expect(page.getByTestId('skill-category-Extraction')).toContainText('MINING');
  await expect(page.getByTestId('skill-category-Defense')).toContainText('SHIELD OPERATION');
  // Only Laser Tuning, Low Profile, Charge Control and Cargo Trim have a prerequisite.
  await expect(page.getByText(/^Needs:/)).toHaveCount(4);
  await expect(page.getByTestId('skill-category-Extraction')).toContainText('LVL I (100 MARKS • 1:00)');

  // Enter trains the first skill: level 1 is 60 s for 100 MARKS, as before.
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'mining', targetLevel: 1, duration: 60, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: each card gives its numbers for the fitted miner and weapon', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...RICH,
    milestoneIndustrialistClaimed: true,
    skills: {mining: 5, laserTuning: 0, gunnery: 3, chargeControl: 0, shieldOp: 0, navigation: 0, cargoTrim: 0},
    fitting: {hangar: {miner_mk1: 1, light_cannon: 1}, fitted: ['miner_mk2', null, null, 'lance_driver'], loadouts: {}},
  });
  await enterGame(page);
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
  const extraction = page.getByTestId('skill-category-Extraction');
  const gunnery = page.getByTestId('skill-category-Gunnery');
  // The MK2 mines 75 a cycle: at Mining V, round(75 × 1.5) = 113, as flight does.
  await expect(extraction).toContainText('+50% ore yield (Miner MK2: 113 ore/cycle)');
  await expect(extraction).toContainText('-0% cycle time (Miner MK2: 8.0 s)');
  // The Lance Driver hits for 47: at Gunnery III, round(47 × 1.3) = 61.
  await expect(gunnery).toContainText('+30% kinetic damage (Lance Driver: 61 dmg/shot)');
  await expect(gunnery).toContainText('-0% cycle time (Lance Driver: 4.0 s)');
  expectClean(problems);
});
