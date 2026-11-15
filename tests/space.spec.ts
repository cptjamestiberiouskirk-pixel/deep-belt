import {expect, test} from '@playwright/test';
import {expectClean, flyTo, launch, readSave, selectTarget, settle, targetPanel, whereAmI} from './helpers';

const FIGHTER = {skills: {gunnery: 5, shieldOp: 5}};

test('combat: a pirate can be locked, destroyed and its wreck salvaged', async ({page}) => {
  const problems = await launch(page, FIGHTER);
  const before = (await readSave(page))!;
  await flyTo(page, 'Belt Two');
  await selectTarget(page, /Pirate Frigate/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  await expect.poll(() => targetPanel(page), {timeout: 90_000}).toMatch(/Wreck/);
  await expect.poll(async () => (await readSave(page))!.marks).toBeGreaterThan(before.marks);

  const afterKill = (await readSave(page))!.marks;
  await page.keyboard.press('e');
  await expect.poll(async () => (await readSave(page))!.cargoScrap, {timeout: 90_000}).toBeGreaterThan(0);
  expect((await readSave(page))!.marks).toBeGreaterThan(afterKill);
  expectClean(problems);
});

test('selecting a far-off pirate does not summon it across the system', async ({page}) => {
  const problems = await launch(page, FIGHTER);
  await flyTo(page, 'Belt Two');
  const corsairKm = async () => {
    const m = (await page.innerText('body')).match(/Rift Corsair\s+([\d.]+) km/);
    return m ? Number(m[1]) : null;
  };
  await selectTarget(page, /Rift Corsair/);
  expect(await corsairKm()).toBeGreaterThan(35);
  await page.keyboard.press('l');
  await page.waitForTimeout(12_000);
  expect(await corsairKm(), 'the corsair left its post to chase a pilot 44 km away').toBeGreaterThan(35);
  expectClean(problems);
});

test('destruction: the ship is towed home, cargo is lost, insurance is charged', async ({page}) => {
  const problems = await launch(page, {marks: 5000, cargoFerrite: 120});
  await flyTo(page, 'Belt Two');
  await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 170_000});
  await expect(page.getByText(/Vessel destroyed/)).toBeVisible();
  expect(await whereAmI(page)).toBe('Harrow Station Alpha');
  const save = (await readSave(page))!;
  expect(save.cargoFerrite).toBe(0);
  expect(save.marks).toBe(4900);
  expect(save.isDocked).toBe(true);
  expectClean(problems);
});

test('jump gate: stays locked without a permit', async ({page}) => {
  const problems = await launch(page);
  await flyTo(page, 'Harrow Outer Jump Gate');
  await expect(page.getByRole('button', {name: /Jump.*permit needed/})).toBeDisabled();
  await page.keyboard.press('j');
  await page.waitForTimeout(4000);
  expect(await whereAmI(page)).toBe('Harrow Outer Jump Gate');
  expect((await readSave(page))!.currentSystem).toBe('Harrow');
  expectClean(problems);
});

test('jump gate: with a permit the ship reaches Vael and docks there', async ({page}) => {
  const problems = await launch(page, {hasGatePermit: true});
  await flyTo(page, 'Harrow Outer Jump Gate');
  await page.keyboard.press('j');
  await expect(page.getByText('Vael System ·')).toBeVisible({timeout: 40_000});
  await expect.poll(async () => (await readSave(page))!.currentSystem).toBe('Vael');
  await flyTo(page, 'Vael Station');
  await page.keyboard.press('f');
  await expect(page.getByText('Docked at Vael Station')).toBeVisible({timeout: 30_000});
  expect((await readSave(page))!.dockedStationId).toBe('vael_station');

  // A save made in another system has to come back in that system.
  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Vael System ·')).toBeVisible();
  await expect(page.getByText('Docked · safe')).toBeVisible();
  expectClean(problems);
});

test('outpost: a station core deploys at the anchor and the outpost can be docked', async ({page}) => {
  const problems = await launch(page, {cargoStationCore: 1});
  await flyTo(page, 'Belt One Anchor');
  // A key pressed in the same instant the ship drops out of warp can be lost.
  await expect(async () => {
    await page.keyboard.press('v');
    await expect.poll(async () => (await readSave(page))!.outpostDeployed, {timeout: 3000}).toBe(true);
  }).toPass({timeout: 30_000});
  expect((await readSave(page))!.cargoStationCore).toBe(0);
  await expect(async () => {
    await page.keyboard.press('f');
    await expect(page.getByText('Docked at Your Outpost')).toBeVisible({timeout: 3000});
  }).toPass({timeout: 30_000});
  await settle(page);
  await page.keyboard.press('b');
  await expect(page.getByText('OUTPOST HARDPOINTS')).toBeVisible();
  // The outpost's own AI speaks here, not Harrow's dock officer.
  await expect(page.getByText(/Welcome to Harrow Station/)).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Docked · safe')).toBeVisible();
  expect(await whereAmI(page)).toBe('Your Outpost');
  expectClean(problems);
});

test('rift: a synchronizer opens the rift, and a reload mid-run recovers safely', async ({page}) => {
  const problems = await launch(page, {cargoRiftSync: 1});
  await flyTo(page, 'Rift Anomaly');
  await page.keyboard.press('z');
  await expect(page.getByText('STABILIZE CINDER RIFT')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Rift System ·')).toBeVisible({timeout: 30_000});
  await expect(page.getByText(/RIFT \d+:\d+/).first()).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.cargoRiftSync).toBe(0);

  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('start-game-btn')).toBeHidden();
  await expect(page.getByText(/(Harrow|Vael|Rift) System ·/)).toBeVisible();
  expectClean(problems);
});

test('in-space panels open and close, and compression packs ore', async ({page}) => {
  const problems = await launch(page, {cargoPrismite: 40, cargoExtractDrone: 1, cargoFerrite: 50});
  const panels: Array<[string, string]> = [
    ['c', 'EXOTIC ORE COMPRESSION'],
    ['d', 'DRONE CONTROL BAY'],
    ['x', 'JETTISON CARGO [X]'],
  ];
  for (const [key, heading] of panels) {
    await page.keyboard.press(key);
    await expect(page.getByText(heading), `panel on ${key}`).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(heading), `panel on ${key} after Esc`).toBeHidden();
  }
  await page.keyboard.press('c');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoPackedPrismite).toBe(1);
  expect((await readSave(page))!.cargoPrismite).toBe(30);
  expectClean(problems);
});

test('developer cheat keys do nothing in the released build', async ({page}) => {
  const problems = await launch(page, {marks: 1234});
  for (const key of ['0', '7', '=', '6', '8', '9', 'i']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  expect(await whereAmI(page)).toBe('Harrow Station Alpha');
  const save = (await readSave(page))!;
  expect(save.marks).toBe(1234);
  expect(save.cargoFerrite).toBe(0);
  await expect(page.getByText(/DEV CHEAT/)).toHaveCount(0);
  expectClean(problems);
});
