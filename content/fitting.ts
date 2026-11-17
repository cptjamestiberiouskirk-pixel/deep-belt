// Fitting model (design/content-tree.md 4.2, step 2): owned modules sit either in
// the station hangar or in the active hull's typed slots, and each hull keeps a
// wanted loadout. Pure functions only; App.tsx holds the state.
//
// Rules this file keeps:
// - Hangar plus fitted always equals what you own.
// - A loadout is a wish: switching hulls fills the new hull's slots from it as
//   far as the hangar allows, and an unfilled slot keeps its wish.
// - A module's catalog maxOwned caps how many you own (default 1); doubles add up.
//   The Miner MK2 replaces the MK1.
// - Saved slots are re-placed by type when a hull's layout changes (step 3 gave
//   the Gantry a third utility slot, which moved its weapon slot).

import type {HullId} from './hulls';
import type {ModuleId} from './modules';
import {MODULES} from './modules';
import type {ModuleDef, SlotType, StatId} from './types';

export type Slots = Array<ModuleId | null>;

export interface FittingState {
  /** Owned modules not fitted, by count. */
  hangar: Partial<Record<ModuleId, number>>;
  /** The active hull's slots, in its layout's order. */
  fitted: Slots;
  /** What each hull wants fitted, in its layout's order. */
  loadouts: Partial<Record<HullId, Slots>>;
}

/** Slot types per hull, in fitting order. The Gantry's five slots include a third utility slot. */
export const SLOT_LAYOUTS: Record<HullId, SlotType[]> = {
  ferrier: ['extraction', 'utility', 'utility', 'weapon'],
  skirmisher: ['extraction', 'utility', 'utility', 'weapon'],
  lattice: ['extraction', 'utility', 'utility', 'weapon'],
  gantry: ['extraction', 'utility', 'utility', 'utility', 'weapon'],
  tern: ['extraction', 'utility', 'utility'],
  shade: ['extraction', 'utility', 'utility'],
};

export function layoutOf(hull: HullId): SlotType[] {
  // Own keys only: "toString" or "constructor" from a save must not reach Object.prototype.
  return Object.hasOwn(SLOT_LAYOUTS, hull) ? SLOT_LAYOUTS[hull] : SLOT_LAYOUTS.ferrier;
}

/** The order slot types are listed in, and their headers on the Fitting screen. */
export const SLOT_TYPE_ORDER: SlotType[] = ['extraction', 'utility', 'weapon'];
export const SLOT_TYPE_LABELS: Record<SlotType, string> = {extraction: 'EXTRACTION', utility: 'UTILITY', weapon: 'WEAPON'};

/** The modules in the hangar, by slot type and then catalog order. */
export function hangarModuleIds(s: FittingState): ModuleId[] {
  const ids = (Object.keys(MODULES) as ModuleId[]).filter((id) => (s.hangar[id] ?? 0) > 0);
  return SLOT_TYPE_ORDER.flatMap((t) => ids.filter((id) => MODULES[id].slot === t));
}

/** Why this module can't be fitted on this hull now, or null when it can. */
export function fitBlockReason(s: FittingState, hull: HullId, id: ModuleId): string | null {
  const type = MODULES[id].slot;
  if (!layoutOf(hull).includes(type)) return `No ${type} slot on this hull`;
  if (freeSlotFor(s.fitted, hull, id) < 0) return `No free ${type} slot`;
  if ((s.hangar[id] ?? 0) <= 0) return 'None in the hangar';
  return null;
}

/** Every owned module, counted: hangar plus fitted. */
export function owned(s: FittingState): Partial<Record<ModuleId, number>> {
  const out: Partial<Record<ModuleId, number>> = {...s.hangar};
  for (const id of s.fitted) if (id) out[id] = (out[id] ?? 0) + 1;
  return out;
}

export function owns(s: FittingState, id: ModuleId): boolean {
  return (owned(s)[id] ?? 0) > 0;
}

function take(h: FittingState['hangar'], id: ModuleId): boolean {
  if ((h[id] ?? 0) <= 0) return false;
  h[id] = (h[id] ?? 0) - 1;
  if (h[id] === 0) delete h[id];
  return true;
}

function put(h: FittingState['hangar'], id: ModuleId) {
  h[id] = (h[id] ?? 0) + 1;
}

function freeSlotFor(fitted: Slots, hull: HullId, id: ModuleId): number {
  const type = MODULES[id].slot;
  return layoutOf(hull).findIndex((t, i) => t === type && !fitted[i]);
}

/** The first fitted module that has this stat (the weapon, the shield booster), or null. */
export function fittedWith(fitted: Slots, stat: StatId): ModuleDef | null {
  for (const id of fitted) if (id && MODULES[id].stats[stat] !== undefined) return MODULES[id];
  return null;
}

/** A stat added up over the fitted modules, such as the hold space they give. */
export function fittedTotal(fitted: Slots, stat: StatId): number {
  return fitted.reduce((sum, id) => sum + (id ? (MODULES[id].stats[stat] ?? 0) : 0), 0);
}

