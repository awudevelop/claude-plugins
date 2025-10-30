# 📦 Installing Session Auto-Capture Hooks

**Simple guide for non-developers to add intelligent session snapshots to any Claude Code project**

---

## What This Does

These hooks automatically save snapshots of your work sessions with Claude at natural stopping points - like when you finish a feature, change topics, or complete a task. It's completely automatic and runs in the background with zero delay.

---

## Step 1: Show Hidden Files on Mac

The `.claude` folder is hidden by default. To see it:

1. Open **Finder**
2. Navigate to your project folder
3. Press **`Command (⌘) + Shift + .`** (period key)
4. Hidden folders will now appear grayed out
5. You should now see the `.claude` folder

**Tip:** Press `Command + Shift + .` again to hide them when done.

---

## Step 2: Check if .claude Folder Exists

Look for a `.claude` folder in your project:

- ✅ **If you see `.claude/`** → Great! Skip to Step 4
- ❌ **If you DON'T see `.claude/`** → Continue to Step 3

---

## Step 3: Create .claude Folder (If Needed)

If your project doesn't have a `.claude` folder yet:

### Option A: Using Finder
1. With hidden files visible, right-click in your project folder
2. Select **New Folder**
3. Name it **exactly** `.claude` (must start with a period)
4. Press Enter

### Option B: Using Terminal
1. Open **Terminal** app
2. Type: `cd ~/path/to/your/project`
   - Replace `~/path/to/your/project` with your actual project path
3. Type: `mkdir -p .claude/hooks .claude/commands`
4. Press Enter

---

## Step 4: Copy the Hook Files

You should have received these files:

**Hooks (go in `.claude/hooks/` folder):**
- `user-prompt-submit.js`
- `post-tool-use.js`
- `suggestion-detector.js`
- `README.md`
- `AUTO-CAPTURE-DESIGN.md`

**Commands (go in `.claude/commands/` folder):**
- `session-start.md`
- `session-save.md`
- `session-status.md`
- `session-list.md`
- `session-continue.md`
- `session-close.md`
- `session-auto-snapshot.md`
- `session-snapshot-analysis.md`

### How to Copy:

1. With hidden files visible in Finder
2. Open your project folder
3. Drag the **hook files** into `.claude/hooks/`
4. Drag the **command files** into `.claude/commands/`

**Done!** Files are now in place.

---

## Step 5: Update settings.json

This is the most important step - it tells Claude Code to use these hooks.

### Check if settings.json exists:

1. Navigate to `.claude/` folder
2. Look for `settings.json`

### If settings.json EXISTS:

1. Open `.claude/settings.json` in your code editor
2. Find the `"hooks"` section (or add it if missing)
3. Add the new hooks to the configuration

**Example of what to add:**

```json
{
  "enableAllProjectMcpServers": true,
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/user-prompt-submit.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.js Write"
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.js Edit"
          }
        ]
      }
    ]
  }
}
```

**Important Notes:**
- If you already have a `"hooks"` section, **merge** the new hooks with existing ones
- Don't delete existing hooks - add these alongside them
- Make sure JSON syntax is correct (commas, brackets, etc.)
- **Save the file** when done

### If settings.json DOES NOT EXIST:

1. Create a new file in `.claude/` folder named `settings.json`
2. Paste this complete configuration:

```json
{
  "enableAllProjectMcpServers": true,
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/user-prompt-submit.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.js Write"
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.js Edit"
          }
        ]
      }
    ]
  }
}
```

3. Save the file

---

## Step 6: Restart Claude Code

1. Completely quit Claude Code (Command + Q)
2. Reopen Claude Code
3. Open your project

**That's it!** The hooks are now active.

---

## How to Know It's Working

The hooks work silently in the background, but you can check:

### Method 1: Try New Commands
Type any of these in Claude:
- `/session-status` - See current session info
- `/session-list` - List saved sessions
- `/session-save` - Manually save a snapshot

If these commands work, your hooks are installed correctly!

### Method 2: Check for State File
After a few interactions with Claude:
1. Navigate to `.claude/hooks/` folder
2. Look for a file named `session-state.json`
3. If it exists, the hooks are tracking your session!

---

## Troubleshooting

### "Command not found" error
- Make sure files are in the correct folders
- Verify `settings.json` is saved properly
- Restart Claude Code completely

### Commands don't appear
- Check that `.md` files are in `.claude/commands/` folder
- Restart Claude Code
- Try typing `/session` and see if autocomplete shows session commands

### Hooks not running
- Verify `settings.json` syntax (use a JSON validator)
- Make sure Node.js is installed (type `node --version` in Terminal)
- Check that `.js` files are in `.claude/hooks/` folder

### Still having issues?
1. Open Terminal
2. Navigate to your project: `cd ~/path/to/your/project`
3. Run: `ls -la .claude/hooks/`
4. Verify you see: `user-prompt-submit.js`, `post-tool-use.js`, `suggestion-detector.js`
5. Run: `cat .claude/settings.json`
6. Verify the hooks section exists

---

## What Gets Created

Once running, these hooks will create:

- `.claude/hooks/session-state.json` - Tracks your current session
- `.claude/sessions/` folder - Stores saved session snapshots
- Automatic snapshots when natural breakpoints are detected

**All of this happens automatically - you don't need to do anything!**

---

## Folder Structure (Final)

When everything is installed, your `.claude` folder should look like this:

```
.claude/
├── commands/
│   ├── session-start.md
│   ├── session-save.md
│   ├── session-status.md
│   ├── session-list.md
│   ├── session-continue.md
│   ├── session-close.md
│   ├── session-auto-snapshot.md
│   └── session-snapshot-analysis.md
├── hooks/
│   ├── user-prompt-submit.js
│   ├── post-tool-use.js
│   ├── suggestion-detector.js
│   ├── README.md
│   └── AUTO-CAPTURE-DESIGN.md
├── sessions/ (created automatically)
└── settings.json
```

---

## Need Help?

If you're stuck:
1. Ask Claude Code: "Can you help me configure the session auto-capture hooks?"
2. Share this guide with your team member who set it up
3. Check the README.md in `.claude/hooks/` for technical details

---

## Quick Copy-Paste Checklist

Use this to verify everything is complete:

- [ ] Can see `.claude` folder (Command + Shift + .)
- [ ] Created `.claude/hooks/` folder (if needed)
- [ ] Created `.claude/commands/` folder (if needed)
- [ ] Copied all `.js` files to `.claude/hooks/`
- [ ] Copied all `.md` files to `.claude/commands/`
- [ ] Created or updated `.claude/settings.json`
- [ ] Added hooks configuration to settings.json
- [ ] Saved settings.json file
- [ ] Restarted Claude Code
- [ ] Tested `/session-status` command

**All checked?** You're done! 🎉

---

**Version:** 2.1 - Intelligent Auto-Capture
**Last Updated:** January 2025
**Questions?** Ask in your team channel or ask Claude directly!
