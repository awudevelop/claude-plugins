# Session Continue Token Optimization - Implementation Plan

**Version**: 1.0
**Target Release**: v3.7.0
**Expected Token Reduction**: 77k → 22k tokens (72% reduction)
**Architecture**: Subagent delegation via Task tool

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Task Tool Reference](#task-tool-reference)
4. [Pre-Implementation Checklist](#pre-implementation-checklist)
5. [Phase 1: Subagent Consolidation Logic](#phase-1-subagent-consolidation-logic)
6. [Phase 2: Subagent Git History Logic](#phase-2-subagent-git-history-logic)
7. [Phase 3: Subagent Goal Extraction](#phase-3-subagent-goal-extraction)
8. [Phase 4: Rewrite Continue Command](#phase-4-rewrite-continue-command)
9. [Phase 5: Testing & Validation](#phase-5-testing--validation)
10. [Phase 6: Deployment](#phase-6-deployment)
11. [Rollback Plan](#rollback-plan)

---

## Overview

### Current Problem
- `/session:continue` consumes 77k tokens (39% of budget)
- Major culprits: inline file reads (8-12k) + inline consolidation (20-25k)
- Summary generation (8k) + responses (15-20k)

### Solution
- Delegate ALL heavy work to Task tool subagents (isolated contexts)
- Main conversation: orchestrate + minimal summary
- 3 parallel subagents: consolidation, git refresh, goal extraction

### Benefits
- **72% token reduction** (77k → 22k in main conversation)
- **Parallel execution** (3 agents run simultaneously)
- **2-3x faster** (~2-4 seconds total)
- **Minimal summary** ("✓ Session ready: {goal}. What's next?")

---

## Architecture Changes

### Current Flow (v3.6.4)
```
continue.md (Main Claude):
1. CLI: validate session → 500 bytes
2. Read session.md → 5KB
3. Read context.md → 10KB
4. Read latest snapshot → 8KB
5. Check conversation-log.jsonl → exists
6. INLINE: Read + analyze log → 20-25k tokens
7. INLINE: Create snapshot → 3k tokens
8. INLINE: Display comprehensive summary → 8k tokens
TOTAL: 77k tokens
```

### Proposed Flow (v3.7.0)
```
continue.md (Main Claude):
1. CLI: validate session → 500 bytes
2. Spawn 3 Task subagents (PARALLEL):
   ├─ Agent 1: Consolidate conversation log (15k isolated)
   ├─ Agent 2: Refresh git history (10k isolated)
   └─ Agent 3: Extract goal (5k isolated)
3. Wait for all agents to complete
4. CLI: activate session
5. Edit: update timestamp
6. Display: "✓ Session ready: {goal}. What's next?"
TOTAL: 22k tokens (main), agents isolated
```

---

## Task Tool Reference

### Claude Code Documentation
**IMPORTANT**: Always refer to official Claude Code docs for Task tool parameters:
- Documentation: https://docs.claude.com/en/docs/claude-code/task-tool
- Tool definition: Available in system prompt under `<functions>` → `Task` tool

### Task Tool Parameters (v3.6+)

```xml
<invoke name="Task">
  <parameter name="subagent_type">REQUIRED - Type of agent to spawn</parameter>
  <parameter name="description">REQUIRED - Short 3-5 word description</parameter>
  <parameter name="prompt">REQUIRED - Detailed task instructions</parameter>
  <parameter name="model">OPTIONAL - sonnet/opus/haiku (default: inherit)</parameter>
</invoke>
```

### Available Subagent Types (as of 2024-11)

1. **general-purpose**: General-purpose agent for multi-step tasks
   - Has access to ALL tools (Bash, Read, Edit, Write, Grep, Glob, etc.)
   - Use for: complex analysis, file operations, multi-step workflows
   - Best for: Our consolidation, git refresh, goal extraction tasks

2. **Explore**: Fast codebase exploration agent
   - Specialized for finding files and searching code
   - Use for: "find files matching X", "search for keyword Y"
   - Not needed for our use case

3. **Plan**: Fast planning agent
   - Specialized for planning implementations
   - Not needed for our use case

### Task Tool Best Practices

1. **Prompt Structure**:
   ```markdown
   Session: {name}

   Goal: [1 sentence describing what agent should accomplish]

   Steps:
   1. [Specific action with exact command/file path]
   2. [Specific action with exact command/file path]
   3. [What to return]

   Return Format:
   JSON: { key: "value" }
   ```

2. **Parallel Execution**:
   - Invoke multiple Task tools in SINGLE message
   - Example:
   ```xml
   <function_calls>
   <invoke name="Task">...</invoke>
   <invoke name="Task">...</invoke>
   <invoke name="Task">...</invoke>
   </function_calls>
   ```
   - All agents execute simultaneously
   - Main conversation waits for ALL to complete

3. **Return Data**:
   - Keep returns minimal (JSON preferred)
   - Agent does heavy work, returns only essential data
   - Example: `{ success: true, file: "snapshot.md" }` NOT full file content

4. **Error Handling**:
   - Each agent should handle errors gracefully
   - Return error status: `{ success: false, error: "reason" }`
   - Main conversation can proceed even if one agent fails

---

## Pre-Implementation Checklist

### Before Starting

- [ ] **Backup current working version**
  ```bash
  git tag v3.6.4-backup
  git push origin v3.6.4-backup
  ```

- [ ] **Create feature branch**
  ```bash
  git checkout -b feature/token-optimization-v3.7.0
  ```

- [ ] **Review Claude Code Task tool documentation**
  - Read: https://docs.claude.com/en/docs/claude-code/task-tool
  - Confirm subagent_type options
  - Confirm parameter names (description, prompt, model)

- [ ] **Test current token usage**
  ```bash
  # Run /session:continue test-session-plugin
  # Note token count from /context command
  # Baseline: ~77k tokens
  ```

- [ ] **Set up test session for validation**
  ```bash
  # Create test session with:
  # - Existing conversation-log.jsonl (to test consolidation)
  # - Git history (to test refresh)
  # - session.md with clear goal
  ```

---

## Phase 1: Subagent Consolidation Logic

**Goal**: Create reusable prompt for consolidation subagent

**Execution Mode**: Can run in parallel with Phase 2 & 3

### Tasks

#### Task 1.1: Create Subagent Prompt Template
**File**: `session/cli/lib/subagent-prompts.js` (NEW)

**Action**: Create module with reusable prompts
**Estimated Time**: 30 minutes
**Can Run in Parallel**: Yes (independent)

```javascript
// session/cli/lib/subagent-prompts.js

/**
 * Subagent prompt templates for session operations
 * Used by commands that invoke Task tool
 */

/**
 * Consolidate conversation log subagent prompt
 * Reads conversation-log.jsonl, analyzes, creates snapshot, deletes log
 *
 * @param {string} sessionName - Session name
 * @param {string} pluginRoot - CLAUDE_PLUGIN_ROOT path
 * @returns {string} Prompt for Task tool
 */
function getConsolidationPrompt(sessionName, pluginRoot) {
  return `Session: ${sessionName}

Goal: Consolidate conversation log into auto-snapshot (if log exists)

Steps:
1. Check if file exists: .claude/sessions/${sessionName}/conversation-log.jsonl
2. If file does NOT exist:
   - Return JSON: { "skipped": true, "reason": "No conversation log found" }
   - STOP (do not proceed)

3. If file exists:
   - Read the conversation log file
   - Parse JSONL format (each line = JSON entry)
   - Extract:
     - type: "interaction" entries (user prompts)
     - type: "assistant_response" entries (Claude responses with response_text field)

4. Analyze the conversation:
   - Write 2-3 paragraph summary of what happened
   - Identify 2-4 key decisions with rationale
   - List completed tasks/todos
   - Document files modified with context (what changed and why)
   - Assess current state (what's done, what's next, blockers)

5. Create consolidated snapshot:
   Use this exact format:

   # Consolidated Snapshot: ${sessionName}
   **Timestamp**: [current ISO timestamp]
   **Method**: Claude Inline Analysis (Free)
   **Status**: Consolidated from conversation log

   ## Conversation Summary
   [2-3 paragraphs]

   ## Key Decisions
   - [Decision 1 with rationale]
   - [Decision 2 with rationale]

   ## Completed Tasks
   - [Task 1]
   - [Task 2]

   ## Files Modified
   - [file_path]: [what changed and why]

   ## Current State
   [Where things stand, what's next, blockers]

   ## Notes
   Consolidated via Claude inline analysis at session boundary.

6. Write snapshot via CLI:
   echo "[snapshot content from step 5]" | node ${pluginRoot}/cli/session-cli.js write-snapshot "${sessionName}" --stdin --type auto

7. Delete conversation log:
   rm .claude/sessions/${sessionName}/conversation-log.jsonl

8. Update state file:
   node ${pluginRoot}/cli/session-cli.js update-state "${sessionName}" --reset-counters --set-last-snapshot "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

Return Format:
JSON with these exact fields:
{
  "success": true,
  "snapshot_created": "[filename]",
  "timestamp": "[ISO timestamp]",
  "interaction_count": [number],
  "summary_preview": "[first 100 chars of summary]"
}

If any error occurs:
{
  "success": false,
  "error": "[error description]",
  "step_failed": "[which step number]"
}

IMPORTANT:
- Use exact CLI commands shown above
- Do NOT read transcript files (log is self-contained)
- Return ONLY JSON, no additional commentary
`;
}

/**
 * Git history refresh subagent prompt
 * Captures latest git commits, changes, and repository state
 *
 * @param {string} sessionName - Session name
 * @param {string} pluginRoot - CLAUDE_PLUGIN_ROOT path
 * @returns {string} Prompt for Task tool
 */
function getGitRefreshPrompt(sessionName, pluginRoot) {
  return `Session: ${sessionName}

Goal: Refresh git history context for session

Steps:
1. Run git history capture CLI:
   node ${pluginRoot}/cli/session-cli.js capture-git "${sessionName}"

2. The CLI will:
   - Get last 50 commits (git log)
   - Get uncommitted changes (git status, git diff)
   - Calculate file hotspots (frequently changed files)
   - Compress to ~2-3KB JSON
   - Write to: .claude/sessions/${sessionName}/git-history.json

3. If no git repository:
   - CLI returns: { success: false }
   - This is OK, just return the result

Return Format:
JSON with these exact fields:
{
  "success": true,
  "commits_analyzed": [number],
  "uncommitted_changes": [number],
  "file_hotspots_count": [number],
  "latest_commit_hash": "[hash]",
  "latest_commit_date": "[date]"
}

If no git repo or error:
{
  "success": false,
  "reason": "[why]"
}

IMPORTANT:
- Let CLI handle all git operations
- Do NOT run git commands manually
- Return ONLY JSON, no additional commentary
`;
}

/**
 * Goal extraction subagent prompt
 * Reads session.md and extracts just the goal
 *
 * @param {string} sessionName - Session name
 * @returns {string} Prompt for Task tool
 */
function getGoalExtractionPrompt(sessionName) {
  return `Session: ${sessionName}

Goal: Extract session goal from session.md

Steps:
1. Read file: .claude/sessions/${sessionName}/session.md

2. Find the "## Goal" section header

3. Extract all text after "## Goal" until:
   - Next "##" header, OR
   - End of file

4. Clean the extracted text:
   - Trim whitespace
   - Remove leading/trailing newlines
   - Keep formatting (bullets, line breaks within goal)

Return Format:
JSON with these exact fields:
{
  "success": true,
  "goal": "[extracted goal text]"
}

If file not found or goal section missing:
{
  "success": false,
  "error": "[description]",
  "fallback_goal": "Session ${sessionName}"
}

IMPORTANT:
- Return ONLY the goal text, not entire file
- Preserve original formatting within goal
- Return ONLY JSON, no additional commentary
`;
}

module.exports = {
  getConsolidationPrompt,
  getGitRefreshPrompt,
  getGoalExtractionPrompt
};
```

**Validation**:
- [ ] File created: `session/cli/lib/subagent-prompts.js`
- [ ] All 3 functions exported
- [ ] Prompts follow Task tool best practices
- [ ] Clear step-by-step instructions
- [ ] Specific return JSON format

---

## Phase 2: Subagent Git History Logic

**Goal**: Verify git refresh can work via subagent

**Execution Mode**: Can run in parallel with Phase 1 & 3

### Tasks

#### Task 2.1: Test Git Capture CLI Command
**Action**: Verify CLI command works standalone
**Estimated Time**: 10 minutes
**Can Run in Parallel**: Yes

```bash
# Test the capture-git command
node session/cli/session-cli.js capture-git "test-session-plugin"

# Expected output:
# {
#   "success": true,
#   "path": ".claude/sessions/test-session-plugin/git-history.json",
#   "size": 17752,
#   "message": "Git history captured"
# }

# Verify file was created/updated
ls -lh .claude/sessions/test-session-plugin/git-history.json
```

**Validation**:
- [ ] Command runs without errors
- [ ] Returns JSON with success: true
- [ ] git-history.json file created/updated
- [ ] File size reasonable (~2-20KB)

#### Task 2.2: Document Git Capture Output Format
**File**: Update `session/cli/README.md`
**Action**: Document expected return format
**Estimated Time**: 10 minutes
**Can Run in Parallel**: Yes

Add to CLI documentation:
```markdown
### capture-git

Captures git repository history and writes to session folder.

**Usage**:
```bash
node cli/session-cli.js capture-git <session-name>
```

**Returns**:
```json
{
  "success": true,
  "commits_analyzed": 50,
  "uncommitted_changes": 3,
  "file_hotspots_count": 12,
  "latest_commit_hash": "abc123",
  "latest_commit_date": "2025-11-14"
}
```

**Notes**:
- Captures last 50 commits
- Analyzes uncommitted changes
- Identifies file hotspots
- Silent fail if no git repo (returns success: false)
```

**Validation**:
- [ ] Documentation added to CLI README
- [ ] Return format clearly specified

---

## Phase 3: Subagent Goal Extraction

**Goal**: Create simple goal extraction logic

**Execution Mode**: Can run in parallel with Phase 1 & 2

### Tasks

#### Task 3.1: Test Manual Goal Extraction
**Action**: Verify we can extract goal from session.md
**Estimated Time**: 10 minutes
**Can Run in Parallel**: Yes

```bash
# Manual test - extract goal section
cat .claude/sessions/test-session-plugin/session.md | \
  sed -n '/## Goal/,/^## /p' | \
  head -n -1

# Should output just the goal text
```

**Validation**:
- [ ] Command successfully extracts goal section
- [ ] Output clean (no headers, no next section)
- [ ] Formatting preserved

#### Task 3.2: Consider CLI Command for Goal Extraction
**File**: `session/cli/lib/commands/get-goal.js` (OPTIONAL)
**Action**: Decide if we need CLI command or keep in subagent
**Estimated Time**: 15 minutes
**Can Run in Parallel**: Yes

**Decision Point**:
- **Option A**: Subagent reads file directly (simpler, no CLI change) ← **RECOMMENDED**
- **Option B**: Create CLI `get-goal` command (reusable)

**Recommendation**: Use Option A. Subagent can read file directly since it has Read tool access.

**Validation**:
- [ ] Decision made and documented

---

## Phase 4: Rewrite Continue Command

**Goal**: Replace continue.md with new subagent-based architecture

**Execution Mode**: MUST run AFTER Phases 1, 2, 3 complete
**Dependencies**: Requires `subagent-prompts.js` from Phase 1

### Tasks

#### Task 4.1: Backup Current continue.md
**File**: `session/commands/continue.md`
**Action**: Create backup before modifications
**Estimated Time**: 2 minutes
**Can Run in Parallel**: No (must be first)

```bash
# Create backup
cp session/commands/continue.md session/commands/continue.md.v3.6.4.backup

# Verify backup
ls -lh session/commands/continue.md*
```

**Validation**:
- [ ] Backup file created
- [ ] Backup identical to original

#### Task 4.2: Write New continue.md (Subagent Architecture)
**File**: `session/commands/continue.md`
**Action**: Complete rewrite with Task tool invocations
**Estimated Time**: 60 minutes
**Can Run in Parallel**: No (sequential)

**New continue.md Structure**:

```markdown
You are managing a session memory system. The user wants to resume an existing session.

## Task: Continue Existing Session

Parse the session name from the command arguments. The command format is: `/session continue [name]`

**OPTIMIZATION**: v3.7.0 uses parallel subagent delegation for 72% token reduction.

### Step 1: Validate Session Exists (CLI)

Extract the session name from arguments, then run:

```bash
node /Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session/cli/session-cli.js get {session_name}
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

**CRITICAL**: Spawn ALL 3 subagents in a SINGLE message with 3 Task tool calls. This runs them in parallel.

Load the subagent prompt templates:
```javascript
const prompts = require('/Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session/cli/lib/subagent-prompts.js');
const pluginRoot = '/Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session';
```

Then invoke 3 Task tools in parallel:

**Subagent 1: Consolidate Conversation Log**
```xml
<invoke name="Task">
  <parameter name="subagent_type">general-purpose</parameter>
  <parameter name="description">Consolidate conversation log</parameter>
  <parameter name="prompt">${prompts.getConsolidationPrompt(sessionName, pluginRoot)}</parameter>
  <parameter name="model">haiku</parameter>
</invoke>
```

**Subagent 2: Refresh Git History**
```xml
<invoke name="Task">
  <parameter name="subagent_type">general-purpose</parameter>
  <parameter name="description">Refresh git history</parameter>
  <parameter name="prompt">${prompts.getGitRefreshPrompt(sessionName, pluginRoot)}</parameter>
  <parameter name="model">haiku</parameter>
</invoke>
```

**Subagent 3: Extract Session Goal**
```xml
<invoke name="Task">
  <parameter name="subagent_type">general-purpose</parameter>
  <parameter name="description">Extract session goal</parameter>
  <parameter name="prompt">${prompts.getGoalExtractionPrompt(sessionName)}</parameter>
  <parameter name="model">haiku</parameter>
</invoke>
```

**IMPORTANT**: All 3 Task invocations must be in the SAME response to run in parallel.

### Step 3: Process Subagent Results

After all 3 subagents complete, you'll receive their results. Handle errors gracefully:

**Consolidation Result**:
- If `success: true` → Snapshot created successfully
- If `skipped: true` → No conversation log found (OK, skip)
- If `success: false` → Log error but continue

**Git Refresh Result**:
- If `success: true` → Git history updated
- If `success: false` → No git repo or error (OK, skip)

**Goal Extraction Result**:
- If `success: true` → Use the extracted goal
- If `success: false` → Use fallback goal from result

### Step 4: Activate Session

Run the CLI command to activate the session:

```bash
node /Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/session/cli/session-cli.js activate {session_name}
```

This updates both the .active-session file and the index.

### Step 5: Update Last Updated Timestamp

Update the "Last Updated" line in session.md to current time using the Edit tool:

```
**Last Updated**: {current ISO timestamp}
```

### Step 6: Display Minimal Summary

Show a clean, minimal summary:

```
✓ Session ready: {goal}

What's next?
```

**IMPORTANT**:
- Do NOT show comprehensive summaries
- Do NOT list files, milestones, decisions
- Keep it minimal for token efficiency
- User can run `/session status` for detailed view

---

ARGUMENTS: {name}
```

**Validation**:
- [ ] New continue.md created
- [ ] Uses Task tool with 3 parallel invocations
- [ ] Uses subagent-prompts.js module
- [ ] Minimal summary display
- [ ] Proper error handling

#### Task 4.3: Handle Edge Cases
**Action**: Add error handling logic to continue.md
**Estimated Time**: 20 minutes
**Can Run in Parallel**: No (after 4.2)

**Edge cases to handle**:
1. No conversation log → Skip consolidation (subagent returns skipped)
2. No git repo → Skip git refresh (subagent returns success: false)
3. Missing goal in session.md → Use fallback goal
4. Subagent task fails → Log error, continue with other results
5. All subagents fail → Still activate session, show generic message

**Validation**:
- [ ] All edge cases documented
- [ ] Error handling implemented

---

## Phase 5: Testing & Validation

**Goal**: Thoroughly test new architecture before deployment

**Execution Mode**: MUST run AFTER Phase 4 complete
**Dependencies**: Requires new continue.md

### Tasks

#### Task 5.1: Unit Test - Subagent Prompts
**Action**: Test each subagent prompt template
**Estimated Time**: 30 minutes
**Can Run in Parallel**: After Phase 1 complete

```bash
# Test in Node.js REPL
node
> const prompts = require('./session/cli/lib/subagent-prompts.js');
> console.log(prompts.getConsolidationPrompt('test-session', '/path'));
> console.log(prompts.getGitRefreshPrompt('test-session', '/path'));
> console.log(prompts.getGoalExtractionPrompt('test-session'));
```

**Validation**:
- [ ] All prompts generate valid strings
- [ ] Proper parameter substitution
- [ ] Clear instructions in each prompt

#### Task 5.2: Integration Test - Consolidation Subagent
**Action**: Test conversation log consolidation via Task tool
**Estimated Time**: 20 minutes
**Can Run in Parallel**: No

**Test Steps**:
1. Create test session with conversation-log.jsonl
2. Manually invoke Task tool with consolidation prompt
3. Verify snapshot created
4. Verify log deleted
5. Verify return JSON correct

```bash
# Prepare test data
echo '{"type":"interaction","user_prompt":"test"}' > \
  .claude/sessions/test-consolidation/conversation-log.jsonl

# Then manually run Task tool in Claude Code
# (Cannot script this - must test interactively)
```

**Validation**:
- [ ] Subagent successfully reads log
- [ ] Snapshot file created
- [ ] Log file deleted
- [ ] Correct JSON returned
- [ ] Token usage in subagent context (not main)

#### Task 5.3: Integration Test - Git Refresh Subagent
**Action**: Test git history refresh via Task tool
**Estimated Time**: 15 minutes
**Can Run in Parallel**: No

**Test Steps**:
1. Run Task tool with git refresh prompt
2. Verify git-history.json updated
3. Verify return JSON correct

**Validation**:
- [ ] Git history captured
- [ ] File written to session folder
- [ ] Correct JSON returned

#### Task 5.4: Integration Test - Goal Extraction Subagent
**Action**: Test goal extraction via Task tool
**Estimated Time**: 15 minutes
**Can Run in Parallel**: No

**Test Steps**:
1. Run Task tool with goal extraction prompt
2. Verify correct goal returned
3. Test with missing goal (fallback)

**Validation**:
- [ ] Goal correctly extracted
- [ ] Formatting preserved
- [ ] Fallback works

#### Task 5.5: End-to-End Test - Full Continue Command
**Action**: Test complete /session:continue flow
**Estimated Time**: 30 minutes
**Can Run in Parallel**: No

**Test Scenarios**:

1. **Scenario A: Full consolidation**
   - Session with conversation-log.jsonl
   - Has git repo
   - Has clear goal
   - Expected: All 3 subagents succeed

2. **Scenario B: No consolidation needed**
   - Session without conversation-log.jsonl
   - Has git repo
   - Has clear goal
   - Expected: Consolidation skipped, others succeed

3. **Scenario C: No git repo**
   - Session with conversation-log.jsonl
   - No git repo
   - Has clear goal
   - Expected: Git refresh fails gracefully

4. **Scenario D: Minimal session**
   - No conversation log
   - No git repo
   - Goal present
   - Expected: Only goal extraction succeeds

**Test Commands**:
```bash
# For each scenario:
/session:continue {test-session-name}
/context  # Check token usage

# Expected token usage: ~22k (vs 77k before)
```

**Validation**:
- [ ] All scenarios pass
- [ ] Token usage <25k in main conversation
- [ ] Subagents run in parallel (observe timing)
- [ ] Minimal summary displayed
- [ ] Session activated correctly

#### Task 5.6: Performance Benchmarking
**Action**: Measure and compare performance
**Estimated Time**: 20 minutes
**Can Run in Parallel**: No

**Metrics to Capture**:

| Metric | v3.6.4 (Current) | v3.7.0 (Optimized) | Improvement |
|--------|------------------|---------------------|-------------|
| Token usage (main) | ~77k | ~22k | 72% reduction |
| Execution time | 3-4s | 2-4s | Similar/faster |
| Subagent count | 0 | 3 | N/A |
| File reads (main) | 3-4 files | 0 files | 100% reduction |
| Summary length | ~50 lines | ~2 lines | 96% reduction |

**Validation**:
- [ ] Metrics captured for both versions
- [ ] Token reduction >60%
- [ ] Execution time similar or better
- [ ] No functionality regressions

---

## Phase 6: Deployment

**Goal**: Deploy v3.7.0 to production

**Execution Mode**: MUST run AFTER Phase 5 validation complete

### Tasks

#### Task 6.1: Update Version Numbers
**Files**: Multiple
**Action**: Bump version to 3.7.0
**Estimated Time**: 10 minutes
**Can Run in Parallel**: Yes

**Files to update**:
1. `session/plugin.json` → version: "3.7.0"
2. `.claude-plugin/marketplace.json` → version: "3.7.0"
3. `session/package.json` (if exists) → version: "3.7.0"

**Validation**:
- [ ] All version fields updated to 3.7.0

#### Task 6.2: Update CHANGELOG
**File**: `session/CHANGELOG.md`
**Action**: Add v3.7.0 entry
**Estimated Time**: 15 minutes
**Can Run in Parallel**: Yes

```markdown
## [3.7.0] - 2025-11-14

### Added
- **Subagent delegation architecture** for session continue command
- Parallel execution of 3 subagents: consolidation, git refresh, goal extraction
- New module: `cli/lib/subagent-prompts.js` for reusable Task tool prompts
- Minimal summary display for session continue (token optimized)

### Changed
- **BREAKING**: Complete rewrite of `commands/continue.md`
- Conversation log consolidation now runs in isolated subagent context
- Git history refresh runs in parallel with other operations
- Summary display reduced from ~50 lines to ~2 lines

### Performance
- **72% token reduction** in main conversation (77k → 22k tokens)
- **Parallel execution** of heavy operations (2-4s total)
- **Zero file reads** in main conversation context

### Fixed
- N/A (performance optimization release)

### Deprecated
- Old continue.md architecture (backed up as continue.md.v3.6.4.backup)
```

**Validation**:
- [ ] CHANGELOG updated with v3.7.0 entry
- [ ] Breaking changes clearly marked
- [ ] Performance improvements highlighted

#### Task 6.3: Update README
**File**: `session/README.md`
**Action**: Add v3.7.0 release notes
**Estimated Time**: 20 minutes
**Can Run in Parallel**: Yes

Add section:
```markdown
## v3.7.0 - Token Optimization (Latest)

**Major Performance Update!**

This release introduces a groundbreaking architecture change that reduces token usage by 72% when continuing sessions.

### What Changed
- `/session:continue` now uses **parallel subagent delegation**
- 3 subagents run simultaneously in isolated contexts
- Main conversation only orchestrates and shows minimal summary

### Performance Improvements
- **Token usage**: 77k → 22k (72% reduction)
- **Execution**: 2-4 seconds (parallel processing)
- **Summary**: Minimal "Session ready" message

### Technical Details
- Subagent 1: Consolidates conversation logs
- Subagent 2: Refreshes git history
- Subagent 3: Extracts session goal
- All run in parallel, return minimal JSON to main context

### Upgrade Notes
- Architecture change is transparent to users
- UX remains identical (minimal summary by default)
- Use `/session status` for detailed session view
```

**Validation**:
- [ ] README updated with v3.7.0 notes
- [ ] Clear explanation of changes
- [ ] User-facing improvements highlighted

#### Task 6.4: Create Git Commits
**Action**: Commit changes with semantic messages
**Estimated Time**: 15 minutes
**Can Run in Parallel**: No

**Commit Strategy** (2 commits):

**Commit 1: Core implementation**
```bash
git add session/cli/lib/subagent-prompts.js
git add session/commands/continue.md
git add session/commands/continue.md.v3.6.4.backup

git commit -m "feat: Subagent delegation for session continue (v3.7.0)

- Add subagent-prompts.js with 3 reusable Task tool prompts
- Rewrite continue.md to use parallel subagent execution
- Backup old continue.md as v3.6.4.backup

Performance:
- 72% token reduction (77k → 22k in main conversation)
- Parallel execution of consolidation, git refresh, goal extraction
- Minimal summary display

Refs: #token-optimization"
```

**Commit 2: Documentation and version**
```bash
git add session/plugin.json
git add session/CHANGELOG.md
git add session/README.md
git add .claude-plugin/marketplace.json

git commit -m "docs: Release v3.7.0 with token optimization

- Update version to 3.7.0 across all files
- Add comprehensive CHANGELOG entry
- Update README with v3.7.0 release notes
- Sync marketplace.json"
```

**Validation**:
- [ ] 2 semantic commits created
- [ ] All changes committed
- [ ] Clean git status

#### Task 6.5: Tag and Push
**Action**: Create release tag and push to remote
**Estimated Time**: 5 minutes
**Can Run in Parallel**: No

```bash
# Create annotated tag
git tag -a v3.7.0 -m "v3.7.0: Token Optimization Release

Major performance update reducing token usage by 72% through parallel subagent delegation.

- 77k → 22k token reduction in session continue
- Parallel execution (2-4s)
- Minimal summary display
- Breaking: Continue command rewritten"

# Push commits and tag
git push origin feature/token-optimization-v3.7.0
git push origin v3.7.0
```

**Validation**:
- [ ] Tag created with description
- [ ] Commits pushed to remote
- [ ] Tag pushed to remote

#### Task 6.6: Merge to Main
**Action**: Merge feature branch to main
**Estimated Time**: 5 minutes
**Can Run in Parallel**: No

```bash
# Switch to main
git checkout main

# Merge feature branch
git merge feature/token-optimization-v3.7.0 --no-ff -m "Merge feature/token-optimization-v3.7.0

v3.7.0 Token Optimization Release"

# Push main
git push origin main
```

**Validation**:
- [ ] Feature branch merged to main
- [ ] Main branch pushed to remote
- [ ] No merge conflicts

#### Task 6.7: Deploy to Marketplace
**Action**: Sync marketplace.json and announce
**Estimated Time**: 10 minutes
**Can Run in Parallel**: No

```bash
# Verify marketplace.json is synced
cat .claude-plugin/marketplace.json | grep version
# Should show "3.7.0"

# Marketplace auto-syncs from repo
# Verify at: https://marketplace.claude.com/automatewithus-plugins/session
```

**Optional**: Create GitHub release notes at:
`https://github.com/awudevelop/claude-plugins/releases/new`

**Validation**:
- [ ] Marketplace.json synced
- [ ] Version visible in marketplace
- [ ] Release notes published (optional)

---

## Rollback Plan

### If Critical Issues Found

#### Option 1: Revert to v3.6.4 via Git
```bash
# Revert the merge commit
git revert -m 1 <merge-commit-hash>

# Or reset to v3.6.4 tag
git reset --hard v3.6.4
git push origin main --force  # DANGEROUS: Coordinate with team

# Users can rollback via:
claude-code plugin marketplace add automatewithus-plugins/session@3.6.4
```

#### Option 2: Restore Backup continue.md
```bash
# If only continue.md is broken
cp session/commands/continue.md.v3.6.4.backup session/commands/continue.md

git add session/commands/continue.md
git commit -m "hotfix: Restore v3.6.4 continue.md"
git push

# Bump to v3.6.5 with restored file
```

#### Option 3: Quick Fix Forward
```bash
# If issue is minor (e.g., typo in prompt)
# Fix the issue in place
# Bump to v3.7.1 patch release
```

### Validation After Rollback
- [ ] Token usage returns to expected levels
- [ ] Session continue works correctly
- [ ] No data loss
- [ ] Users notified of issue

---

## Appendix A: Parallel Task Execution Primer

### How to Run Tasks in Parallel

**✅ CORRECT - Parallel Execution**:
```xml
<function_calls>
<invoke name="Task">
  <parameter name="description">Task 1</parameter>
  <parameter name="prompt">Do task 1</parameter>
</invoke>
<invoke name="Task">
  <parameter name="description">Task 2</parameter>
  <parameter name="prompt">Do task 2</parameter>
</invoke>
<invoke name="Task">
  <parameter name="description">Task 3</parameter>
  <parameter name="prompt">Do task 3</parameter>
</invoke>
</function_calls>
```
All 3 tasks execute simultaneously, results returned when all complete.

**❌ WRONG - Sequential Execution**:
```xml
<!-- Message 1 -->
<function_calls>
<invoke name="Task">
  <parameter name="description">Task 1</parameter>
  <parameter name="prompt">Do task 1</parameter>
</invoke>
</function_calls>

<!-- Message 2 (after Task 1 completes) -->
<function_calls>
<invoke name="Task">
  <parameter name="description">Task 2</parameter>
  <parameter name="prompt">Do task 2</parameter>
</invoke>
</function_calls>
```
Tasks run one after another, not in parallel.

### Key Points
1. **Single message = Parallel**
2. **Multiple messages = Sequential**
3. Use parallel when tasks are independent
4. Use sequential when task 2 depends on task 1 output

---

## Appendix B: Task Tool Parameter Reference

### Complete Parameter List

Based on Claude Code documentation (as of 2024-11):

```xml
<invoke name="Task">
  <!-- REQUIRED PARAMETERS -->
  <parameter name="subagent_type">
    Options: general-purpose | Explore | Plan

    Use general-purpose for:
    - Multi-step tasks
    - File operations (Read, Write, Edit)
    - Analysis and synthesis
    - CLI command execution

    Recommended for all 3 session subagents.
  </parameter>

  <parameter name="description">
    Short 3-5 word description of task

    Examples:
    - "Consolidate conversation log"
    - "Refresh git history"
    - "Extract session goal"

    Shown to user during execution.
  </parameter>

  <parameter name="prompt">
    Detailed instructions for subagent

    Best practices:
    - Start with "Goal: [one sentence]"
    - List specific steps (numbered)
    - Include exact commands/file paths
    - Specify return format (JSON preferred)
    - Handle errors gracefully

    Can be multi-line markdown.
  </parameter>

  <!-- OPTIONAL PARAMETERS -->
  <parameter name="model">
    Options: sonnet | opus | haiku

    Default: inherit from parent

    Recommendations:
    - haiku: Fast, cheap tasks (goal extraction)
    - sonnet: Complex analysis (consolidation)
    - opus: Advanced reasoning (not needed for our use case)

    For token optimization, use haiku when possible.
  </parameter>
</invoke>
```

### Parameter Decision Matrix

| Subagent | subagent_type | model | Rationale |
|----------|---------------|-------|-----------|
| Consolidation | general-purpose | haiku | Fast analysis, structured output |
| Git Refresh | general-purpose | haiku | CLI execution, minimal logic |
| Goal Extract | general-purpose | haiku | Simple text extraction |

**Why haiku for all?**
- Consolidation: Template-driven analysis, clear structure → haiku sufficient
- Git: Just runs CLI command → haiku overkill but safe
- Goal: Simple text extraction → haiku perfect

**Cost savings**: haiku ~10x cheaper than sonnet, 3-5x faster

---

## Appendix C: Multi-Session Execution Schedule

### Recommended Schedule (3-5 sessions)

#### Session 1: Foundation (1-2 hours)
**Phase**: Pre-implementation + Phase 1
- [ ] Create feature branch
- [ ] Review Task tool documentation
- [ ] Create `subagent-prompts.js` (Task 1.1)
- [ ] Test prompts in Node REPL (Task 5.1)

**Deliverable**: Working subagent-prompts.js module

---

#### Session 2: Validation (1 hour)
**Phase**: Phase 2 + Phase 3
- [ ] Test git capture CLI (Task 2.1)
- [ ] Document git output format (Task 2.2)
- [ ] Test goal extraction (Task 3.1)
- [ ] Make CLI decision (Task 3.2)

**Deliverable**: Validated CLI commands, goal extraction method

---

#### Session 3: Implementation (2-3 hours)
**Phase**: Phase 4
- [ ] Backup continue.md (Task 4.1)
- [ ] Write new continue.md (Task 4.2)
- [ ] Add edge case handling (Task 4.3)

**Deliverable**: New continue.md with subagent architecture

---

#### Session 4: Testing (2-3 hours)
**Phase**: Phase 5
- [ ] Test each subagent individually (Tasks 5.2-5.4)
- [ ] Run all 4 test scenarios (Task 5.5)
- [ ] Benchmark performance (Task 5.6)

**Deliverable**: Validated working implementation, performance metrics

---

#### Session 5: Deployment (1-2 hours)
**Phase**: Phase 6
- [ ] Update versions (Task 6.1)
- [ ] Update docs (Tasks 6.2-6.3)
- [ ] Create commits (Task 6.4)
- [ ] Tag and push (Tasks 6.5-6.6)
- [ ] Deploy to marketplace (Task 6.7)

**Deliverable**: v3.7.0 released and live

---

### Alternative: Rapid Execution (1-2 sessions)

If you want to move faster:

**Session 1: Build (3-4 hours)**
- Phases 1-4 all at once
- Create prompts + new continue.md
- Skip some validation steps

**Session 2: Test & Deploy (2-3 hours)**
- Phase 5 testing (abbreviated)
- Phase 6 deployment

**Risk**: Less validation, higher chance of issues

---

## Appendix D: Success Criteria

### How to Know You're Done

#### Phase 1 Success
- ✅ `subagent-prompts.js` exists with 3 functions
- ✅ Can import and call each function
- ✅ Generated prompts are valid strings
- ✅ Prompts follow Task tool format

#### Phase 2 Success
- ✅ `capture-git` CLI command works
- ✅ Returns structured JSON
- ✅ git-history.json file created
- ✅ Documentation updated

#### Phase 3 Success
- ✅ Can extract goal from session.md
- ✅ Decision made (CLI vs subagent)
- ✅ Method validated with test

#### Phase 4 Success
- ✅ New continue.md complete
- ✅ Backup of old continue.md saved
- ✅ Uses 3 Task tool invocations
- ✅ Minimal summary format
- ✅ Error handling present

#### Phase 5 Success
- ✅ All 4 test scenarios pass
- ✅ Token usage <25k (main conversation)
- ✅ Subagents run in parallel (observe timing)
- ✅ No functionality regressions
- ✅ Performance metrics captured

#### Phase 6 Success
- ✅ Version 3.7.0 in all files
- ✅ CHANGELOG and README updated
- ✅ 2 commits created
- ✅ Tag v3.7.0 pushed
- ✅ Merged to main
- ✅ Marketplace shows v3.7.0

---

## Appendix E: Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Task tool not found
**Symptom**: Error when invoking `<invoke name="Task">`
**Solution**:
- Verify Claude Code version supports Task tool
- Check system prompt for Task tool definition
- Ensure using latest Claude Code

#### Issue: Subagent returns error
**Symptom**: `{ success: false, error: "..." }`
**Solution**:
- Check subagent prompt for clarity
- Verify file paths are correct
- Check CLI commands are valid
- Review subagent execution logs

#### Issue: Parallel execution not working
**Symptom**: Subagents run sequentially, not in parallel
**Solution**:
- Ensure all 3 `<invoke name="Task">` in SINGLE message
- Don't separate with text between invocations
- Check continue.md structure

#### Issue: Token usage still high
**Symptom**: Main conversation >30k tokens
**Solution**:
- Verify subagents running (check for Task invocations)
- Check if file reads happening in main (shouldn't be)
- Verify minimal summary (not comprehensive)
- Check for debugging/verbose output

#### Issue: Subagent prompt template not found
**Symptom**: Cannot require `subagent-prompts.js`
**Solution**:
- Check file exists at correct path
- Verify module.exports syntax
- Use absolute path in require()
- Check Node.js can find module

---

## Appendix F: Quick Reference

### Files Modified Summary

| File | Action | Phase |
|------|--------|-------|
| `session/cli/lib/subagent-prompts.js` | CREATE | Phase 1 |
| `session/commands/continue.md` | REWRITE | Phase 4 |
| `session/commands/continue.md.v3.6.4.backup` | CREATE | Phase 4 |
| `session/plugin.json` | EDIT (version) | Phase 6 |
| `session/CHANGELOG.md` | EDIT (add v3.7.0) | Phase 6 |
| `session/README.md` | EDIT (add v3.7.0) | Phase 6 |
| `.claude-plugin/marketplace.json` | EDIT (version) | Phase 6 |

### CLI Commands Quick Reference

```bash
# Validate session
node cli/session-cli.js get {name}

# Capture git history
node cli/session-cli.js capture-git {name}

# Activate session
node cli/session-cli.js activate {name}

# Write snapshot (from stdin)
echo "content" | node cli/session-cli.js write-snapshot {name} --stdin --type auto

# Update state
node cli/session-cli.js update-state {name} --reset-counters
```

### Token Usage Targets

| Component | Current (v3.6.4) | Target (v3.7.0) | Status |
|-----------|------------------|-----------------|--------|
| Main conversation | 77k | 22k | ✅ 72% reduction |
| Subagent 1 (consolidation) | N/A | 15k (isolated) | ✅ Not counted |
| Subagent 2 (git) | N/A | 10k (isolated) | ✅ Not counted |
| Subagent 3 (goal) | N/A | 5k (isolated) | ✅ Not counted |
| **Total visible to user** | **77k** | **22k** | **✅ Success** |

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-14 | Initial implementation plan created |

---

## Sign-off Checklist

Before considering implementation complete:

- [ ] All 6 phases completed
- [ ] All validation checkboxes checked
- [ ] Token usage <25k verified
- [ ] Performance benchmarks captured
- [ ] Documentation updated
- [ ] Tests passing
- [ ] Commits created and pushed
- [ ] Tag created
- [ ] Merged to main
- [ ] Marketplace updated
- [ ] Rollback plan understood

**Implementation Lead**: _______________ Date: _______________

**Reviewer**: _______________ Date: _______________

---

**END OF IMPLEMENTATION PLAN**
