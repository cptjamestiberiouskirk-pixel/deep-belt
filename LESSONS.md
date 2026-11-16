# LESSONS

A dated log of what went wrong while working on Deep Belt, newest first. For development only: the build (`dist/`) never includes it. When to add, promote or close an entry: `PLAYBOOK.md`, "The lessons check".

Format, checked by `node dev/lessons.mjs --check`. A field's text may go on over indented lines.

```
## YYYY-MM-DD: short title
- What went wrong:
- Why:
- Rule going forward:
- Evidence: a commit, a file and the text to search for, a test, a run, or the user's words
- Status: open | promoted to PLAYBOOK "<section>" | closed: <why the rule no longer holds>
```

## 2026-11-15: A market Enter went to the officer's line, not the focused card
- What went wrong: in content-tree step 6, a new test opened the market, pressed ArrowUp to a module card and pressed Enter; nothing was bought. The screenshot showed the right card focused.
- Why: while the officer's line is still typing out, Enter finishes the line instead of acting on the focused item. The market had just opened, so the line was still typing.
- Rule going forward: a test presses Enter in a station terminal only after `settle(page)`, which waits for "[Enter] Skip" to go.
- Evidence: tests/lance.spec.ts, search "Enter first finishes the officer's typed-out line"; the failing run's screenshot showed the Lance Driver card focused with no purchase.
- Status: open

