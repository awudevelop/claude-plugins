# Intelligent Session Auto-Capture Hooks (v2.1)

This directory contains hooks for the Claude Session Memory Plugin that enable **intelligent, zero-latency automatic snapshot capture with suggestion tracking**.

## Key Features

✅ **Zero User Delay**: Hooks run in <10ms, never block responses
✅ **Content-Aware**: Claude analyzes conversation for natural breakpoints
✅ **Async Processing**: Analysis happens in parallel with normal responses
✅ **Smart Timing**: Snapshots at task completions, topic changes, code milestones
✅ **Suggestion Tracking** ✨ NEW: Automatically detects and stores important suggestions

## Available Hooks

### 1. `user-prompt-submit.js` (Intelligent Orchestrator)
**Trigger**: Runs before each user prompt is processed
**Execution Time**: <10ms
**Purpose**:
- Tracks conversation interactions
- Processes analysis decisions from previous interactions
- Queues intelligent analysis when thresholds suggest
- Creates snapshot markers when natural breakpoints detected

**Thresholds**:
- Analysis queued after: 8+ interactions (or 2+ files + 5+ interactions)
- Cooldown: 3 interactions minimum between analyses

**Language**: Node.js

### 2. `post-tool-use.js` (File Activity Tracker)
**Trigger**: Runs after Write or Edit tool usage
**Execution Time**: <5ms
**Purpose**: Tracks file modification count for intelligent analysis
**Language**: Node.js

### 3. `session-auto-snapshot.md` (Command)
**Type**: Internal command
**Purpose**: Dual-mode processor:
1. **Analysis Mode**: Runs intelligent conversation analysis
2. **Snapshot Mode**: Creates snapshots at natural breakpoints

### 4. `session-snapshot-analysis.md` (Command)
**Type**: Analysis prompt
**Purpose**: Detailed instructions for Claude to detect natural breakpoints
**Signals**: Task completion, topic changes, code milestones, activity shifts

## How Intelligent Auto-Capture Works

### Flow (Zero Latency)

1. **User interacts** → Claude responds normally (0ms delay)
2. **Hooks track** → File changes, interaction count (background, <10ms)
3. **Threshold reached** → Analysis request queued
4. **Next interaction** → Claude analyzes previous context **in parallel** with responding
5. **Decision stored** → yes/no/defer written to state file
6. **Following interaction** → Snapshot created if decision was "yes"

### Natural Breakpoint Detection

Claude analyzes for:
- **Task completion**: "done", "working", "fixed", user confirmation
- **Topic changes**: Different files/features discussed
- **Code milestones**: Features complete, bugs fixed, refactors done
- **Momentum shifts**: Burst activity followed by questions/discussion
- **Suggestion provision** ✨ NEW: User requested suggestions + Important recommendations given

### Example

```
Interaction 1-8: User implements authentication feature
  → Threshold reached, analysis queued

Interaction 9: User says "Great, it works! Now let's work on the database"
  → Claude analyzes (in parallel): Detects task completion + topic change
  → Decision: YES

Interaction 10: Snapshot created
  → User sees: "💾 Auto-snapshot saved (natural breakpoint detected)"
  → Continue working on database
```

## Suggestion Tracking ✨ NEW (v2.1)

### Overview
Automatically detects and stores important suggestions made during conversations. Suggestions influence snapshot decisions and provide valuable reference.

### What Gets Tracked

**User-Requested Suggestions:**
- User asks: "what should I do?", "any suggestions?", "how would you approach this?"
- Claude provides recommendations
- Captured when user explicitly seeks advice

**Important Suggestions from Claude:**
- **Architecture**: "Consider using Redis...", "I recommend this pattern..."
- **Security**: "Important to implement authentication...", "Use bcrypt for passwords..."
- **Performance**: "Consider caching...", "Optimize by..."
- **Best Practices**: "Best practice is to...", "You should follow..."

### Detection & Storage

**Detection**: During analysis phase, Claude reviews conversation and detects:
1. User requests for suggestions
2. Important recommendations provided
3. Categories and importance levels

**Storage**: `.suggestions.json` in session directory:
```json
{
  "suggestions": [
    {
      "id": "sugg_20251024153000",
      "timestamp": "2025-10-24T15:30:00Z",
      "type": "user-requested|important",
      "category": "architecture|security|performance|best-practice|general",
      "text": "Consider using Redis for session caching",
      "importance": "high|medium|low",
      "status": "pending|captured|implemented"
    }
  ]
}
```

**Referenced in**:
- `session.md` (recent suggestions)
- Snapshot files (suggestions since last snapshot)

### Influence on Snapshots

