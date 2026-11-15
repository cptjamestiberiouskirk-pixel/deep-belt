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
  targetPanel,
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

test('hauling: Hull Plates go through the gate and are delivered at Vael Station', async ({page}) => {
  test.setTimeout(240_000);
  const problems = await docked(page, {missionIndex: 3, missionStatus: 'completed', hasGatePermit: true, cargoHullPlate: 2});
  await page.keyboard.press('4');
  await expect(page.getByText('HAULING CONTRACTS')).toBeVisible();
  await settle(page);
  const row = page.locator('div', {hasText: 'Haul: Hull Plates to Vael'}).filter({hasText: 'Destination:'}).last();
  // The contract has to name a place the player can find in the warp menu.
  await expect(row).toContainText('Vael Station (Vael System)');
  await row.locator('xpath=ancestor-or-self::*[.//button][1]').locator('button', {hasText: /Accept/}).first().click();
  await expect.poll(async () => (await readSave(page))!.activeHaulContractId).toBe('haul_plates_vael');
  await page.keyboard.press('Escape');

  const before = (await readSave(page))!.marks;
  await undock(page);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await pressUntil(page, 'j', async () => {
    await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 5000});
  }, 60_000);
  await flyTo(page, 'Vael Station');
  await pressUntil(page, 'f', async () => {
    await expect(page.getByText('HAULING DELIVERY READY')).toBeVisible({timeout: 3000});
  });
  await page.getByRole('button', {name: /^Deliver/}).click();
  await expect.poll(async () => (await readSave(page))!.activeHaulContractId).toBeNull();
  const save = (await readSave(page))!;
  expect(save.marks).toBe(before + 600);
  expect(save.cargoHullPlate).toBe(0);
  expectClean(problems);
});

test('hauling: docking at the outpost does not deliver a contract meant for Harrow Station', async ({page}) => {
  const problems = await docked(page, {
    outpostDeployed: true,
    outpost: {deployed: true},
    dockedStationId: 'outpost',
    isDocked: true,
    missionIndex: 3,
    missionStatus: 'completed',
    activeHaulContractId: 'haul_core_harrow',
    cargoSensorCore: 1,
  });
  expect(await whereAmI(page)).toBe('Your Outpost');
  await undock(page);
  await pressUntil(page, 'f', async () => {
    await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 3000});
  });
  expect((await readSave(page))!.dockedStationId).toBe('outpost');
  await page.waitForTimeout(1500);
  await expect(page.getByText('HAULING DELIVERY READY')).toHaveCount(0);
  const save = (await readSave(page))!;
  expect(save.activeHaulContractId).toBe('haul_core_harrow');
  expect(save.cargoSensorCore).toBe(1);
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

test('outpost: the refinery and fabricator stay shut until their modules are installed', async ({page}) => {
  const problems = await docked(page, {...AT_OUTPOST, cargoFerrite: 50});
  await settle(page);
  await page.keyboard.press('r');
  await expect(page.getByText('Refinery Annex Needed').first()).toBeVisible();
  await expect(page.getByText('ORE REFINING FACILITY')).toHaveCount(0);
  await settle(page);
  await page.keyboard.press('f');
  await expect(page.getByText('Fab Bay Needed').first()).toBeVisible();
  await expect(page.getByText(/^FABRICATOR$/)).toHaveCount(0);
  expectClean(problems);
});

test('outpost: the refinery annex refines free of charge and the fab bay builds parts', async ({page}) => {
  test.setTimeout(150_000);
  const problems = await docked(page, {
    ...AT_OUTPOST,
    outpost: {deployed: true, modules: {refinery_annex: true, fab_bay: true}},
    marks: 1000,
    cargoFerrite: 50,
    cargoTritanium: 100,
    cargoChromiteBar: 40,
    cargoAuriteConc: 40,
    cargoPyroxite: 40,
  });
  const start = (await readSave(page))!;
  await settle(page);
  await page.keyboard.press('r');
  await expect(page.getByText('ORE REFINING FACILITY')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoTritanium, {timeout: 20_000}).toBe(start.cargoTritanium + 25);
  let save = (await readSave(page))!;
  expect(save.cargoFerrite).toBe(0);
  expect(save.marks, 'the outpost refinery charged a fee').toBe(1000);

  await page.keyboard.press('Escape');
  await settle(page);
  await page.keyboard.press('f');
  await expect(page.getByText(/^FABRICATOR$/).first()).toBeVisible();
  const before = (await readSave(page))!;
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate).not.toBeNull();
  await expect
    .poll(async () => (await readSave(page))!.activeFabricate, {timeout: 90_000, intervals: [2000]})
    .toBeNull();
  save = (await readSave(page))!;
  const made = ['cargoHullPlate', 'cargoThrusterCoil', 'cargoSensorCore'].filter((k) => save[k] > before[k]);
  expect(made, 'no fabricated part appeared in the hold').not.toEqual([]);
  expectClean(problems);
});

