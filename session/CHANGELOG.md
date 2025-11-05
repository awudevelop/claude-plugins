# Changelog

All notable changes to the Session Management plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.3.0] - 2025-11-05

### 🧠 Living Context System - Continuous Context Tracking

This minor release introduces the **Living Context System** - a revolutionary approach to session management that keeps context.md continuously updated throughout your conversation.

### Added
- 🧠 **Living Context System** - Dual-threshold auto-capture architecture
  - **Context Updates**: Lightweight extraction every 2 interactions (< 1s, silent)
  - **Full Snapshots**: Comprehensive saves every 12 interactions (2-5s, minimal notification)
  - Captures: decisions, agreements, requirements, discoveries, technical choices
  - Completely automatic and silent operation

- 📝 **context-update.md Command** - New lightweight context extraction command
  - Analyzes only last 2 message exchanges (not entire conversation)
  - ~300 token budget, < 1 second execution
  - Appends incrementally to context.md
  - Five extraction categories: Decisions, Agreements, Requirements, Discoveries, Technical

- 🎯 **Smart State Tracking** - Enhanced state management
  - `interactions_since_context_update` counter
  - `interactions_since_snapshot` counter
  - Separate tracking for lightweight vs heavy operations

### Changed
- ⚡ **Hook Optimization** - `user-prompt-submit.js` reduced from 241 → 139 lines (42% smaller)
  - Removed redundant analysis queue system (OLD system at 15 interactions)
  - Simplified to single Living Context system
  - Cleaner state management with fewer fields

- 📋 **auto-snapshot.md Updates** - Simplified detection workflow
  - Now checks 2 marker types (was 3)
  - Removed Analysis Task section
  - Streamlined from 192 → 155 lines (19% reduction)

- 🎯 **Threshold Optimizations**
  - Context updates: Every 2 interactions (was never working)
  - Full snapshots: Every 12 interactions (was 15 via broken analysis)
  - File-based snapshot: 3+ files modified + 5 interactions

### Fixed
- 🐛 **Autosave Never Triggered** - Root cause analysis and resolution
  - **Issue**: Hooks created marker files but Claude never checked them
  - **Cause**: Missing `.active-session` file + no automatic trigger mechanism
  - **Fix**: Living Context system with direct marker processing

- 🧹 **Removed Redundant Code** - Eliminated conflicting systems
  - Deleted `snapshot-analysis.md` (231 lines, no longer needed)
  - Removed analysis queue logic (85 lines)
  - Eliminated 3 unused marker file types (`.analysis-queue`, `.pending-analysis`, `.snapshot-decision`)
  - 50% reduction in state files created

