import {appendFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {enterGame, flyTo, mineUntil, openWithSave, readSave, RICH, SAVE_KEY, selectTarget, settle, targetPanel, tuneLaser, undock, warpTo} from './helpers';

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

type Player = {speed: number; capacitor: number; maxCapacitor: number; shield: number; armor: number; hull: number; warpState: string; cannonActive: boolean; boosterActive: boolean; miningActive: boolean; miningTimer: number; x: number; y: number; heading: number; notice: number; docked: boolean};
type Pirate = {isAlive: boolean; shield: number; armor: number; hull: number; speed: number; x: number; y: number};
const player = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Player);
const pirate = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.pirate() as Pirate);

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const skills = (s: Record<string, number>) => ({skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 0, commandPiloting: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis: 0, ...s}});
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
const FIGHTS: Array<{name: string; weapon: string; cc: number; booster: boolean; gunnery?: number; armor?: boolean; so?: number; be?: number}> = [
  {name: 'Light Cannon, Gunnery II', weapon: 'light_cannon', cc: 0, booster: false, gunnery: 2},
  {name: 'Lance Driver, Gunnery II', weapon: 'lance_driver', cc: 0, booster: false, gunnery: 2},
  {name: 'Light Cannon', weapon: 'light_cannon', cc: 0, booster: false},
  {name: 'Light Cannon, Gunnery IV', weapon: 'light_cannon', cc: 0, booster: false, gunnery: 4},
  {name: 'Lance Driver, Gunnery IV', weapon: 'lance_driver', cc: 0, booster: false, gunnery: 4},
  {name: 'Light Cannon, Gunnery V', weapon: 'light_cannon', cc: 0, booster: false, gunnery: 5},
  {name: 'Lance Driver, Gunnery V', weapon: 'lance_driver', cc: 0, booster: false, gunnery: 5},
  {name: 'Lance Driver', weapon: 'lance_driver', cc: 0, booster: false},
  {name: 'Light Cannon + booster', weapon: 'light_cannon', cc: 0, booster: true},
  {name: 'Lance Driver + booster', weapon: 'lance_driver', cc: 0, booster: true},
  {name: 'Lance Driver + booster, Charge Control V', weapon: 'lance_driver', cc: 5, booster: true},
  {name: 'Light Cannon, Charge Control V', weapon: 'light_cannon', cc: 5, booster: false},
  {name: 'Lance Driver, Charge Control V', weapon: 'lance_driver', cc: 5, booster: false},
  {name: 'Light Cannon + booster, Charge Control V', weapon: 'light_cannon', cc: 5, booster: true},
  // Step 12: Composite Armor in the booster's slot.
  {name: 'Light Cannon + armor', weapon: 'light_cannon', cc: 0, booster: false, armor: true},
  {name: 'Lance Driver + armor', weapon: 'lance_driver', cc: 0, booster: false, armor: true},
  {name: 'Lance Driver + armor, Charge Control V', weapon: 'lance_driver', cc: 5, booster: false, armor: true},
  // Step 13: Booster Efficiency needs Shield Operation II, so both sides have it.
  {name: 'Lance Driver + booster, Shield Operation II', weapon: 'lance_driver', cc: 0, booster: true, so: 2},
  {name: 'Lance Driver + booster, Shield Operation II, Booster Efficiency V', weapon: 'lance_driver', cc: 0, booster: true, so: 2, be: 5},
  {name: 'Lance Driver + booster, Shield Operation II, Booster Efficiency V, Charge Control V', weapon: 'lance_driver', cc: 5, booster: true, so: 2, be: 5},
];
for (const f of FIGHTS) {
  test(`fight: ${f.name}`, async ({page}) => {
    test.setTimeout(240_000);
    const fitted = ['miner_mk1', f.booster ? 'shield_booster' : f.armor ? 'composite_armor' : null, null, f.weapon];
    await openWithSave(page, {...BASE, ...skills({gunnery: f.gunnery ?? 3, chargeControl: f.cc, shieldOp: f.so ?? 0, boosterEfficiency: f.be ?? 0}), ...fitting(fitted)});
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

// --- Holding out: park at Belt Two without firing and time how long the pirate
// takes to destroy the ship; then read the armor after the tow home (step 12).
// A "managed" booster is turned on only once the shield is below half, and on
// again whenever it has shut off there and the Cap covers a cycle (25), as a
// player would: above half, a cycle would stop at full shield.
const BOOST_CAP = 25;
const HOLDOUTS: Array<{name: string; fitted: Array<string | null>; booster: boolean; so?: number; be?: number; managed?: boolean}> = [
  {name: 'nothing in the utility slots', fitted: PLAIN, booster: false},
  {name: 'Shield Booster, active', fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], booster: true},
  {name: 'Composite Armor', fitted: ['miner_mk1', 'composite_armor', null, 'light_cannon'], booster: false},
  // Step 13.
  {name: 'Shield Booster, active, Shield Operation II', fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], booster: true, so: 2},
  {name: 'Shield Booster, active, Shield Operation II, Booster Efficiency V', fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], booster: true, so: 2, be: 5},
  // Step 33: Shield Booster II needs Shield Operation V, so both sides have it.
  {name: 'Shield Booster, active, Shield Operation V', fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], booster: true, so: 5},
  {name: 'Shield Booster II, active, Shield Operation V', fitted: ['miner_mk1', 'shield_booster_ii', null, 'light_cannon'], booster: true, so: 5},
  {name: 'Shield Booster, managed, Shield Operation V', fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], booster: false, so: 5, managed: true},
  {name: 'Shield Booster II, managed, Shield Operation V', fitted: ['miner_mk1', 'shield_booster_ii', null, 'light_cannon'], booster: false, so: 5, managed: true},
];
for (const c of HOLDOUTS) {
  test(`holdout: Belt Two pirate, ${c.name}`, async ({page}) => {
    test.setTimeout(300_000);
    await openWithSave(page, {...BASE, ...skills({gunnery: 3, shieldOp: c.so ?? 0, boosterEfficiency: c.be ?? 0}), ...fitting(c.fitted), marks: 50_000});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt Two');
    if (c.booster) await page.keyboard.press('3');
    const start = Date.now();
    let firstHit: number | null = null;
    let p = await player(page);
    const startHp = p.shield + p.armor + p.hull;
    let minCap = Infinity;
    let presses = 0;
    let lastPress = 0;
    const startShield = p.shield;
    while (Date.now() - start < 240_000) {
      await page.waitForTimeout(250);
      if (await page.getByText('Docked · safe').isVisible()) break;
      p = await player(page);
      minCap = Math.min(minCap, p.capacitor);
      if (firstHit === null && p.shield + p.armor + p.hull < startHp) firstHit = Date.now();
      if (c.managed && !p.boosterActive && p.shield < startShield / 2 && p.capacitor >= BOOST_CAP && Date.now() - lastPress > 1000) {
        await page.keyboard.press('3');
        presses++;
        lastPress = Date.now();
      }
    }
    const destroyed = await page.getByText('Docked · safe').isVisible();
    await page.waitForTimeout(1000);
    const after = await player(page);
    const armorText = (await page.innerText('body')).match(/Armor Integrity:\s*(\d+)\s*\/\s*(\d+)/);
    record({
      probe: 'holdout',
      case: c.name,
      startHp: Math.round(startHp),
      destroyed,
      secFromFirstHitToTow: firstHit && destroyed ? Math.round((Date.now() - firstHit) / 100) / 10 : null,
      minCap: Math.round(minCap),
      ...(c.managed ? {boosterPresses: presses, hpAtEnd: destroyed ? 0 : Math.round(p.shield + p.armor + p.hull), secRun: Math.round((Date.now() - start) / 1000)} : {}),
      armorAfterTow: Math.round(after.armor),
      repairScreenArmor: armorText ? `${armorText[1]}/${armorText[2]}` : null,
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

// --- Fleeing the Belt Two pirate: provoke it, then fly straight out of Belt Two.
// It gives up once the player is 20 km (1,000 px) from the belt's centre, so the
// cost of running is the HP lost on the way out.
const FLEES = [
  {name: 'empty hold', fitted: PLAIN, ferrite: 0},
  {name: 'full hold (600)', fitted: PLAIN, ferrite: 600},
  {name: 'Bulk Hold, empty', fitted: BULK, ferrite: 0},
  {name: 'Bulk Hold, full (1500)', fitted: BULK, ferrite: 1500},
];
for (const c of FLEES) {
  test(`flee: ${c.name}`, async ({page}) => {
    test.setTimeout(240_000);
    await openWithSave(page, {...BASE, ...skills({}), ...fitting(c.fitted), cargoFerrite: c.ferrite});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt Two');
    await page.getByText('Ships', {exact: true}).click();
    await page.getByText('Pirate Frigate', {exact: true}).first().click();
    await page.keyboard.press('l');
    const BELT = {x: -1500, y: 1100};
    const gapKm = (p: Player & {x: number; y: number}, q: Pirate & {x: number; y: number}) => Math.hypot(p.x - q.x, p.y - q.y) / 50;
    // Wait until the pirate has closed to its 5 km standoff.
    await expect.poll(async () => gapKm(await player(page) as any, await pirate(page) as any), {timeout: 60_000}).toBeLessThan(6);
    let p: any = await player(page);
    const startHp = p.shield + p.armor + p.hull;
    const start = Date.now();
    let held: string | null = null;
    const hold = async (key: string | null) => {
      if (held === key) return;
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    };
    await page.keyboard.down('ArrowUp');
    let maxGap = 0;
    let inRangeSec = 0;
    let last = Date.now();
    while (Date.now() - start < 90_000) {
      p = await player(page);
      const q: any = await pirate(page);
      const fromBelt = Math.hypot(p.x - BELT.x, p.y - BELT.y);
      if (fromBelt > 1050 || p.hull <= 0) break;
      const want = Math.atan2(p.y - BELT.y, p.x - BELT.x);
      const diff = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading));
      await hold(Math.abs(diff) < 0.1 ? null : diff > 0 ? 'ArrowRight' : 'ArrowLeft');
      const gap = gapKm(p, q);
      maxGap = Math.max(maxGap, gap);
      const now = Date.now();
      if (gap <= 8) inRangeSec += (now - last) / 1000;
      last = now;
      await page.waitForTimeout(100);
    }
    await hold(null);
    await page.keyboard.up('ArrowUp');
    record({
      probe: 'flee',
      case: c.name,
      outSec: Math.round((Date.now() - start) / 100) / 10,
      hpLost: Math.round(startHp - (p.shield + p.armor + p.hull)),
      secInPirateRange: Math.round(inRangeSec * 10) / 10,
      maxGapKm: Math.round(maxGap * 10) / 10,
    });
  });
}

// --- Outrunning a raider wave: sell ore to bring one, then thrust straight away
// from it. Raiders keep chasing anywhere in the system and fire inside 8 km.
// Tritanium is not on the first market card, so the sale keeps it in the hold.
for (const c of [{name: 'empty hold', tritanium: 0}, {name: 'full hold (600 Tritanium)', tritanium: 600}]) {
  test(`raiders: outrun, ${c.name}`, async ({page}) => {
    test.setTimeout(240_000);
    await openWithSave(page, {...BASE, ...skills({}), ...fitting(PLAIN), cargoFerrite: 240, cargoTritanium: c.tritanium});
    await enterGame(page);
    await page.keyboard.press('1');
    await settle(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
    await page.keyboard.press('Escape');
    await undock(page);
    await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
    type R = {x: number; y: number; speed: number};
    const raiders = () => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.raiders() as R[]);
    let p: any = await player(page);
    const startHp = p.shield + p.armor + p.hull;
    let held: string | null = null;
    const hold = async (key: string | null) => {
      if (held === key) return;
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    };
    await page.keyboard.down('ArrowUp');
    const start = Date.now();
    let last = start;
    let inRangeSec = 0;
    let firstClearSec: number | null = null;
    let gap = 0;
    let raiderTop = 0;
    let playerTop = 0;
    while (Date.now() - start < 45_000) {
      p = await player(page);
      const rs = await raiders();
      if (!rs.length || p.hull <= 0) break;
      const cx = rs.reduce((s, r) => s + r.x, 0) / rs.length;
      const cy = rs.reduce((s, r) => s + r.y, 0) / rs.length;
      gap = Math.min(...rs.map((r) => Math.hypot(p.x - r.x, p.y - r.y) / 50));
      raiderTop = Math.max(raiderTop, ...rs.map((r) => r.speed));
      playerTop = Math.max(playerTop, p.speed);
      const now = Date.now();
      if (gap <= 8) inRangeSec += (now - last) / 1000;
      else if (firstClearSec === null) firstClearSec = Math.round((now - start) / 100) / 10;
      last = now;
      const want = Math.atan2(p.y - cy, p.x - cx);
      const diff = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading));
      await hold(Math.abs(diff) < 0.1 ? null : diff > 0 ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForTimeout(100);
    }
    await hold(null);
    await page.keyboard.up('ArrowUp');
    record({
      probe: 'raiders',
      case: `outrun, ${c.name}`,
      hpLost: Math.round(startHp - (p.shield + p.armor + p.hull)),
      secInRaiderRange: Math.round(inRangeSec * 10) / 10,
      firstOutOfRangeSec: firstClearSec,
      gapAfter45sKm: Math.round(gap * 10) / 10,
      raiderTopSpeed: Math.round(raiderTop),
      playerTopSpeed: Math.round(playerTop),
    });
  });
}

// --- Warping away from a raider wave: wait until a raider is in firing range
// (8 km), warp to Belt One, and record the HP lost during the spool and in the
// 20 s after dropping out, and how close the raiders still are by then.
const WARP_ESCAPES = [
  {name: 'full hold (600 Tritanium), no skills', nav: 0, trim: 0},
  {name: 'full hold (600 Tritanium), Navigation V, Cargo Trim V', nav: 5, trim: 5},
];
for (const c of WARP_ESCAPES) {
  test(`raiders: warp away, ${c.name}`, async ({page}) => {
    test.setTimeout(240_000);
    await openWithSave(page, {...BASE, ...skills({navigation: c.nav, cargoTrim: c.trim}), ...fitting(PLAIN), cargoFerrite: 240, cargoTritanium: 600});
    await enterGame(page);
    await page.keyboard.press('1');
    await settle(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
    await page.keyboard.press('Escape');
    await undock(page);
    await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
    type R = {x: number; y: number; speed: number};
    const raiders = () => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.raiders() as R[]);
    const hp = (q: any) => q.shield + q.armor + q.hull;
    const nearestKm = (q: any, rs: R[]) => (rs.length ? Math.min(...rs.map((r) => Math.hypot(q.x - r.x, q.y - r.y) / 50)) : null);
    let p: any = await player(page);
    const startHp = hp(p);
    // Wait for the first raider inside 8 km.
    const waitStart = Date.now();
    while (Date.now() - waitStart < 60_000) {
      p = await player(page);
      const near = nearestKm(p, await raiders());
      if (near !== null && near <= 8) break;
      await page.waitForTimeout(100);
    }
    const hpAtRange = hp(p);
    const warpStart = Date.now();
    await warpTo(page, 'Belt One');
    // Spool ends when the warp leaves ALIGNING.
    let spoolSec = 0;
    while (Date.now() - warpStart < 30_000) {
      p = await player(page);
      if (p.warpState !== 'ALIGNING') {
        spoolSec = (Date.now() - warpStart) / 1000;
        break;
      }
      await page.waitForTimeout(50);
    }
    const hpAfterSpool = hp(p);
    await expect(page.getByText('Dropped out of warp at Belt One.').first()).toBeVisible({timeout: 60_000});
    const hpOnArrival = hp(await player(page));
    await page.waitForTimeout(20_000);
    p = await player(page);
    const after = await raiders();
    record({
      probe: 'raiders',
      case: `warp away, ${c.name}`,
      raidersLeft: after.length,
      hpLostBeforeRange: Math.round(startHp - hpAtRange),
      spoolSecWallClock: Math.round(spoolSec * 10) / 10,
      hpLostDuringSpool: Math.round(hpAtRange - hpAfterSpool),
      hpLostInWarp: Math.round(hpAfterSpool - hpOnArrival),
      hpLost20sAfterArrival: Math.round(hpOnArrival - hp(p)),
      nearestRaiderKm20sAfter: (() => { const n = nearestKm(p, after); return n === null ? null : Math.round(n * 10) / 10; })(),
    });
  });
}

// --- Fighting a raider wave: sell ore to bring one, then lock each raider from
// the Overview and fire until both are dead. Gunnery III. Records the fight's
// length, the HP it cost and the lowest Cap. Step 16 adds the Fire Control Relay.
const WAVES: Array<{name: string; weapon: string; cc: number; relay: boolean}> = [
  {name: 'Light Cannon', weapon: 'light_cannon', cc: 0, relay: false},
  {name: 'Light Cannon + Fire Control Relay', weapon: 'light_cannon', cc: 0, relay: true},
  {name: 'Light Cannon, Charge Control V', weapon: 'light_cannon', cc: 5, relay: false},
  {name: 'Light Cannon + Fire Control Relay, Charge Control V', weapon: 'light_cannon', cc: 5, relay: true},
  {name: 'Lance Driver', weapon: 'lance_driver', cc: 0, relay: false},
  {name: 'Lance Driver + Fire Control Relay', weapon: 'lance_driver', cc: 0, relay: true},
];
for (const c of WAVES) {
  test(`raiders: fight, ${c.name}`, async ({page}) => {
    test.setTimeout(240_000);
    const fitted = ['miner_mk1', c.relay ? 'fire_control' : null, null, c.weapon];
    await openWithSave(page, {...BASE, ...skills({mining: 2, gunnery: 3, chargeControl: c.cc}), ...fitting(fitted), cargoFerrite: 600});
    await enterGame(page);
    await page.keyboard.press('1');
    await settle(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
    await page.keyboard.press('Escape');
    await undock(page);
    const alive = () => page.evaluate(() => ((window as any).__DEEP_BELT_PROBE__.raiders() as unknown[]).length);
    await expect.poll(alive, {timeout: 20_000}).toBe(2);
    const p0 = await player(page);
    const start = Date.now();
    let minCap = Infinity;
    let p = p0;
    while (Date.now() - start < 180_000 && (await alive()) > 0 && p.hull > 0) {
      if (!/Raider[\s\S]*Locked|Locked[\s\S]*Raider/.test(await targetPanel(page))) {
        const row = page.getByText(/^Raider \d+$/).first();
        if (!(await row.isVisible())) await page.getByText('Ships', {exact: true}).click();
        if (await row.isVisible()) {
          await row.click();
          await page.keyboard.press('l');
          await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/).catch(() => {});
        }
      }
      // Fire is a toggle: press it only while the weapon is off.
      if (!(await player(page)).cannonActive) await page.keyboard.press('2');
      await page.waitForTimeout(250);
      p = await player(page);
      minCap = Math.min(minCap, p.capacitor);
    }
    record({
      probe: 'raiders',
      case: `fight, ${c.name}`,
      raidersLeft: await alive(),
      fightSec: Math.round((Date.now() - start) / 1000),
      hpLost: Math.round(p0.shield + p0.armor + p0.hull - (p.shield + p.armor + p.hull)),
      // Armor and hull don't regenerate: the station repairs them for 3 and 4 MARKS an HP.
      armorLost: Math.round(p0.armor - p.armor),
      hullLost: Math.round(p0.hull - p.hull),
      repairMarks: Math.round((p0.armor - p.armor) * 3 + (p0.hull - p.hull) * 4),
      minCap: Math.round(minCap),
    });
  });
}

// --- The Vael Heavy Pirate Frigate (200 shield, 200 armor, 200 hull), past the
// jump gate, in a Ferrier or a Skirmisher at Gunnery III. Locks it from the Overview and fires
// until it or the Ferrier is dead.
const VAEL_FIGHTS: Array<{name: string; weapon: string; second: string | null; cc?: number; hull?: string; al?: number; so?: number; managed?: boolean}> = [
  {name: 'Light Cannon', weapon: 'light_cannon', second: null},
  {name: 'Lance Driver', weapon: 'lance_driver', second: null},
  {name: 'Lance Driver + booster', weapon: 'lance_driver', second: 'shield_booster'},
  {name: 'Lance Driver + armor', weapon: 'lance_driver', second: 'composite_armor'},
  {name: 'Lance Driver + Fire Control Relay', weapon: 'lance_driver', second: 'fire_control'},
  {name: 'Lance Driver + Fire Control Relay, Charge Control V', weapon: 'lance_driver', second: 'fire_control', cc: 5},
  {name: 'Skirmisher, Light Cannon', weapon: 'light_cannon', second: null, hull: 'skirmisher'},
  {name: 'Skirmisher, Lance Driver', weapon: 'lance_driver', second: null, hull: 'skirmisher'},
  {name: 'Skirmisher, Lance Driver + armor', weapon: 'lance_driver', second: 'composite_armor', hull: 'skirmisher'},
  {name: 'Lance Driver, Armor Layering V', weapon: 'lance_driver', second: null, al: 5},
  {name: 'Lance Driver + booster, Armor Layering V', weapon: 'lance_driver', second: 'shield_booster', al: 5},
  {name: 'Lance Driver + armor, Armor Layering V', weapon: 'lance_driver', second: 'composite_armor', al: 5},
  // Step 33: Shield Booster II needs Shield Operation V, so both sides have it.
  {name: 'Lance Driver + booster, Shield Operation V', weapon: 'lance_driver', second: 'shield_booster', so: 5},
  {name: 'Lance Driver + Shield Booster II, Shield Operation V', weapon: 'lance_driver', second: 'shield_booster_ii', so: 5},
  {name: 'Lance Driver + booster, managed, Shield Operation V', weapon: 'lance_driver', second: 'shield_booster', so: 5, managed: true},
  {name: 'Lance Driver + Shield Booster II, managed, Shield Operation V', weapon: 'lance_driver', second: 'shield_booster_ii', so: 5, managed: true},
];
type Vael = {isAlive: boolean; shield: number; armor: number; hull: number; speed: number};
for (const c of VAEL_FIGHTS) {
  test(`vael fight: ${c.name}`, async ({page}) => {
    test.setTimeout(300_000);
    await openWithSave(page, {...BASE, ...skills({gunnery: 3, chargeControl: c.cc ?? 0, armorLayering: c.al ?? 0, shieldOp: c.so ?? (c.second === 'shield_booster' ? 1 : 0)}), ...fitting(['miner_mk1', c.second, null, c.weapon]), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, ...(c.hull ? {ownedHulls: ['ferrier', c.hull], activeHull: c.hull} : {})});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Harrow Outer Jump Gate');
    await expect(async () => {
      await page.keyboard.press('j');
      await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
    }).toPass({timeout: 60_000});
    await flyTo(page, 'Vael Belt');
    const vael = () => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.vaelPirate() as Vael);
    await page.getByText('Ships', {exact: true}).click();
    await page.getByText('Heavy Pirate Frigate', {exact: true}).first().click();
    await expect.poll(() => targetPanel(page)).toMatch(/Heavy Pirate Frigate/);
    await page.keyboard.press('l');
    await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
    await page.keyboard.press('2');
    if (!c.managed && (c.second === 'shield_booster' || c.second === 'shield_booster_ii')) await page.keyboard.press('3');
    const start = Date.now();
    let p = await player(page);
    const startHp = {shield: p.shield, armor: p.armor, hull: p.hull};
    let q = await vael();
    let minHull = p.hull;
    let presses = 0;
    let lastPress = 0;
    // A lost ship is towed to the station and repaired, so docked marks the loss.
    while (q.isAlive && !p.docked && Date.now() - start < 240_000) {
      await page.waitForTimeout(250);
      p = await player(page);
      q = await vael();
      if (!p.docked) minHull = Math.min(minHull, p.hull);
      if (c.managed && !p.docked && !p.boosterActive && p.shield < startHp.shield / 2 && p.capacitor >= BOOST_CAP && Date.now() - lastPress > 1000) {
        await page.keyboard.press('3');
        presses++;
        lastPress = Date.now();
      }
    }
    record({
      probe: 'vael fight',
      case: c.name,
      pirateKilled: !q.isAlive,
      shipLost: p.docked,
      fightSec: Math.round((Date.now() - start) / 100) / 10,
      pirateHpLeft: q.isAlive ? Math.round(q.shield + q.armor + q.hull) : 0,
      ...(c.managed ? {boosterPresses: presses} : {}),
      ...(p.docked ? {} : {
        hpLost: Math.round(startHp.shield + startHp.armor + startHp.hull - (p.shield + p.armor + p.hull)),
        armorLost: Math.round(startHp.armor - p.armor),
        hullLost: Math.round(startHp.hull - p.hull),
      }),
      minHull: Math.round(minHull),
    });
  });
}

// --- Notice from a sale: sell a full Ferrier hold of Ferrite, read Notice, then
// undock and see whether a raider wave comes within 20 s.
for (const lp of [0, 5]) {
  test(`notice: sell 600 Ferrite at Low Profile ${lp}`, async ({page}) => {
    test.setTimeout(120_000);
    await openWithSave(page, {...BASE, ...skills({mining: 2, lowProfile: lp}), ...fitting(PLAIN), cargoFerrite: 600});
    await enterGame(page);
    await page.keyboard.press('1');
    await settle(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readSave(page))!.inventory?.ferrite).toBe(0);
    const noticeAfterSale = Math.round((await player(page)).notice);
    await page.keyboard.press('Escape');
    await undock(page);
    const raid = await page.getByText(/Raider wave inbound/).first().waitFor({timeout: 20_000}).then(() => true, () => false);
    record({probe: 'notice', case: `sale of 600 Ferrite, Low Profile ${lp}`, noticeAfterSale, raidWithin20s: raid});
  });
}

