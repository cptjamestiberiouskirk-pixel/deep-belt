import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {SCAN_BANDS, SCAN_LOCKOUT_SEC, SCAN_SUCCESS_COOLDOWN_SEC, scanBandAt, scanLockoutSecAt, SIGNAL_RECOVERY_CUT_SEC, SKILLS} from '../content/skills';

// Step 37 of design/content-tree.md: Signal Recovery, the second Science skill.
// A failed probe scan locks the scanner for 60 s; each level takes 6 s off that,
// so 30 s at V. Rank 2, after Signal Analysis II. Nothing else changes: the
// bands, the 2-of-3 rule and the Data Cache's 600 MARKS stay as they are.

const BASE = {...RICH, milestoneIndustrialistClaimed: true, hasProbeLauncher: true};
const SKILLS_AT = (signalAnalysis: number, signalRecovery: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, navigation: 0, cargoTrim: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis, signalRecovery},
});

test('catalog: Signal Recovery is a rank 2 Science skill after Signal Analysis II, 6 s off the 60 s lockout per level', () => {
  expect(SKILLS.signalRecovery).toEqual({id: 'signalRecovery', name: 'Signal Recovery', category: 'Science', rank: 2, prerequisites: [{skill: 'signalAnalysis', level: 2}]});
  expect(SCAN_LOCKOUT_SEC).toBe(60);
  expect(SIGNAL_RECOVERY_CUT_SEC).toBe(6);
  // Every level pinned: a flat 6 s a level, not 10% of what is left (that would give 54, 48.6, 43.7, ...).
  expect([0, 1, 2, 3, 4, 5].map(scanLockoutSecAt)).toEqual([60, 54, 48, 42, 36, 30]);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: at Signal Analysis I, Signal Recovery shows under Science and needs Signal Analysis II', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1, 0)});
  await enterGame(page);
  await openSkills(page);
  const card = page.getByTestId('skill-card-signalRecovery');
  await expect(page.getByTestId('skill-category-Science')).toContainText('SIGNAL RECOVERY');
  await expect(card).toContainText('Needs: Signal Analysis II');
  await expect(card).toContainText('-0s scan lockout (60s after a lost signal)');
  await expect(card.getByRole('button', {name: 'NEEDS SIGNAL ANALYSIS II'})).toBeDisabled();
  expectClean(problems);
});

test('skills screen: at Signal Analysis II, level I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);
  const card = page.getByTestId('skill-card-signalRecovery');
  await expect(card.getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'signalRecovery', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at level V the card shows a 30 s lockout', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 5)});
  await enterGame(page);
  await openSkills(page);
  await expect(page.getByTestId('skill-card-signalRecovery')).toContainText('-30s scan lockout (30s after a lost signal)');
  expectClean(problems);
});

/**
 * Opens the scan sweep and presses once per ring at a sweep angle in [lo, hi],
 * placed from inside the page so the press reads exactly the angle checked
 * (as tests/signal-analysis.spec.ts does).
 */
async function sweepAt(page: Page, windows: Array<[number, number]>) {
  await settle(page);
  await page.keyboard.press('p');
  await expect(page.getByText('Core Probe Sweep')).toBeVisible();
  return page.evaluate((ws) => new Promise<number[]>((resolve) => {
    const scan = () => (window as any).__DEEP_BELT_SCAN__ as {angle: () => number};
    const pressed: number[] = [];
    const tick = () => {
      const [lo, hi] = ws[pressed.length];
      const a = scan().angle();
      if (a >= lo && a <= hi) {
        window.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', bubbles: true}));
        pressed.push(a);
        if (pressed.length === ws.length) return resolve(pressed);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), windows);
}

// Each press lands past the end of its band even at Signal Analysis V, so every scan fails.
const MISS: Array<[number, number]> = SCAN_BANDS.map((b) => [scanBandAt(b, 5).end + 0.05, scanBandAt(b, 5).end + 0.15]);

/** The scan button's countdown after a failed scan, "Signal lost 54s", read as soon as it shows. */
async function lockoutShown(page: Page): Promise<number> {
  let shown = -1;
  await expect.poll(async () => {
    const m = (await page.innerText('body')).match(/Signal lost (\d+)s/);
    shown = m ? Number(m[1]) : -1;
    return shown;
  }, {intervals: [50, 100, 100, 250]}).toBeGreaterThan(0);
  return shown;
}

for (const level of [0, 3, 5]) {
  test(`scanning: a lost signal locks the scanner for ${scanLockoutSecAt(level)} s at Signal Recovery ${level}`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...SKILLS_AT(2, level)});
    await enterGame(page);
    await undock(page);
    await sweepAt(page, MISS);
    const shown = await lockoutShown(page);
    // Read within a second or so of the failure: the countdown rounds up, so it shows the full lockout at first.
    const want = [60, 54, 48, 42, 36, 30][level];
    expect(shown).toBeGreaterThanOrEqual(want - 1);
    expect(shown).toBeLessThanOrEqual(want);
    // The failure notice names the same lockout, not the untrained 60 s.
    await expect(page.getByText(`Scanner on ${want}s cooldown.`).first()).toBeVisible();
    expect((await readSave(page))!.dataCache ?? null).toBeNull();
    expectClean(problems);
  });
}

// Each press lands mid-band, inside even the untrained band, so every scan hits.
const HIT: Array<[number, number]> = SCAN_BANDS.map((b) => [(b.start + b.end) / 2 - 0.1, (b.start + b.end) / 2 + 0.1]);

test('scanning: at Signal Recovery V a find still cools the scanner for the full 60 s', async ({page}) => {
  // Step 37a's cooldown after a find caps the Data Cache farm at one cache a minute;
  // Signal Recovery shortens only the lockout after a lost signal, never this.
  expect(SCAN_SUCCESS_COOLDOWN_SEC).toBe(60);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2, 5), firstCacheOpened: true});
  await enterGame(page);
  await undock(page);
  await sweepAt(page, HIT);
  await expect(page.getByText('Data Cache located').first()).toBeVisible();
  let shown = -1;
  await expect.poll(async () => {
    const m = (await page.innerText('body')).match(/Cool (\d+)s/);
    shown = m ? Number(m[1]) : -1;
    return shown;
  }, {intervals: [50, 100, 100, 250]}).toBeGreaterThan(0);
  expect(shown).toBeGreaterThanOrEqual(59);
  expect(shown).toBeLessThanOrEqual(60);
  await expect(page.getByText(/Signal lost \d+s/)).toHaveCount(0);
  expectClean(problems);
});
