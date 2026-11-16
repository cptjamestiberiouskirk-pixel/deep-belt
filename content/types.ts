// Shared shapes for the content catalog (design/content-tree.md, section 4.1).
// Data only: no React, no game state.

export type Category = 'ore' | 'material' | 'component' | 'module' | 'lens' | 'drone' | 'hull' | 'blueprint';

/** A number a module or lens changes. Units are in the name. */
export type StatId =
  | 'oreYield' // ore per mining cycle
  | 'cycleSec' // seconds per cycle
  | 'cargoM3' // hold space added
  | 'shieldHpPerSec' // shield restored per second while active
  | 'damage' // damage per shot
  | 'rangeKm' // optimal range
  | 'capPerCycle'; // capacitor used per cycle

export interface ItemDef {
  id: string;
  name: string;
  category: Category;
  group: string;
  tier: 1 | 2 | 3;
  /** m³ in the hold. */
  volume: number;
  /** MARKS. Station prices scale from this. */
  basePrice: number;
  desc: string;
}

export type SlotType = 'extraction' | 'utility' | 'weapon';

export interface ModuleDef extends ItemDef {
  category: 'module';
  slot: SlotType;
  stats: Partial<Record<StatId, number>>;
  /** Short stat line on the market card, e.g. "+500 hold". */
  statBadge: string;
  /** Image key in the asset manifest. */
  icon: string;
}

export interface LensDef extends ItemDef {
  category: 'lens';
  /** Extra yield on matched ore: 0.4 is +40%. */
  yieldBonus: number;
  /** Ores the lens boosts, as shown on the Fitting screen. */
  matches: string;
  /** Mining cycles before the lens wears out. */
  charges: number;
}
