# Deep Belt

Before each step listed under "The lessons check" in `PLAYBOOK.md`, follow that section: it runs `node dev/lessons.mjs` and says when to add to `LESSONS.md`.

How a change is shown to work, and which checks a diff triggers: `TESTING.md`. To run and drive the game for that, use the `verify` skill (`.claude/skills/verify/SKILL.md`).

In the Claude desktop app, the jobs listed in the `code-mode` skill (`.claude/skills/code-mode/SKILL.md`: check, sweep, audit, edit) run in a Code Mode session that the skill starts in a Terminal-panel tab, when they fit its limits. Everything else runs in the session itself.

Current roadmap status and verified step notes live at the top of `design/content-tree.md` (this repo's status index; there is no separate `STATUS.md`). Only one agent session at a time edits `App.tsx`, `LESSONS.md` or `PLAYBOOK.md`, or runs `npm test` on port 4173. Keep `git config core.hooksPath dev/hooks` enabled so `dev/hooks/pre-push` gates pushes to `main`.
