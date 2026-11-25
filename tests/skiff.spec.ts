import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, openWithSave, readSave, RICH, targetPanel, undock, warpTo, watch} from './helpers';
import {PIXELS_PER_KM} from '../content/flight';
import {HOSTILE_MAX_TURN_RAD_S, SKIFF, skiffAggroKm} from '../content/hostiles';

// Step 50 of design/content-tree.md (designed in step 49): the Skiff, shown as the Raider
// Skiff, a light raider in Vael that holds 9.5 km, fires from up to 12 km and flies at a
// plain Ferrier's own top speed. It patrols 1.2 km around a post 10.5 km from where a ship
// comes out by the Vael gate, by a jump or a warp. It fights a ship that comes within
// 12 km or provokes it, holds near 9.5 km inside the 10 km lock range, leaves the fight
// past 25 km from its post, pays 300 MARKS and comes back 180 s after a kill, and one left
// behind by a jump or a death is back whole. Harrow never has one.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0, armorMending: 0, ...s}});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const IN_VAEL = {missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, currentSystem: 'Vael', isDocked: true};
type Skiff = {isAlive: boolean; respawnTimer: number; shots: number; hits: number; damage: number; shield: number; armor: number; hull: number; x: number; y: number; speed: number};
const skiff = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.skiff() as Skiff);
const player = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as {x: number; y: number; docked: boolean; warpState: string; cannonActive: boolean});
const kmTo = async (page: Page) => {
  const [s, p] = [await skiff(page), await player(page)];
  return Math.hypot(s.x - p.x, s.y - p.y) / PIXELS_PER_KM;
};
// Locks the selected Skiff. The lock range is 10 km and the Skiff's band reaches 10.1, and
// it covers 0.1 km in about 60 ms, so a press sent the moment it reads under 10 km can land
// out of range: the game then shows "Target Out of Sensor Range" and starts no lock. L is a
// toggle (a press restarts a running lock and drops a held one), so it is pressed only well
// inside 10 km, and pressed again only after that toast showed the last press was refused.
const lockSkiff = async (page: Page) => {
  const refused = page.getByText('Target Out of Sensor Range');
  for (let attempt = 1; attempt <= 5; attempt++) {
    await expect(refused).toHaveCount(0, {timeout: 15_000});
    await expect.poll(() => kmTo(page), {timeout: 60_000}).toBeLessThan(9.9);
    await page.keyboard.press('l');
    let outcome = 'none';
    for (const t0 = Date.now(); outcome === 'none' && Date.now() - t0 < 3000; await page.waitForTimeout(100)) {
      if (/Locked/.test(await targetPanel(page))) outcome = 'locked';
      else if ((await refused.count()) > 0) outcome = 'refused';
    }
    if (outcome === 'locked') return;
    expect(outcome, 'an L press either locks within 3 s or is refused').toBe('refused');
  }
  throw new Error('the Skiff was not locked after 5 presses');
};
// Fires the fitted weapon (2) until it has hurt the Skiff once, then stops it, each press
// checked before the next: the Skiff is hurt and still alive.
const hurtSkiffOnce = async (page: Page) => {
  await page.keyboard.press('2');
  await expect.poll(async () => (await player(page)).cannonActive).toBe(true);
  await expect.poll(async () => (await skiff(page)).shield, {timeout: 15_000}).toBeLessThan(SKIFF.shield);
  await page.keyboard.press('2');
  await expect.poll(async () => (await player(page)).cannonActive).toBe(false);
  const s = await skiff(page);
  expect(s.isAlive, 'hurt, not killed').toBe(true);
  expect(s.shield + s.armor + s.hull).toBeLessThan(SKIFF.shield + SKIFF.armor + SKIFF.hull);
};

