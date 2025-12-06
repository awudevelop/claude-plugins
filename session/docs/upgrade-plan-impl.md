# Implementation Plan System Upgrade

**Version**: 2.0
**Status**: Draft
**Created**: 2025-12-05
**Target**: Transform vague task lists into concrete, executable implementation plans

---

## Executive Summary

### The Problem

Current `/session:plan-finalize` produces vague task descriptions like:
```
task-2-1: Create auth.signIn method with email/password
```

This is NOT executable. An agent needs to know:
- WHERE: Exact file path
- WHAT: Function signature, parameters, return type
- HOW: Implementation approach, patterns to follow
- INTEGRATE: What to import, what to call

### The Solution

1. **Lean Specs**: Structured task specifications (not full code)
2. **Confidence Levels**: Detect risky tasks, alert user
3. **Doc Support**: Allow external documentation at finalize AND execute
4. **Project-Maps Integration**: Use codebase knowledge for informed decisions
5. **Smart Execute**: Generate code from specs with real-time codebase access

### Expected Outcome

- Tasks become executable by parallel agents
- Risky tasks are flagged before execution
- External docs can guide unfamiliar tech
- 100 tasks could execute in parallel → 10 minute implementation
- All generated code is self-documenting with JSDoc tags for project-maps

---

## Phase 1: Task Schema & Confidence System

### 1.1 New Task Schema

**File**: `session/schemas/task-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ConcreteTask",
  "type": "object",
  "required": ["id", "type", "file", "confidence", "spec"],
  "properties": {
    "id": { "type": "string", "pattern": "^task-\\d+-\\d+$" },
    "type": {
      "type": "string",
      "enum": [
        "create_directory",
        "create_file",
        "create_class",
        "create_function",
        "create_interface",
        "create_hook",
        "create_component",
        "create_context",
        "create_table",
        "create_migration",
        "create_rpc",
        "create_trigger",
        "create_cli",
        "create_cli_command",
        "create_config",
        "create_package_json",
        "create_barrel",
        "create_readme",
        "create_test",
        "run_command",
        "add_dependency",
        "modify_file",
        "custom"
      ]
    },
    "file": { "type": "string", "description": "Target file path" },
    "create": { "type": "boolean", "default": true },
    "description": { "type": "string", "maxLength": 100 },
    "from_requirement": { "type": "string" },
    "depends_on": { "type": "array", "items": { "type": "string" } },

    "confidence": {
      "type": "object",
      "required": ["level", "score"],
      "properties": {
        "level": { "enum": ["high", "medium", "low"] },
        "score": { "type": "number", "minimum": 0, "maximum": 100 },
        "factors": {
          "type": "object",
          "properties": {
            "has_example": { "type": "boolean" },
            "known_pattern": { "type": "boolean" },
            "domain_expertise": { "type": "boolean" },
            "docs_available": { "type": "boolean" },
            "project_convention": { "type": "boolean" }
          }
        },
        "risks": { "type": "array", "items": { "type": "string" } },
        "mitigations": { "type": "array", "items": { "type": "string" } }
      }
    },

    "spec": {
      "type": "object",
      "description": "Type-specific specification (see type-specific schemas)"
    },

    "docs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "local": { "type": "string" },
          "section": { "type": "string" },
          "purpose": { "type": "string" }
        }
      }
    },

    "review": {
      "type": "object",
      "properties": {
        "required": { "type": "boolean" },
        "reason": { "type": "string" },
        "focus_areas": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### 1.2 Confidence Detection Logic

**File**: `session/cli/lib/confidence-detector.js`

```javascript
/**
 * Detects confidence level for a task based on multiple factors
 */
class ConfidenceDetector {
  constructor(projectMaps, docs) {
    this.maps = projectMaps;
    this.docs = docs;
  }

  /**
   * Analyze task and return confidence assessment
   */
  async analyze(task) {
    const factors = {
      has_example: await this.hasExample(task),
      known_pattern: this.isKnownPattern(task),
      domain_expertise: !this.requiresDomainExpertise(task),
      docs_available: this.hasDocumentation(task),
      project_convention: await this.matchesProjectConvention(task)
    };

    const score = this.calculateScore(factors);
    const level = this.scoreToLevel(score);
    const risks = this.identifyRisks(task, factors);
    const mitigations = this.suggestMitigations(risks);

    return {
      level,
      score,
      factors,
      risks,
      mitigations
    };
  }

  /**
   * Check if similar code exists in project
   */
  async hasExample(task) {
    if (!this.maps) return false;

    const searches = {
      'create_class': () => this.maps.searchByClass(task.spec?.class),
      'create_function': () => this.maps.searchBySignature(task.spec?.function),
      'create_hook': () => this.maps.searchBySignature(task.spec?.hook),
      'create_component': () => this.maps.searchByExport(task.spec?.component),
      'create_table': () => this.searchDatabaseSchema(task.spec?.table)
    };

    const search = searches[task.type];
    if (!search) return false;

    const results = await search();
    return results && results.length > 0;
  }

  /**
   * Check if task type follows known patterns
   */
  isKnownPattern(task) {
    const knownPatterns = [
      'create_class', 'create_function', 'create_interface',
      'create_hook', 'create_component', 'create_context',
      'create_table', 'create_migration', 'create_rpc',
      'create_config', 'create_package_json', 'create_barrel',
      'create_test', 'add_dependency'
    ];
    return knownPatterns.includes(task.type);
  }

