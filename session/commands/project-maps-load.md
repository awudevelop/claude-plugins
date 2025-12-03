# Project Maps Load Command

Load and display project context maps with tiered loading.

## Usage

```
/project-maps-load [--tier <1|2|3|4>] [--map <map-name>]
```

## Options

- `--tier <N>`: Load all maps from specific tier (1-4)
- `--map <name>`: Load specific map by name
- No options: Load Tier 1 (summary + quick-queries)

## Tier Levels

**Tier 1** (~3KB): summary, quick-queries
**Tier 2** (~10KB): tree, existence-proofs
**Tier 3** (~60KB): metadata, content-summaries, indices
**Tier 4** (~10KB): dependencies-forward/reverse, relationships, issues

## Implementation

### Step 1: Load Maps

Execute the unified CLI:

```bash
# Load tier 1 (default)
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps load

# Load specific tier
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps load --tier 2

# Load specific map
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps load --map summary
```

### Step 2: Parse JSON Response

The response includes:
- `success`: Boolean indicating success
- `type`: "tier" or "single"
- `data`: The actual map data

### Step 3: Display Results

Format the output based on which tier/map was loaded:

**For Tier 1:**
- Show project overview (name, path, files, size)
- Show framework detection
- Show quick answers (entry points, tests, etc.)

**For other tiers:**
- Show relevant information from the loaded maps

## Error Handling

If no maps exist:
```
No maps found for this project.
Run: /project-maps-generate
```
