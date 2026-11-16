import {expect, test} from '@playwright/test';
import {formatSpeed, FULL_HOLD_THRUST_CUT, flightLimits, SPACE_DRAG, topSpeed} from '../content/flight';
import {enterGame, expectClean, openWithSave, RICH, undock, watch} from './helpers';
import {effectiveLoad} from '../content/skills';

// content/flight.ts: the speed a ship reaches holding thrust, which Ship stats and
// the Navigation and Cargo Trim cards show. The expected numbers are the ones the
// balance probe (tests/balance-probe.spec.ts) measured in flight on 2026-11-16, so
// a change to the flight loop that this formula misses shows up here.

const FERRIER = {baseThrust: 220, baseMaxSpeed: 320, navigation: 0, hullMult: 1, moduleMult: 1, load: 0};
const BULK = {...FERRIER, moduleMult: 0.8};

test('flight: thrust, not the 320 cap, sets top speed, at 0.4 × thrust', () => {
  expect(SPACE_DRAG).toBe(0.96);
  expect(FULL_HOLD_THRUST_CUT).toBe(0.4);
  expect(flightLimits(FERRIER)).toEqual({thrust: 220, cap: 320});
  expect(topSpeed(FERRIER)).toBeCloseTo(88);
  // Only a far stronger engine would reach the cap.
  expect(topSpeed({...FERRIER, baseThrust: 1000})).toBe(320);
});

test('flight: top speeds match what the probe measured in flight', () => {
  const cases: Array<[string, typeof FERRIER, number]> = [
    ['empty hold', FERRIER, 88],
    ['full hold', {...FERRIER, load: 1}, 53],
    ['full hold, Cargo Trim V', {...FERRIER, load: effectiveLoad(1, 5)}, 79],
    ['Bulk Hold, empty', BULK, 70],
    ['Bulk Hold, full', {...BULK, load: 1}, 42],
    ['Bulk Hold, full, Cargo Trim V', {...BULK, load: effectiveLoad(1, 5)}, 63],
  ];
  for (const [name, inputs, measured] of cases) expect(Math.round(topSpeed(inputs)), name).toBe(measured);
});

test('speed is shown in km/s on the Overview scale: 50 px to the km', () => {
  expect(formatSpeed(88)).toBe('1.76 km/s');
  expect(formatSpeed(0)).toBe('0.00 km/s');
});

test('top bar: the speed readout climbs to an empty Ferrier top speed, 1.76 km/s, and is gone when docked', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true});
  await enterGame(page);
  await expect(page.getByTestId('speed-readout')).toHaveCount(0);
  await undock(page);
  const readout = page.getByTestId('speed-readout');
  await expect(readout).toBeVisible();
  const kmS = async () => Number((await readout.innerText()).replace(' km/s', ''));
  await page.keyboard.down('ArrowUp');
  // Top speed is 88 px/s (1.76 km/s); thrust reaches 95% of it in under a second.
  await expect.poll(kmS, {timeout: 10_000}).toBeGreaterThan(1.7);
  await page.waitForTimeout(2000);
  expect(await kmS()).toBeLessThanOrEqual(1.77);
  await page.keyboard.up('ArrowUp');
  expectClean(problems);
});
