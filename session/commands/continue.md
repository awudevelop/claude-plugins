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
- After (v3.7.1): ~20k tokens in main conversation (74% reduction)
- Heavy work (consolidation, git analysis) happens in isolated subagent contexts
- Parallel execution: 3 subagents run simultaneously (~2-4 seconds total)
- Lazy-loaded prompts: Subagents read their own prompts (~1.7k token savings)
- Result: Faster session resume, massive token savings

**ERROR HANDLING:**
- If all subagents fail: Still activate session, show generic message "✓ Session ready. What's next?"
- If session.md missing: Show corrupted session warning
- If CLI fails: Suggest rebuilding index with `/session rebuild-index`

---

ARGUMENTS: {name}