  /**
   * Check if task requires domain expertise
   */
  requiresDomainExpertise(task) {
    const domainKeywords = [
      // Crypto/Security
      'encrypt', 'decrypt', 'hash', 'cipher', 'crypto', 'jwt', 'oauth',
      // Low-level
      'cuda', 'gpu', 'simd', 'assembly', 'kernel', 'driver',
      // Domain-specific
      'quantum', 'blockchain', 'ml', 'neural', 'trading', 'medical',
      // Infrastructure
      'kubernetes', 'terraform', 'ansible', 'nginx', 'haproxy'
    ];

    const taskText = JSON.stringify(task).toLowerCase();
    return domainKeywords.some(kw => taskText.includes(kw));
  }

  /**
   * Check if documentation is available
   */
  hasDocumentation(task) {
    return task.docs && task.docs.length > 0;
  }

  /**
   * Check if task matches project conventions
   */
  async matchesProjectConvention(task) {
    if (!this.maps) return false;

    // Check if similar file structure exists
    const dir = task.file.substring(0, task.file.lastIndexOf('/'));
    const tree = await this.maps.load('tree');

    if (!tree) return false;

    // Check if directory pattern exists
    return tree.directories?.includes(dir) ||
           tree.files?.some(f => f.startsWith(dir));
  }

  /**
   * Calculate confidence score (0-100)
   */
  calculateScore(factors) {
    const weights = {
      has_example: 30,          // Most important - can copy pattern
      known_pattern: 25,        // Standard task type
      domain_expertise: 20,     // No special expertise needed
      docs_available: 15,       // Can reference documentation
      project_convention: 10    // Follows project structure
    };

    let score = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      if (factors[factor]) score += weight;
    }

    return score;
  }

  /**
   * Convert score to level
   */
  scoreToLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Identify risks for the task
   */
  identifyRisks(task, factors) {
    const risks = [];

    if (!factors.has_example) {
      risks.push('No similar code in project to reference');
    }
    if (!factors.known_pattern) {
      risks.push('Non-standard task type - may require custom handling');
    }
    if (!factors.domain_expertise) {
      risks.push('May require domain expertise not available');
    }
    if (!factors.project_convention) {
      risks.push('File location may not match project conventions');
    }
    if (task.type === 'custom') {
      risks.push('Custom task type - implementation details unclear');
    }

    return risks;
  }

  /**
   * Suggest mitigations for identified risks
   */
  suggestMitigations(risks) {
    const mitigationMap = {
      'No similar code': 'Provide example file with --docs or --reference',
      'Non-standard task': 'Use detailed spec with explicit implementation steps',
      'domain expertise': 'Add documentation URL with --docs',
      'project conventions': 'Verify file location with maintainer',
      'Custom task': 'Provide skeleton code or detailed steps in spec'
    };

    return risks.map(risk => {
      const key = Object.keys(mitigationMap).find(k => risk.toLowerCase().includes(k.toLowerCase()));
      return key ? mitigationMap[key] : 'Review task manually before execution';
    });
  }
}

