import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {baseHoldAt, CLASS_SKILL, COMMAND_PILOTING_HOLD_PCT, HULL_DEFINITIONS, missingRecipeSkill, type HullId} from '../content/hulls';
import {prerequisiteText, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 29 of design/content-tree.md (4.6): the Command class skill. Command
// Piloting I is needed to assemble the Gantry Command at the Fabricator, and each
// level adds 5% to a Command hull's base hold (2,000 m³ is 2,500 at V; refitted,
// 2,500 is 3,125). Rank 3, after Industrial Piloting I. A Gantry owned before the
// skill is still boarded and flown.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (commandPiloting: number, industrialPiloting = 1) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting, commandPiloting, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0},
});
const PARTS = {cargoQuantumCore: 2, cargoIntegritySeal: 2, cargoThermalGrid: 1, cargoPackedPrismite: 2, cargoPackedRadflux: 1};
const hull = (id: HullId) => HULL_DEFINITIONS.find((h) => h.id === id)!;

test('catalog: Command Piloting is a rank 3 Navigation skill after Industrial Piloting I, and level I gates assembling the Gantry', () => {
  expect(SKILLS.commandPiloting).toEqual({
    id: 'commandPiloting',
    name: 'Command Piloting',
    category: 'Navigation',
    rank: 3,
    prerequisites: [{skill: 'industrialPiloting', level: 1}],
  });
  expect(prerequisiteText(unmetPrerequisites({industrialPiloting: 0}, 'commandPiloting'))).toBe('Industrial Piloting I');
  expect(unmetPrerequisites({industrialPiloting: 1}, 'commandPiloting')).toEqual([]);
  expect(CLASS_SKILL.Command).toBe('commandPiloting');
  expect(HULL_DEFINITIONS.filter((h) => h.hullClass === 'Command').map((h) => [h.id, h.requires])).toEqual([['gantry', {skill: 'commandPiloting', level: 1}]]);
  expect(missingRecipeSkill({commandPiloting: 0}, 'gantry_command')).toBe('Command Piloting I');
  expect(missingRecipeSkill({commandPiloting: 1}, 'gantry_command')).toBeNull();
  // The refit is of a Gantry already owned, so it needs nothing.
  expect(missingRecipeSkill({}, 'gantry_refit')).toBeNull();
});

test('catalog: each level adds 5% to a Command base hold, refitted too, and to no other class', () => {
  expect(COMMAND_PILOTING_HOLD_PCT).toBe(5);
  expect([0, 1, 2, 3, 4, 5].map((l) => baseHoldAt(hull('gantry'), {commandPiloting: l}))).toEqual([2000, 2100, 2200, 2300, 2400, 2500]);
  expect([0, 1, 5].map((l) => baseHoldAt(hull('gantry'), {commandPiloting: l}, true))).toEqual([2500, 2625, 3125]);
  for (const id of ['ferrier', 'tern', 'skirmisher', 'lattice', 'shade'] as HullId[]) {
    expect(baseHoldAt(hull(id), {commandPiloting: 5}), id).toBe(hull(id).baseCargo);
  }
});

/** Opens a station tab and waits for the officer's new line, so the next Enter reaches the tab. */
async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
  await settle(page);
}

test('skills screen: before Industrial Piloting I, Command Piloting says what it needs', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0, 0)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  const card = page.getByTestId('skill-card-commandPiloting');
  await expect(card).toContainText('COMMAND PILOTING');
  await expect(card).toContainText('Needs: Industrial Piloting I');
  await expect(card.getByRole('button', {name: 'NEEDS INDUSTRIAL PILOTING I'})).toBeDisabled();
  expectClean(problems);
});

