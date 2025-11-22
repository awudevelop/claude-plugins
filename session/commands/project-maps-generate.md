# Project Maps Generate Command

Generate project context maps for the current project.

## Usage

```
/project-maps-generate [--path <project-path>]
```

## Options

- `--path <path>`: Project path to scan (defaults to current directory)
- No options: Generate maps for current working directory

## Implementation

### Step 1: Determine Project Path

Parse command arguments to determine project path:

```javascript
const args = process.argv.slice(2);
const pathIndex = args.indexOf('--path');
const projectPath = pathIndex >= 0 && args[pathIndex + 1]
  ? args[pathIndex + 1]
  : process.cwd();
```

Default to current working directory if no path specified.

### Step 2: Check if Maps Already Exist

Check if maps have already been generated for this project:

```bash
cd {working_directory}
node ${CLAUDE_PLUGIN_ROOT}/cli/lib/map-loader.js {project_path} --staleness-only 2>&1
```

If maps exist (exit code 0), ask user if they want to regenerate:

```
⚠️  Maps already exist for this project

Existing maps:
  Location: {maps_dir}
  Last generated: {timestamp}
  Staleness: {score}/100

Regenerate maps? This will overwrite existing maps.
  • Yes, regenerate (will take ~10-30 seconds)
  • No, use refresh instead (faster, preserves existing data)
```

If user chooses "No", suggest using refresh instead:
```
Tip: Use /project-maps-refresh for faster updates
```

### Step 3: Initialize and Scan Project

Show progress and start generation:

```
Generating project context maps...

Project: {project_path}
Project hash: {hash}
```

Run the map generator:

```bash
cd {working_directory}
node ${CLAUDE_PLUGIN_ROOT}/cli/lib/map-generator.js {project_path}
```

The map generator will:
1. Initialize configuration
2. Scan file system
3. Generate 11 map files (Phases 1-3)
4. Apply compression
5. Save to `~/.claude/project-maps/{project-hash}/`

### Step 4: Show Progress

The map generator outputs progress:

```
Scanning project...
Scanned 145 files in 127ms

Generating maps...
  ✓ summary.json (2.1 KB → 907 B, 56% compression)
  ✓ tree.json (3.2 KB → 1.4 KB, 56% compression)
  ✓ metadata.json (12.5 KB → 5.2 KB, 58% compression)
  ✓ content-summaries.json (1.1 KB → 465 B, 58% compression)
  ✓ indices.json (11.8 KB → 5.0 KB, 58% compression)
  ✓ existence-proofs.json (4.0 KB → 1.7 KB, 58% compression)
  ✓ quick-queries.json (6.4 KB → 2.7 KB, 58% compression)
  ✓ dependencies-forward.json (1.1 KB → 477 B, 57% compression)
  ✓ dependencies-reverse.json (1.1 KB → 445 B, 60% compression)
  ✓ relationships.json (1.5 KB → 630 B, 58% compression)
  ✓ issues.json (1.3 KB → 557 B, 57% compression)
```

### Step 5: Display Summary

After generation completes, show summary:

```
✓ Maps generated successfully!

Summary:
  Files scanned: {file_count}
  Maps created: 11
  Storage location: {maps_dir}

  Total size:
    • Original: {original_size} KB
    • Compressed: {compressed_size} KB
    • Compression: {compression_ratio}%

  Maps by tier:
    • Tier 1 (Always loaded): summary.json, quick-queries.json
    • Tier 2 (On demand): tree.json, existence-proofs.json
    • Tier 3 (When needed): metadata.json, content-summaries.json, indices.json
    • Tier 4 (Deep analysis): dependencies-*.json, relationships.json, issues.json

Next steps:
  • Load maps: /project-maps-load
  • Quick queries: /project-maps-query
  • Refresh maps: /project-maps-refresh
```

### Step 6: Verify Generation

Verify all expected files were created:

```bash
ls -lh ~/.claude/project-maps/{project_hash}/*.json | wc -l
```

Expected: 11 files

If count != 11, show warning:
```
⚠️  Warning: Expected 11 map files but found {actual_count}
Some maps may have failed to generate.
```

## Error Handling

**Project path doesn't exist:**
```
❌ Error: Project path not found

Path: {project_path}
Please check the path and try again.
```

**Permission denied:**
```
❌ Error: Permission denied

Cannot write to: ~/.claude/project-maps/
Check directory permissions.
```

**Generation failed:**
```
❌ Map generation failed: {error_message}

Possible causes:
  1. Insufficient disk space
  2. Invalid project structure
  3. File access permissions

Try:
  • Check disk space
  • Verify project directory is accessible
  • Run with --verbose for more details
```

**No files found:**
```
⚠️  No files found in project

The project appears to be empty or all files are excluded.
Check your .gitignore or .projectmaprc configuration.
```

## Performance Notes

- Small projects (<100 files): ~5-10 seconds
- Medium projects (100-1000 files): ~10-30 seconds
- Large projects (1000+ files): ~30-60 seconds
- Generation happens once, subsequent updates use incremental refresh (much faster)

## Examples

```bash
# Generate maps for current directory
/project-maps-generate

# Generate maps for specific project
/project-maps-generate --path /path/to/project

# Generate with verbose output
/project-maps-generate --verbose
```
