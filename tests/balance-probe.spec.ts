import {appendFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {enterGame, flyTo, openWithSave, RICH, selectTarget, targetPanel, tuneLaser, undock, warpTo} from './helpers';

// Balance probe (design/content-tree.md rule 5: tuning is measured). It plays
// the production build and records numbers the screen doesn't show, through
// the read-only window.__DEEP_BELT_PROBE__ hook in App.tsx. It changes nothing
// and asserts nothing about balance: it reports.
//
// Run:  PROBE=1 npx playwright test tests/balance-probe.spec.ts
// Out:  one JSON line per measurement in test-results/balance-probe.jsonl
//       (or the file PROBE_OUT names).

test.skip(!process.env.PROBE, 'balance probe: run with PROBE=1');

const OUT = process.env.PROBE_OUT ?? 'test-results/balance-probe.jsonl';
function record(row: Record<string, unknown>) {
  mkdirSync(dirname(OUT), {recursive: true});
  appendFileSync(OUT, JSON.stringify(row) + '\n');
}

type Player = {speed: number; capacitor: number; maxCapacitor: number; shield: number; armor: number; hull: number; warpState: string; cannonActive: boolean; boosterActive: boolean; miningActive: boolean; miningTimer: number};
type Pirate = {isAlive: boolean; shield: number; armor: number; hull: number; speed: number};
const player = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Player);
const pirate = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate() as Pirate);

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, navigation: 0, cargoTrim: 0, ...s}});
const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});
const PLAIN = ['miner_mk1', null, null, 'light_cannon'];
const BULK = ['miner_mk1', 'bulk_hold', null, 'light_cannon'];

// --- Top speed: hold thrust from a standstill and take the highest speed seen.
const SPEEDS = [
  {name: 'empty hold', fitted: PLAIN, ferrite: 0, trim: 0},
  {name: 'full hold (600)', fitted: PLAIN, ferrite: 600, trim: 0},
  {name: 'full hold (600), Cargo Trim V', fitted: PLAIN, ferrite: 600, trim: 5},
  {name: 'Bulk Hold, empty', fitted: BULK, ferrite: 0, trim: 0},
  {name: 'Bulk Hold, full (1500)', fitted: BULK, ferrite: 1500, trim: 0},
  {name: 'Bulk Hold, full (1500), Cargo Trim V', fitted: BULK, ferrite: 1500, trim: 5},
];
for (const c of SPEEDS) {
  test(`speed: ${c.name}`, async ({page}) => {
    test.setTimeout(120_000);
    await openWithSave(page, {...BASE, ...skills({cargoTrim: c.trim}), ...fitting(c.fitted), cargoFerrite: c.ferrite});
    await enterGame(page);
    await undock(page);
    await page.waitForTimeout(1500);
    await page.keyboard.down('ArrowUp');
    let top = 0;
    const samples: number[] = [];
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(250);
      const s = (await player(page)).speed;
      samples.push(Math.round(s));
      top = Math.max(top, s);
    }
    await page.keyboard.up('ArrowUp');
    // Seconds to reach 95% of the top speed: how hard the ship accelerates.
    const t95 = samples.findIndex((s) => s >= 0.95 * top) * 0.25 + 0.25;
    record({probe: 'speed', case: c.name, topSpeed: Math.round(top), secTo95pct: t95});
  });
}

