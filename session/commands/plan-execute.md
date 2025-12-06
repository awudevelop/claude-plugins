You are executing the /session:plan-execute command to execute a finalized plan.

**NOTE:** Plans are global and independent of sessions.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)

**Options:**
- `--docs <url|path>`: Add documentation for execution (can use multiple times)
- `--parallel <n>`: Max parallel tasks (default: 1)
- `--skip-low-confidence`: Skip tasks with confidence < 40
- `--review-mode`: Pause after each task for review
- `--dry-run`: Show what would be done, don't execute
- `--auto`: No confirmations (for CI/automation)

ARGUMENTS: {name}

---

## Step 1: Validate Plan Exists

Plans are stored globally in `.claude/plans/`. Check if the plan exists:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-exists {plan_name}
```

If the plan doesn't exist, show error and STOP:
```
❌ Error: Plan '{plan_name}' not found

Use /session:plan-save {name} to create a plan first.
Use /session:plan-list to see available plans.
```

---

## Step 2: Validate Plan Format

Before executing, verify the plan is in implementation format (not conceptual):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-plan-format {plan_name}
```

This returns JSON with `format: "conceptual"` or `format: "implementation"`.

If the format is "conceptual", show this error and STOP:
```
❌ Error: Cannot execute conceptual plan

Plan '{plan_name}' is still in conceptual format (requirements only).

You must finalize the plan first:

  /session:plan-finalize {plan_name}

This will transform requirements into executable tasks with lean specs.
```

If the format is "implementation", continue to next step.

---

## Step 3: Load Plan & Execution Context

Load the orchestration file and all phase files:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {plan_name}
```

Also load:
1. **Project-maps** (if available) for code generation context:
   - function-signatures.json (patterns to follow)
   - types-map.json (existing types)
   - dependencies-forward.json (import patterns)
   - tree.json (project structure)

2. **External docs** (if --docs provided):
   - Fetch URLs or read local files
   - Parse markdown sections
   - Store for task-level context

---

## Step 4: Show Execution Overview

Display a summary of what will be executed:

```
📋 Plan: {plan_name}
Goal: {goal}

Progress: {completed_tasks}/{total_tasks} tasks ({percentage}%)
Status: {status}

Confidence Summary:
  🟢 High (70+):    {high_count} tasks
  🟡 Medium (40-69): {medium_count} tasks
  🔴 Low (<40):      {low_count} tasks {⚠️ if any}

Phases:
  1. [✓] Phase 1: {name} (completed)
  2. [→] Phase 2: {name} (in progress)
  3. [ ] Phase 3: {name} (pending)

Current Phase: {current_phase_name}
Next Task: {next_task_id} - {next_task_description}

{if --dry-run}
🔍 DRY RUN - No changes will be made
{endif}

Ready to execute?
```

---

## Step 5: Task Execution Loop

For each pending task in execution order (respecting dependencies):

### 5a. Pre-Execution Check

```javascript
if (task.confidence.level === 'low') {
  if (options.skipLowConfidence) {
    // Mark task as 'skipped' and continue
    updateTaskStatus(task.id, 'skipped', { reason: 'Low confidence' });
    continue;
  } else {
    // Show warning, ask for confirmation
    showLowConfidenceWarning(task);
    if (!options.auto && !userConfirms()) {
      skipTask(task);
      continue;
    }
  }
}
```

### 5b. Load Task Context

1. **Read task spec** from phase file
2. **Read referenced files** (patterns field in spec)
3. **Load relevant docs** from task.docs array
4. **Query project-maps** for current codebase state

### 5c. Generate Implementation

Spawn code generation agent with context:

```
TASK SPEC:
{task.spec as JSON}

REFERENCE FILES:
{content of files listed in spec.patterns}

DOCUMENTATION:
{relevant sections from --docs}

PROJECT PATTERNS:
{similar functions from project-maps}
{import patterns from project}

Generate complete, working code following the spec exactly.
```

The agent returns:
```json
{
  "main_file": {
    "path": "src/auth/methods.ts",
    "content": "// Full implementation"
  },
  "auxiliary_files": [
    { "path": "src/types/auth.ts", "content": "..." },
    { "path": "src/auth/__tests__/methods.test.ts", "content": "..." }
  ],
  "notes": ["Created AuthError class", "Used existing supabase client"],
  "uncertainties": [
    { "location": "line 45", "issue": "Assumed error format", "confidence": "medium" }
  ]
}
```

### 5d. Write Files

If NOT --dry-run:
1. Create directories if needed
2. Write main file
3. Write auxiliary files (types, tests)
4. Track all created/modified files

### 5e. Verify

Run verification checks:

```bash
# TypeScript check (if applicable)
npx tsc --noEmit {file}

# ESLint (if configured)
npx eslint {file}

