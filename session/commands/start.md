You are managing a session memory system. The user wants to start a new named session.

## Task: Start New Session

Parse the session name from the command arguments. The command format is: `/session start [name]`

**OPTIMIZATION:** This command now updates the metadata index after creating the session.

### Step 1: Validate Session Name

1. Extract the session name from the arguments
2. Validate the name matches regex: `^[a-zA-Z0-9_-]+$`
3. If invalid, show error:
   ```
   ❌ Error: Invalid session name '{name}'
   Session names can only contain:
   - Letters (a-z, A-Z)
   - Numbers (0-9)
   - Hyphens (-)
   - Underscores (_)

   Example: my-session or my_session_123
   ```
   Then STOP.

### Step 2: Check for Duplicate Sessions

1. Check if `.claude/sessions/{name}/` directory already exists
2. If exists, show error:
   ```
   ❌ Error: Session '{name}' already exists
   💡 Use /session continue {name} to resume
   💡 Or use /session list to see all sessions
   ```
   Then STOP.

### Step 3: Create Session Folder

1. Create directory: `.claude/sessions/{name}/`
2. Verify creation was successful

### Step 4: Initialize session.md

Create `.claude/sessions/{name}/session.md` with this content:

```markdown
# Session: {name}

**Status**: Active
**Started**: {current_timestamp_YYYY-MM-DD_HH:MM}
**Last Updated**: {current_timestamp_YYYY-MM-DD_HH:MM}

## Goal
[Ask user to describe the goal for this session]

## Overview
Working on: {name}

## Key Milestones
- [ ] [To be defined during session]

## Files Involved
- [Will be tracked as work progresses]

## Configuration
- Auto-capture: enabled

## Notes
Session started. Use /session save to capture important milestones.
```

### Step 5: Initialize context.md

Create `.claude/sessions/{name}/context.md` with this content:

```markdown
# Session Context: {name}

## Key Decisions
[Decisions will be captured during session]

## Important Discoveries
[Discoveries will be documented as they occur]

## Blockers & Resolutions
[Issues and resolutions will be tracked here]

## Technical Context
[Architecture decisions and technical details]

## Summary
Session started on {current_timestamp}. Ready to capture context.
```

### Step 6: Update Active Session Tracker

1. Write the session name to `.claude/sessions/.active-session` (single line, just the name)
2. This marks it as the currently active session

### Step 7: Update Index (NEW - CRITICAL)

Run the CLI command to add the new session to the metadata index:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-index --session {name}
```

This ensures the new session appears immediately in `/session list` without requiring a full rebuild.

### Step 8: Display Success Message

Show this confirmation to the user:

```
✓ Session '{name}' started
📁 Location: .claude/sessions/{name}/
💡 Use /session save to capture important milestones
📊 Check /session status to monitor tokens

Ready to work! What would you like to accomplish in this session?
```

### Step 9: Ask for Session Goal

After showing the success message, ask the user:
"What is the main goal or purpose of this session? (This will be saved to session.md)"

Wait for their response, then update the "Goal" section in session.md with their answer.

---

**PERFORMANCE BENEFITS:**
- **Before:** No index integration, sessions invisible until manual list command scans
- **After:** Instant index update, session immediately visible in list
- **Improvement:** Better UX, no stale index issues

**IMPORTANT:**
- Execute all steps in order
- Use the Read, Write, and Bash tools to perform file operations
- The CLI update-index command is fast (< 10ms) and ensures consistency
- Do not skip any steps

---

## CRITICAL: Check for Unconsolidated Logs (Inline Analysis)

**IMPORTANT:** New session start should NOT have unconsolidated logs, but check anyway for robustness.

**MUST CHECK BEFORE DISPLAYING SUCCESS MESSAGE:**

After starting the session, check if previous session left unconsolidated logs:

1. Check if `.claude/sessions/{name}/conversation-log.jsonl` exists
2. If the file exists:
   - Show brief message: "📊 Analyzing previous session... (this may take 1-3 seconds)"
   - Read the conversation log file
   - Parse interactions from JSONL format
   - **Capture git history (if available):**
     - Run: `node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{name}"`
     - This creates `.claude/sessions/{name}/git-history.json` (~2-3KB compressed)
     - Contains: last 50 commits, uncommitted changes, branch status, hotspots
     - Performance: ~60-90ms (acceptable at session boundary)
     - If no git repo, command returns success: false (silent skip, no error)
   - Analyze the conversation with Claude inline:
     - Extract conversation summary (2-3 paragraphs covering what happened)
     - Identify key decisions made with rationale
     - List completed todos/tasks
     - Document files modified with context about what changed and why
     - Assess current state, what's next, and any blockers
   - Create consolidated snapshot via CLI:
     ```bash
     echo "# Consolidated Snapshot: {session_name}
**Timestamp**: {ISO timestamp}
**Method**: Claude Inline Analysis (Free)
**Status**: Consolidated from conversation log

## Conversation Summary
{2-3 paragraph summary of what happened in session}

## Key Decisions
- {Decision 1 with rationale}
- {Decision 2 with rationale}

## Completed Tasks
- {Task 1}
- {Task 2}

## Files Modified
- {file_path}: {what changed and why}

## Current State
{Where things stand, what's next, blockers}

## Notes
Consolidated via Claude inline analysis at session boundary. Zero cost, highest quality." | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{name}" --stdin --type auto
     ```
   - Delete conversation-log.jsonl after successful snapshot creation
   - Update `.auto-capture-state` to reset counters and set last_snapshot_timestamp
3. If no log exists:
   - **Still capture git history** for repository context:
     - Run: `node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{name}"`
     - This provides git context even for new sessions
     - Silent skip if no git repo (no error)
   - Initialize `.auto-capture-state` if needed

**PERFORMANCE:**
- Log check: <5ms
- Claude analysis: 1-3s (acceptable at session boundaries - users expect loading)
- Snapshot write: <50ms
- Log deletion: <5ms
- **Total: ~1-3 seconds** (users expect loading at session start)

**NOTE:** This is the v3.5.1 architecture where conversation logging is incremental (<2ms per interaction) and consolidation happens inline at session boundaries using FREE Claude analysis for highest quality.
