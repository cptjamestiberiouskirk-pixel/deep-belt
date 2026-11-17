// Skill catalog (design/content-tree.md 4.5, step 5): each skill's category, rank
// and prerequisites. Training time is the level's time × rank, so the four
// existing skills, all rank 1, keep their times. A new skill is a new entry here.
//
// The bonus each level gives stays in App.tsx's SKILL_DEFINITIONS for now.

export type SkillId = 'mining' | 'laserTuning' | 'lowProfile' | 'gunnery' | 'chargeControl' | 'shieldOp' | 'boosterEfficiency' | 'navigation' | 'cargoTrim';
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
  navigation: {id: 'navigation', name: 'Navigation', category: 'Navigation', rank: 1, prerequisites: []},
  // Step 9: a loaded hold slows and handles less. Rank 2, after Navigation II.
  cargoTrim: {id: 'cargoTrim', name: 'Cargo Trim', category: 'Navigation', rank: 2, prerequisites: [{skill: 'navigation', level: 2}]},
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

/** Ferrite sold at once without drawing Notice, before Low Profile. */
export const NOTICE_FREE_FERRITE = 200;
/** Notice for each Ferrite sold beyond the free amount (100 Notice brings a raider wave). */
export const NOTICE_PER_FERRITE = 3;
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