module.exports = { ConfidenceDetector };
```

### 1.3 Tasks

| Task | File | Description |
|------|------|-------------|
| 1.1.1 | `schemas/task-schema.json` | Create comprehensive task schema |
| 1.1.2 | `cli/lib/confidence-detector.js` | Implement confidence detection |
| 1.1.3 | `cli/lib/confidence-detector.test.js` | Unit tests for confidence detection |
| 1.1.4 | Update `requirement-transformer.js` | Integrate confidence into task generation |

---

## Phase 2: Type-Specific Task Specs

### 2.1 Lean Spec Definitions

Each task type has a specific spec structure. These are LEAN - enough info to generate code, not the code itself.

**File**: `session/schemas/task-specs/`

#### 2.1.1 create_class.json
```json
{
  "class": "string (required) - Class name",
  "exported": "boolean - Whether to export",
  "extends": "string? - Parent class",
  "implements": "string[]? - Interfaces",
  "purpose": "string (required) - What the class does",
  "constructor": {
    "params": "string[] - e.g., ['name: string', 'age: number']",
    "does": "string - What constructor does"
  },
  "properties": [{
    "name": "string",
    "type": "string",
    "visibility": "public|private|protected",
    "readonly": "boolean?",
    "default": "string? - Default value"
  }],
  "methods": [{
    "name": "string",
    "visibility": "public|private|protected",
    "async": "boolean?",
    "static": "boolean?",
    "params": "string[]",
    "returns": "string",
    "does": "string (required) - What method does"
  }],
  "imports": "string[] - e.g., ['AuthContext from ../types']",
  "patterns": "string[]? - Patterns to follow, with file references"
}
```

#### 2.1.2 create_function.json
```json
{
  "function": "string (required) - Function name",
  "exported": "boolean",
  "async": "boolean",
  "params": "string[] - e.g., ['userId: string', 'options?: Options']",
  "returns": "string - Return type",
  "generics": "string[]? - e.g., ['T extends Base']",
  "does": "string (required) - What function does",
  "steps": "string[]? - Implementation steps",
  "throws": "string[]? - Errors it can throw",
  "imports": "string[]",
  "calls": "string[]? - Functions/methods it should call",
  "patterns": "string[]?"
}
```

#### 2.1.3 create_hook.json
```json
{
  "hook": "string (required) - Hook name (must start with 'use')",
  "params": "string[]",
  "returns": "string - Return type",
  "uses": "string[] - React hooks used internally",
  "consumes": "string[]? - Contexts consumed",
  "behavior": "string[] (required) - Step-by-step behavior",
  "cleanup": "string? - Cleanup logic description",
  "imports": "string[]"
}
```

#### 2.1.4 create_component.json
```json
{
  "component": "string (required) - Component name",
  "type": "functional|forwardRef|memo",
  "props": [{
    "name": "string",
    "type": "string",
    "required": "boolean",
    "default": "string?",
    "description": "string?"
  }],
  "hooks": "string[] - Hooks used",
  "context": "string[]? - Contexts consumed",
  "renders": "string (required) - What it renders (description)",
  "conditionals": "string[]? - Conditional rendering logic",
  "handlers": "string[]? - Event handlers",
  "imports": "string[]"
}
```

#### 2.1.5 create_table.json
```json
{
  "table": "string (required) - Table name",
  "schema": "string - Schema name (default: public)",
  "columns": [{
    "name": "string",
    "type": "string - SQL type",
    "nullable": "boolean",
    "pk": "boolean?",
    "unique": "boolean?",
    "default": "string?",
    "fk": "string? - e.g., 'users.id'",
    "onDelete": "CASCADE|SET NULL|RESTRICT?",
    "check": "string? - CHECK constraint"
  }],
  "indexes": [{
    "name": "string",
    "columns": "string[]",
    "unique": "boolean?",
    "where": "string? - Partial index"
  }],
  "rls": {
    "enabled": "boolean",
    "policies": [{
      "name": "string",
      "operation": "SELECT|INSERT|UPDATE|DELETE|ALL",
      "using": "string?",
      "with_check": "string?"
    }]
  }
}
```

#### 2.1.6 create_cli_command.json
```json
{
  "command": "string (required) - Command name",
  "description": "string",
  "aliases": "string[]?",
  "arguments": [{
    "name": "string",
    "description": "string",
    "required": "boolean"
  }],
  "options": [{
    "flags": "string - e.g., '-f, --force'",
    "description": "string",
    "required": "boolean?",
    "default": "string?",
    "choices": "string[]?"
  }],
  "does": "string[] (required) - Step-by-step what command does",
  "errors": "string[]? - Error cases to handle",
  "imports": "string[]"
}
```

#### 2.1.7 custom.json (Fallback for alien tasks)
```json
{
  "purpose": "string (required) - What this file/code does",
  "language": "string - Programming language or file type",
  "structure": "string? - High-level structure description",
  "sections": [{
    "name": "string",
    "does": "string",
    "code_hint": "string? - Pseudo-code or pattern hint"
  }],
  "dependencies": "string[]? - External dependencies",
  "environment": "string[]? - Required environment variables",
  "reference_files": "string[]? - Files to look at for patterns",
  "reference_docs": "string[]? - Documentation URLs"
}
```

### 2.2 Tasks

| Task | File | Description |
|------|------|-------------|
| 2.1.1 | `schemas/task-specs/*.json` | Create all spec schemas |
| 2.1.2 | `cli/lib/spec-validator.js` | Validate specs against schemas |
| 2.1.3 | `cli/lib/spec-generator.js` | Generate specs from requirements |

---

## Phase 3: Plan-Finalize Upgrade

### 3.1 New Command Options

```
/session:plan-finalize <plan_name> [options]

Options:
  --docs <url|path>       Add documentation reference (can use multiple)
  --reference <path>      Add codebase reference file
  --confidence-threshold  Minimum confidence level (default: 40)
  --alert-threshold       Alert if N+ tasks below confidence (default: 3)
  --skip-low-confidence   Skip tasks below threshold (mark for manual)
  --detailed              Force detailed specs for all tasks
```

### 3.2 Updated Workflow

**File**: `session/commands/plan-finalize.md` (updated)

```markdown
## Updated Finalize Workflow

### Step 1: Load Requirements
- Load requirements.json
- Parse --docs and --reference options

### Step 2: Load Project Context
- Load project-maps (if available):
  - function-signatures.json
  - types-map.json
  - tree.json
  - modules.json
  - backend-layers.json
  - database-schema.json

### Step 3: Fetch External Documentation (NEW)
For each --docs provided:
- If URL: Fetch and cache
- If local path: Read file
- Parse and extract relevant sections
- Store in context for spec generation

### Step 4: Generate Task Specs
For each requirement:
1. Determine task type
2. Query project-maps for:
   - File location (where should this go?)
   - Similar code (examples to follow)
   - Import patterns (what do similar files import?)
3. Generate lean spec
4. Calculate confidence level
5. Attach relevant docs

### Step 5: Confidence Analysis (NEW)
1. Run confidence detector on all tasks
2. Calculate aggregate statistics:
   - Total tasks
   - High confidence (70+)
   - Medium confidence (40-69)
   - Low confidence (<40)
3. Identify critical risks

### Step 6: User Alert (NEW - if threshold exceeded)
If low_confidence_count >= alert_threshold:
```
⚠️  CONFIDENCE ALERT

{N} tasks have low confidence scores:

  task-2-3: Create quantum optimizer (score: 25)
    Risks: Domain expertise required, no similar code
    Mitigation: Add documentation with --docs

  task-4-1: Configure legacy mainframe sync (score: 15)
    Risks: Undocumented system, custom protocol
    Mitigation: Provide reference implementation

  task-7-2: Setup CUDA kernels (score: 30)
    Risks: GPU expertise required
    Mitigation: Add CUDA documentation

Options:
  [C] Continue anyway (tasks flagged for review)
  [S] Skip low-confidence tasks (mark manual)
  [D] Add documentation and retry
  [A] Abort finalization
```

### Step 7: Generate Phase Files
- Create orchestration.json
- Create phases/*.json with lean specs
- Include confidence data per task
- Include doc references per task

### Step 8: Summary Output
```
✓ Plan Finalized: {plan_name}

Confidence Summary:
  🟢 High (70+):    28 tasks (75%)
  🟡 Medium (40-69): 7 tasks (19%)
  🔴 Low (<40):      2 tasks (5%) ⚠️

Low Confidence Tasks:
  - task-5-2: Create CUDA kernel (score: 25) → flagged for review
  - task-7-1: Legacy sync (score: 18) → flagged for review

Files Created:
  - orchestration.json
  - phases/phase-1-setup.json
  - phases/phase-2-types.json
  ...

Next: /session:plan-execute {plan_name}
```
```

### 3.3 Breakdown Prompt Update

**File**: `session/prompts/breakdown-requirement.md` (updated sections)

```markdown
## Additional Instructions for Lean Specs

### DO NOT generate full implementation code.
### DO generate structured specs with:
- Clear file locations (informed by project-maps)
- Method/function signatures
- Behavior descriptions (what it DOES, not HOW)
- Pattern references (similar code to follow)

### For each task, assess confidence:

CONFIDENCE FACTORS:
1. Has example in codebase? (check project-maps)
2. Known pattern type? (standard task types)
3. Domain expertise needed? (crypto, GPU, etc.)
4. Documentation available? (check provided docs)
5. Matches project conventions? (file structure)

SCORE CALCULATION:
- has_example: +30
- known_pattern: +25
- no_domain_expertise: +20
- docs_available: +15
- matches_convention: +10

LEVELS:
- 70-100: high
- 40-69: medium
- 0-39: low

### IMPORTANT: Markdown/Prose Files Are HIGH Confidence

Markdown files (.md) including prompts and command templates are NOT low confidence:
- Markdown is a native format for Claude
- Section-based editing is a known pattern
- No domain expertise required
- Follows standard markdown conventions

Confidence for markdown: 30 + 25 + 20 + 10 = 85 (HIGH)

The only difference: No automated verification (typecheck). Use `review.recommended: true` instead.

### For LOW confidence tasks:
- Add detailed "risks" array
- Add "mitigations" suggestions
- Set "review.required": true
- Include any available docs in "docs" array
```

### 3.4 Tasks

| Task | File | Description |
|------|------|-------------|
| 3.1.1 | `commands/plan-finalize.md` | Update command with new options |
| 3.1.2 | `prompts/breakdown-requirement.md` | Add lean spec + confidence instructions |
| 3.1.3 | `cli/lib/commands/plan-ops.js` | Add doc fetching, confidence analysis |
| 3.1.4 | `cli/lib/doc-fetcher.js` | Fetch and parse external docs |
| 3.1.5 | `cli/lib/confidence-aggregator.js` | Aggregate confidence stats |
| 3.1.6 | `cli/lib/alert-formatter.js` | Format confidence alerts |

---

## Phase 4: Plan-Execute Upgrade

### 4.1 New Command Options

```
/session:plan-execute <plan_name> [options]

Options:
  --docs <url|path>       Add documentation for execution
  --parallel <n>          Max parallel tasks (default: 1)
  --skip-low-confidence   Skip low-confidence tasks
  --review-mode           Pause after each task for review
  --dry-run               Show what would be done, don't execute
  --auto                  No confirmations (for CI/automation)
```

### 4.2 Execute Workflow

**File**: `session/commands/plan-execute.md` (updated)

```markdown
## Updated Execute Workflow

### Step 1: Load Plan
- Load orchestration.json
- Load execution-state.json
- Load all phase files

### Step 2: Load Execution Context
- Load project-maps (for code generation)
- Fetch any --docs provided
- Merge with task-level docs

### Step 3: Task Execution Loop

For each pending task:

#### 3a. Pre-execution Check
```
if task.confidence.level === 'low':
  if --skip-low-confidence:
    mark task as 'skipped'
    continue
  else:
    show warning, ask for confirmation
```

#### 3b. Load Task Context
- Read task spec
- Read referenced files (patterns, imports)
- Load relevant docs
- Query project-maps for current state

#### 3c. Generate Implementation
Spawn code generation agent with:
- Task spec (lean)
- Referenced files content
- Documentation excerpts
- Current codebase patterns

Agent generates:
- Full implementation code
- Any additional files needed (types, tests)
- Import statements

#### 3d. Write Files
- Create directories if needed
- Write main file
- Write auxiliary files (types, tests)

#### 3e. Verify
- Run type check (tsc --noEmit)
- Run linter (if configured)
- Run tests (if created)

#### 3f. Report Result
```json
{
  "task_id": "task-2-1",
  "status": "completed|failed|skipped",
  "files_created": ["src/auth/methods.ts"],
  "files_modified": [],
  "verification": {
    "typecheck": "passed",
    "lint": "passed",
    "tests": "3 passed"
  },
  "warnings": [],
  "duration_ms": 1234
}
```

### Step 4: Handle Low-Confidence Tasks

For tasks with review.required = true:
```
⚠️  LOW CONFIDENCE TASK COMPLETED

Task: task-5-2 - Create CUDA kernel
File: src/gpu/optimizer.cu
Confidence: 25 (low)

Risks identified:
  - Domain expertise required
  - No similar code in project

Generated code may need review:
  - Lines 23-45: Kernel launch parameters
  - Lines 67-89: Memory management

[A] Accept and continue
[R] Review file now (opens in editor)
[E] Edit and re-verify
[S] Skip and mark manual
```

### Step 5: Parallel Execution (if --parallel > 1)

```
Identify independent tasks (no shared dependencies)
Group into parallel batches
Execute batch with N workers
Aggregate results
Continue to next batch
```

### Step 6: Completion Summary
```
✓ Plan Execution Complete: {plan_name}

Results:
  ✓ Completed: 35 tasks
  ⚠️ Review needed: 2 tasks
  ⏭️ Skipped: 0 tasks
  ❌ Failed: 0 tasks

Files Created: 42
Files Modified: 3
Tests Generated: 28
Tests Passing: 28

Low-Confidence Tasks (review recommended):
  - src/gpu/optimizer.cu (task-5-2)
  - src/legacy/sync.ts (task-7-1)

Next Steps:
  1. Review flagged files
  2. Run full test suite: npm test
  3. Commit changes: git add . && git commit
```
```

### 4.3 Code Generation Agent Prompt

**File**: `session/prompts/generate-code.md`

```markdown
# Code Generation Agent

You are generating implementation code from a lean task specification.

## Input

You receive:
1. **Task Spec**: Structured specification (what to build)
2. **Reference Files**: Similar code to follow (patterns)
3. **Documentation**: External docs if provided
4. **Project Context**: Import patterns, type definitions

## Your Job

Generate COMPLETE, WORKING code that:
1. Implements the spec exactly
2. Follows patterns from reference files
3. Uses correct imports
4. Handles errors appropriately
5. Includes JSDoc/TSDoc comments

## Rules

1. **Match Project Style**
   - If reference uses arrow functions, use arrow functions
   - If reference uses semicolons, use semicolons
   - Match indentation (tabs vs spaces)

2. **Handle Types**
   - Import types from correct locations
   - Create missing types if needed (in separate file)
   - Use strict typing (no `any` unless necessary)

3. **Error Handling**
   - Follow error patterns from reference files
   - Use project's error classes if they exist
   - Include try/catch where appropriate

4. **Testing**
   - If spec includes test cases, generate test file
   - Follow project's test framework (jest, vitest, etc.)
   - Include edge cases

5. **MANDATORY: JSDoc Documentation for Project-Maps**

   ALL functions, classes, and methods MUST have JSDoc comments that project-maps can extract.

   **Required Tags:**
   ```typescript
   /**
    * Brief description of what this does (first line is summary)
    *
    * Longer description if needed, explaining behavior,
    * edge cases, or important notes.
    *
    * @param {string} userId - Description of the parameter
    * @param {Options} [options] - Optional parameter (note brackets)
    * @param {Object} config - Object parameter
    * @param {string} config.name - Nested object property
    * @returns {Promise<User>} Description of return value
    * @throws {NotFoundError} When user doesn't exist
    * @throws {AuthError} When not authenticated
    *
    * @example
    * // Basic usage
    * const user = await getUser('123');
    *
    * @example
    * // With options
    * const user = await getUser('123', { includeProfile: true });
    *
    * @see {@link updateUser} Related function
    * @since 1.0.0
    * @category Authentication
    */
   ```

   **Tag Reference:**
   | Tag | When to Use | Project-Maps Uses For |
   |-----|-------------|----------------------|
   | `@param` | ALWAYS for each parameter | Signature extraction |
   | `@returns` | ALWAYS if returns value | Signature extraction |
   | `@throws` | When function can throw | Error documentation |
   | `@example` | ALWAYS, at least one | Usage patterns |
   | `@see` | For related functions | Relationship mapping |
   | `@category` | For grouping | Module organization |
   | `@since` | For versioning | Change tracking |
   | `@deprecated` | When replacing old code | Migration guidance |
   | `@internal` | For private APIs | Visibility control |
   | `@async` | For async functions | Signature extraction |

   **For Classes:**
   ```typescript
   /**
    * Manages authentication context with persistence.
    *
    * Stores tenant and product context in localStorage for
    * cross-session persistence. Notifies subscribers on changes.
    *
    * @class
    * @category Context
    * @example
    * const store = new ContextStore(true);
    * store.setTenant('tenant-123');
    * const ctx = store.getContext();
    */
   class ContextStore {
     /**
      * Current authentication context
      * @type {AuthContext}
      * @private
      */
     private context: AuthContext;

     /**
      * Create a new context store
      * @param {boolean} [persist=true] - Whether to persist to localStorage
      */
     constructor(persist: boolean = true) { }

     /**
      * Get current context (immutable copy)
      * @returns {AuthContext} Copy of current context
      * @example
      * const { tenantId, productId } = store.getContext();
      */
     getContext(): AuthContext { }
   }
   ```

   **For React Hooks:**
   ```typescript
   /**
    * Hook for checking user permissions.
    *
    * Checks if current user has the specified permission,
    * using context from AuthHubProvider.
    *
    * @param {string} permission - Permission to check (e.g., 'products:edit')
    * @param {AuthContext} [context] - Optional context override
    * @returns {{ allowed: boolean, loading: boolean, error: Error | null }}
    *
    * @example
    * function EditButton() {
    *   const { allowed, loading } = useCan('products:edit');
    *   if (loading) return <Spinner />;
    *   if (!allowed) return null;
    *   return <Button>Edit</Button>;
    * }
    *
    * @see {@link usePermissions} For checking multiple permissions
    * @see {@link PermissionGate} For declarative permission checks
    * @category Hooks
    */
   function useCan(permission: string, context?: AuthContext) { }
   ```

   **For React Components:**
   ```typescript
   /**
    * Conditionally renders children based on permission.
    *
    * Uses useCan hook internally. Shows fallback when
    * permission denied, loading component while checking.
    *
    * @component
    * @param {Object} props
    * @param {string} props.permission - Permission to check
    * @param {React.ReactNode} props.children - Content when allowed
    * @param {React.ReactNode} [props.fallback] - Content when denied
    * @param {React.ReactNode} [props.loading] - Content while checking
    *
    * @example
    * <PermissionGate permission="admin:users" fallback={<AccessDenied />}>
    *   <UserManagement />
    * </PermissionGate>
    *
    * @category Components
    */
   function PermissionGate({ permission, children, fallback, loading }: Props) { }
   ```

   **WHY THIS MATTERS:**
   - Project-maps `function-signatures.json` extracts JSDoc
   - Future plan-finalize uses this for pattern matching
   - Self-documenting code improves AI understanding
   - @category enables better module organization
   - @example provides real usage patterns for code generation

## Output Format

Return JSON:
```json
{
  "main_file": {
    "path": "src/auth/methods.ts",
    "content": "// Full file content here"
  },
  "auxiliary_files": [
    {
      "path": "src/types/auth.ts",
      "content": "// Type definitions"
    },
    {
      "path": "src/auth/__tests__/methods.test.ts",
      "content": "// Test file"
    }
  ],
  "notes": [
    "Created AuthError class in types/errors.ts",
    "Used existing supabase client from lib/supabase.ts"
  ],
  "uncertainties": [
    {
      "location": "line 45",
      "issue": "Assumed error format, verify with API docs",
      "confidence": "medium"
    }
  ]
}
```

## Example

**Task Spec:**
```json
{
  "type": "create_function",
  "file": "src/auth/methods.ts",
  "function": "signIn",
  "async": true,
  "params": ["email: string", "password: string"],
  "returns": "Promise<AuthResponse>",
  "does": "Sign in user with email/password via Supabase",
  "throws": ["AuthError on invalid credentials"],
  "imports": ["supabase from ../lib/supabase", "AuthResponse from ../types"]
}
```

**Reference File (src/api/users.ts):**
```typescript
export async function getUser(userId: string): Promise<User> {
  const { data, error } = await supabase.from('users').select().eq('id', userId).single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}
