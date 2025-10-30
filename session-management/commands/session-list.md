You are managing a session memory system. The user wants to see all available sessions.

## Task: List All Sessions

Display all sessions with their metadata in a clean, organized format.

### Step 1: Read Active Session

1. Check if `.claude/sessions/.active-session` file exists
2. If exists, read it to get the currently active session name
3. Store this for marking active sessions in the display

### Step 2: Scan Sessions Directory

1. List all directories in `.claude/sessions/`
2. Exclude the `.active-session` file (it's not a directory)
3. Exclude any hidden files/folders (starting with '.' except already excluded)
4. Store the list of session folder names

### Step 3: Handle No Sessions Case

If no session directories found, show:
```
No sessions found.

💡 Create your first session with:
   /session start [name]

Example:
   /session start my-feature
```
Then STOP.

### Step 4: Extract Metadata for Each Session

For each session directory, read `.claude/sessions/{name}/session.md` and extract:
- **Status**: Active or Closed
- **Started**: Timestamp when session was created
- **Last Updated**: Most recent update timestamp
- **Goal**: The main goal/purpose of the session
- **Closed**: Timestamp if closed (if applicable)

Handle missing session.md gracefully:
- If session.md doesn't exist, show "[Corrupted - missing session.md]"
- Continue processing other sessions

### Step 5: Count Snapshots

For each session, count the number of snapshot files (files matching `YYYY-MM-DD_HH-MM.md` pattern) to show activity level.

### Step 6: Sort Sessions

Sort sessions by "Last Updated" timestamp (most recent first), with active session always shown first.

### Step 7: Display Sessions List

Format the output as:

```
Available Sessions:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each session, numbered starting from 1:}

{number}. {session-name} {if_active_show:"[ACTIVE]"}
   Started: {started_date_formatted}
   Last update: {last_updated_formatted}
   Goal: {goal_first_80_chars}
   Snapshots: {snapshot_count}
   {if_closed_show:"Status: Closed on {closed_date}"}

{separator line between sessions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: {count} session(s)

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
   Status: Closed on 2025-10-22 11:30

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

**IMPORTANT**:
- Use Bash tool with `ls` to list directories
- Use Read tool to read session.md files
- Handle errors gracefully (missing files, corrupted sessions)
- Format dates consistently
- Show clear visual hierarchy
- Number sessions for easy reference
