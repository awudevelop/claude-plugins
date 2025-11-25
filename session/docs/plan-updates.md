# Plan Updates Guide

Modify your implementation plans safely with atomic operations, execution context awareness, and rollback protection.

## Overview

Plan updates allow you to modify implementation plans after they've been created. This is essential when:

- Requirements change mid-implementation
- You discover new tasks that weren't anticipated
- Phase ordering needs adjustment
- Tasks need to move between phases
- Plan scope changes

## Key Concepts

### Update Modes

**1. Standard Update** (For Not-Started Plans)
- All modifications allowed
- No execution state to preserve
- Full flexibility

**2. Selective Update** (For Executing Plans)
- Only modifies pending/not-started items
- Protects completed work
- Use `force` flag to override protection

**3. Rollback-Replan** (For Major Changes)
- Resets all task statuses to pending
- Preserves execution history in logs
- Creates backup before changes
- Best for significant structural changes

### Atomic Operations

All updates are atomic - they either complete fully or roll back completely:

1. **Backup Creation** - Full plan backup before any changes
2. **Validation** - All operations validated before execution
3. **Sequential Execution** - Operations run in order
4. **Automatic Rollback** - On failure, reverts to backup

## Use Cases

### Adding a New Phase

When you need an additional phase in your plan:

```bash
# Via CLI
node session-cli.js plan-update my-plan add phase --name "Performance Testing" --after "phase-3-implementation"

# Via slash command
/session:plan-update my-plan add phase "Performance Testing" after phase-3
```

### Adding Tasks to a Phase

Add new tasks to an existing phase:

```bash
# CLI
node session-cli.js plan-update my-plan add task --phase "phase-2" --description "Add input validation"

# Slash command
/session:plan-update my-plan add task to phase-2 "Add input validation"
```

### Moving a Task Between Phases

Reorganize tasks as understanding evolves:

```bash
# CLI
node session-cli.js plan-update my-plan move task-2-3 to phase-3

# Slash command
/session:plan-update my-plan move task-2-3 to phase-3
```

### Updating Task Details

Modify existing task information:

```bash
# CLI
node session-cli.js plan-update my-plan update task task-1-2 --description "Updated description"

# Slash command
/session:plan-update my-plan update task-1-2 description "Updated description"
```

### Reordering Phases

Change phase execution order:

```bash
# CLI
node session-cli.js plan-update my-plan reorder phases phase-1,phase-3,phase-2

# Slash command
/session:plan-update my-plan reorder phases 1,3,2
```

### Removing a Phase

Remove an entire phase (and its tasks):

```bash
# CLI
node session-cli.js plan-update my-plan delete phase phase-4

# Slash command - requires confirmation
/session:plan-update my-plan delete phase-4
```

## Execution Context Handling

### When Plan is Not Started

All updates are allowed. This is the most flexible mode.

### When Plan is In Progress

**Selective Update Mode** (Default):
- Modifications to **pending** phases/tasks: Allowed
- Modifications to **completed** items: Blocked (use `--force` to override)
- Modifications to **in-progress** items: Always blocked

```bash
# Update pending task (allowed)
node session-cli.js plan-update my-plan update task-3-1 --description "New description"

# Update completed task (blocked without force)
node session-cli.js plan-update my-plan update task-1-1 --description "New description"
# Error: Task is completed - use --force to modify

# Force update completed task
node session-cli.js plan-update my-plan update task-1-1 --description "New description" --force
# Warning: Modifying completed task 'task-1-1' with force flag
```

**Rollback-Replan Mode**:
Use when you need significant changes that affect completed work:

```bash
# Rollback and apply updates
node session-cli.js plan-update my-plan --mode rollback-replan add phase "New First Phase" --position 0

# What happens:
# 1. All task statuses reset to pending
# 2. Execution logs backed up
# 3. Execution history preserved
# 4. Updates applied
# 5. Ready for fresh execution
```

## Command Reference

### CLI Commands

```bash
# Add operations
node session-cli.js plan-update <plan> add phase --name <name> [--after <phase-id>] [--position <n>]
node session-cli.js plan-update <plan> add task --phase <phase-id> --description <desc>

# Update operations
node session-cli.js plan-update <plan> update metadata --name <name> --description <desc>
node session-cli.js plan-update <plan> update phase <id> --name <name>
node session-cli.js plan-update <plan> update task <id> --description <desc> --phase <phase-id>

# Delete operations
node session-cli.js plan-update <plan> delete phase <id> [--force]
node session-cli.js plan-update <plan> delete task <id> --phase <phase-id> [--force]

# Move/Reorder operations
node session-cli.js plan-update <plan> move task <id> --from <phase> --to <phase>
node session-cli.js plan-update <plan> reorder phases <id1,id2,id3>
node session-cli.js plan-update <plan> reorder tasks --phase <phase-id> <task1,task2,task3>

# Options
--force          # Override protection for completed items
--dry-run        # Preview changes without applying
--mode <mode>    # 'selective' (default) or 'rollback-replan'
```

