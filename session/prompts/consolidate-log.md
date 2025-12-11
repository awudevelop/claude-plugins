Session: {session_name}

**Absolute Paths** (use these exact paths):
- Session path: {session_path}
- Plugin root: ${CLAUDE_PLUGIN_ROOT}
- Working directory: {working_directory}

Goal: Prepare session for resumption - consolidate log (if exists), capture git, update timestamp

## Step 1: Check Conversation Log

Check if file exists: {session_path}/conversation-log.jsonl
(Use the Read tool to attempt reading this absolute path)

- If file does NOT exist: Set `has_log = false`, proceed to Step 5 (git capture)
- If file exists: Set `has_log = true`, proceed to Step 2

## Step 2: Read Conversation Log (only if has_log = true)

**Step 2a: Count total lines**
- Use Bash: wc -l {session_path}/conversation-log.jsonl
- Extract line count from output

**Step 2b: Read file in chunks if large**
- If line count <= 2000: Read entire file normally
- If line count > 2000: Read in chunks of 2000 lines
  - Chunk 1: Read with offset=0, limit=2000
  - Chunk 2: Read with offset=2000, limit=2000
  - Continue until all lines processed

**Step 2c: Parse JSONL format (each line = JSON entry)**
- Extract entries (COMPACT FORMAT v3.8.9+):
  - Interaction entries: "p" = user prompt, "r" = response
  - Timestamps: "ts" = Unix timestamp in seconds
  - File status codes: 1=Modified, 2=Added, 3=Deleted, 4=Renamed
  - Modified files: "f" = [[path, status_code], ...] array

## Step 3: Analyze Conversation (only if has_log = true)

⚠️ CRITICAL - Analyze ENTIRE conversation, not just recent messages:

**Anti-Recency Bias**: Topics from the START are EQUALLY important as topics from the END.

Extract:
- ALL distinct topics discussed (chronological order)
- ALL suggestions and recommendations with rationale
- ALL key decisions made with rationale
- ALL completed tasks/todos
- ALL files modified with context
- Current state (progress, next steps, blockers)

**Coverage Requirements**:
- List topics in CHRONOLOGICAL order
- Do NOT skip topics discussed briefly
- Do NOT merge related topics
- Do NOT summarize - enumerate explicitly

## Step 4: Delete Conversation Log (only if has_log = true)

```bash
rm {session_path}/conversation-log.jsonl

# Verify deletion
if [ -f {session_path}/conversation-log.jsonl ]; then
  echo "FAILED: Could not delete conversation log"
  exit 1
fi
```

## Step 5: Capture Git History (ALWAYS run)

Run git capture CLI:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{session_name}"
```

Then extract recent commits for snapshot (last 10 commits since session start):
```bash
cd {working_directory}
git log --oneline -10 --no-decorate 2>/dev/null || echo "No git repo"
```

Store the commit list for inclusion in snapshot.

## Step 6: Update Session Timestamp (ALWAYS run)

Update the "Last Updated" line in session.md:

Use Edit tool on file: {session_path}/session.md
- Find line containing `**Last Updated**:`
- Replace with: `**Last Updated**: [current ISO timestamp]`

## Step 7: Reset State Counters (ALWAYS run)

```bash
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-state "{session_name}" "{\"interactions_since_snapshot\": 0, \"interactions_since_context_update\": 0, \"last_snapshot_timestamp\": \"$TIMESTAMP\"}"
```

## Step 8: Create Snapshot (ALWAYS run)

Create snapshot with this format (use heredoc):

```bash
cat <<'SNAPSHOT_EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
# Consolidated Snapshot: {session_name}
**Timestamp**: [current ISO timestamp]
**Method**: Claude Inline Analysis
**Status**: [Consolidated from conversation log | Git-only snapshot]
**Format Version**: 3.0

## Topics Discussed

[If has_log = true, list all topics:]
1. **[Category]**: [Brief description]
2. **[Category]**: [Brief description]
[Continue for ALL topics in chronological order]

[If has_log = false:]
No conversation log to consolidate.

## Suggestions & Recommendations

[If has_log = true, list all suggestions:]
1. **[Category]**: [Suggestion] - [Rationale]
[Continue for ALL suggestions]

[If has_log = false:]
None documented.

## Decisions Made

[If has_log = true, list all decisions:]
1. **[Decision]**: [Rationale]
[Continue for ALL decisions]

[If has_log = false:]
None documented.

## Tasks Completed

[If has_log = true, list all tasks:]
1. [Action completed]
[Continue for ALL tasks]

[If has_log = false:]
None documented.

## Files Modified

[If has_log = true, list files from log:]
1. `[file_path]`: [What changed and why]
[Continue for ALL files]

[If has_log = false:]
See git history below.

## Recent Commits

[Include git log output from Step 5:]
- `abc1234` Fix: resolve hook duplication issue
- `def5678` Feat: add auto-close to activate command
[Continue for recent commits, or "No commits found" if none]

## Current Status

- **Progress**: [What's been accomplished]
- **Next Steps**: [What should be done next]
- **Blockers**: [Any blocking issues, or "None"]

## Notes
[If has_log = true:] Consolidated from conversation log at session boundary.
[If has_log = false:] Git-only snapshot created at session resume.
SNAPSHOT_EOF
```

## Step 9: Activate Session (ALWAYS run)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate "{session_name}"
```

This handles:
- Auto-closes previous session if different
- Sets session as active
- Updates status to "active"

## Step 10: Return Result (Plain Text Format)

Return result in this EXACT plain text format (NOT JSON):

**If successful with conversation log:**
```
SUCCESS
Snapshot: [filename]
Log: Consolidated and deleted
Git: [X] commits captured

Topics Discussed ([count]):
- [Topic1 title]
- [Topic2 title]
- [Topic3 title]
[... all topics as bullet list]

Decisions Made ([count]):
- [Decision1 title]
- [Decision2 title]
[... all decisions as bullet list]

Tasks Completed ([count]):
- [Task1 description]
- [Task2 description]
[... all tasks as bullet list]

Current Status:
- Progress: [Progress text]
- Next Steps: [Next steps text]
- Blockers: [Blockers text or "None"]
```

**If successful without conversation log (git-only):**
```
SUCCESS (no log)
Snapshot: [filename]
Git: [X] commits captured

Topics Discussed: None (no conversation log)
Decisions Made: None
Tasks Completed: None

Current Status:
- Progress: Session resumed
- Next Steps: Continue work
- Blockers: None
```

**If failed:**
```
FAILED
Step: [step number]
Reason: [error description]
```

## Important Rules

- ALWAYS run Steps 5-10 (git, timestamp, state, snapshot, activate) regardless of log existence
- Only run Steps 2-4 if conversation log exists
- Use plain text response, NOT JSON
- List ALL topics/decisions/tasks as bullet points (one per line)
- Include full task descriptions, not just counts
