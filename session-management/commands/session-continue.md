You are managing a session memory system. The user wants to resume an existing session.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session continue [name]`

### Step 1: Validate Session Exists

1. Extract the session name from the arguments
2. Check if `.claude/sessions/{name}/` directory exists
3. If NOT exists, show error:
   ```
   ❌ Error: Session '{name}' not found
   💡 Use /session list to see available sessions
   💡 Use /session start {name} to create a new session
   ```
   Then STOP.

### Step 2: Check for Required Files

1. Verify `.claude/sessions/{name}/session.md` exists
2. If missing, show warning:
   ```
   ⚠️  Warning: Session '{name}' is missing session.md
   This session may be corrupted. Would you like to:
   1. Reinitialize the session (may lose some data)
   2. Skip and choose another session
   ```
   Wait for user decision. If reinitialize, create new session.md. If skip, STOP.

### Step 3: Read session.md

1. Read `.claude/sessions/{name}/session.md`
2. Extract key information:
   - Status (Active/Closed)
   - Started timestamp
   - Last Updated timestamp
   - Goal
   - Overview
   - Key Milestones
   - Files Involved

### Step 4: Read context.md

1. Read `.claude/sessions/{name}/context.md`
2. Extract:
   - Key Decisions (recent ones)
   - Important Discoveries
   - Blockers & Resolutions
   - Technical Context
   - Summary

### Step 5: Read Latest Snapshot

1. List all files in `.claude/sessions/{name}/` matching pattern `YYYY-MM-DD_HH-MM.md`
2. Find the most recent snapshot by sorting filenames (lexicographic sort works due to timestamp format)
3. If snapshots exist, read the latest one
4. Extract:
   - Conversation Summary
   - Completed Todos
   - Files Modified
   - Current State
   - Notes

### Step 6: Update Active Session

1. Write the session name to `.claude/sessions/.active-session`
2. Update "Last Updated" timestamp in session.md to current time

### Step 7: Display Context Summary

Show a comprehensive summary to the user:

```
✓ Loaded session: '{name}'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Started: {started_date}
🎯 Goal: {goal_from_session_md}
📝 Last update: {last_updated_date}
⏰ Status: {status}

## Recent Context

{latest_snapshot_conversation_summary_if_available}

## Key Files
{list_of_files_involved_from_session_md_and_latest_snapshot}

## Milestones
{key_milestones_from_session_md_with_checkboxes}

## Recent Decisions
{recent_decisions_from_context_md_max_3}

## Current State
{current_state_from_latest_snapshot_if_available}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to continue! How would you like to proceed?
```

### Step 8: Prepare for Work

Tell the user:
"I've loaded the full context for session '{name}'. All previous work, decisions, and progress have been restored. What would you like to work on next?"

---

**IMPORTANT**:
- Execute all steps in order
- Use Read tool to read all files
- Use Edit tool to update timestamps in session.md
- Use Write tool to update .active-session
- Format the output cleanly with appropriate sections
- If snapshot doesn't exist, skip that section but continue with session.md and context.md