/** The fitted modules' effect on top speed and thrust: 0.8 with a Bulk Hold. Never below half. */
export function fittedSpeedMult(fitted: Slots): number {
  return Math.max(0.5, 1 + fittedTotal(fitted, 'speedPct') / 100);
}

/**
 * Puts saved modules into a hull's layout. A module keeps its index when that
 * slot is of its type; the rest take the first free slot of their type, and what
 * still has no slot comes back as overflow. Saves stay valid when a layout grows.
 */
export function placeByType(layout: SlotType[], saved: ReadonlyArray<ModuleId | null>): {slots: Slots; overflow: ModuleId[]} {
  const slots: Slots = layout.map(() => null);
  const rest: ModuleId[] = [];
  saved.forEach((id, i) => {
    if (!id) return;
    if (i < layout.length && layout[i] === MODULES[id].slot) slots[i] = id;
    else rest.push(id);
  });
  const overflow: ModuleId[] = [];
  for (const id of rest) {
    const j = layout.findIndex((t, k) => t === MODULES[id].slot && !slots[k]);
    if (j >= 0) slots[j] = id;
    else overflow.push(id);
  }
  return {slots, overflow};
}

/** Whether the pilot may buy another of this module: its catalog maxOwned, default 1. */
export function canBuyMore(s: FittingState, id: ModuleId): boolean {
  if (id === 'miner_mk2') return !owns(s, 'miner_mk2');
  return (owned(s)[id] ?? 0) < (MODULES[id].maxOwned ?? 1);
}

/** A new pilot: Miner MK1 and Light Cannon fitted on the Ferrier. */
export function newGameFitting(): FittingState {
  const fitted: Slots = ['miner_mk1', null, null, 'light_cannon'];
  return {hangar: {}, fitted, loadouts: {ferrier: [...fitted]}};
}

/** The v4 save's flags, as App.tsx read them before step 2. */
export interface LegacyFlags {
  upgrades?: {laserMk2?: boolean; cargoExpanded?: boolean; shieldBoosterHeavy?: boolean; cannon?: boolean};
  fittedSlots?: {slot1MiningLaser?: boolean; slot2CargoExpander?: boolean; slot3ShieldBooster?: boolean; slot4Cannon?: boolean};
}

/**
 * Converts a v4 save's flags, with the v4 loader's defaults and its free-cannon
 * retrofit: a save with nothing in the weapon slot and no cannon gets one fitted.
 */
export function fromLegacy(data: LegacyFlags, hull: HullId): FittingState {
  const up = {laserMk2: false, cargoExpanded: false, shieldBoosterHeavy: false, cannon: true, ...data.upgrades};
  const fs = {slot1MiningLaser: true, slot2CargoExpander: false, slot3ShieldBooster: false, slot4Cannon: true, ...data.fittedSlots};
  if (fs.slot4Cannon !== true && !up.cannon) {
    up.cannon = true;
    fs.slot4Cannon = true;
  }
  const miner: ModuleId = up.laserMk2 ? 'miner_mk2' : 'miner_mk1';
  const wanted: Slots = [
    fs.slot1MiningLaser ? miner : null,
    up.cargoExpanded && fs.slot2CargoExpander ? 'expanded_hold' : null,
    up.shieldBoosterHeavy && fs.slot3ShieldBooster ? 'shield_booster' : null,
    up.cannon && fs.slot4Cannon ? 'light_cannon' : null,
  ];
  const hangar: FittingState['hangar'] = {};
  for (const id of [miner, ...(up.cargoExpanded ? ['expanded_hold'] : []), ...(up.shieldBoosterHeavy ? ['shield_booster'] : []), ...(up.cannon ? ['light_cannon'] : [])] as ModuleId[]) {
    put(hangar, id);
  }
  const fitted: Slots = placeByType(layoutOf(hull), wanted).slots.map((id) => (id && take(hangar, id) ? id : null));
  return {hangar, fitted, loadouts: {[hull]: [...fitted]}};
}

/**
 * The four flags the rest of App.tsx still reads. `cannon` and `slot4Cannon` mean
 * any weapon, so a new weapon arms the same controls as the Light Cannon.
 */
export function toLegacy(s: FittingState) {
  const has = (id: ModuleId) => s.fitted.includes(id);
  const isWeapon = (id: ModuleId | null) => Boolean(id && MODULES[id].slot === 'weapon');
  return {
    upgrades: {
      laserMk2: owns(s, 'miner_mk2'),
      cargoExpanded: owns(s, 'expanded_hold'),
      shieldBoosterHeavy: owns(s, 'shield_booster'),
      cannon: (Object.keys(MODULES) as ModuleId[]).some((id) => isWeapon(id) && owns(s, id)),
    },
    fittedSlots: {
      slot1MiningLaser: has('miner_mk1') || has('miner_mk2'),
      slot2CargoExpander: has('expanded_hold'),
      slot3ShieldBooster: has('shield_booster'),
      slot4Cannon: s.fitted.some(isWeapon),
    },
  };
}

