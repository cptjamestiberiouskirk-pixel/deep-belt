import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, watch} from './helpers';

const STOCKED = {
  ...RICH,
  milestoneIndustrialistClaimed: true,
  cargoFerrite: 250,
  cargoAurite: 60,
  cargoChromite: 60,
  cargoTritanium: 100,
  cargoChromiteBar: 50,
};

async function docked(page: Page, patch: Record<string, unknown> = STOCKED) {
  const problems = watch(page);
  await openWithSave(page, patch);
  await enterGame(page);
  return problems;
}

const TERMINALS: Array<[key: string, heading: string | RegExp]> = [
  ['1', 'Sell cargo'],
  ['2', /^FITTING$/],
  ['3', 'SKILLS MATRIX'],
  ['4', 'OPERATIONS (OSK)'],
  ['5', 'HULL REPAIR'],
  ['6', /^HANGAR$/],
  ['r', 'ORE REFINING FACILITY'],
  ['f', /^FABRICATOR$/],
  ['k', /^SCHEMATICS$/],
];

test('every station terminal opens and closes', async ({page}) => {
  const problems = await docked(page);
  for (const [key, heading] of TERMINALS) {
    await page.keyboard.press(key);
    await expect(page.getByText(heading).first(), `terminal on key ${key}`).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(heading).first(), `terminal on key ${key} after Esc`).toBeHidden();
    await expect(page.getByText('Docked · safe')).toBeVisible();
  }
  expectClean(problems);
});

test('market: selling one stack pays for it and empties it', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks + 250 * 12);
  expect(after.cargoAurite).toBe(60);
  expectClean(problems);
});

test('market: sell all empties every ore stack', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('1');
  await page.keyboard.press('s');
  await expect.poll(async () => (await readSave(page))!.cargoFerrite).toBe(0);
  const after = (await readSave(page))!;
  expect(after.cargoAurite).toBe(0);
  expect(after.cargoChromite).toBe(0);
  expect(after.marks).toBeGreaterThan(before.marks);
  expectClean(problems);
});

test('market: a bought Expanded Hold still holds 1,100 m³ after a reload', async ({page}) => {
  const problems = await docked(page, {...RICH, milestoneIndustrialistClaimed: true});
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  // The innermost box holding both the name and a Buy button is the module's card.
  const card = page.locator('div', {hasText: 'Expanded Hold', has: page.getByRole('button', {name: 'Buy'})}).last();
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText(/\/1100m³/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.cargoMax).toBe(1100);

  // The loader used to work the hold out before the fitted modules were back.
  await page.reload();
  await expectTitle(page);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Docked · safe')).toBeVisible();
  await expect(page.getByText(/\/1100m³/)).toBeVisible();
  await page.waitForTimeout(6000); // past one autosave, which would write a wrong value back
  const save = (await readSave(page))!;
  expect(save.cargoMax).toBe(1100);
  expect(save.fittedSlots.slot2CargoExpander).toBe(true);
  expectClean(problems);
});

test('market: buying costs marks', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('1');
  await page.getByRole('button', {name: /^Buy$/, disabled: false}).first().click();
  await expect.poll(async () => (await readSave(page))!.marks).toBeLessThan(before.marks);
  expectClean(problems);
});

test('refinery: 50 ore becomes 25 refined for a fee', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('r');
  await expect(page.getByText('ORE REFINING FACILITY')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await readSave(page))!.cargoTritanium, {timeout: 20_000})
    .toBe(before.cargoTritanium + 25);
  const after = (await readSave(page))!;
  expect(after.cargoFerrite).toBe(before.cargoFerrite - 50);
  expect(after.marks).toBeLessThan(before.marks);
  expectClean(problems);
});

test('skills: training queues a skill and charges for it', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('3');
  await expect(page.getByText('SKILLS MATRIX')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.trainingQueue.length).toBe(1);
  expect((await readSave(page))!.marks).toBe(before.marks - 100);
  expectClean(problems);
});

test('agent: a contract can be accepted and turned in', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('4');
  await expect(page.getByText('OPERATIONS (OSK)')).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await readSave(page))!.missionStatus)
    .toMatch(/active|ready_to_turn_in|completed/);
  // 250 ferrite is already in the hold, so the 200-ore contract can be handed in.
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.missionIndex, {timeout: 20_000}).toBe(1);
  const after = (await readSave(page))!;
  expect(after.marks).toBe(before.marks + 1000);
  expect(after.cargoFerrite).toBe(50);
  expectClean(problems);
});

