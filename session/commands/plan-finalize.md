You are executing the /session:plan-finalize command to transform requirements into executable tasks.

**NOTE:** Plans are now global and independent of sessions.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)

ARGUMENTS: {name}

## Purpose

This is the TRANSFORMATION step that bridges conceptual planning and execution:

**Before (Conceptual - requirements.json):**
```
Requirements (WHAT):
- "Restrict products based on user permissions"
- "Track who created each product"
```

**After (Implementation - orchestration.json + phases/):**
```
Phase 1: Database Layer
  ✓ task-1-1: Add restriction_level column to public.new_product table
  ✓ task-1-2: Create migration script for ALTER TABLE
  ✓ task-1-3: Add created_by column with foreign key to users

Phase 2: API Layer
  ✓ task-2-1: Add validation in POST /api/products endpoint
  ✓ task-2-2: Add validation in PUT /api/products/:id endpoint
  ✓ task-2-3: Return 403 error for restricted products

Phase 3: UI Layer
  ✓ task-3-1: Add restriction checkbox in product form
  ✓ task-3-2: Show error message when restriction fails
```

**This step uses AI to break down requirements into concrete, actionable tasks.**

## Workflow

### Step 1: Load Plan and Validate Format

Plans are global and stored in `.claude/plans/`. Check what format the plan is in:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-plan-format {plan_name}
```

This returns `format: "conceptual"` or `format: "implementation"`.

**If format is "implementation":**
```
✓ Plan '{plan_name}' is already finalized

This plan has already been transformed into executable tasks.

Use /session:plan-execute {plan_name} to start implementation.
```
Then STOP.

**If format is "conceptual":** Continue to next step.

### Step 2: Load Requirements

Load the requirements.json file from the global plans directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js load-requirements {plan_name}
```

This returns the requirements data:
```json
{
  "goal": "...",
  "requirements": [
    { "id": "req-1", "description": "...", "priority": "high" },
    { "id": "req-2", "description": "...", "priority": "medium" }
  ],
  "metadata": { "work_type": "feature" }
}
```

### Step 4: Show Requirements Summary

Display what will be transformed:

```
📋 Plan: {plan_name}

Goal: {goal}
Format: Conceptual (requirements)

Requirements to Transform:
  1. req-1: {description} [{priority}]
  2. req-2: {description} [{priority}]
  ... ({total} requirements)

Work Type: {work_type}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Finalization Process:

I will use AI to break down each requirement into concrete implementation tasks,
organized by phases (Database, API, UI, Testing, etc.)

This transformation will:
  • Convert high-level requirements into actionable tasks
  • Organize tasks by implementation layer
  • Add implementation details (SQL, API endpoints, UI components)
  • Track which requirement led to which tasks
  • Create execution-ready plan structure

Ready to proceed? (yes/no)
```

### Step 5: Get User Confirmation

Use the AskUserQuestion tool to confirm.

If user says no/cancel, show:
```
Plan finalization cancelled. The plan remains in conceptual format.
```
Then STOP.

If yes, continue.

### Step 6: AI-Powered Task Breakdown

Show progress indicator:
```
🤖 AI Analysis in Progress...

This will take 30-60 seconds.
```

Invoke the Task tool with:
- subagent_type: "general-purpose"
- model: "sonnet"  (use sonnet for better quality breakdown)
- prompt: Read the file at `${CLAUDE_PLUGIN_ROOT}/prompts/breakdown-requirement.md`, replace `[REQUIREMENTS JSON INSERTED HERE]` with the actual requirements JSON, then execute those instructions

The subagent will analyze requirements and return structured breakdown:
```json
{
  "implementation_goal": "...",
  "phases": [
    {
      "name": "Database Layer",
      "description": "...",
      "tasks": [
        {
          "description": "Add restriction_level column to products",
          "details": "ALTER TABLE products ADD COLUMN...",
          "from_requirement": "req-1"
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1", "task-2-1", "task-3-1"],
    "req-2": ["task-1-2", "task-2-2"]
  },
  "assumptions": [...],
  "risks": [...]
}
```

### Step 7: Show Transformation Preview

Display the AI-generated breakdown for user review:

