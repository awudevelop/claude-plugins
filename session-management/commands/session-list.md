You are managing a session memory system. The user wants to see all available sessions.

## Task: List All Sessions

Display all sessions with their metadata in a clean, organized format.

**OPTIMIZATION:** This command now uses the lightweight CLI tool for instant metadata retrieval (< 10ms, < 200 tokens).

### Step 1: Get Session List from CLI

Run the CLI command to get all session metadata:

```bash
node session-management/cli/session-cli.js list
```

This returns JSON with all session data from the index (no file reading needed).

### Step 2: Handle Empty Sessions

If the JSON shows `totalSessions: 0`, display:
```
No sessions found.

💡 Create your first session with:
   /session start [name]

Example:
   /session start my-feature
```
Then STOP.

### Step 3: Format and Display Sessions

Parse the JSON response and format it nicely:

```
Available Sessions:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each session in sessions array:}

{number}. {name} {if session.name === activeSession show "[ACTIVE]"}
   Started: {format started timestamp}
   Last update: {format lastUpdated timestamp}
   Goal: {goal (already truncated to ~100 chars in CLI response)}
   Snapshots: {snapshotCount}
   {if status === "closed" show "Status: Closed"}

{separator line between sessions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: {totalSessions} session(s)

💡 Use /session continue [name] to resume a session
💡 Use /session start [name] to create a new session
```

### Example Output:

```
Available Sessions:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. feature-auth-system [ACTIVE]
   Started: 2025-10-23 14:30
   Last update: 2025-10-23 16:45
   Goal: Implement OAuth2 authentication system
   Snapshots: 5

2. bugfix-login-issue
   Started: 2025-10-22 09:15
   Last update: 2025-10-22 11:30
   Goal: Fix session timeout bug in login flow
   Snapshots: 3
   Status: Closed

3. refactor-api-layer
   Started: 2025-10-20 10:00
   Last update: 2025-10-21 15:20
   Goal: Refactor REST API to GraphQL architecture
   Snapshots: 8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 3 session(s)

💡 Use /session continue [name] to resume a session
💡 Use /session start [name] to create a new session
```

---

**PERFORMANCE BENEFITS:**
- **Before:** 5-10K tokens, reads ALL session.md files, 2-5 seconds
- **After:** < 200 tokens, reads .index.json only, < 50ms
- **Improvement:** ~95-98% token reduction, ~50x faster

**ERROR HANDLING:**
- If CLI command fails, show error message and suggest running:
  `node session-management/cli/session-cli.js update-index --full-rebuild`
