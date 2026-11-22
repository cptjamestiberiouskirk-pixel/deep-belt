import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {CARGO_TRIM_CUT, effectiveLoad, FULL_HOLD_SPEED_CUT, prerequisiteText, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 9 of design/content-tree.md: Cargo Trim, a Navigation skill. A loaded
// hold slows the ship (top speed, thrust, turning, braking, warp spool); each
// level cuts that effect by 15%. Rank 2, after Navigation II.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (navigation: number, cargoTrim = 0) => ({skills: {mining: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, navigation, cargoTrim}});

test('catalog: Cargo Trim is a rank 2 Navigation skill after Navigation II, cutting the load effect 15% a level', () => {
  expect(SKILLS.cargoTrim).toEqual({
    id: 'cargoTrim',
    name: 'Cargo Trim',
    category: 'Navigation',
    rank: 2,
    prerequisites: [{skill: 'navigation', level: 2}],
  });
  expect(prerequisiteText(unmetPrerequisites({navigation: 1}, 'cargoTrim'))).toBe('Navigation II');
  expect(unmetPrerequisites({navigation: 2}, 'cargoTrim')).toEqual([]);
  expect(CARGO_TRIM_CUT).toBe(0.15);
  expect(FULL_HOLD_SPEED_CUT).toBe(0.3);
  // A full hold, as the ship handles it, at levels 0 to 5: at V like a quarter-full hold.
  const full = [0, 1, 2, 3, 4, 5].map((l) => effectiveLoad(1, l));
  [1, 0.85, 0.7, 0.55, 0.4, 0.25].forEach((v, l) => expect(full[l], `level ${l}`).toBeCloseTo(v));
  expect(effectiveLoad(0.5, 5)).toBeCloseTo(0.125);
  expect(effectiveLoad(0, 3)).toBe(0);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('skills screen: before Navigation II Cargo Trim says what it needs; at Navigation II it queues for 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(1)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  const nav = page.getByTestId('skill-category-Navigation');
  await expect(nav).toContainText('CARGO TRIM');
  await expect(nav).toContainText('Needs: Navigation II');
  await expect(nav.getByRole('button', {name: 'NEEDS NAVIGATION II'})).toBeDisabled();
  expectClean(problems);
});

test('skills screen: at Navigation II, Cargo Trim I queues for 100 MARKS and takes 2:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(2)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  const nav = page.getByTestId('skill-category-Navigation');
  await expect(nav.getByRole('button', {name: /^NEEDS/})).toHaveCount(0);
  // The cards give the speed a ship reaches (content/flight.ts), not the 320 cap:
  // Navigation II, 220 × 1.2 × 0.4 = 105.6 px/s = 2.11 km/s; untrained Cargo Trim, a full hold costs 40%.
  await expect(nav).toContainText('+20% top speed (2.11 km/s)');
  await expect(nav).toContainText('full hold: -40% top speed');
  // Scoped to the card: Industrial Piloting, also rank 2 in Navigation, has the same LVL I button.
  await page.getByTestId('skill-card-cargoTrim').getByRole('button', {name: 'LVL I (100 MARKS • 2:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'cargoTrim', targetLevel: 1, duration: 120, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('ship stats: Cargo Trim V with a Bulk Hold, a full hold costs 10% top speed, not 40%', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS_AT(2, 5),
    fitting: {hangar: {}, fitted: ['miner_mk1', 'bulk_hold', null, 'light_cannon'], loadouts: {}},
  });
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  // Top speed is 0.4 × thrust (content/flight.ts). Navigation II: 220 × 1.2 × 0.8 for the
  // Bulk Hold = 211.2 thrust, 84.48 px/s = 1.69 km/s. A full hold at Cargo Trim V: × (1 − 0.4 × 0.25) = 76.03 px/s = 1.52 km/s.
  // Each row's value holds its change in a nested span, so match the row as a whole.
  const row = (label: string) => page.getByText(label, {exact: true}).locator('..');
  await expect(row('Max speed')).toHaveText('Max speed1.69 km/s(-20%)');
  await expect(row('Speed, full hold')).toHaveText('Speed, full hold1.52 km/s(-10%)');
  expectClean(problems);
});
