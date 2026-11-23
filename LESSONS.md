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

## 2026-11-23: An armor probe ended before either tier's armor ran out
- What went wrong: step 34's first probe of Composite Armor II against the first tier (Vael fight with a Lance Driver, Armor Layering V) gave the same result for both: killed in about 40 s, 208 armor lost, no hull lost. The fight ends with armor to spare on the first tier, so the II's extra armor never came into play. A Light Cannon case, added to run the armor out, ended the same way (252 lost, 18 and 93 left).
- Why: as with the step 33 booster probe, the case was chosen without asking when the module's effect would show; extra armor shows only in a fight that gets through the first tier's armor.
- Rule going forward: before probing a change to a module's effect, check that the probe runs the module while that effect can show (a booster while the shield is below full); a result equal to the old one is checked for that before it is reported as "no effect".
- Evidence: session d8be0f06 scratchpad probe34.jsonl; commit b871984 reports the armor left (62 and 137, 18 and 93) and "margin, not a different outcome".
- Status: promoted to PLAYBOOK "Probing a module's effect"

## 2026-11-23: A Bash edit wrote a real CR for the text \r into LESSONS.md and PLAYBOOK.md
- What went wrong: the 11-22 lesson and PLAYBOOK step quoting `grep -c $'\r$'` held a carriage return byte where the text has backslash and r. Git then saw both files as `w/-text`, and their diff replaced every line. In Q29 my first fix, a `node -e` passed through Bash, wrote the CR back while printing "fixed 1".
- Why: both edits put a backslash escape through Bash, which turned it into the character before the script saw it, as the PLAYBOOK section says it will.
- Rule going forward: text with a backslash goes in a file written with the Write tool, as PLAYBOOK "Text with backslashes or $ from the Bash tool" says, a `node -e` included; a fix is checked by reading the bytes back, not by the script's own count.
- Evidence: byte dump `24 27 0d 24 27` at "grep -c " in both files before, `24 27 5c 72 24 27` after scratchpad fix-lone-cr.mjs; `git ls-files --eol` `w/-text` before, `w/crlf` after.
- Status: promoted to PLAYBOOK "Text with backslashes or $ from the Bash tool"

## 2026-11-22: A booster probe measured nothing because the booster ran before any damage
- What went wrong: step 33's first probe of Shield Booster II against Booster I (Belt Two holdout, Vael fight, both at Shield Operation V) gave the same result for both (118.4 s and 118.9 s; 286 HP lost in each fight). The probe pressed [3] on arrival, so the booster spent its Cap on a full shield and had shut off (Cap 14) before the first hit; its HP rate never came into play.
- Why: I reused the step 13 probe cases, which measure Cap use, for a change to the HP restored, without asking when the booster would be running.
- Rule going forward: before probing a change to a module's effect, check that the probe runs the module while that effect can show (a booster while the shield is below full); a result equal to the old one is checked for that before it is reported as "no effect".
- Evidence: session d8be0f06 scratchpad probe33-after.jsonl (minCap 14 in both holdouts); the managed cases added to tests/balance-probe.spec.ts.
- Status: promoted to PLAYBOOK "Probing a module's effect"

## 2026-11-22: A sed edit turned four test files from CRLF to LF
- What went wrong: in step 33 I added shield_booster_ii to the MARKET_MODULE_IDS pin in four specs with Git Bash `sed -i`; `git ls-files --eol` then showed them `w/lf` where the rest are `w/crlf`. A `grep -c $'\r$'` check counted a CR on every line of those LF files, so it hid the change. Fixed with a node script before any test run.
- Why: the PLAYBOOK step names App.tsx, and I read it as covering App.tsx only; it covers every file a script edits.
- Rule going forward: a scripted edit splits lines on an optional CR before LF and writes back with the line ending the file had, for any file; the check is `git ls-files --eol`, not a grep for CR.
- Evidence: `git ls-files --eol` on tests/bulk-hold.spec.ts, composite-armor, fire-control and lance: `w/lf` after the sed, `w/crlf` after the fix.
- Status: promoted to PLAYBOOK "Editing files with a script"