# Run tests (if created)
npx jest {test_file} --passWithNoTests
```

### 5f. Verify JSDoc Documentation

Check generated code has proper documentation:

```javascript
const docResult = await verifyDocumentation(filePath, content);
if (!docResult.valid) {
  // Show issues but don't fail (warning only)
  showDocumentationWarnings(docResult.issues);
}
```

Required JSDoc elements:
- `@param` for all function parameters
- `@returns` for non-void returns
- `@example` at least one per function (warning if missing)
- `@category` for module organization (warning if missing)

### 5g. Report Result

```json
{
  "task_id": "task-2-1",
  "status": "completed|failed|skipped",
  "files_created": ["src/auth/methods.ts"],
  "files_modified": [],
  "verification": {
    "typecheck": "passed",
    "lint": "passed",
    "tests": "3 passed",
    "documentation": { "valid": true, "warnings": 1 }
  },
  "warnings": [],
  "duration_ms": 1234
}
```

Update task status:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-task-status {plan_name} {task_id} completed
```

---

## Step 6: Handle Low-Confidence Tasks

For tasks with `review.required = true` after completion:

```
⚠️  LOW CONFIDENCE TASK COMPLETED

Task: {task_id} - {description}
File: {file_path}
Confidence: {score} ({level})

Risks identified:
  - {risk_1}
  - {risk_2}

Generated code may need review:
  - Lines {start}-{end}: {concern}

[A] Accept and continue
[R] Review file now (opens in editor)
[E] Edit and re-verify
[S] Skip and mark manual
```

If `--review-mode` is enabled, always pause here.
If `--auto` is enabled, auto-accept and continue.

---

## Step 7: Parallel Execution (if --parallel > 1)

When parallel execution is enabled:

1. **Identify independent tasks** (no shared dependencies)
2. **Group into batches** of size --parallel
3. **Execute batch concurrently**
4. **Wait for all tasks in batch**
5. **Aggregate results**
6. **Continue to next batch**

```
Parallel Execution: batch 1/3
  ├─ task-2-1: Creating auth/methods.ts... ✓
  ├─ task-2-2: Creating auth/types.ts... ✓
  └─ task-2-3: Creating auth/errors.ts... ✓

Batch completed in 2.3s (3 tasks)
```

---

## Step 8: Completion Summary

When all tasks are completed (or --dry-run finishes):

```
{if --dry-run}
🔍 DRY RUN COMPLETE - No changes were made
{else}
✓ Plan Execution Complete: {plan_name}
{endif}

Results:
  ✓ Completed: {completed} tasks
  ⚠️ Review needed: {review_needed} tasks
  ⏭️ Skipped: {skipped} tasks
  ❌ Failed: {failed} tasks

Files Created: {files_created}
Files Modified: {files_modified}
Tests Generated: {tests_generated}
Tests Passing: {tests_passing}

{if review_needed > 0}
Low-Confidence Tasks (review recommended):
  - {file_path} ({task_id})
  - {file_path} ({task_id})
{endif}

{if failed > 0}
Failed Tasks:
  - {task_id}: {error_message}
{endif}

Documentation Quality:
  - Functions with full JSDoc: {percent}%
  - Missing @example: {count}
  - Missing @category: {count}

Next Steps:
  1. Review flagged files
  2. Run full test suite: npm test
  3. Commit changes: git add . && git commit
  4. Use /session:save to capture milestone

Use /session:plan-status {plan_name} to see detailed status.
```

---

## Error Handling

### Task Execution Failure

If a task fails during execution:

```
❌ Task Failed: {task_id}

Error: {error_message}

Options:
  [R] Retry task
  [S] Skip and continue
  [A] Abort execution
  [D] Debug (show full error)
```

If `--auto` mode, automatically skip failed tasks and continue.

### Verification Failure

If typecheck/lint/tests fail:

```
⚠️ Verification Failed: {task_id}

TypeScript Errors:
  {file}:{line}: {error}

Options:
  [F] Fix and retry (re-generate with error context)
  [A] Accept anyway (mark as needing review)
  [S] Skip task
```

### Dependency Not Met

If a task's dependency hasn't completed:

```
⏸️ Task Blocked: {task_id}

Waiting for dependencies:
  - {dep_task_id}: {status}

The task will execute automatically when dependencies complete.
```

---

## Notes

- Code generation uses lean specs (not full code) from plan-finalize
- Project-maps provide codebase context for accurate generation
- JSDoc documentation is mandatory for all generated functions
- Low-confidence tasks are flagged but can still execute
- Parallel execution only groups truly independent tasks
- All generated code is verified before marking complete

---

## Future Enhancements

- [ ] Agent orchestration for complex tasks
- [ ] Auto-fix for common verification failures
- [ ] Smart retry with error context
- [ ] Integration with CI/CD pipelines
- [ ] Token budget enforcement per phase