test('catalog: the Skiff is raider-light, holds 9.5 km, fires from 12 km at a plain Ferrier\'s speed', () => {
  expect(SKIFF).toMatchObject({id: 'raider_skiff', name: 'Raider Skiff', shield: 60, armor: 40, hull: 30, speedShare: 1, turnRadS: 3.5, standoffKm: 9.5, standoffBandKm: 0.6, fireRangeKm: 12, boltDamage: 8, fireCycleSec: 3, respawnSec: 180, bounty: 300, patrolRadiusKm: 1.2, leashKm: 25, spawnClearKm: 20});
  // It turns faster than the other hostiles' 1.5 rad/s: at 1.5 a ship charging it at its own
  // speed got to 6.2 km, inside a Light Cannon's 8 (step 52's probe).
  expect(SKIFF.turnRadS).toBeGreaterThan(HOSTILE_MAX_TURN_RAD_S);
  // Its band reaches inside the 10 km lock range, so a lock needs no Sensor hardpoint.
  expect(SKIFF.standoffKm - SKIFF.standoffBandKm).toBeLessThan(10);
  // It starts a fight from its own fire range at the usual 8 km signature; the Shade's 3 km gives 4.5.
  expect(skiffAggroKm(8)).toBe(12);
  expect(skiffAggroKm(3)).toBe(4.5);
  // A jump from Harrow puts the ship at (-2200, 1580) (App.tsx); a warp to the gate leaves it
  // near (-2311, 1696) (measured). Both are 10.5 km from the post, so 9.3 to 11.7 km from the
  // Skiff on its patrol: inside its 12 km sight, past its 8.9 km band edge and a Light
  // Cannon's 8 km. The post is more than 20 km from Vael Station (0, 0).
  for (const [x, y] of [[-2200, 1580], [-2311, 1696]]) {
    const arrivalKm = Math.hypot(SKIFF.postX - x, SKIFF.postY - y) / PIXELS_PER_KM;
    expect(arrivalKm - SKIFF.patrolRadiusKm).toBeGreaterThan(SKIFF.standoffKm - SKIFF.standoffBandKm);
    expect(arrivalKm + SKIFF.patrolRadiusKm).toBeLessThan(skiffAggroKm(8));
  }
  expect(Math.hypot(SKIFF.postX, SKIFF.postY) / PIXELS_PER_KM).toBeGreaterThan(SKIFF.spawnClearKm);
});

test('Harrow: no Skiff, at undock or later', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon'])});
  await enterGame(page);
  await undock(page);
  await page.waitForTimeout(3000);
  expect((await skiff(page)).isAlive).toBe(false);
  await expect(page.getByText('Raider Skiff')).toHaveCount(0);
  expectClean(problems);
});

test('Vael: the Skiff is out at its post after an undock, and shows in the Overview', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), ...IN_VAEL});
  await enterGame(page);
  await expect.poll(async () => (await skiff(page)).isAlive, {message: 'not while docked'}).toBe(false);
  await undock(page);
  await expect.poll(async () => (await skiff(page)).isAlive).toBe(true);
  const s = await skiff(page);
  expect([s.shield, s.armor, s.hull]).toEqual([60, 40, 30]);
  // It patrols within 1.2 km of its post, far from the ship at Vael Station.
  expect(Math.hypot(s.x - SKIFF.postX, s.y - SKIFF.postY) / PIXELS_PER_KM).toBeLessThanOrEqual(SKIFF.patrolRadiusKm + 0.8);
  expect(await kmTo(page)).toBeGreaterThan(30);
  expect(s.shots).toBe(0);
  await page.getByText('Ships', {exact: true}).click();
  await expect(page.getByText('Raider Skiff', {exact: true})).toBeVisible();
  expectClean(problems);
});

