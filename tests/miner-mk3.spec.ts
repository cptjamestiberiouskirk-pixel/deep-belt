import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, flyTo, mineUntil, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {MARKET_MODULE_IDS, MINER_IDS, MODULES, minerFor, missingSkill} from '../content/modules';
import {buy, canBuyMore, newGameFitting, parseFitting, toLegacy, type FittingState} from '../content/fitting';

// Miner MK3 (the user, 2026-11-24): the mining line's third step, 100 ore every 8 s at
// 12 Cap, 3,000 MARKS, behind Mining V. Like the MK2 it replaces the miner it is bought
// over, in the fitted slot, the hangar and every hull's saved loadout.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (mining: number) => ({skills: {mining, laserTuning: 0, gunnery: 0, shieldOp: 0, navigation: 0}});
const MK2_FIT = {fitting: {hangar: {}, fitted: ['miner_mk2', null, null, 'light_cannon'], loadouts: {ferrier: ['miner_mk2', null, null, 'light_cannon'], tern: ['miner_mk2', null, null]}}};

test('catalog: the Miner MK3 is the mining line\'s third step, behind Mining V', () => {
  expect(MODULES.miner_mk3).toMatchObject({
    name: 'Miner MK3',
    slot: 'extraction',
    tier: 3,
    basePrice: 3000,
    statBadge: '+100% yield',
    stats: {oreYield: 100, cycleSec: 8, capPerCycle: 12},
    requires: {skill: 'mining', level: 5},
  });
  expect(MINER_IDS).toEqual(['miner_mk1', 'miner_mk2', 'miner_mk3']);
  expect(MARKET_MODULE_IDS.slice(0, 2)).toEqual(['miner_mk2', 'miner_mk3']);
  expect(missingSkill({mining: 4}, 'miner_mk3')).toBe('Mining V');
  expect(missingSkill({mining: 5}, 'miner_mk3')).toBeNull();
  // Mining reads the best miner owned.
  expect(minerFor({miner_mk1: 1}).id).toBe('miner_mk1');
  expect(minerFor({miner_mk1: 1, miner_mk2: 1}).id).toBe('miner_mk2');
  expect(minerFor({miner_mk2: 1, miner_mk3: 1}).id).toBe('miner_mk3');
  expect(minerFor({}).id).toBe('miner_mk1');
});

test('fitting model: the MK3 replaces the miner it is bought over, and only upgrades', () => {
  const mk2 = MK2_FIT.fitting as FittingState;
  // Over a fitted MK2: fitted at once, and every loadout's MK2 becomes an MK3.
  const r = buy(mk2, 'ferrier', 'miner_mk3');
  expect(r).toMatchObject({fitted: true, replaced: 'miner_mk2'});
  expect(r.state.fitted[0]).toBe('miner_mk3');
  expect(r.state.hangar).toEqual({});
  expect(r.state.loadouts.tern![0]).toBe('miner_mk3');
  expect(toLegacy(r.state).fittedSlots.slot1MiningLaser).toBe(true);
  // Neither the MK2 nor another MK3 can be bought after it.
  expect(canBuyMore(r.state, 'miner_mk2')).toBe(false);
  expect(canBuyMore(r.state, 'miner_mk3')).toBe(false);
  // Over a new pilot's fitted MK1.
  const fresh = buy(newGameFitting(), 'ferrier', 'miner_mk3');
  expect(fresh).toMatchObject({fitted: true, replaced: 'miner_mk1'});
  expect(canBuyMore(newGameFitting(), 'miner_mk3')).toBe(true);
  // Over an MK2 in the hangar (the slot empty): the MK3 takes its place there.
  const stored = buy({hangar: {miner_mk2: 1}, fitted: [null, null, null, 'light_cannon'], loadouts: {}}, 'ferrier', 'miner_mk3');
  expect(stored).toMatchObject({fitted: false, replaced: 'miner_mk2'});
  expect(stored.state.hangar).toEqual({miner_mk3: 1});
  // A saved MK3 loads back, and a save from before the MK3 loads as it was.
  expect(parseFitting(JSON.parse(JSON.stringify(r.state)), 'ferrier')).toEqual(r.state);
  expect(parseFitting(JSON.parse(JSON.stringify(mk2)), 'ferrier')).toEqual(mk2);
});

async function openMarket(page: Page) {
  await settle(page);
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
}

test('market: without Mining V the Miner MK3 card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...skills(4), ...MK2_FIT});
  await enterGame(page);
  await openMarket(page);
  const card = page.getByTestId('market-card-miner_mk3');
  await expect(card).toContainText('Needs Mining V');
  await expect(card).toContainText('+100% yield');
  await expect(card.getByRole('button', {name: 'Buy'})).toHaveCount(0);
  expectClean(problems);
});

test('miner MK3: bought over the MK2, kept on reload, and a cycle at Mining V yields 150 ore', async ({page}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...skills(5), ...MK2_FIT});
  await enterGame(page);
  const before = (await readSave(page))!;

  await openMarket(page);
  await page.getByTestId('market-card-miner_mk3').getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted[0]).toBe('miner_mk3');
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks - 3000);
  expect(after.fitting.loadouts.tern[0]).toBe('miner_mk3');
  expect(after.fitting.hangar.miner_mk2).toBeUndefined();
  // The replaced MK2's card no longer offers a Buy, and says why.
  await expect(page.getByTestId('market-card-miner_mk2')).toContainText('Upgraded ✓');
  await expect(page.getByTestId('market-card-miner_mk2').getByRole('button', {name: 'Buy'})).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect((await readSave(page))!.fitting.fitted[0]).toBe('miner_mk3');

  // Mining V is +50%, so a cycle is round(100 x 1.5) = 150; the page's own clock
  // records each change of the hold readout.
  await undock(page);
  await flyTo(page, 'Belt One');
  await page.evaluate(() => {
    const w = window as unknown as {__yields: number[]};
    w.__yields = [];
    let last = 0;
    setInterval(() => {
      const m = document.body.innerText.match(/(\d+)\/\d+m³/);
      const held = m ? Number(m[1]) : last;
      if (held > last) w.__yields.push(held - last);
      last = held;
    }, 250);
  });
  const yields = () => page.evaluate(() => (window as unknown as {__yields: number[]}).__yields);
  await mineUntil(page, async () => (await yields()).length >= 2, 120_000);
  const got = await yields();
  // A rock running dry can cut a cycle short, never lengthen it.
  expect(Math.max(...got)).toBe(150);
  expectClean(problems);
});
