import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, launch, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {ARMOR_LAYERING_PCT, maxArmorAt, SKILLS} from '../content/skills';

// Step 18 of design/content-tree.md: Armor Layering, a Defense skill. Each level
// adds 10% to armor HP, fitted armor included: a Ferrier's 80 is 120 at level V,
// and 270 with Composite Armor. Rank 1, no prerequisites. The Vael pirate probe
// found armor decides the fights a Ferrier wins there.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (armorLayering: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, refining: 0, signalAnalysis: 0},
});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN = ['miner_mk1', null, null, 'light_cannon'];
const ARMORED = ['miner_mk1', 'composite_armor', null, 'light_cannon'];

type Probe = {armor: number; maxArmor: number};
const probe = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Probe);

test('catalog: Armor Layering is a rank 1 Defense skill with no prerequisites', () => {
  expect(SKILLS.armorLayering).toEqual({id: 'armorLayering', name: 'Armor Layering', category: 'Defense', rank: 1, prerequisites: []});
  expect(ARMOR_LAYERING_PCT).toBe(10);
  const levels = [0, 1, 2, 3, 4, 5];
  expect(levels.map((l) => maxArmorAt(80, 0, l))).toEqual([80, 88, 96, 104, 112, 120]);
  expect(levels.map((l) => maxArmorAt(80, 100, l))).toEqual([180, 198, 216, 234, 252, 270]);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('skills screen: Armor Layering says what it gives, and level I queues for 100 MARKS and takes 1:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  const card = page.getByTestId('skill-card-armorLayering');
  await expect(page.getByTestId('skill-category-Defense')).toContainText('ARMOR LAYERING');
  await expect(card).toContainText('+0% armor HP (80 max HP)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 1:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'armorLayering', targetLevel: 1, duration: 60, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

for (const c of [
  {name: 'untrained, nothing fitted', level: 0, fitted: PLAIN, text: '80 HP', plus: null},
  {name: 'level V, nothing fitted', level: 5, fitted: PLAIN, text: '120 HP', plus: '(+40)'},
  {name: 'level V, Composite Armor', level: 5, fitted: ARMORED, text: '270 HP', plus: '(+190)'},
]) {
  test(`ship stats: Armor ${c.name} reads ${c.text}`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...SKILLS_AT(c.level), ...fitting(c.fitted)});
    await enterGame(page);
    await openTab(page, '2', /^FITTING$/);
    const row = page.getByTestId('ship-stat-armor');
    await expect(row).toContainText(c.text);
    if (c.plus) await expect(row).toContainText(c.plus);
    else expect(await row.textContent()).not.toContain('(+');
    expectClean(problems);
  });
}

test('in space: at level V with Composite Armor the ship has 270 armor', async ({page}) => {
  const problems = await launch(page, {...SKILLS_AT(5), ...fitting(ARMORED)});
  await expect(page.getByTestId('hud-armor')).toHaveText('270/270');
  expect(await probe(page)).toMatchObject({armor: 270, maxArmor: 270});
  expectClean(problems);
});

test('training: when Armor Layering I completes, max armor rises to 88 and the new armor arrives intact', async ({page}) => {
  const problems = await launch(page, {
    ...SKILLS_AT(0),
    ...fitting(PLAIN),
    trainingQueue: [{id: 'q_armor', skillId: 'armorLayering', targetLevel: 1, duration: 60, cost: 100}],
    trainingElapsed: 55,
  });
  expect(await probe(page)).toMatchObject({armor: 80, maxArmor: 80});
  await expect.poll(async () => (await readSave(page))!.skills.armorLayering, {timeout: 20_000}).toBe(1);
  await expect(page.getByTestId('hud-armor')).toHaveText('88/88');
  expect(await probe(page)).toMatchObject({armor: 88, maxArmor: 88});
  expectClean(problems);
});

test('destruction: towed home at level V, the ship comes back with 120 armor', async ({page}) => {
  test.setTimeout(240_000);
  const problems = await launch(page, {...SKILLS_AT(5), ...fitting(PLAIN)});
  expect(await probe(page)).toMatchObject({armor: 120, maxArmor: 120});
  await flyTo(page, 'Belt Two');
  await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 200_000});
  await expect(page.getByText(/Vessel destroyed/)).toBeVisible();
  expect(await probe(page)).toMatchObject({armor: 120, maxArmor: 120});
  expectClean(problems);
});
