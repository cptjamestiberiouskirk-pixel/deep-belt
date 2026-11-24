import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, flyTo, openWithSave, readSave, RICH, settle, undock, warpTo, watch} from './helpers';
import {SCAN_SUCCESS_COOLDOWN_SEC} from '../content/skills';

// Step 37a of design/content-tree.md (a fix): a successful probe scan starts a
// 60 s cooldown, as a failed one already did. Before, a ship parked at the Data
// Cache's fixed spot could scan, open it (+600 MARKS) and scan again every 3.7 s,
// about 9,700 MARKS a minute (tests/balance-probe.spec.ts "scan farm").

const BASE = {...RICH, milestoneIndustrialistClaimed: true, hasProbeLauncher: true, firstCacheOpened: true};
// Presses in the middle of each untrained band: every scan hits (Signal Analysis 0).
const HIT: Array<[number, number]> = [[1.15, 1.35], [3.08, 3.28], [5.09, 5.29]];

/** Presses once per ring at a sweep angle in [lo, hi], from inside the page (as tests/signal-analysis.spec.ts does). */
async function pressAt(page: Page, windows: Array<[number, number]>) {
  await page.evaluate((ws) => new Promise<void>((resolve) => {
    const pressed: number[] = [];
    const tick = () => {
      const [lo, hi] = ws[pressed.length];
      const a = ((window as any).__DEEP_BELT_SCAN__ as {angle: () => number}).angle();
      if (a >= lo && a <= hi) {
        window.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', bubbles: true}));
        pressed.push(a);
        if (pressed.length === ws.length) return resolve();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), windows);
}

/** Presses P; if the sweep opens, hits all three rings and returns true. False when the scanner is cooling down. */
async function tryScan(page: Page): Promise<boolean> {
  await settle(page);
  await page.keyboard.press('p');
  const sweep = page.getByText('Core Probe Sweep');
  try {
    await expect(sweep).toBeVisible({timeout: 700});
  } catch {
    return false;
  }
  await pressAt(page, HIT);
  await expect(page.getByText('Data Cache located. Warp [M].').first()).toBeVisible();
  return true;
}

async function openCache(page: Page, marksBefore: number) {
  await expect(async () => {
    await page.keyboard.press('e');
    await expect.poll(async () => (await readSave(page))!.marks, {timeout: 1500}).toBe(marksBefore + 600);
  }).toPass({timeout: 30_000});
}

/** The scan button's countdown, "Cool 59s", or -1 when it shows none. */
async function coolShown(page: Page): Promise<number> {
  const m = (await page.innerText('body')).match(/Cool (\d+)s/);
  return m ? Number(m[1]) : -1;
}

test('scanning: a successful scan cools the scanner down for 60 s, shown as "Cool", and a reload keeps it', async ({page}) => {
  test.setTimeout(120_000);
  expect(SCAN_SUCCESS_COOLDOWN_SEC).toBe(60);
  const problems = watch(page);
  await openWithSave(page, BASE);
  await enterGame(page);
  await undock(page);
  expect(await tryScan(page)).toBe(true);
  // Read once, right after the cache is found: the countdown rounds up, so it starts at 60.
  const shown = await coolShown(page);
  expect(shown).toBeGreaterThanOrEqual(59);
  expect(shown).toBeLessThanOrEqual(60);
  expect(await page.getByText(/Signal lost \d+s/).count()).toBe(0);
  // P does not open the sweep while it cools down.
  expect(await tryScan(page)).toBe(false);
  // The cooldown is in the save's existing scanCooldownRemainingMs, so a reload keeps it.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  // The save was written in space, so the game continues there, not docked.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('start-game-btn')).toBeHidden();
  expect(await tryScan(page)).toBe(false);
  // Written again after the load, so the loaded game holds it, not only the old save.
  await page.waitForTimeout(6000);
  const saved = (await readSave(page))!.scanCooldownRemainingMs as number;
  expect(saved).toBeGreaterThan(30_000);
  expect(saved).toBeLessThanOrEqual(50_000);
  expectClean(problems);
});

test('scan farm: parked at the Data Cache, at most one more cache in the 65 s after a find', async ({page}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  await openWithSave(page, BASE);
  await enterGame(page);
  await undock(page);
  expect(await tryScan(page)).toBe(true);
  const found = Date.now();
  await warpTo(page, 'Data Cache');
  await expect(page.getByText('Dropped out of warp at Data Cache.').first()).toBeVisible({timeout: 60_000});
  const marks0 = (await readSave(page))!.marks;
  await openCache(page, marks0);
  // Keep trying to scan and open, parked at the spot, until 65 s after the find.
  let more = 0;
  while (Date.now() - found < 65_000) {
    if (await tryScan(page)) {
      await openCache(page, (await readSave(page))!.marks);
      more++;
    } else {
      await page.waitForTimeout(1000);
    }
  }
  const gained = (await readSave(page))!.marks - marks0;
  // Before the fix a round took 3.7 s, so this window held about 15 more caches (about 9,700 MARKS a minute).
  // With the cooldown, the scanner is ready again 60 s after the find: exactly one more.
  expect(more, `${gained} MARKS in 65 s`).toBe(1);
  expect(gained).toBe(1200);
  expectClean(problems);
});

// In the Rift the same button fires the Rift Pulse, which has its own 20 s cooldown.
// The button used to grey out for any scan cooldown, so a find made just before
// entering left a ready Pulse looking locked for up to a minute (found in review).
for (const scanFailed of [false, true]) {
  test(`scanning: in the Rift a scan cooldown (${scanFailed ? 'after a lost signal' : 'after a find'}) leaves the Pulse button ready`, async ({page}) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await openWithSave(page, {...BASE, cargoRiftSync: 1, scanCooldownRemainingMs: 600_000, scanFailed});
    await enterGame(page);
    await undock(page);
    await flyTo(page, 'Rift Anomaly');
    await expect(async () => {
      await page.keyboard.press('z');
      await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible({timeout: 3000});
    }).toPass({timeout: 30_000});
    await page.keyboard.press('Enter');
    await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});

    const pulse = page.locator('button', {has: page.getByText('reveal fog', {exact: true})});
    await expect(pulse).toBeVisible();
    await expect(pulse).toHaveClass(/cartoon-btn-primary/);
    const look = await pulse.evaluate((el) => ({
      cursor: (el as HTMLElement).style.cursor,
      maxWidth: (el as HTMLElement).style.maxWidth,
      sub: ((el.lastElementChild as HTMLElement).style.color),
    }));
    expect(look).toEqual({cursor: '', maxWidth: '96px', sub: ''});

    // The Pulse's own cooldown greys it, in grey, never in the lost signal's red.
    await page.keyboard.press('p');
    await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible();
    const cooling = page.locator('button', {has: page.getByText('recharging', {exact: true})});
    await expect(cooling).not.toHaveClass(/cartoon-btn-primary/);
    const grey = await cooling.evaluate((el) => {
      const s = (el as HTMLElement).style;
      return {cursor: s.cursor, color: s.color, border: s.border, maxWidth: s.maxWidth, sub: (el.lastElementChild as HTMLElement).style.color};
    });
    expect(grey).toEqual({cursor: 'not-allowed', color: 'rgb(107, 116, 137)', border: '3px solid rgb(58, 69, 96)', maxWidth: '96px', sub: ''});
    // A 10-minute scan cooldown cannot run out inside this test's 3 minutes, so it is running
    // underneath every check above, and the game is still saving it.
    await expect.poll(async () => (await readSave(page))!.scanCooldownRemainingMs).toBeGreaterThan(400_000);
    expectClean(problems);
  });
}
