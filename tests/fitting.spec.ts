import {expect, test} from '@playwright/test';
import {buy, canBuyMore, fit, fitBlockReason, fittedTotal, fittedWith, fromLegacy, hangarModuleIds, newGameFitting, owned, parseFitting, switchHull, toLegacy, unfit, type FittingState} from '../content/fitting';

// The fitting model's rules (design/content-tree.md 4.2), checked without a browser.

const total = (s: FittingState) => Object.values(owned(s)).reduce((a, b) => a + (b ?? 0), 0);

test('fitting model: a v4 save with every flag converts to the same fitting', () => {
  const s = fromLegacy(
    {
      upgrades: {laserMk2: true, cargoExpanded: true, shieldBoosterHeavy: true, cannon: true},
      fittedSlots: {slot1MiningLaser: true, slot2CargoExpander: true, slot3ShieldBooster: false, slot4Cannon: true},
    },
    'ferrier',
  );
  expect(s.fitted).toEqual(['miner_mk2', 'expanded_hold', null, 'light_cannon']);
  expect(s.hangar).toEqual({shield_booster: 1});
  expect(toLegacy(s)).toEqual({
    upgrades: {laserMk2: true, cargoExpanded: true, shieldBoosterHeavy: true, cannon: true},
    fittedSlots: {slot1MiningLaser: true, slot2CargoExpander: true, slot3ShieldBooster: false, slot4Cannon: true},
  });
});

test('fitting model: a v4 save with no flags gets the v4 defaults, and a Tern stores its cannon', () => {
  expect(fromLegacy({}, 'ferrier').fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);
  const tern = fromLegacy({}, 'tern');
  expect(tern.fitted).toEqual(['miner_mk1', null, null]);
  expect(tern.hangar).toEqual({light_cannon: 1});
});

test('fitting model: buying fits into a free slot, else goes to the hangar', () => {
  let s = newGameFitting();
  const a = buy(s, 'ferrier', 'expanded_hold');
  expect(a.fitted).toBe(true);
  s = unfit(a.state, 'ferrier', 'light_cannon')!;
  // The weapon slot is free now, but a second cannon waits for step 3; a shield booster fits utility.
  const b = buy(s, 'ferrier', 'shield_booster');
  expect(b.fitted).toBe(true);
  expect(b.state.fitted).toEqual(['miner_mk1', 'expanded_hold', 'shield_booster', null]);
  // Both utility slots are full: an unfitted Expanded Hold bought again would go to the hangar.
  const c = buy(unfit(b.state, 'ferrier', 'expanded_hold')!, 'ferrier', 'expanded_hold');
  expect(c.fitted).toBe(true);
  const tern = fromLegacy({upgrades: {cargoExpanded: true, shieldBoosterHeavy: true}, fittedSlots: {slot2CargoExpander: true, slot3ShieldBooster: true}}, 'tern');
  const d = buy(tern, 'tern', 'light_cannon');
  expect(d.fitted).toBe(false);
  expect(d.state.hangar.light_cannon).toBe(2);
});

test('fitting model: the Miner MK2 replaces the MK1 in place', () => {
  const r = buy(newGameFitting(), 'ferrier', 'miner_mk2');
  expect(r.fitted).toBe(true);
  expect(r.state.fitted[0]).toBe('miner_mk2');
  expect(owned(r.state).miner_mk1).toBeUndefined();
});

