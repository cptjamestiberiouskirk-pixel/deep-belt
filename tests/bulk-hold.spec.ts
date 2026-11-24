import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {MARKET_MODULE_IDS, MODULES} from '../content/modules';
import {fittedSpeedMult, fittedTotal} from '../content/fitting';

// Step 8 of design/content-tree.md: the Bulk Hold, a side-grade to the Expanded
// Hold. +900 hold in one utility slot, for 20% less top speed and thrust.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

test('catalog: the Bulk Hold gives 900 hold for 20% speed, sold after the Expanded Hold', () => {
  expect(MODULES.bulk_hold).toMatchObject({
    name: 'Bulk Hold',
    slot: 'utility',
    basePrice: 1600,
    statBadge: '+900 hold, -20% speed',
    stats: {cargoM3: 900, speedPct: -20},
  });
  expect(MODULES.bulk_hold.maxOwned).toBeUndefined(); // one only: the slowdown does not stack
  expect(MODULES.bulk_hold.requires).toBeUndefined();
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  const withBulk = ['miner_mk1', 'bulk_hold', 'expanded_hold', 'light_cannon'] as const;
  expect(fittedSpeedMult([...withBulk])).toBeCloseTo(0.8);
  expect(fittedTotal([...withBulk], 'cargoM3')).toBe(1400);
  expect(fittedSpeedMult(['miner_mk1', 'expanded_hold', 'shield_booster', 'light_cannon'])).toBe(1);
});

async function openFitting(page: Page) {
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
}

test('bulk hold: bought into a free slot, the hold is 900 bigger, top speed 20% lower, and a reload keeps it', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, BASE);
  await enterGame(page);
  const before = (await readSave(page))!;

  // Before: the Ferrier's top speed, 88 px/s = 1.76 km/s (content/flight.ts: 0.4 × 220 thrust), with no slowdown shown.
  await openFitting(page);
  await expect(page.getByText('1.76 km/s', {exact: true})).toBeVisible();
  await page.keyboard.press('Escape');

  await settle(page);
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  const card = page.locator('div', {hasText: 'Bulk Hold', has: page.getByRole('button', {name: 'Buy'})}).last();
  await expect(card).toContainText('+900 hold, -20% speed');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('bulk_hold');
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks - 1600);
  expect(after.cargoMax).toBe(before.cargoMax + 900);
  await page.keyboard.press('Escape');

  const checkFitting = async () => {
    await openFitting(page);
    await expect(page.getByText(`${(before.cargoMax + 900).toLocaleString('en-US')} m³`)).toBeVisible();
    // 88 × 0.8 = 70.4 px/s = 1.41 km/s. The value holds its change in a nested span, so match the row as a whole.
    await expect(page.getByText('Max speed', {exact: true}).locator('..')).toHaveText('Max speed1.41 km/s(-20%)');
  };
  await checkFitting();

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  const reloaded = (await readSave(page))!;
  expect(reloaded.fitting.fitted).toContain('bulk_hold');
  expect(reloaded.cargoMax).toBe(before.cargoMax + 900);
  await checkFitting();
  expectClean(problems);
});
