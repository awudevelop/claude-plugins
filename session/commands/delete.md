You are managing a session memory system. The user wants to delete a session permanently.

## Task: Delete Session

Delete a session and all its data. This action cannot be undone.

**IMPORTANT:** This is a destructive operation. Always confirm with the user before deleting.

---

## Step 1: Parse Arguments

Check if user provided a session name:
- If user provided a session name (e.g., `/session:delete old-feature`) → Use that name
- If no name provided → Show error and list available sessions for reference

If no session name provided:
```
❌ Session name required.

Usage: /session:delete [session-name]

Available sessions: /session:list
```
Then STOP.

---

## Step 2: Get Session Details

Run the CLI command to get session information:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get [session-name]
```

If the command fails (session not found), display:
```
❌ Session '[session-name]' not found.

Available sessions: /session:list
```
Then STOP.

---

## Step 3: Check If Active Session

Check if this is the currently active session by running:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list --json
```

Parse the JSON and check if `activeSession === session-name`.

---

## Step 4: Show Confirmation Prompt

Use the AskUserQuestion tool to confirm deletion.

### If NOT the active session:

```json
{
  "questions": [
    {
      "question": "⚠️ Delete Session: [session-name]\n\n📅 Started: [started]\n📸 Snapshots: [count]\n📁 Files Involved: [count]\n\nThis will permanently delete all session data.\n\nAre you sure you want to delete this session?",
      "header": "Confirm Delete",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes, Delete",
          "description": "Permanently delete this session and all its data"
        },
        {
          "label": "No, Cancel",
          "description": "Keep the session and go back"
        }
      ]
    }
  ]
}
```

### If IS the active session:

```json
{
  "questions": [
    {
      "question": "⚠️ WARNING: Deleting ACTIVE Session!\n\n'[session-name]' is your currently active session.\n\n📅 Started: [started]\n📸 Snapshots: [count]\n📁 Files Involved: [count]\n\nDeleting this will:\n- End your current working session\n- Delete all snapshots and context\n- Clear the active session\n\nThis cannot be undone.\n\nAre you ABSOLUTELY SURE?",
      "header": "Delete Active",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes, Delete Active Session",
          "description": "I understand this will end my active session"
        },
        {
          "label": "No, Cancel",
          "description": "Keep the session and go back"
        }
      ]
    }
  ]
}
```

---

## Step 5: Handle User Response

### If user selected "No, Cancel":
```
Session deletion cancelled.
```
Then STOP.

### If user selected "Yes" (or "Yes, Delete Active Session"):

Proceed to Step 6.

---

## Step 6: Execute Deletion

Run the CLI delete command:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js delete [session-name]
```

The CLI will:
- Delete the session directory and all files
- Remove from index
- Clear active session if needed

---

## Step 7: Display Result

Parse the JSON response from the delete command.

### If successful:

**For regular session:**
```
✅ Session '[session-name]' has been deleted.

📊 Deleted:
- [count] snapshots
- [count] files tracked

💡 View remaining sessions: /session:list
```

**For active session:**
```
✅ Session '[session-name]' has been deleted.

📊 Deleted:
- [count] snapshots
- [count] files tracked

⚠️ No active session. Start a new one:
   /session:start [name]

💡 View remaining sessions: /session:list
```

### If error occurred:

```
❌ Error deleting session: [error message]

Try rebuilding the index:
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-index --full-rebuild
```

---

## Error Handling

- **Session not found:** Show available sessions list
- **Permission error:** Show clear error message about file permissions
- **Active session:** Show extra warning and confirmation
- **CLI error:** Show error and suggest index rebuild

---

## Performance

- **Single confirmation:** < 300 tokens
- **CLI deletion:** < 50ms for small sessions, < 500ms for large sessions
- **Total time:** 1-2 seconds including user confirmation

---

## Safety Features

1. ✅ **Always requires confirmation** - No accidental deletions
2. ✅ **Shows what will be deleted** - User knows the impact
3. ✅ **Extra warning for active session** - Prevents losing current work
4. ✅ **Clear feedback** - User knows what happened
5. ✅ **Graceful error handling** - Helpful messages on failure
