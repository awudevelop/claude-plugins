# Project Context Maps - Usage Guide

A powerful system for pre-computing and caching project structure and relationships to optimize Claude's performance.

## Quick Start

### 1. Generate Maps (First Time)

```bash
/project-maps-generate
```

This will:
- Scan your project files
- Generate 11 different map types
- Compress and store in `~/.claude/project-maps/`
- Takes 10-30 seconds for most projects

### 2. Query Your Project

```bash
# Get instant answers to common questions
/project-maps-query entry-points
/project-maps-query framework
/project-maps-query tests
/project-maps-query largest
/project-maps-query recent
```

### 3. Load Detailed Information

```bash
# Load summary (default)
/project-maps-load

# Load directory structure
/project-maps-load --tier 2

# Load detailed metadata
/project-maps-load --tier 3

# Load dependency graphs
/project-maps-load --tier 4
```

### 4. Keep Maps Fresh

```bash
# Incremental refresh (fast)
/project-maps-refresh --incremental

# Full refresh (slower, complete)
/project-maps-refresh --full
```

## Map Tiers Explained

### Tier 1: Overview (~3KB)
**When to use**: Quick project overview, basic statistics

**Maps**:
- `summary.json` - Project name, file counts, languages, framework
- `quick-queries.json` - Pre-computed answers (entry points, test locations, etc.)

**Load time**: Instant

**Example**:
```bash
/project-maps-load --tier 1
```

### Tier 2: Structure (~10KB)
**When to use**: Understanding directory layout, finding missing files

**Maps**:
- `tree.json` - Complete directory tree
- `existence-proofs.json` - File manifests, negative space detection

**Load time**: Very fast

**Example**:
```bash
/project-maps-load --tier 2
```

### Tier 3: Details (~60KB)
**When to use**: Deep file analysis, finding specific code patterns

**Maps**:
- `metadata.json` - File sizes, types, roles, timestamps
- `content-summaries.json` - Exports, imports, entities per file
- `indices.json` - Navigation by type/role/size/recency

**Load time**: Fast

**Example**:
```bash
/project-maps-load --tier 3
```

### Tier 4: Relationships (~10KB)
**When to use**: Understanding dependencies, finding circular dependencies

**Maps**:
- `dependencies-forward.json` - What each file imports
- `dependencies-reverse.json` - Who imports each file
- `relationships.json` - Dependency chains and depth
- `issues.json` - Broken imports, circular deps, unused files

**Load time**: Fast

**Example**:
```bash
/project-maps-load --tier 4
```

## Available Commands

### Generation & Management

| Command | Description |
|---------|-------------|
| `/project-maps-generate` | Generate maps for current project (first time) |
| `/project-maps-refresh` | Refresh existing maps (incremental or full) |
| `/project-maps-list` | Show all projects with generated maps |
| `/project-maps-stats` | Show compression metrics and system stats |

### Querying & Loading

| Command | Description |
|---------|-------------|
| `/project-maps-query <type>` | Get instant answers to common questions |
| `/project-maps-load [--tier N]` | Load maps by tier (1-4) or specific map |

### Query Types

| Query Type | Returns |
|-----------|---------|
| `entry-points` | Application entry points |
| `framework` | Detected framework and type |
| `tests` | Test file locations and frameworks |
| `largest` | Largest files (potential refactoring targets) |
| `recent` | Recently modified files |
| `structure` | Project directory structure |
| `languages` | Programming languages used |
| `all` | Show all available query types |

## Staleness & Refresh

Maps track staleness automatically based on:
- Git commit hash changes
- File count changes
- Time since last refresh

**Staleness Levels**:
- **0-30**: Fresh, no action needed
- **30-60**: Moderate staleness, incremental refresh recommended
- **60-100**: Critical staleness, full refresh recommended

**When maps are loaded**, you'll see warnings:
```
⚠️  Maps may be outdated
   Staleness: 45/100 - Incremental refresh recommended
   Consider running: /project-maps-refresh --incremental
```

## Compression

All maps are automatically compressed to save space:

**Compression Levels**:
1. **Minification** - Remove whitespace (all files)
2. **Key Abbreviation** - Shorten JSON keys (files >5KB)
3. **Value Deduplication** - Reference tables (files >20KB)

