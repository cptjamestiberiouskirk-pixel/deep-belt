import {expect, test, type Page} from '@playwright/test';
import {enterGame, flyTo, openWithSave, readSave, RICH, targetPanel, undock} from './helpers';

// Guards the respawn timer after a kill: the Vael pirate must stay dead for its
// 180 s wait whoever lands the killing blow, so a defense drone kill can't skip
// the wait. The player moves more than 20 km (1,000 px) from the pirate's home
// at (1400, -900), the distance at which a dead pirate may come back.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 1, commandPiloting: 4, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, ...s}});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const player = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player());
const vael = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.vaelPirate());

/** Deploys the drone at `row` of the Drone Control Bay (1 is defense) and closes the bay. */
async function deploy(page: Page, row: number) {
  await page.keyboard.press('d');
  await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible();
  for (let i = 0; i < row; i++) await page.keyboard.press('ArrowDown');
  await expect(async () => {
    await page.keyboard.press('Enter');
    await expect(page.getByText('Bandwidth: 1 / 2')).toBeVisible({timeout: 2000});
  }).toPass({timeout: 20_000});
  await page.keyboard.press('Escape');
}

/** Kills the Vael pirate, by the ship's gun or (drone) by a defense drone, then warps 33 km away. Returns marks gained and the kill's page-clock time. */
async function killAndLeave(page: Page, drone: boolean) {
  await openWithSave(page, {...BASE, ...skills({gunnery: 3, armorLayering: 5}), ...fitting(['miner_mk1', 'composite_armor', null, 'lance_driver']), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, ...(drone ? {cargoDefenseDrone: 1} : {})});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  await flyTo(page, 'Vael Belt');
  // The page's own clock stamps the moment the pirate is first seen dead.
  await page.evaluate(() => {
    const w = window as any;
    w.__kill = {seen: false, t: 0};
    setInterval(() => {
      const alive = w.__DEEP_BELT_PROBE__.vaelPirate().isAlive;
      if (alive) w.__kill.seen = true;
      else if (w.__kill.seen && !w.__kill.t) w.__kill.t = performance.now();
    }, 50);
  });
  if (drone) await deploy(page, 1);
  const marks0 = (await readSave(page))!.marks;
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Heavy Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Heavy Pirate Frigate/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  const start = Date.now();
  let gunOff = false;
  let q = await vael(page);
  while (q.isAlive && Date.now() - start < 240_000) {
    await page.waitForTimeout(80);
    q = await vael(page);
    // Stop the gun while the pirate is low, so the drone lands the last blow.
    if (drone && !gunOff && q.isAlive && q.shield + q.armor + q.hull <= 70) {
      if ((await player(page)).cannonActive) await page.keyboard.press('2');
      gunOff = true;
    }
  }
  expect(q.isAlive, 'the pirate should be dead').toBe(false);
  if (drone) expect(gunOff, 'the gun should have been stopped before the kill').toBe(true);
  await expect.poll(async () => (await readSave(page))!.marks, {timeout: 15_000}).not.toBe(marks0);
  const gained = (await readSave(page))!.marks - marks0;
  // Vael Station is 1,664 px from the pirate's home.
  await flyTo(page, 'Vael Station');
  const p = await player(page);
  expect(Math.hypot(p.x - 1400, p.y + 900), 'player should be over 20 km (1,000 px) from the pirate home').toBeGreaterThan(1000);
  return gained;
}

/** Waits until the page clock is `sec` seconds past the kill. */
async function untilSecAfterKill(page: Page, sec: number) {
  await page.evaluate((s) => new Promise<void>((resolve) => {
    const t = setInterval(() => {
      const k = (window as any).__kill;
      if (k.t && performance.now() - k.t >= s * 1000) { clearInterval(t); resolve(); }
    }, 100);
  }), sec);
}

test('a defense drone kill leaves the Vael pirate dead for its 180 s wait', async ({page}) => {
  test.setTimeout(300_000);
  const gained = await killAndLeave(page, true);
  expect(gained).toBe(600);
  await untilSecAfterKill(page, 60);
  // One read at about 60 s, not a retrying expect.
  const q = await vael(page);
  expect(q.isAlive, 'pirate is back 60 s after a drone kill, 20+ km away').toBe(false);
});

test('a gun kill leaves the Vael pirate dead at 60 s and brings it back within 190 s', async ({page}) => {
  test.setTimeout(420_000);
  const gained = await killAndLeave(page, false);
  expect(gained).toBe(600);
  await untilSecAfterKill(page, 60);
  expect((await vael(page)).isAlive, 'pirate is back 60 s after a gun kill, 20+ km away').toBe(false);
  await expect.poll(async () => (await vael(page)).isAlive, {timeout: 140_000, intervals: [1000]}).toBe(true);
  const sinceKill = await page.evaluate(() => (performance.now() - (window as any).__kill.t) / 1000);
  expect(sinceKill).toBeLessThan(190);
});

// The user, 2026-11-24: a dead pirate's respawn countdown runs while the ship is in
// another system. Only the current system's pirate is updated each frame (App.tsx, the
// pirate pick in the game loop), so the other one's wait is counted down separately.
test('the Belt Two pirate\'s respawn countdown keeps running while the ship is in Vael', async ({page}) => {
  test.setTimeout(300_000);
  const beltTwo = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate());
  await openWithSave(page, {...BASE, ...skills({gunnery: 3, armorLayering: 5}), ...fitting(['miner_mk1', 'composite_armor', null, 'lance_driver']), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Belt Two');
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  await expect.poll(async () => (await beltTwo(page)).isAlive, {timeout: 120_000, intervals: [200]}).toBe(false);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  const t1 = (await beltTwo(page)).respawnTimer;
  expect(t1, 'the wait should still be running on arrival in Vael').toBeGreaterThan(30);
  await page.waitForTimeout(15_000); // a span of the game's clock, not a wait for a condition
  const t2 = (await beltTwo(page)).respawnTimer;
  // The game caps a frame's step at 0.05 s (App.tsx update()), so under load its clock can
  // run slower than the wall clock: half the span is the floor. A frozen wait takes off 0.
  expect(t1 - t2, '15 s in Vael should take about 15 s off the wait').toBeGreaterThan(7.5);
  expect(t1 - t2).toBeLessThan(18);
  expect((await beltTwo(page)).isAlive).toBe(false);
});
