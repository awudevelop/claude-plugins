# Intelligent Auto-Capture Design Document

## Overview
**Version 2.0**: Intelligent, zero-latency snapshot system that uses Claude's analysis to detect natural breakpoints without impacting response time.

## Architecture: Async Content-Aware Analysis

### Key Principles
1. **Zero User Delay**: Hooks execute in <10ms, never block responses
2. **Content-Aware**: Claude analyzes conversation for natural breakpoints
3. **Async Processing**: Analysis happens in parallel with normal responses
4. **Smart Timing**: Snapshots at task completions, topic changes, code milestones

### How It Works

**Flow:**
1. User interacts → Claude responds normally (zero delay)
2. Hooks track activity (file changes, interaction count) in background
3. When thresholds suggest analysis → queue analysis request
4. Next interaction → Claude analyzes previous context in parallel
5. Analysis result stored → next interaction creates snapshot if warranted

**Result**: Snapshots at natural breakpoints with 1-2 interaction delay, zero impact on response time.

## Trigger System (Intelligent)

### 1. Analysis Queueing Triggers

**Interaction Threshold**
- **Trigger**: 8+ interactions since last analysis
- **Lower than old 10**: More frequent evaluation opportunities
- **Rationale**: Regular checks for natural breakpoints

**File Activity Trigger**
- **Trigger**: 2+ file modifications + 5+ interactions
- **Rationale**: Significant code changes suggest checking for completion

**Cooldown Period**
- **Minimum**: 3 interactions between analyses
- **Prevents**: Too-frequent analysis attempts

### 2. Natural Breakpoint Detection

Claude analyzes conversation for:

**Task Completion Signals**
- Keywords: "done", "completed", "finished", "working", "fixed"
- User confirmation of success
- Tests passing after fixes

**Topic/Context Changes**
- Shift to different files/modules
- Different feature or bug discussed
- User asks "what's next?"

**Code Milestones**
- New feature fully implemented
- Major refactoring complete
- Bug completely resolved

**Activity Momentum Shifts**
- Burst of changes followed by discussion
- Build/test phase completed
- User asking questions after series of edits

**Suggestion Provision** ✨ NEW
- User explicitly requested suggestions
- Important recommendations provided (architecture, security, performance)
- Significant advice given that warrants capture

## Suggestion Tracking System ✨ NEW (v2.1)

### Overview
Automatically detects and tracks important suggestions made during conversations. Suggestions influence snapshot decisions and are stored for future reference.

### Suggestion Types

**User-Requested**
- User explicitly asks for advice: "what should I do?", "any suggestions?"
- Triggers analysis after suggestions are provided

**Important Suggestions**
- Architecture: Design patterns, technology choices
- Security: Authentication, authorization, data protection
- Performance: Caching, optimization, scalability
- Best Practices: Code quality, patterns, conventions

### Detection Method

**During Analysis Phase:**
- Claude analyzes previous conversation segment
- Detects user requests for suggestions
- Identifies important recommendations Claude made
- Categorizes by type and importance level

**Storage:**
- Structured in `.suggestions.json` file
- Referenced in `session.md`
- Included in snapshot files
- Tracked in analysis state

### Influence on Snapshots

Suggestions strengthen YES decisions:
- User requested + Important suggestions = Strong YES
- Task complete + Suggestions given = Strong YES
- Suggestions alone during mid-work = NO (wait for completion)

## Implementation Components

### 1. user-prompt-submit.js Hook
**Timing**: Runs before Claude processes user's prompt (<10ms)
**Responsibilities**:
1. Increment interaction counter
2. Check for snapshot decision from previous analysis
3. Execute snapshot if decision was "yes"
4. Check if analysis already queued
5. Queue new analysis if thresholds met
6. All file I/O only - no blocking operations

**Analysis Queueing Logic**:
- Queue if: 8+ interactions AND 3+ since last analysis
- Queue if: 2+ files modified AND 5+ interactions AND 3+ since last analysis
- Never queue if analysis already pending

