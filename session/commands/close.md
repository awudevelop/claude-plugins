You are managing a session memory system. The user wants to close and finalize the current session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:list`, `/session:start`, `/session:continue`, `/session:status`
- ❌ Wrong: `/session list`, `/session start`, `/session continue`, `/session status`
Use ONLY the exact command formats specified in this template.

## Task: Close Session

Close the currently active session using the CLI command.

### Step 1: Close Session via CLI

Run the close command:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js close --formatted
```

**Handle the response:**

- If `success: false` with `error: "NO_ACTIVE_SESSION"`:
  - Display the `formatted` error message from the response
  - STOP (no further steps)

- If `success: true`:
  - The CLI has already:
    - Updated `.auto-capture-state` (session_status: "closed")
    - Updated `session.md` (Status: Closed, Closed timestamp)
    - Updated index (cleared activeSession)
    - Deleted `.active-session` file
  - Extract the `stats` from the response for display
  - Continue to Step 2

### Step 2: Display Closing Summary

Display the `formatted` output from the CLI response. It includes:
- Session name and duration
- Snapshot count and files modified
- Goal
- Path to session files
- Helpful tips for resuming

### Step 3: Offer Next Steps

Ask the user:
```
Session closed successfully. Would you like to:
1. Start a new session (/session:start [name])
2. Review another session (/session:list)
3. Continue with other work
```

---

**OPTIMIZATION (v3.33.0):**

This command was simplified from 9 manual steps to 1 CLI call:

| Before | After |
|--------|-------|
| Read .active-session | CLI handles |
| Read session.md | CLI handles |
| Calculate stats | CLI handles |
| Create snapshot (optional) | Skipped (continue.md handles) |
| Update context.md | Skipped (use /session:save) |
| Update session.md | CLI handles |
| Delete .active-session | CLI handles |
| Update index | CLI handles |
| Display summary | CLI provides formatted output |

**Tool calls: 1** (Bash for CLI)

**NOTE:** If you need a final snapshot before closing, run `/session:save` first.
