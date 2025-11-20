You are managing a session memory system. The user wants to manually save a snapshot of the current session state.

## Task: Save Session Snapshot

Capture the current context and save it as a timestamped snapshot.

**CRITICAL OPTIMIZATION:** This command now uses CLI for snapshot writes, enabling plan mode support.

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

### Step 2: Capture Conversation Context

Analyze the recent conversation (last 10-20 exchanges) and create a summary:
- What topics were discussed
- What problems were solved
- What decisions were made
- What tasks were attempted or completed

Keep this summary concise but informative (3-5 sentences).

### Step 3: Capture Completed Todos

Look for any todos that were marked as completed in this conversation:
- Check for completed checkboxes in messages
- Check for explicit "completed" or "done" mentions
- List them in checkbox format: `- [x] Task description`

If no todos were completed, write: `- No todos completed in this segment`

### Step 4: Capture Files Modified

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

### Step 5: Capture Current State

Describe the current state of the work:
- What's working now
- What's in progress
- What's blocked
- What's next

Format as bullet points (3-5 items).

### Step 6: Capture Key Code Snippets (Optional)

If any particularly important code was written or discussed, include a representative snippet:
- Limit to 20-30 lines maximum
- Include language identifier for syntax highlighting
- Add brief explanation

Only include if genuinely important. Skip if no critical code.

### Step 7: Generate Snapshot Content

Create the snapshot content in this structure (but DON'T write it yet):

```markdown
# Snapshot: {session_name}
**Timestamp**: {full_timestamp_YYYY-MM-DD_HH:MM:SS}
**Format Version**: 2.0

## Topics Discussed
1. **[Category]**: {topic_1_brief_description}
2. **[Category]**: {topic_2_brief_description}
{continue_for_all_topics}

## Suggestions & Recommendations
1. **[Category]**: {suggestion} - {rationale}
{if_any_suggestions_given}

## Decisions Made
1. **[Decision]**: {rationale}
{if_any_decisions_made}

## Tasks Completed
1. {completed_task_1}
2. {completed_task_2}
{or_write_"No_tasks_completed"}

## Files Modified
1. `{file_path}`: {what_changed_and_why}
{or_write_"No_files_modified"}

## Current Status
- **Progress**: {where_things_stand}
- **Next Steps**: {what_should_be_done_next}
- **Blockers**: {issues_or_"None"}

## Notes
{any_additional_important_observations}
```

### Step 8: Write Snapshot via CLI (CRITICAL - Plan Mode Support)

**Instead of using the Write tool**, use the CLI with stdin to write the snapshot.
This enables snapshot saves even in plan mode where Write tool is blocked.

Run this command, piping the snapshot content via stdin:

```bash
echo "{snapshot_content}" | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot {session_name} --stdin --type manual
```

**IMPORTANT:** Escape any special characters in the content appropriately for the shell.

Alternative approach if echo has escaping issues:
```bash
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot {session_name} --stdin --type manual
{snapshot_content}
EOF
```

The CLI will:
- Write the snapshot file with timestamp
- Update the index automatically
- Return success with filename

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
6. Write the updated context.md back (use Edit tool for this - it's allowed in plan mode for session files)

### Step 10: Update session.md Timestamp

1. Read `.claude/sessions/{active_session}/session.md`
2. Update the "Last Updated" field to current timestamp
3. If any new files were involved, add them to "Files Involved" section
4. Write back the updated session.md (use Edit tool)

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

**CRITICAL BENEFITS - PLAN MODE SUPPORT:**
- **Problem:** In plan mode, Write tool is blocked (prevents accidental code changes)
- **Impact:** Snapshots couldn't be saved, causing data loss on `/clear`
- **Solution:** CLI delegation via Bash bypasses Write tool restrictions
- **Result:** Zero data loss in plan mode, seamless user experience

**PERFORMANCE BENEFITS:**
- **Before:** 15-25K tokens for snapshot analysis and writes
- **After:** 8-15K tokens, CLI handles write operations
- **Improvement:** ~40-50% token reduction, instant index update

**IMPORTANT NOTES:**
- Use heredoc (cat <<'EOF') for reliable content piping, avoids escaping issues
- CLI write-snapshot automatically updates index, no separate step needed
- Edit tool can still be used for session.md and context.md (they're documentation, not code)
- This approach works in BOTH normal mode and plan mode
