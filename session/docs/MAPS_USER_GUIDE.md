# Project Maps User Guide

A comprehensive guide to using project maps for intelligent codebase navigation with Claude.

## What Are Project Maps?

Project maps are pre-computed contextual data about your codebase that enable Claude to answer questions about your code instantly without needing to read every file. Maps include:

- **File structure** - Directory tree, file types, entry points
- **Dependencies** - Import/export relationships between files
- **Architecture** - Backend layers, frontend components, modules
- **Code patterns** - Functions, classes, types, API endpoints
- **Issues** - Broken imports, circular dependencies, unused files

## Quick Start

### 1. Generate Maps for Your Project

```bash
/session:project-maps-generate
```

This scans your project and creates 17+ map files in `~/.claude/project-maps/{hash}/`.

### 2. Ask Questions Naturally

```bash
/session:project-maps-ask "what framework is this project using?"
/session:project-maps-ask "show me the largest files"
/session:project-maps-ask "what modules does this project have?"
```

### 3. Run Specific Queries

```bash
/session:project-maps-query framework
/session:project-maps-query modules
/session:project-maps-query issues
```

## When to Use Maps vs Other Tools

| Scenario | Best Tool | Why |
|----------|-----------|-----|
| "What framework does this use?" | Maps | Instant answer from pre-computed data |
| "Show all files importing auth.js" | Maps (search) | Cross-file dependency info |
| "What modules exist?" | Maps (query) | Architectural overview |
| "Find files named *.test.js" | Glob | Simple pattern matching |
| "Search for 'TODO' comments" | Grep | Content-based search |
| "Read the auth.js file" | Read | Direct file access |
| "What does this function do?" | Read | Need actual code content |

**Decision Tree:**

```
Is it about codebase structure/architecture?
  YES → Use Maps
  NO → Is it about file contents?
    YES → Use Read/Grep
    NO → Is it a file name pattern?
      YES → Use Glob
      NO → Use Maps for overview
```

## Available Query Types

### Quick Queries (Instant)

| Query | Description | Example Output |
|-------|-------------|----------------|
| `entry-points` | Main application entry files | `src/index.js (main)` |
| `framework` | Detected framework | `Next.js (react)` |
| `tests` | Test framework & locations | `Jest in tests/` |
| `largest` | Biggest files by size | `api.js (45KB)` |
| `recent` | Recently modified files | `auth.js (2 hours ago)` |
| `structure` | Top-level directories | `src/ (120 files)` |
| `languages` | Language distribution | `TypeScript (80%)` |

### Extended Queries (Detailed)

| Query | Description | Use Case |
|-------|-------------|----------|
| `backend-layers` | Architecture layers | Understanding app structure |
| `modules` | Business modules | Finding related code |
| `module-deps` | Module coupling | Impact analysis |
| `components` | Frontend components | UI inventory |
| `database` | DB schema info | Data model questions |
| `issues` | Code problems | Finding tech debt |
| `dependencies` | Import/export graph | Refactoring planning |

## Search Capabilities

### File Search
```bash
/session:project-maps-search file "*.controller.ts"
/session:project-maps-search file "auth*"
```

### Export Search
```bash
/session:project-maps-search export "UserService"
/session:project-maps-search export "use*"  # React hooks
```

### Import Search
```bash
/session:project-maps-search import "express"
/session:project-maps-search import "lodash"
```

### Function/Signature Search
```bash
/session:project-maps-search signature "async*fetch*"
/session:project-maps-search signature --async --returns=Promise
```

### Class Search
```bash
/session:project-maps-search class "Base*"
/session:project-maps-search class "Controller"
```

### Type Search
```bash
/session:project-maps-search type "I*Props"
/session:project-maps-search type "User*"
```

## Natural Language Questions

The intent routing system understands common questions:

| You Ask | Maps Understand |
|---------|-----------------|
| "What framework is this?" | `framework-info` query |
| "Show me the structure" | `structure` query |
| "What would break if I change X?" | `impact-analysis` with dependencies |
| "Where are the tests?" | `tests` query |
| "What modules exist?" | `modules` query |
| "Show code issues" | `issues` query |

## Output Formatting

### Claude-Optimized Output (Default)

Results are formatted for easy reading:
- Absolute file paths for direct navigation
- Line numbers when available
- Grouping by directory
- Summarization for large result sets

### With Annotations

Add `--annotate` for contextual insights:
```bash
/session:project-maps-search class "Service" --annotate
```

Annotations include:
- "Called by 12 other files" (dependency info)
- "Part of auth module" (module context)
- "Implements IUserService" (interface info)

### Raw JSON Output

For programmatic use:
```bash
/session:project-maps-search all "User" --json
```

## Best Practices

### 1. Keep Maps Fresh

Maps can become stale as code changes. Check staleness:
```bash
/session:project-maps-stats
```

Refresh when needed:
```bash
/session:project-maps-refresh
```

### 2. Use Specific Queries When Possible

Instead of searching "all", use specific types:
- `file` for file names
- `export` for exported symbols
- `import` for dependency tracking
- `signature` for function search

### 3. Combine Maps with Read

Maps tell you WHERE code is. Use Read to see WHAT it does:
```bash
# Find the file
/session:project-maps-search export "AuthService"
# Then read it
Read: src/services/auth.service.ts
```

### 4. Use for Impact Analysis

Before refactoring, check what depends on your code:
```bash
/session:project-maps-query dependencies
/session:project-maps-ask "what would break if I change auth.js?"
```

## Troubleshooting

### "No maps found for this project"

Generate maps first:
```bash
/session:project-maps-generate
```

### Maps seem outdated

Check and refresh:
```bash
/session:project-maps-stats      # Check staleness
/session:project-maps-refresh    # Update incrementally
/session:project-maps-refresh --full  # Full regeneration
```

### Search returns no results

1. Check if maps exist: `/session:project-maps-list`
2. Try broader patterns: `"User*"` instead of `"UserService"`
3. Use fuzzy search: `--fuzzy` flag
4. Verify search type matches your query

### Query returns "Unknown"

Some queries require specific code patterns to detect:
- Framework detection needs package.json or config files
- Module detection needs clear directory structure
- Database info needs schema files or ORM models

## Performance

| Operation | Typical Time |
|-----------|--------------|
| Quick query | < 10ms |
| Extended query | 50-200ms |
| Search (indexed) | < 100ms |
| Map generation | 2-5 min (large projects) |
| Incremental refresh | 10-30 sec |

Maps are designed for instant answers. If queries are slow, try:
1. Loading fewer maps: `--tier 1` for essential only
2. Using specific queries instead of full search
3. Refreshing maps if very stale

## Command Reference

| Command | Purpose |
|---------|---------|
| `/session:project-maps-generate` | Create maps for project |
| `/session:project-maps-list` | Show all mapped projects |
| `/session:project-maps-query <type>` | Run specific query |
| `/session:project-maps-ask "<question>"` | Natural language query |
| `/session:project-maps-search <type> <pattern>` | Search across maps |
| `/session:project-maps-stats` | Show map statistics |
| `/session:project-maps-refresh` | Update stale maps |
| `/session:project-maps-load --tier N` | Load specific tier |
