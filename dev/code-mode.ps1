#requires -Version 7
<#
.SYNOPSIS
Runs one Deep Belt job in a Claude Code Code Mode session and records what it cost.

.DESCRIPTION
Code Mode runs only in an interactive `claude` session in a terminal (not in the desktop app, not with -p).
A desktop session starts this script in a Terminal-panel tab (see .claude/skills/code-mode/SKILL.md);
nobody needs to touch the tab.

What it does:
  1. Writes the job's instructions to .code-mode-runs/<RunId>/job.md.
  2. Clears the variables a desktop session hands its child processes (CLAUDECODE, CLAUDE_CODE_*, ...):
     they would make the child think it is an SDK session and keep Code Mode off.
  3. Starts `claude` with CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1 in this process only, permission mode
     dontAsk and the job's allow list: a tool call outside the list is denied, never asked.
  4. When the session writes .code-mode-runs/<RunId>/done (or the timeout passes) it ends the session.
  5. Always writes .code-mode-runs/<RunId>/status.json last: why it ended, the time taken, the
     tool calls by name (REPL = Code Mode snippets) and the tokens, read from the session transcript.

It changes no settings file. Only the edit job may change files outside .code-mode-runs.

.EXAMPLE
pwsh -NoProfile -File dev/code-mode.ps1 -Job check -RunId check-1
#>
param(
    [Parameter(Mandatory)][ValidateSet('check', 'sweep', 'audit', 'edit')][string]$Job,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._-]{1,60}$')][string]$RunId,
    # Extra instructions appended to the job (required for edit). Path relative to the repo root or absolute.
    [string]$TaskFile,
    # Words for the lessons lookup in the check job.
    [string]$Words = 'test commit',
    [ValidateRange(1, 120)][int]$TimeoutMinutes = 20,
    # Run the same job with Code Mode off, as a baseline for its time and token numbers.
    [switch]$NoCodeMode
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$runRel = ".code-mode-runs/$RunId"
$runDir = Join-Path $root ".code-mode-runs\$RunId"
if (Test-Path $runDir) { throw "Run folder already exists: $runDir (use a new RunId)" }
New-Item -ItemType Directory -Path $runDir | Out-Null
$doneFile = Join-Path $runDir 'done'
$reportFile = Join-Path $runDir 'report.md'
$statusFile = Join-Path $runDir 'status.json'
$sessionId = [guid]::NewGuid().ToString()
$started = Get-Date
$status = [ordered]@{
    runId = $RunId; job = $Job; codeMode = -not $NoCodeMode; sessionId = $sessionId; startedAt = $started.ToString('o')
    ended = 'not-started'; claudeExitCode = $null; seconds = $null; sessionSeconds = $null
    reportExists = $false; transcript = $null; toolCalls = @{}; replCalls = 0
    tokens = $null; envRemoved = @(); error = $null
}

