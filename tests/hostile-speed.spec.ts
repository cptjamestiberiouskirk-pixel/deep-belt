import {expect, test} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {topSpeed} from '../content/flight';

// Hostile ships fly at a share of a plain Ferrier's top speed (88 m/s), as the
// code's own comments say ("80% speed of player frigate"). Until 2026-11-16 the
// share was of the 320 m/s cap no ship reaches, so raiders flew at 256 m/s and
// even an empty Ferrier could not get away: the balance probe measured 224 HP
// lost in 45 s of running, against 0 HP and out of range in 2.5 s after the fix.

test('raiders fly at 80% of a plain Ferrier, slower than an empty one', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true, cargoFerrite: 240});
  await enterGame(page);
  // Dumping ore on the market brings a raider wave.
  await page.keyboard.press('1');
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});

  const ferrier = topSpeed({baseThrust: 220, baseMaxSpeed: 320, navigation: 0, hullMult: 1, moduleMult: 1, load: 0});
  const raiderSpeeds = () =>
    page.evaluate(() => ((window as any).__DEEP_BELT_PROBE__.raiders() as Array<{speed: number}>).map((r) => r.speed));
  // Each raider closes in at full speed from 8 km out.
  await expect.poll(async () => Math.max(0, ...(await raiderSpeeds())), {timeout: 10_000}).toBeGreaterThan(0);
  for (const s of await raiderSpeeds()) expect(s).toBeCloseTo(0.8 * ferrier, 0);
  expect(0.8 * ferrier).toBeLessThan(ferrier);
  expectClean(problems);
});