test('skills screen: at Industrial Piloting I, Command Piloting I queues for 100 MARKS and takes 3:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-category-Navigation')).toContainText('COMMAND PILOTING');
  const card = page.getByTestId('skill-card-commandPiloting');
  await expect(card).toContainText('+0% Command hold (Gantry 2,000 m³)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 3:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'commandPiloting', targetLevel: 1, duration: 180, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at level III the Command Piloting card reads +15% Command hold (Gantry 2,300 m³)', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(3)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-card-commandPiloting')).toContainText('+15% Command hold (Gantry 2,300 m³)');
  expectClean(problems);
});

/** Focuses the Gantry row in the Fabricator by clicking its name, then waits for input to settle. */
async function focusGantry(page: Page) {
  await page.getByTestId('fab-recipe-gantry_command').getByText('Gantry Command Assembly').click();
  await settle(page);
}

test('fabricator: untrained, the Gantry says what it needs, has no Assemble button, and Enter starts nothing', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...PARTS});
  await enterGame(page);
  await openTab(page, 'f', /^FABRICATOR$/);
  const row = page.getByTestId('fab-recipe-gantry_command');
  await expect(row.getByRole('button', {name: 'Needs Command Piloting I'})).toBeDisabled();
  expect(await row.getByRole('button', {name: /Assemble/}).count()).toBe(0);
  await focusGantry(page);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Gantry Command needs Command Piloting I. Train it in Skills [3].')).toBeVisible();
  // The seed has old cargo keys only; wait for the game's own save, which has `inventory`.
  await expect.poll(async () => (await readSave(page))!.inventory, {timeout: 15_000}).toBeDefined();
  const save = (await readSave(page))!;
  expect(save.activeFabricate).toBeNull();
  expect(save.inventory).toMatchObject({quantumCore: 2, integritySeal: 2, thermalGrid: 1, packedPrismite: 2, packedRadflux: 1});
  expectClean(problems);
});

test('fabricator: at level I the Gantry has an Assemble button, and Enter starts its assembly', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1), ...PARTS});
  await enterGame(page);
  await openTab(page, 'f', /^FABRICATOR$/);
  const row = page.getByTestId('fab-recipe-gantry_command');
  await expect(row.getByRole('button', {name: /Assemble/})).toBeEnabled();
  expect(await row.getByText(/Needs Command/).count()).toBe(0);
  await focusGantry(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate?.recipeId).toBe('gantry_command');
  expectClean(problems);
});

test('hangar: untrained, the Gantry card says what it needs and has no Craft at Fabricator button', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-gantry');
  await expect(page.getByTestId('hangar-needs-gantry')).toHaveText('Needs Command Piloting I');
  expect(await card.getByRole('button', {name: /Craft at Fabricator/}).count()).toBe(0);
  await expect(card).toContainText('2,000 m³');
  expectClean(problems);
});

test('hangar: at level V the Gantry card shows 2,500 m³ and the Craft at Fabricator button', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5)});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-gantry');
  await expect(card.getByRole('button', {name: /Craft at Fabricator/})).toHaveCount(1);
  expect(await page.getByTestId('hangar-needs-gantry').count()).toBe(0);
  await expect(card).toContainText('2,500 m³');
  expectClean(problems);
});

test('hangar: a Gantry owned before the skill is still boarded, with its untrained 2,000 m³ hold', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ownedHulls: ['ferrier', 'gantry']});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  expect(await page.getByTestId('hangar-needs-gantry').count()).toBe(0);
  await page.getByTestId('hangar-hull-gantry').getByRole('button', {name: /Board/}).click();
  await expect(page.getByText('Boarded Gantry Command')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('gantry');
  await expect(page.getByText(/\/2,?000m³/)).toBeVisible();
  expectClean(problems);
});

test('ship stats: the Cargo hold of a Gantry at level V reads 2,500 m³ (+500)', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ownedHulls: ['ferrier', 'gantry'], activeHull: 'gantry', fitting: {hangar: {}, fitted: ['miner_mk1', null, null, null, null], loadouts: {}}});
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  const row = page.getByTestId('ship-stat-cargo');
  await expect(row).toContainText('2,500 m³');
  await expect(row).toContainText('(+500)');
  expectClean(problems);
});
