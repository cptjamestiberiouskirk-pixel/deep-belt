import fs from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import {enterGame, flyTo, launch, openWithSave, readSave, RICH, settle, undock} from './helpers';
import {PIXELS_PER_KM} from '../content/flight';
import {HOSTILE_MAX_TURN_RAD_S, HOSTILE_TURN_ACCEL_RAD_S2, inBandTurn, SKIFF, standoffTurn, steerHeading} from '../content/hostiles';
import {flightIds, flightStats, recordFlight} from './flight';

// Step 52 of design/content-tree.md: a hostile flies like a ship, straight or in a steady
// turn. Every hostile steers through content/hostiles.ts: standoffTurn, one continuous turn
// off the tangent of its orbit (no jump at a band edge), and steerHeading, a turn rate capped
// at HOSTILE_MAX_TURN_RAD_S that changes by at most HOSTILE_TURN_ACCEL_RAD_S2. Before it, a
// hostile turned at up to 3.5 rad/s toward a target that jumped about 76 degrees at each
// band edge, so a ship flying at it saw it snap round at 200 degrees a second, and the Skiff
// flip 82 times a minute. The unit tests pin both helpers; the others fly the ship at each
// hostile type and away from it and read its heading every frame (tests/flight.ts).

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('standoffTurn: inBandTurn in the middle of the band, a quarter turn from each edge out, and no jump between', () => {
  for (const [s, band] of [[5.0, 0.6], [5.8, 0.6], [4.0, 0.5], [9.5, 0.6]]) {
    const inner = band - 0.3;
    for (const off of [-inner, -inner / 2, -0.1, 0, 0.1, inner / 2, inner]) expect(standoffTurn(s + off, s, band)).toBeCloseTo(inBandTurn(s + off, s), 9);
    // Full approach and full back-off from the edges the old steering switched at.
    expect(standoffTurn(s + band, s, band)).toBeCloseTo(Math.PI / 2, 9);
    expect(standoffTurn(s - band, s, band)).toBeCloseTo(-Math.PI / 2, 9);
    expect(Math.abs(standoffTurn(s + band - 0.15, s, band))).toBeLessThan(Math.PI / 2 - 0.3);
    expect(standoffTurn(s + 50, s, band)).toBeCloseTo(Math.PI / 2, 9);
    expect(standoffTurn(Math.max(0, s - 50), s, band)).toBeCloseTo(-Math.PI / 2, 9);
    let worst = 0;
    for (let d = Math.max(0, s - 3); d < s + 3; d += 0.005) worst = Math.max(worst, Math.abs(standoffTurn(d + 0.005, s, band) - standoffTurn(d, s, band)));
    expect(worst, 'the most the turn changes over 5 m').toBeLessThan(0.03);
  }
});

// Runs steerHeading at 60 frames a second, returning each frame's heading.
function fly(target: (t: number) => number, sec: number, heading = 0) {
  const ship = {heading};
  const dt = 1 / 60;
  const out: number[] = [heading];
  for (let i = 1; i <= sec * 60; i++) {
    steerHeading(ship, target(i * dt), dt);
    out.push(ship.heading);
  }
  return out;
}
const rates = (h: number[]) => h.slice(1).map((x, i) => wrap(x - h[i]) * 60);

test('steerHeading: a quarter turn at no more than the cap, started and ended smoothly, with no overshoot', () => {
  const h = fly(() => Math.PI / 2, 4);
  const r = rates(h);
  expect(Math.max(...r.map(Math.abs))).toBeLessThanOrEqual(HOSTILE_MAX_TURN_RAD_S + 1e-9);
  for (let i = 1; i < r.length; i++) expect(Math.abs(r[i] - r[i - 1])).toBeLessThanOrEqual(HOSTILE_TURN_ACCEL_RAD_S2 / 60 + 1e-9);
  expect(Math.max(...h)).toBeLessThan(Math.PI / 2 + 0.01);
  expect(h[h.length - 1]).toBeCloseTo(Math.PI / 2, 2);
});

test('steerHeading: holds a steady orbit\'s turn without lagging, and never flips frame to frame on a jumping target', () => {
  // An orbit's tangent turns at 0.3 rad/s (a 5 km circle at 70 px/s is about 0.28).
  const h = fly((t) => 0.3 * t, 5);
  expect(Math.abs(wrap(h[h.length - 1] - 0.3 * 5))).toBeLessThan(0.02);
  // A target that jumps a radian either way every frame: the turn rate still changes smoothly.
  const r = rates(fly((t) => (Math.round(t * 60) % 2 ? 1 : -1), 3));
  for (let i = 1; i < r.length; i++) expect(Math.abs(r[i] - r[i - 1])).toBeLessThanOrEqual(HOSTILE_TURN_ACCEL_RAD_S2 / 60 + 1e-9);
  expect(Math.max(...r.map(Math.abs))).toBeLessThanOrEqual(HOSTILE_MAX_TURN_RAD_S + 1e-9);
});

