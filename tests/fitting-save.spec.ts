import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, LEGACY_SAVE_KEY, openWithSave, readSave, RICH, settle, watch} from './helpers';
import {MODULES} from '../content/modules';

// Step 2a of design/content-tree.md: the fitting is saved as hangar, fitted
// slots and per-hull loadouts (save v5), and v4 saves convert on load.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};

const ownedCount = (f: {hangar: Record<string, number>; fitted: Array<string | null>}) =>
  Object.values(f.hangar).reduce((a, b) => a + b, 0) + f.fitted.filter(Boolean).length;

async function reloadAndEnter(page: Page) {
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
}

async function board(page: Page, hull: string) {
  await settle(page);
  await page.keyboard.press('6');
  await expect(page.getByText(/^HANGAR$/).first()).toBeVisible();
  await settle(page);
  await page.locator('button:visible', {hasText: /^Board/}).first().click();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe(hull);
  await page.keyboard.press('Escape');
}

test('save: a v4 fitting loads as the same modules, and the v4 save is removed', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    upgrades: {laserMk2: true, cargoExpanded: true, shieldBoosterHeavy: true, cannon: true},
    fittedSlots: {slot1MiningLaser: true, slot2CargoExpander: true, slot3ShieldBooster: false, slot4Cannon: true},
  });
  await enterGame(page);
  // The Expanded Hold is still fitted: 1,100 m³, as in v4.
  await expect(page.getByText(/\/1100m³/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.fitting?.fitted).toEqual(['miner_mk2', 'expanded_hold', null, 'light_cannon']);
  expect((await readSave(page))!.fitting.hangar).toEqual({shield_booster: 1});
  expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_SAVE_KEY)).toBeNull();
  expectClean(problems);
});

test('market: a module with no free slot of its type waits in the hangar', async ({page}) => {
  const problems = watch(page);
  // A Tern pilot who never owned the cannon. The Tern has no weapon slot.
  await openWithSave(page, {
    ...BASE,
    ownedHulls: ['ferrier', 'tern'],
    activeHull: 'tern',
    upgrades: {cannon: false},
    fittedSlots: {slot4Cannon: true},
  });
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))?.fitting?.hangar).toEqual({});
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  const name = MODULES.light_cannon.name;
  const card = page.locator('div', {hasText: name, has: page.getByRole('button', {name: 'Buy'})}).last();
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText(`${name} stored`)).toBeVisible();
  await expect(page.getByText(/No free weapon slot on this hull/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.fitting.hangar).toEqual({light_cannon: 1});
  expect((await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', null, null]);
  expectClean(problems);
});

test('hangar: each hull keeps its own fitting across a reload', async ({page}) => {
  const problems = watch(page);
  // The Ferrier owns an Expanded Hold but has it in the hangar.
  await openWithSave(page, {
    ...BASE,
    ownedHulls: ['ferrier', 'skirmisher'],
    upgrades: {cargoExpanded: true},
    fittedSlots: {slot2CargoExpander: false},
  });
  await enterGame(page);
  await expect.poll(async () => (await readSave(page))?.fitting?.fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);

  // On the Skirmisher, fit the hold.
  await board(page, 'skirmisher');
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await settle(page);
  await page.locator('button:visible', {hasText: /^Fit$/}).first().click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  await page.keyboard.press('Escape');

  // Back on the Ferrier the hold goes back to the hangar: the Ferrier never had it fitted.
  await board(page, 'ferrier');
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', null, null, 'light_cannon']);
  expect((await readSave(page))!.fitting.hangar).toEqual({expanded_hold: 1});

  // Each hull's loadout survives a reload (before step 2 it lived only in memory).
  await reloadAndEnter(page);
  await board(page, 'skirmisher');
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', 'expanded_hold', null, 'light_cannon']);
  const save = (await readSave(page))!;
  expect(save.fitting.hangar).toEqual({});
  expect(ownedCount(save.fitting)).toBe(3);
  expectClean(problems);
});

async function openFitting(page: Page) {
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText(/^FITTING$/).first()).toBeVisible();
  await settle(page);
}

