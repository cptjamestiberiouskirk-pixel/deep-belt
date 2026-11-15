import {expect, test} from '@playwright/test';
import {enterGame, expectClean, openFresh, openWithSave, readSave, RICH, undock, watch} from './helpers';

test('title screen loads clean with no save', async ({page}) => {
  const problems = watch(page);
  await openFresh(page);
  await expect(page.getByText('Mine ore. Haul it home.')).toBeVisible();
  await expect(page.getByTestId('new-game-btn')).toHaveCount(0);
  expectClean(problems);
});

test('a save made while docked resumes docked', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, marks: 4321});
  await expect(page.getByText(/Resume saved session/)).toBeVisible();
  await enterGame(page);
  await expect(page.getByText('4,321')).toBeVisible();
  expectClean(problems);
});

test('a save made in space resumes in space', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, RICH);
  await enterGame(page);
  await undock(page);
  await expect.poll(async () => (await readSave(page))!.isDocked).toBe(false);
  await page.reload();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Overview', {exact: true})).toBeVisible();
  await expect(page.getByText('Docked · safe')).toBeHidden();
  expectClean(problems);
});

test('quitting training at step one and continuing still allows an undock', async ({page}) => {
  const problems = watch(page);
  await openFresh(page);
  await enterGame(page);
  await page.reload();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Docked · safe')).toBeVisible();
  await undock(page);
  await expect(page.getByText('TRAINING STEP 2 OF 7')).toBeVisible();
  expectClean(problems);
});

test('new game asks before erasing a save', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, marks: 777});
  await page.getByTestId('new-game-btn').click();
  await expect(page.getByTestId('new-game-confirm-modal')).toBeVisible();
  await page.getByTestId('cancel-new-game-btn').click();
  await expect(page.getByTestId('new-game-confirm-modal')).toBeHidden();
  expect((await readSave(page))!.marks).toBe(777);

  await page.getByTestId('new-game-btn').click();
  await page.getByTestId('confirm-new-game-btn').click();
  await expect(page.getByText('Docked · safe')).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.marks).toBe(0);
  await expect(page.getByText('TRAINING STEP 1 OF 7')).toBeVisible();
  expectClean(problems);
});

test('help and the game menu open and close', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, RICH);
  await enterGame(page);

  await page.keyboard.press('h');
  await expect(page.getByText('Controls & Help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Controls & Help')).toBeHidden();

  await page.getByTestId('menu-button').click();
  await page.getByRole('button', {name: /^Quit/}).click();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
  await expect(page.getByText(/Resume saved session/)).toBeVisible();
  expectClean(problems);
});

test('restart from the game menu asks first, then starts a clean new game', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, marks: 888, skills: {mining: 2}});
  await enterGame(page);
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', {name: /^Restart run/}).click();
  await expect(page.getByTestId('new-game-confirm-modal')).toBeVisible();
  await page.getByTestId('cancel-new-game-btn').click();
  expect((await readSave(page))!.marks).toBe(888);

  await page.getByTestId('new-game-btn').click();
  await page.getByTestId('confirm-new-game-btn').click();
  await expect(page.getByText('TRAINING STEP 1 OF 7')).toBeVisible();
  await expect(page.getByText('Docked · safe')).toBeVisible();
  const save = (await readSave(page))!;
  expect(save.marks).toBe(0);
  expect(save.tutorialDone).toBe(false);
  expectClean(problems);
});
