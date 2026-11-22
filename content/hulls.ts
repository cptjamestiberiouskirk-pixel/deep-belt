// Hull catalog: every flyable hull, its base stats and how many module slots it has.
// Moved from constants.ts unchanged (content-tree step 1); constants.ts re-exports it.
//
// Step 27 (design/content-tree.md 4.6): each hull has a class, and a class can
// have a skill to fly it. The skill gates buying a hull of that class, never
// boarding one already owned, and each level adds to that class's base hold.

import {prerequisiteText, type SkillId} from './skills';

export type HullId = 'ferrier' | 'tern' | 'skirmisher' | 'lattice' | 'shade' | 'gantry';
export type HullClass = 'Frigate' | 'Hauler' | 'Industrial' | 'Command';

export interface HullDefinition {
  id: HullId;
  name: string;
  hullClass: HullClass;
  /** The skill level needed to buy or build this hull. Boarding one already owned needs none. */
  requires?: {skill: SkillId; level: number};
  role?: string;
  craftOnly?: boolean;
  cost: number;
  cargo: number;
  baseCargo: number;
  cap: number;
  baseCap: number;
  shield: number;
  baseShield: number;
  armor: number;
  baseArmor: number;
  hull: number;
  baseHull: number;
  slots: number;
  spriteKey: string;
  perkText?: string;
  perk?: string;
  desc?: string;
}

export const HULL_DEFINITIONS: HullDefinition[] = [
  {
    id: 'ferrier',
    name: 'Ferrier',
    hullClass: 'Frigate',
    role: 'Mining Frigate',
    cost: 0,
    cargo: 600,
    baseCargo: 600,
    cap: 100,
    baseCap: 100,
    shield: 100,
    baseShield: 100,
    armor: 80,
    baseArmor: 80,
    hull: 60,
    baseHull: 60,
    slots: 4,
    spriteKey: 'player_ship',
    perkText: 'Balanced industrial frigate with 4 flexible module slots.',
    desc: 'Balanced industrial frigate with 4 flexible module slots.',
  },
  {
    id: 'tern',
    name: 'Tern',
    hullClass: 'Hauler',
    requires: {skill: 'haulerPiloting', level: 1},
    role: 'Heavy Hauler',
    cost: 2200,
    cargo: 1200,
    baseCargo: 1200,
    cap: 80,
    baseCap: 80,
    shield: 90,
    baseShield: 90,
    armor: 70,
    baseArmor: 70,
    hull: 50,
    baseHull: 50,
    slots: 3,
    spriteKey: 'player_ship_tern',
    perkText: 'High-capacity cargo hold (1,200 m³). Fitted with 3 module slots.',
    desc: 'High-capacity cargo hold (1,200 m³). Fitted with 3 module slots.',
  },
  {
    id: 'skirmisher',
    name: 'Skirmisher',
    hullClass: 'Frigate',
    role: 'Combat Frigate',
    cost: 2800,
    cargo: 300,
    baseCargo: 300,
    cap: 120,
    baseCap: 120,
    shield: 140,
    baseShield: 140,
    armor: 90,
    baseArmor: 90,
    hull: 70,
    baseHull: 70,
    slots: 4,
    spriteKey: 'player_ship_skirmisher',
    perkText: '+25% weapon damage. Heavy military shielding.',
    desc: '+25% weapon damage. Heavy military shielding.',
  },
  {
    id: 'lattice',
    name: 'Lattice Tender',
    hullClass: 'Industrial',
    requires: {skill: 'industrialPiloting', level: 1},
    role: 'Industrial Tender',
    craftOnly: true,
    cost: 0,
    cargo: 900,
    baseCargo: 900,
    cap: 110,
    baseCap: 110,
    shield: 110,
    baseShield: 110,
    armor: 90,
    baseArmor: 90,
    hull: 80,
    baseHull: 80,
    slots: 4,
    spriteKey: 'player_ship_lattice',
    perkText: 'Advanced industrial tender assembled from quantum lattice components. Features heavy 900 m³ cargo capacity and balanced defensive grid.',
    desc: 'Advanced industrial tender assembled from quantum lattice components. Features heavy 900 m³ cargo capacity and balanced defensive grid.',
  },
  {
    id: 'shade',
    name: 'Shade Skiff',
    hullClass: 'Frigate',
    role: 'Stealth Extractor',
    cost: 3500,
    cargo: 400,
    baseCargo: 400,
    cap: 90,
    baseCap: 90,
    shield: 80,
    baseShield: 80,
    armor: 55,
    baseArmor: 55,
    hull: 45,
    baseHull: 45,
    slots: 3,
    craftOnly: false,
    spriteKey: 'player_ship_shade',
    desc: 'Lightweight stealth reconnaissance extractor engineered for low sensor profile. Reduces detection signature to 3.0 km.',
    perk: 'Low signature 3.0 km.',
    perkText: 'Low signature 3.0 km.',
  },
  {
    id: 'gantry',
    name: 'Gantry Command',
    hullClass: 'Command',
    role: 'Industrial Command Flagship',
    craftOnly: true,
    cost: 0,
    cargo: 2000,
    baseCargo: 2000,
    cap: 140,
    baseCap: 140,
    shield: 140,
    baseShield: 140,
    armor: 110,
    baseArmor: 110,
    hull: 120,
    baseHull: 120,
    slots: 5,
    spriteKey: 'player_ship_gantry',
    desc: 'Massive heavy industrial command flagship equipped with high-yield drone control relays and immense 2,000 m³ cavernous hold.',
    perk: 'Drone bandwidth 5. 2,000 m³ hold.',
    perkText: 'Drone bandwidth 5. 2,000 m³ hold.',
  },
];

