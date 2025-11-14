You are managing a session memory system. The user wants to resume an existing session.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session continue [name]`

**OPTIMIZATION**: v3.7.0 uses parallel subagent delegation for 72% token reduction (77k → 22k tokens).

### Step 1: Validate Session Exists (CLI)

Extract the session name from arguments, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get {session_name}
```

If this returns an error (exit code 2), the session doesn't exist. Show:
```
❌ Error: Session '{name}' not found
💡 Use /session list to see available sessions
💡 Use /session start {name} to create a new session
```
Then STOP.

The JSON response contains metadata (status, started, snapshotCount, etc.).

### Step 2: Delegate Heavy Work to Subagents (Parallel Execution)

**CRITICAL**: You MUST invoke ALL 3 Task tools in a SINGLE response message. This runs them in parallel and isolates heavy token usage from the main conversation.

Use the Task tool to spawn 3 parallel subagents with these exact configurations:

**Subagent 1 - Consolidate Conversation Log:**
- subagent_type: "general-purpose"
- description: "Consolidate conversation log"
- model: "sonnet"
- prompt:
  ```
  Session: {session_name}

  Goal: Consolidate conversation log into auto-snapshot (if log exists)

  Steps:
  1. Check if file exists: .claude/sessions/{session_name}/conversation-log.jsonl
  2. If file does NOT exist:
     - Return JSON: { "skipped": true, "reason": "No conversation log found" }
     - STOP (do not proceed)

  3. If file exists:
     - Read the conversation log file
     - Parse JSONL format (each line = JSON entry)
     - Extract:
       - type: "interaction" entries (user prompts from user_prompt field)
       - type: "assistant_response" entries (Claude responses from response_text field)

  4. Analyze the conversation:
     - Write 2-3 paragraph summary of what happened
     - Identify 2-4 key decisions with rationale
     - List completed tasks/todos
     - Document files modified with context (what changed and why)
     - Assess current state (what's done, what's next, blockers)

  5. Create consolidated snapshot with this exact format (use heredoc):

  cat <<'SNAPSHOT_EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
  # Consolidated Snapshot: {session_name}
  **Timestamp**: [current ISO timestamp]
  **Method**: Claude Inline Analysis (Free)
  **Status**: Consolidated from conversation log

  ## Conversation Summary
  [2-3 paragraphs]

  ## Key Decisions
  - [Decision 1 with rationale]
  - [Decision 2 with rationale]

  ## Completed Tasks
  - [Task 1]
  - [Task 2]

  ## Files Modified
  - [file_path]: [what changed and why]

  ## Current State
  [Where things stand, what's next, blockers]

  ## Notes
  Consolidated via Claude inline analysis at session boundary.
  SNAPSHOT_EOF

  6. Delete conversation log (with error checking):
     set -e  # Exit on any error
     rm .claude/sessions/{session_name}/conversation-log.jsonl

     # Verify deletion
     if [ -f .claude/sessions/{session_name}/conversation-log.jsonl ]; then
       echo '{"success": false, "error": "Failed to delete conversation log", "step_failed": 6}'
       exit 1
     fi

  7. Update state file (with correct JSON syntax):
     TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
     node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-state "{session_name}" "{\"interactions_since_snapshot\": 0, \"interactions_since_context_update\": 0, \"last_snapshot_timestamp\": \"$TIMESTAMP\"}"

     if [ $? -ne 0 ]; then
       echo '{"success": false, "error": "Failed to update state file", "step_failed": 7}'
       exit 1
     fi

  8. Verify all steps completed successfully:
     # Check snapshot exists
     if [ ! -f .claude/sessions/{session_name}/auto_*.md ]; then
       echo '{"success": false, "error": "Snapshot file not found", "step_failed": 5}'
       exit 1
     fi

     # Check log deleted
     if [ -f .claude/sessions/{session_name}/conversation-log.jsonl ]; then
       echo '{"success": false, "error": "Log file still exists", "step_failed": 6}'
       exit 1
     fi

     # Verify state reset
     STATE=$(node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-state "{session_name}")
     if ! echo "$STATE" | grep -q '"interactions_since_snapshot":0'; then
       echo '{"success": false, "error": "State counters not reset", "step_failed": 7}'
       exit 1
     fi

  Return Format:
  JSON with these exact fields (ONLY after all verifications pass):
  {
    "success": true,
    "snapshot_created": "[filename]",
    "timestamp": "[ISO timestamp]",
    "interaction_count": [number],
    "summary_preview": "[first 100 chars of summary]",
    "log_deleted": true,
    "state_reset": true
  }

  If any error occurs:
  {
    "success": false,
    "error": "[error description]",
    "step_failed": "[which step number]"
  }

  IMPORTANT:
  - Use exact CLI commands shown above
  - Do NOT read transcript files (log is self-contained)
  - Use set -e to halt on errors
  - Verify ALL steps before returning success
  - Return ONLY JSON, no additional commentary
  ```