// --- Notice from mining: Notice gained per second while the laser runs, over 40 s at Belt One.
for (const lp of [0, 5]) {
  test(`notice: mining at Low Profile ${lp}`, async ({page}) => {
    test.setTimeout(240_000);
    await openWithSave(page, {...BASE, ...skills({mining: 2, lowProfile: lp}), ...fitting(['miner_mk1', 'bulk_hold', null, 'light_cannon'])});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt One');
    await page.evaluate(() => {
      const w = window as unknown as {__on: number; __rise: number; __last: {t: number; n: number; on: boolean} | null; __DEEP_BELT_PROBE__: any};
      w.__on = 0;
      w.__rise = 0;
      w.__last = null;
      setInterval(() => {
        const q = w.__DEEP_BELT_PROBE__.player();
        const now = {t: performance.now(), n: q.notice, on: q.miningActive};
        // Count only spans where the laser ran at both ends and Notice was below its cap.
        if (w.__last && w.__last.on && now.on && now.n < 100) {
          w.__on += (now.t - w.__last.t) / 1000;
          w.__rise += now.n - w.__last.n;
        }
        w.__last = now;
      }, 250);
    });
    const t = Date.now();
    await mineUntil(page, async () => Date.now() - t > 40_000, 200_000);
    const m = await page.evaluate(() => {
      const w = window as unknown as {__on: number; __rise: number};
      return {on: w.__on, rise: w.__rise};
    });
    record({probe: 'notice', case: `mining, Low Profile ${lp}`, laserOnSec: Math.round(m.on * 10) / 10, noticePerSec: Math.round((m.rise / m.on) * 100) / 100});
  });
}

