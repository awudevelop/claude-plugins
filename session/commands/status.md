You are managing a session memory system. The user wants to check the current session status.

## Task: Display Session Status

**OPTIMIZATION:** Uses pre-formatted CLI output (~60% token reduction).

### Step 1: Get Active Session

Run the CLI command to get active session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list
```

Parse the JSON response to get `activeSession` field.

If `activeSession` is null, show error:
```
❌ No active session

💡 /session:start [name] to create new session
💡 /session:continue [name] to resume existing session
```
Then STOP.

### Step 2: Get Pre-formatted Status

Run the CLI stats command with `--formatted` flag:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js stats {activeSession} --formatted
```

**Output the result directly** - no parsing or formatting needed. The CLI returns ready-to-display output with:
- Session name and status
- Duration (calculated)
- Snapshot count
- File count
- Last activity (relative time)
- Action hints

Then STOP.

---

**PERFORMANCE:**
- **CLI calls:** 2 (list + stats --formatted)
- **Token reduction:** ~60% (no Claude formatting)
- **Speed:** <50ms total

**ERROR HANDLING:**
- If CLI command fails, show error and suggest rebuilding index
