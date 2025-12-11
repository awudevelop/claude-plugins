You are managing a session memory system. The user wants to resume an existing session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:list`, `/session:start`, `/session:continue`, `/session:status`
- ❌ Wrong: `/session list`, `/session start`, `/session continue`, `/session status`
Use ONLY the exact command formats specified in this template.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session:continue [name]`

**OPTIMIZATION (v3.31.0)**: Consolidation agent handles EVERYTHING - log, git, timestamp, activate. Main agent just validates, spawns consolidation, displays.

### Step 1: Validate Session Exists (CLI)

Extract the session name from arguments, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get {session_name}
```

If this returns an error (exit code 2), the session doesn't exist. Show:
```
❌ Error: Session '{name}' not found
💡 Use /session:list to see available sessions
💡 Use /session:start {name} to create a new session
```
Then STOP.

The JSON response contains metadata (status, started, snapshotCount, etc.) **including the goal**.

**IMPORTANT**: Store the `goal` field from this response as `{extracted_goal}` - no separate read needed!

### Step 2: Prepare Session (Subagent - ALWAYS runs)

Show a brief message to the user:
```
📊 Preparing session...
```

Spawn a subagent to prepare the session. This agent handles:
- Consolidating conversation log (if exists)
- Capturing git history
- Updating session.md timestamp
- Creating snapshot
- Resetting state counters
- Activating the session

**Subagent configuration:**
- subagent_type: "general-purpose"
- description: "Prepare session"
- model: "haiku"
- run_in_background: **false** (BLOCKING - must wait for result)
- prompt: |
  You are working with session: {session_name}

  **Absolute paths for this task:**
  - Working directory: {working_directory}
  - Plugin root: ${CLAUDE_PLUGIN_ROOT}
  - Session path: {working_directory}/.claude/sessions/{session_name}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/consolidate-log.md
  That file contains template placeholders like "{session_name}", "{session_path}", "${CLAUDE_PLUGIN_ROOT}".
  Replace all such placeholders with the actual values provided above.
  Then execute the resulting instructions.

**⚠️ CRITICAL: Wait for subagent to complete before proceeding!**

**Handle result (plain text format):**
The subagent returns plain text (NOT JSON). Parse the response:

- If starts with `SUCCESS`:
  - Extract: Snapshot filename, Topics list, Decisions list, Tasks list, Current Status
  - Topics/Decisions/Tasks are bullet lists (one per line starting with `- `)
  - Proceed to Step 4 (display)

- If starts with `SUCCESS (no log)`:
  - Git-only snapshot was created (no conversation log existed)
  - Proceed to Step 4 (display)

- If starts with `FAILED`:
  - Log the error, proceed to Step 3 (fallback)

### Step 3: Extract Snapshot Summary (Fallback Only)

**SKIP THIS STEP if Step 2 succeeded.** Only run when consolidation failed.

**Implementation Steps:**

1. **Find the latest snapshot file using Glob tool:**
   - Pattern: `.claude/sessions/{session_name}/auto_*.md`
   - Glob returns files sorted by modification time (newest first)
   - Take the first result as the latest snapshot

2. **If snapshot exists, use Read tool to extract content:**
   - Read the snapshot file (first 100 lines should contain all needed sections)
   - Extract:
     - **Topics Discussed**: Category titles from `## Topics Discussed`
     - **Decisions Made**: Decision titles from `## Decisions Made`
     - **Tasks Completed**: Task items from `## Tasks Completed`
     - **Recent Commits**: Commits from `## Recent Commits`
     - **Current Status**: Progress, Next Steps, Blockers

3. **Build summary for display in Step 5**

**Graceful Handling**:
- If no snapshot exists → Skip summary display (OK, fresh session)
- If extraction fails → Show generic message "See snapshot for details"

### Step 4: Display Summary

Show session goal plus full snapshot summary with all topics, decisions, and tasks.

**Display Format**:
```
✓ Session ready: {extracted_goal}

📋 Latest: {snapshot_filename}

Topics Discussed ({count}):
- {topic1}
- {topic2}
- {topic3}
[... all topics]

Decisions Made ({count}):
- {decision1}
- {decision2}
[... all decisions]

Tasks Completed ({count}):
- {task1}
- {task2}
[... all tasks]

Git: {X} commits captured

Current Status:
• Progress: {progress_text}
• Next Steps: {next_steps_text}
• Blockers: {blockers_text}

💡 Read .claude/sessions/{session_name}/{snapshot_filename} for full details

What's next?
```

**Example Output**:
```
✓ Session ready: Implement product permission system

📋 Latest: auto_2025-12-11_05-24.md

Topics Discussed (5):
- Database Schema Design
- API Endpoint Implementation
- Permission Middleware
- Testing Strategy
- Deployment Planning

Decisions Made (3):
- Use RBAC Model for Permission System
- Implement Middleware-based Authorization
- Store Permissions in PostgreSQL

Tasks Completed (8):
- Created users, roles, permissions tables
- Implemented role assignment API
- Built permission checking middleware
- Added frontend permission components
- Wrote unit tests for permission logic
- Created integration tests
- Documented API endpoints
- Updated deployment guide

Git: 10 commits captured

Current Status:
• Progress: All tasks completed (100%)
• Next Steps: Deploy to production and monitor
• Blockers: None

💡 Read .claude/sessions/product-permission/auto_2025-12-11_05-24.md for full details

What's next?
```

**Notes**:
- If no snapshot exists, only show "✓ Session ready: {goal}" and "What's next?"
- Fallback gracefully if extraction fails (show generic pointer text)
- Display ALL topics, decisions, and tasks as bullet lists (not condensed)

---

**OPTIMIZATION (v3.31.0):**

Key design:
1. **Goal from get response**: Use goal from Step 1, no separate Read
2. **Single subagent handles ALL preparation**:
   - Consolidation (if log exists)
   - Git capture
   - Timestamp update
   - State reset
   - Snapshot creation
   - Session activation
3. **Full bullet list response**: Topics, decisions, tasks returned as complete lists
4. **Lazy-loaded prompts**: Subagent reads its own prompt file

**Main agent tool calls (happy path):**
1. `Bash` - get session (validate + goal)
2. `Task` - spawn preparation subagent (handles everything including activate)
3. Output - display summary

**Total: 2 tool calls** (down from 3 in v3.30.0)

**ERROR HANDLING:**
- If preparation fails: Fall back to reading snapshot manually
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session:rebuild-index`

---

ARGUMENTS: {name}