### Slash Commands

```
/session:plan-update <plan> add phase "<name>"
/session:plan-update <plan> add task to <phase> "<description>"
/session:plan-update <plan> update <task-id> description "<new description>"
/session:plan-update <plan> delete <phase-id>
/session:plan-update <plan> move <task-id> to <phase-id>
/session:plan-update <plan> reorder phases <order>
```

## Examples

### Example 1: Adding Error Handling Phase

**Before:**
```
Phase 1: Database Setup (completed)
Phase 2: API Implementation (in progress)
Phase 3: Testing
```

**Action:**
```bash
node session-cli.js plan-update my-api add phase --name "Error Handling" --after phase-2
```

**After:**
```
Phase 1: Database Setup (completed)
Phase 2: API Implementation (in progress)
Phase 3: Error Handling (new - pending)
Phase 4: Testing
```

### Example 2: Moving Task During Execution

You realize a task belongs in a different phase:

```bash
# Task task-2-3 (Logging) should be in Phase 3 (Infrastructure), not Phase 2 (Features)
node session-cli.js plan-update my-api move task-2-3 --from phase-2 --to phase-3
```

The task moves with its dependencies updated automatically.

### Example 3: Major Restructure with Rollback

Requirements changed significantly - need to restructure:

```bash
# View current state
node session-cli.js plan-status my-api

# Rollback and replan
node session-cli.js plan-update my-api --mode rollback-replan

# Add new phase at beginning
node session-cli.js plan-update my-api add phase --name "Architecture Review" --position 0

# Remove obsolete phase
node session-cli.js plan-update my-api delete phase phase-old-approach --force

# Execution history preserved in:
# - .logs-backup/ directory
# - orchestration.json -> execution_history
```

## Best Practices

### 1. Use Dry Run First

Always preview changes before applying:

```bash
node session-cli.js plan-update my-plan add phase --name "New Phase" --dry-run
```

### 2. Prefer Selective Updates

For minor changes during execution, use selective mode (default):
- Preserves completed work
- Faster execution
- Less disruptive

### 3. Use Rollback-Replan Sparingly

Only use when:
- Significant structural changes needed
- Dependencies between completed and pending work changed
- Starting fresh is easier than patching

### 4. Review Execution History

After rollback-replan, review what was completed:

```bash
node session-cli.js plan-history my-plan
```

### 5. Backup Before Major Changes

For critical plans, create a manual backup:

```bash
cp -r .claude/plans/my-plan .claude/plans/my-plan-backup-$(date +%Y%m%d)
```

## Troubleshooting

### "Task is completed - cannot modify"

**Cause:** Trying to modify completed work in selective mode.

**Solution:** Use `--force` flag:
```bash
node session-cli.js plan-update my-plan update task-1-1 --description "New" --force
```

### "Phase has dependents - cannot delete"

**Cause:** Other phases depend on this phase.

**Solution:**
1. Update dependent phases first, or
2. Use `--force` to delete anyway (dependencies become invalid)

### "Circular dependency detected"

**Cause:** Update would create a circular dependency.

**Solution:** Review the dependency chain and adjust accordingly.

### "Operation blocked - in-progress task"

**Cause:** Cannot modify tasks currently being executed.

**Solution:** Wait for task completion or use rollback-replan mode.

## Recovery

### From Failed Update

If an update fails partway:

```bash
# Find backup
ls .claude/plans/my-plan/.backups/

# Restore manually if needed
cp -r .claude/plans/my-plan/.backups/backup-20250101-120000/* .claude/plans/my-plan/
```

### From Rollback-Replan

Execution logs are preserved:

```bash
# View log backups
ls .claude/plans/my-plan/.logs-backup/

# View execution history
cat .claude/plans/my-plan/orchestration.json | jq '.execution_history'
```

## Related Commands

- `/session:plan-status <plan>` - View current plan status
- `/session:plan-execute <plan>` - Execute plan tasks
- `/session:plan-list` - List all plans
- `/session:save-plan <name>` - Create new plan
