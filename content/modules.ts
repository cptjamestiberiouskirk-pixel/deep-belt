// Module catalog: today's four slot modules, with the names, prices and stats
// the market and Fitting screen show (design/content-tree.md, step 1).
//
// Since step 2 the game reads these stats from whatever is fitted
// (content/fitting.ts fittedWith / fittedTotal), so a number changes here only.

import {EXPANDER_BONUS} from '../constants';
import {prerequisiteText, type SkillId} from './skills';
import type {ModuleDef} from './types';

export type ModuleId = 'miner_mk1' | 'miner_mk2' | 'expanded_hold' | 'bulk_hold' | 'shield_booster' | 'light_cannon' | 'lance_driver';

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
    desc: 'Long-barrel mass driver: 45 kinetic damage per slug out to 12.0 km optimal range.',
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
