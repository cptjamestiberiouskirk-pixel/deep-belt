import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {SCAN_BANDS, SCAN_SWEEP_RAD_PER_SEC, scanBandAt, scanWindowSec, SIGNAL_ANALYSIS_WIDEN, SKILLS} from '../content/skills';

// Step 17 of design/content-tree.md: Signal Analysis, the first Science skill.
// Each level widens every target band in the probe scan sweep by 10% of its arc,
// about its middle (as wide again by half at V). A scan needs 2 hits of 3, and a
// failed one locks the scanner for 60 s. Rank 1, no prerequisites.

const BASE = {...RICH, milestoneIndustrialistClaimed: true, hasProbeLauncher: true};
const SKILLS_AT = (signalAnalysis: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, navigation: 0, cargoTrim: 0, refining: 0, droneOperation: 0, exoticPacking: 0, signalAnalysis},
});

test('catalog: Signal Analysis is a rank 1 Science skill that widens the scan bands', () => {
  expect(SKILLS.signalAnalysis).toEqual({id: 'signalAnalysis', name: 'Signal Analysis', category: 'Science', rank: 1, prerequisites: []});
  expect(SIGNAL_ANALYSIS_WIDEN).toBe(0.1);
  expect(SCAN_SWEEP_RAD_PER_SEC).toBe(2.6);
  expect(SCAN_BANDS).toEqual([{start: 0.78, end: 1.71}, {start: 2.7, end: 3.66}, {start: 4.71, end: 5.67}]);
  // Untrained the bands are as they were; at V each is 1.5 times as wide, about the same middle.
  expect(scanBandAt(SCAN_BANDS[0], 0)).toEqual(SCAN_BANDS[0]);
  const v = scanBandAt(SCAN_BANDS[1], 5);
  expect((v.start + v.end) / 2).toBeCloseTo(3.18, 9);
  expect(v.end - v.start).toBeCloseTo(1.5 * 0.96, 9);
  expect([scanWindowSec(SCAN_BANDS[0], 0), scanWindowSec(SCAN_BANDS[0], 5)]).toEqual([0.36, 0.54]);
  // At V the bands still don't overlap or pass a full turn.
  const at5 = SCAN_BANDS.map((b) => scanBandAt(b, 5));
  expect(at5[0].end).toBeLessThan(at5[1].start);
  expect(at5[1].end).toBeLessThan(at5[2].start);
  expect(at5[2].end).toBeLessThan(2 * Math.PI);
});

async function openSkills(page: Page) {
  await settle(page);
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
}

test('skills screen: Signal Analysis shows under Science, needs nothing, and level I queues for 100 MARKS and takes 1:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openSkills(page);
  const science = page.getByTestId('skill-category-Science');
  await expect(science).toContainText('SIGNAL ANALYSIS');
  await expect(science).toContainText('+0% scan bands (0.36s to hit ring 1)');
  await expect(science.getByText(/^Needs:/)).toHaveCount(0);
  await page.getByTestId('skill-card-signalAnalysis').getByRole('button', {name: 'LVL I (100 MARKS • 1:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'signalAnalysis', targetLevel: 1, duration: 60, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at level V the card shows the wider bands, and the level is kept on reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5)});
  await enterGame(page);
  await openSkills(page);
  await expect(page.getByTestId('skill-category-Science')).toContainText('+50% scan bands (0.54s to hit ring 1)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(6000); // past one autosave, so the game has written its own save
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.skills.signalAnalysis).toBe(5);
  expectClean(problems);
});

/**
 * Opens the scan sweep and presses once per ring at a sweep angle in [lo, hi],
 * placed from inside the page so the press reads exactly the angle checked.
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

// Each press lands just past the end of the untrained band but inside the level V band.
const PAST_UNTRAINED: Array<[number, number]> = SCAN_BANDS.map((b) => [b.end + 0.05, scanBandAt(b, 5).end - 0.05]);

for (const c of [{level: 0, found: false}, {level: 5, found: true}]) {
  test(`scanning: presses just past each untrained band ${c.found ? 'find a data cache at Signal Analysis V' : 'lose the signal untrained'}`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, {...BASE, ...SKILLS_AT(c.level)});
    await enterGame(page);
    await undock(page);
    await sweepAt(page, PAST_UNTRAINED);
    // The modal checks presses against the bands the level gives.
    if (c.found) {
      await expect(page.getByText('Data Cache located. Warp [M].').first()).toBeVisible();
      await expect.poll(async () => Boolean((await readSave(page))!.dataCache)).toBe(true);
    } else {
      await expect(page.getByText('Signal lost').first()).toBeVisible();
      expect((await readSave(page))!.dataCache ?? null).toBeNull();
    }
    expectClean(problems);
  });
}

test('scanning: the sweep checks presses against the bands the trained level gives', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(3)});
  await enterGame(page);
  await undock(page);
  await settle(page);
  await page.keyboard.press('p');
  await expect(page.getByText('Core Probe Sweep')).toBeVisible();
  const bands = await page.evaluate(() => (window as any).__DEEP_BELT_SCAN__.bands() as Array<{start: number; end: number}>);
  const want = SCAN_BANDS.map((b) => scanBandAt(b, 3));
  bands.forEach((b, i) => {
    expect(b.start).toBeCloseTo(want[i].start, 9);
    expect(b.end).toBeCloseTo(want[i].end, 9);
  });
  await page.keyboard.press('Escape');
  await expect(page.getByText('Core Probe Sweep')).toHaveCount(0);
  expectClean(problems);
});