// --- Warp spool: seconds from the warp order until the ship is in warp.
for (const trim of [0, 5]) {
  test(`warp spool: full Bulk Hold, Cargo Trim ${trim}`, async ({page}) => {
    test.setTimeout(120_000);
    await openWithSave(page, {...BASE, ...skills({cargoTrim: trim}), ...fitting(BULK), cargoFerrite: 1500});
    await enterGame(page);
    await undock(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const w = ((window as any).__probeWarp = {aligning: 0, warping: 0});
      const tick = () => {
        const s = (window as any).__DEEP_BELT_PROBE__.player().warpState;
        if (s === 'ALIGNING' && !w.aligning) w.aligning = performance.now();
        if (s === 'WARPING' && !w.warping) w.warping = performance.now();
        if (!w.warping) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await warpTo(page, 'Belt Two');
    await expect.poll(() => page.evaluate(() => (window as any).__probeWarp.warping), {timeout: 30_000}).toBeGreaterThan(0);
    const w = await page.evaluate(() => (window as any).__probeWarp as {aligning: number; warping: number});
    record({probe: 'warp spool', case: `full Bulk Hold, Cargo Trim ${trim}`, spoolSec: Math.round((w.warping - w.aligning) / 100) / 10});
  });
}

// --- The Belt Two pirate fight in a Ferrier, at Gunnery III unless named.
const FIGHTS: Array<{name: string; weapon: string; cc: number; booster: boolean; gunnery?: number}> = [
  {name: 'Light Cannon, Gunnery II', weapon: 'light_cannon', cc: 0, booster: false, gunnery: 2},
  {name: 'Lance Driver, Gunnery II', weapon: 'lance_driver', cc: 0, booster: false, gunnery: 2},
  {name: 'Light Cannon', weapon: 'light_cannon', cc: 0, booster: false},
  {name: 'Lance Driver', weapon: 'lance_driver', cc: 0, booster: false},
  {name: 'Light Cannon + booster', weapon: 'light_cannon', cc: 0, booster: true},
  {name: 'Lance Driver + booster', weapon: 'lance_driver', cc: 0, booster: true},
  {name: 'Lance Driver + booster, Charge Control V', weapon: 'lance_driver', cc: 5, booster: true},
  {name: 'Light Cannon, Charge Control V', weapon: 'light_cannon', cc: 5, booster: false},
  {name: 'Lance Driver, Charge Control V', weapon: 'lance_driver', cc: 5, booster: false},
  {name: 'Light Cannon + booster, Charge Control V', weapon: 'light_cannon', cc: 5, booster: true},
];
for (const f of FIGHTS) {
  test(`fight: ${f.name}`, async ({page}) => {
    test.setTimeout(240_000);
    const fitted = ['miner_mk1', f.booster ? 'shield_booster' : null, null, f.weapon];
    await openWithSave(page, {...BASE, ...skills({gunnery: f.gunnery ?? 3, chargeControl: f.cc}), ...fitting(fitted)});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt Two');
    await page.getByText('Ships', {exact: true}).click();
    await page.getByText('Pirate Frigate', {exact: true}).first().click();
    await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
    await page.keyboard.press('l');
    await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
    await page.keyboard.press('2');
    if (f.booster) await page.keyboard.press('3');
    const start = Date.now();
    let minCap = Infinity;
    let lowCapSec = 0;
    let pirateTop = 0;
    let p = await player(page);
    const startHp = p.shield + p.armor + p.hull;
    let q = await pirate(page);
    while (q.isAlive && Date.now() - start < 150_000 && p.hull > 0) {
      await page.waitForTimeout(250);
      p = await player(page);
      q = await pirate(page);
      minCap = Math.min(minCap, p.capacitor);
      if (p.capacitor < 8) lowCapSec += 0.25;
      pirateTop = Math.max(pirateTop, q.speed);
    }
    record({
      probe: 'fight',
      case: f.name,
      pirateKilled: !q.isAlive,
      killSec: Math.round((Date.now() - start) / 100) / 10,
      hpLost: Math.round(startHp - (p.shield + p.armor + p.hull)),
      minCap: Math.round(minCap),
      secBelow8Cap: lowCapSec,
      boosterStillOn: p.boosterActive,
      pirateTopSpeed: Math.round(pirateTop),
    });
  });
}

// --- Mining cycle: seconds per laser cycle in flight, from the probe's mining timer.
for (const lt of [0, 5]) {
  test(`mining cycle: Miner MK1, Laser Tuning ${lt}`, async ({page}) => {
    test.setTimeout(120_000);
    await openWithSave(page, {...BASE, ...skills({mining: 3, laserTuning: lt})});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt One');
    await selectTarget(page, /Asteroid/);
    await page.keyboard.press('l');
    await expect.poll(() => targetPanel(page), {timeout: 30_000}).toMatch(/Locked/);
    await tuneLaser(page);
    // The timer counts up through a cycle and drops back at its end; keep each peak.
    await page.evaluate(() => {
      const w = ((window as any).__probeMine = {peaks: [] as number[], last: 0});
      const tick = () => {
        const t = (window as any).__DEEP_BELT_PROBE__.player().miningTimer as number;
        if (t < w.last - 1) w.peaks.push(w.last);
        w.last = t;
        if (w.peaks.length < 2) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.keyboard.press('1');
    await expect.poll(() => page.evaluate(() => (window as any).__probeMine.peaks.length), {timeout: 40_000}).toBeGreaterThanOrEqual(1);
    const peaks = await page.evaluate(() => (window as any).__probeMine.peaks as number[]);
    record({probe: 'mining cycle', case: `Miner MK1, Laser Tuning ${lt}`, cycleSec: Math.round(peaks[0] * 10) / 10});
  });
}