test('flagship: the Gantry hold refit raises the hold to 2,500 m³ and survives a reload', async ({page}) => {
  test.setTimeout(150_000);
  const problems = await docked(page, {
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'gantry',
    // The hold size is saved as is, not worked out from the hull on load.
    cargoMax: 2000,
    cargoPolymerComposite: 4,
    cargoIntegritySeal: 1,
    cargoThermalGrid: 1,
  });
  expect((await readSave(page))!.cargoMax).toBe(2000);
  await page.keyboard.press('f');
  await expect(page.getByText(/^FABRICATOR$/).first()).toBeVisible();
  await settle(page);
  // The list wraps: three steps up from the first recipe is the refit.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate?.recipeId).toBe('gantry_refit');
  expect((await readSave(page))!.cargoPolymerComposite).toBe(0);
  await expect
    .poll(async () => (await readSave(page))!.gantryRefit, {timeout: 80_000, intervals: [2000]})
    .toBe(true);
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(2500);

  await reloadAndContinue(page);
  await expect(page.getByText('Docked · safe')).toBeVisible();
  const save = (await readSave(page))!;
  expect(save.gantryRefit).toBe(true);
  expect(save.cargoMax, 'the refit hold was lost on reload').toBe(2500);
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

type Colony = {cells: Array<{col: number; row: number; type: string}>; raw: number; product: number; acc: number; launchIn: number; interval: number; rocket: {load: number; t: number} | null; depot: number};
const colonyOf = async (page: Page, id: string) => (await readSave(page))!.colonies[id] as Colony;

test('colony: drills and processors produce over time, and a rocket carries the product to the depot', async ({page}) => {
  test.setTimeout(150_000);
  // Colonies run on the game clock even while docked. Both colonies are a few
  // seconds from a production cycle; Harrow II is also nine seconds from a launch.
  const problems = await docked(page, {
    colonies: {
      // The drill touches the hub and the processor sits on the hub's other side: both online.
      harrow_ii: {
        cells: [{col: 4, row: 2, type: 'drill'}, {col: 2, row: 2, type: 'processor'}],
        raw: 40, product: 0, acc: 55, launchIn: 9, interval: 300, rocket: null, depot: 0,
      },
      // A drill in the far corner, with no pipe to the hub: offline.
      harrow_v: {
        cells: [{col: 7, row: 5, type: 'drill'}],
        raw: 0, product: 0, acc: 55, launchIn: 300, interval: 300, rocket: null, depot: 0,
      },
    },
  });

  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).acc, {timeout: 30_000}).toBeLessThan(55);
  let ii = await colonyOf(page, 'harrow_ii');
  const v = await colonyOf(page, 'harrow_v');
  expect(ii.raw, 'the online drill added raw and the processor took 20 of it').toBeGreaterThan(20);
  expect(v.acc, 'Harrow V ran its cycle too').toBeLessThan(55);
  expect(v.raw, 'an offline drill produced raw').toBe(0);

  // The scheduled launch takes whatever product there is and flies for 20 s.
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).rocket?.load ?? (await colonyOf(page, 'harrow_ii')).depot, {timeout: 30_000}).toBe(3);
  ii = await colonyOf(page, 'harrow_ii');
  expect(ii.product).toBe(0);
  expect(ii.launchIn, 'the launch timer restarts at the interval').toBeGreaterThan(250);
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).depot, {timeout: 45_000}).toBe(3);
  expect((await colonyOf(page, 'harrow_ii')).rocket).toBeNull();
  expectClean(problems);
});