try {
    if ($Job -eq 'edit' -and -not $TaskFile) { throw 'The edit job needs -TaskFile.' }
    $task = ''
    if ($TaskFile) {
        $taskPath = if ([IO.Path]::IsPathRooted($TaskFile)) { $TaskFile } else { Join-Path $root $TaskFile }
        $task = Get-Content -Raw -LiteralPath $taskPath
    }

    # --- Job instructions -------------------------------------------------------------------------
    $common = @"
# Code Mode job: $Job (run $RunId)

You are an unattended Code Mode session started by another Claude Code session. Nobody watches this
terminal or answers prompts: a tool call outside this job's allow list is denied automatically.
Don't retry a denied call; list it in the report.

- Batch independent tool calls in REPL snippets and return only what the report needs. With no
  REPL tool, make the same calls directly, several in one turn where they are independent.
- Use the Bash tool for commands, never the PowerShell tool. One command per Bash call, with no
  ``&``, ``&&``, ``;`` or pipes: the allow list matches a whole command line, so a chained one is denied.
- Don't commit, push, stash, switch branches, install packages, start servers or run Playwright.
- Don't run trailmark or lessons-learned skills, and don't edit memory, handoff, LESSONS.md or
  PLAYBOOK.md: the calling session does that.
- Label every finding CONFIRMED (seen in a file or command output), INFERRED or HYPOTHESIZED.
- Finish by writing the report to $runRel/report.md, then write the word done to $runRel/done.
  Write done last, and write it even when the job failed (say why in the report). Then stop.

Report format:

    # $Job report
    Result: PASS | FINDINGS | FAILED
    Code Mode: on (REPL used) | off (no REPL tool)
    ## Findings
    - file:line - what - label
    ## Commands run
    - command - exit code
    ## Denied or skipped
    ## Not covered

"@

    $jobText = switch ($Job) {
        'check' {
            @"
## Job
From the repo root, run these three in parallel in one REPL snippet and capture each exit code and output:
``node dev/lessons.mjs $Words``, ``npx tsc -p .``, ``npm run lint``.
Report the lesson titles and PLAYBOOK sections the lookup printed (titles only), every type error
(file:line and message) and every lint finding. Result is PASS when tsc and lint both exit 0.
Fix nothing.
"@
        }
        'sweep' {
            @"
## Job
Read-only bug sweep of App.tsx. Fix nothing.
1. Save effects: find every effect or callback that writes the save
   (``localStorage.setItem(SAVE_SESSION_STORAGE_KEY, ...)``). For each, list the refs (``xxxRef.current``)
   and state it reads that are not in its dependency array. For each ref, say whether a dependency
   always changes when the ref does (INFERRED unless the code shows it).
2. Save coverage: compare the keys of the object written to the save with the keys the loader reads
   back. List keys written but never read, and keys read but never written.
Result is FINDINGS if either list is non-empty.
"@
        }
        'audit' {
            @"
## Job
Read-only content audit. Fix nothing.
1. Every id defined in content/*.ts is used somewhere outside its own definition (App.tsx, other
   content files, tests/). List ids defined but never used.
2. Every id that App.tsx or tests/ looks up in content/ exists there. List references to missing ids.
3. Every asset in design/asset_manifest.json that names a file: the file exists, and something in
   the code refers to it. List missing files and unused assets.
Result is FINDINGS if any list is non-empty.
"@
        }
        'edit' {
            @"
## Job
Make the edit the task below describes, only in the files it names.
- Edit files with the Edit tool. App.tsx has CRLF line endings: keep them (no sed).
- Afterwards run ``npx tsc -p .`` and ``npm run lint`` and report both exit codes.
- Report every file you changed. Result is PASS when the edit is done and both checks exit 0.
"@
        }
    }
    if ($task) { $jobText += "`n## Task from the calling session`n`n$task`n" }
    Set-Content -LiteralPath (Join-Path $runDir 'job.md') -Value ($common + $jobText) -Encoding utf8NoBOM

    # --- Allow list -------------------------------------------------------------------------------
    $allowed = @(
        'REPL', 'Read', 'Grep', 'Glob',
        "Write(./$runRel/**)", "Edit(./$runRel/**)",
        'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git ls-files:*)', 'Bash(git grep:*)'
    )
    if ($Job -in 'check', 'edit') {
        $allowed += 'Bash(node dev/lessons.mjs:*)', 'Bash(npx tsc:*)', 'Bash(npm run lint:*)'
    }
    if ($Job -eq 'edit') { $allowed += 'Edit(./**)', 'Write(./**)' }

    # --- Environment: drop what the desktop app passes down, turn Code Mode on ----------------------
    $hostVars = '^(CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_AGENT_SDK_.*|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_PREVIEW_.*|MCP_CONNECTION_NONBLOCKING|MCP_SERVER_CONNECTION_BATCH_SIZE)$'
    foreach ($v in Get-ChildItem env: | Where-Object Name -Match $hostVars) {
        $status.envRemoved += $v.Name
        Remove-Item -LiteralPath "env:$($v.Name)"
    }
    # The desktop app points this at the default endpoint; any custom base URL keeps Code Mode off.
    if ($env:ANTHROPIC_BASE_URL -and ([uri]$env:ANTHROPIC_BASE_URL).Host -eq 'api.anthropic.com') {
        $status.envRemoved += 'ANTHROPIC_BASE_URL'
        Remove-Item env:ANTHROPIC_BASE_URL
    }
    $env:CLAUDE_CODE_EXPERIMENTAL_CODE_MODE = if ($NoCodeMode) { '0' } else { '1' }

    # --- Watcher: end the session once done appears, or at the timeout ---------------------------
    $deadline = $started.AddMinutes($TimeoutMinutes)
    $watch = Start-ThreadJob -ArgumentList $doneFile, $PID, $deadline -ScriptBlock {
        param($done, $parentPid, $deadline)
        while ((Get-Date) -lt $deadline -and -not (Test-Path $done)) { Start-Sleep -Seconds 2 }
        $why = if (Test-Path $done) { 'done' } else { 'timeout' }
        if ($why -eq 'done') { Start-Sleep -Seconds 8 } # let the session finish writing its last turn
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$parentPid" |
            Where-Object Name -EQ 'claude.exe' |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        $why
    }

    $status.ended = 'running'
    & claude "Do the job described in $runRel/job.md" --session-id $sessionId --name "code-mode $Job $RunId" --permission-mode dontAsk --allowedTools @allowed
    $status.claudeExitCode = $LASTEXITCODE

    if ($watch.State -eq 'Running') {
        Stop-Job $watch
        $status.ended = 'claude-exited'
    } else {
        $status.ended = (Receive-Job $watch | Select-Object -Last 1)
    }
    Remove-Job $watch -Force
    Write-Host "`e[?1049l`e[?25h" # leave the alternate screen and show the cursor after a forced stop
} catch {
    $status.error = $_.Exception.Message
    if ($status.ended -in 'not-started', 'running') { $status.ended = 'error' }
} finally {
    $status.seconds = [math]::Round(((Get-Date) - $started).TotalSeconds)
    $status.reportExists = Test-Path $reportFile

    # Tool calls and tokens from the session transcript (one usage per API message id).
    $t = Get-ChildItem (Join-Path $HOME '.claude\projects') -Recurse -Filter "$sessionId.jsonl" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($t) {
        $status.transcript = $t.FullName
        $tools = @{}; $seen = @{}; $first = $null; $last = $null
        $tok = [ordered]@{ input = 0; output = 0; cacheRead = 0; cacheCreate = 0 }
        foreach ($line in Get-Content -LiteralPath $t.FullName) {
            try { $e = $line | ConvertFrom-Json -Depth 50 } catch { continue }
            # Time from the first prompt to the last reply, without any wait at the consent screen.
            if ($e.timestamp -and $e.type -in 'user', 'assistant') {
                $ts = [datetimeoffset]$e.timestamp
                if (-not $first) { $first = $ts }
                $last = $ts
            }
            if ($e.type -ne 'assistant' -or -not $e.message) { continue }
            foreach ($c in @($e.message.content)) {
                if ($c.type -eq 'tool_use') { $tools[$c.name] = 1 + ($tools[$c.name] ?? 0) }
            }
            $u = $e.message.usage
            if ($u -and $e.message.id -and -not $seen.ContainsKey($e.message.id)) {
                $seen[$e.message.id] = $true
                $tok.input += [int]($u.input_tokens ?? 0)
                $tok.output += [int]($u.output_tokens ?? 0)
                $tok.cacheRead += [int]($u.cache_read_input_tokens ?? 0)
                $tok.cacheCreate += [int]($u.cache_creation_input_tokens ?? 0)
            }
        }
        $status.toolCalls = $tools
        $status.replCalls = $tools['REPL'] ?? 0
        $status.tokens = $tok
        if ($first) { $status.sessionSeconds = [math]::Round(($last - $first).TotalSeconds) }
    }

    $tmp = "$statusFile.tmp"
    $status | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $tmp -Encoding utf8NoBOM
    Move-Item -LiteralPath $tmp -Destination $statusFile -Force
    Write-Host "code-mode: $($status.ended) after $($status.seconds) s; status at $statusFile"
}
