// Module catalog: today's four slot modules, with the names, prices and stats
// the market and Fitting screen show (design/content-tree.md, step 1).
//
// Since step 2 the game reads these stats from whatever is fitted
// (content/fitting.ts fittedWith / fittedTotal), so a number changes here only.

import {EXPANDER_BONUS} from '../constants';
import {prerequisiteText, type SkillId} from './skills';
import type {ModuleDef} from './types';

export type ModuleId =
  | 'miner_mk1'
  | 'miner_mk2'
  | 'expanded_hold'
  | 'expanded_hold_ii'
  | 'bulk_hold'
  | 'shield_booster'
  | 'shield_booster_ii'
  | 'composite_armor'
  | 'composite_armor_ii'
  | 'fire_control'
  | 'fire_control_ii'
  | 'light_cannon'
  | 'lance_driver';

/** Expanded Hold II's hold space in m³ (step 36): half as much again as the first tier's 500. */
export const EXPANDED_HOLD_II_BONUS = 750;
/** Composite Armor's armor HP (step 12). */
export const COMPOSITE_ARMOR_HP = 100;
/** Composite Armor II's armor HP (step 34): half as much again as the first tier. */
export const COMPOSITE_ARMOR_II_HP = 150;
/** Fire Control Relay's weapon damage bonus, in percent (step 16). */
export const FIRE_CONTROL_DAMAGE_PCT = 20;
/** Fire Control Relay II's weapon damage bonus, in percent (step 35). */
export const FIRE_CONTROL_II_DAMAGE_PCT = 30;

