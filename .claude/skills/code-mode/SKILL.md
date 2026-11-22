---
name: code-mode
description: Hand a Deep Belt job to a Claude Code Code Mode session in a Terminal-panel tab and read its report back. Use it for the four jobs it lists (check, sweep, audit, edit) when they fit its limits; everything else stays in this session.
---

# Code Mode jobs

Code Mode (Claude writes JavaScript that calls several tools in one step) runs only in an interactive `claude` session in a terminal. This desktop session can't turn it on for itself, so it starts one through `dev/code-mode.ps1` in a Terminal-panel tab, waits for the run's `status.json`, and reads the report. Nobody types anything into the tab.

## When to use it

Use it only for these jobs, and only when every limit below holds:

| Job | What it does | Changes files |
|---|---|---|
| `check` | The launcher runs the lessons lookup, `npx tsc -p .` and `npm run lint`; the session reads their output and reports only failures and the lessons that apply | no |
| `sweep` | App.tsx save effects: refs and state read but missing from their deps; saver keys versus loader keys | no |
| `audit` | `content/*.ts` ids defined but unused or used but missing; manifest assets missing or unused | no |
| `edit` | A mechanical edit across files, described in a task file; the launcher runs type-check and lint afterwards. It can't edit package.json, the lockfile, tsconfig.json, .oxlintrc.json, .npmrc, dev/, .claude/, .github/ or node_modules/ | yes |

No job has Bash or PowerShell: both are on every job's deny list, because leaving them off the allow list still let a read-only `ls` through (LESSONS 2026-11-21). Every job gets REPL, Read, Grep, Glob and writes to its own run folder; `edit` also edits files outside the denied list. Commands come only from the launcher, so text in a file the session reads can't add flags to them (security review 2026-11-19: prefix rules such as `Bash(npm run lint:*)` also approve `--node-options`, and `Bash(git log:*)` approves `--output`).

Limits:
- No browser, no Playwright run, no server, no commit or push. Those stay here.
- Not while the user is away and following from another device: the Code Mode session has no Remote Control.
- Work in progress in this worktree is fine for `check`, `sweep` and `audit` (they only read). For `edit`, this session makes no edits of its own until the run ends.
- One run at a time per worktree.

The run's lessons check doesn't replace this session's: the `check` job prints the lessons, and this session still writes the `Lessons checked:` line and follows them before its own step.

## How to run a job

1. Pick a RunId that is new: `<job>-<yyyyMMdd-HHmmss>`. For `edit`, first write the task to `.code-mode-runs/<RunId>.task.md` with the Write tool: the files to change, the exact change, and what must stay as it is.
2. Start it with `run_in_terminal` in a new tab (no `tab_id`), cwd = this worktree's absolute path, title `code-mode <job>`, and a literal command line:

   `pwsh -NoProfile -File dev\code-mode.ps1 -Job check -RunId check-20261119-1130 -Words "save test"`

   Add `-TaskFile .code-mode-runs/<RunId>.task.md` for `edit`. `-TimeoutMinutes` defaults to 20.
3. Wait with one background Bash command that exits when the status file appears, never a sleep loop of your own turns:

   `for i in $(seq 1 450); do [ -f .code-mode-runs/<RunId>/status.json ] && break; sleep 3; done; cat .code-mode-runs/<RunId>/status.json`
4. When it returns, read `status.json` and `report.md` from `.code-mode-runs/<RunId>/`, then close the tab with `stop_terminal_tab {tab_id, close: true}`. The app refuses to close or reuse a tab the user typed in (the consent screen counts): leave that one to the user.

`-DryRun` does everything except start the session (job file, allow and deny lists, the launcher's own commands, `status.json` with `ended: dry-run`) and costs no Claude usage: use it after any change to the launcher.

`-NoCodeMode` runs the same job with Code Mode off. Use it only to measure: a pair of runs, one with and one without, gives the time and token difference for that job.

## Reading the result

`status.json` fields:
- `ended`: `done` (the session wrote its done file), `timeout`, `claude-exited` (it stopped by itself, often a startup failure), or `error` (see `error`).
- `replCalls`: Code Mode snippets run. 0 with a report means Code Mode was off and the job ran as a normal session; say so.
- `toolCalls`, `tokens` (`input`, `output`, `cacheRead`, `cacheCreate`) and `sessionSeconds` (first prompt to last reply): what the run cost, from its transcript. `seconds` is the launcher's wall time, which includes startup and any wait at the consent screen.
- `claudeExitCode` is -1 after a normal run: the launcher ends the session once `done` appears.
- `envRemoved`: the desktop variables the launcher cleared for the child.
- `checks`: each command the launcher ran, with its exit code and output file. For `edit`, these are the type-check and lint of what the session changed: the job passes only when both are 0.
- `allowed` and `denied`: the permission rules the session ran with.

The report is the child's claims, not proof: before acting on a finding, check it in the file it names. For `edit`, read the whole `git diff` and run `git ls-files --eol` on each changed file before any test run or commit.

When `ended` is not `done`, read the tab with `read_terminal` before closing it, and report what it shows.

## Measured so far

A run's numbers count only when its `checks` have an exit code for every command the job names; a run without them measured nothing.

One pair, so suggestive rather than settled (2026-11-21, `check` job, same tree, launcher ran the commands both times):

| Run | Code Mode | Session time | Cache read | Cache create | Output |
|---|---|---|---|---|---|
| ab-base-2 | off | 29 s | 351,801 | 96,446 | 2,602 |
| ab-code-2 | on | 35 s | 133,573 | 49,147 | 2,437 |

Code Mode read 62% fewer cached tokens and created 49% fewer, at about the same output and 6 s slower. Live checks the same day (run deny-edit-1): an edit outside the denied list succeeded, an edit to `dev/lessons.mjs` was refused, and with Bash denied the session had no Bash tool, inside REPL too.

## Setup and limits

- Code Mode asks once per machine for consent ("Yes, turn on Code Mode"). That choice is the user's: if the tab shows that screen, ask the user to answer it there, and wait.
- The child runs in permission mode `dontAsk` with the job's allow list from the launcher; anything else is denied, never asked. It uses the user's Claude subscription login, like any session.
- Its transcript stays under `~/.claude/projects/`. A Code Mode session can be resumed only with Code Mode on.
- The launcher sets `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1` for its own process only and changes no settings file.
