import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {baseHoldAt, CLASS_SKILL, HULL_DEFINITIONS, type HullId} from '../content/hulls';
import type {SkillId} from '../content/skills';

// Step 30 of design/content-tree.md (4.6): boarding an owned hull checks the cargo
// against that hull's hold with its class skill (content/hulls.ts baseHoldAt). At
// level L, cargo 1 m³ over the hold is refused; at level L+1, cargo equal to the
// hold is boarded. So each case pins both sides of the boundary and the skill's share.

const hull = (id: HullId) => HULL_DEFINITIONS.find((h) => h.id === id)!;
const skillOf = (id: HullId) => CLASS_SKILL[hull(id).hullClass] as SkillId;
const holdAt = (id: HullId, level: number) => baseHoldAt(hull(id), {[skillOf(id)]: level});

// One class per case, at different levels, so the cases together cover levels 0 to 5.
const CASES: {id: HullId; refusedAt: number}[] = [
  {id: 'tern', refusedAt: 0},
  {id: 'lattice', refusedAt: 2},
  {id: 'gantry', refusedAt: 4},
];

/** A Ferrier docked with `cargo` Ferrite, owning `owned`, at `level` in `id`'s class skill. */
function seed(id: HullId, level: number, cargo: number, owned: HullId[] = ['ferrier', id]) {
  return {
    ...RICH,
    milestoneIndustrialistClaimed: true,
    // The prerequisite only gates training, not the hold; it is seeded so the save is one a player could reach.
    skills: {industrialPiloting: 1, [skillOf(id)]: level},
    ownedHulls: owned,
    activeHull: 'ferrier',
    fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}},
    cargoFerrite: cargo,
  };
}

async function openHangar(page: Page) {
  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText(/^HANGAR$/).first()).toBeVisible();
  await settle(page);
}

/** Waits for the game's own save (the seed has old cargo keys only), then returns it. */
async function gameSave(page: Page) {
  await expect.poll(async () => (await readSave(page))?.inventory, {timeout: 15_000}).toBeDefined();
  return (await readSave(page))!;
}

test('catalog: the cases\' holds at the refused level and one level up', () => {
  expect(CASES.map(({id, refusedAt}) => [id, holdAt(id, refusedAt), holdAt(id, refusedAt + 1)])).toEqual([
    ['tern', 1200, 1260],
    ['lattice', 990, 1035],
    ['gantry', 2400, 2500],
  ]);
});

for (const {id, refusedAt} of CASES) {
  const below = holdAt(id, refusedAt);
  const full = holdAt(id, refusedAt + 1);

  test(`hangar: ${hull(id).name} with ${below + 1} m³ of cargo is refused at level ${refusedAt} (hold ${below})`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, seed(id, refusedAt, below + 1));
    await enterGame(page);
    await openHangar(page);
    await page.getByTestId(`hangar-hull-${id}`).getByRole('button', {name: /Board/}).click();
    await expect(page.getByText(`Unload cargo first (${below + 1}/${below} m³)`)).toBeVisible();
    const save = await gameSave(page);
    expect(save.activeHull).toBe('ferrier');
    expect(save.inventory.ferrite).toBe(below + 1);
    expectClean(problems);
  });

  test(`hangar: ${hull(id).name} with ${full} m³ of cargo is boarded at level ${refusedAt + 1}, a full hold`, async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, seed(id, refusedAt + 1, full));
    await enterGame(page);
    await openHangar(page);
    await page.getByTestId(`hangar-hull-${id}`).getByRole('button', {name: /Board/}).click();
    await expect(page.getByText(`Boarded ${hull(id).name}`)).toBeVisible();
    await expect.poll(async () => (await readSave(page))?.activeHull).toBe(id);
    expect((await gameSave(page)).inventory.ferrite).toBe(full);
    expectClean(problems);
  });
}

test('hangar: buying a Tern with 1 m³ more cargo than its hold at Hauler Piloting I is refused, and nothing is bought', async ({page}) => {
  const problems = watch(page);
  const hold = holdAt('tern', 1);
  await openWithSave(page, seed('tern', 1, hold + 1, ['ferrier']));
  await enterGame(page);
  const before = await gameSave(page);
  await openHangar(page);
  await page.getByTestId('hangar-hull-tern').getByRole('button', {name: /^Buy$/, disabled: false}).click();
  await expect(page.getByText(`Unload cargo first (${hold + 1}/${hold} m³)`)).toBeVisible();
  const save = await gameSave(page);
  expect(save.ownedHulls).toEqual(['ferrier']);
  expect(save.activeHull).toBe('ferrier');
  expect(save.marks).toBe(before.marks);
  expectClean(problems);
});
