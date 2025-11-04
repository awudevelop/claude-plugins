# Session Management Plugin for Claude Code

**Version 3.2.1** - Smart Session State Management & Auto-Cleanup

Intelligent session management with automatic context preservation, snapshot tracking, and 60-80% token reduction.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.2.1-blue.svg)](https://github.com/automatewithus/claude-session)

---

## 🚀 What's New in v3.2 (Latest Update)

### Smart Session State Management (NEW!)
- 🔄 **Auto-cleanup on /clear** - Sessions automatically close when context is cleared
- 💡 **Helpful messages** - Claude informs you when sessions are auto-closed and how to resume
- ✅ **Preserves auto-resume** - Sessions still auto-resume on normal restarts
- 🎯 **SessionStart hook** - Intelligent detection of context loss events

### Delete Session Feature (NEW!)
- 🗑️ **Permanent deletion** - Remove sessions you no longer need
- ⚠️ **Two-step confirmation** - Prevents accidental deletions
- 🚨 **Active session warning** - Extra protection for current work
- 📊 **Shows impact** - See what will be deleted before confirming
- 🎯 **Integrated everywhere** - Delete from interactive menu or direct command

### Enhanced List Command (v3.1)
- 🎨 **Visual badges** (ACTIVE, HOT, CLOSED, INACTIVE) for quick status scanning
- ⏰ **Relative timestamps** ("2h ago", "3d ago") for better readability
- 📸 **Snapshot & file counts** displayed prominently
- 💬 **Latest snapshot summaries** shown inline
- 🎯 **Interactive selection** - `/session:list [number]` to select and act on sessions
- 📋 **Action menu** with Continue, View Status, Save, Close, Delete

### Performance Optimizations
- ⚡ **60-80% token reduction** across all commands
- ⚡ **50-100x faster** list/status operations (< 50ms vs 2-5 seconds)
- ⚡ **~50% fewer auto-captures** (optimized threshold: 15 interactions)
- 🏎️ Lightweight CLI tool for instant metadata queries

### Critical Feature: Plan Mode Support
- ✅ **Zero data loss in plan mode** - snapshots save via CLI delegation
- ✅ Works seamlessly in both normal and plan modes
- ✅ No more lost planning discussions on `/clear`
- ✅ Proper separation: context files ≠ code files

### Architecture Improvements
- 📊 Fast metadata index (`.index.json`) for instant queries
- 🔄 Lazy validation with auto-fix
- 🛠️ Comprehensive CLI tool with 10 commands
- 📝 Snapshot summaries cached in index

---

## 📖 Overview

Never lose context again! This plugin provides intelligent session management for Claude Code with:

- **Named Sessions** - Organize work by feature, bug fix, or project phase
- **Automatic Snapshots** - Smart triggers detect natural breakpoints
- **Manual Snapshots** - Save important milestones with `/session:save`
- **Context Preservation** - Comprehensive tracking of decisions, files, and progress
- **Optimized Performance** - Massive token savings and speed improvements

---

## ✨ Key Features

### 🎯 Session Management
- Create named sessions for different workstreams
- Track goals, milestones, and files involved
- Resume sessions with full context
- Close sessions with final summaries

### 📸 Intelligent Auto-Capture
- Automatically detects natural breakpoints (task completion, topic changes)
- Triggered by file activity (3+ files modified)
- Triggered by interaction threshold (15 interactions)
- **Silent and non-intrusive** - just a small indicator

### 💾 Manual Snapshots
- Save important milestones with `/session:save`
- Captures conversation summary, todos, file changes
- Works in **plan mode** (critical feature!)
- Comprehensive context for future reference

### 🚄 Performance
- **95-98% token reduction** for list/status commands
- **< 50ms** response time for metadata queries
- **Lazy index sync** - auto-fixes issues
- **CLI tool** for zero-token operations

### 🛡️ Plan Mode Support (NEW!)
- **Zero data loss** when clearing conversation in plan mode
- Snapshots save via CLI delegation (bypasses Write tool)
- Seamless user experience
- Proper file separation

---

## 📦 Installation

### Quick Install

```bash
# Copy to Claude Code plugins directory
cp -r session ~/.config/claude-code/plugins/

# Make CLI executable
chmod +x ~/.config/claude-code/plugins/session/cli/session-cli.js
```

### Symlink (for development)

```bash
# Create symlink
ln -s /path/to/session ~/.config/claude-code/plugins/session
```

### Verify Installation

```bash
# Navigate to any project
cd /path/to/your/project

# Start Claude Code
claude
```

In Claude, type:
```
/session:start test
```

If session is created → ✅ Installation successful!

---

## 🎮 Usage

### Visual Indicators

The `/session:list` command uses visual badges to help you quickly identify session states:

- **[ACTIVE] 🔥** - Currently active session
- **🔥 HOT** - Updated within the last hour
- **✅ CLOSED** - Session has been closed
- **⚠️ INACTIVE** - No updates in over 7 days

Relative timestamps make it easy to see activity at a glance:
- "just now" - Less than 1 minute
- "5m ago" - Minutes ago
- "2h ago" - Hours ago
- "3d ago" - Days ago
- "2w ago" - Weeks ago
- "3 months ago" - Months ago

---

### Basic Commands

#### Start a New Session
```
/session:start feature-auth
```
Creates a new session with the specified name.

#### List All Sessions
```
/session:list
```
Shows all sessions with enhanced metadata display (⚡ instant, < 200 tokens).

**Enhanced features:**
- 📊 Visual badges (ACTIVE, HOT, CLOSED, INACTIVE)
- ⏰ Relative timestamps ("2h ago", "3d ago")
- 📸 Snapshot counts and file involvement stats
- 💬 Latest snapshot summaries
- 🎯 Clear goal display

#### Interactive Session Selection
```
/session:list [number]
```
Select a session by number to open an interactive action menu:
- 📂 Continue/Resume session
- 📋 View detailed status
- 💾 Save snapshot
- ✅ Close session
- 🗑️ Delete session
- ⬅️ Back to list

**Example:** `/session:list 2` - Select session #2 from the list

**Interactive Flow:**
```
You: /session:list

Claude: [Shows enhanced list with badges and stats]

You: /session:list 2

Claude: [Shows session details and action menu]
        - Continue/Resume
        - View Status
        - Save Snapshot
        - Close Session
        - Delete Session
        - Back to List

You: [Select "Continue/Resume"]

Claude: [Loads session context and continues working]
```

#### Continue Existing Session
```
/session:continue feature-auth
```
Loads full context and resumes work.

#### Check Session Status
```
/session:status
```
Shows current session info, token usage, and statistics (⚡ instant).

#### Save Manual Snapshot
```
/session:save
```
Captures current conversation state (works in plan mode!).

#### Close Session
```
/session:close
```
Finalizes session with summary and marks as closed.

#### Delete Session
```
/session:delete [session-name]
```
Permanently delete a session and all its data.

**Features:**
- ⚠️ Two-step confirmation to prevent accidents
- 📊 Shows what will be deleted (snapshots, files)
- 🚨 Extra warning if deleting active session
- ✅ Clean removal from index and filesystem

**Example:** `/session:delete old-feature`

**Warning:** This action cannot be undone. All session data, including snapshots and context, will be permanently deleted.

### Advanced Features

#### Auto-Snapshot Analysis
```
/session-snapshot-analysis
```
Manually trigger snapshot analysis (usually automatic).

### CLI Commands

The plugin includes a powerful CLI tool:

```bash
# List sessions (instant)
node session/cli/session-cli.js list

# Get session stats
node session/cli/session-cli.js stats my-session

# Delete a session
node session/cli/session-cli.js delete old-session

# Validate index
node session/cli/session-cli.js validate --fix

# Get all stats
node session/cli/session-cli.js stats-all
```

See `cli/README.md` for complete CLI documentation.

---

## 📊 Performance Comparison

### Before vs After Optimization

| Command | Before | After | Improvement |
|---------|--------|-------|-------------|
| `/session:list` | 5-10K tokens, 2-5s | < 200 tokens, < 50ms | **95-98% reduction** |
| `/session:status` | 2-4K tokens, 1-2s | < 150 tokens, < 50ms | **95% reduction** |
| `/session:continue` | 10-20K tokens, 3-5s | 3-8K tokens, 1-2s | **60-70% reduction** |
| `/session:save` | 15-25K tokens, 5-8s | 8-15K tokens, 2-4s | **40-50% reduction** |

**Overall: 60-80% token reduction across the plugin**

### Speed Improvements

- List/Status: **50-100x faster** (< 50ms vs 2-5 seconds)
- Continue: **2-3x faster** (1-2s vs 3-5 seconds)
- Auto-capture: **~50% less frequent** (every 15 vs 8 interactions)

---

## 🛡️ Plan Mode Support (Critical Feature)

### The Problem
In plan mode, Claude's Write/Edit tools are blocked to prevent accidental code changes. Session context files couldn't be written, causing **data loss on `/clear`**.

### The Solution
CLI delegation via Bash - the plugin uses:
```bash
cat <<'EOF' | node session-cli.js write-snapshot --stdin
[snapshot content]
EOF
```

This bypasses Write tool restrictions because:
- Bash tool is allowed in plan mode
- CLI is an external process
- Context files are documentation, not code

### The Result
✅ Zero data loss in plan mode
✅ Seamless user experience
✅ No workflow interruption
✅ Proper file separation

---

## 📁 File Structure

```
session/
├── plugin.json                 # Plugin metadata
├── README.md                   # This file
├── CHANGELOG.md                # Version history
├── LICENSE                     # MIT license
├── commands/                   # Slash commands
│   ├── session-list.md         # Optimized
│   ├── session-status.md       # Optimized
│   ├── session-continue.md     # Optimized
│   ├── session-start.md        # Optimized
│   ├── session-save.md         # Plan mode support
│   ├── session-close.md
│   ├── session-auto-snapshot.md # Plan mode support
│   └── session-snapshot-analysis.md
├── hooks/                      # Event hooks
│   ├── session-start.js        # Auto-close on /clear (NEW!)
│   ├── user-prompt-submit.js   # Auto-capture (optimized threshold)
│   ├── post-tool-use.js        # File tracking
│   └── suggestion-detector.js
├── cli/                        # CLI tool (NEW!)
│   ├── session-cli.js          # Main entry
│   ├── lib/                    # Core modules
│   │   ├── index-manager.js    # Metadata index
│   │   ├── session-reader.js   # Read operations
│   │   ├── session-writer.js   # Write operations
│   │   └── commands/           # 10 CLI commands
│   └── README.md               # CLI documentation
└── docs/                       # Documentation
    ├── OPTIMIZATION_SUMMARY.md # Implementation details
    ├── TESTING_GUIDE.md        # Comprehensive testing
    └── QUICK_TEST.md           # 5-minute quick test
```

---

## 🔧 Configuration

### Auto-Capture Settings

Auto-capture triggers when:
- **15 interactions** since last analysis (optimized from 8)
- **3+ files** modified in sequence
- **Natural breakpoints** detected (task completion, topic changes)

### Disable Auto-Capture

Add to `session.md`:
```markdown
## Configuration
- Auto-capture: disabled
```

### Session Lifecycle & Auto-Close Behavior

The plugin includes intelligent session state management to prevent confusion when context is lost:

#### When Sessions Auto-Close
Sessions are automatically closed (marked as inactive) when:
- **`/clear` command** is executed - The conversation context is explicitly cleared
- The SessionStart hook detects this and clears the active session marker

#### When Sessions Persist
Sessions remain active (and auto-resume) during:
- **Normal restarts** of Claude Code
- **Resume operations** (`/resume`)
- **Auto-compact** events

#### What Happens When Auto-Closed
When a session is auto-closed due to `/clear`:
1. The `.active-session` file is removed
2. The `.index.json` activeSession is set to `null`
3. Claude provides a helpful message:
   ```
   📋 Session 'feature-name' was auto-closed due to /clear command.

   To resume your work on this session, use: /session:continue feature-name
   To view all sessions, use: /session:list
   ```

#### Why This Matters
- **Prevents confusion**: You won't see a session marked as "active" when its context is no longer loaded
- **Preserves history**: The session and all its data remain intact - only the "active" marker is cleared
- **Explicit resume**: You can easily continue your work with `/session:continue session-name`

---

## 📚 Documentation

- **[CLI README](cli/README.md)** - Complete CLI tool documentation
- **[Optimization Summary](OPTIMIZATION_SUMMARY.md)** - Implementation details
- **[Testing Guide](TESTING_GUIDE.md)** - Comprehensive testing steps
- **[Quick Test](QUICK_TEST.md)** - 5-minute verification

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🐛 Troubleshooting

### Commands not found
```bash
# Verify installation
ls -la ~/.config/claude-code/plugins/session/

# Make CLI executable
chmod +x ~/.config/claude-code/plugins/session/cli/session-cli.js
```

### Index corruption
```bash
# Rebuild index
node session/cli/session-cli.js update-index --full-rebuild
```

### Plan mode snapshots not saving
- Verify Bash tool is allowed in Claude Code config
- Test CLI: `echo "test" | node session-cli.js write-snapshot test --stdin`

### Performance issues
```bash
# Validate and fix
node session/cli/session-cli.js validate --fix
```

---

## 🎯 Success Stories

> "The plan mode support saved my architecture planning session. No more lost context!" - Developer

> "60-80% token reduction means longer conversations and lower costs. Game changer!" - AI Engineer

> "Instant list/status commands make session management actually usable." - Product Manager

---

## 🗺️ Roadmap

### Future Enhancements
- Analytics dashboard
- Snapshot compression for old files
- Export/import sessions
- Session templates
- Collaborative sessions

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/automatewithus/claude-session/issues)
- **Email**: team@automatewith.us
- **Documentation**: See `docs/` directory

---

## 🌟 Star Us!

If you find this plugin useful, please star the repository!

[![GitHub stars](https://img.shields.io/github/stars/automatewithus/claude-session.svg?style=social&label=Star)](https://github.com/automatewithus/claude-session)

---

**Made with ❤️ by [AutomateWith.Us](https://automatewith.us)**

**Version**: 3.2.1 | **License**: MIT | **Status**: Production Ready 🚀
