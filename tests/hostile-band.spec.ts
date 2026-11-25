import {expect, test, type Page} from '@playwright/test';
import {enterGame, flyTo, launch, openWithSave, readSave, RICH, settle, undock} from './helpers';
import {PIXELS_PER_KM} from '../content/flight';
import {inBandTurn, SKIFF} from '../content/hostiles';

// Step 51 of design/content-tree.md: a hostile inside its standoff band orbits the ship and
// steers back toward its standoff, through the one helper content/hostiles.ts inBandTurn.
// Before step 51, five copies of that steering in App.tsx turned it away from the standoff,
// so it rode a band edge. Step 50 found this for the Skiff, whose edge was past the 10 km
// lock range, and turned only the Skiff's branch of the raider copy around. The first test
// pins the helper's sign at each hostile's standoff and band. Each other test parks the
// ship (in the Rift it approaches the Sentinel first), brings a hostile into the fight
// (by selecting it within sensor reach, or for the wave raiders by the sale that sends
// them), waits until it is inside its band and then samples its distance for 15 s: the
// median is within 0.3 km of the standoff.

// Each hostile's standoff and band: App.tsx, and content/hostiles.ts for the Skiff.
const BANDS = [
  {who: 'the Belt Two pirate and the wave raiders', standoffKm: 5.0, bandKm: 0.6},
  {who: 'the Vael pirate, the Ash Drift pirate and the Rift Corsair', standoffKm: 5.8, bandKm: 0.6},
  {who: 'the Rift Sentinel', standoffKm: 4.0, bandKm: 0.5},
  {who: 'the Skiff', standoffKm: SKIFF.standoffKm, bandKm: SKIFF.standoffBandKm},
];

test('turn: inside its band a hostile closes past its standoff, opens short of it, and holds at it', () => {
  // A hostile's speed away from the ship, as a share of its speed, when it flies
  // angleFromPlayer + pi/2 + turn (App.tsx): negative closes, positive opens.
  const outward = (distanceKm: number, standoffKm: number) => Math.cos(Math.PI / 2 + inBandTurn(distanceKm, standoffKm));
  for (const b of BANDS) {
    const s = b.standoffKm;
    expect(outward(s, s), `${b.who} at the standoff`).toBeCloseTo(0, 9);
    // Out to each band edge, where the in-band steering hands over to closing or backing off.
    for (const off of [0.1, b.bandKm / 2, b.bandKm]) {
      expect(outward(s + off, s), `${b.who}, ${off} km past the standoff`).toBeLessThan(0);
      expect(outward(s - off, s), `${b.who}, ${off} km short of the standoff`).toBeGreaterThan(0);
    }
  }
  // Never more than 0.4 rad off the tangent.
  expect(inBandTurn(100, 5)).toBeCloseTo(0.4, 9);
  expect(inBandTurn(0, 5)).toBeCloseTo(-0.4, 9);
});

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0, armorMending: 0, ...s}});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
// The heavies deal 22 every 3 s and a plain Ferrier has 240 HP: Shield Operation V, Armor
// Layering V and a Composite Armor keep the ship out for the whole sample.
const STURDY = {...skills({shieldOp: 5, armorLayering: 5}), ...fitting(['miner_mk1', 'composite_armor', null, 'light_cannon'])};

type Xy = {x: number; y: number};
const probe = <T,>(page: Page, getter: string) => page.evaluate((g) => (window as any).__DEEP_BELT_PROBE__[g]() as unknown, getter) as Promise<T>;
const player = (page: Page) => probe<Xy & {docked: boolean}>(page, 'player');
const km = (a: Xy, b: Xy) => Math.hypot(a.x - b.x, a.y - b.y) / PIXELS_PER_KM;
// The distance in the hostile's Overview row ("Rift Corsair 5.8 km").
const overviewKm = async (page: Page, name: string) => {
  const m = (await page.innerText('body')).match(new RegExp(`${name}\\s+([\\d.]+) km`));
  return m ? Number(m[1]) : Infinity;
};
const selectShip = async (page: Page, name: string) => {
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText(name, {exact: true}).first().click();
};

