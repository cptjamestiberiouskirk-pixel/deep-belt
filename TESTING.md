# Testing and verifying Deep Belt

How a change to Deep Belt is shown to work. Adapted to this project from "How the Claude Code team thinks about verification" (Addy Osmani, 2026-11-16): https://claude.dev/blog/how-the-claude-code-team-thinks-about-verification/

The user's instructions win over this file. The lessons check in `PLAYBOOK.md` still runs before each step it lists; this file says what to run, the playbook says what went wrong before.

## What counts as verified

A change is verified when it has run and the result was seen, not when it type-checks. Three kinds of evidence, strongest first:

1. **An end-to-end test** in `tests/*.spec.ts` that plays the change the way a player would: keys, screens, and what the screen shows, against the production build. This is the default for any game change, and the one to write when there is time for only one. Unit-level checks can pass while the feature is broken; a played flow either works or it doesn't, and its failure shows the step that broke.
2. **Running the game.** The `verify` skill (`.claude/skills/verify/SKILL.md`) boots the build, seeds a save, drives it and takes screenshots. Use it before committing any change a player can see.
3. **Measured balance numbers.** Speeds, damage, cycle times and ore rates are measured with `PROBE=1 npx playwright test tests/balance-probe.spec.ts`, not only computed. A number worked out from the formulas is INFERRED until the probe confirms it. Example: the mining pace probe first counted ore over a 40 s window, which cut cycles at random points and gave 2.2x where the game delivers 2.9x; it now times yields on the game's own clock over 80 s.

Pure code in `content/` also has **property tests** in `tests/properties.spec.ts` (fast-check). Each states a rule that must always hold, such as "fitting, unfitting and boarding a hull never make or lose a module" or "any saved fitting loads well formed", tries hundreds of generated inputs, and shrinks a failure to its smallest case. A case a property once found stays pinned in its `examples`.

A number the screen does not show (speed, Cap, the pirate's layers) is read from the read-only probe hook `window.__DEEP_BELT_PROBE__` (`player()`, `pirate()`, `raiders()`, `vaelPirate()`, `skiff()`), set up in App.tsx.

## Cheap checks first

1. `npx tsc -p .` and `npm run lint` (oxlint, rules in `.oxlintrc.json`, under a second; CI fails on any finding).
2. The specs for the feature touched.
3. The full suite, with its whole output and its exit code kept: `npx playwright test > "$LOG" 2>&1; echo "exit=$?"`, where `$LOG` is a file outside `test-results/` (the scratchpad), then `tail -6 "$LOG"` for the summary. On a failure, read the error in that file before any rerun: a rerun empties `test-results/` (PLAYBOOK "Tests that time out"). Passed plus skipped must equal the total from `npx playwright test --list`.
4. Push, then the CI run for that commit's full SHA. A CI result counts only for the commit it ran on; a later push makes it stale. CI runs the play-test as 3 shards (`--shard=N/3`, job "Play-test in a browser (shard N of 3)"); a CI result needs all three plus build and deploy green. One job took 23-27 minutes against the 30-minute limit before sharding.

Port 4173 belongs to the suite. Each run builds and serves the game there fresh; if something is already on the port, the run stops with "already used" rather than test an old build (`PW_REUSE_SERVER=1` reuses it on purpose). Manual play uses port 4174.

## Keep tests fast and honest

- A flaky test is not fixed by skipping it, adding a fixed sleep, retrying until green, or raising its timeout without a cause. One rerun to tell a flake from a failure is fine, with both results reported (PLAYBOOK "Tests that time out"). If it fails again, find the cause. If no cause can be found, delete the test, say why in the commit, and log a lesson.
- Wait for a condition (`expect.poll`, `toBeVisible`), not a fixed time.
- Slow measurement stays behind `PROBE=1`, out of the default suite and CI.

## A change does not move its own goalposts

- When a commit changes an existing test's expected value, the commit message names each changed expectation and the measurement or user decision behind it. Example: 3baffe1 changed the Lance Driver's pinned numbers from 45 to 47 damage, with the probe's fight times as the reason. A test edited only so that a failing change passes is a bug in the change.
- The rules that judge changes (this file, `PLAYBOOK.md`, `LESSONS.md`, `dev/lessons.mjs`, `playwright.config.ts`, `.github/workflows/`) change in a commit of their own, never inside a game change.

## Checks a diff triggers

Read the diff, then run the checks whose trigger it matches. Add a row when a miss would have been caught by one.

| The diff touches | Check |
|---|---|
| Saved state: a field written to or read from the save | PLAYBOOK "Changing saved state"; a save from before the field still loads |
| App.tsx through a script | `git ls-files --eol App.tsx` shows `w/crlf`; type-check; read the whole diff |
| A number in `content/` (damage, speed, yield, cycle, price) | The probe cases for it; every test that pins it; the status line of `design/content-tree.md` |
| Layout or text on a screen | The 800x600 tests in `tests/fitting-save.spec.ts`; screenshots at 800x600 and 1280x800 |
| Hostile speed, range or leash | The probe's fight, flee and raider cases |
| A pure function in `content/` with a rule that must always hold | A property in `tests/properties.spec.ts` |
| A lint finding | Fix it. A rule turned off or a file waived in `.oxlintrc.json` says why in its commit |
| A new module or skill | A spec on the pattern of `tests/lance.spec.ts` (module) or `tests/laser-tuning.spec.ts` (skill) |

## Say how each commit was verified

The last line of a commit body, before the Co-Authored-By trailer, says what ran: `Verified: type-check; full suite 129 passed, 33 skipped (162 listed); probe fights`. A commit where nothing ran says `Verified: none` and why, so `git log --grep "Verified: none"` finds them.

## When to stop

After three rounds of fixing the same failing check without a pass, stop and report to the user with the evidence, rather than try a fourth guess.

## Test kinds not in use yet

- **Differential tests:** run the old and the new code on the same inputs and compare. Fits a change that should alter nothing, such as splitting App.tsx into modules: the same seeded saves and key sequences through both builds, compared on probe readings and the save each writes, with timing noise ignored and a list of intended differences.

## Learn from misses, prune the rest

A miss becomes a lesson in `LESSONS.md` and, seen twice, a step in `PLAYBOOK.md` (the lessons check). A test, row or rule that no longer catches anything real, or repeats another, is removed; a lesson that no longer holds is closed with its reason. Review this file when the suite's run time or size grows noticeably.