### 2. post-tool-use.js Hook
**Timing**: Runs after Write/Edit tool usage (<5ms)
**Responsibilities**:
- Track file modification count
- Update state file
- No direct snapshot triggering (contributes to analysis queue logic)

### 3. session-auto-snapshot.md Command
**Timing**: Checked at start of each Claude response
**Responsibilities**:

**Analysis Mode** (when `.pending-analysis` exists):
1. Read `.analysis-queue` file with context data
2. Analyze previous 2-3 conversation exchanges
3. Detect natural breakpoints using signals
4. Write decision to `.snapshot-decision`
5. Silent - no user notification

**Snapshot Mode** (when `.pending-auto-snapshot` exists):
1. Generate snapshot using existing logic
2. Update context.md and session.md
3. Show subtle notification: "💾 Auto-snapshot saved (natural breakpoint detected)"

### 4. session-snapshot-analysis.md Command
**Purpose**: Analysis prompt for Claude
**Content**: Detailed instructions for evaluating natural breakpoints
**Decision Output**: yes/no/defer with reasoning

## Configuration

In `session.md`, user can configure:
```markdown
## Configuration
- Auto-capture: enabled|disabled
```

**Advanced (edit hooks directly):**
- `ANALYSIS_THRESHOLD` in user-prompt-submit.js (default: 8)
- `MIN_INTERACTIONS_BETWEEN_ANALYSIS` (default: 3)
- File activity triggers in queueing logic

## State Tracking

**Files Used:**

**`.auto-capture-state`** - Persistent counters
```json
{
  "file_count": 2,
  "interaction_count": 8,
  "interactions_since_last_analysis": 4,
  "last_snapshot": "2025-10-24T15:30:00.000Z",
  "last_reason": "natural_breakpoint",
  "last_analysis_timestamp": "2025-10-24T15:25:00.000Z"
}
```

**`.analysis-queue`** - Queued analysis request
```json
{
  "timestamp": "2025-10-24T15:30:00.000Z",
  "interaction_count": 8,
  "file_count": 2,
  "interactions_since_last_snapshot": 8,
  "trigger_reason": "interaction_threshold"
}
```

**`.pending-analysis`** - Marker for Claude to run analysis
- Content: "process"
- Deleted after analysis starts

**`.snapshot-decision`** - Analysis result
```json
{
  "decision": "yes",
  "reason": "Task completed, user confirmed success",
  "confidence": "high",
  "timestamp": "2025-10-24T15:32:00.000Z",
  "analyzed_context": {
    "interactions_analyzed": 3,
    "primary_signal": "task_completion"
  }
}
```

**`.pending-auto-snapshot`** - Marker for snapshot execution
- Content: "natural_breakpoint" (or other reason)
- Deleted after snapshot created

**`.suggestions.json`** ✨ NEW - Suggestion tracking
```json
{
  "suggestions": [
    {
      "id": "sugg_20251024153000",
      "timestamp": "2025-10-24T15:30:00Z",
      "interaction_num": 12,
      "type": "important",
      "category": "architecture",
      "text": "Consider using Redis for session caching",
      "context": "Discussing session management performance",
      "importance": "high",
      "captured_in_snapshot": "auto_2025-10-24_15-45.md",
      "status": "pending"
    }
  ],
  "metadata": {
    "session_name": "feature-auth",
    "total_count": 5,
    "categories": {
      "architecture": 2,
      "security": 3
    }
  }
}
```

## Snapshot Filename Convention

Auto-snapshots use prefix: `auto_{timestamp}.md`
Manual snapshots use: `{timestamp}.md`

This allows distinguishing auto vs manual snapshots.

## Intelligent Auto-Capture Logic

### Complete Flow (Pseudocode)

