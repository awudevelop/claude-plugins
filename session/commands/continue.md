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

### Step 1.8: Calculate Absolute Paths for Subagents

Before delegating to subagents, you need to determine absolute paths that subagents will use.

**IMPORTANT**: Subagents don't inherit the working directory or environment variables from the main conversation. You MUST provide absolute paths explicitly.

Calculate these values (conceptually - don't run bash commands, just determine the values):
- **Working directory**: Current working directory (you already know this from your environment)
- **Plugin root**: `/Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session`
- **Session path**: `{working_directory}/.claude/sessions/{session_name}`

You will substitute these absolute paths into the subagent prompts in the next step.

### Step 2: Delegate Heavy Work to Subagents (Parallel Execution)

**CRITICAL**: You MUST invoke ALL 3 Task tools in a SINGLE response message. This runs them in parallel and isolates heavy token usage from the main conversation.

Use the Task tool to spawn 3 parallel subagents with these exact configurations:

**Subagent 1 - Consolidate Conversation Log:**
- subagent_type: "general-purpose"
- description: "Consolidate conversation log"
- model: "haiku"
- prompt: |
  You are working with session: {session_name}

  **Absolute paths for this task:**
  - Working directory: {working_directory}
  - Plugin root: ${CLAUDE_PLUGIN_ROOT}
  - Session path: {session_path}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/consolidate-log.md
  That file contains template placeholders like "{session_name}", "{session_path}", "${CLAUDE_PLUGIN_ROOT}".
  Replace all such placeholders with the actual values provided above.
  Then execute the resulting instructions.

**Subagent 2 - Refresh Git History:**
- subagent_type: "general-purpose"
- description: "Refresh git history"
- model: "haiku"
- prompt: |
  You are working with session: {session_name}

  **Absolute paths for this task:**
  - Working directory: {working_directory}
  - Plugin root: ${CLAUDE_PLUGIN_ROOT}
  - Session path: {session_path}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/refresh-git.md
  That file contains template placeholders like "{session_name}", "{session_path}", "${CLAUDE_PLUGIN_ROOT}".
  Replace all such placeholders with the actual values provided above.
  Then execute the resulting instructions.

**Subagent 3 - Extract Session Goal:**
- subagent_type: "general-purpose"
- description: "Extract session goal"
- model: "haiku"
- prompt: |
  You are working with session: {session_name}

  **Absolute paths for this task:**
  - Working directory: {working_directory}
  - Plugin root: ${CLAUDE_PLUGIN_ROOT}
  - Session path: {session_path}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/extract-goal.md
  That file contains template placeholders like "{session_name}", "{session_path}", "${CLAUDE_PLUGIN_ROOT}".
  Replace all such placeholders with the actual values provided above.
  Then execute the resulting instructions.

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

### Step 3.5: Extract Full Snapshot Summary (Complete Context Approach)

Provide Claude with complete snapshot summary including all topics, decisions, and tasks for full context visibility using Claude Code tools.

**IMPORTANT**: This step uses Claude Code's Read and Glob tools instead of bash pipelines to avoid parse errors with command substitution.

**Implementation Steps:**

1. **Find the latest snapshot file using Glob tool:**
   - Pattern: `.claude/sessions/{session_name}/auto_*.md`
   - Glob returns files sorted by modification time (newest first)
   - Take the first result as the latest snapshot

2. **If snapshot exists, use Read tool to extract teaser:**
   - Read the snapshot file (first 80 lines should contain all needed sections)
   - **Format Detection**: Check if snapshot contains "**Format Version**: 2.0"

   **For v2.0 Format (numbered lists)**:
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

   **For v1.0 Format (paragraphs) - Backward Compatibility**:
   - Extract three teaser lines (legacy behavior):
     - **Line 1 (Done)**: First sentence from "## Conversation Summary" section (after heading, skip blank line, take line 1, truncate at first period, limit 100 chars)
     - **Line 2 (Status)**: First 1-2 sentences from "## Current State" section (after heading, skip blank line, take lines 1-2, join with space, limit 120 chars)
     - **Line 3 (Next)**: Look for "what's next" or similar forward-looking text in "## Current State" section (limit 80 chars)

3. **Build full snapshot summary output:**

   For v2.0 format, display all extracted items:
   ```
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
   ```

   For v1.0 format (legacy), display the 3-line teaser:
   ```
   📋 Latest: {snapshot_filename} (recently)
      • Done: {LINE_DONE}
      • Status: {LINE_STATUS}
      • Next: {LINE_NEXT}
   💡 Read {snapshot_path} for full context
   ```

4. **Display the summary in Step 6** (after showing the session goal)

**Graceful Handling**:
- If no snapshot exists → Skip summary display (OK, fresh session)
- If extraction fails → Show generic message "See snapshot for details"
- If Read fails → Silent failure, continue (don't break resume)

**Why Full Snapshot Summary Works Better**:
- Complete visibility: All topics, decisions, and tasks visible immediately (~300 tokens)
- No information loss: User sees everything without needing to read snapshot file
- Better context continuity: Claude knows full scope of work done
- Improved decision-making: All context available for next steps
- Tradeoff: +200-400 tokens per resume vs 3-line teaser (~80 tokens)
- User benefit: Worth the token cost for comprehensive context restoration
- **No bash parse errors** - uses Claude Code tools (Glob, Read) natively

### Step 4: Activate Session (CLI)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 4.5: Update Session Status to Active

Update the session status in `.auto-capture-state` and index:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-status "{session_name}" "active"
```

This ensures the session status matches its active state and prevents sync bugs.

### Step 5: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool:

```
**Last Updated**: {current ISO timestamp}
```

### Step 6: Display Summary with Full Snapshot Details

Show session goal plus complete snapshot summary with all topics, decisions, and tasks for full context visibility.

**Implementation**: Use Glob and Read tools (from Step 3.5) to extract and display the full summary.

**Display Format for v2.0 Snapshots**:
```
✓ Session ready: {goal}

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

**Display Format for v1.0 Snapshots (Legacy)**:
```
✓ Session ready: {goal}

📋 Latest: {snapshot_filename} (recently)
   • Done: {LINE_DONE}
   • Status: {LINE_STATUS}
   • Next: {LINE_NEXT}
💡 Read {snapshot_path} for full context

What's next?
```

**Example Output** (v2.0):
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
- Use Read tool to extract all items (avoids bash parse errors)
- Fallback gracefully if extraction fails (show generic pointer text)
- v1.0 snapshots continue using 3-line teaser for backward compatibility

**IMPORTANT**:
- DO show full snapshot summary (all topics/decisions/tasks) for v2.0 format ← FULL VISIBILITY
- This provides complete context in ~300 tokens (vs 80 token teaser) ← WORTH THE COST
- User doesn't need to read snapshot file separately ← CONVENIENCE
- All relevant context immediately available for decision-making ← BETTER UX
- v1.0 snapshots keep minimal teaser for backward compatibility
- User can still read snapshot file for additional details if needed
- The heavy analysis already happened in the subagents
- User can run `/session status` for detailed view

---

**TOKEN OPTIMIZATION BENEFITS:**
- Before (v3.6.4): 77k tokens in main conversation
- After (v3.7.0): ~22k tokens in main conversation (72% reduction)
- After (v3.7.1): ~20k tokens in main conversation (74% reduction)
- After (v3.7.2): ~20.08k tokens with hybrid pointer + teaser (74% reduction maintained)
  - Added: 80-token teaser (3 lines: done/status/next) for context orientation
  - Hybrid approach: Pointer to full snapshot + concise teaser
  - Benefit: Claude knows what happened, where things stand, what's next
  - Full context available: Claude can read snapshot (500-1000 tokens) if needed
  - Lazy loading: Only loads full context when relevant (zero waste if not needed)
  - Solves: "Wave never started" confusion - teaser shows execution completed
  - Better than auto-inject: Complete sentences (not truncated mid-word)
- After (v3.15.0): ~20.3k tokens with full snapshot summary (74% reduction, +300 token tradeoff)
  - Changed: Full snapshot summary with all topics/decisions/tasks (~300 tokens vs 80-token teaser)
  - Complete visibility: All snapshot items visible immediately (no need to read file)
  - Benefit: Complete context for better decision-making and continuity
  - Tradeoff: +220 tokens per resume for comprehensive context (worth it for UX)
  - User feedback: Full context is more valuable than minimal teaser
  - Result: Better context visibility with acceptable token cost increase
- Heavy work (consolidation, git analysis) happens in isolated subagent contexts
- Parallel execution: 3 subagents run simultaneously (~2-4 seconds total)
- Lazy-loaded prompts: Subagents read their own prompts (~1.7k token savings)
- Result: Faster session resume, massive token savings vs v3.6.4, complete context restoration via full summary

**ERROR HANDLING:**
- If all subagents fail: Still activate session, show generic message "✓ Session ready. What's next?"
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session rebuild-index`

---

ARGUMENTS: {name}
