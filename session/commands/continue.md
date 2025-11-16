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

### Step 2: Delegate Heavy Work to Subagents (Parallel Execution)

**CRITICAL**: You MUST invoke ALL 3 Task tools in a SINGLE response message. This runs them in parallel and isolates heavy token usage from the main conversation.

Use the Task tool to spawn 3 parallel subagents with these exact configurations:

**Subagent 1 - Consolidate Conversation Log:**
- subagent_type: "general-purpose"
- description: "Consolidate conversation log"
- model: "sonnet"
- prompt: |
  You are working with session: {session_name}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/consolidate-log.md
  That file contains template placeholders like "{session_name}".
  Replace all such placeholders with the actual session name: {session_name}
  Then execute the resulting instructions.

**Subagent 2 - Refresh Git History:**
- subagent_type: "general-purpose"
- description: "Refresh git history"
- model: "haiku"
- prompt: |
  You are working with session: {session_name}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/refresh-git.md
  That file contains template placeholders like "{session_name}".
  Replace all such placeholders with the actual session name: {session_name}
  Then execute the resulting instructions.

**Subagent 3 - Extract Session Goal:**
- subagent_type: "general-purpose"
- description: "Extract session goal"
- model: "haiku"
- prompt: |
  You are working with session: {session_name}

  Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/extract-goal.md
  That file contains template placeholders like "{session_name}".
  Replace all such placeholders with the actual session name: {session_name}
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

Provide Claude with pointer to full context + 2-3 line teaser for immediate orientation:

1. Find the latest snapshot file:
   ```bash
   LATEST_SNAPSHOT=$(ls -t .claude/sessions/{session_name}/auto_*.md 2>/dev/null | head -1)
   ```

2. If snapshot exists, extract 3-line teaser:
   ```bash
   if [ -n "$LATEST_SNAPSHOT" ] && [ -f "$LATEST_SNAPSHOT" ]; then
     # Calculate time ago (simplified - could use more sophisticated logic)
     SNAPSHOT_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$LATEST_SNAPSHOT" 2>/dev/null || date -r "$LATEST_SNAPSHOT" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "recently")
     TIME_AGO="recently"

     # Line 1: Main accomplishment (from Conversation Summary, first sentence)
     LINE_DONE=$(grep -A 5 "## Conversation Summary" "$LATEST_SNAPSHOT" 2>/dev/null | sed -n '3p' | sed 's/\. .*/\./' | cut -c1-100)

     # Line 2: Current state (from Current State section, first 2 sentences)
     LINE_STATUS=$(grep -A 10 "## Current State" "$LATEST_SNAPSHOT" 2>/dev/null | sed -n '3,4p' | tr '\n' ' ' | cut -c1-120)

     # Line 3: Next steps (from Current State, look for "next" after heading)
     LINE_NEXT=$(grep -A 15 "## Current State" "$LATEST_SNAPSHOT" 2>/dev/null | grep -A 2 -i "what's next" | tail -2 | head -1 | cut -c1-80)

     # Fallback if extractions fail
     if [ -z "$LINE_DONE" ]; then
       LINE_DONE="Session work consolidated"
     fi
     if [ -z "$LINE_STATUS" ]; then
       LINE_STATUS="See snapshot for current status"
     fi
     if [ -z "$LINE_NEXT" ]; then
       LINE_NEXT="See snapshot for next steps"
     fi

     # Build teaser
     SNAPSHOT_NAME=$(basename "$LATEST_SNAPSHOT")
     TEASER="📋 Latest: $SNAPSHOT_NAME ($TIME_AGO)
   • Done: $LINE_DONE
   • Status: $LINE_STATUS
   • Next: $LINE_NEXT
💡 Read $LATEST_SNAPSHOT for full context"
   else
     TEASER=""
   fi
   ```

3. Store TEASER variable for use in Step 6 display

**Graceful Handling**:
- If no snapshot exists → TEASER is empty (OK, fresh session)
- If extraction fails → Falls back to generic text (still shows pointer)
- If file read fails → Silent failure, continue (don't break resume)

**Why Hybrid Pointer Works Better**:
- Teaser gives immediate context (what/status/next) in ~80 tokens
- Full snapshot available on demand (Claude can read if needed)
- Lazy loading: Only loads full context when relevant (zero waste)
- Solves: "Wave never started" - teaser shows execution completed
- Better than auto-inject: Complete sentences, not truncated mid-word

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

### Step 6: Display Summary with Hybrid Pointer

Show session goal plus snapshot pointer with 2-3 line teaser for context continuity:

```
✓ Session ready: {goal}

{if TEASER is not empty:}

{TEASER}

What's next?
```

**Implementation**:
```bash
# Display session ready with goal
echo "✓ Session ready: $GOAL"
echo ""

# Show hybrid pointer + teaser if available (from Step 3.5)
if [ -n "$TEASER" ]; then
  echo "$TEASER"
  echo ""
fi

echo "What's next?"
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
