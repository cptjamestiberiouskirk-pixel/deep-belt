import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, watch} from './helpers';
import {readItem} from '../content/inventory';

// Steps 4 and 19 to 25 of design/content-tree.md: the lenses, the three drones,
// the colony goods, the Rift goods, the Vael ores, the components, the refined bars and the raw ores move from their cargoXxx save keys into the `inventory` map, by the rules in 4.4.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

test('inventory model: inventory wins even at 0, and an old key is read only for a missing item', () => {
  expect(readItem({cargoSilicateLens: 2}, 'silicateLens')).toBe(2);
  expect(readItem({inventory: {silicateLens: 0}, cargoSilicateLens: 3}, 'silicateLens')).toBe(0);
  expect(readItem({inventory: {silicateLens: 4}}, 'metallicLens')).toBeNull();
  expect(readItem({inventory: {exoticLens: 1}, cargoMetallicLens: 5}, 'metallicLens')).toBe(5);
  expect(readItem({inventory: {exoticLens: 'junk'}}, 'exoticLens')).toBe(0);
  expect(readItem({cargoDefenseDrone: 2}, 'defenseDrone')).toBe(2);
  expect(readItem({inventory: {silicateLens: 1}, cargoDefenseDrone: 2}, 'defenseDrone')).toBe(2);
  expect(readItem({inventory: {defenseDrone: 0}, cargoDefenseDrone: 2}, 'defenseDrone')).toBe(0);
  expect(readItem({inventory: {defenseDrone: 0}, cargoPolymerComposite: 6}, 'polymerComposite')).toBe(6);
  expect(readItem({inventory: {polymer: 1}, cargoPristineRadflux: 7}, 'pristineRadflux')).toBe(7);
  expect(readItem({inventory: {riftSync: 1}, cargoPackedNimbus: 3}, 'packedNimbus')).toBe(3);
  expect(readItem({inventory: {prismite: 0}, cargoPrismite: 9}, 'prismite')).toBe(0);
  expect(readItem({inventory: {prismite: 2}, cargoQuantumCore: 1}, 'quantumCore')).toBe(1);
  expect(readItem({inventory: {hullPlate: 0}, cargoTritanium: 30}, 'tritanium')).toBe(30);
  expect(readItem({cargoFerrite: 40}, 'ferrite')).toBe(40);
  expect(readItem({inventory: {ferrite: 0}, cargoFerrite: 40}, 'ferrite')).toBe(0);
  expect(readItem({cargoStationCore: 1}, 'stationCore')).toBeNull();
});

const lensesInSave = async (page: Page) => {
  const save = await readSave(page);
  return save && {inventory: save.inventory, oldKeys: Object.keys(save).filter((k) => /^cargo\w+Lens$/.test(k))};
};

test('save: lenses under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoSilicateLens: 2, cargoExoticLens: 1});
  await enterGame(page);
  const expected = {inventory: {silicateLens: 2, metallicLens: 0, exoticLens: 1, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0, riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0, prismite: 0, nimbus: 0, radflux: 0, packedPrismite: 0, packedNimbus: 0, packedRadflux: 0, hullPlate: 0, thrusterCoil: 0, sensorCore: 0, latticeAlloy: 0, conductiveMesh: 0, thermalAlloy: 0, quantumCore: 0, integritySeal: 0, thermalGrid: 0, tritanium: 0, auriteConc: 0, chromiteBar: 0, pyroxite: 0, ferrite: 0, rare: 0, aurite: 0, chromite: 0, pyrox: 0, scrap: 0}, oldKeys: []};
  await expect.poll(() => lensesInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await lensesInSave(page)).toEqual(expected);
  // The hold counts them: 3 lenses at 1 m³ each.
  await expect(page.getByText(/^3\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a lens at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 0}, cargoSilicateLens: 3});
  await enterGame(page);
  await expect.poll(async () => (await lensesInSave(page))?.inventory, {timeout: 15_000}).toEqual({silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0, riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0, prismite: 0, nimbus: 0, radflux: 0, packedPrismite: 0, packedNimbus: 0, packedRadflux: 0, hullPlate: 0, thrusterCoil: 0, sensorCore: 0, latticeAlloy: 0, conductiveMesh: 0, thermalAlloy: 0, quantumCore: 0, integritySeal: 0, thermalGrid: 0, tritanium: 0, auriteConc: 0, chromiteBar: 0, pyroxite: 0, ferrite: 0, rare: 0, aurite: 0, chromite: 0, pyrox: 0, scrap: 0});
  expectClean(problems);
});

const dronesInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {drones: [inv.extractDrone, inv.defenseDrone, inv.salvageDrone], oldKeys: Object.keys(save).filter((k) => /^cargo\w+Drone$/.test(k))};
};

