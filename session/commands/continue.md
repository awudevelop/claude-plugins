You are managing a session memory system. The user wants to resume an existing session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:list`, `/session:start`, `/session:continue`, `/session:status`
- ❌ Wrong: `/session list`, `/session start`, `/session continue`, `/session status`
Use ONLY the exact command formats specified in this template.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session:continue [name]`

**OPTIMIZATION**: v3.19.0 uses inline execution for git/goal + conditional subagent for consolidation (50% token reduction vs v3.7.0).

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

The JSON response contains metadata (status, started, snapshotCount, etc.).

### Step 1.5: Close Previous Active Session (If Different)

Before continuing the target session, close any currently active session if it's different:

1. Check if `.claude/sessions/.active-session` exists
2. If it exists:
   - Read the current active session name
   - If it's different from the target session {session_name}:
     - Show: "📋 Closing previous session '{previous_session_name}'..."
     - Close the previous session status:
       ```bash
       node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-status "{previous_session_name}" "closed"
       ```
     - This marks the previous session as closed in `.auto-capture-state`
3. Continue to next step

**Note**: This ensures clean session transitions with no abandoned active sessions.

### Step 2: Refresh Git History (Inline)

Run the git capture CLI command directly (no subagent needed):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{session_name}"
```

**Handle results:**
- If `success: true` → Git history updated (continue)
- If `success: false` → No git repo or error (OK, continue anyway)

**Note**: The CLI handles all git operations internally. No AI analysis required.

### Step 3: Extract Session Goal (Inline)

Use the Read tool to read the session.md file:
- Path: `.claude/sessions/{session_name}/session.md`

Extract the goal:
1. Find the line starting with `## Goal`
2. Extract all text after that line until the next `##` header or end of file
3. Trim whitespace and store as `{extracted_goal}`

**Fallback**: If file missing or no goal section, use `"Session {session_name}"` as fallback.

**Note**: This is simple text extraction. No AI analysis required.

### Step 4: Consolidate Conversation Log (Conditional Subagent)

**First, check if consolidation is needed:**

Use the Glob tool to check if the conversation log exists (avoids reading content):
- Pattern: `.claude/sessions/{session_name}/conversation-log.jsonl`

**If Glob returns empty array (file does NOT exist):**
- Skip subagent entirely
- Set consolidation_result = `{ "skipped": true, "reason": "No conversation log" }`
- Continue to Step 5

**If Glob returns the file path (file EXISTS):**

Spawn a single subagent for consolidation:

- subagent_type: "general-purpose"
- description: "Consolidate conversation log"
- model: "haiku"
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

**Handle consolidation result:**
- If `success: true` → Snapshot created successfully
- If `skipped: true` → No conversation log found (OK, continue)
- If `success: false` → Log error but continue

### Step 5: Extract Full Snapshot Summary (Complete Context)

Provide Claude with complete snapshot summary including all topics, decisions, and tasks for full context visibility.

**Implementation Steps:**

1. **Find the latest snapshot file using Glob tool:**
   - Pattern: `.claude/sessions/{session_name}/auto_*.md`
   - Glob returns files sorted by modification time (newest first)
   - Take the first result as the latest snapshot

2. **If snapshot exists, use Read tool to extract content:**
   - Read the snapshot file (first 80 lines should contain all needed sections)
   - Extract all snapshot items with titles only:
     - **Topics Discussed**: Extract ALL topic titles from "## Topics Discussed" section
       - Format: "1. **Category**: Description"
       - Extract only the category/title (bold text between ** markers)
       - Store as array of titles
     - **Decisions Made**: Extract ALL decision titles from "## Decisions Made" section
       - Format: "1. **Decision**: Rationale"
       - Extract only the decision title (bold text between ** markers)
       - Store as array of titles
     - **Tasks Completed**: Extract ALL tasks from "## Tasks Completed" section
       - Format: "1. Task description"
       - Extract full task line (simple numbered list)
       - Store as array of tasks
     - **Current Status**: Extract status lines from "## Current Status" section
       - Look for "- **Progress**:" line and extract text after it
       - Look for "- **Next Steps**:" line and extract text after it
       - Look for "- **Blockers**:" line and extract text after it
       - Store as object with progress, nextSteps, blockers

3. **Build full snapshot summary for display in Step 9**

**Graceful Handling**:
- If no snapshot exists → Skip summary display (OK, fresh session)
- If extraction fails → Show generic message "See snapshot for details"
- If Read fails → Silent failure, continue (don't break resume)

### Step 6: Activate Session (CLI)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 7: Update Session Status to Active

Update the session status in `.auto-capture-state` and index:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-status "{session_name}" "active"
```

This ensures the session status matches its active state and prevents sync bugs.

### Step 8: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool:

```
**Last Updated**: {current ISO timestamp}
```

### Step 9: Display Summary with Full Snapshot Details

Show session goal plus complete snapshot summary with all topics, decisions, and tasks.

**Display Format**:
```
✓ Session ready: {extracted_goal}

📋 Latest: {snapshot_filename}

Topics Discussed ({count}):
- {topic_1}
- {topic_2}
... (all topics)

Decisions Made ({count}):
- {decision_1}
- {decision_2}
... (all decisions)

Tasks Completed ({count}):
- {task_1}
- {task_2}
... (all tasks)

Current Status:
• Progress: {progress_text}
• Next Steps: {next_steps_text}
• Blockers: {blockers_text}

💡 Read {snapshot_path} for full details

What's next?
```

**Example Output**:
```
✓ Session ready: Implement product permission system

📋 Latest: auto_2025-11-16_05-24.md

Topics Discussed (8):
- Database Schema Design
- API Endpoint Implementation
- Permission Middleware
- Frontend Components
- Testing Strategy
- Deployment Planning
- Documentation Updates
- Performance Optimization

Decisions Made (3):
- Use RBAC Model for Permission System
- Implement Middleware-based Authorization
- Store Permissions in PostgreSQL

Tasks Completed (12):
- Created users, roles, permissions tables
- Implemented role assignment API
- Built permission checking middleware
- Added frontend permission components
- Wrote unit tests for permission logic
- Created integration tests
- Documented API endpoints
- Updated deployment guide
- Fixed TypeScript errors
- Ran build successfully
- Deployed to staging
- Verified permission checks work

Current Status:
• Progress: 12 of 12 tasks completed (100%)
• Next Steps: Deploy to production and monitor
• Blockers: None

💡 Read .claude/sessions/product-permission/auto_2025-11-16_05-24.md for full details

What's next?
```

**Notes**:
- If no snapshot exists, only show "✓ Session ready: {goal}" and "What's next?"
- Fallback gracefully if extraction fails (show generic pointer text)

---

**TOKEN OPTIMIZATION BENEFITS (v3.20.2):**
- Previous (v3.7.0): ~22k tokens with 3 parallel subagents
- Current (v3.20.2): ~8-10k tokens with inline + conditional subagent
- **Savings: 55-60% token reduction**

Key optimizations:
1. **Inline git refresh**: CLI call instead of subagent (~5k tokens saved)
2. **Inline goal extraction**: Read tool instead of subagent (~5k tokens saved)
3. **Conditional consolidation**: Skip subagent if no log exists (common case!)
4. **Lazy-loaded prompts**: Subagent reads its own prompt (~1.7k token savings)
5. **Glob for existence check**: Use Glob instead of Read to check log existence (~3-4k tokens saved)

**ERROR HANDLING:**
- If consolidation fails: Still activate session, show generic message
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session:rebuild-index`

---

ARGUMENTS: {name}