test('colony: the panel launches a rocket on L and cycles the schedule on S', async ({page}) => {
  const problems = await launch(page, {
    colonies: {
      harrow_ii: {cells: [], raw: 0, product: 60, acc: 0, launchIn: 300, interval: 300, rocket: null, depot: 0},
    },
  });
  await warpTo(page, 'Harrow II');
  await expect(page.getByText('Dropped out of warp at Harrow II.').first()).toBeVisible({timeout: 60_000});
  await pressUntil(page, 'y', async () => {
    await expect(page.getByText('COLONY COMMAND - Harrow II')).toBeVisible({timeout: 3000});
  });

  await page.keyboard.press('s');
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).interval).toBe(600);
  await page.keyboard.press('s');
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).interval).toBe(120);
  expect((await colonyOf(page, 'harrow_ii')).launchIn, 'a shorter schedule pulls the next launch in').toBeLessThanOrEqual(120);

  await page.keyboard.press('l');
  await expect(page.getByText('Cargo rocket launched with 50 units!').first()).toBeVisible();
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).rocket?.load).toBe(50);
  expect((await colonyOf(page, 'harrow_ii')).product).toBe(10);
  await page.keyboard.press('l');
  await expect(page.getByText('Rocket already in flight').first()).toBeVisible();
  await expect.poll(async () => (await colonyOf(page, 'harrow_ii')).depot, {timeout: 40_000}).toBe(50);
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

/** Opens the drone bay and deploys the drone on the given row (0 extraction, 1 defense, 2 salvage). */
async function deployDrone(page: Page, row: 1 | 2, name: string) {
  await pressUntil(page, 'd', async () => {
    await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible({timeout: 2000});
  });
  for (let i = 0; i < row; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText(`Deployed 1 ${name}`).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('DRONE CONTROL BAY')).toBeHidden();
}

test('drones: a defense drone destroys a pirate and a salvage drone loots the wreck', async ({page}) => {
  test.setTimeout(240_000);
  // Pest Control (mission 2 of the chain) asks for exactly this pirate.
  const problems = await launch(page, {...FIGHTER, cargoDefenseDrone: 1, cargoSalvageDrone: 1, missionIndex: 1, missionStatus: 'active'});
  await flyTo(page, 'Belt Two');
  await deployDrone(page, 1, 'Defense Drone');
  await deployDrone(page, 2, 'Salvage Drone');
  const bandwidth = async (text: string) => {
    await pressUntil(page, 'd', async () => {
      await expect(page.getByText('DRONE CONTROL BAY')).toBeVisible({timeout: 2000});
    });
    await expect(page.getByText(text)).toBeVisible();
    await page.keyboard.press('Escape');
  };
  await bandwidth('Bandwidth: 2 / 2');
  const before = (await readSave(page))!;

  // The pilot never fires; the drone has to find the pirate itself.
  await expect(page.getByText('Hostile neutralized by defense drone.').first()).toBeVisible({timeout: 150_000});
  await expect.poll(async () => (await readSave(page))!.marks).toBeGreaterThanOrEqual(before.marks + 250);
  expect((await readSave(page))!.missionStatus, 'the drone kill did not count for Pest Control').toBe('ready_to_turn_in');
  await expect.poll(async () => (await readSave(page))!.cargoScrap, {timeout: 60_000}).toBeGreaterThan(before.cargoScrap);

  // Warping recalls every drone into the hold.
  await flyTo(page, 'Harrow Station Alpha');
  await bandwidth('Bandwidth: 0 / 2');
  const save = (await readSave(page))!;
  expect(save.cargoDefenseDrone).toBe(1);
  expect(save.cargoSalvageDrone).toBe(1);
  expectClean(problems);
});

test('drones: drones out in space when the game closes are back in the hold on load', async ({page}) => {
  const problems = await launch(page, {cargoDefenseDrone: 1});
  await deployDrone(page, 1, 'Defense Drone');
  // Let the autosave run with the drone out.
  await page.waitForTimeout(6000);
  await reloadAndContinue(page);
  await expect.poll(async () => (await readSave(page))!.cargoDefenseDrone, {message: 'the deployed drone was lost'}).toBe(1);
  expectClean(problems);
});

