// Lens catalog: the three mining lenses (design/content-tree.md, step 1).
// constants.ts reads names, prices and volumes from here.

import type {LensDef} from './types';

export type LensId = 'silicateLens' | 'metallicLens' | 'exoticLens';

export const LENSES: Record<LensId, LensDef> = {
  silicateLens: {
    id: 'silicateLens',
    name: 'Silicate Lens',
    category: 'lens',
    group: 'Mining lenses',
    tier: 1,
    volume: 1,
    basePrice: 800,
    yieldBonus: 0.4,
    matches: 'Ferrite, Pyroxite',
    charges: 25,
    desc: 'Boosts yield on Ferrite and Pyroxite.',
  },
  metallicLens: {
    id: 'metallicLens',
    name: 'Metallic Lens',
    category: 'lens',
    group: 'Mining lenses',
    tier: 1,
    volume: 1,
    basePrice: 1200,
    yieldBonus: 0.4,
    matches: 'Aurite, Chromite',
    charges: 25,
    desc: 'Boosts yield on Aurite and Chromite.',
  },
  exoticLens: {
    id: 'exoticLens',
    name: 'Exotic Lens',
    category: 'lens',
    group: 'Mining lenses',
    tier: 1,
    volume: 1,
    basePrice: 2400,
    yieldBonus: 0.5,
    matches: 'Prismite, Nimbus, Radflux, Rare Ore',
    charges: 25,
    desc: 'Boosts yield on exotic and rare ore.',
  },
};

export const LENS_IDS: LensId[] = ['silicateLens', 'metallicLens', 'exoticLens'];

/** "+40% yield", as the Fitting screen shows it. */
export function lensBonusLabel(lens: LensDef): string {
  return `+${Math.round(lens.yieldBonus * 100)}% yield`;
}
