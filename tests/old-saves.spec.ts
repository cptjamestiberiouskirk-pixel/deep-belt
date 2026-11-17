import {expect, test, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {expectClean, expectTitle, LEGACY_SAVE_KEY, readSave, SAVE_KEY, settle, undock, watch} from './helpers';
import {SKILL_IDS} from '../content/skills';

// Saves written by old builds of the game, not seeded by a test: each fixture in
// tests/fixtures/saves/ is the localStorage an old commit's production build left
// after a played session (the training loop, then a second trip that leaves ore in
// the hold, docked). Today's build must load each one and carry on from it.
//   v4-c99f154: the last build before save v5 (yes/no fitting flags, v4 key).
//   v5-ff2f0ac: save v5 after content step 4, before skills had categories.
// To add one: build the old commit, serve it, play it, and copy its deep_belt_* keys.

const FIXTURES = ['v4-c99f154', 'v5-ff2f0ac'];

function fixture(name: string): {keys: Record<string, string>; session: Record<string, any>} {
  const keys = JSON.parse(readFileSync(`tests/fixtures/saves/${name}.json`, 'utf8')) as Record<string, string>;
  const raw = keys[SAVE_KEY] ?? keys[LEGACY_SAVE_KEY];
  return {keys, session: JSON.parse(raw)};
}

/** Puts the old build's localStorage in place before the game's code first runs. */
async function openOldSave(page: Page, keys: Record<string, string>) {
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('old-save-seeded')) return;
    localStorage.clear();
    for (const [key, value] of Object.entries(k)) localStorage.setItem(key, value);
    sessionStorage.setItem('old-save-seeded', '1');
  }, keys);
  await page.goto('/');
  await expectTitle(page);
}

for (const name of FIXTURES) {
  test(`old save ${name}: loads docked with its marks, ore, training and fitting, then sells and flies`, async ({page}) => {
    const problems = watch(page);
    const {keys, session: old} = fixture(name);
    await openOldSave(page, keys);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Docked · safe')).toBeVisible();

    // Loading first copies the old save across as it is; wait for the game's own
    // rewrite, the first save with the fitting model and every skill in it.
    const rewritten = async () => {
      const s = await readSave(page);
      return Boolean(s?.fitting && SKILL_IDS.every((id) => typeof s.skills?.[id] === 'number'));
    };
    await expect.poll(rewritten, {timeout: 30_000}).toBe(true);
    const save = (await readSave(page))!;
    expect(save.marks).toBe(old.marks);
    expect(save.cargoFerrite).toBe(old.cargoFerrite);
    expect(save.cargoFerrite).toBeGreaterThan(0);
    expect(save.tutorialDone).toBe(true);
    // The starting fit, whichever way the old build saved it.
    expect(save.fitting.fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);
    // Skills added since load at 0.
    for (const id of SKILL_IDS) expect(save.skills[id], id).toBe(old.skills?.[id] ?? 0);
    // A v4 save is rewritten as v5 and its old key removed.
    expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_SAVE_KEY)).toBeNull();

    // Carry on: sell the ore, then undock and dock again.
    await settle(page);
    await page.keyboard.press('1');
    await expect(page.getByText(/Sell all/).first()).toBeVisible();
    await settle(page);
    await page.keyboard.press('s');
    await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
    expect((await readSave(page))!.marks).toBeGreaterThan(old.marks);
    await page.keyboard.press('Escape');
    await undock(page);
    // Right after undocking, a key can land in the input debounce; press until it takes.
    await expect(async () => {
      await page.keyboard.press('f');
      await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 1500});
    }).toPass({timeout: 30_000});
    expectClean(problems);
  });
}
