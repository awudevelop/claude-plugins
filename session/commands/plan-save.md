You are executing the /session:save-plan command to create a conceptual plan from the current conversation.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)

ARGUMENTS: {name}

## Workflow

### Step 1: Check for Active Session (Optional)

Plans are now global and don't require a session. However, if there's an active session, we can extract requirements from the conversation.

Check for active session:

```bash
[ -f .claude/sessions/.active-session ] && cat .claude/sessions/.active-session || echo "none"
```

- If result is "none": Skip Steps 2-3, create an empty plan with placeholder requirements (go to Step 4)
- If there's an active session: Continue to Step 2 to extract from conversation

### Step 2: Read Conversation Log (If Session Active)

**Only execute this step if there's an active session.**

Load the conversation log for the active session. The conversation log file is at:
`.claude/sessions/{session_name}/conversation-log.jsonl`

**Chunked Reading Strategy:**
1. Check if file exists
2. Count lines: `wc -l .claude/sessions/{session_name}/conversation-log.jsonl`
3. If <= 2000 lines: Read entire file
4. If > 2000 lines: Read in chunks of 2000 using Read tool's offset/limit parameters
5. Concatenate all chunks into full conversation log

If the file doesn't exist or is empty:
- Show warning: "⚠️ No conversation log found. Creating empty plan template."
- Continue to Step 4 with empty requirements

### Step 3: Detect Work Type (Optional - If Session Active)

Detect the work type from the conversation for metadata purposes:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js detect-work-type {session_name}
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

Show the detection result:
```
🔍 Analyzing conversation...
✓ Detected work type: {TYPE} ({confidence}% confidence)
```

This is for metadata only - conceptual plans don't use templates.

### Step 4: Extract Requirements from Conversation

Use a subagent to analyze the conversation and extract requirements (not tasks!).

Invoke the Task tool with:
- subagent_type: "general-purpose"
- model: "haiku"
- prompt: Read the file at `${CLAUDE_PLUGIN_ROOT}/prompts/analyze-conversation.md`, replace placeholders with actual values, then execute those instructions

The subagent will return extracted requirements:
```json
{
  "goal": "High-level objective",
  "requirements": [
    {
      "id": "req-1",
      "description": "What the user wants (high-level)",
      "notes": "Additional context",
      "open_questions": ["Question 1", "Question 2"],
      "priority": "high|medium|low",
      "conversation_context": "Relevant conversation excerpts"
    }
  ],
  "discussion_notes": "Free-form notes from planning discussion",
  "conversation_summary": "Summary of conversation"
}
```

**IMPORTANT:** Extract REQUIREMENTS (what user wants), NOT tasks (how to implement).
- ✓ Good requirement: "Restrict products based on user permissions"
- ✗ Bad (too detailed): "Add restriction_level column to public.new_product table"

Requirements are exploratory and high-level during planning.

### Step 4: Build Requirements Plan

Create the requirements.json structure:

```json
{
  "plan_name": "{plan_name}",
  "plan_type": "conceptual",
  "goal": "{extracted_goal_or_placeholder}",
  "requirements": [...extracted_requirements_or_empty],
  "discussion_notes": "{discussion_notes_or_empty}",
  "conversation_summary": "{conversation_summary_or_empty}",
  "created_at": "{ISO_8601_timestamp}",
  "metadata": {
    "work_type": "{detected_work_type_or_unknown}",
    "estimated_complexity": "simple|moderate|complex",
    "source_session": "{session_name_if_available_else_null}"
  }
}
```

**Note:** The `session_name` field is no longer required. Plans are global and can be created with or without session context.

### Step 6: Show Requirements Preview

Display a preview of the requirements to the user:

```
📋 Requirements Preview: {plan_name}

Goal: {goal}
Work Type: {type} ({confidence}% confidence)

Requirements Captured:
  1. {req-1-description}
     Notes: {req-1-notes}
     Open Questions: {req-1-questions}

  2. {req-2-description}
     Notes: {req-2-notes}

  [Show first 3-4 requirements, summarize rest if more]

💡 This is a conceptual plan. Use /session:plan-finalize to transform requirements into executable tasks.

Options:
  1. ✓ Save this plan (recommended)
  2. Cancel
```

### Step 7: Get User Choice

Use the AskUserQuestion tool to get the user's choice.

Handle the response:
- **Option 1 (Save)**: Continue to Step 8
- **Option 2 (Cancel)**: Show "Plan creation cancelled" and STOP

### Step 8: Validate Requirements

Validate the requirements against requirements-schema.json:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js validate-requirements '{requirements_json}'
```

If validation fails, show the errors and STOP:
```
❌ Validation errors found:
  1. {error_1}
  2. {error_2}

Cannot save invalid plan. Please review.
```

If validation succeeds, continue.

### Step 9: Save Requirements File

Create the requirements.json file using the global plans directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js save-requirements {plan_name} '{requirements_json}'
```

This creates:
- `.claude/plans/{plan_name}/requirements.json`

Also create a conversation context markdown file for reference (if conversation was analyzed):
- Path: `.claude/plans/{plan_name}/conversation-context.md`
- Content: Include conversation summary, key decisions, requirements discussion, etc.
- If no session context, skip this file or create with placeholder noting manual plan creation

### Step 10: Display Success

Show success message with next steps:

```
✓ Global plan saved: {plan_name}

📋 Plan Details:
   • Type: Conceptual (requirements captured)
   • Work type: {type} (detected with {confidence}% confidence)
   • Requirements: {requirement_count}
   • Location: .claude/plans/{plan_name}/requirements.json
   • Scope: Global (accessible from any session)

📝 Next Steps:

   1. Review requirements:
      /session:plan-status {plan_name}

   2. List all plans:
      /session:plan-list

   3. Transform into executable plan:
      /session:plan-finalize {plan_name}

      This will use AI to break down requirements into concrete tasks
      organized by implementation phases (Database, API, UI, etc.)

   4. After finalization, execute:
      /session:plan-execute {plan_name}

💡 Plans are now global and accessible from any session. No need to be in a specific session to work with plans.
```

---

## Error Handling

At each step, handle errors gracefully:

- **File not found**: Show clear message with suggestion on how to proceed
- **Validation failed**: Show specific validation errors
- **Detection low confidence**: Accept it (work type is just metadata)
- **Parse errors**: Show error details and abort
- **CLI command failures**: Check exit codes and show appropriate error messages

Always provide actionable next steps when errors occur.

---

## Key Principles

**Planning Phase = Requirements Capture**

- Users discuss WHAT they want (requirements), not HOW to implement (tasks)
- Keep it lightweight and exploratory
- Allow for open questions and uncertainty
- No forced structure - just capture what was discussed

**Examples of Good Requirements:**
- "Restrict products based on user permissions"
- "Track who created each product"
- "Add audit logging for product changes"
- "Improve product search performance"

**Examples of Bad (Too Detailed for Planning):**
- "Add restriction_level column to public.new_product table" ← This is a task!
- "Create POST /api/products validation" ← This is a task!
- "Add checkbox in product form component" ← This is a task!

The transformation from requirements → tasks happens in /session:plan-finalize.

---

## Notes

- The ${CLAUDE_PLUGIN_ROOT} environment variable should point to the session plugin source directory
- Plans are now global - stored in `.claude/plans/` regardless of active session
- The {session_name} variable is optional - used only if there's an active session for conversation context
- All CLI commands should use absolute paths
- Error messages should be user-friendly and actionable
- The workflow is designed to be interruptible - user can cancel at any point
- Conceptual plans use requirements.json format (not orchestration.json)
- Plans can be created with or without session context (conversation analysis is optional)
