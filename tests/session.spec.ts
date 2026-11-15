import {expect, test} from '@playwright/test';
import {enterGame, expectClean, openFresh, openWithSave, readSave, RICH, undock, watch, expectTitle} from './helpers';

test('title screen loads clean with no save', async ({page}) => {
  const problems = watch(page);
  await openFresh(page);
  await expect(page.getByText('Mine ore. Haul it home.')).toBeVisible();
  await expect(page.getByTestId('new-game-btn')).toHaveCount(0);
  expectClean(problems);
});

test('the title screen does not wait for images over 1 MB', async ({page}) => {
  const problems = watch(page);
  const images: Array<{url: string; bytes: number}> = [];
  page.on('response', async (r) => {
    if (!/\.(png|jpe?g|webp)$/.test(new URL(r.url()).pathname)) return;
    const bytes = Number(r.headers()['content-length'] ?? (await r.body().catch(() => Buffer.alloc(0))).length);
    images.push({url: r.url().split('/').pop()!, bytes});
  });
  await openFresh(page);
  // The full portrait sheets (8192x1792, about 3.7 MB each) were preloaded but never drawn.
  expect(images.map((i) => i.url)).not.toContain('dock_officer.png');
  expect(images.map((i) => i.url)).not.toContain('mission_agent_osk.png');
  expect(images.filter((i) => i.bytes > 1_000_000)).toEqual([]);
  expect(images.length, 'no images were seen loading').toBeGreaterThan(20);
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
  await expectTitle(page);
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
  await expectTitle(page);
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
  await expectTitle(page);
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

for (const [width, height] of [[1024, 640], [1920, 1080], [800, 600], [844, 390]] as const) {
  test(`the stage fits a ${width}x${height} window with every HUD control on screen`, async ({page}) => {
    const problems = watch(page);
    await page.setViewportSize({width, height});
    await openWithSave(page, RICH);
    await enterGame(page);
    await undock(page);
    const cutOff = await page.$$eval('button', (buttons) => {
      const names: string[] = [];
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
          names.push((b.innerText || '').replace(/\s+/g, ' ').slice(0, 30));
        }
      }
      return names;
    });
    expect(cutOff, 'controls outside the window').toEqual([]);
    expectClean(problems);
  });
}
