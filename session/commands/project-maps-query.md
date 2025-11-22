# Project Maps Query Command

Query pre-computed answers from project context maps.

## Usage

```
/project-maps-query <query-type>
```

## Query Types

- `entry-points` - What are the entry points?
- `framework` - Which framework is used?
- `tests` - Where are the tests?
- `largest` - What are the largest files?
- `recent` - What changed recently?
- `structure` - What's the project structure?
- `languages` - What languages are used?
- `all` - Show all available queries

## Implementation

### Step 1: Check if Maps Exist

Verify maps exist for current project:

```bash
cd {working_directory}
node ${CLAUDE_PLUGIN_ROOT}/cli/lib/map-loader.js . --staleness-only
```

If no maps exist, show error and stop.

### Step 2: Parse Query Type

Extract query type from arguments:

```javascript
const args = process.argv.slice(2);
const queryType = args[0] || 'all';
```

### Step 3: Load Quick Queries Map

Load the pre-computed quick-queries map:

```javascript
const MapLoader = require('./map-loader');
const loader = new MapLoader(process.cwd());
const quickQueries = await loader.load('quick-queries');
```

### Step 4: Execute Query and Display Results

Based on query type, extract and display the relevant information:

**Entry Points Query:**

```
Query: What are the entry points?

Entry Points:
  1. src/index.ts - Main application entry
  2. src/server.ts - Server entry
  3. src/cli.ts - CLI entry

Description:
  These files serve as the main entry points to the application.
  They are typically referenced in package.json or imported first.

Related files:
  • package.json: "main": "src/index.ts"
  • package.json: "bin": "src/cli.ts"
```

**Framework Query:**

```
Query: Which framework is used?

Framework: React
Type: Frontend (Single Page Application)
Version: Detected from package.json

Key indicators:
  • package.json dependencies: react, react-dom
  • File patterns: *.jsx, *.tsx files in src/
  • Common React patterns detected

Related:
  • Build tool: Vite
  • Testing: Jest + React Testing Library
  • State management: Redux
```

**Tests Query:**

```
Query: Where are the tests?

Test Files: {test_count} files

Locations:
  • tests/ - {count} files
  • src/**/*.test.ts - {count} files
  • src/**/*.spec.ts - {count} files

Test Frameworks:
  • Jest - Main test runner
  • React Testing Library - Component tests

Coverage:
  • Source files: {source_count}
  • Test files: {test_count}
  • Coverage ratio: {ratio}%
```

**Largest Files Query:**

```
Query: What are the largest files?

Largest Files (by size):
  1. dist/bundle.js - 2.4 MB (generated)
  2. src/components/Dashboard.tsx - 842 KB
  3. src/utils/helpers.ts - 567 KB
  4. node_modules/.bin/webpack - 234 KB (dependency)
  5. src/data/constants.json - 189 KB

Recommendations:
  ⚠️  Dashboard.tsx is unusually large (842 KB)
     Consider splitting into smaller components

  ⚠️  helpers.ts contains many utilities (567 KB)
     Consider organizing into separate modules
```

**Recent Changes Query:**

```
Query: What changed recently?

Recently Modified Files (last 7 days):
  1. src/components/Login.tsx - 2 hours ago
  2. src/api/auth.ts - 5 hours ago
  3. tests/auth.test.ts - 5 hours ago
  4. src/types/user.ts - 1 day ago
  5. README.md - 3 days ago

Activity Summary:
  • Most active directory: src/components/ ({count} changes)
  • Most active author: {author} ({count} commits)
  • Files modified: {count}
```

**Structure Query:**

```
Query: What's the project structure?

Project Structure:

├── src/                    ({file_count} files)
│   ├── components/         ({file_count} files)
│   ├── utils/              ({file_count} files)
│   ├── api/                ({file_count} files)
│   └── types/              ({file_count} files)
├── tests/                  ({file_count} files)
├── config/                 ({file_count} files)
└── dist/                   ({file_count} files)

Conventions:
  • Source code: src/
  • Tests: tests/ and *.test.ts
  • Configuration: config/
  • Build output: dist/
```

**Languages Query:**

```
Query: What languages are used?

Primary Languages:
  1. TypeScript - {count} files ({percentage}%)
  2. JavaScript - {count} files ({percentage}%)
  3. JSON - {count} files ({percentage}%)
  4. Markdown - {count} files ({percentage}%)

Language Distribution:
  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░] TypeScript (75%)
  [▓▓▓░░░░░░░░░░░░░░░] JavaScript (15%)
  [▓░░░░░░░░░░░░░░░░░] JSON (5%)
  [░░░░░░░░░░░░░░░░░░] Other (5%)
```

**All Queries:**

```
Available Queries:

1. entry-points - What are the entry points?
2. framework - Which framework is used?
3. tests - Where are the tests?
4. largest - What are the largest files?
5. recent - What changed recently?
6. structure - What's the project structure?
7. languages - What languages are used?

Usage:
  /project-maps-query <query-type>

Example:
  /project-maps-query entry-points
  /project-maps-query framework
```

### Step 5: Show Staleness If Relevant

If staleness score >= 30, append warning:

```
⚠️  Note: Maps are {staleness_score}/100 stale
   Query results may be outdated. Consider refreshing:
   /project-maps-refresh
```

## Error Handling

**Maps not found:**
```
❌ No project maps found

Generate maps first:
  /project-maps-generate
```

**Invalid query type:**
```
❌ Unknown query type: {query_type}

Available query types:
  • entry-points
  • framework
  • tests
  • largest
  • recent
  • structure
  • languages
  • all

Usage:
  /project-maps-query <query-type>
```

**No data available:**
```
⚠️  No data available for query: {query_type}

This might happen if:
  1. The project doesn't have this information
  2. Maps need to be regenerated
  3. The data wasn't captured during generation

Try:
  /project-maps-refresh
```

## Performance Notes

- Queries are instant (pre-computed during generation)
- No file system scanning required
- Answers come from quick-queries.json (~3KB)
- Perfect for getting quick insights without deep analysis

## Examples

```bash
# What are the entry points?
/project-maps-query entry-points

# Which framework is used?
/project-maps-query framework

# Where are the tests?
/project-maps-query tests

# What are the largest files?
/project-maps-query largest

# What changed recently?
/project-maps-query recent

# Show all available queries
/project-maps-query all
```
