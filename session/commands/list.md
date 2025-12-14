You are managing a session memory system. The user wants to see all available sessions.

## Task: List All Sessions (Interactive Selection)

**OPTIMIZATION:** Uses pre-formatted CLI output (~75% token reduction).

---

## Step 1: Detect Mode

Check if user provided arguments:
- If user provided a **number** (e.g., `/session:list 2`) → Jump to **Step 3: Handle Selection**
- If user typed `/session:list` with no args → Continue to Step 2

---

## Step 2: Display Sessions (Pre-formatted)

Run the CLI command with `--formatted` flag for pre-rendered output:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list --formatted
```

**Output the result directly** - no parsing or formatting needed. The CLI returns ready-to-display markdown with badges, relative times, and session details.

Then **STOP and wait for user input**. Do not prompt further.

---

## Step 3: Handle Selection (Interactive Mode)

If user provided a number (e.g., `/session:list 2`), this is interactive selection mode.

### 3.1: Validate Selection

1. Get session list again (same CLI command)
2. Check if number is valid (1 to totalSessions)
3. If invalid, show error and STOP:
   ```
   ❌ Invalid selection. Please choose 1-{totalSessions}.
   ```

### 3.2: Show Session Details

Display the selected session with full details:

```
Selected Session: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Status: {status} {badges}
📅 Started: {started}
📅 Last Update: {lastUpdated}
📸 Snapshots: {snapshotCount}
📁 Files Involved: {filesInvolvedCount}

🎯 Goal:
{goal}

{if latestSnapshotSummary:}
💬 Latest Snapshot:
{latestSnapshotSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.3: Use AskUserQuestion Tool

Present action options using the AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "What would you like to do with this session?",
      "header": "Action",
      "multiSelect": false,
      "options": [
        {
          "label": "Continue/Resume",
          "description": "Load session context and continue working"
        },
        {
          "label": "View Status",
          "description": "Show detailed session statistics and state"
        },
        {
          "label": "Save Snapshot",
          "description": "Capture current conversation as a snapshot"
        },
        {
          "label": "Close Session",
          "description": "Finalize and close this session"
        },
        {
          "label": "Delete Session",
          "description": "Permanently delete this session and all its data"
        },
        {
          "label": "Back to List",
          "description": "Return to session list"
        }
      ]
    }
  ]
}
```

### 3.4: Execute Selected Action

Based on user's choice, execute the appropriate command:

- **Continue/Resume** → Run: `/session:continue {sessionName}`
- **View Status** → Run: `/session:status` (after activating if needed)
- **Save Snapshot** → Run: `/session:save`
- **Close Session** → Run: `/session:close`
- **Delete Session** → Run: `/session:delete {sessionName}`
- **Back to List** → Run: `/session:list` (restart from Step 2)

**Important:** Actually execute the command, don't just tell the user to run it.

---

## Error Handling

If CLI command fails, show:
```
❌ Error reading sessions. Try rebuilding the index:
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-index --full-rebuild
```

---

## Performance Benefits

- **Display Mode:** ~100 tokens (pre-formatted), < 50ms
- **Selection Mode:** ~300-500 tokens total
- **~75% token reduction** from pre-formatted output
- **No file reads** for list display (index only)
