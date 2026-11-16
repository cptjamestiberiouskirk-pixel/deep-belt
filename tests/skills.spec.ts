import {expect, test} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {prerequisiteText, SKILL_CATEGORY_ORDER, SKILLS, unmetPrerequisites, type SkillDef} from '../content/skills';

// Step 5 of design/content-tree.md: skills get a category, a rank and
// prerequisites (4.5). The four existing skills are rank 1 with none, so their
// times and costs do not change.

test('skills model: the four skills are rank 1 with no prerequisites, one per category', () => {
  for (const def of Object.values(SKILLS)) {
    expect(def.rank, def.id).toBe(1);
    expect(def.prerequisites, def.id).toEqual([]);
    expect(SKILL_CATEGORY_ORDER).toContain(def.category);
  }
  expect(Object.values(SKILLS).map((d) => d.category)).toEqual(['Extraction', 'Gunnery', 'Defense', 'Navigation']);
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
  await expect(page.getByText(/^Needs:/)).toHaveCount(0);
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
