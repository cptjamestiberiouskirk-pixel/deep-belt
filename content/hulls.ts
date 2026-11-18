// Hull catalog: every flyable hull, its base stats and how many module slots it has.
// Moved from constants.ts unchanged (content-tree step 1); constants.ts re-exports it.

export type HullId = 'ferrier' | 'tern' | 'skirmisher' | 'lattice' | 'shade' | 'gantry';

export interface HullDefinition {
  id: HullId;
  name: string;
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
