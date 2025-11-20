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
  - Plugin root: {plugin_root}
  - Session path: {session_path}

  Read the prompt file: {plugin_root}/prompts/consolidate-log.md
  That file contains template placeholders like "{session_name}", "{session_path}", "{plugin_root}".
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
  - Plugin root: {plugin_root}
  - Session path: {session_path}

  Read the prompt file: {plugin_root}/prompts/refresh-git.md
  That file contains template placeholders like "{session_name}", "{session_path}", "{plugin_root}".
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
  - Plugin root: {plugin_root}
  - Session path: {session_path}

  Read the prompt file: {plugin_root}/prompts/extract-goal.md
  That file contains template placeholders like "{session_name}", "{session_path}", "{plugin_root}".
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

### Step 3.5: Extract Snapshot Pointer with Teaser (Hybrid Approach)

Provide Claude with pointer to full context + 2-3 line teaser for immediate orientation using Claude Code tools.

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
   - Extract three teaser lines:
     - **Line 1 (Done)**: First 3 topics from "## Topics Discussed" section
       - Format: "1. **Category**: Description"
       - Extract category + brief description for first 3 topics
       - Join with semicolons: "Topic1; Topic2; Topic3"
       - Limit 120 chars total
     - **Line 2 (Status)**: Progress line from "## Current Status" section
       - Look for "- **Progress**:" line
       - Extract the text after "**Progress**:"
       - Limit 120 chars
     - **Line 3 (Next)**: Next Steps line from "## Current Status" section
       - Look for "- **Next Steps**:" line
       - Extract the text after "**Next Steps**:"
       - Limit 80 chars

   **For v1.0 Format (paragraphs) - Backward Compatibility**:
   - Extract three teaser lines (legacy behavior):
     - **Line 1 (Done)**: First sentence from "## Conversation Summary" section (after heading, skip blank line, take line 1, truncate at first period, limit 100 chars)
     - **Line 2 (Status)**: First 1-2 sentences from "## Current State" section (after heading, skip blank line, take lines 1-2, join with space, limit 120 chars)
     - **Line 3 (Next)**: Look for "what's next" or similar forward-looking text in "## Current State" section (limit 80 chars)

   - Use fallback text if any extraction fails:
     - Done: "Session work consolidated"
     - Status: "See snapshot for current status"
     - Next: "See snapshot for next steps"

3. **Build teaser output:**
   ```
   📋 Latest: {snapshot_filename} (recently)
      • Done: {LINE_DONE}
      • Status: {LINE_STATUS}
      • Next: {LINE_NEXT}
   💡 Read {snapshot_path} for full context
   ```

4. **Display the teaser in Step 6** (after showing the session goal)

**Graceful Handling**:
- If no snapshot exists → Skip teaser display (OK, fresh session)
- If extraction fails → Use fallback text (still shows pointer)
- If Read fails → Silent failure, continue (don't break resume)

**Why Hybrid Pointer Works Better**:
- Teaser gives immediate context (what/status/next) in ~80 tokens
- Full snapshot available on demand (Claude can read if needed)
- Lazy loading: Only loads full context when relevant (zero waste)
- Solves: "Wave never started" - teaser shows execution completed
- Better than auto-inject: Complete sentences, not truncated mid-word
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

### Step 6: Display Summary with Hybrid Pointer

Show session goal plus snapshot pointer with 2-3 line teaser for context continuity.

**Implementation**: Use Glob and Read tools (from Step 3.5) to extract and display the teaser.

**Display Format**:
```
✓ Session ready: {goal}

📋 Latest: {snapshot_filename} (recently)
   • Done: {LINE_DONE}
   • Status: {LINE_STATUS}
   • Next: {LINE_NEXT}
💡 Read {snapshot_path} for full context

What's next?
```

**Example Output**:
```
✓ Session ready: Implement product permission system

📋 Latest: auto_2025-11-16_05-24.md (recently)
   • Done: Orchestrator executed 17 of 22 tasks (70% complete).
   • Status: Database migrations ✓, Tests ✗ (Docker not running, Vitest errors)
   • Next: Fix test environment setup, retry Wave 2 deployment
💡 Read .claude/sessions/product-permission/auto_2025-11-16_05-24.md for full context

What's next?
```

**Notes**:
- If no snapshot exists, skip the teaser and only show "✓ Session ready: {goal}" and "What's next?"
- Use Read tool to extract teaser lines (avoids bash parse errors)
- Fallback gracefully if extraction fails (show generic pointer text)

**IMPORTANT**:
- Do show hybrid pointer + teaser (Step 3.5) if available ← HYBRID APPROACH
- Teaser gives enough context to continue OR read full snapshot ← LAZY LOADING
- Do NOT show comprehensive summaries (keep it concise)
- Do NOT auto-inject full snapshot (use pointer instead)
- Claude can read snapshot file if more context needed ← ON DEMAND
- User can run `/session status` for detailed view
- Do NOT list files, milestones, decisions, snapshots
- Keep it minimal for token efficiency
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
- Heavy work (consolidation, git analysis) happens in isolated subagent contexts
- Parallel execution: 3 subagents run simultaneously (~2-4 seconds total)
- Lazy-loaded prompts: Subagents read their own prompts (~1.7k token savings)
- Result: Faster session resume, massive token savings, intelligent context restoration via hybrid pointer

**ERROR HANDLING:**
- If all subagents fail: Still activate session, show generic message "✓ Session ready. What's next?"
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session rebuild-index`

---

ARGUMENTS: {name}