## 2026-11-22: A guard's name was read as proof that the tutorial deploys a drone
- What went wrong: in step 31 I wrote, in a code comment, the spec header and the design note draft, that the tutorial deploys an extraction drone, from the `isProtectedDroneRock` guard in App.tsx's drone tick. A new game holds no drone and tests/tutorial.spec.ts never mentions one; the true rule 2 reason is that the Harrow Market sells drones from the start (constants.ts:918). Caught before the commit.
- Why: the guard only protects the tutorial rock in case a drone is on it; its name says nothing about the tutorial using one, and I did not check the tutorial or the new-game state.
- Rule going forward: a claim about what the first 30 minutes contain is checked against tests/tutorial.spec.ts and the new-game state (the item's starting quantity, where it is sold and its price) before it goes into a comment, a test or the design doc; a guard or a variable name is a lead, not evidence.
- Evidence: App.tsx useState(0) for cargoExtractDrone (4853); no "drone" in tests/tutorial.spec.ts; constants.ts:918-920 prices 1,500, 1,800 and 1,200 at Harrow.
- Status: open

## 2026-11-22: A new skill with a prerequisite broke two tests that counted Needs lines
- What went wrong: step 29 added Command Piloting, after Industrial Piloting I. The full suite failed skills.spec.ts (`getByText(/^Needs:/)` counted 7, expected 6) and cargo-trim.spec.ts (no `NEEDS` button in the Navigation category, found 1), though the step had grepped for the category test id and the LVL I button name.
- Why: those two tests count prerequisite lines across a category or the whole screen, and neither search matched them.
- Rule going forward: before the first run of a skill with a prerequisite, grep the tests for `/^NEEDS/` and `/^Needs:/` too; scope a count to one card (skill-card-<id>), or update a whole-screen count and its comment.
- Evidence: the step 29 full suite, 250 passed and 2 failed (skills.spec.ts:34, cargo-trim.spec.ts:49), then both specs passing after the fix.
- Status: promoted to PLAYBOOK "Adding a skill, module or gate"

## 2026-11-21: A new rank 2 Navigation skill made a category-scoped Train button ambiguous
- What went wrong: The full suite failed cargo-trim.spec.ts "at Navigation II, Cargo Trim I queues": its click on "LVL I (100 MARKS • 2:00)" within skill-category-Navigation matched Cargo Trim and the new Industrial Piloting.
- Why: The test found the button by category, not by card, and a skill of the same rank in the same category has the same button name. My pre-run grep covered skill-id lists only.
- Rule going forward: before the first run of a new skill, grep the tests for its category's test id and its LVL I button name, and scope each hit to the skill's card (skill-card-<id>).
- Evidence: full-suite-3.log in session d8be0f06's scratchpad, strict mode violation, 239 passed, 74 skipped, 1 failed of 314.
- Status: promoted to PLAYBOOK "Adding a skill, module or gate"

## 2026-11-21: A Fabricator test read the seeded save, which had no inventory yet
- What went wrong: tests/industrial-piloting.spec.ts read the save once after Enter and found `inventory` undefined, though the gate had worked (toast shown, no job).
- Why: The seed holds old cargoXxx keys only, and the game had not yet written its own save. PLAYBOOK "Reading game state from the save" step 2 was not followed.
- Rule going forward: a test that checks hold items after a seeded load polls the save until `inventory` is defined before reading it, as lategame.spec.ts does before its Fabricator counts.
- Evidence: industrial-run1.log in session d8be0f06's scratchpad, "received value must be a non-null object" at industrial-piloting.spec.ts:81.
- Status: promoted to PLAYBOOK "Reading game state from the save"

## 2026-11-21: A skill gate on the Tern broke a test that clicked the first Buy button
- What went wrong: The full suite failed station.spec.ts "hangar: a new hull can be bought" after step 27 gated the Tern; the first enabled Buy became the Skirmisher's, whose 300 m³ hold refused the seeded 520 m³ of cargo.
- Why: Before the first run I searched the tests for hangar-hull and buyAndBoardHull, not for Buy clicks, and the test chose its hull by position, not by test id.
- Rule going forward: before gating or changing a purchase, grep the tests for that screen's tab key and for every Buy click (`name: /^Buy`), and name the card a test clicks by its test id.
- Evidence: full-suite-1.log in session d8be0f06's scratchpad, 1 failed, 230 passed, 74 skipped of 305; tests/station.spec.ts line 205.
- Status: promoted to PLAYBOOK "Adding a skill, module or gate"

## 2026-11-21: A Hangar Enter finished the officer's line because the test settled before the tab key
- What went wrong: Three new Hangar tests in tests/hauler-piloting.spec.ts pressed ArrowDown and Enter after opening the tab; the Tern was focused, but Enter only finished Officer Vance's typed line, so nothing was bought or boarded.
- Why: The spec's openTab helper ran settle(page) before pressing 6, and opening the tab starts a new officer line. PLAYBOOK "Station keys in tests" step 1 was followed in name only.
- Rule going forward: settle(page) runs after the key that opens a station tab and right before the Enter, with no tab or dock change between them.
- Evidence: test-results hauler-piloting "a Tern owned before the skill" screenshot, Tern focused, no "Boarded Tern"; progression.spec.ts presses 6 then settles.
- Status: promoted to PLAYBOOK "Station keys in tests"

## 2026-11-21: Speech history put the script and voice inside the dialogue array
- What went wrong: The original history verifier saw empty text and voice fields on a successful Eleven v4 clip.
- Why: This model populated dialogue[0].text and dialogue[0].voice_id instead of the top-level fields.
- Rule going forward: Check the actual history record shape for one existing render before comparing a batch; verify the recorded voice and text without regenerating it.
- Evidence: dialogue/history-verification.log and the independent 53-file offline phrase check in audio-production.
- Status: open

## 2026-11-21: A finished flight test waited on its preview process
- What went wrong: All five ship callout cases printed ok, but the runner waited on its local Vite server during teardown.
- Why: The preview process was still alive after the last case. The underlying Windows teardown cause was not established.
- Rule going forward: If completed cases have no suite summary, match the preview command and its process ancestry to that specific runner before stopping it, then collect the runner's own exit status.
- Evidence: ship-test-1.log ended with 5 passed and the runner exited 0 after the verified preview process stopped.
- Status: promoted to PLAYBOOK "A Windows test runner that does not exit"

## 2026-11-21: Two canister handlers shared the same edit anchor
- What went wrong: A guarded script stopped before writing App.tsx when a canister warning matched twice.
- Why: Both player actions emitted the same hold-full notice.
- Rule going forward: When patching duplicate action branches, count all matches before writing and review each resulting event trigger.
- Evidence: The two canister handlers in App.tsx both emit the hold-full warning.
- Status: open

## 2026-11-21: A chapter archive used a different delivery host
- What went wrong: The owner successfully saved the ElevenLabs single MP3 in Edge. The already rendered Studio Chapters ZIP opened a file-host network error and did not arrive in the configured Downloads folder.
- Why: A successful individual download does not exercise a batch-export path.
- Rule going forward: Test the actual delivery format and destination with a small batch before rendering the remaining groups. Reuse an existing export to recover a file.
- Evidence: deep-belt-ship Studio export and the Deep Belt audio-production generation receipts.
- Status: promoted to PLAYBOOK "Paid or batch deliveries"

## 2026-11-21: A paid voice render could not reach the game
- What went wrong: ElevenLabs completed the warp pilot, but the local proxy rejected its signed file host and the browser export produced no verified local file.
- Why: A provider completion receipt does not prove its media can be transferred into the project.
- Rule going forward: Render one paid pilot per provider and verify a playable local download before submitting the rest. Keep the completed receipt and do not rerender it to recover a download.
- Evidence: The Deep Belt audio production pilot, one completed ElevenLabs session and a local proxy CONNECT 403.
- Status: promoted to PLAYBOOK "Paid or batch deliveries"

## 2026-11-21: An unauthenticated CI watch ran out of API requests
- What went wrong: The release watcher exited with an API rate limit after ten minutes while browser tests were still running.
- Why: gh used the shared unauthenticated allowance, and each watch refresh read the run and its jobs.
- Rule going forward: For a long CI run, use an authenticated watcher (`gh auth status` shows a login) or a GitHub connector the session has. If a watcher exits, read the exact run again before treating its exit as a CI result.
- Evidence: github-release/github-ci-watch.log for run 44944317099. The connected job lookup still returned an in-progress browser job.
- Status: open

## 2026-11-21: A full suite waited for the previous scan notification
- What went wrong: The first release suite reported one failure at tests/signal-analysis.spec.ts:109. The cache was selected and visible in the failure snapshot.
- Why: The notification changed as part of making found caches visible, and the older Signal Analysis test still expected the previous sentence.
- Rule going forward: When changing UI copy, search tests for the old text or its distinctive fragment and verify each affected expectation against what the player sees.
- Evidence: github-release/playwright-full-1.log and its Signal Analysis V failure trace.
- Status: open

## 2026-11-21: The Hangar capture omitted the shortcut chip from the button name
- What went wrong: A screenshot job waited for Edit [E], but the rendered button was named Edit [E] E.
- Why: The key chip contributes an extra E to the accessible name.
- Rule going forward: Use the rendered name or a scoped test ID. Bound individual capture interactions so one selector does not consume the whole test timeout.
- Evidence: verification-3.log and the Hangar capture accessibility snapshot.
- Status: open

## 2026-11-21: A market scroll cleared the tooltip during hover
- What went wrong: The lens tooltip did not remain visible when a card needed to scroll into view.
- Why: The tooltip always cleared on scroll even if the pointer was already on a market item.
- Rule going forward: Re-evaluate the pointer target after a scroll. Check a card reached by scrolling as well as a card visible on open.
- Evidence: verification-3.log and the station polish action at the lens tooltip assertion.
- Status: open

## 2026-11-21: Two Silicate Lens listings matched one locator
- What went wrong: The tooltip test and station capture both matched a cargo row and a purchase card for the same lens.
- Why: Both listings expose a Buy action and the same item name.
- Rule going forward: Give the market card and row distinct test IDs and target the intended surface.
- Evidence: Playwright strict mode failures for Silicate Lens in verification-2.log.
- Status: promoted to PLAYBOOK "Probe fixtures"

## 2026-11-21: Vance test Enter was received by the milestone overlay
- What went wrong: After dismissing the Vance callout, pressing Enter did not reopen it in the rich station fixture.
- Why: A balance of at least 1,000 MARKS triggers the unclaimed Industrialist overlay, which has priority on Enter.
- Rule going forward: Keep a station keyboard fixture below the milestone threshold or mark the milestone claimed as the shared launch helper does.
- Evidence: verification-1.log and vance-enter-first-trace.zip in the Nov 21 polish evidence folder.
- Status: promoted to PLAYBOOK "Station keys in tests"

## 2026-11-21: The station capture imported a spec-local keyboard helper
- What went wrong: tsc failed with TS2305 on the pressUntil import in the temporary station capture.
- Why: pressUntil lives in lategame.spec.ts, not in the shared helpers.
- Rule going forward: Check exports before importing from the shared Playwright helpers. Use an expect callback with toPass for a local retry.
- Evidence: TypeScript output for tests/tmp-station-design-captures.spec.ts and pressUntil in lategame.spec.ts.
- Status: promoted to PLAYBOOK "Probe fixtures"

## 2026-11-21: A polish test imported a fixture local to another spec
- What went wrong: TypeScript reported TS2305 for a docked fixture imported from tests/helpers.ts.
- Why: The docked functions in station.spec.ts and lategame.spec.ts are local wrappers around the shared helpers.
- Rule going forward: Check a fixture is exported before importing it from tests/helpers.ts. Compose openWithSave and enterGame directly for a local probe.
- Evidence: tsc output for tests/tmp-nov21-polish.spec.ts, import of docked.
- Status: promoted to PLAYBOOK "Probe fixtures"

## 2026-11-21: A Code Mode session ran Bash with no Bash allow rule
- What went wrong: in run ab-code-2 (check job, dontAsk, allow list with no Bash rule), the session's first REPL snippet ran `ls -la .code-mode-runs/ab-code-2/` through Bash and it succeeded. The launcher and the skill said no job has Bash.
- Why: leaving a tool off the allow list doesn't deny it. Claude Code still approves its own read-only commands, such as `ls`, in dontAsk mode (the reason is INFERRED; the run is CONFIRMED).
- Rule going forward: a tool a launched session must not use goes on its deny list (`--disallowedTools Bash PowerShell`); a missing allow rule is not a denial.
- Evidence: E:/DevTemp/deep-belt-code-mode-b0b996b7/ab-code-2/status.json (the worktree's git-ignored .code-mode-runs/, copied there 2026-11-22) `toolCalls` Bash 1; its transcript's tool_result for `ls -la` with is_error false; report.md "Commands run".
- Status: open

## 2026-11-19: The warp probe printed a pass before the runner stopped
- What went wrong: the browser case printed its timing and passed, but the Windows sandbox runner stayed open during teardown until it was canceled.
- Why: the command stalled after the case finished. The cause of the teardown stall was not confirmed.
- Rule going forward: keep the case output as measurement evidence and require the runner summary and its exit code before counting the run as passed.
- Evidence: E:/DevTemp/deep-belt-warp-01a1f6a4/before.log and the canceled Playwright command.
- Status: promoted to PLAYBOOK "A Windows test runner that does not exit"

## 2026-11-19: The warp probe ran before its browser-hook types passed
- What went wrong: Playwright ran the temporary warp probe, but tsc then rejected its Window cast with TS2352.
- Why: Playwright transpiles the spec without type-checking it, and the new type required a probe property Window does not declare.
- Rule going forward: type-check temporary specs before the first run when they add types for browser hooks. Assert the hook exists before using it.
- Evidence: the first Belt One warp probe in tests/tmp-tutorial-warp.spec.ts and its tsc output.
- Status: open

## 2026-11-19: A force-stopped Claude session left its terminal tab sending mouse reports
- What went wrong: after the first Code Mode run, the user saw "random characters scrolling" in the tab: text like `[555;31;39M` on every mouse move and `[I` on focus, typed into pwsh, which then printed `ParserError: Missing type name after '['`.
- Why: Claude's full-screen UI turns on mouse tracking and focus reports and turns them off when it exits. dev/code-mode.ps1 ends it with Stop-Process -Force, so that cleanup never ran, and the launcher reset only the alternate screen and the cursor.
- Rule going forward: a script that force-stops a full-screen terminal program then turns off every mode such a program can turn on (mouse tracking 1000/1002/1003 and encodings 1005/1006/1015, focus 1004, bracketed paste 2004, kitty keyboard flags, modifyOtherKeys, alternate screen) and shows the cursor.
- Evidence: the "code-mode check" tab's screen, read with read_terminal, full of `[555;x;yM` reports and the ParserError.
- Status: open

## 2026-11-19: A Code Mode baseline ran nothing because its chained command matched no allow rule
- What went wrong: the first `-NoCodeMode` baseline of the check job sent `node dev/lessons.mjs ... & npx tsc -p . & npm run lint` as one Bash call. The launcher's allow list holds one rule per command, so in dontAsk mode the call was denied, and the run ended `done` in 19 s with nothing run, which made it useless as a baseline.
- Why: the job text asked for the three commands "in parallel in one REPL snippet". With no REPL tool, the session got the same parallelism by chaining them in one shell line, and allow rules match a whole command line.
- Rule going forward: job text for a launcher run says one command per Bash call, with no `&`, `&&`, `;` or pipes; a run's numbers count only when its report lists an exit code for every command the job names.
- Evidence: E:/DevTemp/deep-belt-code-mode-b0b996b7/ab-base-1/report.md, "the Bash tool call was denied before execution"; status.json `toolCalls` Bash 1.
- Status: closed: no Code Mode job has Bash (dev/code-mode.ps1 denies Bash and PowerShell, and the launcher runs the commands), so job text gives no shell commands; the exit-code rule now lives in .claude/skills/code-mode/SKILL.md "Measured so far"

## 2026-11-19: A shell append turned .gitignore from CRLF to mixed line endings
- What went wrong: adding `.code-mode-runs/` with `printf '.code-mode-runs/\n' >> .gitignore` left the file `w/mixed`: its lines end in CRLF and the new one in LF. `git ls-files --eol` caught it before any commit, and a node rewrite put CRLF back.
- Why: a shell append writes the line ending the command spells out, not the file's own. The PLAYBOOK step was read as being about `sed -i` and App.tsx, so a one-line append to another file looked outside it.
- Rule going forward: any scripted change to a tracked file, an append included, writes the file's own line ending; check `git ls-files --eol` on every file a script touched, not only App.tsx.
- Evidence: `git ls-files --eol .gitignore` printing `w/mixed`, then `w/crlf` after the rewrite, while the Code Mode launcher was added.
- Status: promoted to PLAYBOOK "Editing files with a script"

## 2026-11-19: A press-until-it-reads check stopped on the readout's old value
- What went wrong: the new drone-shatter test stepped the laser frequency with `pressUntil(page, ']', check)`, where the check read the FREQ readout right after each press. It passed with the laser back on the rock's frequency, so the rock never shattered, and three mutant runs failed on a missing toast instead of on the save check they were meant to exercise.
- Why: the read can land before React redraws, so it sees the value from before the press. On a value that cycles (1, 2, 3, 1), the press from 1 to 2 was read as 1, the target, and the loop stopped one step past it.
- Rule going forward: a loop that presses a key until a readout shows a value waits, after each press, for the readout to change from its value before the press (`expect.poll(...).not.toBe(was)`), then reads; a mutant run counts only when it fails at the assertion the fix is about, so read the failing line before counting it.
- Evidence: tests/lategame.spec.ts, "a drone lost to a shattered rock is saved as lost at once"; error-context showing `FREQ 2 / 2` at the failure; a logged run stepping 2, 3, 1, 2 one press at a time.
- Status: promoted to PLAYBOOK "Keys pressed until a change shows"

## 2026-11-18: A clean lint was read as a failure because grep -v filtered every line
- What went wrong: during step 26, `npm run lint 2>&1 | grep -v "^npm notice" | tail -3` under `set -o pipefail` stopped an `&&` chain with exit 1 twice, once after a real lint error was fixed. Lint itself exited 0; the chain skipped the test run and left its output path unset.
- Why: `grep -v` exits 1 when it prints nothing, and a clean lint prints only `npm notice` lines, which it removes. Under pipefail that 1 becomes the pipeline's exit code.
- Rule going forward: a check whose exit code gates a chain runs on its own with its output to a file or /dev/null (`npm run lint >/dev/null 2>&1; echo "lint exit $?"`); a filter such as `grep -v` goes only in a pipeline whose exit code nothing reads.
- Evidence: the step 26 run printing "tsc+lint ok" nowhere and `/usr/bin/bash: line 1: : No such file or directory`; `npm run lint` alone printing nothing, then "lint exit 0".
- Status: open

## 2026-11-18: A moved item's before-count was read from the seeded save, which has no inventory
- What went wrong: step 23 pointed station.spec.ts's fabricator test at `before.inventory[k]`, and it failed with "Cannot read properties of undefined (reading 'hullPlate')". `before` was read right after the Fabricator opened, while localStorage still held the seeded save, which has only old cargoXxx keys. The same edit in lategame.spec.ts passed only because its `before` is read later.
- Why: `openWithSave` writes the seed as given, and the game writes its own save, the first with `inventory`, only at its first autosave. A test that compares two saves is comparing a seed with a game save when its first read comes before that autosave.
- Rule going forward: when a test reads a moved item from a save it seeded with old keys, it first polls the save until `inventory` is defined, then reads; an item-move step greps the tests for bracket reads (`save[k]`, `'cargoXxx'` strings) as well as `.cargoXxx` reads.
- Evidence: the step 23 targeted run, "1 failed" station.spec.ts:172, and 3 of 3 passes after the poll was added.
- Status: promoted to PLAYBOOK "Reading game state from the save"

## 2026-11-18: A suite failure's error was lost because the output was cut to its tail
- What went wrong: the full suite before 8a69fe4 reported "1 failed" (space.spec.ts:190, mining overheat), but the run's output had been piped through `tail -15`, which kept the list of test names and the summary and cut the error. The test then passed 3 of 3 alone and 8 of 8 on 4 workers, and the rerun emptied test-results/, so the failure's cause could not be read.
- Why: Playwright's line reporter prints each failure's error before the summary, so a short tail keeps the counts and drops the error. A rerun to tell a flake from a failure also clears test-results/, where the first run's error context was.
- Rule going forward: a full suite run writes its whole output to a file outside test-results/ (the scratchpad) and prints only the summary from it; on a failure, read that file's error before any rerun.
- Evidence: the suite output file for that run, which ends at test 246 with "1 failed" and no error lines; the three and eight passing reruns.
- Status: promoted to PLAYBOOK "Tests that time out"

## 2026-11-18: A new skill broke a test that pins every skill id
- What went wrong: step 17 added the Signal Analysis skill and its own tests passed, but the full suite failed 2 tests in tests/charge-control.spec.ts, whose `ZERO` object lists every skill at level 0 and is compared with `toEqual`.
- Why: a grep for an existing skill id (`boosterEfficiency`) had listed charge-control.spec.ts among the files that name every skill, and only tests/skills.spec.ts was updated from that list. Each new skill or module must also go into the tests that pin the whole catalog (`ZERO` here, `MARKET_MODULE_IDS` lists for modules).
- Rule going forward: before the first test run of a new skill or module, grep the tests for the newest existing id of that kind (for skills the last `SKILLS` entry, for modules the last `MARKET_MODULE_IDS` entry) and update every hit that lists the whole catalog, naming each in the commit message.
- Evidence: step 17 suite run, "2 failed" in charge-control.spec.ts lines 16 and 42, Received `"signalAnalysis": 0`; passed after `signalAnalysis: 0` was added to `ZERO`.
- Status: promoted to PLAYBOOK "Adding a skill, module or gate"

## 2026-11-17: A CI watch found no run because it was given a short commit hash
- What went wrong: after pushing step 16 (31fd11c), the background CI watch printed "run " with no id, then `gh run watch` failed with HTTP 404 on `/actions/runs/`. No CI result was read until the watch was rerun.
- Why: `gh run list --commit` matches the full 40-character SHA only. With gh 2.104.0, `--commit 31fd11c` returned no runs while `--commit $(git rev-parse 31fd11c)` returned run 44234092958. The script also went on to `gh run watch` with the empty id instead of stopping.
- Rule going forward: a CI lookup passes `--commit "$(git rev-parse <ref>)"`, never a short hash, and stops with an error when the run id comes back empty.
- Evidence: step 16 session, the watch output "failed to get run: HTTP 404"; the same `gh run list` with the short and the full SHA, run side by side.
- Status: open

## 2026-11-17: A mutant run passed because the mutant was never applied
- What went wrong: in step 15 the mutant script for Refining refused to apply (it expected 6 call sites and found 7), but the test run after it still ran, on the real code, and reported 5 passed, as if the tests had missed the mutant.
- Why: the Bash line joined the steps as `node mutant.mjs on && set -o pipefail; npx playwright test ...`. The `;` after `set` let the test run start whether or not the mutant step succeeded.
- Rule going forward: a mutant step and its test run are joined with `&&` only, and the run counts only when the mutant step printed that it applied, with its count.
- Evidence: step 15 session output, "expected 6 call sites, found 7" followed by "5 passed"; rerun with `&&` and 7 sites: the level V Refining test failed on the mutant.
- Status: open

## 2026-11-17: A check for no Buy button passed on code that showed one
- What went wrong: the Composite Armor one-only test found its market card with `page.locator('div', {hasText: ..., has: <the stat badge>}).last()` and checked it had no Buy button. With the module made buyable three times it still passed.
- Why: `.last()` picked an inner div that held the name and badge but not the button row, so the button could never be inside it.
- Rule going forward: a check that something is absent is run once where it is present (a mutant or the state that shows it) and must fail there; a card or row is found by a test id on its outer element, not by text and `.last()`.
- Evidence: tests/composite-armor.spec.ts, search "market-card-composite_armor"; on the mutant the card read "1 owned ... Buy" and the test failed.
- Status: promoted to PLAYBOOK "Probe fixtures"

## 2026-11-17: A commit message sent through a heredoc lost its backslashes
- What went wrong: a commit message passed to `git commit -F -` through an unquoted Bash heredoc said a regex was now '\s*MARKS' where it meant '\\s*MARKS'. Read back before the push and amended. This is the fourth time for "A scripted edit wrote a literal $1 into App.tsx", now outside scripts.
- Why: an unquoted heredoc (needed there to expand `$V`) treats backslashes as escapes, so each `\\` became `\`.
- Rule going forward: any text that holds backslashes or `$` (a script, a commit message, file contents) is saved with the Write tool and passed by its file (`node file`, `git commit -F file`), not through a Bash heredoc.
- Evidence: b337ec2's message, amended from the scratchpad file `msg1.txt`.
- Status: promoted to PLAYBOOK "Text with backslashes or $ from the Bash tool"

## 2026-11-17: A test checked a loaded save before the game had rewritten it
- What went wrong: the old-save test polled the save until `marks` matched the old build's, then read `fitting.fitted` and the skills and found them missing (both fixtures failed). This is the second time for "A test read the save once, right after a toast, and saw old values".
- Why: on load the game first copies the old save across as it is, then writes its own converted save at the next autosave. `marks` was the same in both, so the poll passed on the unconverted copy.
- Rule going forward: a poll of the save waits for a value only the expected write can produce (on load, the converted fields), not one the old save already has.
- Evidence: tests/old-saves.spec.ts, search "wait for the game's own".
- Status: promoted to PLAYBOOK "Reading game state from the save"

## 2026-11-17: A dock key pressed right after undocking did nothing
- What went wrong: the old-save test undocked and pressed `f` at once; the station was in range and "Dock [F]" lit, but the ship never docked and the wait timed out after 60 s, in both tests.
- Why: the same station input debounce that `undock()` already presses through: a key in the first moments after docking, undocking or loading can be dropped.
- Rule going forward: a key pressed right after docking, undocking or loading is pressed until its effect shows, as `undock()` does, not once.
- Evidence: tests/old-saves.spec.ts, search "press until it takes"; the failure screenshot showed "Station in range: Press Dock [F]".
- Status: promoted to PLAYBOOK "Station keys in tests"

## 2026-11-17: A promoted playbook step was missed because the lessons check used the task's words
- What went wrong: `cmd //c mklink /J` failed with `Invalid switch` while building old versions of the game, the exact case of PLAYBOOK "Windows programs from the Bash tool".
- Why: the lessons check before that step ran with the task's topics ("save migration old save load"), not with the programs the step ran, so it never named the section.
- Rule going forward: the lessons check words for a step include the programs and tools it runs (`mklink`, `cmd`, `git`, `npm`), not only its topic.
- Evidence: this session's build-old.sh in the scratchpad, first run; fixed with PowerShell `New-Item -ItemType Junction`.
- Status: promoted to PLAYBOOK "The lessons check"

## 2026-11-16: A check that a toast was gone passed by waiting for it to expire
- What went wrong: a new test said a tip still showing when the pilot quits does not show on the title screen. It passed with and without the code that hides it, so it proved nothing. A logged run then showed the tip still in the page when the title appeared, drawn over it.
- Why: `await expect(locator).toHaveCount(0)` retries for up to 5 s, and the toast removes itself after 4.5 s, so the assertion waited until it was gone.
- Rule going forward: a check that something is not shown, where that thing goes away by itself, reads once right after the event (`expect(await locator.count()).toBe(0)`), not with a retrying assertion. A test for a fix is run once without the fix and must fail there.
- Evidence: tests/tips.spec.ts, search "Read once, at once"; without the title-screen gate in App.tsx it fails with "Expected: 0, Received: 1".
- Status: open

## 2026-11-16: A suite run reported exit 0 with a failed test
- What went wrong: after the hostile-speed fix, the full suite run printed "exited with code 0", but one test had failed (the Rift stage 3 test). It was caught only because "124 passed" was one short of the 125 expected.
- Why: the command was `npx playwright test 2>&1 | tail -6`, so the exit code was tail's, not Playwright's, and the failure line had scrolled above the six lines kept.
- Rule going forward: a suite run that pipes its output runs under `set -o pipefail` and prints Playwright's own exit code; its result is read from the summary's failed, flaky, skipped and passed counts, checked against `npx playwright test --list`'s total.
- Evidence: the run's output ended "1 failed ... 26 skipped, 124 passed (5.4m)" then "[exited with code 0]"; tests/lategame.spec.ts, search "From its Overview row".
- Status: open

## 2026-11-15: A market Enter went to the officer's line, not the focused card
- What went wrong: in content-tree step 6, a new test opened the market, pressed ArrowUp to a module card and pressed Enter; nothing was bought. The screenshot showed the right card focused.
- Why: while the officer's line is still typing out, Enter finishes the line instead of acting on the focused item. The market had just opened, so the line was still typing.
- Rule going forward: a test presses Enter in a station terminal only after `settle(page)`, which waits for "[Enter] Skip" to go.
- Evidence: tests/lance.spec.ts, search "Enter first finishes the officer's typed-out line"; the failing run's screenshot showed the Lance Driver card focused with no purchase. Recurred 2026-11-17: tests/low-profile.spec.ts's sale helper pressed Enter right after the market opened, and the 600 Ferrite stayed in the hold (search "Wait out the officer's line").
- Status: promoted to PLAYBOOK "Station keys in tests"

## 2026-11-15: A skills test expected a name in the case the source wrote
- What went wrong: in content-tree step 5, a new test looked for "Mining" in the Skills screen's Extraction group and failed. The screen shows "MINING".
- Why: the test's text was copied from SKILL_DEFINITIONS, and the card upper-cases the name with `toUpperCase()` when it renders it.
- Rule going forward: a test of on-screen text takes the text from the rendered page (a failure's "Received string", or the page text), not from the source that feeds it.
- Evidence: tests/skills.spec.ts, search "toContainText('MINING')"; the failing run's "Received string" began "EXTRACTIONMINING".
  Again 2026-11-16, content-tree step 9: an exact match for "307 m/s" failed because the value holds its "(-20%)" in a nested span; the failure's page snapshot showed the row text "Max speed 307 m/s(-20%)".
  Again 2026-11-16, top-speed fix: tests/bulk-hold.spec.ts changed "256 m/s" to an exact "70 m/s" and failed the same way, the same day as the step 9 note. A speed value on Ship stats is matched as its whole row (search "match the row as a whole").
  Again 2026-11-16, content-tree step 7: a test expected the "Needs: Gunnery III" line to go once Gunnery III was trained. The page keeps it (design 4.5) and only the button changes; tests/charge-control.spec.ts, search "stays once met".
- Status: promoted to PLAYBOOK "Text assertions"

## 2026-11-15: A sed edit turned App.tsx from CRLF to LF
- What went wrong: in content-tree step 2a, `sed -i` in Git Bash rewrote App.tsx with LF line endings, and a later Node edit script added LF lines to tests/station.spec.ts, leaving it with mixed endings. Edit scripts that split on CRLF then found no lines to anchor on.
- Why: the worktree files are CRLF (core.autocrlf is true) while the index is LF. Git Bash `sed -i` writes LF, and a script that joins with a bare LF adds LF lines to a CRLF file. Nothing reached a commit: git stores LF either way.
- Rule going forward: an edit script splits on an optional CR before LF and writes back with the line ending the file had. Before a commit, `git ls-files --eol <file>` shows `w/crlf` or `w/lf`, not `w/mixed`.
- Evidence: `git ls-files --eol tests/station.spec.ts` showed `w/mixed` before the 2a commit; both files were rewritten as CRLF with a Node one-liner. Recurred 2026-11-17 in step 13: `sed -i` added an import to line 121 of App.tsx right after the lessons check had printed this lesson, and a count showed 0 CRLF lines; a Node one-liner restored CRLF (43,218 lines, 0 bare LF) before any test or commit.
- Status: promoted to PLAYBOOK "Editing files with a script"

## 2026-11-15: A scripted edit wrote a literal $1 into App.tsx
- What went wrong: in content-tree step 1, a Node script that edited App.tsx wrote the text "$1$2" in place of the market's module list and several Fitting lines; the type-check failed on it. A `sed` fix to the script then stripped the backslashes from its regex, so a second run did the same. Both times App.tsx was restored with `git checkout -- App.tsx`, which held no other changes.
- Why: the script's replace helper always passed a callback to `String.replace`, and a callback's return value is used as it is: `$1` is expanded only in a replacement string. The `sed` command's own quoting ate `\$` and `\d`.
- Rule going forward: a scripted edit to App.tsx counts its matches, is followed by the type-check and a read of the whole diff before any test run, and is fixed with the Edit tool, not `sed`, when the fix holds backslashes or `$`. A script whose text holds backslashes is saved with the Write tool and run from the file, not passed through a Bash heredoc.
- Evidence: the step 1 commit's diff; the script at the session scratchpad, `step1-app.cjs`, search "to.replace". Second time, step 2b: a Node script sent through a Bash heredoc wrote a test regex without its backslashes into tests/space.spec.ts; the type-check caught it. The same session's App.tsx script, saved with the Write tool as `step2b.cjs`, applied cleanly. Recurred 2026-11-16: the mining pace probe was rewritten by a Node script sent through a Bash heredoc (scratchpad `pace.mjs`), and its regex `/(\d+)\/\d+m³/` landed as `/(d+)/d+m³/`; the type-check caught it before any run.
- Status: promoted to PLAYBOOK "Text with backslashes or $ from the Bash tool"

## 2026-11-15: Two new text tests failed on fixed code
- What went wrong: in the text-fix round, two new tests failed on the code they were written for. "dock officer: the hold tip..." read the page after each Enter and never saw the new line, which the failure snapshot showed in full. "contracts: the hint after undocking..." asked that "Station in range: Press Dock [F]" appear nowhere, and the Target panel still shows it beside its Dock button.
- Why: the corridor bubble types its line out, and Enter during typing finishes the line instead of moving on; `settle` waits for "[Enter] Skip", which this bubble does not show. The second test checked the whole page for text that the change was meant to remove from the hint bar only.
- Rule going forward: a test of typed-out text waits for the full text on the page and presses Enter again only when it is not there. A check that text is gone is scoped to the element the change touched.
- Evidence: `tests/station.spec.ts`, search "Enter first finishes the typing"; `tests/progression.spec.ts`, search "the hint bar is what changed". Second time for the page-wide read, the next round: "the Belt Two pirate has 84 shield..." matched the ship's own SHIELD bar (100/100) before the pirate's; `tests/space.spec.ts`, search "read after the pirate's name".
- Status: promoted to PLAYBOOK "Text assertions"

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
- Status: promoted to PLAYBOOK "Keys pressed until a change shows"

## 2026-11-15: Tab never reached a pirate 44 km away under full load
- What went wrong: "selecting a far-off pirate does not summon it across the system" failed in two full runs of 62 tests in a row, each time at `selectTarget(page, /Rift Corsair/)`: after 40 s of Tab presses the Target panel still showed an asteroid at 36 km. Alone it passed 2 of 2. It is the same test as in "Two tests timed out once under full local load", so that rule called for fixing its cause.
- Why: Tab steps through every object in the system nearest first and re-sorts the list on each press. With the ship under fire and moving, and pages slowed by 8 workers, the corsair behind dozens of asteroids did not come up within 40 s.
- Rule going forward: a test selects an object more than a few km away from its Overview row, not with Tab.
- Evidence: `tests/space.spec.ts`, search "Picked from the Overview"; the fixed test passed 4 of 4 runs alone. Again in content-tree step 6: the new Lance Driver test copied the Light Cannon test's Tab selection of the Belt Two pirate and failed once in the full run; both tests now pick it from the Overview (tests/lance.spec.ts passed 3 of 3 runs). Again 2026-11-17, step 13: "combat: a pirate can be locked, destroyed and its wreck salvaged" in tests/space.spec.ts still used Tab for the Belt Two pirate and failed once in the full run (an asteroid 82.4 km away after 40 s); alone it passed 3 of 3. That test and "the Belt Two pirate has 84 shield and 42 hull" now pick it from the Overview.
- Status: promoted to PLAYBOOK "Selecting a target in tests"

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
- Status: promoted to PLAYBOOK "Reading game state from the save"

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
