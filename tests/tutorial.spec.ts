import {expect, test} from '@playwright/test';
import {coachStep, enterGame, expectClean, mineUntil, openFresh, readSave, tuneLaser, undock, warpTo, watch} from './helpers';

test('a new pilot can finish the whole training loop', async ({page}) => {
  test.setTimeout(480_000);
  const problems = watch(page);
  await openFresh(page);
  await enterGame(page);
  expect(await coachStep(page)).toBe(1);

  // Step 1: undock.
  await undock(page);
  await expect.poll(() => coachStep(page)).toBe(2);

  // Step 2: warp to Belt One.
  await warpTo(page, 'Belt One');
  await expect.poll(() => coachStep(page), {timeout: 60_000}).toBe(3);

  // Step 3: lock an asteroid.
  await page.keyboard.press('Tab');
  await expect(page.getByText(/Asteroid ·/).first()).toBeVisible();
  await page.keyboard.press('l');
  await expect.poll(() => coachStep(page), {timeout: 60_000}).toBe(4);

  // Step 4: tune the laser to the rock, then mine at least 50 ferrite.
  await tuneLaser(page);
  await mineUntil(page, async () => (await coachStep(page)) === 5);
  expect((await readSave(page))!.inventory?.ferrite).toBeGreaterThanOrEqual(50);

  // Step 5: warp home.
  await warpTo(page, 'Harrow Station Alpha');
  await expect.poll(() => coachStep(page), {timeout: 60_000}).toBe(6);

  // Step 6: dock.
  await page.keyboard.press('f');
  await expect(page.getByText('Docked · safe')).toBeVisible({timeout: 60_000});
  await expect.poll(() => coachStep(page)).toBe(7);

  // Step 7: sell the ore and collect the bonus.
  await page.keyboard.press('1');
  await expect(page.getByText(/Sell all/).first()).toBeVisible();
  await page.keyboard.press('s');
  await expect.poll(async () => (await readSave(page))!.marks, {timeout: 20_000}).toBeGreaterThanOrEqual(100);
  const save = (await readSave(page))!;
  expect(save.inventory.ferrite).toBe(0);
  expect(save.tutorialDone).toBe(true);
  expect(save.tutorialBonusClaimed).toBe(true);
  expectClean(problems);
});

test('training: the title button and the warp step say what happens next', async ({page}) => {
  const problems = watch(page);
  await openFresh(page);
  // A new game starts docked, so the button does not promise an undock.
  await expect(page.getByTestId('start-game-btn')).toContainText('Start at Harrow Station');
  await expect(page.getByTestId('start-game-btn')).not.toContainText('Undock');
  await enterGame(page);
  await undock(page);
  await expect.poll(() => coachStep(page)).toBe(2);
  // Warp [M] opens a list; the coach says to press Enter in it.
  await expect(page.getByText('In the list that opens, press Enter to jump.')).toBeVisible();
  expectClean(problems);
});
