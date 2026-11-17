import {expect, test} from '@playwright/test';
import fc from 'fast-check';
import {buy, canBuyMore, fit, layoutOf, newGameFitting, owned, parseFitting, SLOT_LAYOUTS, switchHull, unfit, type FittingState} from '../content/fitting';
import type {HullId} from '../content/hulls';
import {MARKET_MODULE_IDS, MODULES, type ModuleId} from '../content/modules';
import {formatSpeed, PIXELS_PER_KM, topSpeed} from '../content/flight';
import {effectiveLoad, minerCycleAt, miningNoticePerSec, saleNotice, skillLevels, SKILL_IDS, weaponCycleAt} from '../content/skills';

// Property tests (TESTING.md): each states something that must always hold, and
// fast-check tries many generated inputs against it, shrinking any failure to a
// smallest case. No page: these run the pure content/ code directly.

const HULLS = Object.keys(SLOT_LAYOUTS) as HullId[];
const ALL_MODULES = Object.keys(MODULES) as ModuleId[];
const LEVEL = fc.integer({min: 0, max: 5});

type Action =
  | {kind: 'buy'; id: ModuleId}
  | {kind: 'fit'; id: ModuleId}
  | {kind: 'unfit'; id: ModuleId}
  | {kind: 'switch'; to: HullId};

const action: fc.Arbitrary<Action> = fc.oneof(
  fc.constantFrom(...MARKET_MODULE_IDS).map((id) => ({kind: 'buy' as const, id})),
  fc.constantFrom(...ALL_MODULES).map((id) => ({kind: 'fit' as const, id})),
  fc.constantFrom(...ALL_MODULES).map((id) => ({kind: 'unfit' as const, id})),
  fc.constantFrom(...HULLS).map((to) => ({kind: 'switch' as const, to})),
);

/** What the station would do for one action; a refused action leaves the state as it was. */
function apply(s: FittingState, hull: HullId, a: Action): {s: FittingState; hull: HullId} {
  switch (a.kind) {
    case 'buy':
      return canBuyMore(s, a.id) ? {s: buy(s, hull, a.id).state, hull} : {s, hull};
    case 'fit':
      return {s: fit(s, hull, a.id) ?? s, hull};
    case 'unfit':
      return {s: unfit(s, hull, a.id) ?? s, hull};
    case 'switch':
      return a.to === hull ? {s, hull} : {s: switchHull(s, hull, a.to), hull: a.to};
  }
}

/** The fitting rules that hold for every state a pilot can reach. */
function expectWellFormed(s: FittingState, hull: HullId) {
  const layout = layoutOf(hull);
  expect(s.fitted).toHaveLength(layout.length);
  s.fitted.forEach((id, i) => {
    if (id) expect(MODULES[id].slot).toBe(layout[i]);
  });
  for (const n of Object.values(s.hangar)) {
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  }
  for (const [id, n] of Object.entries(owned(s)) as [ModuleId, number][]) {
    expect(n).toBeLessThanOrEqual(MODULES[id].maxOwned ?? 1);
  }
  for (const [h, slots] of Object.entries(s.loadouts) as [HullId, FittingState['fitted']][]) {
    expect(slots).toHaveLength(layoutOf(h).length);
    slots.forEach((id, i) => {
      if (id) expect(MODULES[id].slot).toBe(layoutOf(h)[i]);
    });
  }
}

test('fitting: fit, unfit and boarding another hull never make or lose a module; buying adds exactly one', () => {
  fc.assert(
    fc.property(fc.array(action, {maxLength: 40}), (actions) => {
      let s = newGameFitting();
      let hull: HullId = 'ferrier';
      for (const a of actions) {
        const before = owned(s);
        ({s, hull} = apply(s, hull, a));
        const after = owned(s);
        const expected = {...before};
        if (a.kind === 'buy' && canBuyMore({hangar: before, fitted: [], loadouts: {}}, a.id)) {
          expected[a.id] = (expected[a.id] ?? 0) + 1;
          // The Miner MK2 replaces the MK1.
          if (a.id === 'miner_mk2' && expected.miner_mk1) delete expected.miner_mk1;
        }
        expect(after).toEqual(expected);
        expectWellFormed(s, hull);
      }
    }),
    {numRuns: 300},
  );
});

test('fitting: a reachable state survives a save and load unchanged', () => {
  fc.assert(
    fc.property(fc.array(action, {maxLength: 40}), (actions) => {
      let s = newGameFitting();
      let hull: HullId = 'ferrier';
      for (const a of actions) ({s, hull} = apply(s, hull, a));
      expect(parseFitting(JSON.parse(JSON.stringify(s)), hull)).toEqual(s);
    }),
    {numRuns: 300},
  );
});

