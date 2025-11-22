# Project Maps Refresh Command

Refresh project context maps (full or incremental).

## Usage

```
/project-maps-refresh [--full|--incremental]
```

## Options

- `--full`: Perform full rescan and regenerate all maps (slower, complete)
- `--incremental`: Only update changed files (faster, recommended for small changes)
- No option: Auto-detect based on changes (incremental if <30% files changed, otherwise full)

## Implementation

### Step 1: Check if Maps Exist

First, check if maps have been generated for this project:

```bash
node {plugin_root}/cli/lib/map-loader.js . --staleness-only
```

If no maps exist (exit code 1), show error and suggest running generation first:
```
❌ No project maps found

Generate maps first:
  /project-maps-generate

Or manually:
  node session/cli/lib/map-generator.js generate
```

### Step 2: Determine Refresh Mode

Parse command arguments to determine refresh mode:
- If user specified `--full`: Use full refresh
- If user specified `--incremental`: Use incremental refresh
- If no option: Auto-detect

For auto-detect:
1. Load summary map to get project hash and last refresh info
2. Count changed files using git diff
3. If changed files > 30% of total: Recommend full refresh
4. Otherwise: Use incremental refresh

### Step 3: Perform Refresh

**For Full Refresh:**

Run the map generator to regenerate all maps:

```bash
cd {working_directory}
node {plugin_root}/cli/lib/map-generator-cli.js refresh --full --project .
```

This will:
- Rescan entire project
- Regenerate all 11 maps
- Update staleness metadata
- Show completion statistics

**For Incremental Refresh:**

Run the incremental updater:

```bash
cd {working_directory}
node {plugin_root}/cli/lib/incremental-updater-cli.js --project . --hash {project_hash}
```

This will:
- Use git diff to find changed files
- Rescan only changed files
- Update affected map entries
- Regenerate dependency chains
- Much faster than full refresh

### Step 4: Show Results

After refresh completes, display results:

**Full Refresh:**
```
✓ Full refresh completed

Maps regenerated:
  • summary.json (Level 1)
  • tree.json (Level 2)
  • metadata.json (Level 3)
  • content-summaries.json (Level 3)
  • indices.json (Level 3)
  • existence-proofs.json (Level 2)
  • quick-queries.json (Level 1)
  • dependencies-forward.json (Level 4)
  • dependencies-reverse.json (Level 4)
  • relationships.json (Level 4)
  • issues.json (Level 4)

Statistics:
  Files scanned: {total_files}
  Time taken: {time_ms}ms
  Maps location: {maps_dir}

Staleness: 0/100 (fresh)
```

**Incremental Refresh:**
```
✓ Incremental refresh completed

Files updated:
  • Modified: {modified_count}
  • Added: {added_count}
  • Deleted: {deleted_count}

Maps updated:
  • metadata.json
  • content-summaries.json
  • dependencies-forward.json
  • dependencies-reverse.json

Statistics:
  Files scanned: {scanned_count}
  Time taken: {time_ms}ms
  Time saved: ~{time_saved_percent}% vs full rescan

Staleness: 0/100 (fresh)
```

### Step 5: Verification

After refresh, automatically verify staleness:

```bash
node {plugin_root}/cli/lib/staleness-checker.js . {maps_dir}/summary.json
```

Expected result: Score should be 0/100 (fresh)

## Error Handling

**Git not available:**
```
⚠️  Warning: Git not available, falling back to full refresh
```

**Too many changes for incremental:**
```
⚠️  Too many files changed ({change_percent}%)

Incremental refresh may miss dependencies.
Recommend: /project-maps-refresh --full
```

**Refresh failed:**
```
❌ Refresh failed: {error_message}

Try:
  1. Check git status
  2. Ensure no file permission issues
  3. Run full refresh: /project-maps-refresh --full
```

## Notes

- Incremental refresh is faster (target: <20% of full scan time)
- Full refresh guarantees consistency
- Refresh automatically updates staleness metadata
- Maps are compressed automatically during refresh
