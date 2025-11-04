You are managing a session memory system. The user wants to close and finalize the current session.

## Task: Close Session

Finalize the session by creating a final snapshot, updating metadata, and generating a summary.

### Step 1: Validate Active Session

1. Check if `.claude/sessions/.active-session` file exists
2. If NOT exists, show error:
   ```
   ❌ Error: No active session to close

   💡 Use /session start [name] to create a new session
   💡 Or use /session continue [name] to resume an existing session
   ```
   Then STOP.
3. Read the active session name from `.active-session`
4. Verify session directory exists

### Step 2: Read Current Session Data

Read `.claude/sessions/{active_session}/session.md` and extract:
- Started timestamp
- Last Updated timestamp
- Goal
- Files Involved
- Milestones (count completed and total)

### Step 3: Calculate Session Statistics

1. **Duration**: Calculate time from "Started" to now
   - Format: `Xh Ym` (e.g., "4h 35m")

2. **Snapshot Count**: Count all snapshot files matching `YYYY-MM-DD_HH-MM.md` pattern in session directory

3. **Files Modified**: Count unique files in "Files Involved" section of session.md

4. **Todos/Milestones Completed**: Count checked milestones in session.md

5. **Token Usage**: Get current conversation token usage (from system info or estimate)
   - Format as "XXXk" (e.g., "67.4k")

### Step 4: Generate Final Snapshot

Create a final snapshot using the same process as `/session save`:

1. Generate timestamp filename: `YYYY-MM-DD_HH-MM.md`
2. Capture:
   - Conversation summary (what was accomplished in this session)
   - Final completed todos
   - Final file changes
   - Final state
   - Session outcome/results

3. **IMPORTANT**: In the snapshot, add a header line:
   ```markdown
   # FINAL Snapshot: {session_name}
   **Timestamp**: {timestamp}
   **Session Closed**: This is the final snapshot before session closure
   ```

4. Include a "Session Outcome" section:
   ```markdown
   ## Session Outcome
   - Goal: {original_goal_from_session_md}
   - Status: {Completed|Partially Completed|In Progress}
   - Key Achievements: {list_main_accomplishments}
   - Remaining Work: {list_what_still_needs_to_be_done}
   ```

### Step 5: Update context.md with Final Summary

1. Read `.claude/sessions/{active_session}/context.md`
2. Add a final entry to the "Summary" section:
   ```markdown
   ## Session Closure Summary

   **Closed**: {current_timestamp}
   **Duration**: {duration}
   **Outcome**: {Completed|Partially Completed}

   ### What Was Accomplished
   {bullet_list_of_main_accomplishments}

   ### Final State
   {description_of_final_state}

   ### Next Steps (if resuming later)
   {what_to_do_when_session_is_continued}
   ```
3. Write updated context.md

### Step 6: Update session.md with Closed Status

1. Read `.claude/sessions/{active_session}/session.md`
2. Update these fields:
   - **Status**: Change from "Active" to "Closed"
   - **Closed**: Add current timestamp
   - **Last Updated**: Update to current timestamp
3. Write updated session.md

### Step 7: Clear Active Session

1. Delete or clear the `.claude/sessions/.active-session` file
2. This marks that no session is currently active

### Step 8: Display Closing Summary

Show comprehensive closing summary:

```
✓ Session '{session_name}' closed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Session Summary:
   Duration: {duration_formatted}
   Snapshots: {snapshot_count}
   Files modified: {file_count}
   Milestones completed: {completed_milestones}/{total_milestones}
   Token usage (this conversation): {token_usage_formatted}

🎯 Goal: {original_goal}

✅ Key Achievements:
   {list_top_3_to_5_achievements}

📁 Session saved to: .claude/sessions/{session_name}/

💡 Use /session continue {session_name} to resume later
💡 Use /session list to see all sessions
```

### Example Output:

```
✓ Session 'feature-auth-system' closed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Session Summary:
   Duration: 4h 35m
   Snapshots: 5
   Files modified: 12
   Milestones completed: 8/10
   Token usage (this conversation): 67.4k

🎯 Goal: Implement OAuth2 authentication system

✅ Key Achievements:
   - Implemented Google OAuth provider integration
   - Created authentication middleware
   - Added token refresh mechanism
   - Built user profile synchronization
   - Completed security testing

📁 Session saved to: .claude/sessions/feature-auth-system/

💡 Use /session continue feature-auth-system to resume later
💡 Use /session list to see all sessions
```

### Step 9: Offer Next Steps

Ask the user:
```
Session closed successfully. Would you like to:
1. Start a new session (/session start [name])
2. Review another session (/session list)
3. Continue with other work
```

---

**IMPORTANT**:
- Execute all steps in order
- The final snapshot should be comprehensive - it's the last capture
- Update all metadata files (session.md, context.md)
- Clear active session AFTER all files are updated
- Format output professionally with clear statistics
- Handle errors gracefully (e.g., if session files are missing)
- Token usage should be from current conversation only, not cumulative
- Duration should be accurate based on timestamps
- Provide clear next steps for user