function clone(s: FittingState): FittingState {
  const loadouts: FittingState['loadouts'] = {};
  for (const [k, v] of Object.entries(s.loadouts)) loadouts[k as HullId] = [...(v as Slots)];
  return {hangar: {...s.hangar}, fitted: [...s.fitted], loadouts};
}

export type BuyResult = {state: FittingState; fitted: boolean};

/** Buys one module: fitted at once when a slot of its type is free, else to the hangar. */
export function buy(s: FittingState, hull: HullId, id: ModuleId): BuyResult {
  const n = clone(s);
  if (id === 'miner_mk2') {
    // The MK2 replaces the MK1 wherever it is, as the yes/no flag did.
    const i = n.fitted.indexOf('miner_mk1');
    if (i >= 0) n.fitted[i] = 'miner_mk2';
    else if (take(n.hangar, 'miner_mk1')) put(n.hangar, 'miner_mk2');
    else put(n.hangar, 'miner_mk2');
    for (const l of Object.values(n.loadouts)) (l as Slots).forEach((m, j, a) => m === 'miner_mk1' && (a[j] = 'miner_mk2'));
    n.loadouts[hull] = [...n.fitted];
    return {state: n, fitted: i >= 0};
  }
  const slot = freeSlotFor(n.fitted, hull, id);
  if (slot >= 0) {
    n.fitted[slot] = id;
    n.loadouts[hull] = [...n.fitted];
    return {state: n, fitted: true};
  }
  put(n.hangar, id);
  return {state: n, fitted: false};
}

/** Fits one from the hangar into the first free slot of its type; null when it can't. */
export function fit(s: FittingState, hull: HullId, id: ModuleId): FittingState | null {
  const slot = freeSlotFor(s.fitted, hull, id);
  if (slot < 0 || (s.hangar[id] ?? 0) <= 0) return null;
  const n = clone(s);
  take(n.hangar, id);
  n.fitted[slot] = id;
  n.loadouts[hull] = [...n.fitted];
  return n;
}

/** Unfits the module of this id from the active hull into the hangar; null when none is fitted. */
export function unfit(s: FittingState, hull: HullId, id: ModuleId): FittingState | null {
  const slot = s.fitted.indexOf(id);
  if (slot < 0) return null;
  const n = clone(s);
  n.fitted[slot] = null;
  put(n.hangar, id);
  n.loadouts[hull] = [...n.fitted];
  return n;
}

/**
 * Boards another hull: the old hull's modules go to the hangar, then the new
 * hull's slots fill from its loadout as far as the hangar allows. A hull never
 * boarded wants what the old hull had, by slot type, plus an owned weapon in
 * its weapon slot (as boarding did before step 2).
 */
export function switchHull(s: FittingState, from: HullId, to: HullId): FittingState {
  const n = clone(s);
  n.loadouts[from] = [...n.fitted];
  for (const id of n.fitted) if (id) put(n.hangar, id);
  const layout = layoutOf(to);
  let wish = n.loadouts[to];
  if (!wish) {
    const pool = n.fitted.filter((m): m is ModuleId => Boolean(m));
    wish = layout.map((type) => {
      const i = pool.findIndex((m) => MODULES[m].slot === type);
      return i >= 0 ? pool.splice(i, 1)[0] : null;
    });
    const w = layout.indexOf('weapon');
    if (w >= 0 && !wish[w] && (n.hangar.light_cannon ?? 0) > 0) wish[w] = 'light_cannon';
    n.loadouts[to] = wish;
  }
  n.fitted = layout.map((_, i) => {
    const id = wish![i] ?? null;
    return id && take(n.hangar, id) ? id : null;
  });
  return n;
}

/** Checks a loaded v5 fitting; anything malformed falls back to null so the caller can rebuild it. */
export function parseFitting(raw: unknown, hull: HullId): FittingState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<FittingState>;
  const isId = (x: unknown): x is ModuleId => typeof x === 'string' && Object.hasOwn(MODULES, x);
  if (!r.hangar || typeof r.hangar !== 'object' || !Array.isArray(r.fitted)) return null;
  const hangar: FittingState['hangar'] = {};
  // At least 1 and finite, so a count of 0.5 or Infinity can't load as 0 or Infinity.
  for (const [k, v] of Object.entries(r.hangar)) if (isId(k) && Number.isFinite(v) && (v as number) >= 1) hangar[k] = Math.floor(v as number);
  const valid = (list: unknown[]) => list.map((x) => (isId(x) ? x : null));
  // By type, so a save made before a layout changed keeps every module; what has no slot goes to the hangar.
  const placed = placeByType(layoutOf(hull), valid(r.fitted));
  const fitted = placed.slots;
  for (const extra of placed.overflow) put(hangar, extra);
  const loadouts: FittingState['loadouts'] = {};
  if (r.loadouts && typeof r.loadouts === 'object') {
    for (const [k, v] of Object.entries(r.loadouts)) {
      if (Object.hasOwn(SLOT_LAYOUTS, k) && Array.isArray(v)) loadouts[k as HullId] = placeByType(layoutOf(k as HullId), valid(v)).slots;
    }
  }
  return {hangar, fitted, loadouts};
}
