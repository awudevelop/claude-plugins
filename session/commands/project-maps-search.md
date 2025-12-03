You are executing the /session:project-maps-search command to search across project maps.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:project-maps-search`, `/session:project-maps-list`
- ❌ Wrong: `/project-maps-search`, `/project-maps list`

## Arguments

Parse from command: `/session:project-maps-search [type] [pattern]`

- `type`: Search type - one of: file, export, import, signature, class, type, all
- `pattern`: Search pattern (supports wildcards with *)

## Workflow

### Step 1: Validate Arguments

If no arguments provided, show help:

```
📖 Project Maps Search

Usage: /session:project-maps-search <type> <pattern>

Search Types:
  file       Search by file name pattern
  export     Search for exported symbols
  import     Search for import statements
  signature  Search function/method signatures
  class      Search for class definitions
  type       Search for TypeScript types/interfaces
  all        Search across all categories

Pattern Syntax:
  - Simple string: "UserService" (case-insensitive)
  - Wildcard: "User*" matches UserService, UserController, etc.
  - Regex: /^get.*User$/i

Examples:
  /session:project-maps-search file "*.controller.ts"
  /session:project-maps-search export "UserService"
  /session:project-maps-search import "express"
  /session:project-maps-search signature "async*fetch*"
  /session:project-maps-search class "Base*"
  /session:project-maps-search type "I*Props"
  /session:project-maps-search all "User"

Advanced Signature Search:
  /session:project-maps-search signature --async          # All async functions
  /session:project-maps-search signature --params=2      # Functions with 2 params
  /session:project-maps-search signature --returns=Promise  # Returns Promise
```

### Step 2: Load Project Maps

First, find the current project's maps:

```bash
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps list
```

This returns available maps. If no maps exist, show:

```
❌ No project maps found

Generate maps first:
  /session:project-maps-generate
```

### Step 3: Execute Search

Based on the search type, use the CLI:

```bash
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps search {type} "{pattern}"
```

The CLI returns JSON results:

```json
{
  "success": true,
  "data": {
    "query": "User*",
    "type": "all",
    "results": {
      "files": [...],
      "exports": [...],
      "functions": [...],
      "classes": [...],
      "types": [...]
    },
    "totalCount": 15,
    "searchTime": "23ms"
  }
}
```

### Step 4: Format Results

Display results in a readable format:

**For file search:**
```
📁 File Search: "*.controller.ts"

Found 5 files:
  1. src/controllers/user.controller.ts (2.3KB)
  2. src/controllers/auth.controller.ts (1.8KB)
  3. src/controllers/product.controller.ts (3.1KB)
  4. src/controllers/order.controller.ts (2.7KB)
  5. src/controllers/admin.controller.ts (1.5KB)
```

**For export search:**
```
📤 Export Search: "UserService"

Found 3 exports:
  1. UserService (class) - src/services/user.service.ts:15
  2. UserServiceImpl (class) - src/services/impl/user.service.impl.ts:8
  3. userService (const) - src/services/index.ts:12
```

**For import search:**
```
📥 Import Search: "express"

Found 8 files importing 'express':
  1. src/app.ts - import express from 'express'
  2. src/server.ts - import { Router } from 'express'
  3. src/middleware/auth.ts - import { Request, Response } from 'express'
  ...
```

**For signature search:**
```
🔍 Signature Search: "async*fetch*"

Found 4 functions:
  1. async fetchUser(id: string): Promise<User>
     └─ src/services/user.service.ts:25

  2. async fetchProducts(query: Query): Promise<Product[]>
     └─ src/services/product.service.ts:42

  3. async fetchOrderById(orderId: string, userId?: string): Promise<Order>
     └─ src/services/order.service.ts:18

  4. UserService.fetchAll(): Promise<User[]>
     └─ src/services/user.service.ts:58 (method)
```

**For class search:**
```
📦 Class Search: "Base*"

