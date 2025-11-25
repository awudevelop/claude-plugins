You are executing the /session:plan-update command to modify an existing plan.

**NOTE:** Plans are now global and independent of sessions.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required - the plan to update)
- `update_request`: {request} (optional - natural language description of changes)

ARGUMENTS: {name} {request}

## Workflow

### Step 1: Validate Plan Exists

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-exists {plan_name}
```

If the plan doesn't exist, show error and STOP:
```
❌ Error: Plan '{plan_name}' not found

Use /session:plan-list to see available plans.
Use /session:plan-save {name} to create a new plan.
```

### Step 2: Load Current Plan State

Get the current plan state for preview generation:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {plan_name}
```

This returns JSON with plan metadata, phases, tasks, and execution state.

### Step 3: Parse Update Request

If `update_request` is provided, parse it into structured operations.

**Common Update Patterns:**

| Natural Language | Operation |
|-----------------|-----------|
| "add a new task to phase X" | `{ type: 'add', target: 'task', data: {...} }` |
| "remove task-2-3" | `{ type: 'delete', target: 'task', data: { id: 'task-2-3' } }` |
| "rename phase 1 to 'Setup'" | `{ type: 'update', target: 'phase', data: { id: 'phase-1', name: 'Setup' } }` |
| "mark task-1-1 as completed" | `{ type: 'update', target: 'task', data: { id: 'task-1-1', status: 'completed' } }` |
| "add a new phase called Testing" | `{ type: 'add', target: 'phase', data: { name: 'Testing' } }` |

If no `update_request` is provided, prompt the user:
```
What changes would you like to make to plan '{plan_name}'?

Examples:
  - "add a new task 'Write unit tests' to phase 2"
  - "remove the documentation phase"
  - "rename task-3-1 to 'API integration'"
  - "mark phase 1 as completed"

Enter your update request:
```

### Step 4: Check Execution State

Determine if the plan is being executed:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-execution-state {plan_name}
```

**If plan has started execution:**

Show mode selection:
```
⚠️  Plan '{plan_name}' is currently being executed.

Progress: {completed}/{total} tasks ({percentage}%)
Completed phases: {completed_phases}
Current phase: {current_phase}

How would you like to proceed?

1. [selective] Apply changes to pending tasks only (recommended)
   - Completed work is preserved
   - Only pending tasks/phases can be modified
   - May need --force for some operations

2. [rollback] Reset and replan (full update)
   - All progress will be reset to pending
   - Execution history is preserved in logs
   - Start fresh with updated plan

3. [cancel] Cancel update

Choice [1/2/3]:
```

### Step 5: Generate Preview

Show what changes will be made:

```
╔══════════════════════╗
║  Plan Update Preview ║
╚══════════════════════╝

Plan: {plan_name}
Mode: {selective|rollback}

─── Summary ────────────────────────────────────────────
  Operations: {count}
    + Additions: {add_count}
    ~ Updates: {update_count}
    - Deletions: {delete_count}

─── Operations ─────────────────────────────────────────
  + [1] ADD task: "Write unit tests"
        Phase: phase-2-implementation
        Description: Create comprehensive test suite

  ~ [2] UPDATE task: task-3-1
        description: "API endpoints" → "API integration"

  - [3] DELETE phase: phase-4-documentation
        ⚠ Contains 3 tasks that will also be deleted

─── Warnings ───────────────────────────────────────────
  ⚠  Deleting phase with completed tasks - use --force
  ⚠  Some operations affect completed work

─── Safety Notices ─────────────────────────────────────
  ⚠ DESTRUCTIVE: This update includes 1 deletion(s)
```

### Step 6: Confirm with User

```
Apply these changes? [+1 ~1 -1]
  [y] Yes, apply changes
  [n] No, cancel
  [e] Edit operations
  [?] Show help

