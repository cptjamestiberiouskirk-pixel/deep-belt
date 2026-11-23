// Skill catalog (design/content-tree.md 4.5, step 5): each skill's category, rank
// and prerequisites. Training time is the level's time × rank, so the four
// existing skills, all rank 1, keep their times. A new skill is a new entry here.
//
// The bonus each level gives stays in App.tsx's SKILL_DEFINITIONS for now.

export type SkillId = 'mining' | 'laserTuning' | 'lowProfile' | 'gunnery' | 'chargeControl' | 'shieldOp' | 'boosterEfficiency' | 'armorLayering' | 'navigation' | 'cargoTrim' | 'haulerPiloting' | 'industrialPiloting' | 'commandPiloting' | 'refining' | 'droneOperation' | 'exoticPacking' | 'signalAnalysis';
export type SkillCategory = 'Extraction' | 'Gunnery' | 'Defense' | 'Navigation' | 'Industry' | 'Science';

export interface SkillDef {
  id: SkillId;
  name: string;
  category: SkillCategory;
  /** Training time multiplier. */
  rank: 1 | 2 | 3;
  prerequisites: Array<{skill: SkillId; level: number}>;
}

/** The Skills screen lists categories in this order, each only once it has a skill. */
export const SKILL_CATEGORY_ORDER: SkillCategory[] = ['Extraction', 'Gunnery', 'Defense', 'Navigation', 'Industry', 'Science'];