test('fitting: loading any JSON never throws, and what loads is well formed', () => {
  // Saved fittings shaped like the real thing, with junk mixed in, and plain junk.
  const slot = fc.oneof(fc.constantFrom(...ALL_MODULES), fc.constant(null), fc.string(), fc.integer());
  const shaped = fc.record({
    hangar: fc.dictionary(fc.oneof(fc.constantFrom(...ALL_MODULES), fc.string()), fc.oneof(fc.integer({min: -2, max: 4}), fc.double(), fc.string())),
    fitted: fc.array(slot, {maxLength: 7}),
    loadouts: fc.dictionary(fc.oneof(fc.constantFrom(...HULLS), fc.string()), fc.oneof(fc.array(slot, {maxLength: 7}), fc.string())),
  });
  fc.assert(
    fc.property(fc.oneof(shaped, fc.jsonValue()), fc.constantFrom(...HULLS), (raw, hull) => {
      const s = parseFitting(raw, hull);
      if (s === null) return;
      const layout = layoutOf(hull);
      expect(s.fitted).toHaveLength(layout.length);
      s.fitted.forEach((id, i) => {
        if (id) expect(MODULES[id].slot).toBe(layout[i]);
      });
      for (const n of Object.values(s.hangar)) expect(Number.isInteger(n) && n > 0).toBe(true);
    }),
    // Found by this test: a count under 1 once loaded as a hangar entry of 0, and a
    // name from Object.prototype ("toString") once passed as a hull or module and threw.
    {
      numRuns: 500,
      examples: [
        [{hangar: {miner_mk1: 0.5, bulk_hold: Infinity}, fitted: [], loadouts: {}}, 'ferrier'],
        [{hangar: {}, fitted: [], loadouts: {toString: []}}, 'ferrier'],
        [{hangar: {constructor: 1}, fitted: ['toString'], loadouts: {}}, 'ferrier'],
      ],
    },
  );
});

test('skills: a cycle never gets longer with a higher level and never reaches zero', () => {
  fc.assert(
    fc.property(fc.double({min: 1, max: 30, noNaN: true}), LEVEL, LEVEL, (base, a, b) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (const cycleAt of [minerCycleAt, weaponCycleAt]) {
        expect(cycleAt(base, hi)).toBeLessThanOrEqual(cycleAt(base, lo));
        expect(cycleAt(base, hi)).toBeGreaterThan(0);
      }
    }),
  );
});

test('notice: selling more never draws less, Low Profile never draws more, and it is never negative', () => {
  fc.assert(
    fc.property(fc.integer({min: 0, max: 5000}), fc.integer({min: 0, max: 5000}), LEVEL, LEVEL, (x, y, a, b) => {
      const [few, many] = x <= y ? [x, y] : [y, x];
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      expect(saleNotice(many, lo)).toBeGreaterThanOrEqual(saleNotice(few, lo));
      expect(saleNotice(many, hi)).toBeLessThanOrEqual(saleNotice(many, lo));
      expect(saleNotice(few, hi)).toBeGreaterThanOrEqual(0);
      expect(miningNoticePerSec(hi)).toBeLessThanOrEqual(miningNoticePerSec(lo));
      expect(miningNoticePerSec(hi)).toBeGreaterThan(0);
    }),
  );
});

test('flight: more cargo never makes the ship faster, more Navigation never makes it slower', () => {
  const inputs = fc.record({
    baseThrust: fc.double({min: 50, max: 600, noNaN: true}),
    baseMaxSpeed: fc.double({min: 100, max: 600, noNaN: true}),
    hullMult: fc.constantFrom(1, 1.15),
    moduleMult: fc.constantFrom(1, 0.8),
    fill: fc.double({min: 0, max: 1, noNaN: true}),
    trim: LEVEL,
  });
  fc.assert(
    fc.property(inputs, LEVEL, LEVEL, fc.double({min: 0, max: 1, noNaN: true}), (i, a, b, more) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const load = effectiveLoad(i.fill, i.trim);
      expect(load).toBeGreaterThanOrEqual(0);
      expect(load).toBeLessThanOrEqual(i.fill);
      const at = (navigation: number, l: number) => topSpeed({...i, navigation, load: l});
      const heavier = Math.min(1, load + more);
      expect(at(lo, heavier)).toBeLessThanOrEqual(at(lo, load) + 1e-9);
      expect(at(hi, load)).toBeGreaterThanOrEqual(at(lo, load) - 1e-9);
    }),
  );
});

test('flight: the speed shown in km/s reads back to the speed flown, to the shown precision', () => {
  fc.assert(
    fc.property(fc.double({min: 0, max: 2000, noNaN: true}), (px) => {
      const shown = formatSpeed(px);
      expect(shown).toMatch(/^\d+\.\d\d km\/s$/);
      expect(Math.abs(parseFloat(shown) - px / PIXELS_PER_KM)).toBeLessThanOrEqual(0.005 + 1e-9);
    }),
  );
});

test('skills: any saved skills value loads as a level for every skill', () => {
  fc.assert(
    fc.property(fc.oneof(fc.jsonValue(), fc.dictionary(fc.constantFrom(...SKILL_IDS), fc.oneof(LEVEL, fc.string()))), (raw) => {
      const levels = skillLevels(raw);
      expect(Object.keys(levels).sort()).toEqual([...SKILL_IDS].sort());
      for (const id of SKILL_IDS) expect(typeof levels[id]).toBe('number');
    }),
  );
});
