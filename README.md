# AutomateWith.Us Claude Code Plugins

**Production-ready plugins for workflow automation and productivity**

This marketplace provides curated Claude Code plugins built by the AutomateWith.Us team for enhancing development workflows across all projects.

---

## 🚀 Get Started

### Step 1: Add the AutomateWith.Us Marketplace

First, add our plugin marketplace to Claude Code:

```
/plugin marketplace add awudevelop/claude-plugins
```

Or using the full URL:

```
/plugin marketplace add https://github.com/awudevelop/claude-plugins.git
```

### Step 2: Browse Available Plugins

View all available plugins from our marketplace:

```
/plugin
```

Then select **awudevelop-claude-plugins** from the marketplace list.

### Step 3: Install a Plugin

Install the Session Management plugin:

```
/plugin install session
```

Or use the interactive menu to browse and install.

**That's it!** Your plugin is now installed and ready to use. Restart Claude Code if prompted.

---

## 📦 Available Plugins

### Session Management (v3.29.0)

**Intelligent session management with parallel subagent architecture (72% token reduction), reliable cleanup system, and smart state tracking**

Never lose context again! Automatic snapshots, smart cleanup on `/clear`, and optimized performance for long-running development sessions.

**Latest Features (v3.7.1):**
- 🔧 **Subagent Reliability** - Fixed critical bugs, 60%→95% success rate
- ⚡ **72% Token Reduction** - Parallel subagent architecture for session resume
- 🚀 **Fast Resume** - 2-4 second parallel execution of heavy work
- 🧹 **Hybrid Cleanup System** - SessionEnd hook + transition handling + orphan detection
- 🎯 **100% Coverage** - All exit paths handled (exit, logout, crash, transitions)
- 🛡️ **Plan mode support** - No data loss when clearing conversations
- 🗑️ **Delete sessions** - Remove sessions you no longer need with safety confirmations
- 📝 **Self-contained logs** - Full conversation capture (user + Claude responses)

**Key Features:**
- ✅ Intelligent auto-capture at natural breakpoints
- ✅ 95-98% token reduction for list/status operations
- ✅ < 50ms response time for metadata queries
- ✅ Interactive session selection with action menus
- ✅ Visual status indicators (ACTIVE, HOT, CLOSED, INACTIVE)
- ✅ Comprehensive CLI tool for zero-token operations

**Commands:**
- `/session:start` - Start a new session
- `/session:save` - Manually save current session
- `/session:status` - View session information (instant)
- `/session:list` - List all sessions with visual indicators (instant)
- `/session:continue` - Resume a previous session
- `/session:close` - Close and finalize current session
- `/session:delete` - Permanently delete a session (with safety checks)
- `/session:auto-snapshot` - Trigger snapshot analysis

**Hooks:**
- `SessionStart` - Auto-cleanup on `/clear` command
- `SessionEnd` - Auto-cleanup on Claude Code exit/crash
- `UserPromptSubmit` - Tracks interactions, queues analysis
- `PostToolUse` - Monitors file changes (Write/Edit)
- `Stop` - Captures Claude's full responses

**Perfect For:**
- Multi-session development workflows
- Long-running feature development
- Team collaboration and handoffs
- Context preservation across sessions
- Project documentation and history

**Installation:**
```
/plugin install session
```

**Documentation:**
- [Full README](session/README.md)
- [Changelog](session/CHANGELOG.md)

---

## 🎯 Who Should Use This?

These plugins are designed for:
- Non-technical founders building with Claude Code
- Development teams wanting standardized workflows
- Anyone working on multiple projects simultaneously
- Teams collaborating asynchronously
- Solo developers who want automatic work tracking

---

## 📚 Documentation

Each plugin includes comprehensive documentation:
- **README.md** - Plugin overview and features
- **CHANGELOG.md** - Version history and updates
- **CLI documentation** - Command-line interface guides

**Installation is automatic!** Plugins are installed through the marketplace with zero configuration.

---

## 🤝 Contributing

These plugins are maintained by the AutomateWith.Us team for internal and community use.

**Found a bug?** Open an issue on GitHub.

**Have a plugin idea?** We're always looking for ways to improve workflows.

---

## 📋 Plugin Development

Want to create your own plugins? Check out the [official Claude Code plugin documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces).

Key files in this marketplace:
- `.claude-plugin/marketplace.json` - Marketplace configuration
- `[plugin-name]/plugin.json` - Individual plugin manifests
- `[plugin-name]/hooks/` - Hook implementations
- `[plugin-name]/commands/` - Slash commands

---

## 🔐 License

All plugins are released under the MIT License unless otherwise specified.

---

## 🏢 About AutomateWith.Us

AutomateWith.Us is a development studio focused on helping non-technical founders bring their visions to life using AI-assisted development tools.

**Current Projects:**
- DataFlow - Multi-tenant analytics platform
- HelloPayments - Payment gateway infrastructure
- And more...

**Connect:**
- GitHub: [@awudevelop](https://github.com/awudevelop)
- Repository: [claude-plugins](https://github.com/awudevelop/claude-plugins)
- Email: team@automatewith.us

---

## 🎉 Plugin Marketplace

This is just the beginning! We'll be adding more plugins as we standardize our workflows:

**Coming Soon:**
- Code review automation
- Testing workflow enforcement
- Documentation generators
- Project scaffolding tools
- And more...

Stay tuned! ⭐ Star this repo to get notified of new plugins.

---

**Marketplace Version:** 1.2.0
**Latest Plugin:** Session Management v3.7.1
**Last Updated:** November 2025
**Maintainer:** AutomateWith.Us Team
**Repository:** https://github.com/awudevelop/claude-plugins
