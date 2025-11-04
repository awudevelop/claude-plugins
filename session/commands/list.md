You are managing a session memory system. The user wants to see all available sessions.

## Task: List All Sessions (Enhanced with Interactive Selection)

Display all sessions with enhanced metadata in a clean, organized format. Optionally enable interactive selection mode.

**OPTIMIZATION:** This command uses the lightweight CLI tool for instant metadata retrieval (< 10ms, < 200 tokens).

---

## Step 1: Detect Mode

Check if user provided arguments:
- If user provided a **number** (e.g., `/session:list 2`) → Jump to **Step 5: Handle Selection**
- If user typed `/session:list` with no args → Continue to Step 2 (display mode)

---

## Step 2: Get Session List from CLI

Run the CLI command to get all session metadata:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list
```

This returns JSON with all session data from the index (no file reading needed).

---

## Step 3: Handle Empty Sessions

If the JSON shows `totalSessions: 0`, display:
```
No sessions found.

💡 Create your first session with:
   /session:list [name]

Example:
   /session:start my-feature
```
Then STOP.

---

## Step 4: Format and Display Sessions (Enhanced)

Parse the JSON response and format with **enhanced visual design**:

### Calculate Stats:
- Count active vs closed sessions
- Calculate relative times (use helper function below)
- Determine activity status for badges

### Display Format:

```
Available Sessions ({activeCount} active, {closedCount} closed):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each session in sessions array:}

{number}. {name} {badges}
   📅 {relativeTime} (started {relativeStartTime})  📸 {snapshotCount} snapshots  📁 {filesInvolvedCount} files
   🎯 {goal}
   {if latestSnapshotSummary exists: show "💬 Last: \"{latestSnapshotSummary}\""}

{blank line between sessions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Select a session: /session:list [number]
💡 Create new: /session:start [name]
```

### Badges Logic:
- If `session.name === activeSession`: Show `[ACTIVE] 🔥`
- If `status === "closed"`: Show `✅ CLOSED`
- If last update > 7 days and not closed: Show `⚠️ INACTIVE`
- If last update < 1 hour: Show `🔥 HOT`

### Relative Time Helper:

Calculate relative time for display:
- < 1 minute: "just now"
- < 60 minutes: "{n}m ago"
- < 24 hours: "{n}h ago"
- < 7 days: "{n}d ago"
- < 30 days: "{n}w ago"
- >= 30 days: "{n} months ago"

### Example Output:

```
Available Sessions (2 active, 1 closed):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. feature-auth-system [ACTIVE] 🔥 HOT
   📅 2h ago (started 3d ago)  📸 5 snapshots  📁 12 files
   🎯 Implement OAuth2 authentication system
   💬 Last: "Completed login flow, testing redirect logic"

2. bugfix-login-issue ✅ CLOSED
   📅 1d ago (started 2d ago)  📸 3 snapshots  📁 4 files
   🎯 Fix session timeout bug in login flow

3. refactor-api-layer ⚠️ INACTIVE
   📅 14d ago (started 15d ago)  📸 8 snapshots  📁 23 files
   🎯 Refactor REST API to GraphQL architecture

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Select a session: /session:list [number]
💡 Create new: /session:start [name]
```

After displaying, **STOP and wait for user input**. Do not prompt further.

---

## Step 5: Handle Selection (Interactive Mode)

If user provided a number (e.g., `/session:list 2`), this is interactive selection mode.

### 5.1: Validate Selection

1. Get session list again (same CLI command)
2. Check if number is valid (1 to totalSessions)
3. If invalid, show error and STOP:
   ```
   ❌ Invalid selection. Please choose 1-{totalSessions}.
   ```

### 5.2: Show Session Details

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

### 5.3: Use AskUserQuestion Tool

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
          "label": "Back to List",
          "description": "Return to session list"
        }
      ]
    }
  ]
}
```

### 5.4: Execute Selected Action

Based on user's choice, execute the appropriate command:

- **Continue/Resume** → Run: `/session:continue {sessionName}`
- **View Status** → Run: `/session:status` (after activating if needed)
- **Save Snapshot** → Run: `/session:save`
- **Close Session** → Run: `/session:close`
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

- **Display Mode:** < 200 tokens, < 50ms
- **Selection Mode:** ~300-500 tokens total
- **No file reads** for list display (index only)
- **95-98% token reduction** vs old approach
