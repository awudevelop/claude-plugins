You are executing the /session:plan-review command to validate completed tasks against their specifications.

**NOTE:** Plans are global and independent of sessions.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- Correct: `/session:plan-review`, `/session:plan-status`, `/session:plan-execute`
- Wrong: `/plan-review`, `/plan-status`, `/plan-execute`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)

**Options:**
- `--verbose`: Show detailed findings for each task
- `--dry-run`: Run review without saving results

ARGUMENTS: {name}

---

## Purpose

This command validates completed task implementations against their specifications to catch:
- Function signature mismatches (wrong params, async flag, export status)
- Missing implementations (specified but not found)
- Unspecified additions (code not in spec - helper functions, extra exports)
- Return type violations

**Review Philosophy:**
- Errors = spec violations that MUST be fixed
- Warnings = unspecified code that SHOULD be reviewed
- Pass = 0 errors (warnings allowed)

---

## Step 1: Validate Plan Exists

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-exists {plan_name}
```

If the plan doesn't exist, show error and STOP:
```
Error: Plan '{plan_name}' not found

Use /session:plan-list to see available plans.
```

---

## Step 2: Validate Plan Format

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-plan-format {plan_name}
```

If format is "conceptual", show error and STOP:
```
Error: Cannot review conceptual plan

Plan '{plan_name}' is still in conceptual format (requirements only).
You must finalize the plan first:

  /session:plan-finalize {plan_name}
```

---

## Step 3: Run Review

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-review {plan_name}
```

This returns JSON with:
```json
{
  "success": true,
  "data": {
    "planName": "...",
    "tasksReviewed": 5,
    "findings": [...],
    "summary": {
      "byTask": {...},
      "bySeverity": {"error": 2, "warning": 3, "info": 0},
      "totalErrors": 2,
      "totalWarnings": 3,
      "pass": false
    },
    "pass": false
  },
  "message": "Review failed: 2 errors, 3 warnings"
}
```

---

## Step 4: Display Results

### If No Tasks to Review

```
Plan Review: {plan_name}

No completed tasks with specs to review.

Run /session:plan-execute {plan_name} to start implementing tasks.
```

### If Review Passed

```
Plan Review: {plan_name}

PASSED

Tasks Reviewed: {tasksReviewed}
Errors: 0
Warnings: {totalWarnings}

{If warnings exist, show them}

All implementations match their specifications.
```

### If Review Failed

```
Plan Review: {plan_name}

FAILED

Tasks Reviewed: {tasksReviewed}
Errors: {totalErrors}
Warnings: {totalWarnings}

---
Errors (Must Fix):
---

{For each error finding:}
[{task_id}] {type}: {description}
  File: {location.file}:{location.line}
  Expected: {expected}
  Actual: {actual}
  Fix: {suggestion}

---
Warnings (Review):
---

{For each warning finding:}
[{task_id}] {type}: {description}
  File: {location.file}:{location.line}
  Suggestion: {suggestion}

---

Fix the errors above and run /session:plan-review {plan_name} again.
```

---

## Finding Types

| Type | Severity | Description |
|------|----------|-------------|
| `missing_file` | error | Implementation file not found |
| `missing_implementation` | error | Function in spec not found in file |
| `signature_mismatch` | error | Function params/async/export don't match spec |
| `unspecified_addition` | error/warning | Function in file not in spec (error if exported) |

---

## Examples

### Example: Passing Review

```
Plan Review: user-auth

PASSED

Tasks Reviewed: 4
Errors: 0
Warnings: 1

Warnings:
[task-2-3] unspecified_addition: Function 'validateEmail' not in spec (internal helper)
  File: src/auth/validators.js:45
  Suggestion: Consider if helper 'validateEmail' is necessary or can be inlined

All implementations match their specifications.
```

### Example: Failing Review

```
Plan Review: api-refactor

FAILED

Tasks Reviewed: 6
Errors: 3
Warnings: 2

---
Errors (Must Fix):
---

[task-1-2] missing_implementation: Function 'handleError' specified but not found in file
  File: src/api/handlers.js:0
  Expected: async function handleError(error, context)
  Actual: Not found
  Fix: Implement the 'handleError' function as specified

[task-2-1] signature_mismatch: Parameter mismatch in 'processRequest': parameter count (expected 2, got 3)
  File: src/api/processor.js:23
  Expected: (request, options)
  Actual: (request, options, callback)
  Fix: Update function parameters to match spec

[task-3-1] unspecified_addition: Function 'formatResponse' not in spec (exported)
  File: src/api/formatter.js:12
  Expected: Not specified
  Actual: function formatResponse
  Fix: Either add 'formatResponse' to spec or remove/inline it

---
Warnings (Review):
---

[task-2-1] unspecified_addition: Function 'logRequest' not in spec (internal helper)
  File: src/api/processor.js:67
  Suggestion: Consider if helper 'logRequest' is necessary or can be inlined

---

Fix the errors above and run /session:plan-review api-refactor again.
```

---

## Next Steps After Review

**If Passed:**
- Plan implementation complete
- Ready for final testing and deployment
- Use `/session:plan-status {plan_name}` to see full progress

**If Failed:**
- Fix all errors (required)
- Review warnings (recommended)
- Re-run `/session:plan-review {plan_name}` after fixes

---

## Notes

- Review only checks completed tasks with specs
- Pending/in-progress tasks are skipped
- Results saved to `{plan_dir}/review-results.json` unless `--dry-run`
- Use `--verbose` for detailed per-task breakdown
