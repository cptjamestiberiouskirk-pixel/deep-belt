import {expect, type Page} from '@playwright/test';

export const SAVE_KEY = 'deep_belt_session_v4';

/** Anything the page logs as an error, or throws, during a test. */
export interface Problems {
  errors: string[];
  external: string[];
}

/**
 * Starts watching the page for runtime errors, console errors and requests to
 * other origins. Call before the first navigation.
 */
export function watch(page: Page): Problems {
  const problems: Problems = {errors: [], external: []};
  page.on('pageerror', (e) => problems.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('request', (r) => {
    const url = r.url();
    if (/^https?:/.test(url) && !url.startsWith('http://localhost')) problems.external.push(url);
  });
  return problems;
}

export function expectClean(problems: Problems) {
  expect(problems.errors, 'runtime or console errors').toEqual([]);
  expect(problems.external, 'requests to other origins').toEqual([]);
}

/** Opens the title screen with no save data. */
export async function openFresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
}

/** Opens the title screen with the given save, merged over a real fresh save. */
export async function openWithSave(page: Page, patch: Record<string, unknown>) {
  await openFresh(page);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Docked · safe')).toBeVisible();
  await expect.poll(() => readSave(page)).not.toBeNull();
  await page.evaluate(
    ([key, p]) => {
      const base = JSON.parse(localStorage.getItem(key as string) || '{}');
      localStorage.setItem(key as string, JSON.stringify({...base, ...(p as object)}));
    },
    [SAVE_KEY, patch] as const,
  );
  await page.reload();
  await expect(page.getByTestId('start-game-btn')).toBeVisible();
}

/** Starts or continues from the title screen and waits for the docked view. */
export async function enterGame(page: Page) {
  await page.keyboard.press('Enter');
  await expect(page.getByText('Docked · safe')).toBeVisible();
}

export async function readSave(page: Page): Promise<Record<string, any> | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

export async function bodyText(page: Page): Promise<string> {
  return (await page.innerText('body')).replace(/\n+/g, ' | ');
}

/** The current tutorial coach heading, such as "TRAINING STEP 2 OF 7". */
export async function coachStep(page: Page): Promise<number | null> {
  const m = (await page.innerText('body')).match(/TRAINING STEP (\d) OF 7/);
  return m ? Number(m[1]) : null;
}

export async function undock(page: Page) {
  // A key pressed in the first moments after docking or loading can land
  // inside the station's 0.3 s input debounce, so press until it takes.
  await expect(async () => {
    await page.keyboard.press('u');
    await expect(page.getByText('Docked · safe')).toBeHidden({timeout: 1500});
  }).toPass({timeout: 20_000});
  await expect(page.getByText('Overview', {exact: true})).toBeVisible();
}

/** Opens the warp menu, picks a destination by its visible name, and confirms. */
export async function warpTo(page: Page, name: string) {
  const title = page.getByText('Warp to…', {exact: true});
  await page.keyboard.press('m');
  await expect(title).toBeVisible();
  // Each row shows its shortcut key on the line above the destination name.
  const key = await title.evaluate((el, wanted) => {
    let panel: HTMLElement | null = el as HTMLElement;
    while (panel && !panel.innerText.includes('Enter')) panel = panel.parentElement;
    const lines = (panel?.innerText ?? '').split('\n').map((l) => l.trim());
    // The map above the list repeats some names, so take the list row.
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === wanted && /^[0-9-]$/.test(lines[i - 1])) return lines[i - 1];
    }
    return null;
  }, name);
  expect(key, `warp menu has no destination named ${name}`).toMatch(/^[0-9-]$/);
  await page.keyboard.press(key!);
  if (await title.isVisible()) await page.keyboard.press('Enter');
  await expect(title).toBeHidden();
}

/** A skills block good enough to pass any skill gate in tests. */
export const RICH = {marks: 500_000, tutorialDone: true, tutorialStep: 7, tutorialBonusClaimed: true};

/** Laser and asteroid frequencies as shown in the Target panel: "FREQ 2 / 3". */
async function readFreq(page: Page): Promise<{laser: number; rock: number} | null> {
  const m = (await page.innerText('body')).match(/FREQ\s+(\d)\s*\/\s*(\d)/);
  return m ? {laser: Number(m[1]), rock: Number(m[2])} : null;
}

/** Tunes the mining laser to the selected asteroid with the [ and ] keys. */
export async function tuneLaser(page: Page) {
  for (let i = 0; i < 6; i++) {
    const f = await readFreq(page);
    expect(f, 'Target panel shows no FREQ readout').not.toBeNull();
    if (f!.laser === f!.rock) return;
    await page.keyboard.press(f!.laser < f!.rock ? ']' : '[');
    await page.waitForTimeout(250);
  }
  throw new Error('laser frequency never matched the asteroid');
}

/** The label under the Mine button: "ready", "cycling 3/10s", "HEAT 54%", "no target". */
export async function mineState(page: Page): Promise<string> {
  const labels = await page.$$eval('button', (bs) =>
    bs.map((b) => (b.innerText || '').replace(/\n+/g, ' ').trim()).filter((t) => t.startsWith('Mine')),
  );
  return labels[0] ?? '';
}

/**
 * Mines until `done` returns true: selects the nearest asteroid, tunes the
 * laser, starts it, and restarts on a new rock whenever the laser goes idle.
 */
export async function mineUntil(page: Page, done: () => Promise<boolean>, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await done()) return;
    const state = await mineState(page);
    if (/ready|no target/.test(state)) {
      if (!(await readFreq(page))) await page.keyboard.press('Tab');
      await tuneLaser(page);
      await page.keyboard.press('1');
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`mining did not finish in ${timeoutMs} ms; Mine button shows "${await mineState(page)}"`);
}

/**
 * Wait until a station terminal is ready for Enter. Two things swallow an
 * early key press by design: the 0.3 s station input debounce, and the
 * officer's line still typing (Enter then means "[Enter] Skip").
 */
export async function settle(page: Page) {
  await page.waitForTimeout(450);
  await expect(page.getByText('[Enter] Skip')).toHaveCount(0, {timeout: 20_000});
  await page.waitForTimeout(100);
}