test('fight: provoked, it closes to its 9.5 km band at a plain Ferrier\'s speed and hits from past 8 km', async ({page}) => {
  test.setTimeout(120_000);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  // Selecting it from within 20 km provokes it.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Raider Skiff', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider Skiff/);
  let topSpeed = 0;
  await expect.poll(async () => {
    topSpeed = Math.max(topSpeed, (await skiff(page)).speed);
    const km = await kmTo(page);
    return km >= SKIFF.standoffKm - SKIFF.standoffBandKm - 0.2 && km <= SKIFF.standoffKm + SKIFF.standoffBandKm + 0.2;
  }, {timeout: 60_000, intervals: [250]}).toBe(true);
  // 88 px/s is a plain Ferrier's top speed at Navigation 0 (App.tsx hostileBaseSpeed).
  expect(Math.round(topSpeed)).toBe(88);
  // It hits the parked ship from inside its band, past a Light Cannon's 8 km.
  const s0 = await skiff(page);
  await expect.poll(async () => (await skiff(page)).hits, {timeout: 20_000}).toBeGreaterThan(s0.hits);
  const km = await kmTo(page);
  expect(km).toBeGreaterThan(8);
  const s1 = await skiff(page);
  expect(s1.damage - s0.damage).toBe((s1.hits - s0.hits) * SKIFF.boltDamage);
  // The Overview shows its distance in amber: past the Light Cannon's 8 km.
  const dist = page.getByTestId(`overview-distance-${SKIFF.id}`);
  await expect(dist).toHaveAttribute('data-beyond-reach', 'true');
  await expect(dist).toHaveAttribute('title', "Beyond your Light Cannon's 8 km range");
});

test('band: with the ship parked at the gate it holds near 9.5 km, inside the 10 km lock range', async ({page}) => {
  test.setTimeout(120_000);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  // Not selected: the ship comes out within its 12 km, so it starts the fight itself.
  await expect.poll(async () => (await skiff(page)).shots, {timeout: 60_000}).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  const km: number[] = [];
  for (const t0 = Date.now(); Date.now() - t0 < 15_000; await page.waitForTimeout(150)) km.push(await kmTo(page));
  const sorted = [...km].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  expect(median).toBeGreaterThan(SKIFF.standoffKm - 0.3);
  expect(median).toBeLessThan(SKIFF.standoffKm + 0.3);
  // Inside the 10 km lock range at least nine samples in ten, so a pilot can lock it.
  expect(km.filter((k) => k <= 10).length / km.length).toBeGreaterThanOrEqual(0.9);
});

test('chase: a Light Cannon at Navigation 0 approaching it never gets inside its 8 km reach', async ({page}) => {
  test.setTimeout(150_000);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Raider Skiff', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider Skiff/);
  await expect.poll(() => kmTo(page), {timeout: 60_000}).toBeLessThan(SKIFF.standoffKm + SKIFF.standoffBandKm);
  await page.keyboard.press('q');
  // 40 s of chasing at the Skiff's own speed, which takes the ship past the 25 km leash
  // (the probe saw a Skiff going home pass within 2 km of the ship before it kept off).
  let nearest = Infinity;
  const start = Date.now();
  while (Date.now() - start < 40_000) {
    nearest = Math.min(nearest, await kmTo(page));
    await page.waitForTimeout(200);
  }
  expect(nearest).toBeGreaterThan(8);
  expect((await player(page)).docked).toBe(false);
});

test('warp: once the ship warps off it fires no more, and past its leash it goes back to its post', async ({page}) => {
  test.setTimeout(150_000);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Raider Skiff', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider Skiff/);
  // Wait for a hit, not just a shot: a hit marks the ship's attacker, so only the leash, not the
  // 20 km selection range, can be what sends it home once the ship is at the station.
  await expect.poll(async () => (await skiff(page)).hits, {timeout: 60_000}).toBeGreaterThan(0);
  await warpTo(page, 'Vael Station');
  await expect.poll(async () => (await player(page)).warpState).not.toBe('IDLE');
  const shotsAtWarp = (await skiff(page)).shots;
  await expect(page.getByText('Dropped out of warp at Vael Station.').first()).toBeVisible({timeout: 60_000});
  await page.waitForTimeout(8000);
  expect((await skiff(page)).shots).toBe(shotsAtWarp);
  // Vael Station is about 58 km from its post, past the 25 km leash: it heads home.
  await expect.poll(async () => {
    const s = await skiff(page);
    return Math.hypot(s.x - SKIFF.postX, s.y - SKIFF.postY) / PIXELS_PER_KM <= SKIFF.patrolRadiusKm + 0.8;
  }, {timeout: 60_000, intervals: [500]}).toBe(true);
});

