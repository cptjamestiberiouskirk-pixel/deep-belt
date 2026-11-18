import {appendFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {expect, test, type CDPSession, type Page} from '@playwright/test';
import {enterGame, flyTo, openWithSave, RICH, settle, undock} from './helpers';

// Performance probe. It plays the production build and records, for a few
// seconds in each state: frames a second and frame intervals (p50/p95/p99),
// long tasks (over 50 ms), and React commits a second. Commits are counted
// through a stub of React's devtools hook, installed before the page loads,
// which production React calls on every commit. It asserts nothing: it reports.
//
// Run:  PROBE=1 npx playwright test tests/perf-probe.spec.ts --workers=1
// Out:  one JSON line per state in test-results/perf-probe.jsonl (or PROBE_OUT).
// Run it with one worker: other workers share the CPU and skew the numbers.

test.skip(!process.env.PROBE, 'perf probe: run with PROBE=1');

const OUT = process.env.PROBE_OUT ?? 'test-results/perf-probe.jsonl';
function record(row: Record<string, unknown>) {
  mkdirSync(dirname(OUT), {recursive: true});
  appendFileSync(OUT, JSON.stringify(row) + '\n');
}

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SECONDS = 8;

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__perf = {commits: 0, frames: [] as number[], longTasks: [] as number[], on: false};
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot: () => { if (w.__perf.on) w.__perf.commits++; },
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      checkDCE: () => {},
    };
    try {
      new PerformanceObserver((list) => {
        if (w.__perf.on) for (const e of list.getEntries()) w.__perf.longTasks.push(e.duration);
      }).observe({type: 'longtask', buffered: false});
    } catch { /* no long task API */ }
    let last = 0;
    const tick = (t: number) => {
      if (w.__perf.on && last) w.__perf.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

type Metrics = Record<string, number>;
// One CDP session for the whole test: Performance.enable counts from when it is enabled.
let cdp: CDPSession;
async function cdpMetrics(): Promise<Metrics> {
  const {metrics} = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m: {name: string; value: number}) => [m.name, m.value]));
}

async function measure(page: Page, state: string) {
  const m0 = await cdpMetrics();
  await page.evaluate(() => { const p = (window as any).__perf; p.commits = 0; p.frames = []; p.longTasks = []; p.on = true; });
  await page.waitForTimeout(SECONDS * 1000);
  const m1 = await cdpMetrics();
  const busy = (k: string) => Math.round(((m1[k] - m0[k]) / SECONDS) * 1000);
  const r = await page.evaluate(() => { const p = (window as any).__perf; p.on = false; return {commits: p.commits, frames: p.frames as number[], longTasks: p.longTasks as number[]}; });
  const f = [...r.frames].sort((a, b) => a - b);
  const pct = (q: number) => Math.round(f[Math.min(f.length - 1, Math.floor(q * f.length))] * 10) / 10;
  record({
    probe: 'perf',
    state,
    fps: Math.round((r.frames.length / SECONDS) * 10) / 10,
    frameMsP50: pct(0.5),
    frameMsP95: pct(0.95),
    frameMsP99: pct(0.99),
    frameMsMax: Math.round(f[f.length - 1] * 10) / 10,
    longTasks: r.longTasks.length,
    longTaskMs: Math.round(r.longTasks.reduce((a, b) => a + b, 0)),
    commitsPerSec: Math.round((r.commits / SECONDS) * 10) / 10,
    // Main-thread milliseconds a second (of 1000): all tasks, script, layout, style.
    taskMsPerSec: busy('TaskDuration'),
    scriptMsPerSec: busy('ScriptDuration'),
    layoutMsPerSec: busy('LayoutDuration'),
    styleMsPerSec: busy('RecalcStyleDuration'),
  });
}

test('perf: docked, in space idle and thrusting, and at Belt One', async ({page}) => {
  test.setTimeout(240_000);
  await instrument(page);
  cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await openWithSave(page, {...BASE, fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await settle(page);
  await measure(page, 'docked at Harrow Station');
  await undock(page);
  await page.waitForTimeout(1500);
  await measure(page, 'in space, idle, near the station');
  await page.keyboard.down('ArrowUp');
  await measure(page, 'in space, thrusting');
  await page.keyboard.up('ArrowUp');
  await flyTo(page, 'Belt One');
  await measure(page, 'at Belt One, idle');
  record({probe: 'perf', note: `userAgent ${await page.evaluate(() => navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0])}`});
});

// React commits during a jump through the Harrow gate: from the press that
// starts it until 2 s after arrival in Vael (the flash takes 1.5 s).
test('perf: commits during a gate jump', async ({page}) => {
  test.setTimeout(240_000);
  await instrument(page);
  await openWithSave(page, {...BASE, hasGatePermit: true, fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await undock(page);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await page.evaluate(() => { const p = (window as any).__perf; p.commits = 0; p.frames = []; p.longTasks = []; p.on = true; });
  const t0 = Date.now();
  await expect(async () => {
    await page.keyboard.press('j');
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }).toPass({timeout: 60_000});
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => { const p = (window as any).__perf; p.on = false; return {commits: p.commits as number, frames: (p.frames as number[]).length}; });
  const sec = (Date.now() - t0) / 1000;
  record({probe: 'perf', state: 'gate jump, press to 2 s after arrival', seconds: Math.round(sec * 10) / 10, commits: r.commits, commitsPerSec: Math.round((r.commits / sec) * 10) / 10, fps: Math.round((r.frames / sec) * 10) / 10});
});
