You are executing the /session:plan-list command to list all global plans.

**NOTE:** Plans are global and stored in `.claude/plans/`. This command works without requiring an active session.

**OPTIMIZATION:** Uses pre-formatted CLI output (~85% token reduction).

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`

## Workflow

### Step 1: Get Pre-formatted Plan List

Run the CLI command with `--formatted` flag for pre-rendered output:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-list --formatted
```

**Output the result directly** - no parsing or formatting needed. The CLI returns ready-to-display markdown with:
- Plan names and types (conceptual vs implementation)
- Progress bars for implementation plans
- Status badges (✅ completed, 🔄 in-progress, ○ pending)
- Relative timestamps
- Next action hints

Then **STOP and wait for user input**. Do not prompt further.

---

## Error Handling

If CLI command fails, show:
```
❌ Error reading plans. Check .claude/plans/ directory exists.
```

---

## Notes

- This command does NOT require an active session
- Plans are stored globally in `.claude/plans/`
- Use `/session:plan-status {name}` for detailed information about a specific plan
