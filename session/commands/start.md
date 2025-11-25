You are managing a session memory system. The user wants to start a new named session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:list`, `/session:start`, `/session:continue`, `/session:status`
- ❌ Wrong: `/session list`, `/session start`, `/session continue`, `/session status`
Use ONLY the exact command formats specified in this template.

## Task: Start New Session

Parse the session name from the command arguments. The command format is: `/session:start [name]`

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

**CRITICAL:** Check both directory names AND session.md file contents to prevent duplicates.

1. **Check directory collision:**
   - Check if `.claude/sessions/{name}/` directory already exists
   - If exists, show error:
     ```
     ❌ Error: Session directory '{name}' already exists
     💡 Use /session:continue {name} to resume
     💡 Or use /session:list to see all sessions
     ```
     Then STOP.

2. **Check session name collision (NEW - prevents duplicate names):**
   - Use the CLI to get all existing sessions:
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list
     ```
   - Parse the JSON response and check if any existing session has `name: "{name}"`
   - If a session with this name exists (even if directory name is different), show error:
     ```
     ❌ Error: A session named '{name}' already exists
     💡 Use /session:list to see all sessions
     💡 Choose a different name for this session
     ```
     Then STOP.

This dual-check prevents both directory collisions and duplicate session names.

### Step 3: Check for Active Session and Transition (NEW - Session Cleanup)

Before creating the new session, check if there's already an active session:

1. Check if `.claude/sessions/.active-session` exists
2. If it exists:
   - Read the current active session name
   - Show: "📋 Closing previous session '{previous_session_name}'..."
   - Close the previous session status:
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-status "{previous_session_name}" "closed"
     ```
   - This marks the previous session as closed in `.auto-capture-state`
3. Continue to next step (the new session activation will overwrite `.active-session`)

**Note:** The SessionEnd hook will handle final cleanup on Claude Code termination.

### Step 4: Create Session Folder

1. Create directory: `.claude/sessions/{name}/`
2. Verify creation was successful

### Step 5: Initialize session.md

**CRITICAL:** The session name in session.md MUST match the directory name to prevent duplicates.

Create `.claude/sessions/{name}/session.md` with this content:

```markdown
# Session: {name}

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
Session started. Use /session:save to capture important milestones.
```

### Step 6: Initialize context.md

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

### Step 7: Update Active Session Tracker

1. Write the session name to `.claude/sessions/.active-session` (single line, just the name)
2. This marks it as the currently active session

### Step 7.5: Initialize .auto-capture-state with Session Status

Create `.claude/sessions/{name}/.auto-capture-state` with initial session status:

```bash
echo '{
  "interaction_count": 0,
  "modified_files": [],
  "last_snapshot_timestamp": null,
  "session_status": "active",
  "session_started": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "session_closed": null
}' > .claude/sessions/{name}/.auto-capture-state
```

This initializes the operational state tracking for the session, including the session status which is now tracked in JSON for fast, atomic updates.

### Step 8: Update Index (NEW - CRITICAL)

Run the CLI command to add the new session to the metadata index:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-index --session {name}
```

This ensures the new session appears immediately in `/session:list` without requiring a full rebuild.

### Step 9: Display Success Message

Show this confirmation to the user:

```
✓ Session '{name}' started
📁 Location: .claude/sessions/{name}/
💡 Use /session:save to capture important milestones
📊 Check /session:status to monitor tokens

Ready to work! What would you like to accomplish in this session?
```

### Step 10: Ask for Session Goal

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
**Format Version**: 2.0

## Topics Discussed

1. **[Category]**: [Brief description of what was discussed]
2. **[Category]**: [Brief description of what was discussed]
[Continue for ALL topics in chronological order]

## Suggestions & Recommendations

1. **[Category]**: [Specific suggestion] - [Rationale]
2. **[Category]**: [Specific suggestion] - [Rationale]
[Continue for ALL suggestions]

## Decisions Made

1. **[Decision]**: [Rationale and context]
2. **[Decision]**: [Rationale and context]
[Continue for ALL decisions]

## Tasks Completed

1. [Action completed in past tense]
2. [Action completed in past tense]
[Continue for ALL tasks]

## Files Modified

1. `[file_path]`: [What changed and why]
2. `[file_path]`: [What changed and why]
[Continue for ALL files]

## Current Status

- **Progress**: [Where things stand - what's been accomplished]
- **Next Steps**: [What should be done next]
- **Blockers**: [Issues or write \"None\"]

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
