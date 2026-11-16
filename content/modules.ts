// Module catalog: today's four slot modules, with the names, prices and stats
// the market and Fitting screen show (design/content-tree.md, step 1).
//
// Since step 2 the game reads these stats from whatever is fitted
// (content/fitting.ts fittedWith / fittedTotal), so a number changes here only.

import {EXPANDER_BONUS} from '../constants';
import type {ModuleDef} from './types';

export type ModuleId = 'miner_mk1' | 'miner_mk2' | 'expanded_hold' | 'shield_booster' | 'light_cannon';

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
};

/** The `upgrades` flag that records owning each buyable module (step 2 replaces these). */
export const MODULE_UPGRADE_KEY = {
  miner_mk2: 'laserMk2',
  expanded_hold: 'cargoExpanded',
  shield_booster: 'shieldBoosterHeavy',
  light_cannon: 'cannon',
} as const;

/** The module in the mining slot, given whether the MK2 is owned. */
export function minerFor(ownsMk2: boolean): ModuleDef {
  return ownsMk2 ? MODULES.miner_mk2 : MODULES.miner_mk1;
}