// --- Mining pace: ore per minute at Belt One, no lens, a Bulk Hold so the hold never fills.
// The game's own clock times each yield (sampled every 250 ms in the page), so the count
// runs from the first yield to the last: whole cycles only, rocks running dry included.
const PACES = [
  {name: 'Miner MK1, no skills', miner: 'miner_mk1', mining: 0, lt: 0},
  {name: 'Miner MK2, no skills', miner: 'miner_mk2', mining: 0, lt: 0},
  {name: 'Miner MK2, Mining V, Laser Tuning V', miner: 'miner_mk2', mining: 5, lt: 5},
];
for (const c of PACES) {
  test(`mining pace: ${c.name}`, async ({page}) => {
    test.setTimeout(300_000);
    await openWithSave(page, {...BASE, ...skills({mining: c.mining, laserTuning: c.lt}), ...fitting([c.miner, 'bulk_hold', null, 'light_cannon'])});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt One');
    await page.evaluate(() => {
      const w = window as unknown as {__yields: Array<[number, number]>};
      w.__yields = [];
      let last = 0;
      setInterval(() => {
        const m = document.body.innerText.match(/(\d+)\/\d+m³/);
        const held = m ? Number(m[1]) : last;
        if (held !== last) w.__yields.push([performance.now(), held - last]);
        last = held;
      }, 250);
    });
    const t = Date.now();
    await mineUntil(page, async () => Date.now() - t > 90_000, 240_000);
    const yields = await page.evaluate(() => (window as unknown as {__yields: Array<[number, number]>}).__yields);
    const sec = (yields[yields.length - 1][0] - yields[0][0]) / 1000;
    const ore = yields.slice(1).reduce((a, [, d]) => a + d, 0);
    record({probe: 'mining pace', case: c.name, yields: yields.length, ore, sec: Math.round(sec * 10) / 10, orePerMin: Math.round((ore / sec) * 60), sizes: [...new Set(yields.map(([, d]) => d))]});
  });
}

