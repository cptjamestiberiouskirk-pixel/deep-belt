import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, flyTo, openWithSave, readSave, RICH, settle, targetPanel, undock, watch} from './helpers';
import {MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {toLegacy} from '../content/fitting';

// Step 6 of design/content-tree.md: the first new module, the Lance Driver. It
// is a weapon behind Gunnery II, and adding it is a catalog entry: the market,
// the Fitting screen and combat pick it up from content/modules.ts.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (gunnery: number) => ({skills: {mining: 0, gunnery, shieldOp: 0, navigation: 0}});

test('catalog: the Lance Driver is a weapon behind Gunnery II, the last module card', () => {
  expect(MODULES.lance_driver).toMatchObject({
    name: 'Lance Driver',
    slot: 'weapon',
    basePrice: 1500,
    statBadge: '45 dmg / 4s',
    stats: {damage: 45, cycleSec: 4, rangeKm: 12, capPerCycle: 14},
    requires: {skill: 'gunnery', level: 2},
  });
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'expanded_hold', 'bulk_hold', 'shield_booster', 'light_cannon', 'lance_driver']);
  expect(missingSkill({gunnery: 1}, 'lance_driver')).toBe('Gunnery II');
  expect(missingSkill({gunnery: 2}, 'lance_driver')).toBeNull();
  expect(missingSkill({}, 'light_cannon')).toBeNull();
  // It arms the same controls as the Light Cannon.
  const legacy = toLegacy({hangar: {light_cannon: 1}, fitted: ['miner_mk1', null, null, 'lance_driver'], loadouts: {}});
  expect(legacy.fittedSlots.slot4Cannon).toBe(true);
  expect(legacy.upgrades.cannon).toBe(true);
});

async function openMarket(page: Page) {
  await settle(page);
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
}

test('market: without Gunnery II the Lance Driver card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  await openMarket(page);
  const card = page.locator('div', {hasText: 'Lance Driver', has: page.getByText('Needs Gunnery II', {exact: true})}).last();
  await expect(card).toContainText('45 dmg / 4s');
  await expect(card.getByRole('button', {name: 'Buy'})).toHaveCount(0);
  expectClean(problems);
});

test('market: the keyboard reaches the Lance Driver card and Enter buys it', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  await openMarket(page);
  // Focus starts on row 0 and wraps upward. After the module cards come the probe
  // launcher, the deed and six buy rows, so the last card is 9 presses up.
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowUp');
  // Enter first finishes the officer's typed-out line, so wait for it.
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.fitting.hangar.lance_driver).toBe(1);
  expectClean(problems);
});

test('lance driver: bought, fitted in place of the cannon, kept on reload, and one hit takes 54', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Buy: the Ferrier's weapon slot holds the Light Cannon, so it waits in the hangar.
  await openMarket(page);
  const card = page.locator('div', {hasText: 'Lance Driver', has: page.getByRole('button', {name: 'Buy'})}).last();
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText('Lance Driver stored')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar.lance_driver).toBe(1);
  expect((await readSave(page))!.marks).toBe(before.marks - 1500);
  await page.keyboard.press('Escape');

  // Fit: unfit the cannon, then fit the Lance Driver from the hangar list.
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await settle(page);
  await page.getByTestId('fitting-slot-3').getByRole('button', {name: 'Unfit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBeNull();
  await page.getByTestId('hangar-lance_driver').getByRole('button', {name: 'Fit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[3]).toBe('lance_driver');
  await expect(page.getByTestId('fitting-slot-3')).toContainText('Lance Driver');
  expect((await readSave(page))!.fitting.hangar).toEqual({light_cannon: 1});

  // Reload: still fitted.
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect((await readSave(page))!.fitting.fitted[3]).toBe('lance_driver');

  // Use: Gunnery II and a Ferrier, so one hit is 45 × 1.2 = 54 off the pirate's 84 shield.
  await undock(page);
  await flyTo(page, 'Belt Two');
  // Picked from the Overview, not with Tab: under full load Tab may not reach it.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
  const pirateShield = async () => {
    const text = await page.innerText('body');
    const m = text.slice(text.indexOf('Pirate Frigate')).match(/SHIELD\s*\n\s*(\d+)\/84/);
    return m ? Number(m[1]) : null;
  };
  await expect.poll(pirateShield).toBe(84);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  // The first value under 84 is after exactly one hit: the next is 4 s later.
  await expect.poll(async () => ((await pirateShield()) ?? 84) < 84, {timeout: 60_000, intervals: [200]}).toBe(true);
  expect(await pirateShield()).toBe(30);
  expectClean(problems);
});
