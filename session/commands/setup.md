You are helping the user configure session plugin hooks in their project's `.claude/settings.json` file.

## Task: Setup Session Plugin Hooks

This command manages the automatic configuration of session plugin hooks that enable auto-tracking of sessions, user interactions, and file modifications.

**IMPORTANT:** This command uses the session CLI tool to perform hook management operations safely with atomic writes and backups.

### Parse Command Arguments

Extract the operation from the command arguments. Format: `/session:setup [options]`

**Supported options:**
- No arguments: Install/configure hooks (default)
- `--remove`: Remove hooks from settings.json
- `--status`: Show current hook configuration
- `--force-cleanup`: Force cleanup of orphaned hooks
- `--dry-run`: Preview changes without applying them

### Step 1: Determine Operation Mode

1. Check arguments to determine which operation to perform:
   - **Install mode** (default/no args): Add hooks to settings.json
   - **Remove mode** (`--remove`): Remove hooks from settings.json
   - **Status mode** (`--status`): Show current configuration
   - **Cleanup mode** (`--force-cleanup`): Clean up orphaned hooks
   - **Dry run** (`--dry-run`): Can be combined with other modes to preview

### Step 2: Execute CLI Command

Run the appropriate CLI command based on the operation mode:

**For Install:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js setup-hooks
```

**For Remove:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js setup-hooks --remove
```

**For Status:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js setup-hooks --status
```

**For Force Cleanup:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js setup-hooks --force-cleanup
```

**For Dry Run (example with install):**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js setup-hooks --dry-run
```

The CLI will return JSON with the operation result.

### Step 3: Display Results

Parse the JSON response and display user-friendly output based on the action:

#### Install Success (action: "installed")
```
✅ Session plugin hooks configured successfully!

📋 Hooks added to .claude/settings.json:
  ✓ SessionStart - Auto-clears session on /clear
  ✓ UserPromptSubmit - Tracks user interactions
  ✓ PostToolUse (Write, Edit, NotebookEdit) - Tracks file changes

🎯 Sessions now automatically track:
  • Session state changes
  • User prompts and interactions
  • File modifications

💾 Backup saved: {backupPath}
📁 Settings: {settingsPath}

💡 To disable temporarily: Set "disableAllHooks": true in settings.json
💡 To remove these hooks: /session:setup --remove
```

#### Already Configured (action: "already_configured")
```
ℹ️  Session plugin hooks are already configured!

✓ All session plugin hooks are properly configured in settings.json

Current hooks:
  ✓ SessionStart - Active
  ✓ UserPromptSubmit - Active
  ✓ PostToolUse - Active

💡 To reinstall: /session:setup --remove, then /session:setup
💡 To view details: /session:setup --status
```

#### Remove Success (action: "removed")
```
✅ Session plugin hooks removed!

📋 Removed from .claude/settings.json:
  ✓ SessionStart
  ✓ UserPromptSubmit
  ✓ PostToolUse

💾 Backup saved: {backupPath}

💡 Sessions still work, but automatic tracking is disabled
💡 To re-enable: /session:setup
```

#### Not Configured (action: "not_configured")
```
ℹ️  No session plugin hooks found

Session plugin hooks are not currently configured in settings.json

💡 To install hooks: /session:setup
💡 This will enable automatic session tracking
```

#### Status Display (action: "status")

**When properly configured:**
```
✅ Session Plugin Hooks Status

📋 Configured in .claude/settings.json:

  ✓ SessionStart
    → node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js

  ✓ UserPromptSubmit
    → node ${CLAUDE_PLUGIN_ROOT}/hooks/user-prompt-submit.js

  ✓ PostToolUse (3 matchers)
    → Write: node ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.js
    → Edit: node ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.js
    → NotebookEdit: node ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.js

🎯 Plugin Status: Installed & Configured
✅ All hooks pointing to valid scripts

📊 {configuredHookTypes}/{totalHookTypes} hook types configured

💡 To remove: /session:setup --remove
```

**When orphaned (plugin uninstalled but hooks remain):**
```
⚠️  Session Plugin Hooks Status

📋 Found in .claude/settings.json:

  ⚠️  SessionStart
    → node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js
    ❌ Script not found (plugin may be uninstalled)

  ⚠️  UserPromptSubmit
    ❌ Script not found

  ⚠️  PostToolUse (3 matchers)
    ❌ All scripts not found

🔍 Plugin Status: Not Found
❌ Hooks are orphaned (pointing to missing files)

Found {orphanedHooks.length} orphaned hook entries

🧹 Cleanup Options:
  1. Auto-cleanup: /session:setup --force-cleanup
  2. Manual cleanup: Edit .claude/settings.json
  3. Reinstall plugin to restore functionality
```

#### Cleanup Success (action: "cleaned")
```
✅ Orphaned hooks cleaned up!

🧹 Removed {removedCount} orphaned hook entries:
{List each orphaned hook that was removed}

💾 Backup saved: {backupPath}

💡 Settings.json has been cleaned
💡 To reinstall hooks: /session:setup
```

#### No Orphans (action: "no_orphans")
```
✅ No orphaned hooks found

All hooks in settings.json are valid

💡 Everything looks good!
```

#### Error Cases

**On error (success: false):**
```
❌ Error: {error message}

{Provide helpful context based on the error:}

Common issues:
- **Malformed JSON**: settings.json has syntax errors
  → Fix: Restore from backup or manually repair JSON

- **Permission denied**: No write access to .claude/settings.json
  → Fix: Check file permissions

- **Plugin not found**: Session plugin may not be installed
  → Fix: Reinstall the session plugin

💡 To restore from backup: cp .claude/settings.json.backup .claude/settings.json
💡 Need help? Check the README or /session:setup --status
```

### Important Notes

- **Atomic Operations**: All writes use atomic operations with backups
- **Idempotent**: Safe to run multiple times, won't create duplicates
- **Portable Paths**: Uses `${CLAUDE_PLUGIN_ROOT}` variable for cross-platform compatibility
- **Merge Strategy**: Preserves existing hooks when installing
- **Safety**: Creates `.backup` file before any modifications

### Usage Examples

```bash
# Install hooks (first time setup)
/session:setup

# Check current status
/session:setup --status

# Preview what would be installed (dry run)
/session:setup --dry-run

# Remove hooks before uninstalling plugin
/session:setup --remove

# Clean up orphaned hooks after plugin uninstall
/session:setup --force-cleanup
```

---

**CRITICAL for Plugin Uninstallation:**

Before uninstalling the session plugin, users should run:
```bash
/session:setup --remove
```

This ensures clean removal and prevents orphaned hook entries in settings.json.
