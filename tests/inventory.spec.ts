import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, watch} from './helpers';
import {readItem} from '../content/inventory';

// Steps 4, 19 and 20 of design/content-tree.md: the lenses, the three drones and
// the colony goods move from their cargoXxx save keys into the `inventory` map, by the rules in 4.4.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

test('inventory model: inventory wins even at 0, and an old key is read only for a missing item', () => {
  expect(readItem({cargoSilicateLens: 2}, 'silicateLens')).toBe(2);
  expect(readItem({inventory: {silicateLens: 0}, cargoSilicateLens: 3}, 'silicateLens')).toBe(0);
  expect(readItem({inventory: {silicateLens: 4}}, 'metallicLens')).toBeNull();
  expect(readItem({inventory: {exoticLens: 1}, cargoMetallicLens: 5}, 'metallicLens')).toBe(5);
  expect(readItem({inventory: {exoticLens: 'junk'}}, 'exoticLens')).toBe(0);
  expect(readItem({cargoDefenseDrone: 2}, 'defenseDrone')).toBe(2);
  expect(readItem({inventory: {silicateLens: 1}, cargoDefenseDrone: 2}, 'defenseDrone')).toBe(2);
  expect(readItem({inventory: {defenseDrone: 0}, cargoDefenseDrone: 2}, 'defenseDrone')).toBe(0);
  expect(readItem({inventory: {defenseDrone: 0}, cargoPolymerComposite: 6}, 'polymerComposite')).toBe(6);
});

const lensesInSave = async (page: Page) => {
  const save = await readSave(page);
  return save && {inventory: save.inventory, oldKeys: Object.keys(save).filter((k) => /^cargo\w+Lens$/.test(k))};
};

test('save: lenses under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoSilicateLens: 2, cargoExoticLens: 1});
  await enterGame(page);
  const expected = {inventory: {silicateLens: 2, metallicLens: 0, exoticLens: 1, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0}, oldKeys: []};
  await expect.poll(() => lensesInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await lensesInSave(page)).toEqual(expected);
  // The hold counts them: 3 lenses at 1 m³ each.
  await expect(page.getByText(/^3\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a lens at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 0}, cargoSilicateLens: 3});
  await enterGame(page);
  await expect.poll(async () => (await lensesInSave(page))?.inventory, {timeout: 15_000}).toEqual({silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0});
  expectClean(problems);
});

const dronesInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {drones: [inv.extractDrone, inv.defenseDrone, inv.salvageDrone], oldKeys: Object.keys(save).filter((k) => /^cargo\w+Drone$/.test(k))};
};

test('save: drones under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoExtractDrone: 1, cargoDefenseDrone: 2});
  await enterGame(page);
  const expected = {drones: [1, 2, 0], oldKeys: []};
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await dronesInSave(page)).toEqual(expected);
  // The hold counts them: 3 drones at 5 m³ each.
  await expect(page.getByText(/^15\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds only the lenses, as from step 4 to 18, keeps its drones', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 1, metallicLens: 0, exoticLens: 0}, cargoSalvageDrone: 2});
  await enterGame(page);
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual({drones: [0, 0, 2], oldKeys: []});
  // 1 lens and 2 salvage drones: 1 + 10 m³.
  await expect(page.getByText(/^11\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a drone at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {defenseDrone: 0}, cargoDefenseDrone: 3});
  await enterGame(page);
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual({drones: [0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const colonyGoodsInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {goods: [inv.commandHub, inv.polymer, inv.chemical, inv.polymerComposite], oldKeys: Object.keys(save).filter((k) => /^cargo(CommandHub|Polymer|Chemical|PolymerComposite)$/.test(k))};
};

test('save: colony goods under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoCommandHub: 1, cargoPolymer: 5, cargoPolymerComposite: 2});
  await enterGame(page);
  const expected = {goods: [1, 5, 0, 2], oldKeys: []};
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await colonyGoodsInSave(page)).toEqual(expected);
  // The hold counts them: a 20 m³ Command Hub and 7 goods at 2 m³ each.
  await expect(page.getByText(/^34\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds lenses and drones, as from step 19, keeps its colony goods', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0}, cargoChemical: 4});
  await enterGame(page);
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 4, 0], oldKeys: []});
  await expect(page.getByText(/^8\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a colony good at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {polymer: 0}, cargoPolymer: 9});
  await enterGame(page);
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});
