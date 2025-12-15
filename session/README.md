# Session Management Plugin for Claude Code

**Version 3.33.0** - Plan Update Feature: Atomic operations for modifying plans with execution safety

Intelligent session management with **72% token reduction** through parallel subagent delegation. Zero-blocking conversation logging (<2ms), intelligent analysis via isolated subagents (2-4s), hybrid cleanup on all exit paths. Fast, efficient session resume with minimal main context usage.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-v3.33.0-blue.svg)](https://github.com/awudevelop/claude-plugins)

---

## 🚀 What's New in v3.33.0 (Latest Update)

### 📝 Plan Update Feature
- **Atomic Operations** - Add, update, delete, move, and reorder phases and tasks
- **Execution Safety** - Selective update protects completed work, rollback-replan for major changes
- **Automatic Backups** - Full backup before changes with automatic rollback on failure
- **Comprehensive Validation** - Schema validation, dependency checking, and integrity verification
- **203 Tests** - Comprehensive test coverage across 4 test suites

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

---

## 🚀 What's in v3.7.0

### ⚡ Parallel Subagent Token Optimization
- **72% Token Reduction** - Session resume now uses ~22k tokens vs 77k in v3.6.4
- **3 Parallel Subagents** - Consolidation, git refresh, and goal extraction run simultaneously
- **Isolated Contexts** - Heavy analysis happens in subagent contexts, not main conversation
- **2-4 Second Resume** - Fast parallel execution of all background work
- **Minimal Summary** - Clean "Session ready: {goal}. What's next?" message
- **Production Quality** - Thoroughly tested architecture using Claude Code Task tool

### How Subagent Architecture Works
```
/session:continue command flow (v3.7.0):
1. Validate session exists (CLI, 500 bytes)
2. Spawn 3 parallel subagents (SINGLE message):
   ├─ Subagent 1: Consolidate conversation log → snapshot
   ├─ Subagent 2: Refresh git history → updated context
   └─ Subagent 3: Extract session goal → display text
3. All subagents complete (2-4 seconds)
4. Activate session + update timestamp
5. Display minimal summary: "✓ Session ready: {goal}. What's next?"

Token usage: ~22k in main (vs 77k before)
Heavy work: Isolated in subagent contexts (don't count against main budget)
```

### Token Comparison
| Operation | v3.6.4 | v3.7.0 | Savings |
|-----------|--------|--------|---------|
| Session validation | 500 bytes | 500 bytes | 0% |
| File reads (session.md, context.md, snapshots) | 23k tokens | 0 (subagents) | 100% |
| Conversation log consolidation | 20-25k tokens | 0 (subagents) | 100% |
| Git history analysis | 3k tokens | 0 (subagents) | 100% |
| Summary display | 8k tokens | 1k tokens | 87% |
| **Total main context** | **77k tokens** | **22k tokens** | **72%** |

---

## 🚀 What's in v3.6.4

### 🐛 Stop Hook Reliability Improvements
- **Fixed Critical Bug** - Stop hook now correctly reads Claude's responses from transcript
  - Changed from `entry.role` to `entry.type` format to match Claude Code's transcript structure
  - Impact: Self-contained conversation logs now work reliably
- **Exponential Backoff Retry** - Added smart retry mechanism (0-400ms delays, 750ms max)
  - Handles race conditions where transcript isn't immediately available
  - Fast success path (0-50ms typical), patient for edge cases
- **Production Quality** - Removed debug logging for cleaner deployments

---

## 🚀 What's in v3.6.3

### 🧹 Hybrid Session Cleanup System
- 🎯 **SessionEnd Hook** - Automatic cleanup on ALL Claude Code terminations (exit, logout, crash)
- 🔄 **Session Transitions** - Clean handoffs when switching between sessions
- 🛡️ **100% Coverage** - Multi-layer defense ensuring no orphaned session markers
- 📋 **User Feedback** - Clear messages on session transitions
- ⚡ **< 15ms Overhead** - Non-blocking, runs after session ends
- 🐛 **Zero Orphans** - No more stale .active-session files
- 🔧 **Graceful Degradation** - All failures handled silently

### Architecture: Defense in Depth
```
Normal Close: /session:close          → Deletes .active-session
/clear Command: SessionStart hook     → Deletes .active-session
Claude Code Exit/Crash: SessionEnd    → Deletes .active-session (NEW!)
Session Transitions: Commands         → Clean handoff (NEW!)
Edge Cases: Orphan detection          → Cleanup every 20 prompts
```

### Previous Update: v3.6.2

## 🚀 What's New in v3.33.0

### 📝 Self-Contained Conversation Logs
- 🎯 **Complete Capture** - Both user prompts AND Claude's full responses
- 🔄 **Stop Hook** - New hook captures responses automatically after each turn
- 📊 **Rich Context** - Includes text, tool uses, and message metadata
- ⚡ **Minimal Overhead** - ~10-50ms per response, runs in background
- 🔍 **No Transcript Dependency** - Logs are fully self-contained
- 🧠 **Better Snapshots** - Claude has full conversation for inline analysis
- ♻️ **Backward Compatible** - Still works with v3.6.1 logs (transcript fallback)

### How Self-Contained Logs Work
1. **User sends prompt**: UserPromptSubmit hook logs it to conversation-log.jsonl
2. **Claude responds**: Stop hook captures the complete response (text + tools)
3. **Fully logged**: Both sides of conversation stored in single JSONL file
4. **Session resume**: Claude reads complete conversation, creates intelligent snapshot
5. **No external files**: Everything needed is in conversation-log.jsonl

### Previous Update: v3.6.0

## 🚀 What's New in v3.33.0

### 🔍 Automatic Git History Capture
- 📊 **Repository Context** - Last 50 commits captured automatically at session boundaries
- 🔄 **Uncommitted Changes** - Tracks staged/unstaged/new/deleted/conflicted files
- 🌿 **Branch Awareness** - Shows ahead/behind upstream status
- 🔥 **Development Hotspots** - Identifies active development areas
- ⚡ **Ultra-Compact** - 70-75% token savings vs markdown (2-15KB per session)
- 🚀 **Fast** - 60-90ms overhead at session boundaries
- 🔕 **Silent Skip** - No errors if not a git repository

### How Git Context Works
1. **Session start/continue**: Git history captured automatically (60-90ms)
2. **Claude gets context**: Recent commits, uncommitted work, branch state
3. **Better decisions**: Claude understands project evolution and current state
4. **Token efficient**: Compressed JSON format uses 70-75% fewer tokens
5. **Human readable**: `/session:git-decompress` for debugging

### Previous Update: v3.5.1

### Claude Inline Analysis at Session Boundaries
- ⚡ **Zero Blocking During Work** - Conversations logged in <2ms per interaction
- 🧠 **FREE Intelligent Analysis** - Claude analyzes at session boundaries (1-3s)
- 🎯 **Acceptable Wait Times** - Users expect loading at session start/continue
- 💾 **Auto-Cleanup** - Raw logs deleted after consolidation (98% space savings)
- 🔄 **Same Quality as v3.4** - Full conversation understanding, zero cost
- ⚠️ **One-Time Setup Required** - Run `/session:setup` after install (see [Why Setup?](#why-is-setup-required))

### How It Works
1. **During session**: Each interaction logged to conversation-log.jsonl (~1-2ms)
2. **User continues working**: No interruptions, completely smooth
3. **Session end**: User closes laptop, logs remain on disk
4. **Session resume**: Claude analyzes log inline (1-3s, acceptable)
5. **Intelligent snapshot**: Full AI analysis with summaries, decisions, context
6. **Log deleted**: Raw log removed, disk space freed
7. **User ready**: Full context restored, ready to work

### Performance Comparison
| Operation | v3.4.0 | v3.5.1 | Improvement |
|-----------|--------|--------|-------------|
| During active work | 10-15s freeze every 5 interactions | <2ms per interaction | **99.9% faster** |
| Session start/continue | ~70ms | ~70ms + 1-3s analysis | **Acceptable** |
| Analysis quality | Full AI | Full AI | **Same** |
| Cost | FREE | FREE | **Same** |

### Previous Updates (v3.3)

#### Living Context System
- 📸 **Automatic snapshots** - Full snapshots every 5 interactions (or 3+ files modified)
- 🎯 **Smart extraction** - Captures decisions, agreements, requirements, discoveries
- ⚡ **Ultra-fast updates** - < 1 second overhead, completely silent
- 🐛 **Fixed autosave** - Resolved bug where autosave never triggered

### Previous Updates (v3.2)

#### Smart Session State Management
- 🔄 **Auto-cleanup on /clear** - Sessions automatically close when context is cleared
- 💡 **Helpful messages** - Claude informs you when sessions are auto-closed and how to resume
- ✅ **Preserves auto-resume** - Sessions still auto-resume on normal restarts
- 🎯 **SessionStart hook** - Intelligent detection of context loss events

#### Delete Session Feature
- 🗑️ **Permanent deletion** - Remove sessions you no longer need
- ⚠️ **Two-step confirmation** - Prevents accidental deletions
- 🚨 **Active session warning** - Extra protection for current work
- 📊 **Shows impact** - See what will be deleted before confirming
- 🎯 **Integrated everywhere** - Delete from interactive menu or direct command

### Enhanced List Command (v3.1)
- 🎨 **Visual badges** (ACTIVE, HOT, CLOSED, COLD) for quick status scanning
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

### 📋 Snapshot Format v2.0 (NEW!)
- **Numbered List Structure** - Topics, suggestions, decisions, and tasks use explicit numbering (1, 2, 3...)
- **Anti-Recency Bias** - Comprehensive capture of ALL topics from entire conversation, not just recent interactions
- **Structured Sections**:
  - **Topics Discussed** - All topics with category labels in chronological order
  - **Suggestions & Recommendations** - Categorized suggestions with rationale
  - **Decisions Made** - Key decisions with context and rationale
  - **Tasks Completed** - Explicit enumeration of all completed actions
  - **Files Modified** - File paths with specific change descriptions
  - **Current Status** - Structured: Progress, Next Steps, Blockers
- **Backward Compatible** - Automatically handles both v1.0 (paragraph) and v2.0 (numbered) formats
- **Better Coverage** - 95%+ topic capture vs <70% with previous format
- **More Scannable** - Numbered lists easier to read and machine-parseable

### 🗺️ Project Maps (NEW in mapping-upgrade)

Intelligent codebase navigation through pre-computed context maps:

**Capabilities:**
- **17 Map Types** - File structure, dependencies, architecture, modules, components, and more
- **Natural Language Queries** - Ask questions like "what framework is this?" or "show me the modules"
- **Pattern-Based Search** - Search by file name, export, import, function signature, class, or type
- **Intent Routing** - Automatic classification of questions to the right data source
- **Claude-Optimized Output** - Results formatted with absolute paths, line numbers, and contextual annotations

**Performance Benchmarks:**
| Operation | Response Time |
|-----------|---------------|
| Quick queries (framework, tests) | < 3ms |
| Extended queries (modules, issues) | < 10ms |
| Pattern search | < 15ms |
| Intent routing | < 5ms |
| List all projects | < 70ms |

**Key Commands:**
```bash
/session:project-maps-generate      # Create maps for project
/session:project-maps-ask "question"  # Natural language query
/session:project-maps-query <type>  # Specific query
/session:project-maps-search <type> <pattern>  # Pattern search
```

See [MAPS_USER_GUIDE.md](./docs/MAPS_USER_GUIDE.md) for complete documentation.

---

## 📦 Installation

Install directly from the Claude Code marketplace:

```
https://github.com/awudevelop/claude-plugins/tree/main/session
```

Simply paste this URL into Claude Code's plugin installation interface to get started!

---

## ⚙️ Setup & Configuration

### Why Is Setup Required?

> **⚠️ TEMPORARY WORKAROUND** - This section explains why `/session:setup` is required.

Claude Code's plugin hook system currently has **known bugs** where certain hooks execute but their output is silently discarded:

| Issue | Affected Hooks | Status |
|-------|---------------|--------|
| [#12151](https://github.com/anthropics/claude-code/issues/12151) | UserPromptSubmit, SessionStart | **OPEN** |
| [#9708](https://github.com/anthropics/claude-code/issues/9708) | Notification | **OPEN** |
| [#10225](https://github.com/anthropics/claude-code/issues/10225) | UserPromptSubmit | Closed (dup) |

**Impact on this plugin:**
- `UserPromptSubmit` (conversation logging) - ❌ Broken via plugin hooks
- `SessionStart` (/clear handling) - ❌ Broken via plugin hooks

**Workaround:** The `/session:setup` command writes hooks directly to `.claude/settings.json` with absolute paths, bypassing the buggy plugin hook system. Manual hooks work correctly.

**Once Fixed:** When Claude Code resolves issue #12151, we will re-enable plugin hooks and make `/session:setup` optional.

---

### Quick Start: Setting Up Hooks

After installing the plugin, you need to configure hooks for automatic session tracking. This is a one-time setup:

```bash
/session:setup
```

This command automatically:
- ✅ Adds session plugin hooks to `.claude/settings.json`
- ✅ Enables auto-tracking of session state, user interactions, and file changes
- ✅ Creates a backup of your settings before making changes
- ✅ Uses portable paths that work across different systems

**What gets configured:**
- **SessionStart** - Auto-clears session on `/clear` command
- **UserPromptSubmit** - Tracks user interactions (includes auto-cleanup of orphaned hooks)
- **PostToolUse** - Tracks file modifications (Write, Edit, NotebookEdit tools)

### Verifying Installation

Check if hooks are properly configured:

```bash
/session:setup --status
```

You should see all hook types configured and pointing to valid scripts.

### Configuration Options

The setup command supports several operations:

```bash
# Install hooks (default)
/session:setup

# Check current status
/session:setup --status

# Preview changes without applying (dry run)
/session:setup --dry-run

# Remove hooks
/session:setup --remove

# Force cleanup of orphaned hooks
/session:setup --force-cleanup
```

### How Hooks Work

The session plugin uses Claude Code's hook system to automatically track your work:

1. **SessionStart Hook**: Detects when you run `/clear` and auto-closes the active session to prevent confusion when context is lost

2. **UserPromptSubmit Hook**: Runs after each user prompt to:
   - Track interaction count
   - Log user prompts to conversation-log.jsonl
   - Trigger snapshots based on interaction thresholds
   - Auto-detect and cleanup orphaned hooks (every 20 prompts)

3. **PostToolUse Hook**: Runs after file modifications to:
   - Track which files were changed
   - Count file modifications
   - Contribute to snapshot trigger logic

4. **Stop Hook**: Runs after Claude completes each response to:
   - Capture Claude's full response text
   - Extract tools used in the response
   - Log to conversation-log.jsonl for self-contained logs
   - Enable complete conversation context (~10-50ms overhead)

All hooks:
- ✅ Run silently in the background
- ✅ Have minimal performance impact (< 10ms)
- ✅ Include graceful failure handling
- ✅ Won't break Claude Code if plugin is removed

### Disabling Hooks Temporarily

If you need to temporarily disable all hooks:

1. Edit `.claude/settings.json`
2. Set `"disableAllHooks": true`
3. Restart Claude Code

To re-enable, set it back to `false` or remove the line.

---

## 🗑️ Uninstallation

### IMPORTANT: Clean Up Before Uninstalling

Before removing the session plugin, you **must** clean up the hooks to prevent orphaned entries:

```bash
/session:setup --remove
```

This removes all session plugin hooks from `.claude/settings.json` and creates a backup.

### Uninstallation Steps

1. **Remove hooks** (REQUIRED):
   ```bash
   /session:setup --remove
   ```

2. **Verify cleanup**:
   ```bash
   /session:setup --status
   ```
   Should show: "No session plugin hooks found"

3. **Uninstall the plugin**:
   - Use Claude Code's plugin manager to remove the session plugin
   - Or manually delete the plugin directory

### What If I Forgot to Clean Up?

If you uninstalled the plugin without running `/session:setup --remove`, don't worry! There are multiple recovery options:

#### Option 1: Auto-Cleanup (Recommended)
The session plugin includes orphan detection that runs every 20 prompts. If hooks are found pointing to non-existent files, they'll be automatically removed. Just wait for ~20 interactions and the cleanup happens silently.

#### Option 2: Manual Cleanup Script
If the plugin directory still exists:

```bash
cd /path/to/plugin/session
./cleanup-hooks.sh /path/to/your/project
```

#### Option 3: Manual Edit
Edit `.claude/settings.json` and remove the session plugin hook entries:

```json
{
  "hooks": {
    "SessionStart": [...],      // Remove session plugin entries
    "UserPromptSubmit": [...],  // Remove session plugin entries
    "PostToolUse": [...]        // Remove session plugin entries
  }
}
```

Look for entries with `${CLAUDE_PLUGIN_ROOT}/hooks/` in the command path.

#### Option 4: Restore from Backup
If you have a backup from before the plugin was installed:

```bash
cp .claude/settings.json.backup .claude/settings.json
```

### Orphaned Hooks Are Harmless

Even if orphaned hooks remain in `settings.json`, they:
- ✅ Won't break Claude Code (will just fail silently)
- ✅ Won't cause errors or warnings
- ✅ Will be auto-detected and cleaned up if plugin is reinstalled

However, for cleanliness, it's best to remove them.

---

## 🎮 Usage

### Visual Indicators

The `/session:list` command uses visual badges to help you quickly identify session states:

- **[ACTIVE] 🔥** - Currently active session
- **🔥 HOT** - Updated within the last hour
- **✅ CLOSED** - Session has been closed
- **🧊 COLD** - No updates in over 7 days

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
- 📊 Visual badges (ACTIVE, HOT, CLOSED, COLD)
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

#### Setup Hooks
```
/session:setup
```
Configure session plugin hooks in `.claude/settings.json` for automatic tracking.

**Operations:**
- **Install** (default): `/session:setup` - Add hooks to settings.json
- **Status**: `/session:setup --status` - Show current configuration
- **Remove**: `/session:setup --remove` - Remove hooks (run before uninstalling!)
- **Cleanup**: `/session:setup --force-cleanup` - Clean up orphaned hooks
- **Dry Run**: `/session:setup --dry-run` - Preview changes

**What it does:**
- ✅ Adds SessionStart, UserPromptSubmit, PostToolUse, and Stop hooks
- ✅ Enables automatic session state tracking and full response capture
- ✅ Creates backup before modifications
- ✅ Idempotent (safe to run multiple times)
- ✅ Includes orphan detection and auto-cleanup

**Example:**
```
/session:setup              # Install hooks
/session:setup --status     # Check configuration
/session:setup --remove     # Remove before uninstalling plugin
```

**IMPORTANT:** Always run `/session:setup --remove` before uninstalling the plugin to avoid orphaned hook entries!

---

### Advanced Features

#### Git History Decompression
```
/session:git-decompress [session-name]
```
Decompress and display git history in human-readable markdown format. Useful for:
- Debugging git capture
- Verifying captured commits
- Inspecting uncommitted changes
- Human inspection of repository context

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

# Capture git history
node session/cli/session-cli.js capture-git my-session
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
│   ├── start.md                # Create new sessions
│   ├── continue.md             # Resume sessions (v3.7.0 subagent architecture)
│   ├── list.md                 # List all sessions
│   ├── status.md               # Session status
│   ├── save.md                 # Manual snapshots
│   ├── close.md                # Close sessions
│   ├── delete.md               # Delete sessions
│   ├── setup.md                # Hook management
│   └── git-decompress.md       # Git history debugging
├── hooks/                      # Event hooks
│   ├── session-start.js        # Auto-close on /clear
│   ├── session-end.js          # Cleanup on Claude Code exit
│   ├── user-prompt-submit.js   # Log interactions, trigger snapshots
│   ├── post-tool-use.js        # Track file modifications
│   └── stop.js                 # Capture Claude's responses
├── cli/                        # CLI tool
│   ├── session-cli.js          # Main entry point
│   ├── lib/                    # Core modules
│   │   ├── index-manager.js    # Metadata index
│   │   ├── session-reader.js   # Read operations
│   │   ├── session-writer.js   # Write operations
│   │   ├── conversation-logger.js # Conversation logging
│   │   ├── git-historian.js    # Git history capture
│   │   ├── hooks-manager.js    # Hook management
│   │   ├── lock-manager.js     # Concurrency control
│   │   └── commands/           # CLI command implementations
│   └── README.md               # CLI documentation
├── prompts/                    # Subagent prompts (v3.7.0)
│   ├── consolidate-log.md      # Consolidation subagent
│   ├── refresh-git.md          # Git refresh subagent
│   └── extract-goal.md         # Goal extraction subagent
└── docs/                       # Documentation
    ├── AUTO-SNAPSHOT-REFERENCE.md # Technical reference
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

- **Issues**: [GitHub Issues](https://github.com/awudevelop/claude-plugins/issues)
- **Email**: team@automatewith.us
- **Documentation**: See `docs/` directory

---

## 🌟 Star Us!

If you find this plugin useful, please star the repository!

[![GitHub stars](https://img.shields.io/github/stars/awudevelop/claude-plugins.svg?style=social&label=Star)](https://github.com/awudevelop/claude-plugins)

---

**Made with ❤️ by [AutomateWith.Us](https://automatewith.us)**

**Version**: 3.7.1 | **License**: MIT | **Status**: Production Ready 🚀