test('save: drones under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoExtractDrone: 1, cargoDefenseDrone: 2});
  await enterGame(page);
  const expected = {drones: [1, 2, 0], oldKeys: []};
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await dronesInSave(page)).toEqual(expected);
  // The hold counts them: 3 drones at 5 m³ each.
  await expect(page.getByText(/^15\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds only the lenses, as from step 4 to 18, keeps its drones', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 1, metallicLens: 0, exoticLens: 0}, cargoSalvageDrone: 2});
  await enterGame(page);
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual({drones: [0, 0, 2], oldKeys: []});
  // 1 lens and 2 salvage drones: 1 + 10 m³.
  await expect(page.getByText(/^11\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a drone at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {defenseDrone: 0}, cargoDefenseDrone: 3});
  await enterGame(page);
  await expect.poll(() => dronesInSave(page), {timeout: 15_000}).toEqual({drones: [0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const colonyGoodsInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {goods: [inv.commandHub, inv.polymer, inv.chemical, inv.polymerComposite], oldKeys: Object.keys(save).filter((k) => /^cargo(CommandHub|Polymer|Chemical|PolymerComposite)$/.test(k))};
};

test('save: colony goods under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoCommandHub: 1, cargoPolymer: 5, cargoPolymerComposite: 2});
  await enterGame(page);
  const expected = {goods: [1, 5, 0, 2], oldKeys: []};
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await colonyGoodsInSave(page)).toEqual(expected);
  // The hold counts them: a 20 m³ Command Hub and 7 goods at 2 m³ each.
  await expect(page.getByText(/^34\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds lenses and drones, as from step 19, keeps its colony goods', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0}, cargoChemical: 4});
  await enterGame(page);
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 4, 0], oldKeys: []});
  await expect(page.getByText(/^8\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a colony good at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {polymer: 0}, cargoPolymer: 9});
  await enterGame(page);
  await expect.poll(() => colonyGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const riftGoodsInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {goods: [inv.riftSync, inv.pristinePrismite, inv.pristineNimbus, inv.pristineRadflux], oldKeys: Object.keys(save).filter((k) => /^cargo(RiftSync|Pristine\w+)$/.test(k))};
};

test('save: Rift goods under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoRiftSync: 1, cargoPristinePrismite: 4, cargoPristineRadflux: 3});
  await enterGame(page);
  const expected = {goods: [1, 4, 0, 3], oldKeys: []};
  await expect.poll(() => riftGoodsInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await riftGoodsInSave(page)).toEqual(expected);
  // The hold counts them: a 5 m³ Rift Sync and 7 pristine ores at 1 m³ each.
  await expect(page.getByText(/^12\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds lenses, drones and colony goods, as from step 20, keeps its Rift goods', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    inventory: {silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0},
    cargoPristineNimbus: 6,
  });
  await enterGame(page);
  await expect.poll(() => riftGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 6, 0], oldKeys: []});
  await expect(page.getByText(/^6\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a Rift good at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {riftSync: 0}, cargoRiftSync: 2});
  await enterGame(page);
  await expect.poll(() => riftGoodsInSave(page), {timeout: 15_000}).toEqual({goods: [0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const vaelOresInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {ores: [inv.prismite, inv.nimbus, inv.radflux, inv.packedPrismite, inv.packedNimbus, inv.packedRadflux], oldKeys: Object.keys(save).filter((k) => /^cargo(Packed)?(Prismite|Nimbus|Radflux)$/.test(k))};
};

test('save: Vael ores under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoPrismite: 2, cargoRadflux: 1, cargoPackedNimbus: 3});
  await enterGame(page);
  const expected = {ores: [2, 0, 1, 0, 3, 0], oldKeys: []};
  await expect.poll(() => vaelOresInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await vaelOresInSave(page)).toEqual(expected);
  // The hold counts them: 2 Prismite at 8 m³, 1 Radflux at 10 and 3 packed Nimbus at 1.
  await expect(page.getByText(/^29\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds the groups up to the Rift goods, as from step 21, keeps its Vael ores', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    inventory: {silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0, riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0},
    cargoNimbus: 2,
  });
  await enterGame(page);
  await expect.poll(() => vaelOresInSave(page), {timeout: 15_000}).toEqual({ores: [0, 2, 0, 0, 0, 0], oldKeys: []});
  await expect(page.getByText(/^12\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a Vael ore at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {prismite: 0}, cargoPrismite: 5});
  await enterGame(page);
  await expect.poll(() => vaelOresInSave(page), {timeout: 15_000}).toEqual({ores: [0, 0, 0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const componentsInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {parts: [inv.hullPlate, inv.thrusterCoil, inv.sensorCore, inv.latticeAlloy, inv.conductiveMesh, inv.thermalAlloy, inv.quantumCore, inv.integritySeal, inv.thermalGrid], oldKeys: Object.keys(save).filter((k) => /^cargo(HullPlate|ThrusterCoil|SensorCore|LatticeAlloy|ConductiveMesh|ThermalAlloy|QuantumCore|IntegritySeal|ThermalGrid)$/.test(k))};
};

test('save: components under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoHullPlate: 2, cargoLatticeAlloy: 3, cargoQuantumCore: 1});
  await enterGame(page);
  const expected = {parts: [2, 0, 0, 3, 0, 0, 1, 0, 0], oldKeys: []};
  await expect.poll(() => componentsInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await componentsInSave(page)).toEqual(expected);
  // The hold counts them: 2 Hull Plates at 5 m³, 3 Lattice Alloy at 2 and 1 Quantum Core at 5.
  await expect(page.getByText(/^21\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds the groups up to the Vael ores, as from step 22, keeps its components', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    inventory: {
      silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0,
      riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0, prismite: 0, nimbus: 0, radflux: 0, packedPrismite: 0, packedNimbus: 0, packedRadflux: 0,
    },
    cargoThermalGrid: 2,
  });
  await enterGame(page);
  await expect.poll(() => componentsInSave(page), {timeout: 15_000}).toEqual({parts: [0, 0, 0, 0, 0, 0, 0, 0, 2], oldKeys: []});
  await expect(page.getByText(/^10\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a component at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {sensorCore: 0}, cargoSensorCore: 4});
  await enterGame(page);
  await expect.poll(() => componentsInSave(page), {timeout: 15_000}).toEqual({parts: [0, 0, 0, 0, 0, 0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const barsInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {bars: [inv.tritanium, inv.auriteConc, inv.chromiteBar, inv.pyroxite], oldKeys: Object.keys(save).filter((k) => /^cargo(Tritanium|AuriteConc|ChromiteBar|Pyroxite)$/.test(k))};
};

test('save: refined bars under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoTritanium: 10, cargoPyroxite: 4});
  await enterGame(page);
  const expected = {bars: [10, 0, 0, 4], oldKeys: []};
  await expect.poll(() => barsInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await barsInSave(page)).toEqual(expected);
  // The hold counts them: 14 bars at 1 m³ each.
  await expect(page.getByText(/^14\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds the groups up to the components, as from step 23, keeps its refined bars', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    inventory: {
      silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0,
      riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0, prismite: 0, nimbus: 0, radflux: 0, packedPrismite: 0, packedNimbus: 0, packedRadflux: 0,
      hullPlate: 0, thrusterCoil: 0, sensorCore: 0, latticeAlloy: 0, conductiveMesh: 0, thermalAlloy: 0, quantumCore: 0, integritySeal: 0, thermalGrid: 0,
    },
    cargoChromiteBar: 7,
  });
  await enterGame(page);
  await expect.poll(() => barsInSave(page), {timeout: 15_000}).toEqual({bars: [0, 0, 7, 0], oldKeys: []});
  await expect(page.getByText(/^7\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a refined bar at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {auriteConc: 0}, cargoAuriteConc: 6});
  await enterGame(page);
  await expect.poll(() => barsInSave(page), {timeout: 15_000}).toEqual({bars: [0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});

const oresInSave = async (page: Page) => {
  const save = await readSave(page);
  const inv = save?.inventory ?? {};
  return save && {ores: [inv.ferrite, inv.rare, inv.aurite, inv.chromite, inv.pyrox, inv.scrap], oldKeys: Object.keys(save).filter((k) => /^cargo(Ferrite|Rare|Aurite|Chromite|Pyrox|Scrap)$/.test(k))};
};

test('save: raw ores and scrap under their old keys load into inventory and survive a reload', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, cargoFerrite: 30, cargoRare: 1, cargoScrap: 2});
  await enterGame(page);
  const expected = {ores: [30, 1, 0, 0, 0, 2], oldKeys: []};
  await expect.poll(() => oresInSave(page), {timeout: 15_000}).toEqual(expected);

  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  await page.waitForTimeout(6000); // past one autosave
  expect(await oresInSave(page)).toEqual(expected);
  // The hold counts them: 31 ore at 1 m³ and 2 Module Scrap at 5.
  await expect(page.getByText(/^41\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a save whose inventory holds the groups up to the refined bars, as from step 24, keeps its raw ores', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    inventory: {
      silicateLens: 0, metallicLens: 0, exoticLens: 0, extractDrone: 0, defenseDrone: 0, salvageDrone: 0, commandHub: 0, polymer: 0, chemical: 0, polymerComposite: 0,
      riftSync: 0, pristinePrismite: 0, pristineNimbus: 0, pristineRadflux: 0, prismite: 0, nimbus: 0, radflux: 0, packedPrismite: 0, packedNimbus: 0, packedRadflux: 0,
      hullPlate: 0, thrusterCoil: 0, sensorCore: 0, latticeAlloy: 0, conductiveMesh: 0, thermalAlloy: 0, quantumCore: 0, integritySeal: 0, thermalGrid: 0,
      tritanium: 0, auriteConc: 0, chromiteBar: 0, pyroxite: 0,
    },
    cargoAurite: 9,
  });
  await enterGame(page);
  await expect.poll(() => oresInSave(page), {timeout: 15_000}).toEqual({ores: [0, 0, 9, 0, 0, 0], oldKeys: []});
  await expect(page.getByText(/^9\/\d+m³$/)).toBeVisible();
  expectClean(problems);
});

test('save: a raw ore at 0 in inventory stays 0 whatever its old key says', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, inventory: {ferrite: 0}, cargoFerrite: 50});
  await enterGame(page);
  await expect.poll(() => oresInSave(page), {timeout: 15_000}).toEqual({ores: [0, 0, 0, 0, 0, 0], oldKeys: []});
  expectClean(problems);
});
