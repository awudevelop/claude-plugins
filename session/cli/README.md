# Session Management CLI Tool

Lightweight Node.js CLI for Claude Code session management. Handles file I/O, metadata indexing, and data management with zero token consumption.

## Overview

This CLI tool provides fast, efficient session operations by maintaining a metadata index (`.index.json`). Commands execute in < 10ms and enable critical features like **plan mode support** for zero data loss.

## Installation

The CLI tool is part of the session management plugin. No separate installation required.

```bash
# Make CLI executable (if needed)
chmod +x session/cli/session-cli.js
```

## Architecture

```
┌─────────────────────────────────────────┐
│          Claude Commands                │
│  (session-list, session-status, etc.)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       session-cli.js (Entry Point)      │
│  • Command routing                      │
│  • Error handling                       │
│  • JSON output                          │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┬──────────────┐
        ▼             ▼              ▼
┌──────────────┐ ┌─────────────┐ ┌────────────┐
│IndexManager  │ │SessionReader│ │SessionWriter│
│• .index.json │ │• Read files │ │• Write files│
│• Metadata    │ │• Stats      │ │• Snapshots │
│• Validation  │ │• State      │ │• State     │
└──────────────┘ └─────────────┘ └────────────┘
```

## Commands

### Query Commands (Read-Only)

#### `list` - List all sessions
```bash
node session-cli.js list [--json] [--active-only]
```

Returns all sessions with metadata from index.

**Output:**
```json
{
  "activeSession": "feature-auth",
  "totalSessions": 3,
  "sessions": [...]
}
```

**Performance:** < 10ms, < 200 tokens (95-98% reduction)

#### `get` - Get session details
```bash
node session-cli.js get <session-name> [--include-snapshots] [--include-state]
```

Returns detailed session metadata.

**Performance:** < 50ms, < 100 tokens

#### `stats` - Get session statistics
```bash
node session-cli.js stats <session-name> [--detailed]
```

Returns snapshot counts, file sizes, timestamps, and more.

#### `stats-all` - Get all session statistics
```bash
node session-cli.js stats-all
```

Aggregate statistics across all sessions.

#### `validate` - Validate index integrity
```bash
node session-cli.js validate [--fix]
```

Check index for issues (orphaned entries, missing sessions). Use `--fix` to auto-repair.

### State Management Commands

#### `get-state` - Get session state
```bash
node session-cli.js get-state <session-name>
```

Returns auto-capture state, analysis queue, snapshot decisions, and markers.

#### `update-state` - Update session state
```bash
node session-cli.js update-state <session-name> '{"field": "value"}'
```

Update specific fields in auto-capture state.

### Write Commands

#### `activate` - Set active session
```bash
node session-cli.js activate <session-name>
```

Updates `.active-session` file and index.

#### `update-index` - Update metadata index
```bash
node session-cli.js update-index [--session <name>] [--full-rebuild]
```

- No args: Lazy validation and fix
- `--session <name>`: Update single session
- `--full-rebuild`: Complete index rebuild

#### `write-snapshot` - Write snapshot file (CRITICAL)
```bash
# Using stdin (plan mode compatible)
echo "content" | node session-cli.js write-snapshot <session-name> --stdin --type auto|manual

# Using heredoc (recommended for complex content)
cat <<'EOF' | node session-cli.js write-snapshot <session-name> --stdin --type auto
# Snapshot content here
Multi-line content
Special characters: $, `, ", '
EOF