Suggestions strengthen snapshot decisions:
- User requested + Important suggestions provided → Strong YES
- Task complete + Suggestions given → Strong YES
- Minor suggestions during ongoing work → NO (wait for completion)

### Example Flow

```
User: "I need to implement authentication. What's the best approach?"
  → Detected: User requesting suggestions

Claude: "I recommend using JWT with refresh tokens. For security, use bcrypt..."
  → Detected: 2 important suggestions (security, architecture)
  → Added to .suggestions.json

[After user thanks and moves to implementation]
  → Analysis: User requested + Important suggestions + Topic ready to shift
  → Decision: YES
  → Snapshot includes suggestion section
```

## State Tracking

Each session uses multiple state files:

### `.auto-capture-state` (Persistent Counters)
```json
{
  "file_count": 2,
  "interaction_count": 8,
  "interactions_since_last_analysis": 4,
  "last_snapshot": "2025-10-24T15:30:00Z",
  "last_reason": "natural_breakpoint",
  "last_analysis_timestamp": "2025-10-24T15:25:00Z"
}
```

### `.analysis-queue` (Pending Analysis)
Created when thresholds met, contains context for Claude to analyze.

### `.pending-analysis` (Analysis Trigger)
Marker file that tells Claude to run analysis.

### `.snapshot-decision` (Analysis Result)
Contains Claude's decision (yes/no/defer) after analyzing conversation.

### `.pending-auto-snapshot` (Snapshot Trigger)
Marker file that triggers actual snapshot creation.

### `.suggestions.json` ✨ NEW (Suggestion Tracking)
Structured storage of all suggestions with metadata and categories.

All state persists between Claude invocations.

## Requirements

- **Node.js** must be installed (v14+ recommended)
- Check with: `node --version`

## Configuration

### Enable/Disable Auto-Capture

In your session's `session.md`, update the Configuration section:

```markdown
## Configuration
- Auto-capture: enabled    # Change to 'disabled' to turn off
```

### Adjust Thresholds (Advanced)

Edit `user-prompt-submit.js` constants:

**Analysis threshold** (when to queue analysis):
```javascript
const ANALYSIS_THRESHOLD = 8;  // Default: 8 interactions
```

**Analysis cooldown** (minimum between analyses):
```javascript
const MIN_INTERACTIONS_BETWEEN_ANALYSIS = 3;  // Default: 3
```

**File activity trigger** (in queueing logic):
```javascript
// Queue if 2+ files modified AND 5+ interactions
if (state.file_count >= 2 && state.interaction_count >= 5)
```

**Note**: Lower thresholds = more frequent analysis = more natural snapshots
Higher thresholds = fewer analyses = less overhead but might miss breakpoints

## Snapshot Naming Convention

- **Manual snapshots**: `YYYY-MM-DD_HH-MM.md` (e.g., `2025-10-23_16-45.md`)
- **Auto snapshots**: `auto_YYYY-MM-DD_HH-MM.md` (e.g., `auto_2025-10-23_16-45.md`)

The `auto_` prefix helps distinguish automatic from manual snapshots.

## Trigger Reasons

Auto-snapshots are tagged with their trigger reason:

- `natural_breakpoint` - Intelligent analysis detected completion/topic change
- `file_threshold` - Legacy: Direct file threshold (disabled in v2.0)
- `interaction_threshold` - Legacy: Direct interaction count (disabled in v2.0)

**v2.0**: All snapshots now go through intelligent analysis first, so most will show `natural_breakpoint`.

## Troubleshooting

### Hooks Not Running

1. **Check Node.js installed**:
   ```bash
   node --version
   ```

2. **Check permissions**: Hooks must be executable
   ```bash
   chmod +x .claude/hooks/*.js
   ```

3. **Check Claude Code hooks enabled**: Verify hooks are enabled in Claude Code settings

4. **Check session active**: Hooks only run when a session is active
   ```bash
   cat .claude/sessions/.active-session
   ```

### Too Many Auto-Snapshots

1. **Increase analysis threshold**: Edit `ANALYSIS_THRESHOLD` in user-prompt-submit.js (default: 8)
2. **Increase cooldown**: Edit `MIN_INTERACTIONS_BETWEEN_ANALYSIS` (default: 3)
3. **Disable auto-capture**: Set `Auto-capture: disabled` in session.md

### No Auto-Snapshots

1. **Check auto-capture enabled**: Verify `Auto-capture: enabled` in session.md
2. **Check activity**: Look at `.auto-capture-state` to see current counts
3. **Check analysis queue**: Look for `.analysis-queue` or `.snapshot-decision` files
4. **Natural breakpoints**: Claude may be correctly detecting that work is in-progress

### Debugging Analysis