## 2026-11-15: A skills test expected a name in the case the source wrote
- What went wrong: in content-tree step 5, a new test looked for "Mining" in the Skills screen's Extraction group and failed. The screen shows "MINING".
- Why: the test's text was copied from SKILL_DEFINITIONS, and the card upper-cases the name with `toUpperCase()` when it renders it.
- Rule going forward: a test of on-screen text takes the text from the rendered page (a failure's "Received string", or the page text), not from the source that feeds it.
- Evidence: tests/skills.spec.ts, search "toContainText('MINING')"; the failing run's "Received string" began "EXTRACTIONMINING".
  Again 2026-11-16, content-tree step 9: an exact match for "307 m/s" failed because the value holds its "(-20%)" in a nested span; the failure's page snapshot showed the row text "Max speed 307 m/s(-20%)".
  Again 2026-11-16, content-tree step 7: a test expected the "Needs: Gunnery III" line to go once Gunnery III was trained. The page keeps it (design 4.5) and only the button changes; tests/charge-control.spec.ts, search "stays once met".
- Status: open

## 2026-11-15: A sed edit turned App.tsx from CRLF to LF
- What went wrong: in content-tree step 2a, `sed -i` in Git Bash rewrote App.tsx with LF line endings, and a later Node edit script added LF lines to tests/station.spec.ts, leaving it with mixed endings. Edit scripts that split on CRLF then found no lines to anchor on.
- Why: the worktree files are CRLF (core.autocrlf is true) while the index is LF. Git Bash `sed -i` writes LF, and a script that joins with a bare LF adds LF lines to a CRLF file. Nothing reached a commit: git stores LF either way.
- Rule going forward: an edit script splits on an optional CR before LF and writes back with the line ending the file had. Before a commit, `git ls-files --eol <file>` shows `w/crlf` or `w/lf`, not `w/mixed`.
- Evidence: `git ls-files --eol tests/station.spec.ts` showed `w/mixed` before the 2a commit; both files were rewritten as CRLF with a Node one-liner.
- Status: open

## 2026-11-15: A scripted edit wrote a literal $1 into App.tsx
- What went wrong: in content-tree step 1, a Node script that edited App.tsx wrote the text "$1$2" in place of the market's module list and several Fitting lines; the type-check failed on it. A `sed` fix to the script then stripped the backslashes from its regex, so a second run did the same. Both times App.tsx was restored with `git checkout -- App.tsx`, which held no other changes.
- Why: the script's replace helper always passed a callback to `String.replace`, and a callback's return value is used as it is: `$1` is expanded only in a replacement string. The `sed` command's own quoting ate `\$` and `\d`.
- Rule going forward: a scripted edit to App.tsx counts its matches, is followed by the type-check and a read of the whole diff before any test run, and is fixed with the Edit tool, not `sed`, when the fix holds backslashes or `$`. A script whose text holds backslashes is saved with the Write tool and run from the file, not passed through a Bash heredoc.
- Evidence: the step 1 commit's diff; the script at the session scratchpad, `step1-app.cjs`, search "to.replace". Second time, step 2b: a Node script sent through a Bash heredoc wrote a test regex without its backslashes into tests/space.spec.ts; the type-check caught it. The same session's App.tsx script, saved with the Write tool as `step2b.cjs`, applied cleanly.
- Status: open

## 2026-11-15: Two new text tests failed on fixed code
- What went wrong: in the text-fix round, two new tests failed on the code they were written for. "dock officer: the hold tip..." read the page after each Enter and never saw the new line, which the failure snapshot showed in full. "contracts: the hint after undocking..." asked that "Station in range: Press Dock [F]" appear nowhere, and the Target panel still shows it beside its Dock button.
- Why: the corridor bubble types its line out, and Enter during typing finishes the line instead of moving on; `settle` waits for "[Enter] Skip", which this bubble does not show. The second test checked the whole page for text that the change was meant to remove from the hint bar only.
- Rule going forward: a test of typed-out text waits for the full text on the page and presses Enter again only when it is not there. A check that text is gone is scoped to the element the change touched.
- Evidence: `tests/station.spec.ts`, search "Enter first finishes the typing"; `tests/progression.spec.ts`, search "the hint bar is what changed". Second time for the page-wide read, the next round: "the Belt Two pirate has 84 shield..." matched the ship's own SHIELD bar (100/100) before the pirate's; `tests/space.spec.ts`, search "read after the pirate's name".
- Status: open

## 2026-11-15: Four tests waited over 15 s for the title screen
- What went wrong: the first full run of the polish round (62 tests, 8 workers, 5.8 min) had 4 failures, all in `openFresh` at `expect(getByTestId('start-game-btn')).toBeVisible()` after `localStorage.clear()` and a reload: "rift: a synchronizer opens the rift...", "rift: extracting at a conduit...", "flagship: a build survives a reload...", "pointer: a click selects...". The page snapshot at the timeout showed "INITIALIZING HARROW TELEMETRY..."; the failure screenshot a moment later showed the title screen. This is the second time for "Two tests timed out once under full local load", which had the colony test fail the same wait.
- Why: the title screen waits for `useAssets(ASSETS_MANIFEST)` to load every image, among them three 8192x1792 portrait sheets of about 3.7 MB each. With 8 workers loading and decoding them at once, that took longer than the 15 s default.
- Rule going forward: a wait for the title screen after a page load allows for the asset load under full parallel load, not the 15 s default.
- Evidence: the polish round's first run, 2026-11-15, log in the session scratchpad; `test-results/*/error-context.md` for the four tests. The full rerun failed the same wait in 2 tests ("Ash Drift: the permit opens it...", "rift: extracting at a conduit...").
- Status: promoted to PLAYBOOK "Tests that time out"

## 2026-11-15: A key pressed until the save changed skipped a Rift stage too far
- What went wrong: in the polish round's full rerun, "rift: stage 3 sentinel and Warden fall..." failed in `pressUntil(page, '\\', ...)`: it waited for `riftRun.stage` to be 2 and got 3.
- Why: `pressUntil` presses again whenever its check fails, and the check polled the save for 3 s, shorter than the ~5 s autosave. The first press had already moved the run to stage 2; the second, sent before the save caught up, moved it to 3.
- Rule going forward: a key that changes state each time it is pressed is pressed again only after a check that can see the change, either on the page or by polling the save for longer than the autosave interval.
- Evidence: `tests/lategame.spec.ts`, search "skips a stage only in a ?dev build"; the rerun's log in the session scratchpad.
- Status: open

## 2026-11-15: Tab never reached a pirate 44 km away under full load
- What went wrong: "selecting a far-off pirate does not summon it across the system" failed in two full runs of 62 tests in a row, each time at `selectTarget(page, /Rift Corsair/)`: after 40 s of Tab presses the Target panel still showed an asteroid at 36 km. Alone it passed 2 of 2. It is the same test as in "Two tests timed out once under full local load", so that rule called for fixing its cause.
- Why: Tab steps through every object in the system nearest first and re-sorts the list on each press. With the ship under fire and moving, and pages slowed by 8 workers, the corsair behind dozens of asteroids did not come up within 40 s.
- Rule going forward: a test selects an object more than a few km away from its Overview row, not with Tab.
- Evidence: `tests/space.spec.ts`, search "Picked from the Overview"; the fixed test passed 4 of 4 runs alone. Again in content-tree step 6: the new Lance Driver test copied the Light Cannon test's Tab selection of the Belt Two pirate and failed once in the full run; both tests now pick it from the Overview (tests/lance.spec.ts passed 3 of 3 runs).
- Status: open

## 2026-11-15: A push to main was refused because main had moved
- What went wrong: `git push origin HEAD:main` for the late-game round was refused as not a fast-forward. Another session had pushed f4ea9ac and b0c71dd (docs only) during a 14-minute test run, after this session's last fetch.
- Why: the fetch that showed main unchanged ran before the long test run, not right before the push.
- Rule going forward: fetch right before a push to main. If main moved, read the new commits, rebase onto them, and run the lessons check for anything they add before pushing again. Never force-push main.
- Evidence: the late-game round's commit, rebased onto b0c71dd; this entry was written before its push.
- Status: open

## 2026-11-15: A test read the save once, right after a toast, and saw old values
- What went wrong: the Rift stage 3 test read `riftRun.manifest.marks` as soon as "Elite Warden destroyed!" showed and got 250 instead of 2750, in 2 of 3 runs.
- Why: the Rift run is changed in a ref and saved by the periodic autosave (about every 5 s), so the save can trail what the page already shows.
- Rule going forward: a test that checks game state through the save polls it with `expect.poll` after the event, and does not read it once.
- Evidence: `tests/lategame.spec.ts`, search "The run is saved every few seconds".
- Status: open

## 2026-11-15: A seeded save mixed a hull with another hull's hold size
- What went wrong: the Gantry refit test seeded `activeHull: 'gantry'` and found `cargoMax` 600, the Ferrier's.
- Why: `cargoMax` is saved and loaded as is, not worked out from the hull on load. The seed patched the hull and left the hold size from the fresh save.
- Rule going forward: a seeded save sets every saved value that follows from the one it changes, such as `cargoMax` with `activeHull`.
- Evidence: `tests/lategame.spec.ts`, search "The hold size is saved as is".
- Status: closed: the game works the hold size out from the hull and fitted modules on every load, so a seeded cargoMax is overwritten (a Gantry seeded with 600 loads as 2000, probe of 2026-11-15); the Why above was wrong, and a mismatched seed no longer matters

## 2026-11-15: A right-click aimed at the canvas landed on a side panel
- What went wrong: the pointer test right-clicked 400 px right of the ship to set a waypoint; the ship never moved, because the point was under the Overview panel.
- Why: the side panels sit over the canvas, so a point on the canvas is not always clickable.
- Rule going forward: a test that clicks the canvas aims at open space clear of the side panels and the bottom bar, and checks the screenshot when a click has no effect.
- Evidence: `tests/lategame.spec.ts`, search "clear of the side panels".
- Status: open

## 2026-11-15: Two tests timed out once under full local load
- What went wrong: in the first `--repeat-each 3` run of 61 tests, "colony: buildings are placed..." waited over 15 s for the title screen and "selecting a far-off pirate..." did not Tab to the Rift Corsair in 40 s. The same 183 runs then passed with no failures.
- Why: INFERRED: load, with 8 workers running long Rift and combat tests side by side. Not reproduced.
- Rule going forward: a one-off timeout gets a full rerun before any change, and both results are reported. If the same test times out again, raise its wait or fix its cause.
- Evidence: the late-game round, 2026-11-15: 176 passed and 7 failed (3 expected from a test update, 2 Rift save reads, these 2), then 183 passed in 11.5 min.
- Status: promoted to PLAYBOOK "Tests that time out"

## 2026-11-15: Git Bash turned a `/J` switch into a drive letter
- What went wrong: `cmd //c mklink /J <link> <target>`, run through the Bash tool to check the build, failed with `Invalid switch`. `cmd //c echo /J` printed `J:/`, and `MSYS_NO_PATHCONV=1 cmd /c echo /J` printed `/J`. This is the second time for "Git Bash turned a `rev:path` argument into a Windows path".
- Why: Git Bash (MSYS) rewrites an argument that starts with `/` as a POSIX path before it starts a Windows program. `//c` works only because of that rewrite: with `MSYS_NO_PATHCONV=1`, `cmd //c` opens an interactive cmd and runs nothing.
- Rule going forward: in the Bash tool, a Windows program given a `/` switch gets `MSYS_NO_PATHCONV=1` in front of the command, with `cmd /c`, not `cmd //c`. Or the command runs in the PowerShell tool.
- Evidence: the session that added this log, 2026-11-15: the failed `mklink`, then the two `echo` runs. The review of that session reproduced the `cmd //c` case: `MSYS_NO_PATHCONV=1 cmd //c mklink /J ...` made no junction and exited 0.
- Status: promoted to PLAYBOOK "Windows programs from the Bash tool"

## 2026-11-15: Git Bash turned a `rev:path` argument into a Windows path
- What went wrong: `git -C <repo> show origin/main:.gitattributes`, run through the Bash tool on another repo that has that file (the Trailmark repo), failed with `fatal: ambiguous argument 'origin\main;.gitattributes'`. The same call with `origin/main:PLAYBOOK.md` worked. Deep Belt itself has no `.gitattributes`.
- Why: Git Bash (MSYS) rewrites arguments that look like a list of POSIX paths before it starts a Windows program: the `/` became `\` and the `:` became `;`.
- Rule going forward: in the Bash tool, put `MSYS_NO_PATHCONV=1` in front of a git command that takes `<rev>:<path>`, or run it in the PowerShell tool.
- Evidence: the session that added this log, 2026-11-15: the failed call, then the same call with `MSYS_NO_PATHCONV=1` in that repo, which printed the file. Its review found the same rewrite of `origin/main:.github/workflows/ci.yml` in Deep Belt.
- Status: promoted to PLAYBOOK "Windows programs from the Bash tool"

## 2026-11-15: The save-seeding test helper raced the game's autosave
- What went wrong: `openWithSave` in `tests/helpers.ts` wrote a patched save to `localStorage` and reloaded the page, but the running game could write its own save over the patch before the reload.
- Why: the helper treated the save as data at rest. The game rewrites it whenever any state in its save effect's dependency list changes.
- Rule going forward: tests change the save only through `openWithSave`. A new helper that writes `localStorage` while the game runs first stops the page's writes, as `openWithSave` does.
- Evidence: 6142f7e ("The save seeding helper no longer races the game's autosave"); `tests/helpers.ts`, search `Storage.prototype.setItem`.
- Status: open

## 2026-11-15: More saved state was never read back
- What went wrong: outpost modules and vault contents, the probe launcher, a located data cache, `firstCacheOpened`, seen tips and a fabrication in progress were written to the save but never loaded, so a reload lost them. This is the second time for "Docked state was never saved".
- Why: `App.tsx` writes and reads the save in separate places (the main writer effect, the loader effect under `Persistent Session Save & Resume`, lazy `useState` initializers such as `marks`), and no test reloaded with that state set.
- Rule going forward: a change that adds or changes saved state edits every place in `App.tsx` that writes or reads it (each uses `SAVE_SESSION_STORAGE_KEY`), and comes with a test that sets the state, reloads, and checks it after the reload.
- Evidence: 6142f7e ("each was written to the save but never read back"); tests in `tests/lategame.spec.ts`.
- Status: promoted to PLAYBOOK "Changing saved state"

## 2026-11-14: Docked state was never saved
- What went wrong: Continue always resumed in space, even when the pilot saved while docked. At the first training step the coach then asked for an undock that could not happen.
- Why: `isDocked` was in neither the save writer nor the loader, and no test reloaded while docked.
- Rule going forward: a change that adds or changes saved state edits every place in `App.tsx` that writes or reads it (each uses `SAVE_SESSION_STORAGE_KEY`), and comes with a test that sets the state, reloads, and checks it after the reload.
- Evidence: 54fd390 (adds `isDocked` to the writer and the loader in `App.tsx`).
- Status: promoted to PLAYBOOK "Changing saved state"

## 2026-11-14: CI passed and deployed a build whose panels had no styles
- What went wrong: the first CI run (43674160846, af6b4af) passed and published to GitHub Pages. Playing the build under Playwright then showed the Agent panel, the help screen and other panels unstyled: no Tailwind stylesheet was loaded outside the game's original host.
- Why: CI ran only the type-check and the build, which show that the code compiles, not what the page shows.
- Rule going forward: a change to the game or its build is checked with `npm test`, which plays the production build. A passing type-check and build is not evidence that the game works.
- Evidence: `gh run view 43674160846` (af6b4af, jobs "Type-check and build" and "Deploy to GitHub Pages", success); 54fd390 (found by playing under Playwright; adds Tailwind to the build).
- Status: open
