You are executing the /plan-status command to show plan execution status.

**NOTE:** Plans are now global and independent of sessions.

## Arguments

Parsed from user input:
- `plan_name`: {name} (optional - if not provided, show status for all plans)

ARGUMENTS: {name}

## Workflow

### Step 1: Get Plan Status

Plans are stored globally in `.claude/sessions/plans/` and can be accessed without an active session.

If plan_name is provided, get status for that specific plan:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {plan_name}
```

If no plan_name, list all global plans first:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-list
```

Then get status for each plan.

### Step 2: Display Status

**For a specific plan:**

```
📋 Plan Status: {plan_name}

Goal: {goal}
Work Type: {work_type}
Scope: Global (accessible from any session)
Created: {created_date}
Last Updated: {updated_date}

Overall Progress: {completed_tasks}/{total_tasks} tasks ({percentage}%)
├─ Completed: {completed}
├─ In progress: {in_progress}
├─ Pending: {pending}
└─ Blocked: {blocked}

Phase Progress: {completed_phases}/{total_phases}

Phases:
  1. [✓] {phase_1_name} (completed)
     ├─ Tasks: 5/5 (100%)
     └─ Duration: {duration}

  2. [→] {phase_2_name} (in-progress)
     ├─ Tasks: 2/7 (29%)
     ├─ Current Task: {current_task_id} - {description}
     └─ Status: {task_status}

  3. [ ] {phase_3_name} (pending)
     ├─ Tasks: 0/6 (0%)
     └─ Depends on: Phase 2

  4. [ ] {phase_4_name} (pending)
     ├─ Tasks: 0/4 (0%)
     └─ Depends on: Phase 2, Phase 3

Current Task: {current_task_id}
  Description: {description}
  Details: {details}
  Status: {status}
  Phase: {phase_name}

Next Steps:
  /plan-execute {plan_name} - Continue execution
  /update-task-status {task_id} completed - Mark current task complete
```

**For all plans:**

```
📋 All Global Plans

1. oauth-implementation (feature)
   ├─ Progress: 15/22 tasks (68%)
   ├─ Status: in-progress
   ├─ Current: Phase 2 - OAuth Flow Implementation
   └─ Last Updated: 2 hours ago

2. database-migration (refactor)
   ├─ Progress: 8/8 tasks (100%)
   ├─ Status: completed
   └─ Completed: 1 day ago

3. api-redesign (spike)
   ├─ Progress: 0/12 tasks (0%)
   ├─ Status: pending
   └─ Created: 3 days ago

Use /plan-status {plan_name} for detailed status.
Use /plan-execute {plan_name} to start/continue execution.
Use /plan-list to see all available plans.
```

### Step 3: Show Recommendations

Based on plan status, show context-aware recommendations:

**If plan is in-progress:**
```
💡 Recommendations:
- Current task is {status} - {recommendation}
- {next_task_count} tasks remaining in current phase
- Estimated completion: {estimate}
```

**If plan is blocked:**
```
⚠️ Blocked:
- Task {task_id} is blocked
- Blocker: {blocker_reason}
- Action needed: {action}
```

**If plan is completed:**
```
✅ Plan Complete:
- All {total_tasks} tasks completed
- Duration: {total_duration}
- Consider: Code review, testing, deployment
```

---

## Display Formats

### Progress Bar
```
Progress: [████████████░░░░░░░░] 68% (15/22 tasks)
```

### Status Icons
- [✓] Completed
- [→] In Progress
- [ ] Pending
- [✗] Failed
- [⊘] Blocked
- [~] Skipped

### Phase Status
```
Phase 2: OAuth Flow Implementation (in-progress)
  ├─ task-2-1: Create OAuth callback routes [✓]
  ├─ task-2-2: Implement JWT generation [→]
  ├─ task-2-3: Add session middleware [ ]
  └─ task-2-4: Configure passport.js [ ]
```

---

## Error Handling

- Plan not found: Show available plans using /plan-list
- Corrupted plan data: Show error with recovery steps
- No plans exist: Show message about creating first plan with /save-plan {name}
