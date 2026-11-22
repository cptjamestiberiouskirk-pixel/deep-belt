import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {baseHoldAt, CLASS_SKILL, HULL_DEFINITIONS, HULL_RECIPES, INDUSTRIAL_PILOTING_HOLD_PCT, missingRecipeSkill, type HullId} from '../content/hulls';
import {SKILLS} from '../content/skills';

// Step 28 of design/content-tree.md (4.6): the Industrial class skill. Industrial
// Piloting I is needed to assemble the Lattice Tender at the Fabricator, and each
// level adds 5% to an Industrial's base hold (900 m³ is 1,125 at V). Rank 2.
// A Lattice owned before the skill is still boarded and flown.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (industrialPiloting: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting, commandPiloting: 0, refining: 0, droneOperation: 0, signalAnalysis: 0},
});
const PARTS = {cargoQuantumCore: 1, cargoIntegritySeal: 1, cargoThermalGrid: 1};
const hull = (id: HullId) => HULL_DEFINITIONS.find((h) => h.id === id)!;

test('catalog: Industrial Piloting is a rank 2 Navigation skill, and level I gates assembling the Lattice Tender', () => {
  expect(SKILLS.industrialPiloting).toEqual({id: 'industrialPiloting', name: 'Industrial Piloting', category: 'Navigation', rank: 2, prerequisites: []});
  expect(CLASS_SKILL.Industrial).toBe('industrialPiloting');
  expect(HULL_DEFINITIONS.filter((h) => h.hullClass === 'Industrial').map((h) => [h.id, h.requires])).toEqual([['lattice', {skill: 'industrialPiloting', level: 1}]]);
  expect(HULL_RECIPES).toEqual({lattice_tender: 'lattice', gantry_command: 'gantry'});
  expect(missingRecipeSkill({industrialPiloting: 0}, 'lattice_tender')).toBe('Industrial Piloting I');
  expect(missingRecipeSkill({industrialPiloting: 1}, 'lattice_tender')).toBeNull();
  // Recipes that build no gated hull need nothing; a name from Object.prototype is not a recipe.
  for (const id of ['hull_plate', 'gantry_refit', 'toString']) expect(missingRecipeSkill({}, id), id).toBeNull();
});

test('catalog: each level adds 5% to an Industrial base hold, and to no other class', () => {
  expect(INDUSTRIAL_PILOTING_HOLD_PCT).toBe(5);
  expect([0, 1, 2, 3, 4, 5].map((l) => baseHoldAt(hull('lattice'), {industrialPiloting: l}))).toEqual([900, 945, 990, 1035, 1080, 1125]);
  for (const id of ['ferrier', 'tern', 'skirmisher', 'shade', 'gantry'] as HullId[]) {
    expect(baseHoldAt(hull(id), {industrialPiloting: 5}), id).toBe(hull(id).baseCargo);
  }
});

/** Opens a station tab and waits for the officer's new line, so the next Enter reaches the tab. */
async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
  await settle(page);
}

test('skills screen: Industrial Piloting shows under Navigation, and level I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-category-Navigation')).toContainText('INDUSTRIAL PILOTING');
  const card = page.getByTestId('skill-card-industrialPiloting');
  await expect(card).toContainText('+0% Industrial hold (Lattice 900 m³)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'industrialPiloting', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

/** Focuses the Lattice Tender row in the Fabricator by clicking its name, then waits for input to settle. */
async function focusLattice(page: Page) {
  await page.getByTestId('fab-recipe-lattice_tender').getByText('Lattice Tender Assembly').click();
  await settle(page);
}

test('fabricator: untrained, the Lattice Tender says what it needs, has no Assemble button, and Enter starts nothing', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...PARTS});
  await enterGame(page);
  await openTab(page, 'f', /^FABRICATOR$/);
  const row = page.getByTestId('fab-recipe-lattice_tender');
  await expect(row.getByRole('button', {name: 'Needs Industrial Piloting I'})).toBeDisabled();
  expect(await row.getByRole('button', {name: /Assemble/}).count()).toBe(0);
  await focusLattice(page);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Lattice Tender needs Industrial Piloting I. Train it in Skills [3].')).toBeVisible();
  // The seed has old cargo keys only; wait for the game's own save, which has `inventory`.
  await expect.poll(async () => (await readSave(page))!.inventory, {timeout: 15_000}).toBeDefined();
  const save = (await readSave(page))!;
  expect(save.activeFabricate).toBeNull();
  expect(save.inventory).toMatchObject({quantumCore: 1, integritySeal: 1, thermalGrid: 1});
  expectClean(problems);
});

test('fabricator: at level I the Lattice Tender has an Assemble button, and Enter starts its assembly', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1), ...PARTS});
  await enterGame(page);
  await openTab(page, 'f', /^FABRICATOR$/);
  const row = page.getByTestId('fab-recipe-lattice_tender');
  await expect(row.getByRole('button', {name: /Assemble/})).toBeEnabled();
  expect(await row.getByText(/Needs Industrial/).count()).toBe(0);
  await focusLattice(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate?.recipeId).toBe('lattice_tender');
  expectClean(problems);
});

test('hangar: untrained, the Lattice card says what it needs; trained, it points to the Fabricator', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-lattice');
  await expect(page.getByTestId('hangar-needs-lattice')).toHaveText('Needs Industrial Piloting I');
  expect(await card.getByRole('button', {name: /Craft at Fabricator/}).count()).toBe(0);
  await expect(card).toContainText('900 m³');
  expectClean(problems);
});

test('hangar: at level V the Lattice card shows 1,125 m³ and the Craft at Fabricator button', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5)});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-lattice');
  await expect(card.getByRole('button', {name: /Craft at Fabricator/})).toHaveCount(1);
  expect(await page.getByTestId('hangar-needs-lattice').count()).toBe(0);
  await expect(card).toContainText('1,125 m³');
  expectClean(problems);
});

test('hangar: a Lattice owned before the skill is still boarded, with its untrained 900 m³ hold', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ownedHulls: ['ferrier', 'lattice']});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  expect(await page.getByTestId('hangar-needs-lattice').count()).toBe(0);
  await page.getByTestId('hangar-hull-lattice').getByRole('button', {name: /Board/}).click();
  await expect(page.getByText('Boarded Lattice Tender')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('lattice');
  await expect(page.getByText(/\/900m³/)).toBeVisible();
  expectClean(problems);
});

test('ship stats: the Cargo hold of a Lattice Tender at level V reads 1,125 m³ (+225)', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ownedHulls: ['ferrier', 'lattice'], activeHull: 'lattice', fitting: {hangar: {}, fitted: ['miner_mk1', null, null, null], loadouts: {}}});
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  const row = page.getByTestId('ship-stat-cargo');
  await expect(row).toContainText('1,125 m³');
  await expect(row).toContainText('(+225)');
  expectClean(problems);
});
