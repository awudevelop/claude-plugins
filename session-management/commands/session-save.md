You are managing a session memory system. The user wants to manually save a snapshot of the current session state.

## Task: Save Session Snapshot

Capture the current context and save it as a timestamped snapshot.

### Step 1: Validate Active Session

1. Check if `.claude/sessions/.active-session` file exists
2. If NOT exists, show error:
   ```
   ❌ Error: No active session
   💡 Use /session start [name] to create a new session
   💡 Or use /session continue [name] to resume an existing session
   ```
   Then STOP.
3. Read the active session name from `.active-session`
4. Verify the session directory `.claude/sessions/{active_session}/` exists
5. If NOT exists, show error:
   ```
   ❌ Error: Active session directory not found
   The session may have been deleted. Please start a new session.
   ```
   Then STOP.

### Step 2: Generate Snapshot Filename

1. Get current timestamp in format: `YYYY-MM-DD_HH-MM` (e.g., `2025-10-23_16-45`)
2. Create snapshot path: `.claude/sessions/{active_session}/{timestamp}.md`
3. Check if file already exists (unlikely but possible if saving twice in same minute)
4. If exists, append a counter: `{timestamp}_2.md`

### Step 3: Capture Conversation Context

Analyze the recent conversation (last 10-20 exchanges) and create a summary:
- What topics were discussed
- What problems were solved
- What decisions were made
- What tasks were attempted or completed

Keep this summary concise but informative (3-5 sentences).

### Step 4: Capture Completed Todos

Look for any todos that were marked as completed in this conversation:
- Check for completed checkboxes in messages
- Check for explicit "completed" or "done" mentions
- List them in checkbox format: `- [x] Task description`

If no todos were completed, write: `- No todos completed in this segment`

### Step 5: Capture Files Modified

Identify all files that were modified in this conversation:
- Files written with Write tool
- Files edited with Edit tool
- Files created or modified

For each file, capture:
- File path
- Brief description of changes made (1-2 lines)

Format:
```markdown
### path/to/file.ts
- Added authentication middleware
- Updated error handling
```

If no files were modified, write: `No files modified in this segment`

### Step 6: Capture Current State

Describe the current state of the work:
- What's working now
- What's in progress
- What's blocked
- What's next

Format as bullet points (3-5 items).

### Step 7: Capture Key Code Snippets (Optional)

If any particularly important code was written or discussed, include a representative snippet:
- Limit to 20-30 lines maximum
- Include language identifier for syntax highlighting
- Add brief explanation

Only include if genuinely important. Skip if no critical code.

### Step 8: Create Snapshot File

Write the snapshot file with this structure:

```markdown
# Snapshot: {session_name}
**Timestamp**: {full_timestamp_YYYY-MM-DD_HH:MM:SS}

## Conversation Summary
{summary_from_step_3}

## Completed Todos
{todos_from_step_4}

## Files Modified
{files_from_step_5}

## Current State
{state_from_step_6}

## Key Code Snippets
{snippets_from_step_7_if_any}

## Notes
{any_additional_important_observations}
```

### Step 9: Update context.md

1. Read current `.claude/sessions/{active_session}/context.md`
2. If any key decisions were made in this conversation, add them to "Key Decisions" section:
   ```markdown
   ### {current_timestamp}
   - Decision: {what_was_decided}
   - Rationale: {why_this_approach}
   - Impact: {what_this_affects}
   ```
3. If any important discoveries were made, add to "Important Discoveries" section
4. If any blockers were encountered or resolved, update "Blockers & Resolutions" section
5. Update the "Summary" section with a running summary including this snapshot
6. Write the updated context.md back

### Step 10: Update session.md Timestamp

1. Read `.claude/sessions/{active_session}/session.md`
2. Update the "Last Updated" field to current timestamp
3. If any new files were involved, add them to "Files Involved" section
4. Write back the updated session.md

### Step 11: Display Success Message

Show confirmation:

```
✓ Session snapshot saved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 .claude/sessions/{session_name}/{timestamp}.md
📝 Captured:
   - Conversation summary
   - {X} completed todos
   - {Y} file changes
   - Current state and next steps
   {if_decisions: "- {Z} key decisions"}

💾 Context updated in context.md
⏰ Session timestamp updated
```

---

**IMPORTANT**:
- Be thorough in capturing context - this is critical for session continuity
- Use Read, Write, and Edit tools appropriately
- Format all markdown properly
- Include enough detail to resume work later
- Don't include sensitive information (API keys, passwords, etc.)
- Keep summaries concise but informative
- Timestamps should be accurate and consistent
