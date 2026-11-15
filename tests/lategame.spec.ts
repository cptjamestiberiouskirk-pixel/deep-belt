import {expect, test, type Page} from '@playwright/test';
import {
  enterGame,
  expectClean,
  flyTo,
  launch,
  mineUntil,
  openWithSave,
  readSave,
  RICH,
  selectTarget,
  settle,
  undock,
  warpTo,
  watch,
  whereAmI,
} from './helpers';

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const FIGHTER = {skills: {gunnery: 5, shieldOp: 5}};

async function docked(page: Page, patch: Record<string, unknown>) {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...patch});
  await enterGame(page);
  return problems;
}

async function reloadAndContinue(page: Page) {
  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('start-game-btn')).toBeHidden();
}

/** Presses a key until `check` passes; keys can be lost right after docking or a warp. */
async function pressUntil(page: Page, key: string, check: () => Promise<void>, timeout = 30_000) {
  await expect(async () => {
    await page.keyboard.press(key);
    await check();
  }).toPass({timeout});
}

test('hauling: a contract is accepted at the agent and paid out on delivery', async ({page}) => {
  const problems = await docked(page, {missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, cargoSensorCore: 1});
  await page.keyboard.press('4');
  await expect(page.getByText('HAULING CONTRACTS')).toBeVisible();
  await settle(page);
  const row = page.locator('div', {hasText: 'Haul: Sensor Core to Harrow'}).last();
  await row.locator('xpath=ancestor-or-self::*[.//button][1]').locator('button', {hasText: /Accept/}).first().click();
  await expect.poll(async () => (await readSave(page))!.activeHaulContractId).toBe('haul_core_harrow');
  await page.keyboard.press('Escape');

  // Delivery is offered on docking at the destination with the part aboard.
  const before = (await readSave(page))!.marks;
  await undock(page);
  await pressUntil(page, 'f', async () => {
    await expect(page.getByText('HAULING DELIVERY READY')).toBeVisible({timeout: 3000});
  });
  await page.getByRole('button', {name: /^Deliver/}).click();
  await expect.poll(async () => (await readSave(page))!.activeHaulContractId).toBeNull();
  const save = (await readSave(page))!;
  expect(save.marks).toBe(before + 450);
  expect(save.cargoSensorCore).toBe(0);
  expectClean(problems);
});

test('scanning: a bought probe launcher survives a reload and finds a data cache', async ({page}) => {
  const problems = await docked(page, {marks: 5000});
  await page.keyboard.press('1');
  await settle(page);
  const item = page.getByText('Core Probe Launcher', {exact: true}).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('xpath=ancestor::*[.//button][1]').locator('button').first().click();
  await expect.poll(async () => (await readSave(page))!.hasProbeLauncher).toBe(true);
  expect((await readSave(page))!.marks).toBe(5000 - 450);

  await reloadAndContinue(page);
  await expect(page.getByText('Docked · safe')).toBeVisible();
  expect((await readSave(page))!.hasProbeLauncher, 'the launcher was lost on reload').toBe(true);
  await undock(page);

  // The sweep passes ring 1, 2 and 3 about 0.5 s, 1.2 s and 2.0 s after it opens.
  const sweep = page.getByText('Core Probe Sweep');
  // A missed sweep costs a 60 s cooldown, so leave room for a second try.
  test.setTimeout(300_000);
  const cacheFound = async () => Boolean((await readSave(page))!.dataCache);
  await expect(async () => {
    if (await cacheFound()) return;
    await page.keyboard.press('p');
    await expect(sweep).toBeVisible({timeout: 2000});
    const opened = Date.now();
    for (const at of [430, 1180, 1950]) {
      await page.waitForTimeout(Math.max(0, opened + at - Date.now()));
      await page.keyboard.press('Space');
    }
    await expect.poll(cacheFound, {timeout: 4000}).toBe(true);
  }).toPass({timeout: 200_000, intervals: [5000]});

  const before = (await readSave(page))!;
  // The cache is not a named place, so the top bar keeps showing the nearest belt.
  await warpTo(page, 'Data Cache');
  await expect(page.getByText('Dropped out of warp at Data Cache.').first()).toBeVisible({timeout: 60_000});
  await pressUntil(page, 'e', async () => {
    await expect.poll(async () => (await readSave(page))!.marks, {timeout: 3000}).toBe(before.marks + 600);
  });
  const save = (await readSave(page))!;
  expect(save.capBatteryCount).toBe(before.capBatteryCount + 1);
  expect(save.firstCacheOpened).toBe(true);
  expectClean(problems);
});

