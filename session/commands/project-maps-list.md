# Project Maps List Command

List all projects with generated context maps.

## Usage

```
/project-maps-list
```

## Implementation

### Step 1: Run List Command

Execute the unified CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps list
```

### Step 2: Parse and Display Results

The response includes:
- `count`: Total number of projects
- `projects`: Array of project info

For each project show:
- Project name
- Project path
- Hash
- File count
- Last generated timestamp
- Staleness status

### Step 3: Format Output

```
Project Maps

Found {count} projects with generated maps:

1. {name}
   Path: {path}
   Hash: {hash}
   Files: {files}
   Generated: {timestamp}
   Staleness: {score}/100

2. {name}
   ...

Total storage: Calculate from all projects
```

### Step 4: Highlight Stale Projects

If any projects have high staleness scores (>60):
```
Projects needing refresh:
  {name} - Staleness: {score}/100
```

## Error Handling

If no maps directory exists:
```
No project maps found
Storage location: ~/.claude/project-maps/

Generate maps for current project:
  /project-maps-generate
```
