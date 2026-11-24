import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, readSave, RICH, settle, undock, watch} from './helpers';
import {MARKET_MODULE_IDS, MODULES, missingSkill} from '../content/modules';
import {fittedTotal, toLegacy} from '../content/fitting';

// Step 33 of design/content-tree.md: Shield Booster II, the tier step of the
// Shield Booster (rule 3). 12 shield HP a second, not 8, for the same 25 Cap and
// 3 s cycle, behind Shield Operation V. 2,400 MARKS at the station market; one only.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const SKILLS_AT = (shieldOp: number) => ({
  skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0},
});
const PLAIN = {fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}};
const fitted = (second: string) => ({fitting: {hangar: {}, fitted: ['miner_mk1', second, null, 'light_cannon'], loadouts: {}}});

test('catalog: Shield Booster II is a utility module for 2,400 MARKS behind Shield Operation V', () => {
  expect(MODULES.shield_booster_ii).toMatchObject({
    name: 'Shield Booster II',
    group: 'Shield boosters',
    tier: 2,
    slot: 'utility',
    basePrice: 2400,
    statBadge: '+12 HP/s pulse',
    stats: {shieldHpPerSec: 12, cycleSec: 3, capPerCycle: 25},
    requires: {skill: 'shieldOp', level: 5},
  });
  expect(MODULES.shield_booster_ii.maxOwned).toBeUndefined(); // one only
  // The same cycle and Cap as the Booster I, with half as much shield again.
  expect(MODULES.shield_booster.stats).toMatchObject({shieldHpPerSec: 8, cycleSec: 3, capPerCycle: 25});
  expect(MARKET_MODULE_IDS).toEqual(['miner_mk2', 'miner_mk3', 'expanded_hold', 'expanded_hold_ii', 'bulk_hold', 'bulk_hold_ii', 'shield_booster', 'shield_booster_ii', 'composite_armor', 'composite_armor_ii', 'fire_control', 'fire_control_ii', 'light_cannon', 'light_cannon_ii', 'lance_driver', 'lance_driver_ii']);
  expect(missingSkill({shieldOp: 4}, 'shield_booster_ii')).toBe('Shield Operation V');
  expect(missingSkill({shieldOp: 5}, 'shield_booster_ii')).toBeNull();
  // It arms the same Boost [3] controls as the Shield Booster.
  const legacy = toLegacy({hangar: {}, fitted: ['miner_mk1', 'shield_booster_ii', null, 'light_cannon'], loadouts: {}});
  expect(legacy.fittedSlots.slot3ShieldBooster).toBe(true);
  expect(legacy.upgrades.shieldBoosterHeavy).toBe(true);
  // In the hangar only, it is owned but not fitted.
  const stored = toLegacy({hangar: {shield_booster_ii: 1}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}});
  expect(stored.fittedSlots.slot3ShieldBooster).toBe(false);
  expect(stored.upgrades.shieldBoosterHeavy).toBe(true);
  // On a Gantry next to a Booster I, the two add up.
  expect(fittedTotal(['miner_mk1', 'shield_booster', 'shield_booster_ii', null, 'light_cannon'], 'shieldHpPerSec')).toBe(20);
});

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

type Probe = {capacitor: number; boosterActive: boolean};
const probe = (page: Page) => page.evaluate(() => (window as any).__DEEP_BELT_PROBE__.player() as Probe);

/** Turns the booster on in space and returns the Cap its first cycle took. */
async function boosterDrop(page: Page): Promise<number> {
  let before = NaN;
  // Keys right after undocking can be swallowed: press until the booster is on,
  // but never once it is on, or a late press would turn it off again.
  await expect(async () => {
    if (!(await probe(page)).boosterActive) {
      before = (await probe(page)).capacitor;
      await page.keyboard.press('3');
    }
    await expect.poll(async () => (await probe(page)).boosterActive, {timeout: 1000}).toBe(true);
  }).toPass({timeout: 15_000});
  return before - (await probe(page)).capacitor;
}

