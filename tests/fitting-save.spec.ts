import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, LEGACY_SAVE_KEY, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {MODULES} from '../content/modules';

// Step 2a of design/content-tree.md: the fitting is saved as hangar, fitted
// slots and per-hull loadouts (save v5), and v4 saves convert on load.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

const ownedCount = (f: {hangar: Record<string, number>; fitted: Array<string | null>}) =>
  Object.values(f.hangar).reduce((a, b) => a + b, 0) + f.fitted.filter(Boolean).length;

async function reloadAndEnter(page: Page) {
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
}

async function board(page: Page, hull: string) {
  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText(/^HANGAR$/).first()).toBeVisible();
  await settle(page);
  await page.locator('button:visible', {hasText: /^Board/}).first().click();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe(hull);
  await page.keyboard.press('Escape');
}

test('save: a v4 fitting loads as the same modules, and the v4 save is removed', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    upgrades: {laserMk2: true, cargoExpanded: true, shieldBoosterHeavy: true, cannon: true},
    fittedSlots: {slot1MiningLaser: true, slot2CargoExpander: true, slot3ShieldBooster: false, slot4Cannon: true},
  });
  await enterGame(page);
  // The Expanded Hold is still fitted: 1,100 m³, as in v4.
  await expect(page.getByText(/\/1100m³/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.fitting?.fitted).toEqual(['miner_mk2', 'expanded_hold', null, 'light_cannon']);
  expect((await readSave(page))!.fitting.hangar).toEqual({shield_booster: 1});
  expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_SAVE_KEY)).toBeNull();
  expectClean(problems);
});

test('market: a module with no free slot of its type waits in the hangar', async ({page}) => {
  const problems = watch(page);
  // A Tern pilot who never owned the cannon. The Tern has no weapon slot.
  await openWithSave(page, {
    ...BASE,
    ownedHulls: ['ferrier', 'tern'],
    activeHull: 'tern',
    upgrades: {cannon: false},
    fittedSlots: {slot4Cannon: true},
  });
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))?.fitting?.hangar).toEqual({});
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  const name = MODULES.light_cannon.name;
  const card = page.locator('div', {hasText: name, has: page.getByRole('button', {name: 'Buy'})}).last();
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText(`${name} stored`)).toBeVisible();
  await expect(page.getByText(/No free weapon slot on this hull/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar).toEqual({light_cannon: 1});
  expect((await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', null, null]);
  expectClean(problems);
});

test('hangar: each hull keeps its own fitting across a reload', async ({page}) => {
  const problems = watch(page);
  // The Ferrier owns an Expanded Hold but has it in the hangar.
  await openWithSave(page, {
    ...BASE,
    ownedHulls: ['ferrier', 'skirmisher'],
    upgrades: {cargoExpanded: true},
    fittedSlots: {slot2CargoExpander: false},
  });
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))?.fitting?.fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);

  // On the Skirmisher, fit the hold.
  await board(page, 'skirmisher');
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await settle(page);
  await page.locator('button:visible', {hasText: /^Fit$/}).first().click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  await page.keyboard.press('Escape');

  // Back on the Ferrier the hold goes back to the hangar: the Ferrier never had it fitted.
  await board(page, 'ferrier');
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);
  expect((await readSave(page))!.fitting.hangar).toEqual({expanded_hold: 1});

  // Each hull's loadout survives a reload (before step 2 it lived only in memory).
  await reloadAndEnter(page);
  await board(page, 'skirmisher');
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  const save = (await readSave(page))!;
  expect(save.fitting.hangar).toEqual({});
  expect(ownedCount(save.fitting)).toBe(3);
  expectClean(problems);
});
