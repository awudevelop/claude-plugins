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
