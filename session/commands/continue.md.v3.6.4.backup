You are managing a session memory system. The user wants to resume an existing session.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session continue [name]`

**OPTIMIZATION:** This command uses CLI for validation and metadata (60-70% token reduction).

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

The JSON response contains metadata (status, started, goal, snapshotCount, etc.).

### Step 2: Read Session Files

Now read the actual content files (these need full content for context synthesis):

1. Read `.claude/sessions/{name}/session.md`
2. Read `.claude/sessions/{name}/context.md` (if exists)
3. Get latest snapshot filename from the CLI JSON response (`latestSnapshot` field)
4. If `latestSnapshot` exists, read `.claude/sessions/{name}/{latestSnapshot}`

### Step 3: Check for Active Session and Transition (NEW - Session Cleanup)

Before activating the new session, check if there's already a different active session:

1. Check if `.claude/sessions/.active-session` exists
2. If it exists, read the current active session name
3. If the current active session is **different** from the session being continued:
   - Show: "📋 Closing previous session '{previous_session_name}'..."
   - Update the previous session's `session.md` "Last Updated" timestamp to current time
   - This provides clean transition tracking
4. If it's the **same** session, skip this step (just updating timestamp)

**Note:** The SessionEnd hook will handle final cleanup on Claude Code termination.

### Step 4: Activate Session (CLI)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 5: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool.

### Step 6: Synthesize and Display Context Summary

Using the data from CLI JSON + file contents, show a comprehensive summary:

```
✓ Loaded session: '{name}'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Started: {started from CLI JSON}
🎯 Goal: {goal from CLI JSON or session.md}
📝 Last update: {lastUpdated from CLI JSON}
⏰ Status: {status from CLI JSON}
📸 Snapshots: {snapshotCount from CLI JSON}

## Recent Context

{latest_snapshot_conversation_summary if available}

## Key Files
{list of files from filesInvolved array in CLI JSON}

## Milestones
{key milestones from session.md with checkboxes}

## Recent Decisions
{recent decisions from context.md, max 3}

## Current State
{current state from latest snapshot if available}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to continue! How would you like to proceed?
```

### Step 7: Prepare for Work

Tell the user:
"I've loaded the full context for session '{name}'. All previous work, decisions, and progress have been restored. What would you like to work on next?"

---

**PERFORMANCE BENEFITS:**
- **Before:** 10-20K tokens, reads session.md + context.md + snapshot + metadata parsing, 3-5s
- **After:** 3-8K tokens, CLI provides metadata instantly, only reads content files, 1-2s
- **Improvement:** ~60-70% token reduction, ~2x faster

**WHY STILL READ CONTENT FILES:**
- context.md and snapshots contain narrative context needed for synthesis
- Claude needs full context to provide meaningful summary
- CLI provides structure/metadata, Claude provides intelligence/understanding

**ERROR HANDLING:**
- If session.md missing, show corrupted session warning
- If CLI fails, suggest rebuilding index
- Handle missing context.md or snapshots gracefully (show what's available)

---

## CRITICAL: Check for Unconsolidated Logs (Inline Analysis)

**YOU MUST CHECK THIS BEFORE DISPLAYING THE SESSION SUMMARY:**

When resuming a session, check if the previous session left unconsolidated logs:

1. Check if `.claude/sessions/{name}/conversation-log.jsonl` exists
2. If the file exists:
   - Show brief message: "📊 Analyzing previous session... (this may take 1-3 seconds)"
   - Read the conversation log file
   - Parse interactions from JSONL format
   - **Parse self-contained conversation log (v3.6.2+):**
     - Each entry has type: 'interaction' (user prompt) or 'assistant_response' (Claude's response)
     - Extract full conversation from log entries:
       - User prompts: `user_prompt` field in 'interaction' entries
       - Claude responses: `response_text` field in 'assistant_response' entries
       - Tools used: `tools_used` field in 'assistant_response' entries
       - File modifications: `modified_files` field in 'interaction' entries
     - Log is self-contained - NO need to read transcript file!
     - **Backward compatibility**: If `transcript_path` exists but no `response_text`, fall back to reading transcript file (for v3.6.1 logs)
   - **Capture git history (if available):**
     - Run: `node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{name}"`
     - This creates `.claude/sessions/{name}/git-history.json` (~2-3KB compressed)
     - Contains: last 50 commits, uncommitted changes, branch status, hotspots
     - Performance: ~60-90ms (acceptable at session boundary)
     - If no git repo, command returns success: false (silent skip, no error)
   - **Analyze the conversation with Claude inline:**
     - Use the full conversation from log entries (user prompts + Claude responses)
     - Extract conversation summary (2-3 paragraphs covering what happened)
     - Identify key decisions made with rationale
     - List completed todos/tasks
     - Document files modified with context about what changed and why (from conversation, not just file paths)
     - Assess current state, what's next, and any blockers
   - Create consolidated snapshot via CLI:
     ```bash
     echo "# Consolidated Snapshot: {session_name}
**Timestamp**: {ISO timestamp}
**Method**: Claude Inline Analysis (Free)
**Status**: Consolidated from conversation log

## Conversation Summary
{2-3 paragraph summary of what happened in session}

## Key Decisions
- {Decision 1 with rationale}
- {Decision 2 with rationale}

## Completed Tasks
- {Task 1}
- {Task 2}

## Files Modified
- {file_path}: {what changed and why}

## Current State
{Where things stand, what's next, blockers}

## Notes
Consolidated via Claude inline analysis at session boundary. Zero cost, highest quality." | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{name}" --stdin --type auto
     ```
   - Delete conversation-log.jsonl after successful snapshot creation
   - Update `.auto-capture-state` to reset counters and set last_snapshot_timestamp
3. If no log exists:
   - **Still capture git history** for updated repository context:
     - Run: `node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{name}"`
     - This refreshes git context since last session
     - Silent skip if no git repo (no error)

**PERFORMANCE:**
- Log check: <5ms
- Claude analysis: 1-3s (acceptable at session boundaries - users expect loading)
- Snapshot write: <50ms
- Log deletion: <5ms
- **Total: ~1-3 seconds** (users expect loading at session resume)

**NOTE:** This is the v3.5.1 architecture where:
- During session: Conversation logged incrementally (<2ms per interaction, zero blocking)
- At session boundaries: Claude inline analysis creates intelligent snapshots (FREE, highest quality)
- Result: User NEVER experiences blocking during work, only brief wait at session resume where loading is expected
