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
