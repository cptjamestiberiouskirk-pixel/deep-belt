// The ship's hold as one saved map, `inventory: Record<ItemId, number>`
// (design/content-tree.md 4.3 and 4.4, step 4). Items move into it one group at
// a time: the lenses first (step 4), then the three drones (step 19). A moved
// item's old `cargoXxx` save key is no longer written.
//
// Loading follows 4.4: an item present in `inventory` wins, even at 0; its old
// key is read only when `inventory` doesn't have it yet.

import {LENS_IDS} from './lenses';

export type Inventory = Partial<Record<string, number>>;

/** The drones a hull carries in its hold, in the order the Drones panel lists them. */
export const DRONE_IDS = ['extractDrone', 'defenseDrone', 'salvageDrone'] as const;

/** Items saved in `inventory`, with the old save key each one replaces. */
export const INVENTORY_ITEMS: Record<string, string> = Object.fromEntries(
  [...LENS_IDS, ...DRONE_IDS].map((id) => [id, `cargo${id[0].toUpperCase()}${id.slice(1)}`]),
);

const count = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null);

/** One item's quantity from a loaded save, or null when the save has neither key. */
export function readItem(data: {inventory?: unknown; [key: string]: unknown}, id: string): number | null {
  const inv = data.inventory && typeof data.inventory === 'object' ? (data.inventory as Record<string, unknown>) : {};
  if (id in inv) return count(inv[id]) ?? 0;
  const legacy = INVENTORY_ITEMS[id];
  return legacy ? count(data[legacy]) : null;
}