```
✓ AI Analysis Complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Transformation Preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implementation Goal:
{implementation_goal}

Phase 1: {phase_1_name}
  • task-1-1: {description}
  • task-1-2: {description}
  • task-1-3: {description}
  [{task_count} tasks]

Phase 2: {phase_2_name}
  • task-2-1: {description}
  • task-2-2: {description}
  [{task_count} tasks]

Phase 3: {phase_3_name}
  • task-3-1: {description}
  [{task_count} tasks]

[Show all phases]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Requirements: {requirement_count}
• Phases: {phase_count}
• Tasks: {task_count}
• Traceability: Complete (all tasks mapped to requirements)

Assumptions:
  - {assumption_1}
  - {assumption_2}

Risks:
  - {risk_1}
  - {risk_2}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Does this breakdown look good? (yes/edit/cancel)
```

### Step 8: Handle User Response

**If "yes":** Continue to Step 9

**If "edit":**
```
What would you like to modify?

You can:
  a) Adjust task descriptions
  b) Add/remove tasks
  c) Change phase organization
  d) Add more details to specific tasks
  e) Re-run AI analysis with different focus

Your choice:
```

Based on user input, make modifications and show preview again (repeat Step 7).

**If "cancel":**
```
Finalization cancelled. Plan remains in conceptual format.
```
STOP.

### Step 9: Transform and Save

Show progress:
```
💾 Transforming plan...

Creating implementation structure...
```

Call the transformation function:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js transform-plan {plan_name} '{breakdown_json}'
```

This will:
1. Create orchestration.json with metadata and phase registry
2. Create phases/*.json files with tasks
3. Create execution-state.json for progress tracking
4. Keep requirements.json for traceability
5. Mark plan as "implementation" type

### Step 10: Success Message

```
✓ Plan Finalized: {plan_name}

Requirements successfully transformed into executable implementation plan!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transformation Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Input:
  • Format: Conceptual (requirements)
  • Requirements: {requirement_count}

Output:
  • Format: Implementation (orchestration + phases)
  • Phases: {phase_count}
  • Tasks: {task_count}
  • Structure: Optimized for parallel execution

Files Created:
  • orchestration.json (coordinator)
  • phases/phase-1-{name}.json
  • phases/phase-2-{name}.json
  • phases/phase-3-{name}.json
  • execution-state.json (progress tracking)

Preserved:
  • requirements.json (for traceability)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next Steps:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review the finalized plan:
   /session:plan-status {plan_name}

2. Start execution:
   /session:plan-execute {plan_name}

3. Track progress as you implement each task

🎯 Ready for implementation!
```

---

## Transformation Details

### File Structure

**Before (Conceptual):**
```
plans/{plan_name}/
├── requirements.json          (only file)
└── conversation-context.md    (reference)
```

**After (Implementation):**
```
plans/{plan_name}/
├── requirements.json          (preserved for traceability)
├── orchestration.json         (coordinator + metadata)
├── phases/
│   ├── phase-1-database.json
│   ├── phase-2-api.json
│   └── phase-3-ui.json
├── execution-state.json       (runtime progress)
└── conversation-context.md    (reference)
```

### Traceability

Every task in the implementation plan has a `from_requirement` field:
```json
{
  "task_id": "task-1-1",
  "description": "Add restriction_level column",
  "from_requirement": "req-1"
}
```

This allows you to trace back from implementation tasks to original requirements.

### Why AI-Powered?

Breaking down requirements into tasks requires:
- Understanding of technical architecture (DB → API → UI)
- Knowledge of implementation patterns
- Ability to infer specific tasks from general requirements
- Context about dependencies and ordering

AI excels at this transformation, turning:
- "Restrict products" → 10+ specific tasks across layers
- "Track creators" → Database schema, API logic, UI display

### Quality Assurance

The AI breakdown is trained to:
- Create concrete, actionable tasks (not vague)
- Provide implementation details (SQL, file paths, logic)
- Organize by architectural layers
- Specify dependencies correctly
- Estimate token usage realistically

---

## Error Handling

- **Plan not found**: Show available plans
- **Already finalized**: Show success, suggest execution
- **Invalid session**: Guide to start/continue
- **AI breakdown fails**: Offer retry or manual task creation
- **User cancels**: Keep conceptual format, can retry later

---

## Notes

- Finalization is REQUIRED to execute a plan
- AI breakdown takes 30-60 seconds (uses Sonnet for quality)
- User can review and modify before saving
- Original requirements.json is preserved for traceability
- Transformation is reversible (can re-finalize if needed)
- This is where requirements (WHAT) become tasks (HOW)
