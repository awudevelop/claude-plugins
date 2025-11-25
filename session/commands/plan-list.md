You are executing the /session:plan-list command to list all global plans.

**NOTE:** Plans are now global and stored in `.claude/plans/`. This command works without requiring an active session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`
Use ONLY the exact command formats specified in this template.

## Arguments

No arguments required.

ARGUMENTS:

## Workflow

### Step 1: List All Global Plans

Get the list of all plans from the global plans directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-list
```

This returns JSON:
```json
{
  "success": true,
  "data": {
    "plans": ["plan-1", "plan-2", "plan-3"],
    "count": 3
  },
  "message": "Found 3 plan(s)"
}
```

### Step 2: Get Details for Each Plan

For each plan in the list, get its format and basic metadata:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-plan-format {plan_name}
```

This tells you if it's "conceptual" (requirements only) or "implementation" (executable tasks).

Optionally, for implementation plans, get status:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {plan_name}
```

### Step 3: Display Plan List

Show a formatted list of all plans:

```
📋 Global Plans ({count} total)

Conceptual Plans (Requirements Only):
  1. api-redesign
     ├─ Goal: Redesign API for better performance
     ├─ Requirements: 12
     ├─ Created: 3 days ago
     └─ Next: Use /session:plan-finalize api-redesign to create executable tasks

  2. user-permissions
     ├─ Goal: Implement role-based permissions system
     ├─ Requirements: 8
     ├─ Created: 1 week ago
     └─ Next: Use /session:plan-finalize user-permissions to create executable tasks

Implementation Plans (Executable):
  3. oauth-implementation (feature)
     ├─ Progress: 15/22 tasks (68%)
     ├─ Status: in-progress
     ├─ Current: Phase 2 - OAuth Flow Implementation
     └─ Last Updated: 2 hours ago

  4. database-migration (refactor)
     ├─ Progress: 8/8 tasks (100%)
     ├─ Status: completed
     └─ Completed: 1 day ago

Helpful Commands:
  /session:plan-status {name}       - Show detailed plan status
  /session:plan-execute {name}      - Start/continue plan execution
  /session:plan-finalize {name}     - Transform conceptual plan to executable
  /session:save-plan {name}         - Create a new plan
```

### Step 4: Handle Empty Case

If no plans exist, show:

```
📋 No plans found

You haven't created any plans yet.

Get started:
  1. Have a conversation about what you want to build
  2. Run /session:save-plan {name} to capture requirements
  3. Run /session:plan-finalize {name} to create executable tasks
  4. Run /session:plan-execute {name} to start implementation

💡 Plans are global and accessible from any session.
```

---

## Display Formatting

### Plan Type Indicators
- 📝 Conceptual (requirements captured, not yet broken down into tasks)
- ⚙️ Implementation (executable tasks, ready to execute)

### Status Icons
- ✓ Completed
- → In Progress
- ○ Pending
- ⊘ Blocked

### Progress Bars
For implementation plans with progress:
```
Progress: [████████████░░░░░░░░] 68% (15/22 tasks)
```

---

## Error Handling

- No plans directory: Show empty state message
- Corrupted plan files: Skip and show warning for specific plan
- CLI command failures: Show error message with suggestion to run /session:rebuild-index

---

## Notes

- This command does NOT require an active session
- Plans are stored globally in `.claude/plans/`
- Both conceptual and implementation plans are shown
- The list is sorted by last updated (most recent first)
- Use /session:plan-status {name} for detailed information about a specific plan
