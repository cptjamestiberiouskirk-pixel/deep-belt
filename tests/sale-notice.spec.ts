import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {FERRITE_PER_TRITANIUM, noticeFerrite, saleNotice} from '../content/skills';

// Before step 14 only a Ferrite sale with Enter drew Notice. Refining the Ferrite
// first (sold as Tritanium) or selling with S (Sell All) drew none, so either one
// avoided raider waves. Now every sale counts its Ferrite plus 2 per Tritanium,
// the Ferrite each Tritanium is refined from (50 ore makes 25).

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (lowProfile: number) => ({
  skills: {mining: 2, laserTuning: 0, lowProfile, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, navigation: 0, cargoTrim: 0},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
const notice = (page: Page) => page.evaluate(() => Math.round((window as any).__DEEP_BELT_PROBE__.player().notice as number));

test('rule: a Tritanium counts as the 2 Ferrite it was refined from', () => {
  expect(FERRITE_PER_TRITANIUM).toBe(2);
  expect(noticeFerrite(600, 0)).toBe(600);
  expect(noticeFerrite(0, 300)).toBe(600);
  expect(noticeFerrite(100, 50)).toBe(200);
  // 300 Tritanium draws what 600 Ferrite does: 1,200 (capped at 100 in game) untrained, none at Low Profile V.
  expect(saleNotice(noticeFerrite(0, 300), 0)).toBe(1200);
  expect(saleNotice(noticeFerrite(0, 300), 5)).toBe(0);
  // 200 Ferrite's worth sells free before Low Profile.
  expect(saleNotice(noticeFerrite(100, 50), 0)).toBe(0);
});

/** Opens the market and waits out the officer's line, so keys act on the rows. */
async function openMarket(page: Page) {
  await settle(page);
  await page.keyboard.press('1');
  await expect(page.getByText('MARKET').first()).toBeVisible();
  await settle(page);
}

async function sellTritaniumRow(page: Page) {
  await openMarket(page);
  // The Tritanium row is the seventh: Ferrite, Aurite, Chromite, Pyrox, rare ore, scrap, Tritanium.
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoTritanium).toBe(0);
}

test('market: selling 300 Tritanium draws Notice 100 and brings a raider wave', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...PLAIN, cargoTritanium: 300});
  await enterGame(page);
  await sellTritaniumRow(page);
  expect(await notice(page)).toBe(100);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
  expectClean(problems);
});

test('market: at Low Profile V, selling 300 Tritanium draws no Notice', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...PLAIN, cargoTritanium: 300});
  await enterGame(page);
  await sellTritaniumRow(page);
  expect(await notice(page)).toBe(0);
  expectClean(problems);
});

test('market: Sell All (S) of 600 Ferrite draws Notice 100, as Enter on the row does', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...PLAIN, cargoFerrite: 600});
  await enterGame(page);
  await openMarket(page);
  await page.keyboard.press('s');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  expect(await notice(page)).toBe(100);
  expectClean(problems);
});

test('market: Sell All of 100 Ferrite and 50 Tritanium, 200 Ferrite in all, draws no Notice', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0), ...PLAIN, cargoFerrite: 100, cargoTritanium: 50});
  await enterGame(page);
  await openMarket(page);
  await page.keyboard.press('s');
  await expect.poll(async () => {
    const save = (await readSave(page))!;
    return save.cargoFerrite + save.cargoTritanium;
  }).toBe(0);
  expect(await notice(page)).toBe(0);
  expectClean(problems);
});
