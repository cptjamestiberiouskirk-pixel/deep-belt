# PLAYBOOK

Checklists for recurring work on Deep Belt, each built from entries in `LESSONS.md`. For development only: the build (`dist/`) never includes it. The user's instructions win over this file: when a step here disagrees with them, follow the user and fix that step.

## The lessons check

Run it before each of these steps: a change to game, test or build code, a test run whose result you will report, a commit, and a push.

1. Run `node dev/lessons.mjs <words>` with two to four words for the step's topics (`save`, `test`, `commit`, `git`). A word finds lessons with a word that starts with it ("save" finds "saved"). It prints the open ones with their rules, and names the section here for promoted ones. With no words it prints only the counts and its usage.
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

From: 2026-11-15 "Two tests timed out once under full local load"; 2026-11-15 "Four tests waited over 15 s for the title screen"

1. A one-off timeout gets a full rerun before any change, and both results are reported.
2. If the same test times out again, raise its wait or fix its cause.
3. A wait for the title screen after a page load allows for the asset load under full parallel load, not the 15 s default.

## Station keys in tests

From: 2026-11-15 "A market Enter went to the officer's line, not the focused card"; 2026-11-17 "A dock key pressed right after undocking did nothing"

1. A test presses Enter in a station terminal only after `settle(page)`, which waits for "[Enter] Skip" to go.
2. A key pressed right after docking, undocking or loading is pressed until its effect shows, as `undock()` does, not once.

## Reading game state from the save

From: 2026-11-15 "A test read the save once, right after a toast, and saw old values"; 2026-11-17 "A test checked a loaded save before the game had rewritten it"

1. A test that checks game state through the save polls it with `expect.poll` after the event, and does not read it once.
2. The poll waits for a value only the expected write can produce (on load, the converted fields), not one the old save already has.

## Text with backslashes or $ from the Bash tool

From: 2026-11-15 "A scripted edit wrote a literal $1 into App.tsx"; 2026-11-17 "A commit message sent through a heredoc lost its backslashes"

1. Any text that holds backslashes or `$` (a script, a commit message, file contents) is saved with the Write tool and passed by its file (`node file`, `git commit -F file`), not through a Bash heredoc or `sed`.
2. A scripted edit to App.tsx counts its matches, and is followed by the type-check and a read of the whole diff before any test run.

## Selecting a target in tests

From: 2026-11-15 "Tab never reached a pirate 44 km away under full load"

1. A test selects an object more than a few km away from its Overview row, not with Tab (`selectTarget`).

## Editing files with a script

From: 2026-11-15 "A sed edit turned App.tsx from CRLF to LF"; 2026-11-19 "A shell append turned .gitignore from CRLF to mixed line endings"

1. A scripted edit splits lines on an optional CR before LF and writes back with the line ending the file had. Git Bash `sed -i` does not: it writes LF, so App.tsx is edited with the Edit tool or such a script.
2. Before a test run or commit, `git ls-files --eol <file>` shows the ending the file had before the edit (App.tsx: `w/crlf`), never `w/mixed`.

## Windows programs from the Bash tool

From: 2026-11-15 "Git Bash turned a `rev:path` argument into a Windows path"; 2026-11-15 "Git Bash turned a `/J` switch into a drive letter"

1. A git command with a `<rev>:<path>` argument, or a Windows program given a `/` switch: put `MSYS_NO_PATHCONV=1` in front of the command (with `cmd /c`, not `cmd //c`), or run it in the PowerShell tool.
