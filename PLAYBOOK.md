# PLAYBOOK

Checklists for recurring work on Deep Belt, each built from entries in `LESSONS.md`. For development only: the build (`dist/`) never includes it. The user's instructions win over this file: when a step here disagrees with them, follow the user and fix that step.

## The lessons check

From: 2026-11-17 "A promoted playbook step was missed because the lessons check used the task's words"

Run it before each of these steps: a change to game, test or build code, a test run whose result you will report, a commit, and a push.

1. Run `node dev/lessons.mjs <words>` with two to four words for the step's topics and the programs and tools it runs (`save`, `test`, `commit`, `git`, `npm`, `cmd`). A word finds lessons with a word that starts with it ("save" finds "saved"). It prints the open ones with their rules, and names the section here for promoted ones. With no words it prints only the counts and its usage.
2. Before the step, write one line where the user can see it: `Lessons checked: <the titles that apply>`, or `Lessons checked: none apply`.
3. Follow each rule named, and the steps of each section named. One that can't be followed is named in that line, with the reason.
4. Something that went wrong gets an entry at the top of `LESSONS.md` before the next step: a mistake, a redo or retry, a result you did not expect, or a correction from the user on how to work. When unsure whether it counts, log it. Then run `node dev/lessons.mjs --check`, which must report 0 bad. In a session that may not edit files, give the entry to the user instead.
5. A lesson seen a second time becomes a step in a section here. So does one that is clearly general; when unsure, leave it open. The step says what the lessons' rules say, no more and no less, and the section's `From:` line names each lesson. Each one's status becomes `promoted to PLAYBOOK "<section>"`. From then on the step is the rule's home: the lessons keep their rule text unchanged as the record of where it came from, and a change to the rule is made in the step.
6. A lesson whose rule no longer holds (the code changed, or a tool now enforces it) gets `closed: <reason>`, and the lookup stops printing it. When unsure, leave it as it is. If it was promoted, take it off its section's `From:` line, and remove the steps that came only from it.

Edits to `LESSONS.md` and this file are ordinary project edits, not config edits: a session that may edit files makes them without asking. A step added, reworded or removed here is named in the session's reply and committed on its own. Anything else is asked first.

A lesson's rule is written only here and in `LESSONS.md`: a memory file or the handoff may point to it, but does not repeat it.

Limit: a session follows this by hand. A tool checks only the format of the two files, and only when step 4 runs it.

## Changing saved state

From: 2026-11-14 "Docked state was never saved"; 2026-11-15 "More saved state was never read back"

1. Edit every place in `App.tsx` that writes or reads the state: search for `SAVE_SESSION_STORAGE_KEY`.
2. Add a test that sets the state, reloads, and checks it after the reload.

## Tests that time out

From: 2026-11-15 "Two tests timed out once under full local load"; 2026-11-15 "Four tests waited over 15 s for the title screen"; 2026-11-18 "A suite failure's error was lost because the output was cut to its tail"

1. A one-off timeout gets a full rerun before any change, and both results are reported. The first run's error is read from its saved output (step 4) before the rerun.
2. If the same test times out again, raise its wait or fix its cause.
3. A wait for the title screen after a page load allows for the asset load under full parallel load, not the 15 s default: use `expectTitle` from tests/helpers.ts, which waits `TITLE_TIMEOUT`.
4. A full suite run writes its whole output to a file outside test-results/ (the scratchpad) and prints only the summary from it; on a failure, read that file's error before any rerun.

## Station keys in tests

From: 2026-11-15 "A market Enter went to the officer's line, not the focused card"; 2026-11-17 "A dock key pressed right after undocking did nothing"; 2026-11-21 "A Hangar Enter finished the officer's line because the test settled before the tab key"; 2026-11-21 "Vance test Enter was received by the milestone overlay"

1. A test presses Enter in a station terminal only after `settle(page)`, which waits for "[Enter] Skip" to go. `settle(page)` runs after the key that opens a station tab and right before the Enter, with no tab or dock change between them.
2. A key pressed right after docking, undocking or loading, which may do nothing the first time, is pressed until its effect shows, as `undock()` does, not once. A key that changes state each press follows "Keys pressed until a change shows".
3. A station keyboard fixture stays below the milestone threshold, or marks the milestone claimed as the shared launch helper does, so the milestone overlay does not take its Enter.

## Keys pressed until a change shows

From: 2026-11-15 "A key pressed until the save changed skipped a Rift stage too far"; 2026-11-19 "A press-until-it-reads check stopped on the readout's old value"; 2026-11-24 "Repeated L presses kept restarting the probe's lock"

1. A key that changes state each time it is pressed is pressed again only after a check that can see the change, either on the page or by polling the save for longer than the autosave interval.
2. A loop that presses a key until a readout shows a value waits, after each press, for the readout to change from its value before the press (`expect.poll(...).not.toBe(was)`), then reads.
3. A mutant run counts only when it fails at the assertion the fix is about: read the failing line before counting it.

## Reading game state from the save

From: 2026-11-15 "A test read the save once, right after a toast, and saw old values"; 2026-11-17 "A test checked a loaded save before the game had rewritten it"; 2026-11-18 "A moved item's before-count was read from the seeded save, which has no inventory"; 2026-11-21 "A Fabricator test read the seeded save, which had no inventory yet"

1. A test that checks game state through the save polls it with `expect.poll` after the event, and does not read it once.
2. The poll waits for a value only the expected write can produce (on load, the converted fields), not one the old save already has.
3. A test that reads hold items from a save it seeded with old keys first polls the save until `inventory` is defined, then reads. An item-move step greps the tests for bracket reads (`save[k]`, `'cargoXxx'` strings) as well as `.cargoXxx` reads.