export const MODULES: Record<ModuleId, ModuleDef> = {
  miner_mk1: {
    id: 'miner_mk1',
    name: 'Miner MK1',
    category: 'module',
    group: 'Mining lasers',
    tier: 1,
    volume: 0,
    basePrice: 0,
    slot: 'extraction',
    stats: {oreYield: 50, cycleSec: 10, capPerCycle: 12},
    statBadge: '50 ore / 10s',
    desc: 'Standard mining laser. Cycles in 10s with 50 base extraction.',
    icon: 'module_mining_laser_icon',
  },
  miner_mk2: {
    id: 'miner_mk2',
    name: 'Miner MK2',
    category: 'module',
    group: 'Mining lasers',
    tier: 2,
    volume: 0,
    basePrice: 1200,
    slot: 'extraction',
    stats: {oreYield: 75, cycleSec: 8, capPerCycle: 12},
    statBadge: '+50% yield',
    desc: 'High-power mining laser. Cycles in 8s with 75 base extraction.',
    icon: 'module_mining_laser_icon',
  },
  expanded_hold: {
    id: 'expanded_hold',
    name: 'Expanded Hold',
    category: 'module',
    group: 'Cargo expanders',
    tier: 1,
    volume: 0,
    basePrice: 850,
    slot: 'utility',
    stats: {cargoM3: EXPANDER_BONUS},
    statBadge: `+${EXPANDER_BONUS} hold`,
    desc: `Storage pods expanding hold capacity by +${EXPANDER_BONUS} units.`,
    icon: 'module_cargo_expander_icon',
    // Up to three: the most utility slots any hull has (the Gantry). Doubles add up.
    maxOwned: 3,
  },
  // Step 36: the tier step of the Expanded Hold (rule 3), a straight upgrade
  // behind Navigation V. One only. The Bulk Hold stays the side-grade: more
  // space, no skill, for 20% speed.
  expanded_hold_ii: {
    id: 'expanded_hold_ii',
    name: 'Expanded Hold II',
    category: 'module',
    group: 'Cargo expanders',
    tier: 2,
    volume: 0,
    basePrice: 2125,
    slot: 'utility',
    stats: {cargoM3: EXPANDED_HOLD_II_BONUS},
    statBadge: `+${EXPANDED_HOLD_II_BONUS} hold`,
    desc: `Reinforced storage pods expanding hold capacity by +${EXPANDED_HOLD_II_BONUS} units, with no loss of speed.`,
    icon: 'module_cargo_expander_icon',
    requires: {skill: 'navigation', level: 5},
  },
  // Step 8: a side-grade to the Expanded Hold. Almost twice the space in one
  // slot, for 20% less top speed and thrust, so a hauler is easier to catch.
  // One only: the slowdown does not stack.
  bulk_hold: {
    id: 'bulk_hold',
    name: 'Bulk Hold',
    category: 'module',
    group: 'Cargo expanders',
    tier: 2,
    volume: 0,
    basePrice: 1600,
    slot: 'utility',
    stats: {cargoM3: 900, speedPct: -20},
    statBadge: '+900 hold, -20% speed',
    desc: 'Bolt-on ore bunker: +900 hold units, but the extra mass cuts top speed and thrust by 20%.',
    icon: 'module_cargo_expander_icon',
  },
  shield_booster: {
    id: 'shield_booster',
    name: 'Shield Booster',
    category: 'module',
    group: 'Shield boosters',
    tier: 1,
    volume: 0,
    basePrice: 950,
    slot: 'utility',
    stats: {shieldHpPerSec: 8, cycleSec: 3, capPerCycle: 25},
    statBadge: '+8 HP/s pulse',
    desc: 'Matrix generator restoring 8 shield HP per second on active cycle.',
    icon: 'module_shield_booster_icon',
    // Up to three: the most utility slots any hull has (the Gantry). Doubles add up.
    maxOwned: 3,
  },
  // Step 33: the tier step of the Shield Booster (rule 3: a straight upgrade that
  // costs a skill level). Half as much shield again for the same Cap and cycle,
  // behind Shield Operation V: at least 31 minutes of training, past the opening.
  // One only; doubles of it would be a later, probed step.
  shield_booster_ii: {
    id: 'shield_booster_ii',
    name: 'Shield Booster II',
    category: 'module',
    group: 'Shield boosters',
    tier: 2,
    volume: 0,
    basePrice: 2400,
    slot: 'utility',
    stats: {shieldHpPerSec: 12, cycleSec: 3, capPerCycle: 25},
    statBadge: '+12 HP/s pulse',
    desc: 'Tuned matrix generator restoring 12 shield HP per second on active cycle, for the same capacitor as the Shield Booster.',
    icon: 'module_shield_booster_icon',
    requires: {skill: 'shieldOp', level: 5},
  },
  // Step 12: a side-grade to the Shield Booster. Flat armor that uses no Cap and
  // needs no activation, so a Cap-hungry weapon keeps firing; but armor never
  // regenerates, and the station charges for every point repaired. One only.
  composite_armor: {
    id: 'composite_armor',
    name: 'Composite Armor',
    category: 'module',
    group: 'Armor',
    tier: 1,
    volume: 0,
    basePrice: 900,
    slot: 'utility',
    stats: {armorHp: COMPOSITE_ARMOR_HP},
    statBadge: `+${COMPOSITE_ARMOR_HP} armor`,
    desc: `Layered ceramic and alloy plating: +${COMPOSITE_ARMOR_HP} armor HP. Uses no capacitor, but armor does not regenerate in space; docking repairs it.`,
    icon: 'module_armor_plate',
  },
  // Step 34: the tier step of Composite Armor (rule 3), a straight upgrade behind
  // Armor Layering V. One only.
  composite_armor_ii: {
    id: 'composite_armor_ii',
    name: 'Composite Armor II',
    category: 'module',
    group: 'Armor',
    tier: 2,
    volume: 0,
    basePrice: 2250,
    slot: 'utility',
    stats: {armorHp: COMPOSITE_ARMOR_II_HP},
    statBadge: `+${COMPOSITE_ARMOR_II_HP} armor`,
    desc: `Denser layered plating: +${COMPOSITE_ARMOR_II_HP} armor HP. Uses no capacitor, but armor does not regenerate in space; docking repairs it.`,
    icon: 'module_armor_plate',
    requires: {skill: 'armorLayering', level: 5},
  },
  // Step 16: an offense side-grade for a utility slot. Raider waves cost HP for as
  // long as they last, so more damage shortens them; but the slot then holds no
  // hold space, booster or armor. One only.
  fire_control: {
    id: 'fire_control',
    name: 'Fire Control Relay',
    category: 'module',
    group: 'Fire control',
    tier: 1,
    volume: 0,
    basePrice: 1100,
    slot: 'utility',
    stats: {damagePct: FIRE_CONTROL_DAMAGE_PCT},
    statBadge: `+${FIRE_CONTROL_DAMAGE_PCT}% weapon damage`,
    desc: `Targeting relay that times each shot to the hull's weak points: +${FIRE_CONTROL_DAMAGE_PCT}% damage from the fitted weapon. Takes a utility slot from the hold, booster or armor.`,
    icon: 'module_sensor',
  },
  // Step 35: the tier step of the Fire Control Relay (rule 3), a straight upgrade
  // behind Gunnery V. One only.
  fire_control_ii: {
    id: 'fire_control_ii',
    name: 'Fire Control Relay II',
    category: 'module',
    group: 'Fire control',
    tier: 2,
    volume: 0,
    basePrice: 2750,
    slot: 'utility',
    stats: {damagePct: FIRE_CONTROL_II_DAMAGE_PCT},
    statBadge: `+${FIRE_CONTROL_II_DAMAGE_PCT}% weapon damage`,
    desc: `Finer targeting relay that leads each shot onto the hull's weak points: +${FIRE_CONTROL_II_DAMAGE_PCT}% damage from the fitted weapon. Takes a utility slot from the hold, booster or armor.`,
    icon: 'module_sensor',
    requires: {skill: 'gunnery', level: 5},
  },
  light_cannon: {
    id: 'light_cannon',
    name: 'Light Cannon',
    category: 'module',
    group: 'Projectile weapons',
    tier: 1,
    volume: 0,
    basePrice: 600,
    slot: 'weapon',
    stats: {damage: 30, cycleSec: 3, rangeKm: 8, capPerCycle: 8},
    statBadge: '30 dmg / 3s',
    desc: 'Kinetic turret firing armor-piercing slugs up to 8.0 km optimal range.',
    icon: 'module_cannon_icon',
  },
  // Step 6, the first new module: a longer-range weapon behind Gunnery II.
  // Against the Light Cannon: 11.25 damage/s for 10, 12 km for 8, 3.5 Cap/s for 2.7.
  lance_driver: {
    id: 'lance_driver',
    name: 'Lance Driver',
    category: 'module',
    group: 'Projectile weapons',
    tier: 2,
    volume: 0,
    basePrice: 1500,
    slot: 'weapon',
    stats: {damage: 47, cycleSec: 4, rangeKm: 12, capPerCycle: 14},
    statBadge: '47 dmg / 4s',
    desc: 'Long-barrel mass driver: 47 kinetic damage per slug out to 12.0 km optimal range.',
    icon: 'module_cannon_icon',
    requires: {skill: 'gunnery', level: 2},
  },
};

/** The modules the station market sells, in catalog order: every module with a price. */
export const MARKET_MODULE_IDS = (Object.keys(MODULES) as ModuleId[]).filter((id) => MODULES[id].basePrice > 0);

/** "Gunnery II" while the pilot lacks the skill a module needs, else null. */
export function missingSkill(levels: Partial<Record<SkillId, number>>, id: ModuleId): string | null {
  const req = MODULES[id].requires;
  return req && (levels[req.skill] ?? 0) < req.level ? prerequisiteText([req]) : null;
}

/** The module in the mining slot, given whether the MK2 is owned. */
export function minerFor(ownsMk2: boolean): ModuleDef {
  return ownsMk2 ? MODULES.miner_mk2 : MODULES.miner_mk1;
}