test('notice: dumping ore on the market brings a raider wave, and docking sheds it', async ({page}) => {
  const problems = await docked(page, {...FIGHTER, cargoFerrite: 240});
  await page.keyboard.press('1');
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  await page.keyboard.press('Escape');
  await undock(page);
  await expect(page.getByText(/Raider wave inbound/).first()).toBeVisible({timeout: 20_000});
  await selectTarget(page, /Raider/);
  await pressUntil(page, 'f', async () => {
    await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 3000});
  }, 60_000);
  await undock(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Tab');
  expect(await page.innerText('body')).not.toMatch(/Raider\s+[\d.]+ km/);
  expectClean(problems);
});

const AT_OUTPOST = {
  outpostDeployed: true,
  outpost: {deployed: true},
  dockedStationId: 'outpost',
  isDocked: true,
};

test('outpost: modules install, the vault stores cargo, and both survive a reload', async ({page}) => {
  const problems = await docked(page, {...AT_OUTPOST, marks: 20_000, cargoHullPlate: 2, cargoFerrite: 100});
  expect(await whereAmI(page)).toBe('Your Outpost');
  await settle(page);
  await page.keyboard.press('b');
  await expect(page.getByText('OUTPOST HARDPOINTS')).toBeVisible();
  await settle(page);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Installed /).first()).toBeVisible();
  await settle(page);
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoHullPlate).toBe(0);
  let save = (await readSave(page))!;
  expect(save.marks).toBe(20_000 - 2000);
  expect(save.outpost.modules).toMatchObject({storage_bay: true, docking_ring: true});
  await page.keyboard.press('Escape');

  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText('VAULT CAPACITY')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Deposited 100 Ferrite Ore').first()).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  save = (await readSave(page))!;
  expect(Object.values(save.outpost.storage)).toEqual([100]);

  await reloadAndContinue(page);
  await expect(page.getByText('Docked · safe')).toBeVisible();
  save = (await readSave(page))!;
  expect(save.outpost.modules, 'installed modules were lost on reload').toMatchObject({storage_bay: true, docking_ring: true});
  expect(Object.values(save.outpost.storage), 'vault contents were lost on reload').toEqual([100]);
  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText('VAULT CAPACITY')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Backspace');
  await expect(page.getByText('Withdrew 100 Ferrite Ore').first()).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(100);
  expectClean(problems);
});

test('colony: buildings are placed on the grid, removed for a refund, and saved', async ({page}) => {
  const problems = await launch(page, {cargoCommandHub: 1});
  await flyTo(page, 'Harrow II');
  await pressUntil(page, 'y', async () => {
    await expect(page.getByText('COLONY COMMAND - Harrow II')).toBeVisible({timeout: 3000});
  });
  const before = (await readSave(page))!.marks;
  const cells = async () => (await readSave(page))!.colonies.harrow_ii.cells as Array<{col: number; row: number; type: string}>;

  // The cursor starts beside the hub with the drill selected.
  await page.keyboard.press('Enter');
  await expect.poll(cells).toEqual([{col: 4, row: 2, type: 'drill'}]);
  expect((await readSave(page))!.marks).toBe(before - 800);

  await page.keyboard.press('3');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await cells()).length).toBe(2);
  expect((await cells())[1]).toEqual({col: 5, row: 2, type: 'pipe'});
  expect((await readSave(page))!.marks).toBe(before - 900);

  // Building twice on one cell is refused.
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Cell already occupied/).first()).toBeVisible();

  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await cells()).length).toBe(1);
  expect((await readSave(page))!.marks).toBe(before - 850);

  await reloadAndContinue(page);
  expect(await cells()).toEqual([{col: 4, row: 2, type: 'drill'}]);
  expectClean(problems);
});

test('colony: goods waiting in the depot are collected into the hold', async ({page}) => {
  const problems = await launch(page, {
    colonies: {
      harrow_ii: {cells: [], raw: 0, product: 0, acc: 0, launchIn: 300, interval: 300, rocket: null, depot: 30},
    },
  });
  // The colony's depot sits beside the planet, so the top bar may name either.
  await warpTo(page, 'Harrow II');
  await expect(page.getByText('Dropped out of warp at Harrow II.').first()).toBeVisible({timeout: 60_000});
  await pressUntil(page, 'y', async () => {
    await expect(page.getByText('COLONY COMMAND - Harrow II')).toBeVisible({timeout: 3000});
  });
  await page.keyboard.press('e');
  await expect.poll(async () => (await readSave(page))!.colonies.harrow_ii.depot).toBe(0);
  const save = (await readSave(page))!;
  expect(save.cargoChemical + save.cargoPolymer).toBe(30);
  expectClean(problems);
});