// --- Selling trips: with a full Ferrier hold (600 m³) at a belt, seconds to warp to a
// station, dock, sell everything, undock and warp back, gate jumps included. Mining time
// per load comes from the cycle (MK1 50 per 10 s, MK2 75 per 8 s); this adds the trip.
// Low Profile V, so 600 Ferrite sells without a raider wave.
const TRIPS: Array<{name: string; belt: string; station: string; vael?: boolean; haul?: boolean; ore: string; qty: number}> = [
  {name: 'Belt One to Harrow Station, Ferrite', belt: 'Belt One', station: 'Harrow Station Alpha', ore: 'Ferrite', qty: 600},
  {name: 'Cinder Rift to Harrow Station, Prismite', belt: 'Cinder Rift', station: 'Harrow Station Alpha', ore: 'Prismite', qty: 75},
  {name: 'Vael Belt to Vael Station, Aurite', belt: 'Vael Belt', station: 'Vael Station', vael: true, ore: 'Aurite', qty: 600},
  {name: 'Vael Belt to Harrow Station by the gates, Aurite', belt: 'Vael Belt', station: 'Harrow Station Alpha', vael: true, haul: true, ore: 'Aurite', qty: 600},
];
async function jump(page: Page, to: string) {
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText(`${to} System ·`)).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
}
for (const c of TRIPS) {
  test(`selling trip: ${c.name}`, async ({page}) => {
    test.setTimeout(420_000);
    const key = c.ore.toLowerCase();
    await openWithSave(page, {...BASE, ...skills({lowProfile: 5}), ...fitting(PLAIN), missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, [`cargo${c.ore}`]: c.qty});
    await enterGame(page);
    await undock(page);
    if (c.vael) {
      await flyTo(page, 'Harrow Outer Jump Gate');
      await jump(page, 'Vael');
    }
    await flyTo(page, c.belt);
    const marks0 = (await readSave(page))!.marks;
    const t0 = Date.now();
    if (c.haul) {
      await flyTo(page, 'Gate (Harrow)');
      await jump(page, 'Harrow');
    }
    await flyTo(page, c.station);
    const tArrive = Date.now();
    await expect(async () => {
      await page.keyboard.press('f');
      await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 2000});
    }).toPass({timeout: 30_000});
    await settle(page);
    await page.keyboard.press('1');
    await settle(page);
    await page.keyboard.press('s');
    await expect.poll(async () => (await readSave(page))!.inventory?.[key], {timeout: 20_000}).toBe(0);
    const marks1 = (await readSave(page))!.marks;
    await undock(page);
    const tUndock = Date.now();
    if (c.haul) {
      await flyTo(page, 'Harrow Outer Jump Gate');
      await jump(page, 'Vael');
    }
    await flyTo(page, c.belt);
    const tBack = Date.now();
    record({
      probe: 'selling trip',
      case: c.name,
      sold: `${c.qty} ${c.ore}`,
      marks: marks1 - marks0,
      toStationSec: Math.round((tArrive - t0) / 100) / 10,
      dockSellUndockSec: Math.round((tUndock - tArrive) / 100) / 10,
      backSec: Math.round((tBack - tUndock) / 100) / 10,
      tripSec: Math.round((tBack - t0) / 100) / 10,
    });
  });
}
// --- Drone output: one extraction drone on a tuned Belt One asteroid. The save is
// written whenever Ferrite changes, so the times between rises are the drone's cycle.
for (const level of [0, 5]) {
  test(`drones: extraction cycle at Drone Operation ${level}`, async ({page}) => {
    test.setTimeout(180_000);
    await openWithSave(page, {...BASE, ...skills({droneOperation: level}), ...fitting(PLAIN), cargoExtractDrone: 1});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Belt One');
    await selectTarget(page, /Asteroid ·/);
    await tuneLaser(page);
    await page.keyboard.press('d');
    await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible();
    await expect(async () => {
      await page.keyboard.press('Enter');
      await expect(page.getByText('Bandwidth: 1 / 2')).toBeVisible({timeout: 2000});
    }).toPass({timeout: 20_000});
    await page.keyboard.press('Escape');
    const rises: {t: number; ferrite: number}[] = await page.evaluate(async (key) => {
      const out: {t: number; ferrite: number}[] = [];
      let last = 0;
      const start = performance.now();
      while (performance.now() - start < 50_000) {
        const f = JSON.parse(localStorage.getItem(key) || '{}').inventory?.ferrite ?? 0;
        if (f !== last) { out.push({t: Math.round(performance.now() - start), ferrite: f}); last = f; }
        await new Promise((r) => setTimeout(r, 50));
      }
      return out;
    }, SAVE_KEY);
    const gaps = rises.slice(1).map((r, i) => Math.round((r.t - rises[i].t) / 100) / 10);
    record({probe: 'drones', case: `extraction, Drone Operation ${level}`, rises, gaps, ferriteIn50s: rises.at(-1)?.ferrite ?? 0});
  });
}
