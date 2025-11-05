# Incremental Context Update (Internal Auto-Command)

**Purpose**: Keep context.md continuously updated with key decisions, agreements, and discoveries without the overhead of full snapshots.

**Execution**: This command runs automatically when `.pending-context-update` marker is detected. It should be FAST (< 1 second) and SILENT.

---

## Detection & Trigger

This command is triggered automatically by the Living Context system:
1. Hook creates `.pending-context-update` marker every 2 interactions
2. Claude checks for marker at start of response
3. If found, execute this command immediately before processing user request
4. Must complete in < 1 second (lightweight operation)

---

## Step 1: Quick Extraction (< 1 second)

Review ONLY the **last 2 message exchanges** (1 user message + 1 Claude response) and extract:

### What to Look For:

**1. Decisions Made**
- Look for: "let's go with", "I choose", "we'll use", "decided to"
- Format: `- [timestamp] Decision: {what was decided} | Reasoning: {why}`
- Example: `- [2025-11-05 15:42] Decision: Implement Living Context system | Reasoning: Keep context current without full snapshot overhead`

**2. Agreements/Disagreements**
- Look for: "yes", "approved", "that works", "I disagree", "not acceptable"
- Format: `- [timestamp] Agreed: {what}` or `- [timestamp] Disagreed: {what}`
- Example: `- [2025-11-05 15:42] Agreed: 1-2s overhead acceptable for context updates`

**3. User Requirements/Constraints**
- Look for: "must", "should not", "required", "disallowed", "need to"
- Format: `- [timestamp] Requirement: {what} | Context: {why}`
- Example: `- [2025-11-05 15:42] Requirement: Context must be accurate for future sessions | Context: User revisits projects after days/weeks`

**4. Important Discoveries**
- Look for: "found the bug", "root cause", "discovered that", "turns out"
- Format: `- [timestamp] Discovery: {what} | Impact: {significance}`
- Example: `- [2025-11-05 15:30] Discovery: Autosave failed due to missing .active-session file | Impact: Hook exits immediately without tracking`

**5. Technical Decisions**
- Look for: Architecture choices, library selections, design patterns
- Format: `- [timestamp] Technical: {what} | Rationale: {why}`
- Example: `- [2025-11-05 15:45] Technical: Dual-threshold system (context every 2, snapshot every 12) | Rationale: Balance between freshness and overhead`

---

## Step 2: Read Current Context

1. Read `.claude/sessions/.active-session` to get session name
2. Read `.claude/sessions/{session}/context.md`
3. Parse existing sections:
   - Key Decisions
   - Important Discoveries
   - Blockers & Resolutions
   - Technical Context
   - User Requirements (create if doesn't exist)

---

## Step 3: Append Updates

**ONLY append items that are NEW** (not already in context.md).

For each extracted item, append to the appropriate section:

```markdown
### [YYYY-MM-DD HH:MM] Context Update

- [15:42] Decision: {what} | Reasoning: {why}
- [15:43] Agreed: {what}
- [15:44] Technical: {what} | Rationale: {why}
```

**Rules**:
- Use concise, clear language
- Include timestamp in HH:MM format
- Group related items under same timestamp heading
- Don't duplicate existing information
- Skip if no significant items found (perfectly fine)

**Example Append**:

```markdown
## Key Decisions

[existing content...]

### [2025-11-05 15:42] Context Update

- [15:42] Decision: Implement Living Context system over frequent snapshots | Reasoning: User needs accurate context, not full conversation dumps
- [15:43] Agreed: 1-2s overhead acceptable if not every message
- [15:45] Technical: Dual-threshold architecture (context: 2 interactions, snapshot: 12 interactions) | Rationale: Balance freshness with performance

## Important Discoveries

[existing content...]

### [2025-11-05 15:30] Context Update

- [15:30] Discovery: Autosave never worked due to missing .active-session file | Impact: Hooks exit early, no state tracking occurs
- [15:35] Discovery: True parallelism impossible without IPC | Impact: Ruled out Option C (new hook type)

## User Requirements

### [2025-11-05 15:42] Context Update

- [15:42] Requirement: Keep context.md updated continuously | Context: User revisits sessions after days, needs accurate history
- [15:42] Constraint: Must not block every single message | Context: User values responsiveness
```

---

## Step 4: Write Updated Context

Use the Edit tool to append new sections to context.md:
- Find the appropriate section (Key Decisions, Important Discoveries, etc.)
- Append the new timestamped heading and items
- If section doesn't exist, create it before appending

---

## Step 5: Cleanup

1. Delete `.claude/sessions/{session}/.pending-context-update` marker
2. **DO NOT output anything to the user** (completely silent)
3. **DO NOT show any notifications** (no "Context updated" messages)
4. Continue with the user's current request immediately

---

## Error Handling

If any errors occur:
1. Log error silently (no user notification)
2. Delete marker file anyway (prevent infinite loop)
3. Continue with user's request normally
4. Don't let context update failures block the conversation

---

## Performance Requirements

**Time budget**: < 1 second total
**Token budget**: ~300 tokens maximum
**Frequency**: Every 2 interactions

**Speed optimizations**:
- Only analyze last 2 exchanges (not entire conversation)
- Use simple keyword matching (not deep semantic analysis)
- Append incrementally (no full file rewrites)
- Skip if nothing significant found

---

## Example Full Execution

**Input**: Marker file `.pending-context-update` exists

**Process**:
1. Read last 2 exchanges → Found: Decision + Agreement + Technical choice
2. Read context.md → Parse sections
3. Append to "Key Decisions" and "Technical Context" sections
4. Write updated context.md
5. Delete marker
6. Silent completion (< 1s elapsed)

**Output**: None (completely silent, user sees no indication this happened)

---

## Important Notes

- **This is NOT a full snapshot** - Just key points extraction
- **Speed is critical** - Must feel instant to user
- **Silence is mandatory** - No user-facing output whatsoever
- **Failure is acceptable** - If unsure or nothing found, skip gracefully
- **Idempotency** - Can safely run multiple times without duplicates