test('steerHeading: starts over after a heading set outside it, ignores a 0 s step, and keeps a given cap', () => {
  const dt = 1 / 60;
  const ship = {heading: 0};
  for (let i = 0; i < 120; i++) steerHeading(ship, Math.PI, dt);
  // Turning at its cap; then a respawn points it elsewhere: the next frame starts from no turn.
  ship.heading = 2;
  steerHeading(ship, 2 + Math.PI / 2, dt);
  expect(Math.abs(ship.heading - 2)).toBeLessThanOrEqual(HOSTILE_TURN_ACCEL_RAD_S2 * dt * dt + 1e-9);
  const was = ship.heading;
  steerHeading(ship, was + 1, 0);
  steerHeading(ship, was + 1, -0.01);
  expect(ship.heading).toBe(was);
  // The Skiff's own cap: its turn rate changing by at most three times that a second.
  const cap = SKIFF.turnRadS;
  const r = rates(((s) => { const out = [s.heading]; for (let i = 0; i < 120; i++) { steerHeading(s, Math.PI, dt, cap); out.push(s.heading); } return out; })({heading: 0}));
  expect(Math.max(...r.map(Math.abs))).toBeCloseTo(cap, 6);
  for (let i = 1; i < r.length; i++) expect(Math.abs(r[i] - r[i - 1])).toBeLessThanOrEqual(3 * cap / 60 + 1e-9);
});

// In game. Writes one JSON line a hostile and case to FLIGHT_OUT when it is set (the step 52 probe).
const OUT = process.env.FLIGHT_OUT;
const LABEL = process.env.FLIGHT_LABEL ?? 'run';
const DEG = 180 / Math.PI;
/** The 95th percentile turn rate a hostile may show, in degrees a second: its cap and 5% for a frame's timing (90 at 1.5 rad/s). */
const p95Limit = (capRadS: number) => capRadS * DEG * 1.05;
/**
 * Turn reversals a case may show. Two, not one: a hostile that orbits, turns away from a ship
 * flying at it, then turns about to follow it once it has flown past, reverses twice, each a
 * smooth arc (the Rift Sentinel, step 52's probe). Riding a band edge reversed 10 to 18 times in
 * the same cases before step 51, and the Skiff 11 times when a ship flew at it before step 52.
 */
const MAX_REVERSALS = 2;
const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0, armorMending: 0, ...s}});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
// Sturdy enough to sit in a heavy pirate's fire for the whole sample (tests/hostile-band.spec.ts).
const STURDY = {...skills({shieldOp: 5, armorLayering: 5}), ...fitting(['miner_mk1', 'composite_armor', null, 'light_cannon'])};
const IN_VAEL = {missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, currentSystem: 'Vael', isDocked: true};

const probe = (page: Page, g: string) => page.evaluate((x) => (window as any).__DEEP_BELT_PROBE__[x](), g);
const km = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y) / PIXELS_PER_KM;
const overviewKm = async (page: Page, name: string) => {
  const m = (await page.innerText('body')).match(new RegExp(`${name}\\s+([\\d.]+) km`));
  return m ? Number(m[1]) : Infinity;
};
const selectShip = async (page: Page, name: string) => {
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText(name, {exact: true}).first().click();
};
const first = async (page: Page, getter: string, name?: string) => {
  const v = await probe(page, getter);
  return (Array.isArray(v) ? v.filter((s: any) => !name || s.name === name) : [v])[0];
};
// Turns the ship until it points at the hostile, or away from it, within 0.12 rad (A turns
// left, the heading going down; D right: App.tsx's manual turn).
async function face(page: Page, getter: string, name: string | undefined, away: boolean) {
  for (let i = 0; i < 60; i++) {
    const [h, p] = [await first(page, getter, name), await probe(page, 'player')];
    const d = wrap(Math.atan2(h.y - p.y, h.x - p.x) + (away ? Math.PI : 0) - p.heading);
    if (Math.abs(d) < 0.12) return;
    const key = d > 0 ? 'd' : 'a';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.max(30, Math.min(200, Math.abs(d) * 150)));
    await page.keyboard.up(key);
  }
}

