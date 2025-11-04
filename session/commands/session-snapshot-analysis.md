# Session Snapshot Analysis (Internal Command)

You are analyzing whether the recent conversation segment represents a natural breakpoint worthy of a snapshot.

## Context

An analysis has been queued because basic activity thresholds suggest a snapshot might be warranted. Your task is to intelligently determine if NOW (or recently) was a natural breakpoint in the conversation.

## Analysis Request Data

Read the file `.claude/sessions/{active_session}/.analysis-queue` which contains:

```json
{
  "timestamp": "ISO timestamp when queued",
  "interaction_count": 8,
  "file_count": 2,
  "recent_activity": {
    "tools_used": ["Write", "Edit", "Read"],
    "files_modified": ["src/auth.js", "src/api.js"],
    "last_user_message_snippet": "First 100 chars...",
    "last_assistant_action": "completed authentication feature"
  }
}
```

## Your Task: Intelligent Evaluation

Analyze the PREVIOUS conversation segment (the context that led to this analysis being queued) and determine if it represents a natural breakpoint.

### Signals to Look For

**Strong YES signals (natural breakpoints):**
1. **Task Completion Indicators**
   - Words like: "done", "completed", "finished", "successfully", "working now", "fixed"
   - User explicitly confirmed something works
   - Tests passing after fixes
   - Feature fully implemented

2. **Topic/Context Changes**
   - Conversation shifted to different file/module
   - Different feature or bug being discussed
   - User asked "what should we do next?"
   - Clear transition from one task to another

3. **Significant Code Milestones**
   - New feature fully added (not partially done)
   - Major refactoring completed
   - Bug completely fixed (not still debugging)
   - Multiple related files changed together

4. **Activity Momentum Shifts**
   - Burst of rapid file changes followed by pause/discussion
   - Series of edits followed by user questions
   - Building/testing phase just completed

5. **Suggestion Provision** ✨ NEW
   - User explicitly requested suggestions ("what should I do?", "any suggestions?")
   - You provided important recommendations (architecture, security, performance)
   - Significant advice was given that should be captured

**Strong NO signals (avoid snapshot):**
1. **Work In Progress**
   - User asked follow-up question about current task
   - Error messages or failures still being addressed
   - Partial implementation (function written but not tested)
   - "Let me also..." or "now let's..." indicating continuation

2. **Mid-Task Indicators**
   - Debugging in progress
   - Iterating on solution
   - Waiting for user feedback on current work
   - Recent changes are incremental edits to same files

3. **Low Significance**
   - Only documentation changes
   - Minor formatting/style fixes
   - Single small edit
   - Trivial changes

### Decision Process

1. Review the recent conversation context (last 2-3 exchanges)
2. Assess the signals above
3. Make a judgment call:
   - **yes** = Clear natural breakpoint detected
   - **no** = Work is ongoing, wait for better moment
   - **defer** = Unsure, check again in 2-3 more interactions

## Suggestion Detection ✨ NEW

As part of your analysis, also detect if important suggestions were made in the conversation segment:

### User-Requested Suggestions
Did the user ask for suggestions or recommendations?
- "what should I do?"
- "any suggestions?"
- "how would you approach this?"
- "what do you recommend?"

### Important Suggestions You Made
Did you provide significant recommendations?
- **Architecture**: "I recommend using...", "Consider this design pattern..."
- **Security**: "Important to implement...", "You should add authentication..."
- **Performance**: "Consider caching...", "Optimize by..."
- **Best Practices**: "Best practice is to...", "You should follow..."

### Store Detected Suggestions

If you detect important suggestions, append them to `.claude/sessions/{active_session}/.suggestions.json`:

```json
{
  "id": "sugg_TIMESTAMP",
  "timestamp": "ISO timestamp",
  "interaction_num": 12,
  "type": "user-requested|important",
  "category": "architecture|security|performance|best-practice|general",
  "text": "The actual suggestion text (1-2 sentences)",
  "context": "Brief context (what was being discussed)",
  "importance": "high|medium|low",
  "status": "pending"
}
```

**Categories:**
- `architecture`: Design patterns, system architecture, technology choices
- `security`: Authentication, authorization, data protection
- `performance`: Caching, optimization, scalability
- `best-practice`: Code quality, patterns, conventions
- `general`: Other recommendations

**Importance Levels:**
- `high`: Critical recommendations (security, architecture decisions)
- `medium`: Should-do items (best practices, performance)
- `low`: Nice-to-have suggestions

## Output Format

Write your decision to `.claude/sessions/{active_session}/.snapshot-decision`:

```json
{
  "decision": "yes|no|defer",
  "reason": "Brief explanation (1 sentence)",
  "confidence": "high|medium|low",
  "timestamp": "ISO timestamp",
  "analyzed_context": {
    "interactions_analyzed": 3,
    "primary_signal": "task_completion|topic_change|code_milestone|momentum_shift|suggestion_provision"
  },
  "suggestions_detected": {
    "count": 2,
    "has_important": true,
    "categories": ["architecture", "security"]
  }
}
```

## Important Guidelines

- **Err on the side of NO**: Better to wait than snapshot mid-task
- **Be contextual**: 10 interactions of debugging = different from 10 interactions across 3 completed features
- **Consider user experience**: Would the user expect a "save point" here?
- **Defer when uncertain**: If signals are mixed, choose "defer"

## After Analysis

1. Write decision to `.snapshot-decision` file
2. Delete `.analysis-queue` file (consumed)
3. **DO NOT create snapshot** - that happens on next interaction
4. **DO NOT mention this analysis to user** - it's silent/background
5. Continue with current user request normally

## How Suggestions Influence Decisions

**Suggestions strengthen YES signals:**
- User requested suggestions + You provided important recommendations = Strong YES
- Task complete + Important suggestions given = Strong YES
- User asks "what should I do?" + You provide architecture advice = YES (after answering)

**Suggestions alone may not warrant snapshot:**
- Minor suggestions during ongoing work = NO (wait for completion)
- User requested but you only gave general advice = DEFER
- Important suggestions but mid-implementation = NO (wait for task completion)

## Example Scenarios

### Scenario 1: Clear YES (Task Complete)
```
User: "Add authentication"
Claude: *creates auth.js, middleware.js, updates routes*
User: "Great, it works! Now can you help me with the database schema?"
→ Decision: YES (task complete + topic change)
→ Suggestions: None detected
```

### Scenario 2: Clear YES (Suggestions Provided)
```
User: "I need to implement user authentication. What's the best approach?"
Claude: "I recommend using JWT with refresh tokens. For security, use bcrypt for passwords..."
User: "Thanks! I'll implement that."
→ Decision: YES (user requested + important security suggestions provided)
→ Suggestions: 2 detected (security, architecture)
```

### Scenario 3: Clear NO
```
User: "Add authentication"
Claude: *creates auth.js*
User: "I'm getting an error: Cannot read property..."
→ Decision: NO (work in progress, debugging needed)
→ Suggestions: None
```

### Scenario 4: DEFER (Suggestions During Work)
```
User: "Refactor the API module"
Claude: *starts refactoring* "Consider using async/await throughout"
User: "Okay, continuing..."
→ Decision: DEFER (partial completion + minor suggestion, wait for finish)
→ Suggestions: 1 detected (best-practice, medium importance)
```

---

**CRITICAL**: This analysis must be:
- **Fast** (<2 seconds)
- **Silent** (no output to user)
- **Non-blocking** (happens in parallel with normal response)
- **Stored in file** (for next interaction to process)
