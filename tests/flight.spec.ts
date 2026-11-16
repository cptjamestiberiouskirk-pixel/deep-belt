import {expect, test} from '@playwright/test';
import {FULL_HOLD_THRUST_CUT, flightLimits, SPACE_DRAG, topSpeed} from '../content/flight';
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