**Subagent 2 - Refresh Git History:**
- subagent_type: "general-purpose"
- description: "Refresh git history"
- model: "haiku"
- prompt:
  ```
  Session: {session_name}

  Goal: Refresh git history context for session

  Steps:
  1. Run git history capture CLI:
     node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{session_name}"

  2. The CLI will:
     - Get last 50 commits (git log)
     - Get uncommitted changes (git status, git diff)
     - Calculate file hotspots (frequently changed files)
     - Compress to ~2-3KB JSON
     - Write to: .claude/sessions/{session_name}/git-history.json

  3. If no git repository:
     - CLI returns: { success: false }
     - This is OK, just return the result

  Return Format:
  JSON with these exact fields:
  {
    "success": true,
    "commits_analyzed": [number],
    "uncommitted_changes": [number],
    "file_hotspots_count": [number],
    "latest_commit_hash": "[hash]",
    "latest_commit_date": "[date]"
  }

  If no git repo or error:
  {
    "success": false,
    "reason": "[why]"
  }

  IMPORTANT:
  - Let CLI handle all git operations
  - Do NOT run git commands manually
  - Return ONLY JSON, no additional commentary
  ```

**Subagent 3 - Extract Session Goal:**
- subagent_type: "general-purpose"
- description: "Extract session goal"
- model: "haiku"
- prompt:
  ```
  Session: {session_name}

  Goal: Extract session goal from session.md

  Steps:
  1. Read file: .claude/sessions/{session_name}/session.md

  2. Find the "## Goal" section header

  3. Extract all text after "## Goal" until:
     - Next "##" header, OR
     - End of file

  4. Clean the extracted text:
     - Trim whitespace
     - Remove leading/trailing newlines
     - Keep formatting (bullets, line breaks within goal)

  Return Format:
  JSON with these exact fields:
  {
    "success": true,
    "goal": "[extracted goal text]"
  }

  If file not found or goal section missing:
  {
    "success": false,
    "error": "[description]",
    "fallback_goal": "Session {session_name}"
  }

  IMPORTANT:
  - Return ONLY the goal text, not entire file
  - Preserve original formatting within goal
  - Return ONLY JSON, no additional commentary
  ```

**REMINDER**: All 3 Task invocations MUST be in the SAME response to execute in parallel!

### Step 3: Process Subagent Results

After all 3 subagents complete, you'll receive their results. Handle errors gracefully:

**Consolidation Result**:
- If `success: true` → Snapshot created successfully
- If `skipped: true` → No conversation log found (OK, continue)
- If `success: false` → Log error but continue

**Git Refresh Result**:
- If `success: true` → Git history updated
- If `success: false` → No git repo or error (OK, continue)

**Goal Extraction Result**:
- If `success: true` → Use the extracted goal
- If `success: false` → Use fallback goal from result

### Step 4: Activate Session (CLI)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 5: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool:

```
**Last Updated**: {current ISO timestamp}
```

### Step 6: Display Minimal Summary

Show a clean, minimal summary using the goal extracted by Subagent 3:

```
✓ Session ready: {goal}

What's next?
```

**IMPORTANT**:
- Do NOT show comprehensive summaries
- Do NOT list files, milestones, decisions, snapshots
- Keep it minimal for token efficiency
- The heavy analysis already happened in the subagents
- User can run `/session status` for detailed view

---

**TOKEN OPTIMIZATION BENEFITS:**
- Before (v3.6.4): 77k tokens in main conversation
- After (v3.7.0): ~22k tokens in main conversation (72% reduction)
- Heavy work (consolidation, git analysis) happens in isolated subagent contexts
- Parallel execution: 3 subagents run simultaneously (~2-4 seconds total)
- Result: Faster session resume, massive token savings

**ERROR HANDLING:**
- If all subagents fail: Still activate session, show generic message "✓ Session ready. What's next?"
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session rebuild-index`

---

ARGUMENTS: {name}