/** The skill to fly each class that has one so far. Frigates, the starting class, need none. */
export const CLASS_SKILL: Partial<Record<HullClass, SkillId>> = {Hauler: 'haulerPiloting', Industrial: 'industrialPiloting'};

/** Hauler Piloting: each level adds this share of a Hauler's base hold (the Tern's 1,200 m³ is 1,500 at level V). */
export const HAULER_PILOTING_HOLD_PCT = 5;
/** Industrial Piloting: each level adds this share of an Industrial's base hold (the Lattice Tender's 900 m³ is 1,125 at level V). */
export const INDUSTRIAL_PILOTING_HOLD_PCT = 5;

/** Each class skill's share of base hold per level. */
export const CLASS_HOLD_PCT: Partial<Record<HullClass, number>> = {Hauler: HAULER_PILOTING_HOLD_PCT, Industrial: INDUSTRIAL_PILOTING_HOLD_PCT};

/** The Fabricator recipes that build a hull, and the hull each builds. Building one needs that hull's skill. */
export const HULL_RECIPES: Record<string, HullId> = {lattice_tender: 'lattice', gantry_command: 'gantry'};

/** The Gantry's base hold once refitted. */
export const GANTRY_REFIT_HOLD = 2500;

/** A hull's base hold before modules and hardpoints: its catalog hold, the Gantry refit's, plus its class skill's share. */
export function baseHoldAt(hull: HullDefinition, levels: Partial<Record<SkillId, number>>, gantryRefit = false): number {
  const base = hull.id === 'gantry' && gantryRefit ? GANTRY_REFIT_HOLD : hull.baseCargo;
  const skill = CLASS_SKILL[hull.hullClass];
  const level = skill ? (levels[skill] ?? 0) : 0;
  return Math.round(base * (1 + ((CLASS_HOLD_PCT[hull.hullClass] ?? 0) / 100) * level));
}

/** "Industrial Piloting I" when that is needed to build this recipe's hull and not trained, else null (also for a recipe that builds no hull). */
export function missingRecipeSkill(levels: Partial<Record<SkillId, number>>, recipeId: string): string | null {
  const hullId = Object.hasOwn(HULL_RECIPES, recipeId) ? HULL_RECIPES[recipeId] : undefined;
  const hull = hullId && HULL_DEFINITIONS.find((h) => h.id === hullId);
  return hull ? missingHullSkill(levels, hull) : null;
}

/** "Hauler Piloting I" when that is needed to buy this hull and not trained, else null. */
export function missingHullSkill(levels: Partial<Record<SkillId, number>>, hull: HullDefinition): string | null {
  const req = hull.requires;
  return req && (levels[req.skill] ?? 0) < req.level ? prerequisiteText([req]) : null;
}
