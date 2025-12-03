# Project Maps Query Command

Query project information instantly from pre-computed maps.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- Correct: `/session:project-maps-query`
- Wrong: `/project-maps-query`

## Usage

```
/session:project-maps-query <type>
```

## Quick Query Types (from quick-queries.json)

- `entry-points` - Show entry point files
- `framework` - Show detected framework
- `tests` - Show test configuration
- `largest` - Show largest files
- `recent` - Show recently modified files
- `structure` - Show top-level structure
- `languages` - Show primary languages
- `summary` - Show full quick-queries data (default)

## Extended Query Types (from dedicated map files)

- `backend-layers` - Show backend architecture layers
- `modules` - Show detected business modules
- `module-deps` - Show module dependencies & coupling
- `components` - Show frontend components
- `component-meta` - Show component metadata (hooks, state, exports)
- `database` - Show database schema info
- `data-flow` - Show data flow patterns
- `table-mapping` - Show table-to-module mapping
- `dependencies` - Show file dependencies (forward & reverse)
- `issues` - Show detected code issues (broken imports, unused files)
- `relationships` - Show file relationships

## Implementation

### Step 1: Run Query Command

Execute the unified CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps query {type}
```

Examples:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps query framework
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps query entry-points
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps query tests
```

### Step 2: Parse JSON Response

The response includes:
- `success`: Boolean indicating success
- `queryType`: The query that was executed
- `result`: The query results

### Step 3: Display Results

Format the output based on query type:

**entry-points:**
```
Entry Points:
  Primary: {file}
  All:
    - {file} ({type})
    - {file} ({type})
```

**framework:**
```
Framework: {name}
Type: {type}
```

**tests:**
```
Test Framework: {framework}
Test Location: {location}
```

**largest:**
```
Largest Files:
  1. {file} - {size}
  2. {file} - {size}
```

**recent:**
```
Recently Modified:
  1. {file} - {timestamp}
  2. {file} - {timestamp}
```

**structure:**
```
Project Structure:
  {directory} - {file_count} files
  {directory} - {file_count} files
```

**languages:**
```
Primary Languages:
  1. {language} - {count} files
  2. {language} - {count} files
```

## Performance

All queries are instant (<1ms) as they use pre-computed data.

## Error Handling

If maps don't exist:
```
No maps found for this project.
Run: /project-maps-generate
```

If unknown query type:
```
Unknown query type: {type}

Available types:
  Quick: entry-points, framework, tests, largest, recent, structure, languages, summary
  Extended: backend-layers, modules, module-deps, components, component-meta,
            database, data-flow, table-mapping, dependencies, issues, relationships
```

## Examples

### Quick Queries
```bash
/session:project-maps-query entry-points
/session:project-maps-query framework
/session:project-maps-query tests
/session:project-maps-query largest
/session:project-maps-query recent
/session:project-maps-query structure
/session:project-maps-query languages
```

### Extended Queries
```bash
/session:project-maps-query backend-layers   # Architecture layers
/session:project-maps-query modules          # Business modules
/session:project-maps-query module-deps      # Module coupling
/session:project-maps-query components       # Frontend components
/session:project-maps-query database         # DB schema info
/session:project-maps-query issues           # Code issues
/session:project-maps-query dependencies     # Import/export deps
```

## Natural Language Alternative

Use `/session:project-maps-ask` for natural language questions:
```bash
/session:project-maps-ask "what modules does this project have?"
/session:project-maps-ask "show me the largest files"
/session:project-maps-ask "what framework is this using?"
```
