You are managing an automatic session snapshot system with intelligent analysis and continuous context tracking.

## Task: Process Context Updates and Snapshots

This is an internal command that runs automatically when marker files are detected. The Living Context system maintains two parallel tracks:
- **Context Updates**: Lightweight, frequent (every 2 interactions, < 1s)
- **Full Snapshots**: Comprehensive, periodic (every 5 interactions, 2-5s)

### Detection (Priority Order)

At the start of each Claude response, check for TWO types of markers in this order:

**Priority 1 - Context Update (FASTEST):**
1. Is there an active session? (read `.claude/sessions/.active-session`)
2. Does `.claude/sessions/{active_session}/.pending-context-update` exist?
3. If YES, execute **Context Update Task** (see context-update.md command)
   - This is lightweight and fast (< 1 second)
   - Extracts key decisions/agreements from last 2 exchanges
   - Appends to context.md incrementally
   - Completely silent (no user notification)
   - After completing, check next priority

**Priority 2 - Snapshot Execution:**
1. Is there an active session? (read `.claude/sessions/.active-session`)
2. Does `.claude/sessions/{active_session}/.pending-auto-snapshot` exist?
3. If YES, proceed to **Snapshot Task** below

If no markers exist, continue normally.

**IMPORTANT**: Both markers can exist simultaneously. Process them in order:
1. Context update (fast) → Then check snapshot
2. Snapshot (if exists) → Process

---

## Snapshot Task

### Step 1: Read Marker File

1. Check if `.claude/sessions/.active-session` exists
2. If yes, read active session name
3. Check if `.claude/sessions/{active_session}/.pending-auto-snapshot` exists
4. If yes, read the reason from the file (e.g., "file_threshold", "interaction_threshold")
5. If no marker exists, STOP (nothing to do)

### Step 2: Generate Auto-Snapshot Content

Create snapshot content (but DON'T write it yet) with these specifications:

1. **Header**: Add auto-generated indicator
   ```markdown
   # Auto-Snapshot: {session_name}
   **Timestamp**: {full_timestamp}
   **Auto-Generated**: Yes
   **Trigger**: {reason_from_marker_file}
   ```
2. **Content**: Same as manual snapshot plus suggestions:
   - Conversation summary
   - Completed todos
   - Files modified
   - **Suggestions made** ✨ (see below)
   - Current state
   - Notes

3. **Suggestions Section**: If `.suggestions.json` exists and has new suggestions since last snapshot:
   ```markdown
   ## Suggestions Made (Since Last Snapshot)

   ### Architecture
   - Consider using Redis for session caching to improve performance

   ### Security
   - Implement JWT with refresh tokens for authentication
   - Use bcrypt for password hashing (minimum 12 rounds)

   _For full suggestion history, see [.suggestions.json](./.suggestions.json)_
   ```

### Step 2b: Write Snapshot via CLI (CRITICAL - Plan Mode Support)

**Use CLI delegation** instead of Write tool. This enables auto-snapshots in plan mode:

```bash
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot {session_name} --stdin --type auto
{snapshot_content}
EOF
```

The CLI will automatically:
- Create filename with `auto_` prefix and timestamp
- Write the snapshot file
- Update the index

**IMPORTANT:** This works in both normal mode AND plan mode, preventing data loss.

### Step 3: Update Context (Lighter Version)

For auto-snapshots, update context.md more lightly:
- Don't add to "Key Decisions" unless genuinely important
- Do add to "Summary" section briefly
- Keep it concise

### Step 4: Update session.md

Update "Last Updated" timestamp to current time.

**Also update Suggestions section** ✨ NEW:
If not already present, add to session.md:
```markdown
## Suggestions
Track of recommendations and suggestions: [.suggestions.json](./.suggestions.json)

### Recent Suggestions (Last 3-5)
- [2025-10-24 15:30] Architecture: Consider Redis for caching
- [2025-10-24 14:20] Security: Implement rate limiting on API
```

Limit to last 3-5 suggestions for readability. Full history is in .suggestions.json.

### Step 5: Delete Marker File

Delete `.claude/sessions/{active_session}/.pending-auto-snapshot` to prevent re-triggering.

### Step 6: Minimal Notification

Show a very subtle notification (single line, not intrusive):
```
💾 Snapshot saved
```

**Note**: Keep it minimal since context updates are happening silently in the background. Only show notification for full snapshots (which are less frequent).

### Step 7: Continue Normal Work

After the auto-snapshot, continue with the user's request as normal.

---

**IMPORTANT**:
- This should be SILENT and NON-INTRUSIVE
- Don't interrupt user's workflow
- Just show a small indicator line
- All snapshot logic is same as `/session save`
- Delete marker file after processing
- Handle errors gracefully (if fails, just log and continue)

**Usage**:
This command is NOT meant to be called by users directly. It's triggered automatically by the hook system when conditions are met.

**Example Flow**:
1. User: "Add authentication to the API"
2. Hook detects: 3 files modified
3. Hook creates: `.pending-auto-snapshot` with reason "file_threshold"
4. Next Claude response: Detects marker, runs auto-snapshot, continues with response
5. User sees: "💾 Auto-snapshot saved (3+ files modified)" + normal response