export const SKILLS: Record<SkillId, SkillDef> = {
  mining: {id: 'mining', name: 'Mining', category: 'Extraction', rank: 1, prerequisites: []},
  // Step 10: a shorter mining cycle, so ore comes faster. Rank 2, after Mining III.
  laserTuning: {id: 'laserTuning', name: 'Laser Tuning', category: 'Extraction', rank: 2, prerequisites: [{skill: 'mining', level: 3}]},
  // Step 11: less Notice from ore sales and mining, so fewer raider waves. Rank 2,
  // after Mining II. (A warp spool skill was dropped first: the probe found a
  // shorter spool saves no HP, and raiders catch up after an in-system warp.)
  lowProfile: {id: 'lowProfile', name: 'Low Profile', category: 'Extraction', rank: 2, prerequisites: [{skill: 'mining', level: 2}]},
  gunnery: {id: 'gunnery', name: 'Gunnery', category: 'Gunnery', rank: 1, prerequisites: []},
  // Step 7, the first new skill: a faster weapon cycle. Rank 2, after Gunnery III.
  // It first cut Cap per shot, which the probe found changed no fight (no fight
  // ran short of Cap), so on 2026-11-16 it became a shorter cycle.
  chargeControl: {id: 'chargeControl', name: 'Charge Control', category: 'Gunnery', rank: 2, prerequisites: [{skill: 'gunnery', level: 3}]},
  shieldOp: {id: 'shieldOp', name: 'Shield Operation', category: 'Defense', rank: 1, prerequisites: []},
  // Step 13: less Cap per Shield Booster cycle, so the booster runs longer. Rank 2,
  // after Shield Operation II. The probe found an active booster ran Cap down to 14.
  boosterEfficiency: {id: 'boosterEfficiency', name: 'Booster Efficiency', category: 'Defense', rank: 2, prerequisites: [{skill: 'shieldOp', level: 2}]},
  // Step 18: more armor HP, fitted armor included. Rank 1, no prerequisites, as a
  // sibling of Shield Operation. The Vael pirate probe found armor decides the
  // fights a Ferrier wins there, and a skill takes no slot from the booster or relay.
  armorLayering: {id: 'armorLayering', name: 'Armor Layering', category: 'Defense', rank: 1, prerequisites: []},
  navigation: {id: 'navigation', name: 'Navigation', category: 'Navigation', rank: 1, prerequisites: []},
  // Step 9: a loaded hold slows and handles less. Rank 2, after Navigation II.
  cargoTrim: {id: 'cargoTrim', name: 'Cargo Trim', category: 'Navigation', rank: 2, prerequisites: [{skill: 'navigation', level: 2}]},
  // Step 27, the first hull class skill: level I is needed to buy a Hauler (the
  // Tern), and each level adds 5% to a Hauler's base hold (content/hulls.ts).
  // Rank 1, no prerequisites. A Tern owned before the skill is still flown.
  haulerPiloting: {id: 'haulerPiloting', name: 'Hauler Piloting', category: 'Navigation', rank: 1, prerequisites: []},
  // Step 28, the second hull class skill: level I is needed to assemble an
  // Industrial (the Lattice Tender) at the Fabricator, and each level adds 5% to
  // an Industrial's base hold. Rank 2, as the Lattice is built from tier-3 parts.
  industrialPiloting: {id: 'industrialPiloting', name: 'Industrial Piloting', category: 'Navigation', rank: 2, prerequisites: []},
  // Step 29, the third hull class skill: level I is needed to assemble a Command
  // hull (the Gantry Command) at the Fabricator, and each level adds 5% to a Command
  // hull's base hold. Rank 3, after Industrial Piloting I: the Gantry is the
  // Industrial line's flagship, built from twice the Lattice's parts and Vael exotics.
  commandPiloting: {id: 'commandPiloting', name: 'Command Piloting', category: 'Navigation', rank: 3, prerequisites: [{skill: 'industrialPiloting', level: 1}]},
  // Step 15, the first Industry skill: more refined goods from each 50 ore. Rank 2,
  // after Mining II. It came after step 14 made refined sales draw Notice.
  refining: {id: 'refining', name: 'Refining', category: 'Industry', rank: 2, prerequisites: [{skill: 'mining', level: 2}]},
  // Step 31, the first drone skill: each level cuts all three drones' work cycle by
  // 5%. Rank 3, after Command Piloting IV, so it stays out of the first 30 minutes
  // (rule 2), where the Harrow Market already sells drones: Command Piloting III can
  // be trained in 23 minutes, IV takes at least 47 (design/content-tree.md 4.5).
  droneOperation: {id: 'droneOperation', name: 'Drone Operation', category: 'Industry', rank: 3, prerequisites: [{skill: 'commandPiloting', level: 4}]},
  // Step 32: each level adds 4% to the sale price of packed exotics (Packed
  // Prismite 900 is 1,080 at V). Rank 2, no prerequisites: no exotic is bought or
  // sold in the scripted first 30 minutes, and none can be bought at all, so the
  // bonus opens no buy-and-sell loop (design/content-tree.md, step 32).
  exoticPacking: {id: 'exoticPacking', name: 'Exotic Packing', category: 'Industry', rank: 2, prerequisites: []},
  // Step 17, the first Science skill: wider target bands in the probe scan sweep,
  // where a scan needs 2 hits of 3 inside bands about 0.36 s wide and a failed scan
  // locks the scanner for 60 s. Rank 1, no prerequisites.
  signalAnalysis: {id: 'signalAnalysis', name: 'Signal Analysis', category: 'Science', rank: 1, prerequisites: []},
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** Each skill's saved level, 0 for one the save doesn't have (a save from before that skill). */
export function skillLevels(saved: unknown): Record<SkillId, number> {
  const from = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<SkillId, unknown>>;
  return Object.fromEntries(
    SKILL_IDS.map((id) => [id, typeof from[id] === 'number' ? (from[id] as number) : 0]),
  ) as Record<SkillId, number>;
}

/** Laser Tuning: each level cuts the mining cycle by this share. */
export const LASER_TUNING_CUT = 0.04;

/** A mining cycle in seconds at a Laser Tuning level, to 0.1 s: the MK1's 10 s is 8 s at level 5. */
export function minerCycleAt(baseSec: number, laserTuningLevel: number): number {
  return Math.round(baseSec * (1 - LASER_TUNING_CUT * laserTuningLevel) * 10) / 10;
}

/** Exotic Packing: each level adds this many percent to a packed exotic's sale price. */
export const PACKING_SALE_PCT = 4;

/** A packed exotic's sale price in whole MARKS at an Exotic Packing level: Packed Prismite's 900 is 1,080 at level 5. */
export function packedSalePriceAt(basePrice: number, exoticPackingLevel: number): number {
  return Math.round(basePrice * (1 + (PACKING_SALE_PCT * exoticPackingLevel) / 100));
}

/** Drone Operation: each level cuts every drone's work cycle by this share. */
export const DRONE_OPERATION_CUT = 0.05;

/** A drone's work cycle in seconds at a Drone Operation level, to 0.1 s: the extraction drone's 10 s is 7.5 s at level 5. */
export function droneCycleAt(baseSec: number, droneOperationLevel: number): number {
  return Math.round(baseSec * (1 - DRONE_OPERATION_CUT * droneOperationLevel) * 10) / 10;
}

/** Ferrite sold at once without drawing Notice, before Low Profile. */
export const NOTICE_FREE_FERRITE = 200;
/** Notice for each Ferrite sold beyond the free amount (100 Notice brings a raider wave). */
export const NOTICE_PER_FERRITE = 3;
/** Ferrite one Tritanium is refined from untrained (50 ore makes 25), so a Tritanium sale draws Notice as that much Ferrite. Refining does not change it. */
export const FERRITE_PER_TRITANIUM = 2;

/** The Ferrite a sale counts for Notice: its raw Ferrite plus the Ferrite its Tritanium was refined from. */
export function noticeFerrite(ferrite: number, tritanium: number): number {
  return ferrite + FERRITE_PER_TRITANIUM * tritanium;
}
/** Low Profile: each level adds this much Ferrite to the free amount (600 at level V). */
export const LOW_PROFILE_FREE_FERRITE = 80;
/** Notice a second while the mining laser runs, before Low Profile. */
export const MINING_NOTICE_PER_SEC = 0.8;
/** Low Profile: each level cuts the mining laser's Notice by this share. */
export const LOW_PROFILE_MINING_CUT = 0.1;

/** Ferrite that sells at once without drawing Notice, at a Low Profile level. */
export function freeFerriteAt(lowProfileLevel: number): number {
  return NOTICE_FREE_FERRITE + LOW_PROFILE_FREE_FERRITE * lowProfileLevel;
}

/** Notice a Ferrite sale adds (before the cap at 100), at a Low Profile level. */
export function saleNotice(ferriteSold: number, lowProfileLevel: number): number {
  return Math.max(0, ferriteSold - freeFerriteAt(lowProfileLevel)) * NOTICE_PER_FERRITE;
}

/** Notice a second while mining, at a Low Profile level: 0.8 at 0, 0.4 at V. */
export function miningNoticePerSec(lowProfileLevel: number): number {
  return Math.round(MINING_NOTICE_PER_SEC * (1 - LOW_PROFILE_MINING_CUT * lowProfileLevel) * 100) / 100;
}

/** Charge Control: each level cuts the weapon cycle by this share. */
export const CHARGE_CONTROL_CUT = 0.04;

/** A weapon cycle in seconds at a Charge Control level, to 0.1 s: the Light Cannon's 3 s is 2.4 s at level 5. */
export function weaponCycleAt(baseSec: number, chargeControlLevel: number): number {
  return Math.round(baseSec * (1 - CHARGE_CONTROL_CUT * chargeControlLevel) * 10) / 10;
}

/** Booster Efficiency: each level cuts the Shield Booster's Cap per cycle by this share. */
export const BOOSTER_EFFICIENCY_CUT = 0.08;

/** Shield Booster Cap per cycle at a Booster Efficiency level, whole Cap: one booster's 25 is 15 at level 5. */
export function boosterCapAt(baseCap: number, boosterEfficiencyLevel: number): number {
  return Math.round(baseCap * (1 - BOOSTER_EFFICIENCY_CUT * boosterEfficiencyLevel));
}

/** Armor Layering: each level adds this share of armor HP, fitted armor included. */
export const ARMOR_LAYERING_PCT = 10;

/** Max armor at an Armor Layering level: a Ferrier's 80 is 120 at level 5, or 270 with Composite Armor's 100. */
export function maxArmorAt(baseArmor: number, fittedArmor: number, armorLayeringLevel: number): number {
  return Math.round((baseArmor + fittedArmor) * (1 + (ARMOR_LAYERING_PCT / 100) * armorLayeringLevel));
}

/** Refined goods from one 50-ore batch, before Refining. */
export const BASE_REFINE_OUTPUT = 25;
/** Refining: each level adds this many refined goods to a batch. */
export const REFINING_BONUS_PER_LEVEL = 1;

/** Refined goods from one 50-ore batch at a Refining level: 25 untrained, 30 at level V. */
export function refineOutputAt(refiningLevel: number): number {
  return BASE_REFINE_OUTPUT + REFINING_BONUS_PER_LEVEL * refiningLevel;
}

/** The probe scan sweep's speed in radians a second (one turn in about 2.4 s). */
export const SCAN_SWEEP_RAD_PER_SEC = 2.6;
/** The scan sweep's three target bands untrained, in radians from the start of the sweep. */
export const SCAN_BANDS: ReadonlyArray<{start: number; end: number}> = [
  {start: 0.78, end: 1.71},
  {start: 2.7, end: 3.66},
  {start: 4.71, end: 5.67},
];
/** Signal Analysis: each level widens every scan band by this share of its arc, about its middle. */
export const SIGNAL_ANALYSIS_WIDEN = 0.1;

/** A scan band at a Signal Analysis level: as wide again by half at level V, about the same middle. */
export function scanBandAt(band: {start: number; end: number}, signalAnalysisLevel: number): {start: number; end: number} {
  // Each edge moves out by half the added width, so untrained the band is exactly as listed.
  const grow = ((band.end - band.start) / 2) * SIGNAL_ANALYSIS_WIDEN * signalAnalysisLevel;
  return {start: band.start - grow, end: band.end + grow};
}

/** Seconds the sweep spends inside a band: ring 1's is 0.36 s untrained and 0.54 s at level V. */
export function scanWindowSec(band: {start: number; end: number}, signalAnalysisLevel: number): number {
  const b = scanBandAt(band, signalAnalysisLevel);
  return Math.round(((b.end - b.start) / SCAN_SWEEP_RAD_PER_SEC) * 100) / 100;
}

/** Cargo Trim: each level cuts the hold's load effect on handling by this share. */
export const CARGO_TRIM_CUT = 0.15;

/** A full hold's cut to top speed, before Cargo Trim. */
export const FULL_HOLD_SPEED_CUT = 0.3;

/**
 * The hold's fill as the ship's handling feels it: the fill (0 to 1) less Cargo
 * Trim's share. At level V a full hold handles like a quarter-full one.
 */
export function effectiveLoad(fill: number, cargoTrimLevel: number): number {
  return fill * (1 - CARGO_TRIM_CUT * cargoTrimLevel);
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** The prerequisites not yet trained, given the trained levels. */
export function unmetPrerequisites(
  levels: Partial<Record<SkillId, number>>,
  id: SkillId,
  catalog: Record<string, SkillDef> = SKILLS,
): SkillDef['prerequisites'] {
  return catalog[id].prerequisites.filter((p) => (levels[p.skill] ?? 0) < p.level);
}

/** "Mining II, Gunnery I": how the Skills screen names prerequisites. */
export function prerequisiteText(prereqs: SkillDef['prerequisites'], catalog: Record<string, SkillDef> = SKILLS): string {
  return prereqs.map((p) => `${catalog[p.skill].name} ${ROMAN[p.level] ?? p.level}`).join(', ');
}
