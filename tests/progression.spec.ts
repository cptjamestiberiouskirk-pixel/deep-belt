import {expect, test} from '@playwright/test';
import {enterGame, expectClean, flyTo, launch, openWithSave, readSave, RICH, selectTarget, settle, watch} from './helpers';

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

test('hangar: command transfers to another owned hull', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ownedHulls: ['ferrier', 'tern']});
  await enterGame(page);
  await page.keyboard.press('6');
  await settle(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Boarded Tern')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('tern');
  // The Tern is a hauler: its hold is twice the Ferrier's.
  await expect(page.getByText(/\/1200m³/)).toBeVisible();
  expectClean(problems);
});

test('fitting: a lens from the hold goes into the lens socket', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoSilicateLens: 1});
  await enterGame(page);
  await page.keyboard.press('2');
  await settle(page);
  await page.locator('button:visible', {hasText: /^Fit\s*Enter$/}).first().click();
  await expect(page.getByText('Fitted Silicate Lens')).toBeVisible();
  const save = (await readSave(page))!;
  expect(save.fittedLens).toBe('silicateLens');
  expect(save.lensCharges).toBe(25);
  expect(save.cargoSilicateLens).toBe(0);
  expectClean(problems);
});

test('agent: finishing the last two contracts grants the gate permit', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    marks: 10_000,
    missionIndex: 1,
    missionStatus: 'active',
    missionPirateKills: 1,
    cargoFerrite: 320,
  });
  await enterGame(page);
  await page.keyboard.press('4');
  // Turn in "Pest Control", accept "Paperwork", turn it in.
  await expect(async () => {
    await settle(page);
    await page.keyboard.press('Enter');
    expect((await readSave(page))!.hasGatePermit).toBe(true);
  }).toPass({timeout: 60_000});
  const save = (await readSave(page))!;
  expect(save.missionIndex).toBe(3);
  expect(save.marks).toBe(10_000 + 1500 + 2000);
  expect(save.cargoFerrite).toBe(20);
  await expect(page.getByText('ALL HARROW CONTRACTS COMPLETE')).toBeVisible();
  expectClean(problems);
});

test('drones: an extraction drone deploys and mines on its own', async ({page}) => {
  const problems = await launch(page, {cargoExtractDrone: 1});
  await flyTo(page, 'Belt One');
  // An extraction drone tethers to the selected asteroid.
  await selectTarget(page, /Asteroid ·/);
  await page.keyboard.press('d');
  await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible();
  await expect(async () => {
    await page.keyboard.press('Enter');
    await expect(page.getByText('Bandwidth: 1 / 2')).toBeVisible({timeout: 2000});
  }).toPass({timeout: 20_000});
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite, {timeout: 60_000}).toBeGreaterThan(0);
  // The drone is still out: the bay shows it, and the save counts it as in the
  // hold so that closing the game while it works does not lose it.
  await page.keyboard.press('d');
  await expect(page.getByText('Bandwidth: 1 / 2')).toBeVisible();
  expect((await readSave(page))!.cargoExtractDrone).toBe(1);
  expectClean(problems);
});

test('colony: a command hub founds a colony on a planet', async ({page}) => {
  const problems = await launch(page, {cargoCommandHub: 1});
  await flyTo(page, 'Harrow II');
  await expect(async () => {
    await page.keyboard.press('y');
    await expect.poll(async () => (await readSave(page))!.cargoCommandHub, {timeout: 3000}).toBe(0);
  }).toPass({timeout: 30_000});
  expect(Object.keys((await readSave(page))!.colonies)).toEqual(['harrow_ii']);
  await expect(page.getByText('COLONY COMMAND - Harrow II')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('COLONY COMMAND - Harrow II')).toBeHidden();
  expectClean(problems);
});

test('contracts: the goal names the pirate, and a finished contract says to go back to Osk', async ({page}) => {
  // Pest Control accepted, pirate not yet dead.
  let problems = await launch(page, {missionIndex: 1, missionStatus: 'active', missionPirateKills: 0});
  await expect(page.getByText('Current goal: Destroy the pirate at Belt Two')).toBeVisible();
  await expect(page.getByText(/Gate Key/)).toHaveCount(0);
  expectClean(problems);

  // Pirate dead: the pay waits at the Agent.
  problems = await launch(page, {missionIndex: 1, missionStatus: 'ready_to_turn_in', missionPirateKills: 1});
  await expect(page.getByText('Current goal: Return to Agent Osk for 1,500 MARKS')).toBeVisible();
  await expect(page.getByText('Station in range: Dock [F], then turn in the contract at the Agent [4]')).toBeVisible();
  expectClean(problems);

  // Rocks, Please with the 200 ferrite aboard, out at the belt.
  problems = await launch(page, {missionIndex: 0, missionStatus: 'active', cargoFerrite: 200});
  await expect(page.getByText('Current goal: Return to Agent Osk for 1,000 MARKS')).toBeVisible();
  await flyTo(page, 'Belt One');
  await expect(page.getByText('Contract done: warp to Harrow Station Alpha [M] and turn it in at the Agent [4]')).toBeVisible();
  expectClean(problems);
});
