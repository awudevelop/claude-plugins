# Project Maps List Command

List all projects with generated context maps.

## Usage

```
/project-maps-list
```

## Implementation

### Step 1: Scan Maps Directory

List all subdirectories in the maps storage:

```bash
ls -d ~/.claude/project-maps/*/ 2>/dev/null
```

Each subdirectory represents a project hash.

### Step 2: Load Summary for Each Project

For each project hash, load the summary.json to get project details:

```javascript
const fs = require('fs').promises;
const path = require('path');
const MapLoader = require('./map-loader');

const mapsBaseDir = path.join(process.env.HOME, '.claude/project-maps');
const projectDirs = await fs.readdir(mapsBaseDir);

for (const hash of projectDirs) {
  if (hash === 'maps' || hash === 'schemas' || hash === 'temp') continue;

  try {
    const summaryPath = path.join(mapsBaseDir, hash, 'summary.json');
    const summary = await loadSummary(summaryPath);
    // Display project info
  } catch (error) {
    // Skip invalid projects
  }
}
```

### Step 3: Display Projects List

Show all projects with their metadata:

```
Project Maps

Found {count} projects with generated maps:

1. {project_name}
   Path: {project_path}
   Hash: {project_hash}
   Files: {file_count}
   Generated: {timestamp}
   Staleness: {score}/100 ({level})
   Size: {total_size}

2. {project_name}
   Path: {project_path}
   Hash: {project_hash}
   Files: {file_count}
   Generated: {timestamp}
   Staleness: {score}/100 ({level})
   Size: {total_size}

Total storage: {total_storage_size}

Commands:
  • Load project: /project-maps-load
  • Refresh: /project-maps-refresh
  • Generate new: /project-maps-generate
```

### Step 4: Highlight Stale Projects

Mark projects that need refresh:

```
⚠️  The following projects may need refresh:
  • {project_name} - Staleness: {score}/100
  • {project_name} - Staleness: {score}/100

Run: /project-maps-refresh to update
```

## Error Handling

**No maps found:**
```
No project maps found

Storage location: ~/.claude/project-maps/

Generate maps for current project:
  /project-maps-generate
```

**Corrupt project data:**
```
⚠️  Found {count} projects, but {error_count} have corrupt data:
  • {hash} - Cannot read summary
  • {hash} - Missing metadata

Consider removing corrupt entries:
  rm -rf ~/.claude/project-maps/{hash}
```

## Examples

```bash
# List all projects with maps
/project-maps-list
```
