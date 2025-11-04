# AutomateWith.Us Claude Code Plugins

**Production-ready plugins for workflow automation and productivity**

This marketplace provides curated Claude Code plugins built by the AutomateWith.Us team for enhancing development workflows across all projects.

---

## 🚀 Quick Start

### Install the Marketplace

```bash
/plugin marketplace add automatewithus/claude-plugins
```

### Browse Available Plugins

```bash
/plugin
```

Then select "automatewithus-plugins" from the marketplace list.

### Install a Plugin

```bash
/plugin install session
```

---

## 📦 Available Plugins

### Session Management (v2.1.0)

**Intelligent session auto-capture with zero-latency snapshot tracking**

Automatically saves your development work at natural breakpoints - when you complete tasks, change topics, or finish features. Works completely in the background with zero delay.

**Features:**
- ✅ Zero user delay (<10ms hooks)
- ✅ Content-aware analysis
- ✅ Async processing
- ✅ Smart timing (task completions, topic changes)
- ✅ Suggestion tracking
- ✅ 8+ commands for session management

**Commands Added:**
- `/session-start` - Start a new session
- `/session-save` - Manually save current session
- `/session-status` - View session information
- `/session-list` - List all saved sessions
- `/session-continue` - Continue a previous session
- `/session-close` - Close and save current session
- `/session-auto-snapshot` - Trigger snapshot analysis
- `/session-snapshot-analysis` - View snapshot analysis details

**Hooks Added:**
- `UserPromptSubmit` - Tracks interactions, queues analysis
- `PostToolUse` - Monitors file changes (Write/Edit)

**Perfect For:**
- Multi-session development work
- Long-running feature development
- Team collaboration handoffs
- Personal development memory
- Project documentation

**Installation:**
```bash
/plugin install session
```

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
- **INSTALLATION_GUIDE.md** - Step-by-step setup (manual installation)
- **AUTO-CAPTURE-DESIGN.md** - Technical architecture details

When you install via `/plugin install`, everything is configured automatically - no manual setup needed!

---

## 🔧 Manual Installation (Advanced)

If you prefer manual installation or want to customize:

1. Clone this repository
2. Copy plugin files to your project's `.claude` directory
3. Update `.claude/settings.json` with hook configurations
4. Restart Claude Code

See individual plugin README files for detailed manual installation instructions.

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
- GitHub: [@automatewithus](https://github.com/automatewithus)
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

**Version:** 1.0.0
**Last Updated:** January 2025
**Maintainer:** AutomateWith.Us Team