test('capstone: Chart the Drift is accepted and turned in for its reward', async ({page}) => {
  const problems = await docked(page, {
    marks: 1000,
    missionIndex: 3,
    missionStatus: 'completed',
    hasGatePermit: true,
    agentStanding: 5,
    cargoPyrox: 150,
  });
  await page.keyboard.press('4');
  await settle(page);
  await page.getByRole('button', {name: 'Accept Chart the Drift'}).click();
  await expect.poll(async () => (await readSave(page))!.chartTheDriftStatus).toBe('active');
  await settle(page);
  await page.getByRole('button', {name: 'Turn in Chart the Drift'}).click();
  await expect.poll(async () => (await readSave(page))!.chartTheDriftStatus).toBe('completed');
  const save = (await readSave(page))!;
  expect(save.marks).toBe(1000 + 3750);
  expect(save.cargoPyrox).toBe(0);
  expect(save.capBatteryCount).toBe(1);
  expectClean(problems);
});

test('Ash Drift: the permit opens it and its pyrox can be mined', async ({page}) => {
  const problems = await launch(page, {...FIGHTER, hasGatePermit: true});
  await flyTo(page, 'Ash Drift');
  await expect(page.getByText('Ash Drift. Lowsec. Dig fast.').first()).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.ashDriftVisited).toBe(true);
  await selectTarget(page, /Pyrox/);
  await mineUntil(page, async () => (await readSave(page))!.cargoPyrox > 0, 80_000);
  expectClean(problems);
});

/** Enters the Rift and flies to the first conduit, leaving its dialog open. */
async function riftToFirstConduit(page: Page) {
  const problems = await launch(page, {...FIGHTER, cargoRiftSync: 1});
  await flyTo(page, 'Rift Anomaly');
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible({timeout: 3000});
  });
  await page.keyboard.press('Enter');
  await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});
  await expect.poll(async () => (await readSave(page))!.riftRun?.stage).toBe(1);

  await page.keyboard.press('p');
  await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible();

  // Warp is blocked inside the Rift, so the conduit is a flight of about a minute.
  await page.keyboard.press('m');
  await expect(page.getByText('Warp Blocked').first()).toBeVisible();
  await page.getByText(/^Rift Conduit \(/).first().click();
  await page.keyboard.press('q');
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('RIFT CONDUIT HORIZON')).toBeVisible({timeout: 3000});
  }, 150_000);
  return problems;
}

test('rift: the conduit advances the run to the next stage', async ({page}) => {
  test.setTimeout(300_000);
  const problems = await riftToFirstConduit(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.riftRun?.stage, {timeout: 20_000}).toBe(2);
  await expect(page.getByText(/Advanced to Stage 2/).first()).toBeVisible();
  expectClean(problems);
});

test('rift: extracting at a conduit ends the run and brings the ship home', async ({page}) => {
  test.setTimeout(300_000);
  const problems = await riftToFirstConduit(page);
  await page.keyboard.press('Backspace');
  await expect(page.getByText(/Rift Extracted!/).first()).toBeVisible({timeout: 20_000});
  await expect(page.getByText('Harrow System ·')).toBeVisible();
  const save = (await readSave(page))!;
  expect(save.riftRun).toBeNull();
  expect(save.riftStats.extracts).toBe(1);
  expect(save.currentSystem).toBe('Harrow');
  expectClean(problems);
});

test('flagship: a build survives a reload, and the Gantry can be boarded', async ({page}) => {
  test.setTimeout(180_000);
  const problems = await docked(page, {
    cargoQuantumCore: 2,
    cargoIntegritySeal: 2,
    cargoThermalGrid: 1,
    cargoPackedPrismite: 2,
    cargoPackedRadflux: 1,
  });
  await page.keyboard.press('f');
  await expect(page.getByText(/^FABRICATOR$/).first()).toBeVisible();
  await settle(page);
  // The list wraps, so one step up from the first recipe is the last: the flagship.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate?.recipeId).toBe('gantry_command');
  expect((await readSave(page))!.cargoQuantumCore).toBe(0);

  await reloadAndContinue(page);
  await expect(page.getByText('Docked · safe')).toBeVisible();
  await expect
    .poll(async () => (await readSave(page))!.ownedHulls, {timeout: 90_000, intervals: [2000]})
    .toContain('gantry');
  expect((await readSave(page))!.cargoQuantumCore, 'the parts came back as well as the hull').toBe(0);

  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText(/^HANGAR$/).first()).toBeVisible();
  await settle(page);
  await page.locator('button:visible', {hasText: /^Board/}).first().click();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('gantry');
  expectClean(problems);
});

test.describe('touch', () => {
  test.use({hasTouch: true});

  test('the title, the menu and the dock buttons answer to taps', async ({page}) => {
    const problems = watch(page);
    await openWithSave(page, BASE);
    await page.getByTestId('start-game-btn').tap();
    await expect(page.getByTestId('start-game-btn')).toBeHidden();
    await expect(page.getByText('Docked · safe')).toBeVisible();
    await page.getByTestId('menu-button').tap();
    await page.getByRole('button', {name: /^Resume/}).tap();
    await expect(page.getByRole('button', {name: /^Resume/})).toBeHidden();
    expectClean(problems);
  });
});