test('kill: 300 MARKS, its own toast, its wreck selected and a 180 s wait started', async ({page}) => {
  test.setTimeout(150_000);
  await openWithSave(page, {...BASE, ...skills({gunnery: 5}), ...fitting(['miner_mk1', null, null, 'lance_driver_ii']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  const marks0 = (await readSave(page))!.marks as number;
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Raider Skiff', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider Skiff/);
  // It comes to its band, inside the 10 km lock range and the Lance's 12 km.
  await expect.poll(() => kmTo(page), {timeout: 60_000}).toBeLessThan(10);
  // Inside the Lance Driver II's 12 km, so the Overview shows its distance plain.
  const dist = page.getByTestId(`overview-distance-${SKIFF.id}`);
  await expect(dist).not.toHaveAttribute('data-beyond-reach', 'true');
  await lockSkiff(page);
  await page.keyboard.press('2');
  await expect.poll(async () => (await skiff(page)).isAlive, {timeout: 60_000}).toBe(false);
  await expect(page.getByText('SKIFF BOUNTY CLAIMED!').first()).toBeVisible();
  const s = await skiff(page);
  expect(s.respawnTimer).toBeGreaterThan(170);
  expect(s.respawnTimer).toBeLessThanOrEqual(180);
  await expect.poll(async () => ((await readSave(page))!.marks as number) - marks0, {timeout: 15_000}).toBe(SKIFF.bounty);
  // The kill selects its wreck.
  await expect.poll(() => targetPanel(page)).toMatch(/Wreck/);
});

// Docking clears every raider, so an unkilled Skiff is back whole at its post after an
// undock. A jump and a death leave the ship's system or dock it without that clear.
const meetAndHurt = async (page: Page) => {
  await openWithSave(page, {...BASE, ...skills({gunnery: 2}), ...fitting(['miner_mk1', null, null, 'lance_driver']), ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Raider Skiff', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Raider Skiff/);
  await lockSkiff(page);
  // A Lance Driver at Gunnery II hits for 56 every 4 s: the Skiff's 130 takes three.
  await hurtSkiffOnce(page);
};
const expectWhole = async (page: Page) => {
  await expect.poll(async () => (await skiff(page)).isAlive, {timeout: 5000}).toBe(true);
  const s = await skiff(page);
  expect([s.shield, s.armor, s.hull], 'a new Skiff, not the hurt one').toEqual([SKIFF.shield, SKIFF.armor, SKIFF.hull]);
  expect(s.respawnTimer).toBe(0);
};

test('jump: a Skiff hurt and left behind by a jump is back whole when the ship returns', async ({page}) => {
  test.setTimeout(180_000);
  await meetAndHurt(page);
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Harrow System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 30_000});
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  await expectWhole(page);
});

test('death: a Skiff that hurt and then destroyed the ship is back whole after the undock', async ({page}) => {
  test.setTimeout(300_000);
  await meetAndHurt(page);
  // The ship sits under its fire: about 90 s (design/content-tree.md, step 50 Status).
  await expect(page.getByText(/Vessel destroyed/)).toBeVisible({timeout: 200_000});
  await expect.poll(async () => (await player(page)).docked).toBe(true);
  await undock(page);
  await expectWhole(page);
});

test('arrival: a ship that jumps in from Harrow meets it at the Vael gate', async ({page}) => {
  test.setTimeout(150_000);
  await openWithSave(page, {...BASE, ...skills({}), ...fitting(['miner_mk1', null, null, 'light_cannon']), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true});
  await enterGame(page);
  await undock(page);
  expect((await skiff(page)).isAlive).toBe(false);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  // The ship arrives 10.5 km from its post, inside the 20 km that would keep it in
  // otherwise: it comes out on arrival, and the ship is within its 12 km.
  await expect.poll(async () => (await skiff(page)).isAlive, {timeout: 5000}).toBe(true);
  expect(await kmTo(page)).toBeLessThan(12);
  await expect.poll(async () => (await skiff(page)).shots, {timeout: 30_000}).toBeGreaterThan(0);
});
