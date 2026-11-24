import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, flyTo, launch, openWithSave, readSave, RICH, SAVE_KEY, selectTarget, settle, tuneLaser, watch} from './helpers';
import {DRONE_CYCLE_SEC} from '../content/inventory';
import {DRONE_OPERATION_CUT, droneCycleAt, prerequisiteText, SKILLS, unmetPrerequisites} from '../content/skills';

// Step 31 of design/content-tree.md: Drone Operation, the first drone skill. Each
// level cuts the work cycle of all three drones by 5% (extraction 10 s is 7.5 s at V;
// defense and salvage 2 s are 1.5 s). Rank 3, after Command Piloting IV, so that it
// cannot be trained inside the first 30 minutes (rule 2), when the Harrow Market
// already sells drones. Untrained, every drone keeps its old cycle.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (droneOperation: number, commandPiloting = 4) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, haulerPiloting: 0, industrialPiloting: 1, commandPiloting, refining: 0, droneOperation, exoticPacking: 0, signalAnalysis: 0, signalRecovery: 0},
});

test('catalog: Drone Operation is a rank 3 Industry skill after Command Piloting IV', () => {
  expect(SKILLS.droneOperation).toEqual({
    id: 'droneOperation',
    name: 'Drone Operation',
    category: 'Industry',
    rank: 3,
    prerequisites: [{skill: 'commandPiloting', level: 4}],
  });
  expect(prerequisiteText(unmetPrerequisites({commandPiloting: 3}, 'droneOperation'))).toBe('Command Piloting IV');
  expect(unmetPrerequisites({commandPiloting: 4}, 'droneOperation')).toEqual([]);
});

test('catalog: each level cuts every drone cycle by 5%, and level 0 keeps the old cycles', () => {
  expect(DRONE_OPERATION_CUT).toBe(0.05);
  expect(DRONE_CYCLE_SEC).toEqual({extractDrone: 10, defenseDrone: 2, salvageDrone: 2});
  expect([0, 1, 2, 3, 4, 5].map((l) => droneCycleAt(DRONE_CYCLE_SEC.extractDrone, l))).toEqual([10, 9.5, 9, 8.5, 8, 7.5]);
  expect([0, 1, 2, 3, 4, 5].map((l) => droneCycleAt(DRONE_CYCLE_SEC.defenseDrone, l))).toEqual([2, 1.9, 1.8, 1.7, 1.6, 1.5]);
});

/** Opens a station tab and waits for the officer's new line, so the next Enter reaches the tab. */
async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
  await settle(page);
}

test('skills screen: at Command Piloting III, Drone Operation says it needs Command Piloting IV', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0, 3)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  const card = page.getByTestId('skill-card-droneOperation');
  await expect(card).toContainText('DRONE OPERATION');
  await expect(card).toContainText('Needs: Command Piloting IV');
  await expect(card.getByRole('button', {name: 'NEEDS COMMAND PILOTING IV'})).toBeDisabled();
  expectClean(problems);
});

test('skills screen: at Command Piloting IV, Drone Operation I queues for 100 MARKS and takes 3:00', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(0)});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-category-Industry')).toContainText('DRONE OPERATION');
  const card = page.getByTestId('skill-card-droneOperation');
  await expect(card).toContainText('-0% cycle time (extraction 10.0 s, defense and salvage 2.0 s)');
  await card.getByRole('button', {name: 'LVL I (100 MARKS • 3:00)'}).click();
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  const after = (await readSave(page))!;
  expect(after.trainingQueue[0]).toMatchObject({skillId: 'droneOperation', targetLevel: 1, duration: 180, cost: 100});
  expect(after.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('skills screen: at Drone Operation V, the card shows 7.5 s and 1.5 s', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5)});
  await enterGame(page);
  await openTab(page, '3', 'SKILLS MATRIX');
  await expect(page.getByTestId('skill-card-droneOperation')).toContainText('-25% cycle time (extraction 7.5 s, defense and salvage 1.5 s)');
  expectClean(problems);
});

/** Deploys the drone at `row` of the Drone Control Bay (0 extraction, 1 defense, 2 salvage) and closes the bay. */
async function deploy(page: Page, row: number) {
  await page.keyboard.press('d');
  await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible();
  for (let i = 0; i < row; i++) await page.keyboard.press('ArrowDown');
  await expect(async () => {
    await page.keyboard.press('Enter');
    await expect(page.getByText('Bandwidth: 1 / 2')).toBeVisible({timeout: 2000});
  }).toPass({timeout: 20_000});
  await page.keyboard.press('Escape');
}

