import {expect, test, type Page} from '@playwright/test';
import {enterGame, expectClean, expectTitle, openWithSave, RICH, settle, watch} from './helpers';

// A one-shot tip shows once, the first time a station terminal opens, and is
// then marked seen. It has to be readable on top of the terminal it explains.

/** True when the middle of the toast holding `text` is the toast itself, not something drawn over it. */
async function toastOnTop(page: Page, text: string) {
  return page.evaluate((t) => {
    const leaf = (Array.from(document.querySelectorAll('body *')) as HTMLElement[]).find(
      (e) => e.children.length === 0 && (e.innerText || '').includes(t),
    );
    if (!leaf) return {found: false, onTop: false, inWindow: false};
    // The toast stack lets clicks through, and elementFromPoint skips such
    // elements, so ask for hits as if it took them.
    const style = document.createElement('style');
    style.textContent = '* { pointer-events: auto !important; }';
    document.head.appendChild(style);
    const r = leaf.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    style.remove();
    const inWindow = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    return {found: true, onTop: !!hit && (leaf === hit || leaf.contains(hit) || hit.contains(leaf)), inWindow};
  }, text);
}

const CASES = [
  {width: 800, height: 600, key: '2', tip: 'FITTING DECK:'},
  {width: 1280, height: 800, key: '2', tip: 'FITTING DECK:'},
  {width: 800, height: 600, key: '3', tip: 'SKILLS TERMINAL:'},
];

for (const c of CASES) {
  test(`tips: at ${c.width}x${c.height} the "${c.tip}" tip shows on top of its terminal`, async ({page}) => {
    await page.setViewportSize({width: c.width, height: c.height});
    const problems = watch(page);
    await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true});
    await enterGame(page);
    await settle(page);
    await page.keyboard.press(c.key);
    await expect(page.getByText(c.tip).first()).toBeAttached();
    expect(await toastOnTop(page, c.tip)).toEqual({found: true, onTop: true, inWindow: true});
    expectClean(problems);
  });
}

test('tips: a tip still showing when the pilot quits does not show on the title screen', async ({page}) => {
  const problems = watch(page);
  await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true});
  await enterGame(page);
  await settle(page);
  await page.keyboard.press('2');
  await expect(page.getByText('FITTING DECK:').first()).toBeVisible();
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', {name: /^Quit/}).click();
  await expectTitle(page);
  // Read once, at once: the toast lives 4.5 s, so a retrying toHaveCount(0)
  // would pass by waiting for it to expire.
  expect(await page.getByText('FITTING DECK:').count()).toBe(0);
  expectClean(problems);
});

// Docked, a toast's text stops at two lines and ends in "...". Each terminal tip has to fit,
// or the end of it is lost (the Operations Desk tip used to lose the Gate Access Permit).
const TIPS = [
  {key: '2', tip: 'FITTING DECK:'},
  {key: '3', tip: 'SKILLS TERMINAL:'},
  {key: '4', tip: 'OPERATIONS DESK (OSK VARRAN):'},
];
for (const size of [{width: 800, height: 600}, {width: 1280, height: 800}]) {
  test(`tips: at ${size.width}x${size.height} each terminal tip shows in full`, async ({page}) => {
    await page.setViewportSize(size);
    const problems = watch(page);
    await openWithSave(page, {...RICH, milestoneIndustrialistClaimed: true});
    await enterGame(page);
    for (const t of TIPS) {
      await settle(page);
      await page.keyboard.press(t.key);
      await expect(page.getByText(t.tip).first()).toBeVisible();
      const box = await page.evaluate((text) => {
        const el = (Array.from(document.querySelectorAll('body *')) as HTMLElement[]).find((e) =>
          Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').includes(text)),
        )!;
        return {scroll: el.scrollHeight, client: el.clientHeight};
      }, t.tip);
      expect(box.scroll, `the ${t.tip} tip is cut off`).toBeLessThanOrEqual(box.client + 1);
      await page.keyboard.press('Escape');
    }
    expectClean(problems);
  });
}
