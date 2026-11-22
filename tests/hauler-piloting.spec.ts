import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, launch, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {baseHoldAt, CLASS_SKILL, HAULER_PILOTING_HOLD_PCT, HULL_DEFINITIONS, missingHullSkill, type HullId} from '../content/hulls';
import {SKILLS} from '../content/skills';

// Step 27 of design/content-tree.md (4.6): hull classes. Each hull has a class,
// and the Hauler class has the first skill to fly it, Hauler Piloting: level I
// to buy the Tern, and +5% Hauler base hold per level (1,200 m³ is 1,500 at V).
// A Tern owned before the skill is still boarded and flown.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (haulerPiloting: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, signalAnalysis: 0},
});
const hull = (id: HullId) => HULL_DEFINITIONS.find((h) => h.id === id)!;
const TERN_ACTIVE = {ownedHulls: ['ferrier', 'tern'], activeHull: 'tern'};

test('catalog: every hull has a class, and Hauler Piloting I gates the Tern', () => {
  expect(Object.fromEntries(HULL_DEFINITIONS.map((h) => [h.id, h.hullClass]))).toEqual({
    ferrier: 'Frigate', tern: 'Hauler', skirmisher: 'Frigate', lattice: 'Industrial', shade: 'Frigate', gantry: 'Command',
  });
  expect(SKILLS.haulerPiloting).toEqual({id: 'haulerPiloting', name: 'Hauler Piloting', category: 'Navigation', rank: 1, prerequisites: []});
  expect(CLASS_SKILL.Hauler).toBe('haulerPiloting');
  expect(CLASS_SKILL.Frigate).toBeUndefined();
  expect(HULL_DEFINITIONS.filter((h) => h.hullClass === 'Hauler').map((h) => [h.id, h.requires])).toEqual([['tern', {skill: 'haulerPiloting', level: 1}]]);
  expect(HULL_DEFINITIONS.filter((h) => h.hullClass === 'Frigate' && h.requires)).toEqual([]);
  expect(missingHullSkill({haulerPiloting: 0}, hull('tern'))).toBe('Hauler Piloting I');
  expect(missingHullSkill({haulerPiloting: 1}, hull('tern'))).toBeNull();
  expect(missingHullSkill({}, hull('skirmisher'))).toBeNull();
});

test('catalog: each level adds 5% to a Hauler base hold, and to no other class', () => {
  expect(HAULER_PILOTING_HOLD_PCT).toBe(5);
  const levels = [0, 1, 2, 3, 4, 5];
  expect(levels.map((l) => baseHoldAt(hull('tern'), {haulerPiloting: l}))).toEqual([1200, 1260, 1320, 1380, 1440, 1500]);
  for (const id of ['ferrier', 'skirmisher', 'lattice', 'shade', 'gantry'] as HullId[]) {
    expect(baseHoldAt(hull(id), {haulerPiloting: 5}), id).toBe(hull(id).baseCargo);
  }
  expect(baseHoldAt(hull('gantry'), {haulerPiloting: 5}, true)).toBe(2500);
});

/** Opens a station tab and waits for the officer's new line, so the next Enter reaches the tab. */
async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
  await settle(page);
}

test('skills screen: Hauler Piloting shows under Navigation, and level I queues for 100 MARKS and takes 1:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-category-Navigation')).toContainText('HAULER PILOTING');
  const card = page.getByTestId('skill-card-haulerPiloting');
  await expect(card).toContainText('+0% Hauler hold (Tern 1,200 m³)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 1:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'haulerPiloting', targetLevel: 1, duration: 60, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('hangar: every card names its class', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  for (const h of HULL_DEFINITIONS) await expect(page.getByTestId(`hangar-class-${h.id}`)).toHaveText(h.hullClass.toUpperCase());
  expectClean(problems);
});

test('hangar: untrained, the Tern shows what it needs, has no Buy button, and Enter does not buy it', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-tern');
  await expect(page.getByTestId('hangar-needs-tern')).toHaveText('Needs Hauler Piloting I');
  expect(await card.getByRole('button', {name: /Buy/}).count()).toBe(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tern needs Hauler Piloting I. Train it in Skills [3].')).toBeVisible();
  const after = (await readSave(page))!;
  expect(after.ownedHulls).toEqual(['ferrier']);
  expect(after.activeHull).toBe('ferrier');
  expect(after.marks).toBe(before.marks);
  expectClean(problems);
});

test('hangar: at level I the Tern has a Buy button, and Enter buys and boards it with a 1,260 m³ hold', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-tern');
  await expect(card).toContainText('1,260 m³');
  expect(await page.getByTestId('hangar-needs-tern').count()).toBe(0);
  await expect(card.getByRole('button', {name: /Buy/})).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Boarded Tern')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('tern');
  const after = (await readSave(page))!;
  expect(after.ownedHulls).toEqual(['ferrier', 'tern']);
  expect(after.marks).toBe(before.marks - hull('tern').cost);
  await expect(page.getByText(/\/1260m³/)).toBeVisible();
  expectClean(problems);
});

test('hangar: a Tern owned before the skill is still boarded, with its untrained 1,200 m³ hold', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ownedHulls: ['ferrier', 'tern']});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  expect(await page.getByTestId('hangar-needs-tern').count()).toBe(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Boarded Tern')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('tern');
  await expect(page.getByText(/\/1200m³/)).toBeVisible();
  expectClean(problems);
});

for (const c of [
  {name: 'a Tern at level V', patch: {...SKILLS_AT(5), ...TERN_ACTIVE}, text: '1,500 m³', plus: '(+300)'},
  {name: 'an untrained Tern', patch: {...SKILLS_AT(0), ...TERN_ACTIVE}, text: '1,200 m³', plus: null},
  {name: 'a Ferrier at level V', patch: {...SKILLS_AT(5)}, text: '600 m³', plus: null},
]) {
  test(`ship stats: the Cargo hold of ${c.name} reads ${c.text}`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...c.patch, fitting: {hangar: {}, fitted: ['miner_mk1', null, null], loadouts: {}}});
    await enterGame(page);
    await openTab(page, '2', /^FITTING$/);
    const row = page.getByTestId('ship-stat-cargo');
    await expect(row).toContainText(c.text);
    if (c.plus) await expect(row).toContainText(c.plus);
    else expect(await row.textContent()).not.toContain('(+');
    expectClean(problems);
  });
}

test('training: when Hauler Piloting I completes in a Tern, its hold grows to 1,260 m³', async ({page}) => {
  const problems = await launch(page, {
    ...SKILLS_AT(0),
    ...TERN_ACTIVE,
    trainingQueue: [{id: 'q_hauler', skillId: 'haulerPiloting', targetLevel: 1, duration: 60, cost: 100}],
    trainingElapsed: 55,
  });
  await expect(page.getByText(/\/1200m³/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.skills.haulerPiloting, {timeout: 20_000}).toBe(1);
  await expect(page.getByText(/\/1260m³/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(1260);
  expectClean(problems);
});