test('fitting: each slot sits under its own label, and a hull without a weapon slot says so', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ownedHulls: ['ferrier', 'tern'],
    activeHull: 'tern',
    upgrades: {cargoExpanded: true},
    fittedSlots: {slot2CargoExpander: false},
  });
  await enterGame(page);
  await openFitting(page);
  // The Tern's two utility slots are numbered; a type with one slot is not.
  for (const header of ['EXTRACTION', 'UTILITY 1', 'UTILITY 2', 'WEAPON']) {
    await expect(page.getByText(header, {exact: true}).first()).toBeVisible();
  }
  await expect(page.getByText('None on this hull', {exact: true})).toBeVisible();

  // The cannon waits in the hangar: its Fit is disabled and says why.
  const cannon = page.getByTestId('hangar-light_cannon');
  await expect(cannon).toContainText('×1');
  await expect(cannon).toContainText('No weapon slot on this hull');
  await expect(cannon.getByRole('button', {name: 'Fit'})).toBeDisabled();

  // The hold fits into the first utility slot.
  await page.getByTestId('hangar-expanded_hold').getByRole('button', {name: 'Fit'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toEqual(['miner_mk1', 'expanded_hold', null]);
  await expect(page.getByTestId('fitting-slot-1')).toContainText('Expanded Hold');
  await expect(page.getByTestId('hangar-expanded_hold')).toHaveCount(0);
  expectClean(problems);
});

const GANTRY = {...BASE, ownedHulls: ['ferrier', 'gantry'], activeHull: 'gantry'};

test('fitting: slot tiles line up row for row across the two columns, filled or empty', async ({page}) => {
  const problems = watch(page);
  // A Ferrier with one utility slot empty: miner and hold on row 1, cannon and the empty slot on row 2.
  await openWithSave(page, {...BASE, fitting: {hangar: {}, fitted: ['miner_mk1', 'expanded_hold', null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByTestId('fitting-slot-2')).toContainText('EMPTY');
  const top = async (i: number) => (await page.getByTestId(`fitting-slot-${i}`).boundingBox())!.y;
  expect(await top(1)).toBe(await top(0));
  expect(await top(2)).toBe(await top(3));
  expect(await top(2)).toBeGreaterThan(await top(1));
  expectClean(problems);
});

test('market: a Gantry pilot can own three Expanded Holds, each adding 500 m³', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...GANTRY, upgrades: {cargoExpanded: true}, fittedSlots: {slot2CargoExpander: true}});
  await enterGame(page);
  // 2,000 m³ Gantry hold plus one Expanded Hold.
  await expect(page.getByText(/\/2500m³/)).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByText('Sell cargo')).toBeVisible();
  const name = MODULES.expanded_hold.name;
  const card = page.locator('div', {hasText: name, has: page.getByRole('button', {name: 'Buy'})}).last();
  await expect(card).toContainText('1 owned');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText(/\/3000m³/)).toBeVisible();
  await expect(card).toContainText('2 owned');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect(page.getByText(/\/3500m³/)).toBeVisible();
  // The third is the most allowed: the card says Owned and has no Buy button.
  await expect(page.locator('div', {hasText: name}).filter({hasText: 'Owned ✓'}).last()).toBeVisible();
  await expect
    .poll(async () => (await readSave(page))!.fitting.fitted)
    .toEqual(['miner_mk1', 'expanded_hold', 'expanded_hold', 'expanded_hold', 'light_cannon']);
  expect((await readSave(page))!.cargoMax).toBe(3500);
  expectClean(problems);
});

