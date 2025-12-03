# Project Maps Generate Command

Generate project context maps for the current project.

## Usage

```
/project-maps-generate [--path <project-path>]
```

## Options

- `--path <path>`: Project path to scan (defaults to current directory)

## Implementation

### Step 1: Run Generate Command

Execute the unified CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps generate
```

Or with a specific path:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps generate --path /path/to/project
```

### Step 2: Display Results

The command outputs JSON with:
- `projectPath`: The scanned project path
- `projectHash`: Unique hash for this project
- `outputDir`: Where maps are stored
- `filesScanned`: Number of files scanned
- `mapsCreated`: Number of maps generated (11)
- `scanTime`: Time taken in milliseconds

### Step 3: Show Success Message

```
Map generation completed successfully.

Summary:
  Files scanned: {filesScanned}
  Maps created: {mapsCreated}
  Storage: {outputDir}
  Time: {scanTime}ms

Next steps:
  /project-maps-load            Load maps
  /project-maps-query framework Get framework info
```

## Error Handling

If the command fails, show the error message from the JSON response.

## Performance Notes

- Small projects (<100 files): ~5-10 seconds
- Medium projects (100-1000 files): ~10-30 seconds
- Large projects (1000+ files): ~30-60 seconds
