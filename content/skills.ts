// Skill catalog (design/content-tree.md 4.5, step 5): each skill's category, rank
// and prerequisites. Training time is the level's time × rank, so the four
// existing skills, all rank 1, keep their times. A new skill is a new entry here.
//
// The bonus each level gives stays in App.tsx's SKILL_DEFINITIONS for now.

export type SkillId = 'mining' | 'laserTuning' | 'gunnery' | 'chargeControl' | 'shieldOp' | 'navigation' | 'cargoTrim';
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
  gunnery: {id: 'gunnery', name: 'Gunnery', category: 'Gunnery', rank: 1, prerequisites: []},
  // Step 7, the first new skill: less Cap per weapon shot, so a weapon keeps
  // firing while a shield booster runs. Rank 2, after Gunnery III.
  chargeControl: {id: 'chargeControl', name: 'Charge Control', category: 'Gunnery', rank: 2, prerequisites: [{skill: 'gunnery', level: 3}]},
  shieldOp: {id: 'shieldOp', name: 'Shield Operation', category: 'Defense', rank: 1, prerequisites: []},
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

/** Charge Control: each level cuts a weapon shot's Cap by this share. */
export const CHARGE_CONTROL_CUT = 0.08;

/** A weapon shot's Cap at a Charge Control level, in whole Cap: 14 at level 0, 8 at level 5. */
export function weaponCapPerShot(baseCap: number, chargeControlLevel: number): number {
  return Math.round(baseCap * (1 - CHARGE_CONTROL_CUT * chargeControlLevel));
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
