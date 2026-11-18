import {expect, test} from '@playwright/test';
import {expectClean, expectTitle, flyTo, launch, mineState, readSave, selectTarget, settle, targetPanel, tuneLaser, whereAmI} from './helpers';

const FIGHTER = {skills: {gunnery: 5, shieldOp: 5}};

test('combat: a pirate can be locked, destroyed and its wreck salvaged', async ({page}) => {
  const problems = await launch(page, FIGHTER);
  const before = (await readSave(page))!;
  await flyTo(page, 'Belt Two');
  // Picked from the Overview, not with Tab: under full load Tab may not reach it.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
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

test('the Belt Two pirate has 84 shield and 42 hull, 1.4x the first tuning', async ({page}) => {
  const problems = await launch(page);
  await flyTo(page, 'Belt Two');
  // Picked from the Overview, not with Tab: under full load Tab may not reach it.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
  // The panel shows current/max; the current values may already be falling. The
  // ship's own SHIELD and HULL come first on the page, so read after the pirate's name.
  const maxOf = async (label: string) => {
    const text = await page.innerText('body');
    const m = text.slice(text.indexOf('Pirate Frigate')).match(new RegExp(`${label}\\s*\\n\\s*\\d+/(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  await expect.poll(() => maxOf('SHIELD')).toBe(84);
  await expect.poll(() => maxOf('HULL')).toBe(42);
  expectClean(problems);
});

test('selecting a far-off pirate does not summon it across the system', async ({page}) => {
  const problems = await launch(page, FIGHTER);
  await flyTo(page, 'Belt Two');
  const corsairKm = async () => {
    const m = (await page.innerText('body')).match(/Rift Corsair\s+([\d.]+) km/);
    return m ? Number(m[1]) : null;
  };
  // Picked from the Overview: Tab steps through every object nearest first and
  // re-sorts on each press, so under load it may not reach one 44 km out.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Rift Corsair', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Rift Corsair/);
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
  await expectTitle(page);
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
  await expectTitle(page);
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
  await expect.poll(async () => (await readSave(page))!.inventory.riftSync).toBe(0);

  await page.reload();
  await expectTitle(page);
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
  await expect.poll(async () => (await readSave(page))!.inventory?.packedPrismite).toBe(1);
  expect((await readSave(page))!.inventory?.prismite).toBe(30);
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

test('mining: a tuned laser never overheats; a mistuned one locks out and the hint counts down', async ({page}) => {
  test.setTimeout(180_000);
  const problems = await launch(page, {}, '?dev');
  await flyTo(page, 'Belt One');
  await selectTarget(page, /Asteroid/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 30_000}).toMatch(/Locked/);
  await tuneLaser(page);
  const before = (await readSave(page))!.cargoFerrite ?? 0;
  await page.keyboard.press('1');
  // A matched laser used to reach 100% heat after about 20 s (two cycles).
  const states: string[] = [];
  for (let i = 0; i < 32; i++) {
    states.push(await mineState(page));
    await page.waitForTimeout(1000);
  }
  expect(states.filter((s) => /OVERHEAT/.test(s)), `Mine button over 32 s: ${states.join(' | ')}`).toEqual([]);
  await expect.poll(async () => ((await readSave(page))!.cargoFerrite ?? 0) - before, {timeout: 15_000}).toBeGreaterThanOrEqual(100);

  // Dev key 6 sets the heat to 95%; one step off the rock's frequency tips it over.
  await page.keyboard.press('6');
  const f = (await page.innerText('body')).match(/FREQ\s+(\d)\s*\/\s*(\d)/)!;
  await page.keyboard.press(Number(f[1]) > 1 ? '[' : ']');
  await expect.poll(() => mineState(page), {timeout: 15_000}).toMatch(/OVERHEAT/);
  await expect(page.getByText(/Laser overheated: cooling for \ds/)).toBeVisible();
  expectClean(problems);
});

test('mining: a bought Miner MK2 mines 75 ore every 8 s, as the market says', async ({page}) => {
  test.setTimeout(120_000);
  const problems = await launch(page, {upgrades: {laserMk2: true, cargoExpanded: false, shieldBoosterHeavy: false, cannon: true}});
  await flyTo(page, 'Belt One');
  await selectTarget(page, /Asteroid/);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 30_000}).toMatch(/Locked/);
  await tuneLaser(page);
  // The top bar's hold count is live; the save lags by up to one autosave.
  const held = async () => Number((await page.innerText('body')).match(/(\d+)\/\d+m³/)![1]);
  const before = await held();
  await page.keyboard.press('1');
  // The MK2 used to change only the screens: the laser still took 10 s for 50 ore.
  await expect.poll(() => mineState(page), {timeout: 5_000}).toMatch(/cycling \d+\/8s/);
  await expect.poll(held, {timeout: 15_000}).toBeGreaterThan(before);
  expect(await held()).toBe(before + 75);
  expectClean(problems);
});

test('overview: a rock is as far away in the Overview as in the Target panel', async ({page}) => {
  const problems = await launch(page);
  await flyTo(page, 'Belt One');
  await selectTarget(page, /Asteroid ·/);
  const km = (n: string, unit: string) => (unit === 'm' ? Number(n) / 1000 : Number(n));
  // Both distances come from one read of the page, so a drifting ship moves both alike.
  const gap = async () => {
    const text = await page.innerText('body');
    const panel = text.match(/Target\s*\n[^\n]*\n([^\n]+)\n[^\n]*Asteroid · ([\d.]+) (km|m)\b/);
    if (!panel) return 'no rock in the Target panel';
    const row = text.match(new RegExp(`\\n${panel[1]}\\n([\\d.]+) (km|m)\\n`));
    if (!row) return `no Overview row for ${panel[1]}`;
    return Math.abs(km(panel[2], panel[3]) - km(row[1], row[2]));
  };
  // The Overview used to measure to the rock's centre and the panel to its surface: 4.3 km against 2.6.
  await expect.poll(gap).toBeLessThanOrEqual(0.2);
  expectClean(problems);
});

test('combat: a Light Cannon hit takes 30 off the pirate, as the catalog says', async ({page}) => {
  // No Gunnery skill and a Ferrier, so no bonus: one hit is the catalog's 30 damage.
  const problems = await launch(page, {skills: {gunnery: 0, shieldOp: 0}});
  await flyTo(page, 'Belt Two');
  // Picked from the Overview, not with Tab: under full load Tab may not reach it.
  await page.getByText('Ships', {exact: true}).click();
  await page.getByText('Pirate Frigate', {exact: true}).first().click();
  await expect.poll(() => targetPanel(page)).toMatch(/Pirate Frigate/);
  const pirateShield = async () => {
    const text = await page.innerText('body');
    const m = text.slice(text.indexOf('Pirate Frigate')).match(/SHIELD\s*\n\s*(\d+)\/84/);
    return m ? Number(m[1]) : null;
  };
  await expect.poll(pirateShield).toBe(84);
  await page.keyboard.press('l');
  await expect.poll(() => targetPanel(page), {timeout: 20_000}).toMatch(/Locked/);
  await page.keyboard.press('2');
  // The first value under 84 is after exactly one hit: the next is 3 s later.
  await expect.poll(async () => ((await pirateShield()) ?? 84) < 84, {timeout: 60_000, intervals: [200]}).toBe(true);
  expect(await pirateShield()).toBe(54);
  expectClean(problems);
});