Found 3 classes:
  1. BaseController
     ├─ Methods: handleRequest, sendResponse, validateInput
     ├─ Location: src/controllers/base.controller.ts:5
     └─ Exported: ✓

  2. BaseService extends Injectable
     ├─ Methods: init, destroy, getConfig
     ├─ Location: src/services/base.service.ts:12
     └─ Exported: ✓

  3. BaseRepository<T>
     ├─ Methods: find, save, delete, update
     ├─ Location: src/repositories/base.repository.ts:8
     └─ Exported: ✓ (abstract)
```

**For type search:**
```
📋 Type Search: "I*Props"

Found 6 types:
  1. interface IUserProps
     ├─ Properties: id, name, email, avatar?
     └─ Location: src/types/user.types.ts:5

  2. interface IButtonProps extends IBaseProps
     ├─ Properties: onClick, disabled?, variant
     └─ Location: src/components/Button/types.ts:3

  3. type IFormProps<T> = { data: T; onSubmit: (data: T) => void }
     └─ Location: src/types/form.types.ts:12
```

**For unified search (all):**
```
🔍 Search: "User"

Files (3):
  • src/models/user.ts
  • src/services/user.service.ts
  • src/controllers/user.controller.ts

Exports (5):
  • User (interface) - src/models/user.ts:3
  • UserService (class) - src/services/user.service.ts:15
  • UserController (class) - src/controllers/user.controller.ts:8
  • createUser (function) - src/services/user.service.ts:45
  • updateUser (function) - src/services/user.service.ts:62

Functions (4):
  • async getUser(id: string): Promise<User>
  • async createUser(data: CreateUserDto): Promise<User>
  • async updateUser(id: string, data: UpdateUserDto): Promise<User>
  • async deleteUser(id: string): Promise<void>

Classes (2):
  • UserService - src/services/user.service.ts:15
  • UserController - src/controllers/user.controller.ts:8

Types (3):
  • User (interface) - src/models/user.ts:3
  • UserDto (type) - src/dto/user.dto.ts:5
  • UserRole (enum) - src/enums/user.enums.ts:1

Total: 17 results found in 23ms
```

### Step 5: Handle No Results

If no results found:

```
🔍 Search: "{pattern}"

No results found for "{pattern}".

Suggestions:
  • Try a broader pattern (e.g., "User*" instead of "UserService")
  • Check spelling or try fuzzy search: /session:project-maps-search all "Usr" --fuzzy
  • Refresh maps if codebase changed: /session:project-maps-refresh
```

---

## Advanced Options

### Output Formatting

Control how results are formatted:

```bash
# Default: Claude-optimized formatting (best for AI consumption)
/session:project-maps-search all "User"

# With contextual annotations (shows dependency info, module info)
/session:project-maps-search all "User" --annotate

# Raw JSON output (for programmatic use)
/session:project-maps-search all "User" --json

# Specify format explicitly
/session:project-maps-search all "User" --format claude
/session:project-maps-search all "User" --format raw
```

**Claude-optimized format includes:**
- Absolute file paths for direct navigation
- Line numbers when available
- Grouping by directory
- Intelligent summarization for large result sets
- Relevance scoring for prioritized results

**With --annotate, results include:**
- Dependency context ("Called by 12 other files")
- Module/layer information ("Part of auth module")
- Actionable suggestions ("Consider checking callers before refactoring")

### Signature Criteria Search

For advanced function searching, use flags:

```bash
# Find all async functions
/session:project-maps-search signature --async

# Find functions with exactly 2 parameters
/session:project-maps-search signature --params=2

# Find functions returning Promise
/session:project-maps-search signature --returns=Promise

# Find private methods
/session:project-maps-search signature --visibility=private

# Combined criteria
/session:project-maps-search signature --async --params=1 --returns=Promise
```

### Fuzzy Search

Enable fuzzy matching for typo tolerance:

```bash
/session:project-maps-search all "Usre" --fuzzy
# Will find "User" despite typo
```

---

## Error Handling

- No maps loaded: Suggest running /session:project-maps-generate
- Invalid search type: Show valid types with examples
- Pattern syntax error: Show pattern syntax help
- Search timeout: Suggest narrowing the search pattern


ARGUMENTS: {type} {pattern}
