# Intelligent Auto-Snapshot System (Technical Reference)

**Version**: 3.4.0 - Marker-Based Intelligent Snapshots

This document describes how the intelligent auto-snapshot system works. This is **NOT a command** - the logic is embedded directly in `/session:start` and `/session:continue` commands.

---

## System Architecture

### Overview

The intelligent auto-snapshot system uses a **marker-based architecture** where:

1. **Hooks create markers** when thresholds are met (every 5 interactions)
2. **Claude checks for markers** before each response (via session command instructions)
3. **Claude analyzes conversation** and creates intelligent snapshots
4. **Markers are deleted** after processing

### Components

**Hook**: `session/hooks/user-prompt-submit.js`
- Tracks interaction count and file modifications
- Creates `.pending-auto-snapshot` marker when threshold reached (5 interactions OR 3+ files modified)
- Stores metadata in marker file (timestamp, trigger reason, file list, etc.)

**Session Commands**: `start.md` and `continue.md`
- Inject persistent instruction to check for markers before EVERY response
- Claude processes markers automatically and transparently

**CLI**: `session-cli.js write-snapshot`
- Receives intelligent snapshot content from Claude
- Writes snapshot file with `auto_` prefix
- Updates metadata index

---

## Marker File Format

**Location**: `.claude/sessions/{session_name}/.pending-auto-snapshot`

**Content** (JSON):
```json
{
  "timestamp": "2025-11-13T12:00:00.000Z",
  "trigger": "interaction_threshold|file_threshold",
  "interaction_count": 25,
  "last_snapshot_timestamp": "2025-11-13T11:30:00.000Z",
  "interactions_since_last": 5,
  "file_count": 0,
  "modified_files": [
    {
      "path": "src/auth.js",
      "operation": "edit",
      "timestamp": "2025-11-13T11:35:00.000Z"
    }
  ]
}
```

---

## Processing Logic (Embedded in Session Commands)

### Step 1: Detection

Before EVERY response, Claude checks:
```
Does .claude/sessions/{active_session}/.pending-auto-snapshot exist?
```

If NO → Continue normally
If YES → Process marker

### Step 2: Read Marker Metadata

```javascript
const marker = JSON.parse(fs.readFileSync('.pending-auto-snapshot'));
// marker.last_snapshot_timestamp tells us where to analyze from
// marker.trigger tells us why (interaction_threshold vs file_threshold)
// marker.modified_files lists what changed
```

### Step 3: Intelligent Analysis

Analyze conversation **since `last_snapshot_timestamp`** (or session start if first snapshot):

**Extract:**
- **Conversation Summary**: 2-3 paragraphs of what was discussed and accomplished
- **Decisions Made**: Technical choices, agreements, conclusions
- **Completed Todos**: Tasks finished since last snapshot
- **Files Modified**: What changed and why (from marker + conversation context)
- **Current State**: Where things stand, next steps, blockers

### Step 4: Create Intelligent Snapshot

**Format:**
```markdown
# Auto-Snapshot: {session_name}
**Timestamp**: {ISO timestamp}
**Auto-Generated**: Yes
**Trigger**: {interaction_threshold|file_threshold}

## Conversation Summary
{2-3 paragraph summary of what happened since last snapshot}

Example:
"Continued work on implementing the intelligent auto-snapshot system.
Modified the user-prompt-submit.js hook to create marker files instead
of directly generating snapshots. This allows Claude to perform
intelligent analysis of the conversation before creating snapshots,
rather than just dumping metadata.

Updated both start.md and continue.md commands to inject persistent
instructions for marker checking. These instructions tell Claude to
check for .pending-auto-snapshot files before every response and
process them transparently.

The new architecture is more reliable than the old system because it
doesn't rely on Claude proactively checking markers - instead, the
session commands explicitly instruct this behavior."

## Decisions Made
- Use marker-based architecture instead of direct snapshot creation
- Embed marker-checking logic in session commands (not separate command file)
- Store file modification metadata in marker for context

## Completed Todos
- Modified /session:start command to add marker-checking instruction
- Modified /session:continue command to add marker-checking instruction
- Updated user-prompt-submit.js hook to create markers

## Files Modified
- session/commands/start.md: Added CRITICAL section for marker monitoring
- session/commands/continue.md: Added CRITICAL section for marker monitoring
- session/hooks/user-prompt-submit.js: Replaced direct snapshot creation with marker creation

## Current State
System architecture complete. Need to update documentation to reflect
intelligent snapshots. All core functionality implemented and working.

## Notes
Auto-generated intelligent snapshot. Captures conversation context automatically.
```

### Step 5: Write Snapshot via CLI

Use CLI delegation for plan mode support:

```bash
echo "{snapshot_content}" | node /Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
```

### Step 6: Cleanup

```bash
# Delete marker to prevent reprocessing
rm .claude/sessions/{session_name}/.pending-auto-snapshot

# Update state file if needed (usually hook handles this)
# Reset counters already done by hook when marker was created
```

### Step 7: Continue Normally

After processing, continue with user's request. The snapshot creation is **completely transparent** to the user.

---

## Differences from Old System

**Old System (v3.3.0 and earlier):**
- Hooks created snapshots directly with minimal metadata
- No conversation analysis
- No decision extraction
- Just counters and file lists

**New System (v3.4.0):**
- Hooks create markers (lightweight)
- Claude analyzes conversation intelligently
- Extracts decisions, todos, summaries
- Full context preservation
- Works reliably (embedded in commands, not separate detection)

---

## Triggers

Auto-snapshots are created when:

1. **Interaction Threshold**: 5 user messages since last snapshot
2. **File Threshold**: 3+ files modified (and at least 5 interactions)

Configuration in `session/hooks/user-prompt-submit.js`:
```javascript
const SNAPSHOT_THRESHOLD = 5;  // Every 5 interactions
```

---

## User Experience

**User's Perspective:**
1. User works normally in session
2. Every 5 interactions, snapshot automatically created
3. No interruption or notification (completely silent)
4. Context preserved for future session resumption

**Behind the Scenes:**
```
Interaction 5 → Hook creates marker →
Next response → Claude detects marker →
Analyzes last 5 interactions →
Creates intelligent snapshot →
Deletes marker → Continues with response
```

---

## Troubleshooting

**Markers not being processed:**
- Ensure session was started with `/session:start` (not manually)
- Check that session was resumed with `/session:continue`
- Verify markers have correct JSON format

**Snapshots not appearing:**
- Check `.auto-capture-state` for interaction counts
- Verify hook is firing (check debug log if enabled)
- Ensure CLI write-snapshot command is accessible

**Missing conversation context:**
- Check `last_snapshot_timestamp` in marker
- Verify Claude is analyzing correct time range
- Review snapshot content for completeness

---

## Performance

- **Marker creation**: < 10ms (lightweight JSON write)
- **Marker detection**: < 5ms (file existence check)
- **Intelligent analysis**: 2-5 seconds (AI-powered)
- **Total overhead**: ~2-5 seconds every 5 interactions

**Impact**: Minimal - 2-5 seconds every 5 interactions = ~0.4-1 second per interaction average

---

## Future Enhancements

Potential improvements:
- Configurable thresholds per session
- Different analysis depth based on session complexity
- Automatic topic/milestone detection
- Cross-session pattern analysis
- Suggestion integration (track recommendations)

---

**Note**: This is a technical reference document. The actual marker-processing logic is embedded in `/session:start` and `/session:continue` commands, not in this file.
