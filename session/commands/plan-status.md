You are executing the /session:plan-status command to show plan execution status.

**NOTE:** Plans are global and stored in `.claude/plans/`.

**OPTIMIZATION:** Uses pre-formatted CLI output (~70% token reduction).

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`

## Arguments

- `plan_name`: {name} (required)

ARGUMENTS: {name}

## Workflow

### Step 1: Get Pre-formatted Plan Status

If plan_name is provided, run the CLI with `--formatted` flag:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status {plan_name} --formatted
```

**Output the result directly** - no parsing or formatting needed. The CLI returns ready-to-display markdown with:
- Plan name, goal, and status badge
- Progress bar with task counts
- Phase breakdown
- Current task info
- Relative timestamps
- Next action hints

If no plan_name provided, show:
```
❌ Plan name required

Usage: /session:plan-status <plan-name>

💡 Use /session:plan-list to see available plans
```
Then STOP.

Then **STOP and wait for user input**.

---

## Error Handling

- Plan not found: Show available plans using `/session:plan-list`
- No plans exist: Suggest creating with `/session:plan-save {name}`