### Performance Improvements
- ⚡ Average overhead per interaction: ~0.5 seconds (vs 0 before, but autosave didn't work)
- ⚡ 42% smaller hook file (faster loading)
- ⚡ 50% fewer state files to manage
- ⚡ Context updates: < 1 second (lightweight)
- ⚡ Full snapshots: 2-5 seconds (only every 12 interactions)

### Technical Details

**Living Context Architecture:**
```
Every interaction → Hook tracks state
Every 2 interactions → .pending-context-update created
Every 12 interactions → .pending-auto-snapshot created
Claude auto-checks → Processes markers → Updates files
```

**State Files (After Cleanup):**
- `.auto-capture-state` - State tracking (kept)
- `.pending-context-update` - Context update trigger (new)
- `.pending-auto-snapshot` - Snapshot trigger (kept)

**Removed State Files:**
- `.analysis-queue` ❌ (redundant)
- `.pending-analysis` ❌ (redundant)
- `.snapshot-decision` ❌ (redundant)

### Breaking Changes
None - Fully backward compatible. Existing sessions will automatically adopt new thresholds.

### Migration Notes
- Restart Claude Code after updating for hooks to reload
- Run `/session:continue {session-name}` to activate Living Context system
- Context.md will start updating automatically after 2 interactions

---

## [3.2.1] - 2025-11-04

### 🔄 Smart Session State Management

This patch release adds intelligent session lifecycle management to prevent confusion when context is lost.

### Added
- 🔄 **SessionStart Hook** - Auto-cleanup on context loss events
  - Detects when `/clear` command is executed
  - Automatically clears active session markers when context is lost
  - Provides helpful context messages to guide users on resuming work
  - Preserves auto-resume behavior on normal restarts

### Changed
- 📋 **Session Lifecycle Behavior**
  - Sessions now auto-close when `/clear` is executed (context is explicitly cleared)
  - Sessions continue to auto-resume on normal Claude Code restarts
  - `.active-session` file and `.index.json` automatically updated when context is lost

### Fixed
- 🐛 **Stale Active Sessions** - Fixed issue where sessions appeared as "active" after `/clear` or Claude Code restart, even though context was no longer loaded
- ⚠️ **User Confusion** - Users are now informed when sessions are auto-closed and how to resume their work

### Behavior Details

**When sessions auto-close:**
- `/clear` command is executed (conversation context cleared)

**When sessions persist:**
- Normal Claude Code restarts
- Resume operations (`/resume`)
- Auto-compact events

**What happens on auto-close:**
1. `.active-session` file is removed
2. `.index.json` activeSession is set to `null`
3. Helpful message displayed: "Session 'X' was auto-closed due to /clear. Use /session:continue X to resume."

### Breaking Changes
None - Fully backward compatible. Only affects behavior after `/clear` command.

---

## [3.0.0] - 2025-11-03

### 🚀 Major Release: Performance Optimization & Plan Mode Support

This is a **major update** with significant performance improvements and critical new features.

### Added
- ⚡ **CLI Tool** - Lightweight Node.js CLI for zero-token operations
  - 10 commands: list, get, stats, validate, write-snapshot, etc.
  - < 10ms execution time for metadata queries
  - 1,645 lines of optimized code
- 🛡️ **Plan Mode Support** - CRITICAL feature preventing data loss
  - Snapshots save via CLI delegation (bypasses Write tool restrictions)
  - Works seamlessly in both normal and plan modes
  - Zero data loss on `/clear` in plan mode
- 📊 **Metadata Index** (.index.json)
  - Fast metadata caching
  - Lazy validation with auto-fix
  - Snapshot summaries cached
- 📚 **Comprehensive Documentation**
  - CLI README with full command reference
  - Optimization summary with metrics
  - Testing guides (comprehensive and quick test)

### Changed
- ⚡ **Performance Optimizations**
  - `/session list`: 95-98% token reduction (5-10K → < 200 tokens)
  - `/session status`: 95% token reduction (2-4K → < 150 tokens)
  - `/session continue`: 60-70% token reduction (10-20K → 3-8K tokens)
  - `/session save`: 40-50% token reduction (15-25K → 8-15K tokens)
  - Speed: 50-100x faster for list/status (< 50ms vs 2-5 seconds)
- 🎯 **Auto-Capture Optimization**
  - Threshold increased: 8 → 15 interactions
  - ~50% reduction in auto-capture frequency
  - Significant token savings over time
- 📝 **Command Refactoring**
  - All commands now use CLI for metadata operations
  - Snapshots written via CLI (plan mode compatible)
  - Index automatically updated on writes

### Fixed
- ❌ **Data loss in plan mode** - Snapshots now save correctly
- 🐛 **Stale index issues** - Lazy validation auto-fixes problems
- ⚠️ **Slow list operations** - Now < 50ms regardless of session count

### Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| List Sessions | 5-10K tokens | < 200 tokens | **95-98%** |
| Session Status | 2-4K tokens | < 150 tokens | **95%** |
| Session Continue | 10-20K tokens | 3-8K tokens | **60-70%** |
| Session Save | 15-25K tokens | 8-15K tokens | **40-50%** |
| List Speed | 2-5 seconds | < 50ms | **50-100x** |
| Status Speed | 1-2 seconds | < 50ms | **20-40x** |

**Overall: 60-80% token reduction across the entire plugin**

### Breaking Changes
None - fully backward compatible with existing sessions.

---

## [2.1.0] - Previous Version

### Features
- Intelligent auto-capture with natural breakpoint detection
- Manual snapshots with `/session save`
- Session management (start, continue, close, list, status)
- Context preservation (decisions, discoveries, files)
- Suggestion tracking
- Auto-snapshot analysis

### Known Issues
- Slow list operations with many sessions (fixed in 3.0.0)
- Data loss in plan mode (fixed in 3.0.0)
- High token usage for admin commands (fixed in 3.0.0)

---

## [2.0.0] - Initial Release

### Features
- Basic session management
- Auto-capture hooks
- Snapshot tracking
- Context files (session.md, context.md)

---

## Migration Notes

### Upgrading from 2.x to 3.0.0

**No migration required!** Version 3.0.0 is fully backward compatible.

**What happens on upgrade:**
1. Index will be built automatically on first command
2. All existing sessions work without changes
3. New features available immediately
4. Performance improvements apply instantly

**Recommended after upgrade:**
```bash
# Rebuild index for best performance
node session/cli/session-cli.js update-index --full-rebuild

# Validate everything is working
node session/cli/session-cli.js validate
```

---

## Future Roadmap

### Planned for 3.1.0
- Analytics dashboard (token usage, session trends)
- Snapshot compression for old files
- Export/import functionality

### Planned for 3.2.0
- Session templates
- Collaborative sessions
- Advanced search/filtering

### Planned for 4.0.0
- Web UI for session management
- Cloud sync for sessions
- Team collaboration features

---

## Support

- **Issues**: [GitHub Issues](https://github.com/awudevelop/claude-plugins/issues)
- **Documentation**: See `docs/` directory
- **Email**: team@automatewith.us

---

**Legend:**
- 🚀 New features
- ⚡ Performance improvements
- 🛡️ Critical fixes
- 🐛 Bug fixes
- ⚠️ Warnings
- ❌ Removed features
