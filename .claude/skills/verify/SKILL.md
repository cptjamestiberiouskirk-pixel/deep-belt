---
name: verify
description: Run and drive Deep Belt to check that a change works in the game, before committing it. Use after a change a player could see or feel (a screen, a number, flight, combat, mining, a save) and whenever asked to verify, play-test or screenshot the game. TESTING.md says when; this says how.
---

# Verify a Deep Belt change

The goal is evidence: what ran, what the game showed, and whether that matches what the change was meant to do. Report each claim as CONFIRMED (seen), INFERRED or HYPOTHESIZED.

## 1. Pick the route

- **A throwaway Playwright spec**, for a state that takes setup (a save with skills, modules, cargo) or a number to measure. Name it `tests/tmp-<topic>.spec.ts`, run it, read what it prints, and delete it before any commit. It runs on the production build at port 4173, which the suite owns.
- **The built-in browser**, to show the user, or to look around freely. Run `npm run build`, then serve on port 4174 (`preview_start` with `deep-belt-playtest` from `.claude/launch.json` in Claude Desktop, or `npm run preview -- --port 4174 --strictPort` with the browser tool elsewhere). Never leave a preview on 4173: the suite then stops with "already used".

## 2. Mute the game first

- Playwright is muted already (`--mute-audio` in `playwright.config.ts`).
- In the browser, before the page's first load and after any `localStorage.clear()`, set `musicVolume`, `deep_belt_music_volume`, `sfxVolume` and `deep_belt_sfx_volume` to `'0'` in localStorage, then reload.

## 3. Seed the state

Use the helpers in `tests/helpers.ts` rather than playing up to the state:

- `openWithSave(page, {...RICH, ...})` opens the title screen on a fresh save with the given fields merged in. The `skills` and `fitting` shapes are in `tests/balance-probe.spec.ts` (`skills()`, `fitting()`).
- `enterGame`, `undock`, `flyTo(page, 'Belt Two')`, `selectTarget`, `mineUntil` and `settle` move through the game as a player does, by keys.

## 4. Drive it and look

- Do what a player would do to reach the change, by keys, and read what the screen shows (`page.innerText('body')`, `getByText`, `getByTestId`).
- Numbers the screen doesn't show come from `window.__DEEP_BELT_PROBE__`: `player()` (speed, Cap, shield, armor, hull, warp, active modules, position), `pirate()` and `raiders()`.
- Time things on the game's clock (`performance.now()` sampled in the page), across whole cycles, not over a short wall-clock window.
- Screenshot at 1280x800 and at 800x600 (`page.setViewportSize`). Read each screenshot. At 800x600, check that no text runs past the window or sits under a panel.
- Wrap the run in `watch(page)` and finish with `expectClean(problems)`: no page errors, no console errors, no requests to other sites.

## 5. Report

Say what was run, the numbers and screenshots it produced, and what they show. Say what was not covered. If the game disagrees with the change's intent, that is the finding: report it with the evidence instead of adjusting a test to match.

Then delete the throwaway spec and stop any preview you started.