/** Enters the Rift and reveals stage 1 with a pulse. */
async function enterRift(page: Page, query = '') {
  const problems = await launch(page, {...FIGHTER, cargoRiftSync: 1}, query);
  await flyTo(page, 'Rift Anomaly');
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible({timeout: 3000});
  });
  await page.keyboard.press('Enter');
  await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});
  await expect.poll(async () => (await readSave(page))!.riftRun?.stage).toBe(1);

  await page.keyboard.press('p');
  await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible();
  return problems;
}

/** Warp is blocked inside the Rift, so this picks a place from the warp list and approaches it. */
async function riftApproach(page: Page, row: RegExp) {
  await page.keyboard.press('m');
  await expect(page.getByText('Warp Blocked').first()).toBeVisible();
  await page.getByText(row).first().click();
  await page.keyboard.press('q');
}

test('rift: a data container is hacked and its reward banked in the run manifest', async ({page}) => {
  test.setTimeout(240_000);
  const problems = await enterRift(page);
  await riftApproach(page, /^Data Container C1A/);
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('Telemetry Hack Started').first()).toBeVisible({timeout: 2000});
  }, 120_000);
  await expect(page.getByText('Data Container Hacked: +1,200 MARKS').first()).toBeVisible({timeout: 20_000});
  await expect.poll(async () => (await readSave(page))!.riftRun?.done ?? []).toContain('c1a');
  expect((await readSave(page))!.riftRun.manifest.marks).toBe(1200);
  expectClean(problems);
});

test('rift: defense drones destroy a sentinel that attacks the ship, and the kill is banked in the run', async ({page}) => {
  test.setTimeout(300_000);
  const problems = await launch(page, {...FIGHTER, cargoRiftSync: 1, cargoDefenseDrone: 2});
  await flyTo(page, 'Rift Anomaly');
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible({timeout: 3000});
  });
  await page.keyboard.press('Enter');
  await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});
  await page.keyboard.press('p');
  await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible();
  // Entering the Rift recalls drones, so they go out once inside.
  await deployDrone(page, 1, 'Defense Drone');
  await deployDrone(page, 1, 'Defense Drone');
  const before = (await readSave(page))!;

  // Fly at the first sentinel; it attacks once the ship is in its aggro range.
  // The pilot never fires, so only the drones can kill it.
  await page.getByText('Rift Sentinel 1', {exact: true}).click();
  await expect.poll(() => targetPanel(page)).toMatch(/Sentinel/);
  await page.keyboard.press('q');
  await expect(page.getByText(/Sentinel defeated by defense drone/).first()).toBeVisible({timeout: 180_000});

  // Banked in the run, as a kill by the ship's guns is; no wallet bounty and no wreck.
  await expect.poll(async () => (await readSave(page))!.riftRun?.done ?? [], {timeout: 15_000}).toContain('sentinel_stage_1_0');
  const save = (await readSave(page))!;
  expect(save.riftRun.manifest.marks).toBe(250);
  expect(save.marks, 'a guardian killed by a drone paid a wallet bounty').toBe(before.marks);
  await expect(page.getByText(/BOUNTY CLAIMED/)).toHaveCount(0);
  expectClean(problems);
});

/** Locks the selected hostile, flies at it and fires until `killed` shows. */
async function fightSelected(page: Page, killed: RegExp) {
  await page.keyboard.press('q');
  await pressUntil(page, 'l', async () => {
    await expect.poll(() => targetPanel(page), {timeout: 3000}).toMatch(/Locked/);
  }, 90_000);
  await page.keyboard.press('2');
  await expect(page.getByText(killed).first()).toBeVisible({timeout: 120_000});
}

