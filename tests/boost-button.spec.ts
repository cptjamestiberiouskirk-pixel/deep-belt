import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';

// Two checks on the Boost [3] button, from the step 33 review:
// - a booster that was on before docking is off after a hull switch, and stays off on undocking;
// - the "low cap" sub-label uses the fitted boosters' Cap, not a fixed 25.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS = {skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0}};

type Probe = {capacitor: number; maxCapacitor: number; boosterActive: boolean; docked: boolean};
const probe = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Probe);
const boostButton = (page: Page) => page.locator('button[title^="Boost [3]"]');

/** Turns the booster on in space; presses only while it is off, so a late press can't turn it off again. */
async function boosterOn(page: Page) {
  await expect(async () => {
    if (!(await probe(page)).boosterActive) await page.keyboard.press('3');
    await expect.poll(async () => (await probe(page)).boosterActive, {timeout: 1000}).toBe(true);
  }).toPass({timeout: 15_000});
}

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('hull switch: a booster that was on in space is off after docking, boarding the Gantry and undocking', async ({page}) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS,
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'ferrier',
    fitting: {hangar: {}, fitted: ['miner_mk1', 'shield_booster', null, 'light_cannon'], loadouts: {}},
  });
  await enterGame(page);
  await undock(page);
  await boosterOn(page);

  // Dock: read once, right after, so a booster that went off by itself later can't pass this.
  await expect(async () => {
    await page.keyboard.press('f');
    await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 1500});
  }).toPass({timeout: 30_000});
  expect((await probe(page)).boosterActive).toBe(false);

  // Board the Gantry: with no Gantry loadout yet, the booster moves over and is fitted.
  await openTab(page, '6', /^HANGAR$/);
  await page.getByTestId('hangar-hull-gantry').getByRole('button', {name: /Board/}).click();
  await expect(page.getByText('Boarded Gantry Command')).toBeVisible();
  await expect.poll(async () => (await readSave(page))!.activeHull).toBe('gantry');
  expect((await readSave(page))!.fitting.fitted).toContain('shield_booster');
  expect((await probe(page)).boosterActive).toBe(false);
  await page.keyboard.press('Escape');

  // Undock: the booster is fitted and ready, not running, and no cycle takes Cap.
  await undock(page);
  expect((await probe(page)).boosterActive).toBe(false);
  await expect(boostButton(page)).toBeEnabled();
  await expect(boostButton(page)).toContainText('ready');
  const cap0 = (await probe(page)).capacitor;
  await page.waitForTimeout(4000); // longer than one 3 s cycle
  const after = await probe(page);
  expect(after.boosterActive).toBe(false);
  expect(after.capacitor).toBeGreaterThanOrEqual(cap0);
  expectClean(problems);
});

test('low cap: a Gantry with two boosters (50 Cap a cycle) reads "low cap" between 25 and 50 Cap', async ({page}) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS,
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'gantry',
    fitting: {hangar: {}, fitted: ['miner_mk1', 'shield_booster', 'shield_booster_ii', null, 'light_cannon'], loadouts: {}},
  });
  await enterGame(page);
  await undock(page);
  await expect(boostButton(page)).toHaveAttribute('title', /\(\+20 HP\/s pulse, 50 Cap\)$/);

  // Run the boosters until a cycle finds under 50 Cap and turns them off.
  await boosterOn(page);
  await expect.poll(async () => (await probe(page)).boosterActive, {timeout: 30_000}).toBe(false);

  // Cap comes back at 2.5 a second. Between 26 and 48 the button can't start a cycle,
  // so the sub-label must say so.
  await expect.poll(async () => (await probe(page)).capacitor, {timeout: 30_000}).toBeGreaterThanOrEqual(26);
  const cap = (await probe(page)).capacitor;
  expect(cap).toBeLessThan(48);
  await expect(boostButton(page)).toBeDisabled();
  await expect(boostButton(page)).toContainText('low cap');
  expectClean(problems);
});