// Three cases: the ship parked (orbit, 15 s), flying at the hostile (close, 8 s) and away
// from it (flee, 8 s). In each, every hostile's turn rate has a 95th percentile at or under
// p95Limit of its cap and it reverses its turn at most MAX_REVERSALS times. When the ship flies
// at it, it turns away at no less than half its cap: a cap set too low (a Skiff at 1.5 rad/s,
// which cannot keep its distance) fails here every time, where a distance check fails only now
// and then. Half, because a 90 degree turn away peaks below the cap (the Skiff's at 170 to 183
// degrees a second against its 201, step 52's runs), and a 1.5 rad/s cap peaks at 86.
async function expectSmooth(page: Page, who: string, getter: string, name?: string, capRadS = HOSTILE_MAX_TURN_RAD_S) {
  await page.waitForTimeout(3000);
  const problems: string[] = [];
  for (const [phase, sec] of [['orbit', 15], ['close', 8], ['flee', 8]] as const) {
    if (phase !== 'orbit') {
      await page.keyboard.down('s');
      await page.waitForTimeout(1500);
      await page.keyboard.up('s');
      await face(page, getter, name, phase === 'flee');
      await page.keyboard.down('w');
    }
    const frames = await recordFlight(page, getter, sec, name);
    if (phase !== 'orbit') await page.keyboard.up('w');
    const ids = flightIds(frames);
    expect(ids.length, `${who}: no hostile recorded in the ${phase} case`).toBeGreaterThan(0);
    for (const id of ids) {
      const st = flightStats(frames, id, PIXELS_PER_KM);
      if (OUT) fs.appendFileSync(OUT, JSON.stringify({label: LABEL, who, phase, id, ...st}) + '\n');
      const reversals = Math.round(st.reversalsPerMin * st.seconds / 60);
      if (st.frames < 60) problems.push(`${phase} ${id}: only ${st.frames} frames`);
      if (st.p95DegS > p95Limit(capRadS)) problems.push(`${phase} ${id}: 95th percentile turn ${st.p95DegS} deg/s`);
      if (reversals > MAX_REVERSALS) problems.push(`${phase} ${id}: ${reversals} reversals in ${st.seconds} s`);
      if (phase === 'close' && st.maxDegS < 0.5 * capRadS * DEG) problems.push(`close ${id}: turned at most ${st.maxDegS} deg/s`);
    }
  }
  expect((await probe(page, 'player')).docked, 'the ship was lost').toBe(false);
  expect(problems, who).toEqual([]);
}

test('flight: the Belt Two pirate turns smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Belt Two');
  await selectShip(page, 'Pirate Frigate');
  await expect.poll(async () => km(await probe(page, 'pirate'), await probe(page, 'player')), {timeout: 60_000}).toBeLessThan(5.6);
  await expectSmooth(page, 'Belt Two pirate', 'pirate');
});

test('flight: wave raiders turn smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY, cargoFerrite: 240});
  await enterGame(page);
  await page.keyboard.press('1');
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect.poll(async () => (await probe(page, 'raiders')).length, {timeout: 30_000}).toBe(2);
  await expect.poll(async () => {
    const p = await probe(page, 'player');
    return Math.max(...(await probe(page, 'raiders')).map((r: any) => km(r, p)));
  }, {timeout: 60_000}).toBeLessThan(5.6);
  await expectSmooth(page, 'wave raiders', 'raiders');
});

test('flight: the Skiff turns smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY, ...IN_VAEL});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Gate (Harrow)');
  await expect.poll(async () => (await probe(page, 'skiff')).shots, {timeout: 60_000}).toBeGreaterThan(0);
  await expect.poll(async () => km(await probe(page, 'skiff'), await probe(page, 'player')), {timeout: 60_000}).toBeLessThan(10.1);
  await expectSmooth(page, 'Skiff', 'skiff', undefined, SKIFF.turnRadS);
});

test('flight: the Ash Drift heavy pirate turns smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(300_000);
  await openWithSave(page, {...BASE, ...STURDY, hasGatePermit: true});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Ash Drift');
  // It comes in 90 s after the arrival (App.tsx: the arrival sets the Ash Drift countdown to 90 s).
  await expect(page.getByText('HOSTILE INBOUND // HEAVY PIRATE').first()).toBeVisible({timeout: 120_000});
  await selectShip(page, 'Heavy Pirate Frigate');
  await expect.poll(() => overviewKm(page, 'Heavy Pirate Frigate'), {timeout: 60_000}).toBeLessThan(6.4);
  await expectSmooth(page, 'Ash Drift heavy pirate', 'ashPirate');
});

test('flight: the Rift Corsair turns smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(180_000);
  await openWithSave(page, {...BASE, ...STURDY});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Cinder Rift');
  await selectShip(page, 'Rift Corsair');
  // The warp ends about 2 km from it, nearer than its band: it backs off first.
  await expect.poll(() => overviewKm(page, 'Rift Corsair'), {timeout: 30_000}).toBeGreaterThan(5.2);
  await expectSmooth(page, 'Rift Corsair', 'riftCorsair');
});

test('flight: the Rift Sentinel turns smoothly in orbit, when the ship closes and when it flees', async ({page}) => {
  test.setTimeout(300_000);
  // Into the Rift and stage 1, then at Sentinel 1, as tests/hostile-band.spec.ts does.
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
  await page.getByText('Rift Sentinel 1', {exact: true}).click();
  await page.keyboard.press('q');
  await expect.poll(() => overviewKm(page, 'Rift Sentinel 1'), {timeout: 120_000, intervals: [250]}).toBeLessThan(16);
  await page.keyboard.down('s');
  await page.waitForTimeout(2000);
  await page.keyboard.up('s');
  await expect.poll(() => overviewKm(page, 'Rift Sentinel 1'), {timeout: 60_000}).toBeLessThan(4.5);
  await expectSmooth(page, 'Rift Sentinel', 'riftGuardians', 'Rift Sentinel 1');
});