```

**Generated Code:**
```typescript
import { supabase } from '../lib/supabase';
import type { AuthResponse } from '../types';
import { AuthError } from '../types/errors';

/**
 * Sign in user with email and password
 * @throws {AuthError} When credentials are invalid
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new AuthError(error.message, error.code);
  }

  return {
    user: data.user,
    session: data.session,
  };
}
```
```

### 4.4 Documentation Verification

After code generation, verify documentation quality:

```javascript
/**
 * Verify generated code has proper JSDoc documentation
 */
async function verifyDocumentation(filePath, content) {
  const issues = [];

  // Extract all functions/classes/methods
  const entities = extractEntities(content);

  for (const entity of entities) {
    // Check for JSDoc presence
    if (!entity.jsdoc) {
      issues.push({
        type: 'missing_jsdoc',
        entity: entity.name,
        line: entity.line,
        severity: 'error'
      });
      continue;
    }

    // Check required tags
    if (entity.type === 'function' || entity.type === 'method') {
      // Must have @param for each parameter
      for (const param of entity.params) {
        if (!entity.jsdoc.params?.find(p => p.name === param.name)) {
          issues.push({
            type: 'missing_param',
            entity: entity.name,
            param: param.name,
            severity: 'error'
          });
        }
      }

      // Must have @returns if not void
      if (entity.returnType !== 'void' && !entity.jsdoc.returns) {
        issues.push({
          type: 'missing_returns',
          entity: entity.name,
          severity: 'error'
        });
      }

      // Should have @example
      if (!entity.jsdoc.examples?.length) {
        issues.push({
          type: 'missing_example',
          entity: entity.name,
          severity: 'warning'
        });
      }
    }

    // Check @category for module organization
    if (!entity.jsdoc.category) {
      issues.push({
        type: 'missing_category',
        entity: entity.name,
        severity: 'warning'
      });
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}
```

### 4.5 Tasks

| Task | File | Description |
|------|------|-------------|
| 4.1.1 | `commands/plan-execute.md` | Update command with new workflow |
| 4.1.2 | `prompts/generate-code.md` | Create code generation prompt with JSDoc requirements |
| 4.1.3 | `cli/lib/commands/plan-ops.js` | Update execute with new workflow |
| 4.1.4 | `cli/lib/code-generator.js` | Orchestrate code generation |
| 4.1.5 | `cli/lib/file-writer.js` | Write generated files safely |
| 4.1.6 | `cli/lib/verifier.js` | Run typecheck, lint, tests |
| 4.1.7 | `cli/lib/parallel-executor.js` | Handle parallel execution |
| 4.1.8 | `cli/lib/doc-verifier.js` | Verify JSDoc documentation quality |
| 4.1.9 | Update `extractors/signature-extractor.js` | Extract @category, @see, @example tags |

---

## Phase 5: Documentation Support

### 5.1 Doc Fetcher

**File**: `session/cli/lib/doc-fetcher.js`

```javascript
/**
 * Fetches and caches documentation from URLs or local files
 */
class DocFetcher {
  constructor(cacheDir = '.claude/doc-cache') {
    this.cacheDir = cacheDir;
    this.cache = new Map();
  }

  /**
   * Fetch documentation from URL or local path
   */
  async fetch(source, options = {}) {
    // Check cache first
    const cached = this.getFromCache(source);
    if (cached && !options.force) return cached;

    let content;
    if (source.startsWith('http')) {
      content = await this.fetchUrl(source);
    } else {
      content = await this.readLocal(source);
    }

    // Parse and extract relevant sections
    const parsed = this.parse(content, source, options.section);

    // Cache for future use
    this.addToCache(source, parsed);

    return parsed;
  }

  /**
   * Parse documentation content
   */
  parse(content, source, section) {
    const ext = this.getExtension(source);

    if (ext === 'md' || ext === 'mdx') {
      return this.parseMarkdown(content, section);
    } else if (ext === 'json') {
      return this.parseJson(content, section);
    } else if (ext === 'yaml' || ext === 'yml') {
      return this.parseYaml(content, section);
    } else if (source.includes('github.com')) {
      return this.parseGithub(content, section);
    }

    return { raw: content, sections: [] };
  }

  /**
   * Extract specific section from markdown
   */
  parseMarkdown(content, targetSection) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n').trim()
          });
        }
        currentSection = headerMatch[2];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Add last section
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: currentContent.join('\n').trim()
      });
    }

    // Filter to target section if specified
    if (targetSection) {
      const filtered = sections.filter(s =>
        s.title.toLowerCase().includes(targetSection.toLowerCase())
      );
      return { sections: filtered, raw: content };
    }

    return { sections, raw: content };
  }

  /**
   * Get relevant documentation for a task
   */
  getRelevantDocs(task, allDocs) {
    const relevant = [];

    for (const doc of allDocs) {
      // Match by keywords in task
      const taskText = JSON.stringify(task).toLowerCase();
      const docText = JSON.stringify(doc).toLowerCase();

      // Simple relevance check
      const taskKeywords = this.extractKeywords(taskText);
      const matchCount = taskKeywords.filter(kw => docText.includes(kw)).length;

      if (matchCount > 2) {
        relevant.push({
          ...doc,
          relevance: matchCount
        });
      }
    }

    return relevant.sort((a, b) => b.relevance - a.relevance);
  }
}

