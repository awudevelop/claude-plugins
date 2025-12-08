You are executing the /session:plan-summary command to export a plan to readable markdown.

**NOTE:** Plans are now global and independent of sessions.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- Correct: `/session:plan-summary`, `/session:plan-status`, `/session:plan-list`
- Wrong: `/plan-summary`, `/plan-status`, `/plan-list`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required - the name of the plan to summarize)

ARGUMENTS: {name}

## Purpose

This command generates a comprehensive markdown summary of a plan including:
- Plan name, goal, and status
- Progress percentage with task counts
- Phase breakdown with task checkmarks
- Confidence summary (high/medium/low counts)

## Workflow

### Step 1: Validate Plan Name

If no plan_name is provided, show error:
```
Error: Plan name required

Usage: /session:plan-summary <plan-name>

Use /session:plan-list to see available plans.
```

### Step 2: Generate Summary

Call the CLI command to generate the plan summary:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-summary {plan_name}
```

This returns JSON with:
```json
{
  "success": true,
  "data": {
    "markdown": "# Plan: ...",
    "planName": "...",
    "progress": 50,
    "confidenceStats": { "high": 5, "medium": 2, "low": 1 }
  }
}
```

### Step 3: Display Summary

If successful, display the markdown content directly:

```
{markdown_content}
```

The markdown will include:
- Plan header with goal and status
- Progress percentage and task counts
- Confidence breakdown (High/Medium/Low)
- Phase sections with task checkmarks:
  - [x] Completed tasks
  - [>] In progress tasks
  - [ ] Pending tasks
  - [!] Failed/blocked tasks
  - [~] Skipped tasks

### Step 4: Show Next Actions

After displaying the summary, show helpful next actions:

```
---

Next Actions:
- /session:plan-execute {plan_name} - Continue execution
- /session:plan-status {plan_name} - Detailed status with recommendations
- /session:plan-list - View all plans
```

## Error Handling

**Plan not found:**
```
Error: Plan '{plan_name}' not found

Use /session:plan-list to see available plans.
Use /session:plan-save <name> to create a new plan.
```

**Invalid plan format:**
```
Error: Plan '{plan_name}' is in conceptual format

Use /session:plan-finalize {plan_name} to transform it into an executable plan first.
```

## Example Output

```
# Plan: auth-system

**Goal**: Implement OAuth2 authentication with Google and GitHub providers
**Status**: in_progress
**Progress**: 8/15 tasks (53%)

**Confidence**: High: 12 | Medium: 2 | Low: 1

---

## Phases

### Database Layer
Status: completed

- [x] Create users table with OAuth fields [high]
- [x] Add sessions table [high]
- [x] Create OAuth tokens table [high]

### API Layer
Status: in_progress

- [x] Implement OAuth callback routes [high]
- [x] Add JWT token generation [high]
- [>] Configure passport.js strategies [medium]
- [ ] Add session middleware [high]
- [ ] Implement token refresh [medium]

### UI Layer
Status: pending

- [ ] Create login page component [high]
- [ ] Add OAuth buttons [high]
- [ ] Implement auth context [high]
- [ ] Add protected route wrapper [high]
```