// Waits until the reading is inside the band, waits 3 s more, then samples it for 15 s
// and checks the median, and that the ship was not lost meanwhile.
async function expectHolds(page: Page, read: () => Promise<number[]>, standoffKm: number, bandKm: number) {
  await expect.poll(async () => Math.max(...(await read())), {timeout: 90_000}).toBeLessThan(standoffKm + bandKm);
  await page.waitForTimeout(3000);
  const samples: number[] = [];
  for (const t0 = Date.now(); Date.now() - t0 < 15_000; await page.waitForTimeout(150)) samples.push(...(await read()));
  expect((await player(page)).docked, 'the ship was lost during the sample').toBe(false);
  const sorted = samples.filter(Number.isFinite).sort((a, b) => a - b);
  expect(sorted.length).toBeGreaterThan(20);
  const median = sorted[Math.floor(sorted.length / 2)];
  expect(median, `median of ${sorted.length} samples, ${sorted[0].toFixed(2)} to ${sorted[sorted.length - 1].toFixed(2)} km`).toBeGreaterThan(standoffKm - 0.3);
  expect(median, `median of ${sorted.length} samples, ${sorted[0].toFixed(2)} to ${sorted[sorted.length - 1].toFixed(2)} km`).toBeLessThan(standoffKm + 0.3);
}

test('Belt Two pirate: provoked, with the ship parked it holds near its 5.0 km standoff', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Belt Two');
  await selectShip(page, 'Pirate Frigate');
  await expectHolds(page, async () => [km(await probe<Xy>(page, 'pirate'), await player(page))], 5.0, 0.6);
});

test('wave raiders: with the ship parked after a sale they hold near their 5.0 km standoff', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY, cargoFerrite: 240});
  await enterGame(page);
  await page.keyboard.press('1');
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
  await expect.poll(async () => (await probe<Xy[]>(page, 'raiders')).length, {timeout: 20_000}).toBe(2);
  await expectHolds(page, async () => {
    const p = await player(page);
    return (await probe<Xy[]>(page, 'raiders')).map((r) => km(r, p));
  }, 5.0, 0.6);
});

test('Ash Drift pirate: provoked, with the ship parked it holds near its 5.8 km standoff', async ({page}) => {
  test.setTimeout(300_000);
  await openWithSave(page, {...BASE, ...STURDY, hasGatePermit: true});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Ash Drift');
  // It comes in 8 km from the ship 90 s after the arrival (App.tsx: the arrival sets the
  // Ash Drift countdown to 90 s).
  await expect(page.getByText('HOSTILE INBOUND // HEAVY PIRATE').first()).toBeVisible({timeout: 120_000});
  await selectShip(page, 'Heavy Pirate Frigate');
  await expectHolds(page, async () => [await overviewKm(page, 'Heavy Pirate Frigate')], 5.8, 0.6);
});

test('Rift Corsair: with the ship parked at Cinder Rift it holds near its 5.8 km standoff', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Cinder Rift');
  await selectShip(page, 'Rift Corsair');
  // The warp ends about 2 km from it (Cinder Rift at -3400, 2200; the Corsair at -3500,
  // 2200 in App.tsx), nearer than its band: it backs off first.
  await expect.poll(() => overviewKm(page, 'Rift Corsair'), {timeout: 30_000}).toBeGreaterThan(5.8 - 0.6);
  await expectHolds(page, async () => [await overviewKm(page, 'Rift Corsair')], 5.8, 0.6);
});

test('Rift Sentinel: provoked, with the ship parked it holds near its 4.0 km standoff', async ({page}) => {
  test.setTimeout(300_000);
  // Into the Rift and stage 1, as tests/lategame.spec.ts enterRift does.
  await launch(page, {...STURDY, cargoRiftSync: 1});
  await flyTo(page, 'Rift Anomaly');
  await expect(async () => {
    await page.keyboard.press('z');
    await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible({timeout: 3000});
  }).toPass({timeout: 30_000});
  await page.keyboard.press('Enter');
  await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});
  await page.keyboard.press('p');
  await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible();
  // Warp is blocked in the Rift and Sentinel 1 is 58 km from the entry, so the ship
  // approaches it and brakes once it is inside the 20 km where selecting it provokes it
  // (App.tsx HOSTILE_PROVOKE_RANGE_KM); holding S cancels the approach.
  await page.getByText('Rift Sentinel 1', {exact: true}).click();
  await page.keyboard.press('q');
  await expect.poll(() => overviewKm(page, 'Rift Sentinel 1'), {timeout: 120_000, intervals: [250]}).toBeLessThan(16);
  await page.keyboard.down('s');
  await page.waitForTimeout(2000);
  await page.keyboard.up('s');
  await expectHolds(page, async () => [await overviewKm(page, 'Rift Sentinel 1')], 4.0, 0.5);
});
