# Project Maps List Command

List all projects with generated context maps.

**OPTIMIZATION:** Uses pre-formatted CLI output (~60% token reduction).

## Usage

```
/session:project-maps-list
```

## Implementation

### Step 1: Get Pre-formatted List

Run the CLI with `--formatted` flag:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps list --formatted
```

**Output the result directly** - no parsing or formatting needed. The CLI returns ready-to-display markdown with:
- Project names and paths
- File counts
- Generation timestamps (relative time)
- Staleness indicators
- Stale project warnings

Then STOP.

## Error Handling

If no maps directory exists, CLI returns formatted empty state message.