module.exports = { DocFetcher };
```

### 5.2 Tasks

| Task | File | Description |
|------|------|-------------|
| 5.1.1 | `cli/lib/doc-fetcher.js` | Implement doc fetching and parsing |
| 5.1.2 | `cli/lib/doc-cache.js` | Implement doc caching |
| 5.1.3 | Update `plan-finalize.md` | Add --docs option handling |
| 5.1.4 | Update `plan-execute.md` | Add --docs option handling |

---

## Phase 6: Project-Maps Integration

### 6.1 Integration Points

| Stage | Maps Used | Purpose |
|-------|-----------|---------|
| Finalize | `tree.json` | Determine file locations |
| Finalize | `function-signatures.json` | Find similar functions |
| Finalize | `types-map.json` | Find existing types |
| Finalize | `modules.json` | Determine module placement |
| Finalize | `backend-layers.json` | Determine architecture layer |
| Execute | `function-signatures.json` | Get patterns for generation |
| Execute | `dependencies-forward.json` | Determine imports |
| Execute | `types-map.json` | Reference existing types |

### 6.2 Map Loader for Plan System

**File**: `session/cli/lib/plan-map-loader.js`

```javascript
/**
 * Loads project maps for plan finalization and execution
 */
class PlanMapLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.mapLoader = new MapLoader(projectRoot);
  }

  /**
   * Load maps needed for finalization
   */
  async loadForFinalize() {
    return {
      tree: await this.mapLoader.load('tree'),
      signatures: await this.mapLoader.load('function-signatures'),
      types: await this.mapLoader.load('types-map'),
      modules: await this.mapLoader.load('modules'),
      layers: await this.mapLoader.load('backend-layers'),
      database: await this.mapLoader.load('database-schema')
    };
  }

  /**
   * Load maps needed for execution
   */
  async loadForExecute() {
    return {
      signatures: await this.mapLoader.load('function-signatures'),
      types: await this.mapLoader.load('types-map'),
      dependencies: await this.mapLoader.load('dependencies-forward'),
      tree: await this.mapLoader.load('tree')
    };
  }

  /**
   * Find best file location for a new file
   */
  async suggestLocation(taskType, name, context) {
    const tree = await this.mapLoader.load('tree');
    const modules = await this.mapLoader.load('modules');

    // Logic to suggest file location based on:
    // - Task type (component → src/components/, hook → src/hooks/)
    // - Module context (auth-related → src/auth/)
    // - Existing patterns in tree

    // ... implementation
  }

  /**
   * Find similar code for pattern reference
   */
  async findSimilar(taskType, name) {
    const signatures = await this.mapLoader.load('function-signatures');

    // Search for similar functions/classes
    // Return file paths and line numbers

    // ... implementation
  }
}

