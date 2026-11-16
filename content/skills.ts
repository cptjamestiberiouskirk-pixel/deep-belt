// Skill catalog (design/content-tree.md 4.5, step 5): each skill's category, rank
// and prerequisites. Training time is the level's time × rank, so the four
// existing skills, all rank 1, keep their times. A new skill is a new entry here.
//
// The bonus each level gives stays in App.tsx's SKILL_DEFINITIONS for now.

export type SkillId = 'mining' | 'gunnery' | 'shieldOp' | 'navigation';
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
  gunnery: {id: 'gunnery', name: 'Gunnery', category: 'Gunnery', rank: 1, prerequisites: []},
  shieldOp: {id: 'shieldOp', name: 'Shield Operation', category: 'Defense', rank: 1, prerequisites: []},
  navigation: {id: 'navigation', name: 'Navigation', category: 'Navigation', rank: 1, prerequisites: []},
};

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
