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

### Step 3: Activate Session (CLI)

Run the CLI command to activate the session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 4: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool.

### Step 5: Synthesize and Display Context Summary

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

### Step 6: Prepare for Work

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

## CRITICAL: Active Session Monitoring (Auto-Snapshot System)

**YOU MUST FOLLOW THIS INSTRUCTION THROUGHOUT THE ENTIRE SESSION:**

Before EVERY response while this session is active, check for pending auto-snapshot markers:

1. Check if `.claude/sessions/{name}/.pending-auto-snapshot` exists
2. If the file exists:
   - Read the marker file to get metadata (timestamp, trigger, last_snapshot_timestamp, etc.)
   - Analyze the conversation since `last_snapshot_timestamp` (or since session start if no prior snapshot)
   - Extract key information:
     - Conversation summary: What was discussed and accomplished
     - Decisions made: Technical choices, agreements, conclusions
     - Completed todos: Tasks finished since last snapshot
     - Files modified: Changes made with brief descriptions
     - Current state: Where things stand now
   - Create an intelligent auto-snapshot using the CLI:
     ```bash
     node /Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session/cli/session-cli.js write-snapshot "{name}" --stdin --type auto
     ```
   - Pass the comprehensive snapshot content via stdin
   - Delete the `.pending-auto-snapshot` marker file
   - Update `.auto-capture-state` to reset counters
3. Then continue with the user's request normally (completely transparent to user)

**This happens automatically every 5 interactions via hooks. Your job is to detect the marker and create intelligent snapshots.**

**Format for intelligent auto-snapshots:**
```markdown
# Auto-Snapshot: {session_name}
**Timestamp**: {ISO timestamp}
**Auto-Generated**: Yes
**Trigger**: {interaction_threshold|file_threshold}

## Conversation Summary
{2-3 paragraph summary of what happened since last snapshot}

## Decisions Made
- {Key decision 1}
- {Key decision 2}

## Completed Todos
- {Completed task 1}
- {Completed task 2}

## Files Modified
- {file path}: {what changed and why}

## Current State
{Where things stand, what's next, any blockers}

## Notes
Auto-generated intelligent snapshot. Captures conversation context automatically.
```