**Typical Results**:
- Original: 45 KB → Compressed: 19 KB (58% compression)
- Decompression is automatic and instant

## Storage Location

Maps are stored at: `~/.claude/project-maps/{project-hash}/`

Each project gets a unique hash based on its absolute path.

**Example structure**:
```
~/.claude/project-maps/
└── 38c52ad9d2f82205/
    ├── summary.json
    ├── tree.json
    ├── metadata.json
    ├── content-summaries.json
    ├── indices.json
    ├── existence-proofs.json
    ├── quick-queries.json
    ├── dependencies-forward.json
    ├── dependencies-reverse.json
    ├── relationships.json
    └── issues.json
```

## Performance Characteristics

### Generation (First Time)
- Small project (<100 files): ~5-10 seconds
- Medium project (100-1000 files): ~10-30 seconds
- Large project (1000+ files): ~30-60 seconds

### Refresh (Incremental)
- Target: <20% of full generation time
- Only scans changed files
- Automatically falls back to full if >30% files changed

### Queries
- Instant (pre-computed, no file system access)
- Answers available in <1ms

### Loading
- Tier 1: Instant (~3KB)
- Tier 2: Very fast (~10KB)
- Tier 3: Fast (~60KB)
- Tier 4: Fast (~10KB)

## Use Cases

### 1. New to a Project
```bash
# Generate maps
/project-maps-generate

# Get overview
/project-maps-query framework
/project-maps-query entry-points
/project-maps-query structure

# Load full context
/project-maps-load --tier 3
```

### 2. Finding Dependencies
```bash
# Load dependency maps
/project-maps-load --tier 4

# Or check a specific file
/project-maps-load --map dependencies-forward
```

### 3. Refactoring Large Files
```bash
# Find candidates
/project-maps-query largest

# Get detailed metadata
/project-maps-load --tier 3
```

### 4. After Making Changes
```bash
# Quick refresh
/project-maps-refresh --incremental

# Verify freshness
/project-maps-load --tier 1
```

### 5. Understanding Test Coverage
```bash
# Find test locations
/project-maps-query tests

# Load file metadata to compare
/project-maps-load --tier 3
```

## Best Practices

1. **Generate once per project** - First time you work on a project
2. **Refresh incrementally** - After making changes (fast)
3. **Use queries for quick answers** - Faster than searching
4. **Load appropriate tier** - Start with Tier 1, go deeper as needed
5. **Monitor staleness** - Refresh if score >30

## Troubleshooting

### Maps not found
```bash
# Solution: Generate maps first
/project-maps-generate
```

### Maps outdated
```bash
# Solution: Refresh maps
/project-maps-refresh --incremental
```

### Slow generation
```bash
# Cause: Large project with many files
# Solution: Be patient, it's a one-time cost
# Subsequent refreshes will be much faster
```

### Corrupt maps
```bash
# Solution: Regenerate
rm -rf ~/.claude/project-maps/{project-hash}
/project-maps-generate
```

## Advanced Usage

### Manual CLI Access

All commands have underlying CLI tools:

```bash
# Direct access to map generator
node session/cli/lib/map-generator.js .

# Direct access to map loader
node session/cli/lib/map-loader.js . --tier 1

# Direct access to staleness checker
node session/cli/lib/staleness-checker.js . ~/.claude/project-maps/{hash}/summary.json

# Direct access to refresh
node session/cli/lib/refresh-cli.js --incremental
```

### Configuration

Maps respect `.gitignore` and standard exclusions:
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- Hidden files/directories (`.*)

### Custom Configuration

Create `.projectmaprc` for custom settings (future enhancement).

## Integration with Sessions

Project maps work seamlessly in session plugin:

1. **Generate maps** for your project
2. **Query or load** maps within session
3. **Refresh** as you make changes
4. Maps provide **instant context** to Claude

Maps enhance Claude's ability to:
- Answer questions about your project structure
- Find files and dependencies quickly
- Understand relationships between modules
- Suggest refactoring based on size/complexity
- Navigate large codebases efficiently

## Next Steps

1. Generate maps for your current project: `/project-maps-generate`
2. Try a quick query: `/project-maps-query framework`
3. Load overview: `/project-maps-load --tier 1`
4. Explore deeper: `/project-maps-load --tier 4`

Happy mapping! 🗺️