test('save: a Gantry fitting from before its third utility slot keeps its cannon fitted', async ({page}) => {
  const problems = watch(page);
  const old = ['miner_mk1', 'expanded_hold', 'shield_booster', 'light_cannon'];
  await openWithSave(page, {
    ...GANTRY,
    upgrades: {cargoExpanded: true, shieldBoosterHeavy: true},
    fitting: {hangar: {}, fitted: old, loadouts: {gantry: old}},
  });
  await enterGame(page);
  await expect
    .poll(async () => (await readSave(page))?.fitting?.fitted)
    .toEqual(['miner_mk1', 'expanded_hold', 'shield_booster', null, 'light_cannon']);
  await openFitting(page);
  await expect(page.getByTestId('fitting-slot-4')).toContainText('Light Cannon');
  await expect(page.getByTestId('fitting-slot-3')).toContainText('EMPTY');
  expectClean(problems);
});

test('fitting: at 800x600 the hangar list and Ship stats can be reached', async ({page}) => {
  await page.setViewportSize({width: 800, height: 600});
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    upgrades: {cargoExpanded: true, shieldBoosterHeavy: true},
    fittedSlots: {slot2CargoExpander: false, slot3ShieldBooster: false},
  });
  await enterGame(page);
  await openFitting(page);
  const inView = async (target: ReturnType<Page['getByText']>) => {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    return box.y >= 0 && box.y + box.height <= 600 && box.x >= 0 && box.x + box.width <= 800;
  };
  const fit = page.getByTestId('hangar-shield_booster').getByRole('button', {name: 'Fit'});
  expect(await inView(fit)).toBe(true);
  await fit.click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('shield_booster');
  // The last Ship stats row can be scrolled into view, inside the window.
  expect(await inView(page.getByText('Ship stats', {exact: true}))).toBe(true);
  expect(await inView(page.getByText('Capacitor', {exact: true}).last())).toBe(true);
  expectClean(problems);
});

test('fitting: at 800x600 every Ship stats value fits inside its row', async ({page}) => {
  await page.setViewportSize({width: 800, height: 600});
  const problems = watch(page);
  // The longest values: a Bulk Hold's speed cut, and the Lance Driver with its Gunnery bonus.
  await openWithSave(page, {
    ...BASE,
    skills: {mining: 5, laserTuning: 0, gunnery: 3, chargeControl: 0, shieldOp: 5, navigation: 0, cargoTrim: 0},
    fitting: {hangar: {miner_mk1: 1, light_cannon: 1}, fitted: ['miner_mk2', 'bulk_hold', null, 'lance_driver'], loadouts: {}},
  });
  await enterGame(page);
  await openFitting(page);
  const labels = ['Mining yield', 'Mining cycle', 'Cargo hold', 'Max speed', 'Speed, full hold', 'Shield', 'Armor', 'Structure / Hull', 'Cannon', 'Capacitor'];
  const overflow: string[] = [];
  for (const label of labels) {
    const row = page.getByText(label, {exact: true}).last().locator('..');
    await row.scrollIntoViewIfNeeded();
    const m = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const v = (el.lastElementChild as HTMLElement).getBoundingClientRect();
      // The nearest edge that cuts content off: the window, or any ancestor that clips.
      let clipRight = window.innerWidth;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (o.overflowX !== 'visible' || o.overflow !== 'visible') clipRight = Math.min(clipRight, a.getBoundingClientRect().right);
      }
      return {rowRight: Math.min(r.right, clipRight), valueRight: v.right, rowLeft: r.left, valueLeft: v.left, text: (el as HTMLElement).innerText};
    });
    // The value ends inside the row's border and does not run into the label.
    if (m.valueRight > m.rowRight - 2 || m.valueLeft < m.rowLeft) overflow.push(`${label}: "${m.text.replace(/\n/g, ' ')}" value ${m.valueLeft.toFixed(0)}-${m.valueRight.toFixed(0)}, row ${m.rowLeft.toFixed(0)}-${m.rowRight.toFixed(0)}`);
  }
  expect(overflow).toEqual([]);
  expectClean(problems);
});
