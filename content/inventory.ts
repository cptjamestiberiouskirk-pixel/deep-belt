// The ship's hold as one saved map, `inventory: Record<ItemId, number>`
// (design/content-tree.md 4.3 and 4.4, step 4). Items move into it one group at
// a time: the lenses (step 4), the three drones (step 19), the colony goods
// (step 20), the Rift goods (step 21), the Vael ores (step 22), then the
// manufactured components (step 23), then the refined bars (step 24). A moved
// item's old `cargoXxx` save key is no longer written.
//
// Loading follows 4.4: an item present in `inventory` wins, even at 0; its old
// key is read only when `inventory` doesn't have it yet.

import {LENS_IDS} from './lenses';

export type Inventory = Partial<Record<string, number>>;

/** The drones a hull carries in its hold, in the order the Drones panel lists them. */
export const DRONE_IDS = ['extractDrone', 'defenseDrone', 'salvageDrone'] as const;

/** Colony goods: the Command Hub that founds a colony, and the materials it builds with. */
export const COLONY_GOOD_IDS = ['commandHub', 'polymer', 'chemical', 'polymerComposite'] as const;

/** Rift goods: the Rift Sync key that opens a Rift run, and the pristine ores a run yields. */
export const RIFT_GOOD_IDS = ['riftSync', 'pristinePrismite', 'pristineNimbus', 'pristineRadflux'] as const;

/** Vael ores: Prismite, Nimbus and Radflux as mined, and their packed forms. */
export const VAEL_ORE_IDS = ['prismite', 'nimbus', 'radflux', 'packedPrismite', 'packedNimbus', 'packedRadflux'] as const;

/** Manufactured components: what the Fabricator builds from refined ore and turns into modules and hulls. */
export const COMPONENT_IDS = ['hullPlate', 'thrusterCoil', 'sensorCore', 'latticeAlloy', 'conductiveMesh', 'thermalAlloy', 'quantumCore', 'integritySeal', 'thermalGrid'] as const;

/** Refined bars: what the station refinery makes from the base ores. */
export const REFINED_BAR_IDS = ['tritanium', 'auriteConc', 'chromiteBar', 'pyroxite'] as const;

/** Items saved in `inventory`, with the old save key each one replaces. */
export const INVENTORY_ITEMS: Record<string, string> = Object.fromEntries(
  [...LENS_IDS, ...DRONE_IDS, ...COLONY_GOOD_IDS, ...RIFT_GOOD_IDS, ...VAEL_ORE_IDS, ...COMPONENT_IDS, ...REFINED_BAR_IDS].map((id) => [id, `cargo${id[0].toUpperCase()}${id.slice(1)}`]),
);

const count = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null);

/** One item's quantity from a loaded save, or null when the save has neither key. */
export function readItem(data: {inventory?: unknown; [key: string]: unknown}, id: string): number | null {
  const inv = data.inventory && typeof data.inventory === 'object' ? (data.inventory as Record<string, unknown>) : {};
  if (id in inv) return count(inv[id]) ?? 0;
  const legacy = INVENTORY_ITEMS[id];
  return legacy ? count(data[legacy]) : null;
}