test('schematics: research starts, charges, and completes', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('k');
  await expect(page.getByText(/^SCHEMATICS$/).first()).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeResearch).not.toBeNull();
  expect((await readSave(page))!.marks).toBeLessThan(before.marks);
  await expect
    .poll(async () => Object.keys((await readSave(page))!.schematicLevels).length, {
      timeout: 60_000,
      intervals: [2000],
    })
    .toBeGreaterThan(0);
  expectClean(problems);
});

test('fabricator: a recipe with materials on hand can be built', async ({page}) => {
  const problems = await docked(page, {
    ...RICH,
    milestoneIndustrialistClaimed: true,
    cargoTritanium: 100,
    cargoChromiteBar: 40,
    cargoAuriteConc: 40,
    cargoPyroxite: 40,
  });
  await page.keyboard.press('f');
  await expect(page.getByText(/^FABRICATOR$/).first()).toBeVisible();
  const before = (await readSave(page))!;
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.activeFabricate).not.toBeNull();
  await expect
    .poll(async () => (await readSave(page))!.activeFabricate, {timeout: 90_000, intervals: [2000]})
    .toBeNull();
  const after = (await readSave(page))!;
  const made = ['cargoHullPlate', 'cargoThrusterCoil', 'cargoSensorCore'].filter((k) => after[k] > before[k]);
  expect(made, 'no fabricated part appeared in the hold').not.toEqual([]);
  expectClean(problems);
});

test('hangar: a new hull can be bought', async ({page}) => {
  const problems = await docked(page);
  const before = (await readSave(page))!;
  await page.keyboard.press('6');
  await expect(page.getByText(/^HANGAR$/).first()).toBeVisible();
  await page.getByRole('button', {name: /^Buy$/, disabled: false}).first().click();
  await expect.poll(async () => (await readSave(page))!.ownedHulls.length).toBe(2);
  expect((await readSave(page))!.marks).toBeLessThan(before.marks);
  expectClean(problems);
});

test('fitting: a module can be unfitted and fitted again', async ({page}) => {
  const problems = await docked(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await settle(page);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))!.fittedSlots.slot1MiningLaser).toBe(false);
  await settle(page);
  await page.locator('button:visible', {hasText: /^Fit$/}).first().click();
  await expect.poll(async () => (await readSave(page))!.fittedSlots.slot1MiningLaser).toBe(true);
  expectClean(problems);
});

test('dock officer: the hold tip names the Expanded Hold the market sells', async ({page}) => {
  const problems = await docked(page, {...RICH, milestoneIndustrialistClaimed: true});
  // The bubble types its line out, and Enter first finishes the typing, then
  // moves on. So Enter is pressed again only while the tip is not on the page.
  const tip = page.getByText(/the market sells an Expanded Hold: \+500 m³/);
  await expect(async () => {
    if (await tip.isVisible()) return;
    await page.keyboard.press('Enter');
    await expect(tip).toBeVisible({timeout: 2500});
  }).toPass({timeout: 30_000});
  expectClean(problems);
});

test('milestone: the 1,000 MARKS banner says the wallet passed it, not that it pays it', async ({page}) => {
  const problems = await docked(page, {...RICH, marks: 950, milestoneIndustrialistClaimed: false, cargoFerrite: 10});
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.getByText('Your wallet passed 1,000 MARKS. The belt notices.')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.marks).toBe(950 + 10 * 12);
  expectClean(problems);
});

test('fitting: at 800x600 each lens bonus stays on one line, clear of the hold count', async ({page}) => {
  await page.setViewportSize({width: 800, height: 600});
  const problems = await docked(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await expect(page.getByText(/^\(?\+40% yield\)?$/).first()).toBeVisible();
  const rows = await page.$$eval('span', (spans) =>
    spans
      .filter((s) => /^\(?\+\d+% yield\)?$/.test((s.textContent ?? '').trim()))
      .map((bonus) => {
        let row = bonus.parentElement;
        while (row && !/Hold: \d/.test(row.textContent ?? '')) row = row.parentElement;
        const hold = [...(row?.querySelectorAll('span') ?? [])].find((s) => /^Hold: \d+$/.test((s.textContent ?? '').trim()));
        const b = bonus.getBoundingClientRect();
        const h = hold!.getBoundingClientRect();
        const style = getComputedStyle(bonus);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
        return {
          text: bonus.textContent,
          lines: Math.round(b.height / lineHeight),
          overlaps: b.right > h.left && b.left < h.right && b.bottom > h.top && b.top < h.bottom,
        };
      }),
  );
  expect(rows).toHaveLength(3);
  for (const r of rows) {
    expect(r.lines, `${r.text} wraps`).toBe(1);
    expect(r.overlaps, `${r.text} runs into the hold count`).toBe(false);
  }
  expectClean(problems);
});