Check session directory for:
- `.analysis-queue` - Analysis was queued
- `.pending-analysis` - Claude should run analysis next
- `.snapshot-decision` - See Claude's decision and reasoning
- `.pending-auto-snapshot` - Snapshot will be created next

### Manual Reset

If state gets out of sync, delete the state file:

```bash
rm .claude/sessions/{your-session}/.auto-capture-state
```

It will be recreated on next hook execution.

## Testing Intelligent Snapshots

### Test Natural Breakpoint Detection

```bash
# Start a session
/session start intelligent-test

# Complete a discrete task (e.g., implement feature, fix bug)
# Have 8+ interactions
# Clearly finish with "Great, that works!" or similar
# Ask about a different topic

# After topic change, Claude should:
# 1. Silently analyze previous context
# 2. Detect natural breakpoint
# 3. Create snapshot: "💾 Auto-snapshot saved (natural breakpoint detected)"
```

### Test Work-In-Progress Detection

```bash
# Start working on a feature
# After 8 interactions (mid-work)
# Continue debugging or implementing

# Claude should:
# 1. Queue analysis
# 2. Detect work is ongoing
# 3. NOT create snapshot
# 4. Wait for actual completion
```

### Monitor Analysis Decisions

```bash
# Check snapshot decision file
cat .claude/sessions/{your-session}/.snapshot-decision

# Shows Claude's reasoning:
# {"decision": "yes", "reason": "Task completed, user confirmed success", ...}
```

## Disabling Hooks

### Temporarily (per session)

Edit session's `session.md`:
```markdown
## Configuration
- Auto-capture: disabled
```

### Permanently (all sessions)

Remove or rename hook files:
```bash
mv .claude/hooks/user-prompt-submit.js .claude/hooks/user-prompt-submit.js.disabled
mv .claude/hooks/post-tool-use.js .claude/hooks/post-tool-use.js.disabled
```

## Advanced: Customization

### Custom Analysis Signals

Edit `session-snapshot-analysis.md` to add custom breakpoint detection:
- Add domain-specific keywords
- Adjust signal weights
- Add project-specific patterns

### Analysis Prompt Tuning

Modify the analysis command to:
- Be more/less conservative with snapshots
- Focus on specific types of breakpoints
- Adjust confidence thresholds

## Integration with Claude Code

These hooks integrate with Claude Code's hook system. For more information on Claude Code hooks:

- Read Claude Code documentation on hooks
- Check `.claude/hooks/` for hook discovery
- Hooks must be executable and return exit code 0

## Files Created by Hooks

- `.auto-capture-state` - State tracking file
- `.analysis-queue` - Queued analysis requests
- `.pending-analysis` - Analysis trigger marker
- `.snapshot-decision` - Analysis results
- `.pending-auto-snapshot` - Snapshot trigger marker (deleted after processing)
- `.suggestions.json` ✨ NEW - Structured suggestion storage
- `auto_*.md` - Auto-generated snapshot files

## Performance

**Zero-latency architecture:**
- Hook execution: <10ms (file I/O only)
- User response delay: 0ms (no blocking)
- Analysis: Parallel with Claude's normal response
- Snapshot creation: Async, non-blocking

**Overhead:**
- Per interaction: ~5ms (imperceptible)
- Analysis frequency: Every 8-12 interactions (self-regulated)
- Total impact: <0.1% of conversation time

## Security

- Hooks only read/write to `.claude/sessions/` directory
- No external command execution
- No network access
- No sensitive data in state files

## Future Enhancements

Implemented in v2.0:
- ✅ **Smart triggering** - Intelligent natural breakpoint detection
- ✅ **Zero-latency** - Async analysis, no response delay
- ✅ **Content-aware** - Claude analyzes conversation context

Implemented in v2.1:
- ✅ **Suggestion tracking** - Detects and stores important recommendations
- ✅ **Suggestion-influenced snapshots** - User requests + Important advice trigger snapshots
- ✅ **Structured storage** - .suggestions.json with categories and metadata

Planned for future versions:
- **Richer context**: Include file diff summaries in analysis
- **Learning**: Adapt to user's preferred breakpoint patterns
- **Per-session config**: UI for threshold adjustment
- **Auto-cleanup**: Remove old snapshots (keep last N)
- **Snapshot compression**: For large sessions
- **Analytics dashboard**: Visualize snapshot patterns and effectiveness
- **Multi-modal signals**: Detect breakpoints from code structure changes
- **Suggestion implementation tracking**: Mark suggestions as implemented

---

**Version**: 2.1 (Intelligent Zero-Latency Auto-Capture + Suggestion Tracking)
**Last Updated**: 2025-10-24
**Architecture**: Async content-aware analysis with suggestion detection
**Part of**: Claude Session Memory Plugin
