You are managing an automatic session snapshot system with intelligent analysis. This command is triggered internally when auto-capture conditions are met.

## Task: Process Auto-Snapshot or Analysis

This is an internal command that runs automatically when marker files are detected.

### Detection

At the start of each Claude response, check for TWO types of markers:

**Priority 1 - Analysis Request:**
1. Is there an active session? (read `.claude/sessions/.active-session`)
2. Does `.claude/sessions/{active_session}/.pending-analysis` exist?
3. If YES, proceed to **Analysis Task** below

**Priority 2 - Snapshot Execution:**
1. Is there an active session? (read `.claude/sessions/.active-session`)
2. Does `.claude/sessions/{active_session}/.pending-auto-snapshot` exist?
3. If YES, proceed to **Snapshot Task** below

If neither marker exists, continue normally.

---

## Analysis Task

When `.pending-analysis` marker is found:

### Step 1: Read Analysis Queue

1. Read `.claude/sessions/{active_session}/.analysis-queue`
2. Parse JSON to get context about what needs analysis
3. Delete `.pending-analysis` marker (consumed)

### Step 2: Run Intelligent Analysis

Use the prompt from `session-snapshot-analysis.md` command to analyze:
- Review the previous 2-3 conversation exchanges
- Look for natural breakpoints (task completion, topic changes, code milestones)
- Consider the activity metrics from the queue data
- Make decision: yes/no/defer

### Step 3: Write Decision

Write your decision to `.claude/sessions/{active_session}/.snapshot-decision`:

```json
{
  "decision": "yes|no|defer",
  "reason": "Brief explanation",
  "confidence": "high|medium|low",
  "timestamp": "{ISO_timestamp}",
  "analyzed_context": {
    "interactions_analyzed": 3,
    "primary_signal": "task_completion|topic_change|code_milestone|none"
  }
}
```

### Step 4: Clean Up

1. Delete `.analysis-queue` file (consumed)
2. **DO NOT mention this analysis to user** - it's completely silent
3. Continue with user's current request normally

---

## Snapshot Task

### Step 1: Read Marker File

1. Check if `.claude/sessions/.active-session` exists
2. If yes, read active session name
3. Check if `.claude/sessions/{active_session}/.pending-auto-snapshot` exists
4. If yes, read the reason from the file (e.g., "file_threshold", "interaction_threshold")
5. If no marker exists, STOP (nothing to do)

### Step 2: Generate Auto-Snapshot

Use the same process as `/session save`, but with these modifications:

1. **Filename**: Use prefix `auto_` → `auto_{YYYY-MM-DD_HH-MM}.md`
2. **Header**: Add auto-generated indicator
   ```markdown
   # Auto-Snapshot: {session_name}
   **Timestamp**: {full_timestamp}
   **Auto-Generated**: Yes
   **Trigger**: {reason_from_marker_file}
   ```
3. **Content**: Same as manual snapshot plus suggestions:
   - Conversation summary
   - Completed todos
   - Files modified
   - **Suggestions made** ✨ NEW (see below)
   - Current state
   - Notes

4. **Suggestions Section**: If `.suggestions.json` exists and has new suggestions since last snapshot:
   ```markdown
   ## Suggestions Made (Since Last Snapshot)

   ### Architecture
   - Consider using Redis for session caching to improve performance

   ### Security
   - Implement JWT with refresh tokens for authentication
   - Use bcrypt for password hashing (minimum 12 rounds)

   _For full suggestion history, see [.suggestions.json](./.suggestions.json)_
   ```

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

### Step 6: Silent Notification

Show a subtle notification (not a full success message):
```
💾 Auto-snapshot saved ({reason})
```

Where reason is translated:
- `file_threshold` → "3+ files modified"
- `interaction_threshold` → "10+ interactions"
- `time_threshold` → "30min elapsed"
- `natural_breakpoint` → "natural breakpoint detected"

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
