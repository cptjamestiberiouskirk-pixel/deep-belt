import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, openWithSave, RICH, settle, watch} from './helpers';
import {MODULES} from '../content/modules';

// The Skirmisher's +25% applies to whichever weapon is fitted, in combat and in
// Ship stats. Its card said "+25% Light Cannon fire damage bonus", written
// before the Lance Driver existed.

const BASE = {...RICH, milestoneIndustrialistClaimed: true};
const NO_SKILLS = {skills: {mining: 0, laserTuning: 0, lowProfile: 0, gunnery: 0, chargeControl: 0, shieldOp: 0, boosterEfficiency: 0, armorLayering: 0, navigation: 0, cargoTrim: 0, refining: 0, signalAnalysis: 0}};
const SKIRMISHER = {ownedHulls: ['ferrier', 'skirmisher'], activeHull: 'skirmisher'};
const LANCE = MODULES.lance_driver.stats;

async function openTab(page: Page, key: string, title: string | RegExp) {
  await settle(page);
  await page.keyboard.press(key);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('skirmisher: the Hangar card names a bonus to weapon damage, not to the Light Cannon alone', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...SKIRMISHER});
  await enterGame(page);
  await openTab(page, '6', /^HANGAR$/);
  const card = page.getByTestId('hangar-hull-skirmisher');
  await expect(card).toContainText('Skirmisher');
  expect(await card.getByText(/Light Cannon/).count()).toBe(0);
  await expect(card).toContainText('+25% weapon damage');
  expectClean(problems);
});

test('skirmisher: Ship stats shows a Lance Driver with the +25%', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...BASE, ...NO_SKILLS, ...SKIRMISHER, fitting: {hangar: {}, fitted: ['miner_mk1', null, null, 'lance_driver'], loadouts: {}}});
  await enterGame(page);
  await openTab(page, '2', /^FITTING$/);
  const hit = Math.round(LANCE.damage! * 1.25);
  expect([LANCE.damage, hit]).toEqual([47, 59]);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText(`${hit} dmg / ${LANCE.cycleSec}s`);
  await expect(page.getByTestId('ship-stat-cannon')).toContainText(`(+${hit - LANCE.damage!} +25%)`);
  expectClean(problems);
});
