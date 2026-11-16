import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, watch} from './helpers';
import {readItem} from '../content/inventory';

// Step 4 of design/content-tree.md: the lenses move from their cargoXxxLens save
// keys into the `inventory` map, by the rules in 4.4.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

test('inventory model: inventory wins even at 0, and an old key is read only for a missing item', () => {
  expect(readItem({cargoSilicateLens: 2}, 'silicateLens')).toBe(2);
  expect(readItem({inventory: {silicateLens: 0}, cargoSilicateLens: 3}, 'silicateLens')).toBe(0);
  expect(readItem({inventory: {silicateLens: 4}}, 'metallicLens')).toBeNull();
  expect(readItem({inventory: {exoticLens: 1}, cargoMetallicLens: 5}, 'metallicLens')).toBe(5);
  expect(readItem({inventory: {exoticLens: 'junk'}}, 'exoticLens')).toBe(0);
});

const lensesInSave = async (page: Page) => {
  const save = await readSave(page);
  return save && {inventory: save.inventory, oldKeys: Object.keys(save).filter((k) => /^cargo\w+Lens$/.test(k))};
};

test('save: lenses under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoSilicateLens: 2, cargoExoticLens: 1});
  await enterGame(page);
  const expected = {inventory: {silicateLens: 2, metallicLens: 0, exoticLens: 1}, oldKeys: []};
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
  await expect.poll(async () => (await lensesInSave(page))?.inventory, {timeout: 15_000}).toEqual({silicateLens: 0, metallicLens: 0, exoticLens: 0});
  expectClean(problems);
});