module.exports = { PlanMapLoader };
```

### 6.3 Tasks

| Task | File | Description |
|------|------|-------------|
| 6.1.1 | `cli/lib/plan-map-loader.js` | Create map loader for plan system |
| 6.1.2 | Update `plan-ops.js` | Integrate map loading |
| 6.1.3 | Update `breakdown-requirement.md` | Add map query instructions |
| 6.1.4 | Update `generate-code.md` | Add map usage for patterns |

---

## Phase 7: Testing & Validation

### 7.1 Test Cases

| Test | Description |
|------|-------------|
| Confidence detection | Verify scores for known vs unknown tasks |
| Lean spec generation | Verify specs are complete but not bloated |
| Doc fetching | Test URL and local file fetching |
| Code generation | Test output matches spec |
| Parallel execution | Test independent task batching |
| Low confidence handling | Test alerts and skip behavior |

### 7.2 Integration Tests

**File**: `session/tests/integration/plan-system.test.js`

```javascript
describe('Plan System v2', () => {
  describe('Finalization', () => {
    it('should generate lean specs with confidence levels');
    it('should alert when multiple low-confidence tasks');
    it('should integrate project-maps for file locations');
    it('should include provided docs in task specs');
  });

  describe('Execution', () => {
    it('should generate code from lean specs');
    it('should follow patterns from reference files');
    it('should handle low-confidence tasks with review');
    it('should execute independent tasks in parallel');
    it('should verify generated code with typecheck');
  });

  describe('Documentation', () => {
    it('should fetch and cache URL documentation');
    it('should parse markdown sections');
    it('should attach relevant docs to tasks');
  });
});
```

### 7.3 Tasks

| Task | File | Description |
|------|------|-------------|
| 7.1.1 | `tests/confidence-detector.test.js` | Unit tests for confidence |
| 7.1.2 | `tests/spec-generator.test.js` | Unit tests for spec generation |
| 7.1.3 | `tests/doc-fetcher.test.js` | Unit tests for doc fetching |
| 7.1.4 | `tests/integration/plan-system.test.js` | Integration tests |

---

## Implementation Order

### Sprint 1: Foundation (Phase 1 + 2)
- [ ] Task schema with confidence
- [ ] Confidence detector
- [ ] Type-specific spec schemas
- [ ] Spec validator

### Sprint 2: Finalize Upgrade (Phase 3)
- [ ] Update plan-finalize command
- [ ] Update breakdown prompt
- [ ] Add confidence analysis
- [ ] Add user alerts

### Sprint 3: Execute Upgrade (Phase 4)
- [ ] Update plan-execute command
- [ ] Create code generation prompt
- [ ] Implement code generator
- [ ] Add verification step

### Sprint 4: Documentation (Phase 5)
- [ ] Doc fetcher implementation
- [ ] Doc caching
- [ ] Integration with finalize/execute

### Sprint 5: Integration (Phase 6)
- [ ] Project-maps integration
- [ ] Map loader for plans
- [ ] Pattern matching

### Sprint 6: Testing (Phase 7)
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end validation

---

## Success Criteria

1. **Lean specs are sufficient**: Execute can generate correct code from specs
2. **Confidence is accurate**: Low-confidence tasks are correctly identified
3. **Markdown files are HIGH confidence**: Prose editing works reliably
4. **Alerts are helpful**: User knows what's risky before execution
5. **Docs improve results**: External documentation helps unfamiliar tech
6. **Parallel execution works**: Independent tasks run concurrently
7. **Generated code works**: Passes typecheck, lint, tests
8. **Generated code is documented**: All functions have JSDoc with required tags
9. **Project-maps can extract docs**: @param, @returns, @example, @category are extractable

---

## Migration Notes

### Backward Compatibility
- Old plans (without confidence) still work
- Missing confidence → default to "medium"
- Missing specs → fall back to description-only

### Breaking Changes
- Phase file format changes (new spec structure)
- Task IDs remain compatible
- Execution state remains compatible

---

## Appendix: Full Task Type List

| Type | Lean Spec Fields |
|------|------------------|
| `create_directory` | paths[] |
| `create_file` | content or skeleton |
| `create_class` | class, properties[], methods[], imports[] |
| `create_function` | function, params[], returns, does, imports[] |
| `create_interface` | interface, properties[], extends[] |
| `create_hook` | hook, params[], returns, uses[], behavior[] |
| `create_component` | component, props[], hooks[], renders |
| `create_context` | context, provider, hooks[] |
| `create_table` | table, columns[], indexes[], rls |
| `create_migration` | migration, operations[] |
| `create_rpc` | function, params[], returns, language |
| `create_trigger` | trigger, table, timing, events[] |
| `create_cli` | cli, commands[] |
| `create_cli_command` | command, options[], does[] |
| `create_config` | config_type, content |
| `create_package_json` | package (full structure) |
| `create_barrel` | exports[] |
| `create_readme` | sections[] |
| `create_test` | describes[], test_cases[] |
| `run_command` | command, args[], expected |
| `add_dependency` | dependencies, devDependencies |
| `modify_file` | file, modifications[] |
| `custom` | purpose, language, sections[], reference_files[] |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0-draft | 2025-12-05 | Initial comprehensive plan |
| 2.0-draft-r2 | 2025-12-05 | Added: Markdown files are HIGH confidence (not medium), mandatory JSDoc documentation for all generated code with @param/@returns/@example/@category tags, documentation verification step, signature-extractor updates |

---

## Appendix B: JSDoc Tags Reference

### Required Tags (Errors if missing)

| Tag | Usage | Example |
|-----|-------|---------|
| `@param` | Every function parameter | `@param {string} userId - The user ID` |
| `@returns` | If function returns non-void | `@returns {Promise<User>} The user object` |

### Recommended Tags (Warnings if missing)

| Tag | Usage | Example |
|-----|-------|---------|
| `@example` | At least one per function | `@example const user = await getUser('123');` |
| `@category` | For module grouping | `@category Authentication` |
| `@throws` | If function can throw | `@throws {NotFoundError} When user not found` |

### Optional Tags (Use when applicable)

| Tag | Usage | Example |
|-----|-------|---------|
| `@see` | Related functions | `@see {@link updateUser}` |
| `@since` | Version tracking | `@since 1.2.0` |
| `@deprecated` | Old code | `@deprecated Use newMethod instead` |
| `@internal` | Private APIs | `@internal` |
| `@async` | Async functions | `@async` |
| `@component` | React components | `@component` |
| `@class` | Classes | `@class` |

### Category Values (Standardized)

Use consistent category names for project-maps grouping:

| Category | Use For |
|----------|---------|
| `Authentication` | Login, logout, session management |
| `Authorization` | Permissions, roles, access control |
| `Context` | State management, context providers |
| `Hooks` | React hooks |
| `Components` | React components |
| `API` | API calls, data fetching |
| `Database` | Database operations, queries |
| `CLI` | Command-line interface |
| `Utils` | Utility functions |
| `Types` | Type definitions |
| `Config` | Configuration |
| `Testing` | Test utilities |
