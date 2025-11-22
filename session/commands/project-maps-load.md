# Project Maps Load Command

Load and display project context maps with tiered loading.

## Usage

```
/project-maps-load [--tier <1|2|3|4>] [--map <map-name>]
```

## Options

- `--tier <N>`: Load all maps from specific tier (1, 2, 3, or 4)
- `--map <name>`: Load specific map by name
- No options: Load Tier 1 (summary + quick-queries)

## Tier Levels

**Tier 1** (Always loaded, ~3KB):
- `summary.json` - Project overview and statistics
- `quick-queries.json` - Pre-computed answers to common questions

**Tier 2** (On demand, ~10KB):
- `tree.json` - Directory structure
- `existence-proofs.json` - File manifests and negative space

**Tier 3** (When needed, ~60KB):
- `metadata.json` - Comprehensive file metadata
- `content-summaries.json` - Exports, imports, entities
- `indices.json` - Navigation indices by type/role/size/recency

**Tier 4** (Deep analysis, ~10KB):
- `dependencies-forward.json` - Import graphs
- `dependencies-reverse.json` - Who imports what
- `relationships.json` - Dependency chains
- `issues.json` - Broken imports, circular deps, unused files

## Implementation

### Step 1: Check if Maps Exist

First, verify maps exist for current project:

```bash
cd {working_directory}
node {plugin_root}/cli/lib/map-loader.js . --staleness-only
```

If no maps exist (exit code 1), show error:
```
❌ No project maps found

Generate maps first:
  /project-maps-generate
```

### Step 2: Parse Arguments and Determine Load Mode

Parse command arguments:

```javascript
const args = process.argv.slice(2);
let loadMode = 'tier';
let tierLevel = 1;
let mapName = null;

if (args.includes('--tier')) {
  const tierIndex = args.indexOf('--tier');
  tierLevel = parseInt(args[tierIndex + 1]) || 1;
  loadMode = 'tier';
}

if (args.includes('--map')) {
  const mapIndex = args.indexOf('--map');
  mapName = args[mapIndex + 1];
  loadMode = 'single';
}
```

### Step 3: Load Maps

**For Tier Loading:**

```bash
node {plugin_root}/cli/lib/map-loader.js . --tier {tier_level}
```

**For Single Map Loading:**

```bash
node {plugin_root}/cli/lib/map-loader.js . {map_name}
```

The loader will:
1. Decompress maps automatically
2. Check staleness and show warnings
3. Return the map data

### Step 4: Display Results

**Tier 1 Display (Summary):**

```
✓ Tier 1 maps loaded

Project Overview:
  Name: {project_name}
  Path: {project_path}
  Files: {total_files}
  Size: {total_size}
  Primary languages: {languages}

Framework: {framework_name} ({framework_type})

Quick Answers:
  • Entry points: {entry_points}
  • Test location: {test_location}
  • Largest files: {largest_files}
  • Recently modified: {recent_files}

Staleness: {staleness_score}/100 ({staleness_level})

Next steps:
  • Load more detail: /project-maps-load --tier 2
  • Query specific info: /project-maps-query
  • Refresh maps: /project-maps-refresh
```

**Tier 2 Display (Structure):**

```
✓ Tier 2 maps loaded

Directory Structure:
{tree_visualization}

Top-level directories:
  • src/ ({file_count} files)
  • tests/ ({file_count} files)
  • config/ ({file_count} files)

File Existence:
  ✓ package.json
  ✓ tsconfig.json
  ✓ .gitignore
  ✗ jest.config.js (missing)
  ✗ .env.example (missing)
```

**Tier 3 Display (Detailed Metadata):**

```
✓ Tier 3 maps loaded

Detailed File Metadata: {total_files} files

By Type:
  • TypeScript: {ts_count} files ({ts_size})
  • JavaScript: {js_count} files ({js_size})
  • JSON: {json_count} files ({json_size})

By Role:
  • Source: {source_count} files
  • Tests: {test_count} files
  • Config: {config_count} files

Content Summaries:
  Top exports:
    • {file}: {exports}
    • {file}: {exports}

Indices loaded:
  • By type: {type_count} types
  • By role: {role_count} roles
  • By size: {size_buckets} buckets
  • By recency: Last {recent_days} days
```

**Tier 4 Display (Dependencies):**

```
✓ Tier 4 maps loaded

Dependency Analysis:

Forward Dependencies:
  • {file} imports from {import_count} sources
  • {file} imports from {import_count} sources

Reverse Dependencies (Most imported):
  1. {file} - imported by {count} files
  2. {file} - imported by {count} files
  3. {file} - imported by {count} files

Issues Detected:
  ⚠️  Circular dependencies: {circular_count}
  ⚠️  Broken imports: {broken_count}
  ⚠️  Unused files: {unused_count}

Relationship Metrics:
  • Max dependency depth: {max_depth}
  • Average dependencies per file: {avg_deps}
  • Tightly coupled modules: {coupled_count}
```

**Single Map Display:**

Show the specific map data in formatted JSON:

```
✓ Map loaded: {map_name}

{formatted_json_output}

Staleness: {score}/100
Size: {compressed_size} compressed ({original_size} original, {ratio}% compression)
```

### Step 5: Staleness Warning

If staleness score >= 30, show warning (automatically done by loader):

```
⚠️  Maps may be outdated
   Staleness: {score}/100 - {recommendation}
   Consider running: /project-maps-refresh --incremental
```

## Error Handling

**Maps not found:**
```
❌ No project maps found

Generate maps first:
  /project-maps-generate
```

**Invalid tier:**
```
❌ Invalid tier level: {tier}

Valid tiers: 1, 2, 3, or 4
```

**Map not found:**
```
❌ Map not found: {map_name}

Available maps:
  • summary
  • tree
  • metadata
  • content-summaries
  • indices
  • existence-proofs
  • quick-queries
  • dependencies-forward
  • dependencies-reverse
  • relationships
  • issues
```

**Load failed:**
```
❌ Failed to load maps: {error_message}

Try:
  1. Regenerate maps: /project-maps-generate
  2. Check file permissions
  3. Verify maps directory exists
```

## Performance Notes

- Tier 1: Instant load (~3KB)
- Tier 2: Very fast (~10KB)
- Tier 3: Fast (~60KB)
- Tier 4: Fast (~10KB)
- Single map: Depends on map size
- All decompression happens automatically

## Examples

```bash
# Load Tier 1 (default)
/project-maps-load

# Load Tier 2 (directory structure)
/project-maps-load --tier 2

# Load Tier 3 (detailed metadata)
/project-maps-load --tier 3

# Load Tier 4 (dependencies)
/project-maps-load --tier 4

# Load specific map
/project-maps-load --map summary
/project-maps-load --map dependencies-forward
```
