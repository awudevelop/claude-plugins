# Project Maps Refresh Command

Refresh project context maps (full or incremental).

## Usage

```
/project-maps-refresh [--full|--incremental]
```

## Options

- `--full`: Force full regeneration of all maps
- `--incremental`: Only update changed files (faster)
- `--verbose`: Show detailed file-by-file changes instead of summary
- No options: Auto-detect best mode based on staleness

## Implementation

### Step 1: Run Refresh Command

Execute the unified CLI:

```bash
# Auto mode (recommended)
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps refresh

# Full refresh
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps refresh --full

# Incremental refresh
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps refresh --incremental
```

### Step 2: Display Results

The response includes:
- `success`: Boolean indicating success
- `mode`: "full" or "incremental"
- `filesScanned`: Number of files processed
- `mapsUpdated`: Number of maps updated

Show the refresh results:

**Full Refresh:**
```
Full refresh completed

Maps regenerated: 11 maps
Files scanned: {filesScanned}
Time taken: {time}ms

Staleness: 0/100 (fresh)
```

**Incremental Refresh:**
```
Incremental refresh completed

Files scanned: {filesScanned}
Maps updated: {mapsUpdated}
Time taken: {time}ms

Staleness: 0/100 (fresh)
```

## Diff Output

After refresh, you'll see what changed:

**Summary Mode (default):**
```
Changes: +5 files, -2 files, ~3 modified, 12 dep changes
```

**Verbose Mode (--verbose):**
Shows detailed breakdown including:
- Added/removed/modified files with sizes
- Dependency changes
- Component changes
- Module changes
- Anomaly warnings if mass changes detected

## When to Use

- **Auto**: Let the system decide based on staleness score
- **Full**: After major refactoring or when maps seem inconsistent
- **Incremental**: For quick updates after small changes

## Error Handling

If no maps exist:
```
No maps found for this project.
Run: /project-maps-generate
```

If refresh fails:
```
Refresh failed: {error_message}

Try:
  1. Check git status
  2. Ensure no file permission issues
  3. Run full refresh: /project-maps-refresh --full
```

## Notes

- Incremental refresh is faster (target: <20% of full scan time)
- Full refresh guarantees consistency
- Refresh automatically updates staleness metadata
