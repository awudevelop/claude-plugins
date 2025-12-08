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

## Step 2.5: Validate Spec Completeness (BLOCKING)

**CRITICAL:** Before executing ANY task, validate that specs are complete. Incomplete specs lead to implementation deviations.

For each task in the plan, validate its spec against the required schema:

### For `create_class` tasks:
```json
// REQUIRED structure (not just method names!)
"spec": {
  "class": "string (required)",
  "exported": "boolean (required)",
  "purpose": "string (required)",
  "constructor": { "params": ["string[]"], "does": "string" },  // REQUIRED
  "methods": [
    {
      "name": "string (required)",
      "params": ["string[] (required)"],
      "returns": "string (required)",
      "does": "string (required)",
      "static": "boolean (default: false)",
      "async": "boolean (default: false)"
    }
  ]
}
```

**INVALID (will cause deviations):**
```json
"methods": ["compareMetadata", "compareDependencies"]  // ❌ Just names!
```

**VALID:**
```json
"methods": [
  { "name": "compareMetadata", "params": ["oldMap: object", "newMap: object"], "returns": "DiffResult", "does": "Compare metadata maps" }
]
```

### For `create_function` tasks:
```json
"spec": {
  "function": "string (required)",
  "async": "boolean (required)",
  "exported": "boolean (required)",
  "params": ["string[] (required) - with types"],
  "returns": "string (required)",
  "does": "string (required)"
}
```

### Validation Check

Before showing execution overview, check each task's spec:

```
Validating spec completeness...

❌ task-1-1: INCOMPLETE SPEC
   Type: create_class
   Issue: 'methods' is array of strings, should be array of objects with name/params/returns

❌ task-2-2: INCOMPLETE SPEC
   Type: create_function
   Issue: Missing 'params' field

⚠️ 2 tasks have incomplete specs

Incomplete specs cause agents to make autonomous decisions about:
- Method parameters and return types
- Static vs instance methods
- What to export

Options:
  [F] Fix specs now (re-run plan-finalize with stricter prompt)
  [C] Continue anyway (accept potential deviations)
  [A] Abort execution
```

Use AskUserQuestion to get user decision. If user chooses Continue, log warning but proceed.

**DO NOT silently proceed with incomplete specs.**

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

### 5d.5: Post-Generation Verification (MANDATORY)

**CRITICAL:** After writing files, you MUST verify the generated code matches the spec.

**DO NOT trust agent reports blindly. READ the actual file.**

```
1. READ the generated file using Read tool
2. EXTRACT actual structure:
   - For classes: class name, method names, method signatures, exports
   - For functions: function name, params, return type, export status
3. COMPARE against spec
4. REPORT mismatches
```

**Verification Checklist:**

For `create_class`:
```
□ Class name matches spec.class
□ Exported matches spec.exported
□ All methods in spec exist in code
□ Method signatures match (params, returns, static/async)
□ No unexpected exports (methods not in spec but exported)
```

For `create_function`:
```
□ Function name matches spec.function
□ Exported matches spec.exported
□ Async matches spec.async
□ Parameters match spec.params (count and types)
□ Return type matches spec.returns
```

**If Mismatch Found:**

```
⚠️ POST-GENERATION MISMATCH: task-{id}

Spec says:
  method: compareMetadata(oldMap: object, newMap: object) → DiffResult
  static: false

Code has:
  method: static compareMetadata(oldMap, newMap) → object
  static: true  ❌ MISMATCH

Deviations:
  1. Method is static but spec says instance method
  2. Return type is 'object' but spec says 'DiffResult'

Options:
  [F] Fix now (regenerate with explicit correction)
  [A] Accept deviation (document in task result)
  [S] Skip task
```

Use AskUserQuestion for user decision. **DO NOT auto-accept deviations.**

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
```

---

## Step 9: Auto-Review (Spec Validation)

**IMPORTANT:** This step runs AUTOMATICALLY after all tasks complete.

After execution completes, validate all completed tasks against their specifications:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-review {plan_name}
```