const boostButton = (page: Page) => page.locator('button[title^="Boost [3]"]');

test('market: at Shield Operation IV the Shield Booster II card says what it needs and has no Buy', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(4), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-shield_booster_ii');
  await expect(card).toContainText('Shield Booster II');
  await expect(card).toContainText('+12 HP/s pulse');
  await expect(card).toContainText('Needs Shield Operation V');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  // The Booster I next to it needs no skill.
  await expect(page.getByTestId('market-card-shield_booster').getByRole('button', {name: 'Buy'})).toHaveCount(1);
  expect((await readSave(page))!.marks).toBe(before.marks);
  expectClean(problems);
});

test('shield booster II: at Shield Operation V bought into a free slot, kept on reload, and boosts 18 HP/s for 25 Cap', async ({page}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...PLAIN});
  await enterGame(page);
  const before = (await readSave(page))!;

  // Buy: the Ferrier has a free utility slot, so it is fitted at once.
  await openTab(page, '1', 'Sell cargo');
  const card = page.getByTestId('market-card-shield_booster_ii');
  await expect(card).not.toContainText('Needs');
  await card.getByRole('button', {name: 'Buy'}).click();
  await expect.poll(async () => (await readSave(page))!.fitting.fitted).toContain('shield_booster_ii');
  expect((await readSave(page))!.marks).toBe(before.marks - 2400);
  // One only: the card now says Owned, with no Buy.
  await expect(card).toContainText('Owned');
  expect(await card.getByRole('button', {name: 'Buy'}).count()).toBe(0);
  await page.keyboard.press('Escape');

  // Reload (docked): still fitted.
  await page.waitForTimeout(6000); // past one autosave
  await page.reload();
  await expectTitle(page);
  await enterGame(page);
  expect((await readSave(page))!.fitting.fitted).toContain('shield_booster_ii');

  // In space the Boost [3] button names it, with Shield Operation V's +50%: 12 x 1.5 = 18.
  await undock(page);
  await expect(boostButton(page)).toBeEnabled();
  await expect(boostButton(page)).toHaveAttribute('title', 'Boost [3] — Shield Booster II (+18 HP/s pulse, 25 Cap)');
  // Cap comes back at 2.5 a second, so a reading taken a few frames late is off by under 1.5.
  const drop = await boosterDrop(page);
  expect(Math.abs(drop - 25)).toBeLessThanOrEqual(1.5);
  expectClean(problems);
});

test('space: the Shield Booster I button still names it, at 12 HP/s with Shield Operation V', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), ...fitted('shield_booster')});
  await enterGame(page);
  await undock(page);
  await expect(boostButton(page)).toBeEnabled();
  await expect(boostButton(page)).toHaveAttribute('title', 'Boost [3] — Shield Booster (+12 HP/s pulse, 25 Cap)');
  expectClean(problems);
});

test('space: a Shield Booster II in the hangar, not fitted, leaves Boost [3] off', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKILLS_AT(5), fitting: {hangar: {shield_booster_ii: 1}, fitted: ['miner_mk1', null, null, 'light_cannon'], loadouts: {}}});
  await enterGame(page);
  await undock(page);
  await expect(boostButton(page)).toBeDisabled();
  await expect(boostButton(page)).toContainText('not fitted');
  expectClean(problems);
});

test('space: a Gantry with a Booster I and a Booster II names both and boosts 30 HP/s for 50 Cap', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {
    ...BASE,
    ...SKILLS_AT(5),
    ownedHulls: ['ferrier', 'gantry'],
    activeHull: 'gantry',
    fitting: {hangar: {}, fitted: ['miner_mk1', 'shield_booster', 'shield_booster_ii', null, 'light_cannon'], loadouts: {}},
  });
  await enterGame(page);
  await undock(page);
  // (8 + 12) x 1.5 at Shield Operation V; each booster takes 25 Cap a cycle.
  await expect(boostButton(page)).toHaveAttribute('title', 'Boost [3] — Shield Booster + Shield Booster II (+30 HP/s pulse, 50 Cap)');
  expectClean(problems);
});