Choice:
```

**If user chooses 'e' (edit):**
```
--- Edit Mode ---
Operations:
  [1] ADD task: "Write unit tests"
  [2] UPDATE task: task-3-1
  [3] DELETE phase: phase-4-documentation

Commands:
  remove <n>  - Remove operation #n
  done        - Finish editing and confirm
  cancel      - Cancel all changes

Edit>
```

### Step 7: Execute Update

Based on mode selection:

**For selective mode:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-update-selective {plan_name} --operations '{operations_json}'
```

**For rollback mode:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-update-rollback {plan_name} --operations '{operations_json}'
```

### Step 8: Report Results

**Success:**
```
✅ Plan Updated Successfully

Plan: {plan_name}
Mode: {mode}

Changes Applied:
  + Added 1 task
  ~ Updated 1 task
  - Deleted 1 phase (3 tasks removed)

Updated Progress: {new_completed}/{new_total} tasks

Next Steps:
  /session:plan-status {plan_name} - View updated plan
  /session:plan-execute {plan_name} - Continue execution
```

**Partial Success (selective mode):**
```
⚠️ Plan Partially Updated

Applied: 2 operations
Skipped: 1 operation (affects completed work)

Skipped Operations:
  - DELETE phase: phase-1-setup (completed, requires --force)

To apply skipped operations, use:
  /session:plan-update {plan_name} --force
```

**Failure:**
```
❌ Update Failed

Error: {error_message}

Details:
  - Operation 3 failed: {reason}
  - Validation error: {details}

Recovery:
  - Backup created at: .claude/plans/{plan_name}/.backups/backup-{timestamp}
  - To restore: /session:plan-restore {plan_name} {backup_name}
```

---

## Quick Update Examples

### Add a Task
```
/session:plan-update my-plan add a new task "Implement caching" to phase-2
```

### Remove a Task
```
/session:plan-update my-plan remove task-3-2
```

### Rename a Phase
```
/session:plan-update my-plan rename phase-1 to "Infrastructure Setup"
```

### Mark Task Complete
```
/session:plan-update my-plan mark task-2-1 as completed
```

### Add a New Phase
```
/session:plan-update my-plan add a new phase called "Performance Testing" after phase-3
```

### Force Update (completed items)
```
/session:plan-update my-plan remove task-1-1 --force
```

---

## Command Options

| Option | Description |
|--------|-------------|
| `--force` | Allow modifications to completed items |
| `--yes` | Skip confirmation prompt |
| `--dry-run` | Preview changes without applying |
| `--mode selective` | Only update pending items (default for executing plans) |
| `--mode rollback` | Reset progress and apply all changes |
| `--json` | Output results as JSON |

---

## Error Handling

### Plan Not Found
```
❌ Error: Plan 'unknown-plan' not found

Available plans:
  - my-feature (in-progress, 45%)
  - refactor-api (pending, 0%)

Use /session:plan-list for full details.
```

### Invalid Operation
```
❌ Error: Could not parse update request

Input: "do something to the plan"

Could not determine:
  - Operation type (add, remove, update?)
  - Target (phase, task?)

Try being more specific:
  - "add a task called 'X' to phase Y"
  - "remove task-1-2"
  - "rename phase-1 to 'New Name'"
```

### Blocked by Execution State
```
❌ Error: Cannot modify in-progress task

Task 'task-2-3' is currently in progress.
Wait for completion or use rollback mode.

Options:
  1. Wait for task to complete
  2. Use /session:plan-update {plan} --mode rollback
```

### Validation Error
```
❌ Error: Invalid operation

Cannot add task with duplicate ID 'task-1-1'
A task with this ID already exists in phase-1.

Suggestion: Let the system generate a unique ID automatically.
```

---

## Related Commands

- `/session:plan-status {name}` - View current plan status
- `/session:plan-execute {name}` - Execute plan tasks
- `/session:plan-list` - List all plans
- `/session:plan-save {name}` - Create new plan
- `/session:plan-finalize {name}` - Finalize conceptual plan