## Text with backslashes or $ from the Bash tool

From: 2026-11-15 "A scripted edit wrote a literal $1 into App.tsx"; 2026-11-17 "A commit message sent through a heredoc lost its backslashes"; 2026-11-23 "A Bash edit wrote a real CR for the text \r into LESSONS.md and PLAYBOOK.md"; 2026-11-24 "A planted bug added with node -e lost its \n escapes"

1. Any text that holds backslashes or `$` (a script, a commit message, file contents) is saved with the Write tool and passed by its file (`node file`, `git commit -F file`), not through a Bash heredoc, `sed` or `node -e`. The result is checked by reading the bytes back, not by the script's own count.
2. A scripted edit to App.tsx counts its matches, and is followed by the type-check and a read of the whole diff before any test run.

## Selecting a target in tests

From: 2026-11-15 "Tab never reached a pirate 44 km away under full load"

1. A test selects an object more than a few km away from its Overview row, not with Tab (`selectTarget`).

## Editing files with a script

From: 2026-11-15 "A sed edit turned App.tsx from CRLF to LF"; 2026-11-19 "A shell append turned .gitignore from CRLF to mixed line endings"; 2026-11-22 "A sed edit turned four test files from CRLF to LF"; 2026-11-24 "A sed edit turned balance-probe.spec.ts from CRLF to LF"

1. A scripted edit splits lines on an optional CR before LF and writes back with the line ending the file had. Git Bash `sed -i` does not: it writes LF, so App.tsx, and any other file, is edited with the Edit tool or such a script.
2. Before a test run or commit, `git ls-files --eol <file>` shows the ending the file had before the edit (App.tsx: `w/crlf`), never `w/mixed`. A grep for CR is not that check: `grep -c $'\r$'` counted a CR on every line of an LF file.

## Windows programs from the Bash tool

From: 2026-11-15 "Git Bash turned a `rev:path` argument into a Windows path"; 2026-11-15 "Git Bash turned a `/J` switch into a drive letter"

1. A git command with a `<rev>:<path>` argument, or a Windows program given a `/` switch: put `MSYS_NO_PATHCONV=1` in front of the command (with `cmd /c`, not `cmd //c`), or run it in the PowerShell tool.

## Probe fixtures

From: 2026-11-21 "A polish test imported a fixture local to another spec"; 2026-11-21 "The station capture imported a spec-local keyboard helper"; 2026-11-21 "Two Silicate Lens listings matched one locator"; 2026-11-17 "A check for no Buy button passed on code that showed one"

1. Check that tests/helpers.ts exports each imported fixture. Compose the exported helpers or use a local expect callback with toPass for a retry.
2. When an item is present in two market lists, use the test ID on its outer card or row. A card or row is found by a test id on its outer element, not by text and `.last()`.
3. A check that something is absent is run once where it is present (a mutant or the state that shows it) and must fail there.

## Probing a module's effect

From: 2026-11-22 "A booster probe measured nothing because the booster ran before any damage"; 2026-11-23 "An armor probe ended before either tier's armor ran out"

1. Before probing a change to a module's effect, check that the probe runs the module while that effect can show (a booster while the shield is below full).
2. A result equal to the old one is checked for that before it is reported as "no effect".

## Adding a skill, module or gate

From: 2026-11-18 "A new skill broke a test that pins every skill id"; 2026-11-21 "A skill gate on the Tern broke a test that clicked the first Buy button"; 2026-11-21 "A new rank 2 Navigation skill made a category-scoped Train button ambiguous"; 2026-11-22 "A new skill with a prerequisite broke two tests that counted Needs lines"

Before the first test run of a new skill, module or gate, grep the tests for what pins it:

1. The newest existing id of that kind (for skills the last `SKILLS` entry, for modules the last `MARKET_MODULE_IDS` entry): update every hit that lists the whole catalog, and name each in the commit message.
2. A new skill: its category's test id and its LVL I button name. Scope each hit to the skill's card (skill-card-<id>).
3. A skill with a prerequisite: also `/^NEEDS/` and `/^Needs:/`. Scope a count to one card, or update a whole-screen count and its comment.
4. Gating or changing a purchase: that screen's tab key and every Buy click (`name: /^Buy`). A test names the card it clicks by its test id.

## Text assertions

From: 2026-11-15 "A skills test expected a name in the case the source wrote"; 2026-11-15 "Two new text tests failed on fixed code"

1. A test of on-screen text takes the text from the rendered page (a failure's "Received string", or the page text), not from the source that feeds it.
2. A test of typed-out text waits for the full text on the page and presses Enter again only when it is not there.
3. A check that text is gone is scoped to the element the change touched.

## A Windows test runner that does not exit

From: 2026-11-19 "The warp probe printed a pass before the runner stopped"; 2026-11-21 "A finished flight test waited on its preview process"

1. Case output alone is measurement evidence: a run counts as passed only with the runner's summary and its exit code.
2. If completed cases have no suite summary, match the preview command and its process ancestry to that specific runner before stopping it, then collect the runner's own exit status.

## Paid or batch deliveries

From: 2026-11-21 "A chapter archive used a different delivery host"; 2026-11-21 "A paid voice render could not reach the game"

1. Before rendering or submitting the rest, test the actual delivery format and destination with a small batch: for paid renders, one pilot per provider, with a playable local download verified.
2. Recover a file from an existing export or the completed receipt; do not rerender it.