This returns JSON with review results:
```json
{
  "success": true,
  "data": {
    "tasksReviewed": 5,
    "findings": [...],
    "summary": {
      "totalErrors": 2,
      "totalWarnings": 3,
      "pass": false
    },
    "pass": false
  }
}
```

### Display Review Results

**If review PASSED (0 errors):**

```
───────────────────────────────────────
📋 SPEC REVIEW: PASSED
───────────────────────────────────────

Tasks Reviewed: {tasksReviewed}
Errors: 0
Warnings: {totalWarnings}

{if totalWarnings > 0}
Warnings (non-blocking):
{for each warning}
  ⚠️ [{task_id}] {description}
     {location.file}:{location.line}
{endfor}
{endif}

✓ All implementations match their specifications.
```

**If review FAILED (errors found):**

```
───────────────────────────────────────
📋 SPEC REVIEW: FAILED
───────────────────────────────────────

Tasks Reviewed: {tasksReviewed}
Errors: {totalErrors}
Warnings: {totalWarnings}

ERRORS (must fix):
{for each error finding}
  ❌ [{task_id}] {type}: {description}
     File: {location.file}:{location.line}
     Expected: {expected}
     Actual: {actual}
     Fix: {suggestion}
{endfor}

{if totalWarnings > 0}
Warnings:
{for each warning finding}
  ⚠️ [{task_id}] {description}
{endfor}
{endif}

───────────────────────────────────────

⚠️  BLOCKING: Implementation has spec violations!

Errors MUST be resolved before execution can complete.

Options:
  [F] Fix errors now - Re-run affected tasks with corrections
  [C] Continue anyway - Accept deviations (REQUIRES explicit acknowledgment)
  [A] Abort execution - Stop and fix manually
```

**CRITICAL:** Use AskUserQuestion to get user decision. DO NOT auto-continue.

```javascript
// Hard gate - require explicit user choice
const decision = await askUserQuestion({
  question: "Review found spec violations. How to proceed?",
  header: "Review Failed",
  options: [
    { label: "Fix errors", description: "Re-generate affected tasks with explicit corrections" },
    { label: "Continue anyway", description: "Accept deviations and mark execution complete" },
    { label: "Abort", description: "Stop execution, fix manually" }
  ]
});

if (decision === "Fix errors") {
  // Re-run affected tasks with error context
  for (const finding of errorFindings) {
    await regenerateTask(finding.taskId, finding);
  }
  // Re-run review after fixes
  await runReview(planName);
} else if (decision === "Continue anyway") {
  // Log explicit override
  console.log("⚠️ User accepted spec deviations. Proceeding to final summary.");
  // Continue to Step 10
} else {
  // Abort - do not proceed to Step 10
  console.log("Execution aborted. Fix errors manually and re-run:");
  console.log(`  /session:plan-execute ${planName}`);
  return; // EXIT - do not show final summary
}
```

### Review Finding Types

| Type | Severity | Meaning |
|------|----------|---------|
| `missing_implementation` | error | Function in spec not found in code |
| `signature_mismatch` | error | Params/async/export don't match spec |
| `unspecified_addition` | error | Exported function not in spec |
| `unspecified_addition` | warning | Internal helper not in spec |

---

## Step 10: Final Summary

After review completes, show final status:

```
───────────────────────────────────────
EXECUTION COMPLETE: {plan_name}
───────────────────────────────────────

Execution:
  ✓ Completed: {completed} tasks
  ⏭️ Skipped: {skipped} tasks
  ❌ Failed: {failed} tasks

Spec Review: {PASSED|FAILED}
  Errors: {totalErrors}
  Warnings: {totalWarnings}

{if review passed}
✓ Ready for commit and deployment!

Next Steps:
  1. Run full test suite: npm test
  2. Commit changes: git add . && git commit
  3. Use /session:save to capture milestone
{else}
⚠️ Fix spec violations before committing.

Next Steps:
  1. Fix errors listed above
  2. Re-run review: /session:plan-review {plan_name}
  3. Then commit when review passes
{endif}

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
