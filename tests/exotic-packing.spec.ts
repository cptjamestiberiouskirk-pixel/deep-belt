import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, launch, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {STATION_PRICES} from '../constants';
import {PACKING_SALE_PCT, packedSalePriceAt, SKILLS} from '../content/skills';

// Step 32 of design/content-tree.md: Exotic Packing, an Industry skill, rank 2, no
// prerequisites. Each level adds 4% to the sale price of packed exotics (Packed
// Prismite 900 is 1,080 at V, Packed Nimbus 700 is 840, Packed Radflux 1,400 is
// 1,680), at both stations, on the market row, its Sell button and Sell All. Raw
// exotics and everything else sell as before. No exotic can be bought, so the bonus
// opens no buy-and-sell loop (design note, step 32).

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (exoticPacking: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking, signalAnalysis: 0, signalRecovery: 0, armorMending: 0},
});

test('catalog: Exotic Packing is a rank 2 Industry skill with no prerequisites', () => {
  expect(SKILLS.exoticPacking).toEqual({id: 'exoticPacking', name: 'Exotic Packing', category: 'Industry', rank: 2, prerequisites: []});
});

test('catalog: each level adds 4% to a packed exotic\'s price, the same at both stations', () => {
  expect(PACKING_SALE_PCT).toBe(4);
  for (const station of ['Harrow', 'Vael'] as const) {
    const p = STATION_PRICES[station];
    expect([p.packedPrismite, p.packedNimbus, p.packedRadflux], station).toEqual([900, 700, 1400]);
  }
  const levels = [0, 1, 2, 3, 4, 5];
  expect(levels.map((l) => packedSalePriceAt(900, l))).toEqual([900, 936, 972, 1008, 1044, 1080]);
  expect(levels.map((l) => packedSalePriceAt(700, l))).toEqual([700, 728, 756, 784, 812, 840]);
  expect(levels.map((l) => packedSalePriceAt(1400, l))).toEqual([1400, 1456, 1512, 1568, 1624, 1680]);
});

/** Opens a station tab and waits for the officer's line, so the next key reaches the tab. */
async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
  await settle(page);
}

test('skills screen: Exotic Packing I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-category-Industry')).toContainText('EXOTIC PACKING');
  const card = page.getByTestId('skill-card-exoticPacking');
  await expect(card).toContainText('+0% packed exotic prices (Packed Prismite 900 MARKS)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'exoticPacking', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at Exotic Packing V, the card shows +20% and 1,080 MARKS', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-card-exoticPacking')).toContainText('+20% packed exotic prices (Packed Prismite 1,080 MARKS)');
  expectClean(problems);
});

// Untrained prices, then level V: the row's price, its Sell button and Sell All.
const CASES = [
  {level: 0, prismite: 900, nimbus: 700, radflux: 1400},
  {level: 5, prismite: 1080, nimbus: 840, radflux: 1680},
];

for (const c of CASES) {
  test(`market: at Exotic Packing ${c.level}, each packed row shows ${c.prismite}, ${c.nimbus} and ${c.radflux}, and its Sell button pays 10 times that`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...SKILLS_AT(c.level), cargoPackedPrismite: 10, cargoPackedNimbus: 10, cargoPackedRadflux: 10});
    await enterGame(page);
    await openTab(page, '1', 'MARKET');
    for (const [id, price] of [['packedPrismite', c.prismite], ['packedNimbus', c.nimbus], ['packedRadflux', c.radflux]] as const) {
      const before = (await readSave(page))!.marks;
      const row = page.getByTestId(`market-row-${id}`);
      await expect(row, id).toContainText(String(price));
      await expect(row, id).toContainText((10 * price).toLocaleString());
      await row.getByRole('button', {name: /Sell/}).first().click();
      await expect.poll(async () => (await readSave(page))!.inventory?.[id], {message: id}).toBe(0);
      expect((await readSave(page))!.marks, id).toBe(before + 10 * price);
    }
    expectClean(problems);
  });

  test(`market: at Exotic Packing ${c.level}, Sell All of 10 of each packed exotic pays ${10 * (c.prismite + c.nimbus + c.radflux)}, and raw Prismite still 90 each`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...SKILLS_AT(c.level), cargoPackedPrismite: 10, cargoPackedNimbus: 10, cargoPackedRadflux: 10, cargoPrismite: 10});
    await enterGame(page);
    const before = (await readSave(page))!;
    await openTab(page, '1', 'MARKET');
    await page.keyboard.press('s');
    await expect.poll(async () => {
      const inv = (await readSave(page))!.inventory;
      return inv.packedPrismite + inv.packedNimbus + inv.packedRadflux + inv.prismite;
    }).toBe(0);
    expect((await readSave(page))!.marks).toBe(before.marks + 10 * (c.prismite + c.nimbus + c.radflux) + 10 * 90);
    expectClean(problems);
  });
}

test('market: at Vael Station, Exotic Packing V pays the same 1,080, 840 and 1,680 a packed exotic', async ({page}) => {
  test.setTimeout(240_000);
  const problems = await launch(page, {...SKILLS_AT(5), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, cargoPackedPrismite: 10, cargoPackedNimbus: 10, cargoPackedRadflux: 10});
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  await flyTo(page, 'Vael Station');
  await expect(async () => {
    await page.keyboard.press('f');
    await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 3000});
  }).toPass({timeout: 30_000});
  const before = (await readSave(page))!;
  expect(before.currentSystem).toBe('Vael');
  await openTab(page, '1', 'MARKET');
  await page.keyboard.press('s');
  await expect.poll(async () => {
    const inv = (await readSave(page))!.inventory;
    return inv.packedPrismite + inv.packedNimbus + inv.packedRadflux;
  }).toBe(0);
  expect((await readSave(page))!.marks).toBe(before.marks + 10 * (1080 + 840 + 1680));
  expectClean(problems);
});