/** Seconds between consecutive changes of `read` in the page, sampled every 50 ms until `count` gaps are seen. */
async function gapsInPage(page: Page, read: 'ferrite' | 'pirateHp' | 'hold', count: number, timeoutMs: number): Promise<number[]> {
  return page.evaluate(async ({read, count, timeoutMs, key}) => {
    const inv = () => JSON.parse(localStorage.getItem(key) || '{}').inventory ?? {};
    const value = () => read === 'ferrite' ? inv().ferrite ?? 0
      : read === 'hold' ? ['ferrite', 'aurite', 'chromite', 'pyrox'].reduce((s, o) => s + (inv()[o] ?? 0), 0)
      : (() => { const q = (window as any).__DEEP_BELT_PROBE__.pirate(); return q.shield + q.armor + q.hull; })();
    const times: number[] = [];
    let last = value();
    const start = performance.now();
    while (times.length < count + 1 && performance.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
      const v = value();
      // Ferrite rises by a yield, the hold by a scooped canister; the pirate's HP falls by a drone's 8 damage (its shield regen is far smaller).
      if (read === 'pirateHp' ? last - v >= 4 : v > last) times.push(performance.now());
      last = v;
    }
    return times.slice(1).map((t, i) => Math.round((t - times[i]) / 100) / 10);
  }, {read, count, timeoutMs, key: SAVE_KEY});
}

for (const level of [0, 5]) {
  const cycle = droneCycleAt(DRONE_CYCLE_SEC.extractDrone, level);
  test(`flight: an extraction drone yields every ${cycle.toFixed(1)} s at Drone Operation ${level}`, async ({page}) => {
    test.setTimeout(120_000);
    const problems = await launch(page, {...SKILLS_AT(level), cargoExtractDrone: 1});
    await flyTo(page, 'Belt One');
    await selectTarget(page, /Asteroid ·/);
    // A tuned laser keeps the drone's asteroid from cracking under strain.
    await tuneLaser(page);
    await deploy(page, 0);
    const gaps = await gapsInPage(page, 'ferrite', 2, 45_000);
    expect(gaps).toHaveLength(2);
    for (const g of gaps) expect(Math.abs(g - cycle), `gaps ${gaps}`).toBeLessThanOrEqual(0.3);
    expectClean(problems);
  });
}

for (const level of [0, 5]) {
  const cycle = droneCycleAt(DRONE_CYCLE_SEC.defenseDrone, level);
  test(`flight: a defense drone fires at the Belt Two pirate every ${cycle.toFixed(1)} s at Drone Operation ${level}`, async ({page}) => {
    test.setTimeout(120_000);
    const problems = await launch(page, {...SKILLS_AT(level), cargoDefenseDrone: 1});
    await flyTo(page, 'Belt Two');
    await deploy(page, 1);
    const gaps = await gapsInPage(page, 'pirateHp', 3, 40_000);
    expect(gaps).toHaveLength(3);
    for (const g of gaps) expect(Math.abs(g - cycle), `gaps ${gaps}`).toBeLessThanOrEqual(0.3);
    expectClean(problems);
  });
}

const ORES = ['ferrite', 'aurite', 'chromite', 'pyrox'] as const;

for (const level of [0, 5]) {
  const cycle = droneCycleAt(DRONE_CYCLE_SEC.salvageDrone, level);
  test(`flight: a salvage drone scoops a canister every ${cycle.toFixed(1)} s at Drone Operation ${level}`, async ({page}) => {
    test.setTimeout(120_000);
    const problems = await launch(page, {...SKILLS_AT(level), cargoSalvageDrone: 1, cargoFerrite: 10, cargoAurite: 10, cargoChromite: 10, cargoPyrox: 10});
    await settle(page);
    // Four canisters, one ore each: the first row is "All ore", the second the next ore held.
    // A ship at rest drops each 0.4 km behind it, so they lie together and the
    // drone, once there, scoops one a cycle.
    for (const ore of ORES) {
      await page.keyboard.press('x');
      await expect(page.getByText('JETTISON CARGO [X]')).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await readSave(page))?.inventory?.[ore], {timeout: 10_000}).toBe(0);
    }
    await deploy(page, 2);
    const gaps = await gapsInPage(page, 'hold', 3, 40_000);
    expect(gaps).toHaveLength(3);
    for (const g of gaps) expect(Math.abs(g - cycle), `gaps ${gaps}`).toBeLessThanOrEqual(0.3);
    // Every canister came back.
    const inv = (await readSave(page))!.inventory;
    expect(ORES.map((o) => inv[o])).toEqual([10, 10, 10, 10]);
    expectClean(problems);
  });
}

for (const [level, extraction, defense] of [[0, '10s cycle', '8 dmg / 2s'], [5, '7.5s cycle', '8 dmg / 1.5s']] as const) {
  test(`drone bay: at Drone Operation ${level}, the drone lines say ${extraction} and ${defense}`, async ({page}) => {
    const problems = await launch(page, {...SKILLS_AT(level), cargoExtractDrone: 1, cargoDefenseDrone: 1});
    await page.keyboard.press('d');
    await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible();
    await expect(page.getByText(`Mining tether (8 km) · ${extraction}`)).toBeVisible();
    await expect(page.getByText(`Escort perimeter · ${defense}`)).toBeVisible();
    expectClean(problems);
  });
}