test('rift: stage 3 sentinel and Warden fall, and the collapse gate extracts the run', async ({page}) => {
  test.setTimeout(420_000);
  // `\` skips a stage only in a ?dev build; stages 1 and 2 are covered by the tests above.
  const problems = await enterRift(page, '?dev');
  for (const stage of [2, 3]) {
    await pressUntil(page, '\\', async () => {
      await expect.poll(async () => (await readSave(page))!.riftRun?.stage, {timeout: 3000}).toBe(stage);
    });
  }
  await expect(page.getByText(/Advanced to Stage 3 - Core Breach/).first()).toBeVisible();
  await pressUntil(page, 'p', async () => {
    await expect(page.getByText('Rift Pulse: Stage objectives revealed').first()).toBeVisible({timeout: 2000});
  }, 40_000);

  // The gate lies straight ahead, past one sentinel and the Warden.
  // Tab only cycles nearby objects, so pick them from the Overview.
  await page.getByText('Rift Sentinel 3', {exact: true}).click();
  await expect.poll(() => targetPanel(page)).toMatch(/Sentinel/);
  const sentinelKm = async () => Number((await targetPanel(page)).match(/Pirate · ([\d.]+) km/)?.[1]);
  expect(await sentinelKm()).toBeGreaterThan(70);
  // Selecting it from across the stage must not pull it off its post: it would
  // stall at its leash and heal faster than it can be shot.
  await page.waitForTimeout(8000);
  expect(await sentinelKm(), 'a sentinel selected from 80 km charged the ship').toBeGreaterThan(70);
  await fightSelected(page, /Rift Sentinel neutralized/);

  // The Warden's death is what unlocks the gate.
  await page.getByText('Rift Warden', {exact: true}).click();
  await expect.poll(() => targetPanel(page)).toMatch(/Warden/);
  await fightSelected(page, /Elite Warden destroyed! Gate unlocked\./);
  // The run is saved every few seconds, so the toast can come before the save does.
  await expect.poll(async () => (await readSave(page))!.riftRun.manifest.marks, {timeout: 15_000}).toBeGreaterThanOrEqual(2750);
  const manifest = (await readSave(page))!.riftRun.manifest;
  expect(manifest.items.integritySeal).toBe(1);

  const before = (await readSave(page))!;
  await riftApproach(page, /^Collapse Gate \(Extraction\)/);
  await pressUntil(page, 'z', async () => {
    await expect(page.getByText('TERMINAL COLLAPSE GATE')).toBeVisible({timeout: 3000});
  }, 120_000);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Harrow System ·')).toBeVisible({timeout: 30_000});
  await expect.poll(async () => (await readSave(page))!.riftRun).toBeNull();
  const save = (await readSave(page))!;
  expect(save.marks).toBeGreaterThanOrEqual(before.marks + manifest.marks);
  expect(save.cargoIntegritySeal).toBe(before.cargoIntegritySeal + 1);
  expectClean(problems);
});

/** Enters the Rift and flies to the first conduit, leaving its dialog open. */
async function riftToFirstConduit(page: Page) {
  const problems = await enterRift(page);
  // The conduit is a flight of about a minute.
  await riftApproach(page, /^Rift Conduit \(/);
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

/**
 * Page coordinates of a point given in world pixels from the ship. The camera
 * is centred on the ship, and the stage is scaled to fit the window.
 */
async function fromShip(page: Page, dx: number, dy: number) {
  return page.evaluate(([x, y]) => {
    const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.width - a.width)[0];
    const r = canvas.getBoundingClientRect();
    const k = r.width / canvas.width;
    return {x: r.left + r.width / 2 + x * k, y: r.top + r.height / 2 + y * k};
  }, [dx, dy] as const);
}

/** Distance in km to the selected station, from the Target panel's "Station · 1.1 km". */
async function stationKm(page: Page): Promise<number | null> {
  const m = (await targetPanel(page)).match(/Station · ([\d.]+) km/);
  return m ? Number(m[1]) : null;
}

test('pointer: a click selects what is under it, and a right-click flies to that spot', async ({page}) => {
  const problems = await launch(page);
  // Select something else first, so the click has something to change.
  await selectTarget(page, /^(?!.*Harrow Station Alpha)/);
  // Undocking leaves the ship 260 px below the station's centre.
  let at = await fromShip(page, 0, -200);
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => targetPanel(page)).toMatch(/Harrow Station Alpha/);

  const start = (await stationKm(page))!;
  expect(start).toBeLessThan(2);
  // Open space down and to the left, clear of the side panels; the station ends up about 5 km off.
  at = await fromShip(page, -250, 150);
  await page.mouse.click(at.x, at.y, {button: 'right'});
  await expect.poll(() => stationKm(page), {timeout: 30_000}).toBeGreaterThan(start + 2.5);
  expect(await targetPanel(page), 'a right-click changed the selection').toMatch(/Harrow Station Alpha/);
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