```python
# user-prompt-submit.js hook (runs before Claude processes)
def on_user_prompt():
    state = load_state()
    state.interaction_count += 1
    state.interactions_since_last_analysis += 1

    # STEP 1: Process previous analysis decision
    if snapshot_decision_exists():
        decision = read_snapshot_decision()
        if decision == "yes":
            create_snapshot_marker("natural_breakpoint")
            reset_counters()
        delete_snapshot_decision()

    # STEP 2: Trigger pending analysis
    if analysis_queue_exists():
        create_analysis_marker("process")

    # STEP 3: Queue new analysis if needed
    if should_queue_analysis(state):
        write_analysis_queue({
            "interaction_count": state.interaction_count,
            "file_count": state.file_count,
            "trigger_reason": determine_reason(state)
        })

    save_state(state)

def should_queue_analysis(state):
    # Interaction threshold
    if state.interaction_count >= 8 and \
       state.interactions_since_last_analysis >= 3:
        return True

    # File activity threshold
    if state.file_count >= 2 and \
       state.interaction_count >= 5 and \
       state.interactions_since_last_analysis >= 3:
        return True

    return False

# Claude's response processing
def claude_response_start():
    # Priority 1: Run analysis if marker exists
    if pending_analysis_marker_exists():
        queue = read_analysis_queue()
        decision = analyze_conversation(queue)
        write_snapshot_decision(decision)
        delete_analysis_queue()
        delete_analysis_marker()
        # Continue with user's request (parallel processing)

    # Priority 2: Create snapshot if marker exists
    if pending_snapshot_marker_exists():
        reason = read_snapshot_marker()
        create_snapshot(reason)
        delete_snapshot_marker()
        show_notification(reason)

def analyze_conversation(context):
    # Intelligent analysis
    review_last_n_exchanges(3)
    signals = detect_signals()

    if strong_completion_signal(signals):
        return {"decision": "yes", "reason": "task_completion"}
    elif topic_change_detected(signals):
        return {"decision": "yes", "reason": "topic_change"}
    elif work_in_progress(signals):
        return {"decision": "no", "reason": "work_ongoing"}
    else:
        return {"decision": "defer", "reason": "unclear"}
```

## Implementation Notes

1. **Zero-latency design**: Hooks execute <10ms, all file I/O
2. **Async analysis**: Claude analyzes in parallel with responding to current question
3. **State persistence**: JSON files for easy parsing and debugging
4. **Error handling**: Graceful degradation - failed analysis doesn't break workflow
5. **Silent operation**: Analysis is completely transparent to user
6. **User notification**: Subtle indicator only when snapshot actually created

## Performance Guarantees

- **Hook execution**: <10ms (file reads/writes only)
- **User interaction delay**: 0ms (zero impact)
- **Analysis timing**: Parallel with current response (invisible)
- **Snapshot creation**: Async, non-blocking
- **Total overhead**: <0.1% of conversation time

## Testing Plan

### 1. Basic Functionality
- Verify hooks track interactions and file changes
- Confirm analysis queue created at threshold
- Check analysis runs and produces decision
- Validate snapshot created when decision is "yes"

### 2. Natural Breakpoint Detection
- **Task completion**: Complete feature → verify snapshot
- **Topic change**: Switch topics → verify snapshot
- **Work in progress**: Mid-task → verify NO snapshot
- **Defer scenario**: Unclear context → verify deferred

### 3. Performance
- Measure hook execution time (<10ms)
- Confirm zero delay to user responses
- Verify analysis doesn't block

### 4. State Persistence
- Restart conversation → verify counters maintained
- Multiple analyses → verify cooldown works
- Snapshot created → verify counters reset

### 5. Edge Cases
- Disable auto-capture → verify no snapshots
- Rapid interactions → verify cooldown prevents spam
- Analysis fails → verify graceful continuation

## Future Enhancements

- ✅ **Smart triggering** - IMPLEMENTED in v2.0
- **Richer context capture**: Include file diff summaries in analysis queue
- **Machine learning**: Learn user's preferred breakpoint patterns
- **Configurable thresholds per session**: UI for threshold adjustment
- **Auto-cleanup**: Remove old snapshots (keep last N)
- **Snapshot compression**: For large sessions
- **Analytics**: Dashboard showing snapshot patterns and effectiveness
