You are executing the /session:plan-execute command to start executing a plan.

**NOTE:** Plans are now global and independent of sessions.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)

ARGUMENTS: {name}

## Workflow

### Step 1: Validate Plan Exists

Plans are stored globally in `.claude/plans/`. Check if the plan exists:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-exists {plan_name}
```

If the plan doesn't exist, show error and STOP:
```
❌ Error: Plan '{plan_name}' not found

Use /session:save-plan {name} to create a plan first.
Use /session:plan-list to see available plans.
```

### Step 2: Validate Plan Format

Before executing, verify the plan is in implementation format (not conceptual):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-plan-format {plan_name}
```

This returns JSON with `format: "conceptual"` or `format: "implementation"`.

If the format is "conceptual", show this error and STOP:
```
❌ Error: Cannot execute conceptual plan

Plan '{plan_name}' is still in conceptual format (requirements only).

You must finalize the plan first to transform requirements into executable tasks:

  /session:plan-finalize {plan_name}

This will use AI to break down requirements into concrete implementation tasks
organized by phases (Database, API, UI, Testing, etc.)

After finalization, you can execute the plan.
```

If the format is "implementation", continue to next step.

### Step 4: Load Plan Status

Get the current plan status to show what will be executed:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {session_name} {plan_name}
```

This returns JSON with plan metadata, progress, and current phase.

### Step 5: Show Execution Overview

Display a summary of what will be executed:

```
📋 Plan: {plan_name}
Goal: {goal}

Progress: {completed_tasks}/{total_tasks} tasks ({percentage}%)
Status: {status}

Phases:
  1. [✓] Phase 1: {name} (completed)
  2. [→] Phase 2: {name} (in progress - will continue here)
  3. [ ] Phase 3: {name} (pending)
  4. [ ] Phase 4: {name} (pending)

Current Phase: {current_phase_name}
Next Task: {next_task_description}

Ready to execute this plan?
```

### Step 6: Execution Strategy

**IMPORTANT**: Plan execution is currently **manual** with task tracking:

1. Show the user the next task to work on
2. The user implements the task manually
3. After completing a task, update its status:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-task-status {session_name} {plan_name} {task_id} completed
   ```
4. Show progress after each task completion
5. Repeat until all tasks are completed

### Step 7: Display Current Task

Show the next task that needs to be completed:

```
🎯 Next Task: {task_id}

Phase: {phase_name}
Task: {task_description}

Details:
{task_details}

Technical Notes:
- {note_1}
- {note_2}

Dependencies: {dependencies} (all completed ✓)

---

To mark this task as complete when done:
/update-task-status {task_id} completed

To see overall progress:
/session:plan-status {plan_name}

To continue to next task:
Just complete the current task and I'll show you the next one.
```

### Step 8: Task Completion Loop

After the user completes work:

1. Ask: "Have you completed task {task_id}?"
2. If yes, update task status:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-task-status {session_name} {plan_name} {task_id} completed
   ```
3. Show updated progress
4. Load next task
5. If more tasks exist, show next task (Step 6)
6. If all tasks complete, show completion message (Step 8)

### Step 9: Completion Message

When all tasks are completed:

```
🎉 Plan Complete: {plan_name}

All tasks completed successfully!

Summary:
- Total Tasks: {total_tasks}
- Completed: {total_tasks} (100%)
- Phases: {total_phases}
- Time Tracked: {duration}

Next Steps:
1. Review all changes
2. Run tests if applicable
3. Create a pull request
4. Deploy to production

Use /session:save to capture this milestone!
```

---

## Notes

- The execution is **manual** - Claude doesn't automatically execute code
- Users implement tasks themselves, Claude tracks progress
- This provides visibility and structure without automation
- Future: Automated task execution with agent orchestration

---

## Error Handling

At each step, handle errors gracefully:
- Plan not found: Show clear message with available plans
- Invalid task ID: Show valid task IDs for current phase
- Session errors: Guide user to start/continue session
