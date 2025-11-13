# Process Session Auto-Capture Markers (Internal - Automatic)

**Purpose**: Automatically process pending session markers when triggered by system reminders.

**Trigger**: This command executes automatically when the UserPromptSubmit hook injects a system reminder indicating pending markers.

**Execution Mode**: Silent and non-intrusive. Process markers and continue with user's request.

---

## Overview

The session plugin hooks inject system reminders when auto-capture thresholds are met:
- Context update markers (every 2 interactions)
- Snapshot markers (every 5 interactions or 3+ files)

This command detects which markers exist and processes them automatically.

---

## Step 1: Detect Active Session

1. Check if `.claude/sessions/.active-session` exists
2. If not, exit silently (no active session)
3. Read active session name from file
4. Verify session directory exists: `.claude/sessions/{session_name}/`
5. If not, exit silently (corrupted state)

---

## Step 2: Check for Context Update Marker (Priority 1)

Context updates are lightweight (< 1s) and should be processed first.

1. Check if `.claude/sessions/{session_name}/.pending-context-update` exists
2. If YES, process context update:

### Context Update Processing

Review ONLY the **last 2 message exchanges** and extract key items:

**Look for:**
- **Decisions**: "let's go with", "I choose", "we'll use", "decided to"
- **Agreements**: "yes", "approved", "that works"
- **Requirements**: "must", "should not", "required"
- **Discoveries**: "found the bug", "root cause", "discovered that"
- **Technical choices**: Architecture decisions, library selections

**Append to context.md** under appropriate sections:
```markdown
### [YYYY-MM-DD HH:MM] Context Update

- [HH:MM] Decision: {what} | Reasoning: {why}
- [HH:MM] Discovery: {what} | Impact: {significance}
- [HH:MM] Technical: {what} | Rationale: {why}
```

**Rules:**
- Only append NEW items (don't duplicate existing content)
- Be concise and clear
- Group related items under same timestamp
- Skip if nothing significant found (perfectly fine)
- Use Edit tool to append to context.md

**Cleanup:**
- Delete `.pending-context-update` marker file
- **DO NOT notify user** (completely silent)

---

## Step 3: Check for Snapshot Marker (Priority 2)

Snapshots are comprehensive (2-5s) and should be processed after context updates.

1. Check if `.claude/sessions/{session_name}/.pending-auto-snapshot` exists
2. If YES, process snapshot:

### Snapshot Processing

**Read marker file** to determine trigger reason:
- `interaction_threshold`: 5 interactions reached
- `file_threshold`: 3+ files modified

**Generate snapshot content** with:
```markdown
# Auto-Snapshot: {session_name}
**Timestamp**: {YYYY-MM-DD HH:MM:SS}
**Auto-Generated**: Yes
**Trigger**: {trigger_reason}

## Conversation Summary
{Comprehensive summary of conversation since last snapshot}

## Completed Todos
{List of completed tasks from todo list}

## Files Modified
{List of files changed with brief description of changes}

## Current State
{Current status of work, blockers, next steps}

## Notes
{Any important context or observations}
```

**Write snapshot via CLI** (plan mode safe):
```bash
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot {session_name} --stdin --type auto
{snapshot_content}
EOF
```

**Update session.md**:
- Update "Last Updated" timestamp to current time

**Cleanup:**
- Delete `.pending-auto-snapshot` marker file

**Notification:**
- Show minimal notification: `💾 Snapshot saved`

---

## Step 4: Continue with User Request

After processing all markers, continue with the user's current request as normal.

---

## Error Handling

If any errors occur during processing:
1. Log error silently (don't notify user)
2. Delete marker files anyway (prevent infinite retry loops)
3. Continue with user's request normally
4. Don't let marker processing failures block the conversation

---

## Performance Guidelines

**Context Update:**
- Time budget: < 1 second
- Token budget: ~300 tokens
- Only analyze last 2 exchanges
- Silent execution (no user notification)

**Snapshot:**
- Time budget: 2-5 seconds
- Token budget: ~1000 tokens
- Comprehensive conversation analysis
- Minimal notification (single line)

---

## Example Execution Flow

**Scenario**: User sends message, hook detects 2 interactions elapsed

1. Hook creates `.pending-context-update` marker
2. Hook injects system reminder
3. **Claude sees reminder and automatically executes this command**
4. Command detects context update marker
5. Command extracts key points from last 2 exchanges
6. Command appends to context.md (silent)
7. Command deletes marker
8. Command continues with user's request
9. **User sees only the normal response** (no indication processing happened)

**Scenario**: User sends message, hook detects 5 interactions elapsed

1. Hook creates `.pending-auto-snapshot` marker
2. Hook injects system reminder
3. **Claude sees reminder and automatically executes this command**
4. Command detects snapshot marker
5. Command generates comprehensive snapshot
6. Command writes snapshot via CLI
7. Command updates session.md
8. Command deletes marker
9. Command shows minimal notification: `💾 Snapshot saved`
10. Command continues with user's request

---

## Important Notes

- **Fully automatic**: No user intervention required
- **Non-intrusive**: Silent context updates, minimal snapshot notification
- **Plan mode safe**: Uses CLI delegation for file writes
- **Graceful failure**: Errors don't block conversation
- **Idempotent**: Safe to run multiple times (checks markers exist first)
- **Priority ordering**: Context updates before snapshots (lighter → heavier)
