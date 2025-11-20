You are executing the /save-plan command to create a structured plan from the current conversation.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)
- `--template {type}`: Force specific template (optional)
- `--no-template`: Skip template selection (optional)

ARGUMENTS: {name}

## Workflow

### Step 1: Validate Session

First, check that there is an active session by running:

```bash
[ -f .claude/sessions/.active-session ] && cat .claude/sessions/.active-session || echo "none"
```

If the result is "none", show this error and STOP:
```
❌ Error: No active session

You must start or continue a session before creating a plan.
Use /session:start {name} or /session:continue {name}
```

### Step 2: Read Conversation Log

Load the conversation log for the active session. The conversation log file is at:
`.claude/sessions/{session_name}/conversation-log.jsonl`

If the file doesn't exist or is empty, show this error and STOP:
```
❌ Error: No conversation found

Cannot create plan without conversation history.
Have a discussion first, then use /save-plan {name}
```

### Step 3: Detect Work Type

Unless `--template {type}` or `--no-template` flags were provided, detect the work type from the conversation.

Use the work-type-detector to analyze the conversation:
```bash
node {plugin_root}/cli/session-cli.js detect-work-type {session_name}
```

This returns a JSON object with:
```json
{
  "type": "feature|bug|spike|refactor|unknown",
  "confidence": 87,
  "scores": {...},
  "signals": {...}
}
```

Show the detection result to the user:
```
🔍 Analyzing conversation...
✓ Detected work type: {TYPE} ({confidence}% confidence)
```

If confidence is low (< 60%), ask the user to confirm or manually select work type.

### Step 4: Select Template

Based on the detected (or forced) work type, load the appropriate template:

```bash
node {plugin_root}/cli/session-cli.js select-template {work_type}
```

This returns the template JSON structure ready to be merged with conversation data.

If `--no-template` was specified, skip this step entirely.

### Step 5: Extract Plan Details from Conversation

Use a subagent to analyze the conversation and extract structured planning information.

Invoke the Task tool with:
- subagent_type: "general-purpose"
- model: "haiku"
- prompt: Read the file at `{plugin_root}/prompts/analyze-conversation.md`, replace `[CONVERSATION LOG INSERTED HERE]` with the actual conversation log content, then execute those instructions

The subagent will return extracted data:
```json
{
  "goal": {
    "primary": "...",
    "success_criteria": [...]
  },
  "technical_decisions": [...],
  "requirements": {...},
  "constraints": [...],
  "discussion_points": [...],
  "conversation_summary": "..."
}
```

### Step 6: Merge Template + Conversation Data

If a template was selected:
1. Take the template structure (phases and tasks)
2. Merge in the conversation-extracted data:
   - Set `goal` from extracted data
   - Set `success_criteria` from extracted data
   - Add `technical_decisions` array
   - Add `requirements` object
   - Add `constraints` array
   - Add `conversation_summary`
   - Set `work_type` from detection
   - Set `auto_detected: true` and `detection_confidence` if auto-detected
   - Set timestamps and version

If no template (--no-template):
1. Create a basic 3-phase structure:
   - Phase 1: Setup and Investigation
   - Phase 2: Implementation
   - Phase 3: Testing and Deployment
2. Generate tasks from the conversation analysis
3. Merge in all extracted data

The final plan structure should match the plan-schema.json schema.

### Step 7: Show Plan Preview

Display a preview of the plan to the user:

```
📋 Plan Preview: {plan_name}

Work Type: {type} ({confidence}% confidence)
Goal: {primary_goal}

Phases: {phase_count}
Tasks: {task_count}

Phase 1: {phase_1_name}
  • task-1-1: {description}
  • task-1-2: {description}
  ...

Phase 2: {phase_2_name}
  • task-2-1: {description}
  ...

[Show first 2 phases, summarize rest if more than 2]

Options:
  1. ✓ Save this plan (recommended)
  2. Choose different template
  3. Skip template (conversation-only plan)
  4. Cancel
```

### Step 8: Get User Choice

Use the AskUserQuestion tool to get the user's choice.

Handle the response:
- **Option 1 (Save)**: Continue to Step 9
- **Option 2 (Different template)**: Show template list, let user select, go back to Step 4
- **Option 3 (Skip template)**: Set template to null, go to Step 5
- **Option 4 (Cancel)**: Show "Plan creation cancelled" and STOP

### Step 9: Validate Plan

Validate the plan against the schema:

```bash
node {plugin_root}/cli/session-cli.js validate-plan '{plan_json}'
```

If validation fails, show the errors and STOP:
```
❌ Validation errors found:
  1. {error_1}
  2. {error_2}

Cannot save invalid plan. Please review.
```

If validation succeeds, continue.

### Step 10: Save Plan Files

Create the plan file:

```bash
node {plugin_root}/cli/session-cli.js create-plan {session_name} {plan_name} '{plan_json}'
```

Also create a conversation context markdown file for reference:
- Path: `.claude/sessions/{session_name}/plans/conversation_{plan_name}.md`
- Content: Include conversation summary, key decisions, requirements, etc.

### Step 11: Display Success

Show success message with next steps:

```
✓ Plan saved: {plan_name}

📋 Plan Details:
   • Work type: {type} (detected with {confidence}% confidence)
   • Phases: {phase_count}
   • Tasks: {task_count}
   • File: .claude/sessions/{session_name}/plans/plan_{plan_name}.json

📝 Next Steps:
   1. Start execution session:
      /session:start {plan_name}-execution

   2. Use this execution prompt:

      "Load plan from .claude/sessions/{session_name}/plans/plan_{plan_name}.json
       and begin execution starting with Phase 1, Task 1.

       Auto-update task status as work progresses using:
       updateTaskStatus('{plan_name}', 'task-id', 'status')"

   3. Monitor progress anytime:
      /session:status

💡 The plan will guide your work through all {phase_count} phases systematically.
```

---

## Error Handling

At each step, handle errors gracefully:

- **File not found**: Show clear message with suggestion on how to proceed
- **Validation failed**: Show specific validation errors
- **Detection low confidence**: Ask user to manually clarify work type
- **Parse errors**: Show error details and abort
- **CLI command failures**: Check exit codes and show appropriate error messages

Always provide actionable next steps when errors occur.

---

## Notes

- The {plugin_root} variable should be replaced with the absolute path to the session plugin
- The {session_name} variable comes from the active session
- All CLI commands should use absolute paths
- Error messages should be user-friendly and actionable
- The workflow is designed to be interruptible - user can cancel at any point