test('fitting model: each hull keeps its loadout, and module counts are conserved', () => {
  let s = buy(newGameFitting(), 'ferrier', 'expanded_hold').state;
  const before = total(s);
  // The Tern has no weapon slot: the cannon waits in the hangar.
  s = switchHull(s, 'ferrier', 'tern');
  expect(s.fitted).toEqual(['miner_mk1', 'expanded_hold', null]);
  expect(s.hangar).toEqual({light_cannon: 1});
  s = unfit(s, 'tern', 'expanded_hold')!;
  // Back on the Ferrier, its own loadout comes back, not the Tern's.
  s = switchHull(s, 'tern', 'ferrier');
  expect(s.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  s = switchHull(s, 'ferrier', 'tern');
  expect(s.fitted).toEqual(['miner_mk1', null, null]);
  expect(total(s)).toBe(before);
});

test('fitting model: the hull you leave gives its modules back to the next one', () => {
  let s = buy(newGameFitting(), 'ferrier', 'expanded_hold').state;
  s = switchHull(s, 'ferrier', 'skirmisher');
  expect(s.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  s = unfit(s, 'skirmisher', 'expanded_hold')!;
  s = switchHull(s, 'skirmisher', 'ferrier');
  // Ferrier still wants the hold, and gets it: the Skirmisher left it in the hangar.
  expect(s.fitted[1]).toBe('expanded_hold');
  // Fit it on the Skirmisher again: leaving that hull puts it back in the hangar, so the Ferrier still gets it.
  s = switchHull(s, 'ferrier', 'skirmisher');
  s = fit(s, 'skirmisher', 'expanded_hold')!;
  s = switchHull(s, 'skirmisher', 'ferrier');
  expect(s.loadouts.ferrier![1]).toBe('expanded_hold');
  expect(s.fitted[1]).toBe('expanded_hold');
  expect(total(s)).toBe(3);
});

test('fitting model: a saved fitting reads back, and junk is dropped', () => {
  const s = buy(newGameFitting(), 'ferrier', 'shield_booster').state;
  expect(parseFitting(JSON.parse(JSON.stringify(s)), 'ferrier')).toEqual(s);
  expect(parseFitting(null, 'ferrier')).toBeNull();
  expect(parseFitting({hangar: {bogus: 3, light_cannon: -1}, fitted: ['miner_mk1', 'nope']}, 'tern')).toEqual({hangar: {}, fitted: ['miner_mk1', null, null], loadouts: {}});
});

test('fitting model: combat and hold stats come from what is fitted', () => {
  const s = buy(newGameFitting(), 'ferrier', 'expanded_hold').state;
  expect(fittedWith(s.fitted, 'damage')?.stats).toEqual({damage: 30, cycleSec: 3, rangeKm: 8, capPerCycle: 8});
  expect(fittedWith(s.fitted, 'shieldHpPerSec')).toBeNull();
  expect(fittedTotal(s.fitted, 'cargoM3')).toBe(500);
  const boosted = buy(s, 'ferrier', 'shield_booster').state;
  expect(fittedWith(boosted.fitted, 'shieldHpPerSec')?.stats).toEqual({shieldHpPerSec: 8, cycleSec: 3, capPerCycle: 25});
  expect(fittedTotal(unfit(boosted, 'ferrier', 'expanded_hold')!.fitted, 'cargoM3')).toBe(0);
});

test("fitting model: the hangar list is by slot type, and a blocked Fit says why", () => {
  const tern = fromLegacy({upgrades: {cargoExpanded: true, shieldBoosterHeavy: true}, fittedSlots: {slot2CargoExpander: false, slot3ShieldBooster: false}}, "tern");
  expect(hangarModuleIds(tern)).toEqual(["expanded_hold", "shield_booster", "light_cannon"]);
  expect(fitBlockReason(tern, "tern", "light_cannon")).toBe("No weapon slot on this hull");
  expect(fitBlockReason(tern, "tern", "expanded_hold")).toBeNull();
  const full = fit(fit(tern, "tern", "expanded_hold")!, "tern", "shield_booster")!;
  expect(full.fitted).toEqual(["miner_mk1", "expanded_hold", "shield_booster"]);
  const spare = unfit(full, "tern", "miner_mk1")!;
  expect(fitBlockReason(spare, "tern", "expanded_hold")).toBe("No free utility slot");
  expect(fitBlockReason(spare, "tern", "miner_mk2")).toBe("None in the hangar");
});

test("fitting model: the Gantry fits three utility modules, and doubles add up", () => {
  let s = switchHull(newGameFitting(), "ferrier", "gantry");
  expect(s.fitted).toEqual(["miner_mk1", null, null, null, "light_cannon"]);
  for (let i = 0; i < 3; i++) {
    expect(canBuyMore(s, "expanded_hold")).toBe(true);
    const r = buy(s, "gantry", "expanded_hold");
    expect(r.fitted).toBe(true);
    s = r.state;
  }
  expect(s.fitted).toEqual(["miner_mk1", "expanded_hold", "expanded_hold", "expanded_hold", "light_cannon"]);
  expect(fittedTotal(s.fitted, "cargoM3")).toBe(1500);
  expect(canBuyMore(s, "expanded_hold")).toBe(false);
  expect(canBuyMore(s, "light_cannon")).toBe(false);
  expect(canBuyMore(s, "shield_booster")).toBe(true);
  // Back on a Ferrier, two of the three fit; the third waits in the hangar.
  const f = switchHull(s, "gantry", "ferrier");
  expect(f.fitted).toEqual(["miner_mk1", null, null, "light_cannon"]);
  expect(f.hangar.expanded_hold).toBe(3);
});

test("fitting model: a Gantry fitting saved before its third utility slot keeps its cannon", () => {
  const old = ["miner_mk1", "expanded_hold", "shield_booster", "light_cannon"];
  const s = parseFitting({hangar: {}, fitted: old, loadouts: {gantry: old}}, "gantry")!;
  expect(s.fitted).toEqual(["miner_mk1", "expanded_hold", "shield_booster", null, "light_cannon"]);
  expect(s.loadouts.gantry).toEqual(["miner_mk1", "expanded_hold", "shield_booster", null, "light_cannon"]);
  expect(s.hangar).toEqual({});
  // A v4 save on a Gantry puts its cannon in the weapon slot too.
  expect(fromLegacy({}, "gantry").fitted).toEqual(["miner_mk1", null, null, null, "light_cannon"]);
});