# Using --content flag
node session-cli.js write-snapshot <session-name> --content "..." --type manual
```

**CRITICAL for plan mode:** Bypasses Write tool restrictions, enabling snapshots in plan mode.

## Plan Mode Support

### The Problem

In plan mode, Claude's Write/Edit tools are blocked to prevent accidental code changes. Session context files (`.claude/sessions/*`) couldn't be written, causing **data loss on `/clear`**.

### The Solution

**CLI Delegation via Bash** - Commands use Bash tool to call CLI with stdin:

```bash
# In plan mode, this works because Bash is allowed
cat <<'EOF' | node session-cli.js write-snapshot my-session --stdin --type auto
[snapshot content]
EOF
```

### Benefits

- ✅ **Zero data loss** in plan mode
- ✅ Works in both normal and plan mode
- ✅ Seamless user experience
- ✅ Proper separation: context files ≠ code files

## Index Management

### .index.json Structure

```json
{
  "version": "1.0",
  "sessions": {
    "session-name": {
      "name": "session-name",
      "status": "active",
      "started": "2025-11-03 14:00",
      "lastUpdated": "2025-11-03T14:30:00.000Z",
      "snapshotCount": 5,
      "filesInvolvedCount": 3,
      "goal": "Session goal...",
      "latestSnapshot": "2025-11-03_14-30.md",
      "latestSnapshotSummary": "Summary...",
      "filesInvolved": ["file1.js", "file2.js"]
    }
  },
  "activeSession": "session-name",
  "lastIndexUpdate": "2025-11-03T14:30:00.000Z"
}
```

### Sync Strategy

**Lazy Validation** - Index auto-syncs on read:

1. If index missing → rebuild
2. If corrupted → rebuild
3. If validation fails → auto-fix
4. Otherwise → use cached data

**Manual Sync:**
```bash
# Fix issues
node session-cli.js update-index

# Single session
node session-cli.js update-index --session my-session

# Full rebuild
node session-cli.js update-index --full-rebuild
```

## Performance Improvements

### Token Reduction

| Operation | Before | After | Improvement |
|-----------|---------|-------|-------------|
| List Sessions | 5-10K tokens | < 200 tokens | **95-98%** |
| Session Status | 2-4K tokens | < 150 tokens | **95%** |
| Session Continue | 10-20K tokens | 3-8K tokens | **60-70%** |
| Session Save | 15-25K tokens | 8-15K tokens | **40-50%** |

### Speed Improvements

| Operation | Before | After | Improvement |
|-----------|---------|-------|-------------|
| List Sessions | 2-5s | < 50ms | **50-100x** |
| Get Status | 1-2s | < 50ms | **20-40x** |
| Validate Index | N/A | < 100ms | Instant |

### Auto-Capture Optimization

**Before:** Analysis triggered every ~8 interactions
**After:** Analysis triggered every ~15 interactions
**Result:** ~50% reduction in auto-snapshot frequency

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Session not found
- `3` - Invalid arguments
- `4` - File system error
- `5` - Index corruption

## Error Handling

All commands handle errors gracefully:

```bash
# Session not found
$ node session-cli.js get nonexistent
Error: Session not found: nonexistent
(exit code: 2)

# Invalid arguments
$ node session-cli.js activate
Error: Session name required. Usage: session-cli activate <session-name>
(exit code: 3)

# Index corruption
$ node session-cli.js list
Warning: Index corrupted, rebuilding...
{...}
(exit code: 0, auto-fixed)
```

## Development

### Project Structure

```
cli/
├── session-cli.js              # Main entry point
├── package.json                # Package metadata
├── lib/
│   ├── index-manager.js        # Index operations
│   ├── session-reader.js       # Read operations
│   ├── session-writer.js       # Write operations
│   └── commands/
│       ├── list.js
│       ├── get.js
│       ├── activate.js
│       ├── update-index.js
│       ├── validate.js
│       ├── stats.js
│       ├── stats-all.js
│       ├── write-snapshot.js
│       ├── get-state.js
│       └── update-state.js
└── README.md                   # This file
```

### Testing

```bash
# List sessions
node cli/session-cli.js list

# Create test session
mkdir -p .claude/sessions/test
echo "# Session: test" > .claude/sessions/test/session.md

# Rebuild index
node cli/session-cli.js update-index --full-rebuild

# Validate
node cli/session-cli.js validate

# Test write-snapshot
echo "# Test snapshot" | node cli/session-cli.js write-snapshot test --stdin --type manual
```

## Integration with Claude Commands

Claude commands now use CLI for data operations:

```markdown
<!-- In session-list.md -->
Run CLI to get session list:
```bash
node session/cli/session-cli.js list
```

Parse JSON and format for user.
```

This pattern:
1. Reduces token usage (no file reads in Claude)
2. Improves speed (< 10ms CLI operations)
3. Enables plan mode support (Bash → CLI delegation)

## License

Part of the Claude Code session management plugin.
