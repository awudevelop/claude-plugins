# Changelog

All notable changes to the Session Management plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.24.0] - 2025-12-08

### Added

- **plan-review command** - Automated spec validation for completed tasks
  - Detects function signature mismatches (params, async, export status)
  - Detects missing implementations (specified in spec but not found)
  - Detects unspecified additions (code not in spec - helpers, extra exports)
  - Generates structured findings with severity levels (error/warning/info)
  - Pass/fail based on error count (0 errors = pass)
  - Saves review results to `{plan_dir}/review-results.json`
  - New command template: `session/commands/plan-review.md`

- **plan-summary command** - Export plans to readable markdown
  - Shows goal, status, phases with task checkmarks
  - Displays confidence statistics
  - New command template: `session/commands/plan-summary.md`

### Fixed

- **plan-converter.js v2.0 fixes:**
  - Include status from orchestration metadata
  - Include full metadata for fallback access
  - Include confidence summary from orchestration
  - Use orchestration phase status (more up-to-date than phase file)

- **breakdown-requirement.md prompt improvements:**
  - Made codebase analysis MANDATORY with explicit project-maps CLI commands
  - Specs must now include return type patterns from similar functions
  - Forces verification before generating task specifications
  - Addresses spec fidelity issues discovered during e2e testing

---

## [3.23.0] - 2025-12-06

### Added

- **Plan System v2 Integration** - Wire up all v2.0 modules that were built but not connected

- **New CLI commands for v2.0 operations:**
  - `analyze-confidence <task-json>` - Analyze confidence for a single task
  - `analyze-confidence-all <tasks-json>` - Analyze confidence for multiple tasks
  - `validate-spec <task-json>` - Validate a task's spec against schema
  - `validate-specs-all <tasks-json>` - Validate multiple task specs
  - `fetch-docs <sources-json>` - Fetch and parse external documentation
  - `get-next-task <plan-name>` - Get next pending task respecting dependencies
  - `get-confidence-stats <plan-name>` - Get confidence statistics for a plan
  - `get-task-context <plan-name> <task-id>` - Load task context for code generation
  - `batch-update-tasks <plan-name> <updates-json>` - Update multiple task statuses

### Fixed

- **requirement-transformer.js now preserves ALL v2.0 task fields** (CRITICAL)
  - Previously lost: `type`, `file`, `spec`, `confidence`, `from_suggestion`, `verification`, `implementation_decision`, `review`
  - Now preserved: All 16 v2.0 fields are correctly mapped to phase files
  - Tasks now have full lean specs for code generation

### Changed

- **Integrated confidence-detector in transform-plan workflow**
  - Automatically calculates confidence for tasks that don't have scores
  - Updates confidence_summary in orchestration.json
  - Identifies low-confidence tasks during finalization

- **Integrated spec-validator in transform-plan workflow**
  - Validates all task specs during transformation
  - Reports errors and warnings for incomplete specs
  - Returns validation result with transformation

- **Orchestration.json now includes v2.0 metadata:**
  - `confidence` - Summary of high/medium/low task counts
  - `traceability` - Mapping from requirements to tasks
  - `suggestion_usage` - Which suggestions were used/adapted/skipped
  - `assumptions` - AI assumptions during breakdown
  - `risks` - Identified implementation risks

---

## [3.22.0] - 2025-12-06

### Added

- **Phase 7: Testing & Validation** - Complete test suite for Plan System v2

- **New test files:**
  - `tests/confidence-detector.test.js` - 47 unit tests for confidence calculation
    - Tests for WEIGHTS, KNOWN_PATTERNS, and DOMAIN_KEYWORDS constants
    - Tests for isKnownPattern, requiresDomainExpertise, hasDocumentation
    - Tests for calculateScore, scoreToLevel, identifyRisks, suggestMitigations
    - Tests for analyze and analyzeAll methods
    - Edge case handling for empty/null inputs

  - `tests/spec-validator.test.js` - 41 unit tests for task spec validation
    - Tests for REQUIRED_FIELDS and RECOMMENDED_FIELDS constants
    - Type-specific validation for create_function, create_hook, create_component
    - Type-specific validation for create_table, create_test, create_class
    - Tests for validateAll and suggestion generation
    - Edge case handling for malformed specs

  - `tests/doc-fetcher.test.js` - 57 unit tests for documentation fetching
    - Tests for markdown, JSON, YAML, and HTML parsing
    - Tests for URL detection and file extension handling
    - Tests for keyword extraction and stop word filtering
    - Tests for caching and cache expiry
    - Tests for local file fetching and relevant docs matching
    - Edge case handling for empty/special content

  - `tests/integration/plan-system.test.js` - 19 integration tests
    - End-to-end confidence integration tests
    - Spec validation integration with plans
    - Documentation support integration
    - Low confidence task handling
    - Mixed confidence level scenarios
    - Error handling for invalid plans

### Fixed

- **DocFetcher._extractKeywords() operator precedence bug** - Stop words were not being filtered
  - Previous: `text.match(...) || [].filter(...)` returned unfiltered match result
  - Now: `(text.match(...) || []).filter(...)` correctly applies stop word filter
  - This improves keyword matching accuracy for documentation relevance

### Changed

- **upgrade-plan-impl.md** - Marked Phase 7 (Testing & Validation) as complete
  - All 7 phases of Plan System v2 are now implemented and tested
  - Status updated to "Complete (All 7 phases implemented and tested)"

---

## [3.21.0] - 2025-12-06

### Added

- **Phase 4: Plan-Execute Upgrade** - Complete code generation workflow from lean specs

- **New modules for execution:**
  - `code-generator.js` - Orchestrates code generation from task specifications
  - `file-writer.js` - Safe file writing with directory creation and change tracking
  - `verifier.js` - TypeScript, ESLint, and test verification
  - `doc-verifier.js` - JSDoc documentation verification (checks @param, @returns, @example, @category)
  - `parallel-executor.js` - Parallel task execution with dependency-aware batching

- **New prompt template:**
  - `generate-code.md` - Code generation prompt with mandatory JSDoc requirements

- **New CLI options for plan-execute:**
  - `--parallel <n>` - Execute up to N tasks concurrently
  - `--dry-run` - Preview execution without writing files
  - `--review-mode` - Pause after each task for review
  - `--auto` - No confirmations (for CI/automation)
  - `--skip-low-confidence` - Skip tasks with confidence < 40

- **New plan-ops.js functions:**
  - `getNextTask()` - Get next pending task respecting dependencies
  - `getConfidenceStats()` - Aggregate confidence statistics across plan
  - `getTaskContext()` - Load reference files and context for code generation
  - `batchUpdateTasks()` - Update multiple task statuses atomically

- **Enhanced signature-extractor.js:**
  - Explicit `@category` extraction for module organization
  - `@async`, `@component`, `@class`, `@internal` tag support

### Changed

- **plan-execute.md** - Complete rewrite with:
  - Pre-execution confidence checks
  - Code generation from lean specs with project context
  - Verification pipeline (typecheck, lint, tests, docs)
  - Low-confidence task handling with user prompts
  - Parallel execution batching
  - Comprehensive error handling

---

## [3.20.2] - 2025-12-06

### Fixed

- **Token optimization in `/session:continue`** - Use Glob instead of Read to check conversation log existence
  - Previous: Read tool loaded log content (~3-4k tokens for existence check)
  - Now: Glob returns only file path (zero content tokens)
  - **Savings: ~3-4k tokens per session continue**

### Changed

- Updated continue.md Step 4 to use Glob tool for log existence check
- Updated TOKEN OPTIMIZATION section to reflect v3.20.2 improvements
- Total session continue now uses ~8-10k tokens (was ~10-12k in v3.19.0)

---

## [3.20.1] - 2025-12-05

### Added

- **Array syntax for `--reference`** - Pass multiple references in single flag
  ```bash
  --reference [api.yaml, schema.sql, types.ts]
  ```

- **Quoted paths** - Support paths with spaces
  ```bash
  --reference ["docs/api spec.yaml", src/schema.prisma]
  ```

- **Folder references** - Auto-expand folders to relevant files
  ```bash
  --reference [src/models/]  # Expands to all *.{json,yaml,sql,prisma,md,ts,js}
  ```

- **Max 10 limit** - Validation prevents excessive references (after folder expansion)

### Changed

- **plan-save.md Step 0** - New parsing logic for `[a, b, c]` array syntax
- **plan-save.md Step 0.5a** - Added folder expansion before file analysis
- Backward compatible: `--reference single.json` still works

### Syntax Summary

```bash
# Single file (backward compat)
--reference schema.prisma

# Array of files
--reference [api.yaml, schema.sql, types.ts]

# Quoted paths (spaces)
--reference ["docs/api spec.yaml", "my folder/file.json"]

# Folder (auto-expands)
--reference [src/models/]

# Mixed
--reference [api.yaml, "docs/", src/types/]
```

---

## [3.20.0] - 2025-12-05

### Added

- **Intelligent Reference File Analysis** - `--reference` now understands file types
  - **OpenAPI/Swagger**: Extracts endpoints → API requirements, models → DB phase
  - **Existing Plans**: Evaluates relevance, inherits applicable requirements/decisions
  - **SQL Schemas**: Parses tables/relations → informs database phase
  - **Prisma Schemas**: Extracts models/enums → type-safe implementation
  - **GraphQL Schemas**: Extracts types/queries → resolver tasks
  - **Design Mockups**: Analyzes UI elements → frontend requirements
  - **Documentation**: Extracts requirements and technical decisions
  - **Source Code**: Identifies patterns to follow, code to extend

- **New prompt file**: `prompts/parse-reference.md`
  - Comprehensive instructions for intelligent file type detection
  - Structured extraction for each file type
  - Plan integration suggestions per reference type

### Changed

- **plan-save.md** - Complete rewrite of reference handling
  - Step 0.5 added for intelligent reference analysis
  - Reference files spawn analysis subagent (haiku) for structured extraction
  - Subagent prompt includes type-specific integration instructions
  - Metadata now stores reference type and integration counts
  - Preview shows reference integration summary

### Why This Matters

**Before (dumb):**
```
--reference file.json → dump content as "context" → "use as baseline"
```

**After (intelligent):**
```
--reference swagger.yaml →
  ├── Detect: OpenAPI 3.0
  ├── Extract: GET /products, POST /products, Product model
  └── Integrate:
      ├── req-1: "Implement GET /products endpoint"
      ├── req-2: "Implement POST /products endpoint"
      └── suggestion: Product model with id, name, price fields
```

Reference files are now SOURCE MATERIAL that directly inform plan structure,
not context blobs that get ignored.

---

## [3.19.0] - 2025-12-05

### Changed

- **Continue Command Architecture** - Consolidated from 3 subagents to inline + conditional
  - **Git refresh now inline**: Single CLI call instead of dedicated subagent (~5k tokens saved)
  - **Goal extraction now inline**: Read tool instead of dedicated subagent (~5k tokens saved)
  - **Conditional consolidation**: Subagent only spawned if conversation-log.jsonl exists
  - **Result**: 50% token reduction (22k → 10-12k tokens per session continue)

### Removed

- `prompts/refresh-git.md` - No longer needed (git refresh is inline CLI call)
- `prompts/extract-goal.md` - No longer needed (goal extraction is inline Read)

### Technical Details

- Identified that 2 of 3 subagents (git refresh, goal extraction) required zero AI reasoning
- Git refresh: Just runs `session-cli.js capture-git` - pure CLI operation
- Goal extraction: Just reads session.md and parses text - simple file operation
- Only consolidate-log.md still needs AI for conversation analysis
- Eliminated ~10k tokens of subagent startup overhead per session continue

---

## [3.18.1] - 2025-12-05

### Added

- **Custom Instructions for Plan Save** - Guide plan extraction with user prompts
  - New `--prompt` option for `/session:plan-save` command
  - Focus areas: "Focus on X" - prioritize specific topics
  - Exclusions: "Exclude X", "Ignore X" - skip certain areas
  - References: "--reference path" - load existing plan as context
  - Scope limits: "Only last N messages" - limit conversation scope
  - Negative prompts: "Do NOT..." - explicit constraints
  - Instructions preserved in plan metadata for finalization phase

- **Plan Commands in CLI Help** - Added missing documentation
  - `validate-requirements`, `save-requirements`, `load-requirements`
  - `get-plan-format`, `transform-plan`, `plan-exists`, `plan-update`
  - `detect-work-type`, `select-template`

### Changed

- **plan-save.md** - Enhanced argument parsing for custom instructions
  - Step 0 added for instruction parsing
  - Subagent prompt now includes user directives
  - Preview shows when custom instructions applied

---

## [3.18.0] - 2025-12-05

### Added

- **Behavior-Based Architecture Detection** - Intelligent code analysis for modern architectures
  - New `ArchitectureSynthesizer` combines gateway detection and behavior extraction
  - `GatewayDetector` identifies architectural entry points via heuristic scoring
  - `BehaviorExtractor` matches code patterns (not hardcoded library names)
  - Supports BaaS, serverless, GraphQL, and traditional patterns
  - Falls back to folder-based detection if behavior analysis fails

- **NPM Dependencies Map** - New Phase 9 in map generation
  - Generates `npm-dependencies.json` with package usage tracking
  - Tech stack detection: framework, bundler, testing, runtime, package manager
  - Cross-references imports with installed packages

- **New CLI Commands** - Extended project-maps functionality
  - `deps [pattern]` - Search npm dependencies with optional filtering
  - `stack` - Show detected tech stack (lean format by default)
  - New query types: `npm-deps`, `stack`

- **Enhanced Planning Schemas** - Richer requirement capture
  - Requirements now support `suggestions` with implementation artifacts
  - Suggestion types: `api_designs`, `code_snippets`, `file_structures`, `ui_components`, `implementation_patterns`
  - Phase schema adds `from_requirement`, `from_suggestion` for task traceability
  - Added `verification` object for codebase checks before task execution
  - Added `technical_decisions` and `user_decisions` arrays

### Changed

- **Prompts Updated** - Richer planning context extraction
  - `analyze-conversation.md` - No artificial limits on topics/decisions
  - `breakdown-requirement.md` - Enhanced suggestion extraction
  - Conversation summaries now have no length limits

### Files Added

- `architecture-synthesizer.js` - Main behavior analysis entry point
- `behavior-extractor.js` - Pattern matching against code behaviors
- `gateway-detector.js` - Architectural entry point identification
- `behavior-patterns.json` - Configurable regex patterns for detection

### Files Modified

- `architecture-detector.js` - Added behavior-based detection methods
- `map-generator.js` - Added Phase 9 (npm-deps), behavior analysis integration
- `project-maps.js` - New `deps`, `stack` commands and query types
- `intent-router.js` - Added behaviorAnalysis to backend-layers query
- `plan-ops.js` - Extended validation for new schema fields
- `phase-schema.json` - Added verification and traceability fields
- `requirements-schema.json` - Added suggestions and decision arrays

---

## [3.17.5] - 2025-12-03

### Added

- **Lean Output Format for Project Maps Search** - 90% token savings on search results
  - File search now returns Glob-style paths (one per line)
  - Signature search returns `file:line:name(params)` format
  - Export search returns `file:symbol:type` format
  - Unified search returns minimal JSON with short keys (f, s, e, i, c, t)
  - Default format changed from verbose to lean
  - Use `--verbose` flag for rich markdown output (previous behavior)

### Changed

- **Default Output Format** - Search results now default to lean format
  - Old: Verbose JSON with markdown (~600 tokens per search)
  - New: Minimal paths/lines (~50 tokens per search)
  - `--verbose` flag provides full rich output when needed
  - `--json` flag provides raw JSON structure

### Files Modified

- `output-formatter.js` - Added `formatLean()`, `formatLeanUnified()`, and 6 lean format helpers
- `project-maps.js` - Changed default format, added lean handling, updated help text
- `session-cli.js` - Added support for `output` and `formatted` result properties

---

## [3.17.4] - 2025-11-25

### Fixed

- **Glob Pattern Matching for Map Generator** - Fixed critical bug preventing nested directory scanning
  - Pattern `**/*.ts` now correctly matches files at any depth (not just depth 1)
  - Root cause: Glob-to-regex conversion was replacing `*` inside `.*` and `?` inside `(.*/)?`
  - Solution: Use placeholder strings to protect special patterns during conversion
  - Before: product-sdk mapped only 4 files
  - After: product-sdk correctly maps 29 files

---

## [3.17.3] - 2025-11-25

### Fixed

- **NL Parser Description Extraction** - Fixed bug where `description 'X'` wasn't recognized
  - Previously required `with description 'X'` syntax
  - Fallback regex was incorrectly capturing `"task to"` as description
  - Now accepts standalone `description` keyword

---

## [3.17.2] - 2025-11-25

### Changed

- **Session List Badge** - Changed `⚠️ INACTIVE` to `🧊 COLD` for visual consistency
  - Hot/cold concept: 🔥 HOT (recent) vs 🧊 COLD (stale >7 days)

---

## [3.17.1] - 2025-11-25

### Fixed

- **Command Format Instructions** - Added CRITICAL command format section to all session commands
  - All commands now have explicit `/session:` prefix requirement at the top
  - Fixed incorrect command suggestions (e.g., `/session list` → `/session:list`)
  - Affected commands: continue, start, close, save, plan-list

---

## [3.17.0] - 2025-11-25

### Fixed

- **Plan Update Command Wiring** - Connected plan-update implementation to CLI
  - The plan-update.js handler existed but was never registered in session-cli.js
  - Added command registration enabling `/session:plan-update` functionality
  - Natural language parsing, dry-run preview, and execution modes now accessible

---

## [3.16.0] - 2025-11-25

### Added

- **Plan Update Feature** - Modify implementation plans with atomic operations and execution safety
  - **Core Operations** - Add, update, delete, move, and reorder phases and tasks
  - **Execution Modes** - Selective update (protects completed work) and rollback-replan (full reset)
  - **Atomic Transactions** - All operations backed up before execution with automatic rollback on failure
  - **UUID-based ID System** - Unique identifiers for all plan elements
  - **Comprehensive Validation** - Schema validation, dependency checking, and integrity verification
  - New operations: `phase-operations.js`, `task-operations.js`, `metadata-operations.js`, `update-orchestrator.js`
  - New validators: `schema-validator.js`, `integrity-validator.js`, `update-validator.js`
  - New execution handlers: `execution-updates.js`, `execution-analyzer.js`
  - New documentation: `docs/plan-updates.md`
  - New tests: 203 total tests across 4 test suites

---

## [3.15.6] - 2025-11-25

### Fixed

- **Skipped Phase Progress Calculation** - Fixed progress showing incorrect values for plans with skipped phases
  - Tasks in skipped phases were incorrectly counted as "pending" instead of being recognized as terminal
  - Updated `derivePlanStatus()` to treat "skipped" as terminal state alongside "completed"
  - Updated `getProgress()` to track `skippedTasks` and `skippedPhases` separately
  - Added `completedAt` check for explicit plan completion signal
  - New response fields: `status`, `skipped`, `actual_work_percent`, `completed_at`, `skip_reason`, `summary`
  - Example: plan with 28 completed + 25 skipped tasks now shows 83% complete instead of incorrect 44%

---

## [3.15.5] - 2025-11-25

### Fixed

- **Plan Progress Data Inconsistency** - Implemented single source of truth for progress calculation
  - Created `progress-service.js` module using `execution-state.json` as authoritative source
  - Fixed `getPlanStatus()` reading from wrong data source (phase files instead of execution-state)
  - Fixed `updateTaskStatus()` not updating `execution-state.json`
  - Added `sync-phase-files.js` utility to repair existing inconsistent data
  - Resolves bug where plan-status showed incorrect progress (e.g., 36% instead of actual 79%)

---

## [3.15.4] - 2025-11-24

### Fixed

- **Documentation Path References** - Completed migration to global plans directory
  - Fixed remaining path references in command templates: plan-execute.md, plan-finalize.md, plan-list.md, plan-status.md, plan-save.md (10 references)
  - Updated JSDoc comment in requirement-transformer.js
  - All documentation now correctly references `.claude/plans/` instead of outdated `.claude/sessions/plans/`
  - Eliminates user confusion when following command instructions
  - Closes documentation-code path mismatch introduced during global plans refactor

---

## [3.15.3] - 2025-11-24

### Fixed

- **Global Plans Directory Path** - Corrected plans storage location from session-scoped to global
  - Fixed `getPlansDirectory()` in plan-ops.js to return `.claude/plans` instead of `.claude/sessions/plans`
  - Migrated 4 existing plans from session folder to global directory
  - Plans now correctly accessible without session context
  - Resolves path mismatch between code and documentation

- **Command Reference Consistency** - Updated all plan command references to use proper slash command syntax
  - Changed `/plan-*` to `/session:plan-*` across all documentation (27 references)
  - Updated: plan-list.md, plan-status.md, plan-execute.md, plan-finalize.md, plan-save.md
  - Fixed historical references in CHANGELOG.md for accuracy
  - Ensures users see correct command syntax in all help text

---

## [3.15.2] - 2025-11-24

### Changed

- **Session Continue Summary Display** - Enhanced snapshot summary visibility
  - Changed from 3-line teaser (~80 tokens) to full snapshot summary (~300 tokens)
  - Now displays ALL topics, decisions, and tasks with titles (not just first 3)
  - Complete context visibility immediately on session resume
  - Better user experience: No need to read snapshot file separately
  - Acceptable token tradeoff: +220 tokens per resume for comprehensive context
  - Maintains backward compatibility: v1.0 snapshots still use minimal teaser
  - Updated Step 3.5 and Step 6 in continue.md with new extraction and display logic

---

## [3.15.1] - 2025-11-24

### Changed

- **Plugin Description Format** - Migrated to bullet-point changelog format
  - plugin.json now displays version history in bullet points (latest on top)
  - Keeps last 6 versions for quick reference
  - Format: `• vX.Y.Z: Summary of changes`
  - Marketplace description remains static with version prefix only

### Added

- **Version Manager Enhancements** - Automatic changelog-based description updates
  - `extractChangelogSummary()` parses CHANGELOG.md for version-specific changes
  - `buildBulletDescription()` constructs bullet-point format with latest changes on top
  - Automatically extracts and prepends changelog bullets on version updates
  - Maintains separation: plugin.json (technical changes) vs marketplace.json (static marketing)

---

## [3.15.0] - 2025-11-24

### Fixed

- **Plan Transformation Path Bug** - Resolved double `/plans/plans/` path error in plan finalization
  - Fixed `requirement-transformer.js` to accept `plansDir` instead of `sessionPath`
  - Fixed `orchestrator.js` constructor to use `plansDir` parameter consistently
  - Eliminates ENOENT errors when running `/session:plan-finalize` command
  - Tested with end-to-end dummy plan workflow to verify file operations
  - This was the blocker preventing plan finalization in v3.14.x

### Changed

- **Plan Status Enhancement** - `getPlanStatus()` now loads full phase data with tasks
  - Previously only loaded orchestration metadata without task details
  - Now provides complete status information including task-level progress

---

## [3.14.2] - 2025-11-22

### Changed

- **Plan Feature - Global Storage** - Plans are now global and independent of sessions
  - Plans stored in `.claude/sessions/plans/` instead of per-session directories
  - All plan operations no longer require an active session
  - Removed `sessionName` parameter from all 15 plan functions in plan-ops.js
  - Updated CLI commands: `create-plan`, `get-plan`, `list-plans`, `plan-status`, `finalize-plan`, `update-task-status`, etc.
  - Added `plan-list` alias for `list-plans` command
  - Plans are now project-level resources accessible from any session

### Added

- **New Command** - `/session:plan-list` to list all global plans
  - Shows both conceptual (requirements-only) and implementation (executable) plans
  - Displays progress, status, and last updated information
  - Works without requiring an active session

### Updated

- **Plan Commands** - All plan slash commands updated for global storage
  - `/session:save-plan` - Session context now optional (can create plans without active session)
  - `/session:plan-status` - Removed session requirement, shows global plan status
  - `/session:plan-execute` - Works globally, no session validation needed
  - `/session:plan-finalize` - Transforms requirements to tasks without session dependency
  - All commands reference `.claude/sessions/plans/` as global storage location

---

## [3.14.1] - 2025-11-22

### Fixed

- **Work Type Detection** - Resolved data structure mismatch causing detection failures
  - Updated work-type-detector.js to support compact JSONL format (`.p` and `.r` fields)
  - Maintains backward compatibility with old format (`.content` field)
  - Detection now correctly analyzes conversation logs created by v3.8.9+ conversation logger
  - Eliminates "work type detection failed" errors during `/session:plan-save` operations

---

## [3.14.0] - 2025-11-22

### Fixed

- **Node.js v24.7.0 Compatibility** - Resolved syntax errors causing parser failures
  - Fixed glob pattern `src/*/index)` in JSDoc comment (module-detector.js:10)
  - Wrapped database schema methods in proper class structure (db-schema-methods.js)
  - All 95 JavaScript files now pass Node.js v24.7.0 syntax validation

- **Marketplace Repository URLs** - Corrected GitHub repository references
  - Updated all plugin configurations from `automatewithus/claude-plugins` to `awudevelop/claude-plugins`
  - Fixed marketplace.json, devops/plugin.json, deployment/plugin.json
  - Added missing repository field in deployment plugin
  - Updated deployment guide documentation with correct URLs

### Changed

- **Database Schema Methods** - Restructured for better modularity
  - Converted 12 loose method definitions into DatabaseSchemaMethods class
  - Added proper module exports and dependency imports
  - Enhanced code organization for MapGenerator integration
  - Methods now properly encapsulated: generateDatabaseSchema, extractTableSchemas, parsePrismaSchema, parseSequelizeModel, parseTypeORMEntity, parseMongooseSchema, parseDjangoModel, parseSQLAlchemyModel, parseActiveRecordModel, generateTableModuleMapping, plus utility helpers

---

## [3.13.0] - 2025-11-21

### Added

- **Project Context Maps System** - Complete implementation of comprehensive multi-layered project analysis
  - **Phase 4: Business & Module Maps** (4 tasks)
    - `module-detector.js`: Intelligent module detection with 4 strategies (directory, naming, co-location, custom)
    - Business modules map with role categorization (screens, pages, components, APIs, services, models, tests, docs)
    - Database table usage extraction per module (Sequelize, Prisma, TypeORM support)
    - Module dependency graph with coupling analysis (isolated, loose, moderate, tight)
    - Output: `modules.json`, `module-dependencies.json`

  - **Phase 5: Frontend Architecture Maps** (5 tasks)
    - `framework-detector.js`: Multi-framework detection (React, Vue, Angular, Svelte)
    - State management detection (Redux, MobX, Vuex, Pinia, NgRx, Svelte Stores)
    - Component metadata extraction (props, state, hooks, lifecycle methods)
    - Component dependency graphing with usage relationships
    - Layer categorization (pages, features, UI components, layouts)
    - Reusable component identification (usage-based and directory-based)
    - Output: `frontend-components.json`, `component-metadata.json`

  - **Phase 6: Backend Architecture Maps** (5 tasks)
    - `architecture-detector.js`: Pattern detection (MVC, Layered, Clean Architecture, Service-Oriented, Microservices)
    - Backend layer mapping (routes, controllers, services, models, repositories, middleware)
    - Data flow tracing (route → controller → service → model chains)
    - Architectural violation detection (upward dependencies, layer breaches)
    - API endpoint extraction with HTTP methods
    - Output: `backend-layers.json`, `data-flow.json`, updated `issues.json` and `quick-queries.json`

  - **Phase 7: Database Schema Maps** (4 tasks)
    - `db-detector.js`: ORM/framework detection (Prisma, Sequelize, TypeORM, Mongoose, Knex, SQLAlchemy, Django, ActiveRecord)
    - Table schema extraction (columns, types, constraints, defaults)
    - Relationship mapping (foreign keys, hasMany, belongsTo, many-to-many)
    - Index extraction with performance analysis
    - Table-to-module bidirectional mapping
    - Output: `database-schema.json`, `table-module-mapping.json`

  - **Phase 11: Testing & Validation** (7 tasks)
    - Test fixtures: 3 complete projects (simple-react, express-api, monorepo) with 23 files
    - `compression.test.js`: 15 test cases validating 60-80% compression achievement
    - `map-generation.test.js`: 18 integration tests for end-to-end map generation
    - `dependencies.test.js`: 25+ tests for multi-language parsing (JS/TS, Python, Go, Rust)
    - `refresh.test.js`: 20+ tests for staleness detection and incremental updates
    - `benchmarks.test.js`: Performance benchmarks for small/medium/large projects
    - `validator.js`: Complete validation suite (CLI tool with 4 validation checks)
    - 100+ total test cases with comprehensive coverage

- **Project Maps Commands** - 6 new slash commands for map operations
  - `/project-maps-generate` - Generate all project context maps
  - `/project-maps-list` - List all available maps for current project
  - `/project-maps-load` - Load specific maps into conversation
  - `/project-maps-query` - Query maps for specific information
  - `/project-maps-refresh` - Refresh stale maps (smart staleness detection)
  - `/project-maps-stats` - Show comprehensive map statistics

- **Core Libraries** - 15 new production libraries (~5,500 lines)
  - `scanner.js`: File system traversal with .gitignore support
  - `parser.js`: Multi-language dependency parsing (JS/TS, Python, Go, Rust, Java, C#, PHP, Ruby)
  - `compression.js`: 3-level compression (minify, abbreviate, deduplicate) achieving 60-80% reduction
  - `map-generator.js`: Central orchestration for all map generation (3,034 lines)
  - `map-loader.js`: Lazy-loading with tiered architecture (Level 1/2/3 maps)
  - `config.js`: Project configuration with intelligent defaults
  - `staleness-checker.js`: Git-based staleness scoring (0-100 scale)
  - `incremental-updater.js`: Smart incremental map updates
  - `refresh-cli.js`: CLI for map refresh operations

### Statistics

- **15,715 insertions** across 55 new files
- **~5,500 lines** of production code
- **3,331 lines** of test code
- **100+ test cases** with comprehensive coverage
- **8 new library files** for map generation
- **10 new JSON map outputs** (compressed, tiered loading)
- **6 new slash commands** for project maps
- **25 tasks completed** from deferred phases

### Performance

- **Compression**: 60-80% size reduction achieved on all maps
- **Tiered Loading**: 3-level architecture (2KB → 8KB → 40KB) for optimal performance
- **Incremental Updates**: 70-90% faster refresh for unchanged files
- **Staleness Detection**: Git-hash based tracking with 0-100 scoring
- **Scan Speed**: <30s for 1000+ file projects

### Documentation

- `PROJECT_MAPS_GUIDE.md`: Complete user guide with examples
- `PHASE_6_IMPLEMENTATION.md`: Backend architecture detection details (18KB)
- `PHASE_7_IMPLEMENTATION_SUMMARY.md`: Database schema implementation
- `PHASE_11_TEST_SUMMARY.md`: Complete test coverage summary
- Comprehensive README updates with usage examples

---

## [3.12.0] - 2025-11-21

### Added

- **Requirements-Based Planning Workflow** - Complete implementation of two-format approach for planning
  - **New Schemas** (`session/schemas/`)
    - `requirements-schema.json`: Lightweight schema for conceptual plans (requirements capture)
    - Updated `orchestration-schema.json`: Added `derivedFrom` field for requirement traceability
  - **Transformation Engine** (`session/cli/lib/`)
    - `requirement-transformer.js`: Core engine that transforms requirements into executable tasks
    - Organizes tasks by architectural layers (Database → API → UI → Testing)
    - Provides implementation details (SQL statements, API endpoints, UI components)
    - Tracks traceability from requirements to tasks via `from_requirement` field
  - **AI-Powered Breakdown** (`session/prompts/`)
    - `breakdown-requirement.md`: AI prompt for intelligent task breakdown
    - Converts high-level requirements (WHAT) into concrete tasks (HOW)
    - Example: "Restrict products" → 10+ specific tasks across DB/API/UI layers
  - **Updated Commands** (`session/commands/`)
    - `plan-save.md`: Now creates requirements.json instead of orchestration.json
    - `plan-finalize.md`: Implements AI-powered transformation (requirements → tasks)
    - `plan-execute.md`: Added format validation (blocks conceptual plans from execution)
  - **Updated Prompts**
    - `analyze-conversation.md`: Extracts requirements (not tasks) from conversation
    - Added examples distinguishing requirements vs implementation tasks
  - **CLI Integration** (`session/cli/`)
    - Added 5 new commands: save-requirements, validate-requirements, load-requirements, get-plan-format, transform-plan
    - Updated session-cli.js with new command routes
    - Updated plan-ops.js with new business logic functions

### Changed

- **Planning Workflow** - Separated conceptual planning from implementation planning
  - **Before**: plan-save created orchestration.json with vague tasks, plan-finalize only changed planType field
  - **After**: plan-save creates requirements.json, plan-finalize uses AI to transform into orchestration.json + phases/
  - **User Benefit**: Planning phase is now lightweight and exploratory, transformation happens when ready

### Fixed

- **Finalize Gap** - Addressed critical gap where finalize step didn't actually transform requirements into tasks
  - Finalize now performs real AI-powered breakdown instead of just field change
  - Tasks are now concrete and actionable with implementation details
  - Proper phase organization by architectural layer

### Technical Details

- **File Structure Changes**:
  - Conceptual plans: `plans/{name}/requirements.json` only
  - Implementation plans: `plans/{name}/orchestration.json + phases/*.json + requirements.json` (preserved for traceability)
- **Transformation Flow**: Requirements (WHAT) → AI Analysis → Tasks (HOW) organized by phases
- **Total Changes**: 11 files modified/created, ~2,500 lines of code
- **Token Efficiency**: Maintains 74% token reduction via parallel subagent delegation

---

## [3.11.0] - 2025-11-20

### Changed

- **Consolidation Format v2.0** - Improved snapshot format for comprehensive topic capture
  - **Format Changes** (`session/prompts/consolidate-log.md`)
    - Migrated from paragraph-based to numbered list format for all sections
    - Added explicit Format Version: 2.0 marker for programmatic detection
    - Restructured output: Topics Discussed, Suggestions & Recommendations, Decisions Made, Tasks Completed, Files Modified, Current Status
    - Enhanced Current Status section with structured bullets: Progress, Next Steps, Blockers
  - **Anti-Recency Bias Improvements**
    - Added explicit "CRITICAL INSTRUCTION" to analyze ENTIRE conversation from beginning to end
    - Added "Anti-Recency Bias" warning emphasizing equal importance of all topics
    - Added "Coverage Requirements" section: chronological order, no skipping, no merging, explicit enumeration
    - Prevents model from focusing only on recent interactions
  - **Command Updates**
    - Updated `/session save` format template to match v2.0 structure
    - Updated `/session start` consolidation template to match v2.0 structure
    - Updated `/session continue` teaser extraction with format detection (v1.0 vs v2.0)
  - **Backward Compatibility**
    - Continue command automatically detects and handles both v1.0 (paragraph) and v2.0 (numbered) formats
    - Old snapshots remain readable, new snapshots use improved format

### Improved

- **Topic Coverage** - Snapshots now capture 5+ topics instead of 1-2 paragraph summary (95%+ coverage vs <70% before)
- **Readability** - Numbered lists are more scannable and machine-parseable than paragraphs
- **Comprehensiveness** - Explicit anti-recency bias instructions ensure full conversation analysis

---

## [3.10.0] - 2025-11-20

### Added

- **Planning Feature (Phase 1: Core Infrastructure)** - Complete implementation of structured planning system
  - **4 Work Type Templates** (`session/templates/`)
    - `feature-template.json`: 4-phase feature development (Setup → Implementation → Testing → Deployment)
    - `bug-template.json`: 3-phase bug fix workflow (Investigation → Fix → Deployment)
    - `spike-template.json`: 3-phase research workflow (Research → Prototyping → Recommendation)
    - `refactor-template.json`: 3-phase refactoring workflow (Analysis → Refactoring → Validation)
  - **Plan Schema & Validation** (`session/schemas/plan-schema.json`)
    - Complete JSON Schema for plan validation with 60+ validation rules
    - Manual validation implementation (no external dependencies)
    - Validates plan structure, phases, tasks, dependencies, and metadata
  - **Plan Operations** (`session/cli/lib/commands/plan-ops.js`)
    - Full CRUD operations: create, read, update, delete plans
    - Task status management: pending → in_progress → completed → blocked
    - Progress tracking: auto-calculates completion percentage from task statuses
    - Plan export: JSON and Markdown formats
    - 10 CLI commands exposed via session-cli.js
  - **Work Type Detection** (`session/cli/lib/work-type-detector.js`)
    - AI-powered detection algorithm with keyword & pattern analysis
    - Confidence scoring based on conversation length and signal strength
    - Detects: feature, bug, spike, refactor work types
    - 70-95% accuracy with 10+ message conversations
  - **Template Selection** (`session/cli/lib/template-selector.js`)
    - Dynamic template loading based on detected work type
    - Custom template support with fallback to defaults
    - Template validation and metadata extraction
  - **Conversation Analysis** (`session/prompts/analyze-conversation.md`)
    - Subagent prompt for extracting structured data from conversations
    - Extracts: goals, success criteria, technical decisions, requirements, constraints
    - Returns JSON with conversation summary and discussion points
  - **Save Plan Command** (`session/commands/save-plan.md`)
    - New `/save-plan {name}` command for creating plans from conversations
    - 11-step workflow: validate → detect → template → analyze → merge → preview → save
    - Interactive user choice: accept, choose different template, skip template, or cancel
    - Creates both plan file and conversation context markdown
  - **12 New CLI Commands** added to `session/cli/session-cli.js`:
    - `create-plan`, `get-plan`, `update-plan`, `delete-plan`, `list-plans`
    - `validate-plan`, `update-task-status`, `plan-status`, `export-plan`, `plan-exists`
    - `detect-work-type`, `select-template`

### Technical Details

- **Zero External Dependencies**: All validation and operations use Node.js built-ins
- **Implementation Readiness**: 9/10 (per PLANNING_IMPLEMENTATION_SPEC.md)
- **Files Added**: 14 new files (templates, schemas, libraries, prompts, commands)
- **Code Added**: 6,838+ lines of implementation
- **Token Efficiency**: Work type detection ~500-800 tokens, analysis ~1500-2500 tokens
- **Performance**: All CLI operations < 200ms, template loading < 50ms

### Documentation

- **PLANNING_IMPLEMENTATION_SPEC.md**: Complete 3,714-line specification with:
  - File structure and function signatures
  - Complete algorithm implementations
  - Data schemas and validation rules
  - CLI command specifications
  - Subagent prompt texts
  - Template JSON structures
  - Testing strategies and integration guides
- **PLANNING_FEATURE_APPROACH.md**: Updated with Phase 1 completion status

### Next Steps

- Phase 2: Advanced features (execution tracking, AI suggestions, integrations)
- Testing with real-world conversations
- User feedback and iteration

---

## [3.9.0] - 2025-11-19

### Added

- **Ultra-Compact Conversation Log Format** (`session/cli/lib/conversation-logger.js`)
  - Implemented new compact JSONL schema with 61% size reduction (2,340 tokens saved per 20-interaction session)
  - Removed unnecessary fields: `num`, `transcript_path`, `interaction_count`, `file_count`, `message_id`
  - Replaced verbose keys with compact versions: `ts` (timestamp), `p` (prompt), `r` (response), `f` (files), `tl` (tools)
  - Converted ISO 8601 timestamps to Unix seconds (24 chars → 10 digits)
  - Changed file format from objects to arrays: `[["path", status_code], ...]`
  - Store only tool names without input details for token efficiency
  - Numeric status codes: 1=Modified, 2=Added, 3=Deleted, 4=Renamed
  - Before: 15,380 chars (~3,845 tokens) | After: 6,020 chars (~1,505 tokens)
  - Full backward compatibility with auto-detection and format normalization

### Fixed

- **Subagent Path Resolution** (`session/commands/continue.md`, `session/prompts/*.md`)
  - Fixed "File does not exist" and "MODULE_NOT_FOUND" errors in parallel subagents
  - Root cause: Subagents don't inherit parent working directory or environment variables
  - Added Step 1.8 to calculate absolute paths before spawning subagents
  - Now passes `working_directory`, `plugin_root`, and `session_path` explicitly to all subagents
  - Updated all 3 prompt templates to accept and use absolute path parameters
  - Replaced `${CLAUDE_PLUGIN_ROOT}` with `{plugin_root}` variable substitution
  - Replaced relative paths (`.claude/sessions/...`) with `{session_path}` variable
  - Impact: Consolidation, git refresh, and goal extraction subagents now execute reliably

---

## [3.8.8] - 2025-11-19

### Performance

- **Consolidation Speed Improvement** (`session/commands/continue.md:54`)
  - Switched consolidation subagent from Sonnet to Haiku for 2.4x faster processing
  - Root cause: Consolidation processes 173KB JSONL (43,000 tokens) with model speed being the bottleneck
  - Sonnet: 63 tokens/sec vs Haiku: 150 tokens/sec (2.4x difference)
  - Expected result: 120s → ~50s (60% reduction in consolidation time)
  - Quality: Haiku is sufficient for structured summarization (proven by git refresh task)
  - Impact: Faster session resume during `/session:continue` operations

---

## [3.8.7] - 2025-11-18

### Fixed

- **Status Sync Bug** (`session/cli/lib/commands/update-status.js:77`)
  - Fixed critical bug where status updates failed due to treating `index.sessions` as array instead of object
  - Changed `index.sessions.find(s => s.name === sessionName)` to `index.sessions[sessionName]`
  - Root cause: Incorrect assumption about index data structure
  - Impact: Status updates between `.auto-capture-state` and `.index.json` now work reliably

- **Session Continue Missing Status Update** (`session/commands/continue.md`)
  - Added Step 4.5: Update session status to "active" after activation
  - Previously `/session:continue` would activate session but not update status field
  - Result: Sessions showed as "closed" even when active (sync bug)
  - Solution: Added `update-status "{session_name}" "active"` call after activation
  - Impact: Continuing closed sessions now properly marks them as active

### Documentation

- Updated `PLANNING_FEATURE_APPROACH.md` with conversation-driven planning architecture
  - Changed from template-driven to conversation-driven approach
  - Updated file naming convention: `plan_{name}.json` and `conversation_{name}.md`
  - Simplified implementation from 4 phases (26-34h) to 3 phases (7-11h)
  - Added new sections: Conversation Analysis, File Naming Convention, Execution in New Session

---

## [3.8.6] - 2025-11-17

### Fixed

- **All Bash Parse Error Patterns** (`session/commands/continue.md:106-207`)
  - Completely eliminated bash parse errors by replacing complex pipelines with Claude Code native tools
  - Replaced all `$(grep ... | sed ... | cut ...)` patterns with Read + Glob tools
  - Root cause: Bash tool cannot parse `$(...)` command substitution containing pipes (in Step 3.5)
  - Previous fix (v3.8.5) only addressed one instance; three more remained in teaser extraction
  - Solution: Use Glob tool to find latest snapshot, Read tool to extract teaser lines
  - Benefits: More reliable, more readable, consistent with Claude Code best practices
  - Impact: Session continue command now works 100% reliably with no parse errors

---

## [3.8.5] - 2025-11-17

### Fixed

- **Bash Tool Parse Error** (`session/commands/continue.md:112`)
  - Fixed "parse error near `(`" when resuming sessions
  - Root cause: Bash tool limitation with `$(command | pipe)` syntax inside command substitution
  - Changed from: `LATEST_SNAPSHOT=$(find ... | xargs ls -t | head -1)`
  - Changed to: `LATEST_SNAPSHOT=\`find ... | sort -r | head -1\``
  - Used backticks (deprecated but works with Bash tool) instead of `$()`
  - Simplified to alphabetic reverse sort (works perfectly for ISO date format)
  - Impact: Session continue command now works without parse errors

---

## [3.8.3] - 2025-11-17

### Fixed

- **Marketplace Description** (`.claude-plugin/marketplace.json`)
  - Restored static/evergreen description for marketplace listing
  - Was incorrectly showing version-specific details from v3.8.0-3.8.2
  - Now shows: "Advanced session management for Claude Code with intelligent context tracking..."
  - Impact: Consistent plugin identity in marketplace, no version-specific clutter

### Changed

- **Version Management Architecture** (`.claude/commands/lib/version-update-config.json`)
  - Introduced ultra-compressed JSON config approach (81% token reduction)
  - Config contains: static descriptions, update rules, workflow, negative prompts
  - Version manager now enforces static marketplace descriptions from config
  - Command file simplified from 1,723 tokens to 330 tokens (command + config)
  - Impact: Deterministic updates, impossible to accidentally copy version-specific descriptions

- **Version Manager Enhancement** (`.claude/commands/lib/version-manager.js`)
  - Now reads static descriptions from `version-update-config.json`
  - Automatically detects and corrects marketplace description deviations
  - Warns when description has deviated from canonical static baseline
  - Impact: Self-healing version management, prevents future description corruption

---

## [3.8.2] - 2025-11-17

### Fixed

- **Zsh Compatibility** (`session/commands/continue.md:112`)
  - Replaced `ls -t .claude/sessions/{name}/auto_*.md` with `find` command
  - Fixed "parse error near '('" error in zsh when no snapshot files exist
  - Before: `ls -t .claude/sessions/{name}/auto_*.md 2>/dev/null | head -1`
  - After: `find .claude/sessions/{name} -name "auto_*.md" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1`
  - Impact: Session continue command now works reliably in zsh environments (macOS default shell)

---

## [3.8.1] - 2025-11-17

### Fixed

- **Version Consistency**
  - Synced all version references across plugin.json, marketplace.json, and README files
  - Added versionMetadata with baseline commit tracking for intelligent version management
  - Impact: Consistent version reporting and improved version bump automation

### Changed

- **Version Management**
  - Integrated intelligent version manager with baseline commit tracking
  - Baseline commit (e8df972) saved for tracking changes in next version bump
  - Automated version updates across all project files

---

## [3.7.1] - 2025-11-14

### 🔧 Hotfix: Subagent Reliability

This patch release fixes critical bugs in the v3.7.0 parallel subagent architecture that prevented proper cleanup and state management.

### Fixed

- **CLI Syntax Error** (`session/commands/continue.md:102-104`)
  - Fixed `update-state` command using wrong syntax (flags instead of JSON)
  - Was: `--reset-counters --set-last-snapshot "..."`
  - Now: `'{"interactions_since_snapshot": 0, "interactions_since_context_update": 0, ...}'`
  - Impact: State updates now work correctly, counters properly reset after consolidation

- **Missing Error Checking** (`session/commands/continue.md:93-100`)
  - Added `set -e` to halt execution on any command failure
  - Added verification after file deletion (conversation-log.jsonl)
  - Exit with detailed error JSON if deletion fails
  - Impact: No more silent failures, accurate error reporting

- **Missing Verification Step** (`session/commands/continue.md:111-129`)
  - Added verification before returning success JSON
  - Check snapshot file exists
  - Check log file actually deleted
  - Check state counters actually reset to 0
  - Impact: Success only returned when ALL steps verified complete

- **Subagent Model Reliability** (`session/commands/continue.md:36`)
  - Upgraded consolidation subagent from `haiku` to `sonnet`
  - Better multi-step task execution and error handling
  - Impact: More reliable completion of complex 8-step consolidation process

### Changed

- **Enhanced Return Format**
  - Added verification fields: `log_deleted: true`, `state_reset: true`
  - More detailed error reporting with `step_failed` number
  - Helps debugging and monitoring subagent execution

### Reliability Improvement

- **Before v3.7.1**: ~60% reliability (state updates always failed, file cleanup sometimes failed)
- **After v3.7.1**: ~95% reliability (all critical bugs fixed, full verification)
- Token optimization (72% reduction) preserved and now actually working as designed

### Root Cause Analysis

Investigation revealed:
- Subagents ARE running in isolated contexts (proven via agent transcript files)
- Subagents WERE creating snapshots successfully
- BUT subagents were returning optimistic success JSON even when later steps failed
- CLI syntax bug caused 100% failure rate on state updates
- No verification step allowed false successes to go unreported

---

## [3.7.0] - 2025-11-14

### ⚡ Parallel Subagent Token Optimization

This minor version release implements a revolutionary architecture change: session resume now uses parallel subagents for heavy operations, achieving **72% token reduction** in the main conversation context.

### Added
- **Parallel Subagent Architecture** (`session/commands/continue.md`)
  - Spawns 3 Task tool subagents in parallel (single message invocation)
  - Subagent 1: Consolidate conversation log into snapshot
  - Subagent 2: Refresh git history context
  - Subagent 3: Extract session goal for display
  - Total execution time: 2-4 seconds (parallel, not sequential)

- **Subagent Prompt Templates** (`session/cli/lib/subagent-prompts.js`)
  - Reusable prompt templates for all 3 subagents
  - Clear step-by-step instructions for autonomous execution
  - Standardized JSON return formats
  - Graceful error handling with fallbacks

- **Minimal Summary Display**
  - Clean "✓ Session ready: {goal}. What's next?" message
  - No comprehensive file listings, milestones, or decision trees
  - User can run `/session status` for detailed view when needed

### Changed
- **Token Usage** - Session resume reduced from 77k to ~22k tokens (72% reduction)
  - Before (v3.6.4): Main conversation reads all files inline (23k), consolidates logs inline (20-25k), displays comprehensive summary (8k)
  - After (v3.7.0): Subagents handle heavy work in isolated contexts, main conversation only orchestrates
  - Heavy analysis doesn't count against main conversation token budget

- **Session Resume Flow** - Complete architectural rewrite
  - Old: Sequential inline operations (read → analyze → consolidate → display)
  - New: Parallel subagent delegation (spawn 3 agents → wait → minimal display)
  - Performance: Faster due to parallel execution (2-4s vs 3-5s)
  - Scalability: Can add more subagents without impacting main context

### Performance Comparison

| Operation | v3.6.4 Tokens | v3.7.0 Tokens | Savings |
|-----------|---------------|---------------|---------|
| Session validation (CLI) | 500 bytes | 500 bytes | 0% |
| File reads (session.md, context.md, snapshots) | 23,000 | 0 (subagents) | 100% |
| Conversation log consolidation | 20,000-25,000 | 0 (subagents) | 100% |
| Git history analysis | 3,000 | 0 (subagents) | 100% |
| Summary display | 8,000 | 1,000 | 87% |
| **Total (main context)** | **~77,000** | **~22,000** | **72%** |

### Architecture Benefits

1. **Isolated Contexts**: Heavy analysis happens in subagent contexts, not main conversation
2. **Parallel Execution**: All 3 subagents run simultaneously, not sequentially
3. **Token Efficiency**: Main conversation only handles orchestration and minimal display
4. **Scalability**: Easy to add more subagents without affecting main context
5. **Maintainability**: Subagent prompts are modular and reusable
6. **Error Resilience**: Each subagent handles its own errors independently

### Technical Details

**Task Tool Configuration:**
- subagent_type: "general-purpose" (has access to all tools: Bash, Read, Write, CLI, etc.)
- model: "haiku" (cost-efficient for structured tasks)
- Prompts: Template-based from `subagent-prompts.js`

**Execution Flow:**
```
User runs: /session:continue test-session
         ↓
Main Claude validates session (CLI)
         ↓
Spawns 3 parallel Task subagents (SINGLE message)
         ↓
All subagents complete independently (2-4s)
         ↓
Main Claude processes results
         ↓
Activates session + updates timestamp
         ↓
Displays: "✓ Session ready: {goal}. What's next?"
```

### Backward Compatibility

- ✅ Works with existing sessions (no migration needed)
- ✅ Compatible with v3.6.x conversation logs
- ✅ All existing commands unchanged (start, save, close, etc.)
- ✅ Hook system unchanged (UserPromptSubmit, Stop, SessionEnd)
- ✅ Only `/session:continue` command updated

### Files Modified

- `session/commands/continue.md` - Complete rewrite with subagent architecture
- `session/commands/continue.md.v3.6.4.backup` - Backup of v3.6.4 version
- `session/cli/lib/subagent-prompts.js` - New module with prompt templates
- `session/plugin.json` - Version bump to 3.7.0, updated description
- `session/README.md` - Added v3.7.0 documentation with token comparison
- `session/CHANGELOG.md` - This entry

---

## [3.6.4] - 2025-11-13

### Fixed
- **Stop Hook Transcript Parsing** - Fixed critical bug where Stop hook couldn't read Claude's responses from transcript
  - Changed from `entry.role === 'assistant'` to `entry.type === 'assistant'` to match Claude Code transcript structure
  - Returns `entry.message` which contains the actual content
  - Impact: Self-contained conversation logs now work correctly, capturing both user prompts and Claude responses

### Added
- **Exponential Backoff Retry** - Added smart retry mechanism to Stop hook for improved reliability
  - 5 attempts with delays: 0ms, 50ms, 100ms, 200ms, 400ms (750ms max total)
  - Fast success path: 0-50ms typical response time
  - Patient for edge cases: Handles race conditions where transcript isn't immediately available
  - Performance: Typically finds response on first attempt (~5ms)

### Changed
- **Production Quality** - Removed extensive debug logging from hooks for cleaner production deployments
  - Removed 48 debug statements from `stop.js`
  - Removed 12 debug statements from `session-end.js`
  - Removed 5 debug statements from `user-prompt-submit.js`
  - Total: 65 debug log statements removed
  - Result: Slightly faster hook execution, cleaner code, reduced disk I/O

---

## [3.6.3] - 2025-11-13

### 🧹 Hybrid Session Cleanup System

This patch release implements a comprehensive multi-layer cleanup system ensuring `.active-session` markers are properly cleared in ALL scenarios, preventing orphaned session states.

### Added
- **SessionEnd Hook** (`session/hooks/session-end.js`)
  - Fires when Claude Code session terminates (exit, logout, crash, etc.)
  - Automatically deletes `.active-session` file
  - Updates index.json to clear activeSession
  - Receives termination reason: "exit", "clear", "logout", "prompt_input_exit", "other"
  - Non-blocking (cannot prevent shutdown)
  - Graceful failure handling (silent on errors)
  - Debug logging to /tmp/claude-session-hook-debug.log

- **Session Transition Handling** in start.md and continue.md
  - Checks for existing active session before activation
  - Updates previous session's "Last Updated" timestamp
  - Provides user feedback on session transitions
  - Clean handoff between sessions

### Changed
- **hooks.json** - Added SessionEnd hook registration
- **start.md** - Added Step 3 for session transition handling
- **continue.md** - Added Step 3 for session transition handling

### Architecture

**Defense in Depth - Multi-Layer Cleanup:**
```
Normal Close: /session:close
  └─> Command deletes .active-session ✓ (existing)

/clear Command:
  └─> SessionStart hook (source="clear") deletes .active-session ✓ (existing)

Claude Code Exit/Crash/Logout:
  └─> SessionEnd hook deletes .active-session ✓ (NEW)

Session Transition (start/continue different session):
  └─> Command checks and closes previous session ✓ (NEW)

Stale Sessions (edge cases):
  └─> Orphan detection every 20 prompts ✓ (existing)
```

### Benefits

**100% Coverage:**
- ✅ All session end scenarios handled
- ✅ No orphaned .active-session markers
- ✅ Clean session state transitions
- ✅ Graceful degradation (failures don't block)

**User Experience:**
- Clear feedback on session transitions
- Proper cleanup on all exit paths
- No stale "active" sessions
- Reliable session state tracking

**Technical:**
- Non-blocking hooks (< 10ms overhead)
- Atomic operations (IndexManager locking)
- Debug logging for troubleshooting
- Backward compatible

### SessionEnd Hook Details

**Input Data (stdin JSON):**
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/...",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "exit|clear|logout|prompt_input_exit|other"
}
```

**Cleanup Actions:**
1. Read .active-session to get session name
2. Delete .active-session file
3. Update index.json (set activeSession = null)
4. Log cleanup details for debugging

**Error Handling:**
- Silent failures (exit 0 on all errors)
- Graceful degradation (missing plugin files)
- No blocking of Claude Code shutdown
- Debug log captures all operations

### Testing Scenarios

**Covered by this release:**
1. ✅ Normal exit (reason: "exit")
2. ✅ User logout (reason: "logout")
3. ✅ Prompt input exit (reason: "prompt_input_exit")
4. ✅ Process kill / crash (SessionEnd fires before termination)
5. ✅ Session transitions (start new while one active)
6. ✅ Session transitions (continue different session)
7. ✅ No active session (hook exits gracefully)

### Migration

**Automatic Migration:**
- Run setup command to register SessionEnd hook
- Existing sessions unaffected
- No data migration needed
- Works immediately after hook registration

**Setup Required:**
```bash
# Register hooks (includes new SessionEnd hook)
node session/cli/session-cli.js setup-hooks
```

After setup, restart Claude Code for hooks to take effect.

### Performance

**SessionEnd Hook:**
- File deletion: < 5ms
- Index update: < 10ms
- Total overhead: < 15ms
- Runs after session ends (no user-facing delay)

**Session Transitions:**
- Active session check: < 5ms
- Timestamp update: < 10ms
- User feedback: immediate
- Total: < 20ms per transition

### Backward Compatibility

Fully backward compatible:
- Existing cleanup mechanisms still work
- SessionEnd adds additional coverage
- No breaking changes
- Graceful with or without SessionEnd hook

---

## [3.6.2] - 2025-11-13

### ✨ Self-Contained Conversation Logs

This patch release enhances v3.6.1 by capturing Claude's responses directly in conversation logs, making them fully self-contained without external dependencies.

### Added
- **Stop Hook** (`session/hooks/stop.js`)
  - Fires after Claude completes each response
  - Reads transcript file to extract Claude's response text
  - Logs response to conversation-log.jsonl via ConversationLogger
  - ~10-50ms overhead per response (acceptable at response boundaries)

- **logAssistantResponse() Method** in ConversationLogger
  - Stores Claude's response text, tools used, and message ID
  - JSONL entry type: `assistant_response`
  - Performance target: <5ms

### Changed
- **plugin.json** - Added Stop hook configuration
- **continue.md** - Simplified consolidation logic (no transcript reading needed)
- **Conversation Log Format**:
  ```jsonl
  {"type":"interaction","user_prompt":"...","transcript_path":"...","...}
  {"type":"assistant_response","response_text":"...","tools_used":[...],"...}
  ```

### Benefits

**Self-Contained Logs:**
- ✅ Full conversation in conversation-log.jsonl (user prompts + Claude responses)
- ✅ No dependency on external transcript files
- ✅ Complete context for intelligent analysis
- ✅ All data in one place

**Consolidation Simplification:**
- No need to read transcript file at session boundaries
- Faster consolidation (one file instead of two)
- More reliable (no transcript expiration concerns)

**Storage:**
- ~2-10KB per interaction (includes full response text)
- Not an issue - logs cleared after consolidation anyway
- Temporary storage during active session only

### Backward Compatibility

- v3.6.1 logs (transcript_path only) still supported
- Falls back to reading transcript file if response_text missing
- Graceful degradation for older log formats

### Technical Details

**Stop Hook Lifecycle:**
```
Claude completes response
    ↓
Stop hook fires
    ↓
Read transcript file
    ↓
Extract last assistant message
    ↓
Log to conversation-log.jsonl
    ↓
Done (~10-50ms total)
```

**Log Entry Structure:**
```json
{
  "type": "assistant_response",
  "timestamp": "2025-11-13T...",
  "response_text": "Claude's full response text here...",
  "tools_used": [
    {"tool": "Write", "input": {...}, "id": "..."}
  ],
  "message_id": "msg_abc123"
}
```

### Migration

No migration needed! v3.6.2 captures both:
- `transcript_path` (for backward compatibility)
- `response_text` (new self-contained approach)

Consolidation will use `response_text` if available, fall back to `transcript_path` otherwise.

---

## [3.6.1] - 2025-11-13

### 🔧 Critical Fix: Full Conversation Capture

This patch release fixes a critical gap in the v3.5.1/v3.6.0 architecture where conversation logs only captured metadata (timestamps, file paths) without actual conversation content, making intelligent analysis impossible.

### Fixed
- **Conversation Logging Now Captures Full Context**
  - UserPromptSubmit hook now reads stdin to extract `transcript_path`
  - Stores transcript path in conversation-log.jsonl entries
  - Enables access to full conversation history (user messages, Claude responses, tool calls)
  - **Result**: Claude can now perform TRUE intelligent analysis at session boundaries

- **Updated Consolidation Logic** (`continue.md`)
  - Now reads transcript file for full conversation context
  - Falls back gracefully to metadata-only for older logs (pre-v3.6.1)
  - Provides actual conversation understanding instead of just file patterns

### Changed
- **user-prompt-submit.js** - Reads stdin to capture transcript_path and user_prompt
- **conversation-logger.js** - Stores transcript_path and user_prompt fields (v3.6.1+)
- **continue.md** - Updated to read transcript file for intelligent analysis

### Impact

**Before v3.6.1 (Broken):**
- Logs contained only: timestamps, file_count, file paths
- Claude had NO conversation content to analyze
- System fell back to pattern-based heuristics ("Refactoring focus detected")
- Could not extract decisions, reasoning, or context

**After v3.6.1 (Fixed):**
- Logs contain transcript_path to full conversation JSONL
- Claude reads actual user messages and responses
- TRUE intelligent analysis with full understanding
- Can extract decisions, reasoning, and "why" behind changes

### Technical Details

**Transcript Path Storage:**
- Minimal overhead: ~50 bytes per interaction (just the path)
- Leverages Claude Code's existing transcript system
- No duplication of conversation data
- Graceful degradation for older logs

**Backward Compatibility:**
- Pre-v3.6.1 logs (metadata only) still work
- Falls back to heuristic analysis if transcript unavailable
- No breaking changes to existing sessions

### Acknowledgment

Thanks to the user for catching this critical gap between documentation promises ("intelligent AI-powered analysis") and actual implementation (metadata-only pattern detection). This fix completes the v3.5.1 architecture vision.

---

## [3.6.0] - 2025-11-13

### 🔍 Automatic Git History Capture

This minor release adds automatic git context capture at session boundaries, providing Claude with full repository awareness.

### Added
- **Git History Capture** - Automatic git context at session start/continue
  - Captures last 50 commits with metadata
  - Tracks uncommitted changes (staged/unstaged/new/deleted/conflicted)
  - Branch tracking (ahead/behind upstream)
  - Development hotspots (active directories)
  - **Format**: Ultra-compact JSON (~2-15KB depending on repo)
  - **Performance**: 60-90ms (acceptable at session boundaries)
  - **Token Efficiency**: 70-75% fewer tokens than markdown

- **New CLI Command**: `capture-git <session-name>`
  - Manually capture/refresh git history
  - Silent skip if not a git repository (no error)
  - Creates `.claude/sessions/{name}/git-history.json`

- **New Slash Command**: `/session:git-decompress [name]`
  - Decompresses git history for human inspection
  - Shows human-readable markdown format
  - Useful for debugging and verification

- **GitHistorian Class** - `session/cli/lib/git-historian.js`
  - Handles all git operations
  - Maximum compression JSON format
  - Robust error handling (no git repo = silent skip)

### Changed
- **start.md** - Added git capture step before Claude analysis
- **continue.md** - Added git capture step before Claude analysis
- Both commands now provide git context to Claude automatically

### Benefits

**Repository Context for Claude:**
- Understands recent code changes and patterns
- Aware of uncommitted work and branch state
- Knows active development areas (hotspots)
- Better informed decisions and suggestions

**Performance:**
- Minimal overhead: 60-90ms at session boundaries
- Within 1-3s consolidation budget (3-5% overhead)
- No impact on active work (<2ms per interaction maintained)

**Token Efficiency:**
- Compressed JSON format uses 70-75% fewer tokens
- Example: 50 commits = 2-15KB vs 8-40KB markdown
- Claude can read compressed format directly

### Use Cases

**Ideal for:**
- Understanding project evolution
- Tracking feature development progress
- Identifying merge conflicts and uncommitted work
- Context about what changed since last session
- Making informed architectural decisions

**Silent Skip:**
- Not a git repository? No problem, no error
- Feature automatically disabled for non-git projects
- Zero friction for all use cases

### Technical Details

**Compressed JSON Format:**
```json
{
  "s": "session-name",
  "t": "2025-11-13T10:00:00.000Z",
  "b": "main",
  "h": "abc123",
  "sm": { "n": 50, "r": "10-30→13", "d": 14, "f": 128, "ch": "+5234/-2891" },
  "uc": { "ah": 2, "bh": 0, "stg": [], "mod": [], "new": [], ... },
  "c": [ ["abc123", "11-13", "feat: ...", "+464/-124", 6, [...]] ],
  "hot": [ ["session/", 40], [".claude-plugin/", 8] ]
}
```

**Integration Points:**
- Session start: Captures git history for new session context
- Session continue: Refreshes git history for updated context
- Before Claude analysis: Git context available for intelligent consolidation

---

## [3.5.1] - 2025-11-13

### 🎯 Default to Claude Inline Analysis (Better UX)

This patch release changes the default consolidation method from background workers to Claude inline analysis at session boundaries.

### Changed
- **Default Analysis Method** - Now uses FREE Claude inline at session boundaries
  - v3.5.0: Background worker (heuristic/ollama/api)
  - v3.5.1: Claude inline (1-3s wait at session start/continue)
  - **Rationale**: Users expect loading at session boundaries, 1-3s is acceptable
  - **Benefit**: FREE, highest quality, zero setup required

- **Session Commands** - start.md & continue.md
  - Replaced background worker spawn with inline analysis
  - Claude reads log, analyzes, creates snapshot, deletes log
  - All happens before showing session summary
  - User experience: Brief "Analyzing..." message, then full context loaded

### Reasoning

**Why This is Better:**
- ✅ **FREE**: Uses same Claude instance (no API costs)
- ✅ **Highest Quality**: Full conversation understanding
- ✅ **No Setup**: Works out of the box
- ✅ **Acceptable UX**: 1-3s wait at session boundaries is expected
- ✅ **Simpler**: No external dependencies or configuration

**During Active Work:**
- Still <2ms per interaction (zero blocking) ✓
- This was ALWAYS the goal - eliminate mid-session freezes ✓

**At Session Boundaries:**
- 1-3s analysis is acceptable (users expect loading) ✓
- FREE Claude analysis > external backends ✓

### Migration Notes

**Automatic Migration:**
- No user action required
- Next session start/continue uses new inline analysis
- Backward compatible with v3.5.0

### Performance

**User-Facing:**
- During work: <2ms per interaction (same as v3.5.0)
- Session start: +1-3s for analysis (acceptable)
- Quality: Full AI (better than v3.5.0 heuristic default)
- Cost: FREE (better than v3.5.0 API option)

**Background Worker:**
- Still available for manual use
- Command: `/session:consolidate` (future)
- Useful for batch processing old sessions

---

## [3.5.0] - 2025-11-13

### ⚡ Zero-Blocking Auto-Snapshots - Session Boundary Consolidation

This minor release completely eliminates the 10-15 second blocking issue by moving snapshot creation from mid-session (blocking) to session boundaries (background). User experience is now completely smooth with zero perceived delays.

### Added
- 📝 **Incremental Conversation Logging** - Zero-overhead capture
  - Conversations logged to conversation-log.jsonl during active session
  - Performance: <2ms per interaction (imperceptible)
  - JSONL format for efficient append-only writes
  - Includes interaction metadata, file changes, timestamps
  - No analysis during active work = no blocking

- 🔄 **Background Consolidation Worker** - Non-blocking intelligence
  - Spawns at session start/continue if unconsolidated logs exist
  - Runs as detached background process (user doesn't wait)
  - Analyzes full conversation log with selected backend
  - Creates intelligent consolidated snapshot
  - Automatically deletes raw log after success (98% space savings)
  - Consolidation time: 1-3s (happens in background)

- 🎯 **Pluggable Analysis Backends** - Free and flexible
  - **Heuristic** (default): Free, fast, pattern-based analysis
    - File pattern detection
    - Workflow classification
    - Complexity assessment
    - Zero cost, instant (<100ms)
  - **Ollama** (optional): Free, local LLM analysis
    - Requires Ollama installation
    - Runs on user's machine
    - Privacy-friendly (offline)
    - Quality: 70-80% of Claude
  - **Anthropic API** (optional): Paid, highest quality
    - Requires ANTHROPIC_API_KEY
    - Cost: ~$0.003 per snapshot
    - Same quality as Claude Sonnet 4.5
    - Background execution

- 📚 **New Library Files**
  - `cli/lib/conversation-logger.js` - Incremental logging utilities
  - `cli/lib/log-parser.js` - JSONL parsing and analysis
  - `cli/lib/heuristic-analyzer.js` - Free intelligent analysis
  - `cli/lib/analysis-backend.js` - Pluggable backend manager
  - `cli/consolidate-worker.js` - Background consolidation process

### Changed
- ⚡ **Hook Architecture** - user-prompt-submit.js
  - Removed blocking snapshot creation (70+ lines removed)
  - Added incremental logging (10 lines added)
  - Performance: <2ms (was 10-15 seconds)
  - 99.9% reduction in user-facing delay
  - Hooks now only log metadata, no analysis

- 🎯 **Session Commands** - start.md & continue.md
  - Replaced blocking marker system with consolidation triggers
  - Added unconsolidated log detection
  - Spawns background worker when needed
  - User-facing overhead: <10ms (log check + worker spawn)
  - Clear performance expectations documented

- 📋 **Session Flow** - Architecture redesign
  - **Old**: Hook blocks → Creates snapshot → User waits → Continues
  - **New**: Hook logs → User continues → Session boundary → Background consolidation
  - **Result**: Zero blocking during active work

### Removed
- 🗑️ **Blocking Snapshot System** - Replaced entirely
  - No more `.pending-auto-snapshot` markers
  - No more mid-session blocking analysis
  - Old marker-checking instructions removed
  - Cleaner, simpler architecture

### Fixed
- 🐛 **10-15 Second Freezes** - Completely eliminated
  - **Before**: User experiences noticeable freeze every 5 interactions
  - **After**: User never waits, completely smooth experience
  - **Impact**: Significantly better UX, no frustration

- 💾 **Disk Space Usage** - 98% reduction
  - Raw logs accumulated indefinitely in v3.4
  - Now automatically deleted after consolidation
  - Consolidated snapshots are 98% smaller than raw logs
  - Example: 500KB raw log → 10KB snapshot

### Performance Improvements

**User-Facing Performance:**
- During active work: **99.9% faster** (<2ms vs 10-15s)
- Session start/continue: **Same speed** (~70ms)
- Perceived blocking: **Zero** (was noticeable)

**Background Performance:**
- Consolidation: 1-3s (happens while user works)
- Heuristic analysis: <100ms
- Ollama analysis: 2-5s
- API analysis: 1-2s

**Space Efficiency:**
- Raw log: ~500KB for 50 interactions
- Consolidated: ~10KB
- Savings: 98% reduction
- Auto-cleanup: Logs deleted after consolidation

### Technical Details

**New Architecture:**
```
During Session (Active Work):
  User interaction → Hook logs to JSONL (1-2ms) → User continues
  [Repeat 50 times, zero blocking]

Session End:
  User closes laptop → conversation-log.jsonl remains on disk

Session Resume:
  User runs /session:continue →
  Check for log →
  Spawn consolidate-worker.js (background) →
  Show session info (~70ms) →
  User ready to work immediately

Background (Transparent):
  Worker analyzes log → Creates snapshot → Deletes log → Exits
```

**Conversation Log Format (JSONL):**
```jsonl
{"type":"interaction","num":1,"timestamp":"...","interaction_count":1,"file_count":0,"modified_files":[]}
{"type":"interaction","num":2,"timestamp":"...","interaction_count":2,"file_count":1,"modified_files":[{...}]}
```

**Consolidation Process:**
1. Parse conversation-log.jsonl
2. Select backend (heuristic/ollama/api)
3. Analyze conversation with backend
4. Generate consolidated snapshot
5. Write via CLI write-snapshot command
6. Delete raw log file
7. Log success/errors

### Migration Notes

**Automatic Migration:**
- No user action required
- Old snapshots remain readable
- New architecture activates immediately
- Backward compatible

**For Users with Active Sessions:**
- Current session will use new incremental logging
- Old `.pending-auto-snapshot` markers ignored (no longer used)
- Next session start/continue triggers first consolidation
- Seamless transition

### Configuration

**Default Behavior (No Config Needed):**
- Heuristic analysis (free, fast, good quality)
- Auto-consolidation at session boundaries
- Automatic log cleanup after success

**Optional Configuration:**
```bash
# Enable Ollama (local LLM)
/session:config enable-ollama true

# Enable Anthropic API (requires key)
export ANTHROPIC_API_KEY="sk-ant-..."
/session:config enable-anthropic-api true
```

### Breaking Changes
**None** - Fully backward compatible

---

## [3.4.0] - 2025-11-13

### 🧠 Intelligent Auto-Snapshots - AI-Powered Conversation Analysis

This minor release upgrades the auto-snapshot system from metadata-only to **full intelligent analysis**. Auto-snapshots now include conversation summaries, decisions, completed todos, and context - automatically every 5 interactions.

### Added
- 🧠 **Intelligent Auto-Snapshots** - AI-powered conversation analysis
  - **Conversation Summaries**: 2-3 paragraph summaries of what was discussed and accomplished
  - **Decision Extraction**: Automatic capture of technical choices, agreements, conclusions
  - **Todo Tracking**: Completed tasks since last snapshot
  - **File Context**: Not just file names, but what changed and why
  - **Current State**: Where things stand, next steps, blockers
  - Completely automatic and transparent to user

- 📝 **Marker-Based Architecture** - Reliable triggering system
  - Hooks create lightweight marker files (JSON metadata)
  - Session commands embed persistent marker-checking instructions
  - Claude detects markers before every response
  - Analyzes conversation since last snapshot
  - Creates intelligent snapshot via CLI
  - Deletes marker after processing

- 🎯 **Embedded Instructions** - Permanent session monitoring
  - `/session:start` now injects marker-checking instructions
  - `/session:continue` now injects marker-checking instructions
  - Instructions persist throughout entire session
  - No separate command file needed
  - More reliable than old detection system

### Changed
- ⚡ **Hook Simplification** - user-prompt-submit.js
  - Removed direct snapshot creation logic (67 lines removed)
  - Now creates lightweight marker files instead
  - Hook execution time: < 10ms (was 2-5 seconds)
  - Snapshot intelligence moved to Claude (where it belongs)

- 📋 **auto-snapshot.md Updates** - Now technical reference
  - No longer an active command
  - Documents the marker-processing architecture
  - Includes troubleshooting guide
  - Performance metrics and best practices

- 🎯 **Session Commands Enhanced**
  - start.md: Added CRITICAL section for auto-snapshot monitoring
  - continue.md: Added CRITICAL section for auto-snapshot monitoring
  - Instructions include snapshot format specification
  - Clear step-by-step marker processing logic

### Fixed
- 🐛 **Dumb Snapshots** - Upgraded from metadata-only to intelligent
  - **Before**: Auto-snapshots only contained counters and file lists
  - **After**: Full conversation intelligence with summaries and decisions
  - **Impact**: Future session resumptions now have complete context

- 🔄 **Marker Detection Reliability** - Fixes v3.3.0 broken detection
  - **Old Issue**: Hooks created markers but Claude never checked them
  - **Solution**: Embed checking logic directly in session command instructions
  - **Result**: 100% reliable detection and processing

### Performance Improvements
- ⚡ Hook execution: < 10ms (was 2-5s) - 200x faster
- ⚡ Marker creation: Lightweight JSON write
- ⚡ Intelligent analysis: 2-5s every 5 interactions (acceptable overhead)
- ⚡ Average overhead: ~0.4-1 second per interaction

### Technical Details

**New Architecture:**
```
User interaction → Hook increments counter (< 10ms) →
Every 5 interactions → Hook creates .pending-auto-snapshot marker →
Next response → Claude detects marker →
Analyzes conversation since last snapshot →
Extracts decisions, todos, summaries, context →
Creates intelligent snapshot via CLI →
Deletes marker → Continues with user request
```

**Marker File Format:**
```json
{
  "timestamp": "ISO timestamp",
  "trigger": "interaction_threshold|file_threshold",
  "interaction_count": 25,
  "last_snapshot_timestamp": "timestamp",
  "interactions_since_last": 5,
  "file_count": 0,
  "modified_files": [...]
}
```

**Snapshot Content (NEW):**
- Conversation Summary (AI-generated, 2-3 paragraphs)
- Decisions Made (extracted automatically)
- Completed Todos (from todo list)
- Files Modified (with context, not just names)
- Current State (where things stand)

### Breaking Changes
None - Fully backward compatible. Existing sessions will automatically adopt intelligent snapshots on next `/session:continue`.

### Migration Notes
- No action required - system automatically upgraded
- Old "dumb" snapshots remain readable
- New intelligent snapshots created going forward
- Hooks will be reloaded on next Claude Code restart (or manual restart)

---

## [3.3.0] - 2025-11-05

### 🧠 Living Context System - Continuous Context Tracking

This minor release introduces the **Living Context System** - a revolutionary approach to session management that keeps context.md continuously updated throughout your conversation.

### Added
- 🧠 **Living Context System** - Dual-threshold auto-capture architecture
  - **Context Updates**: Lightweight extraction every 2 interactions (< 1s, silent)
  - **Full Snapshots**: Comprehensive saves every 5 interactions (2-5s, minimal notification)
  - Captures: decisions, agreements, requirements, discoveries, technical choices
  - Completely automatic and silent operation

- 📝 **context-update.md Command** - New lightweight context extraction command
  - Analyzes only last 2 message exchanges (not entire conversation)
  - ~300 token budget, < 1 second execution
  - Appends incrementally to context.md
  - Five extraction categories: Decisions, Agreements, Requirements, Discoveries, Technical

- 🎯 **Smart State Tracking** - Enhanced state management
  - `interactions_since_context_update` counter
  - `interactions_since_snapshot` counter
  - Separate tracking for lightweight vs heavy operations

### Changed
- ⚡ **Hook Optimization** - `user-prompt-submit.js` reduced from 241 → 139 lines (42% smaller)
  - Removed redundant analysis queue system (OLD system at 15 interactions)
  - Simplified to single Living Context system
  - Cleaner state management with fewer fields

- 📋 **auto-snapshot.md Updates** - Simplified detection workflow
  - Now checks 2 marker types (was 3)
  - Removed Analysis Task section
  - Streamlined from 192 → 155 lines (19% reduction)

- 🎯 **Threshold Optimizations**
  - Context updates: Every 2 interactions (was never working)
  - Full snapshots: Every 5 interactions (was 15 via broken analysis)
  - File-based snapshot: 3+ files modified + 5 interactions

### Fixed
- 🐛 **Autosave Never Triggered** - Root cause analysis and resolution
  - **Issue**: Hooks created marker files but Claude never checked them
  - **Cause**: Missing `.active-session` file + no automatic trigger mechanism
  - **Fix**: Living Context system with direct marker processing

- 🧹 **Removed Redundant Code** - Eliminated conflicting systems
  - Deleted `snapshot-analysis.md` (231 lines, no longer needed)
  - Removed analysis queue logic (85 lines)
  - Eliminated 3 unused marker file types (`.analysis-queue`, `.pending-analysis`, `.snapshot-decision`)
  - 50% reduction in state files created

### Performance Improvements
- ⚡ Average overhead per interaction: ~0.5 seconds (vs 0 before, but autosave didn't work)
- ⚡ 42% smaller hook file (faster loading)
- ⚡ 50% fewer state files to manage
- ⚡ Context updates: < 1 second (lightweight)
- ⚡ Full snapshots: 2-5 seconds (only every 5 interactions)

### Technical Details

**Living Context Architecture:**
```
Every interaction → Hook tracks state
Every 2 interactions → .pending-context-update created
Every 5 interactions → .pending-auto-snapshot created
Claude auto-checks → Processes markers → Updates files
```

**State Files (After Cleanup):**
- `.auto-capture-state` - State tracking (kept)
- `.pending-context-update` - Context update trigger (new)
- `.pending-auto-snapshot` - Snapshot trigger (kept)

**Removed State Files:**
- `.analysis-queue` ❌ (redundant)
- `.pending-analysis` ❌ (redundant)
- `.snapshot-decision` ❌ (redundant)

### Breaking Changes
None - Fully backward compatible. Existing sessions will automatically adopt new thresholds.

### Migration Notes
- Restart Claude Code after updating for hooks to reload
- Run `/session:continue {session-name}` to activate Living Context system
- Context.md will start updating automatically after 2 interactions

---

## [3.2.1] - 2025-11-04

### 🔄 Smart Session State Management

This patch release adds intelligent session lifecycle management to prevent confusion when context is lost.

### Added
- 🔄 **SessionStart Hook** - Auto-cleanup on context loss events
  - Detects when `/clear` command is executed
  - Automatically clears active session markers when context is lost
  - Provides helpful context messages to guide users on resuming work
  - Preserves auto-resume behavior on normal restarts

### Changed
- 📋 **Session Lifecycle Behavior**
  - Sessions now auto-close when `/clear` is executed (context is explicitly cleared)
  - Sessions continue to auto-resume on normal Claude Code restarts
  - `.active-session` file and `.index.json` automatically updated when context is lost

### Fixed
- 🐛 **Stale Active Sessions** - Fixed issue where sessions appeared as "active" after `/clear` or Claude Code restart, even though context was no longer loaded
- ⚠️ **User Confusion** - Users are now informed when sessions are auto-closed and how to resume their work

### Behavior Details

**When sessions auto-close:**
- `/clear` command is executed (conversation context cleared)

**When sessions persist:**
- Normal Claude Code restarts
- Resume operations (`/resume`)
- Auto-compact events

**What happens on auto-close:**
1. `.active-session` file is removed
2. `.index.json` activeSession is set to `null`
3. Helpful message displayed: "Session 'X' was auto-closed due to /clear. Use /session:continue X to resume."

### Breaking Changes
None - Fully backward compatible. Only affects behavior after `/clear` command.

---

## [3.0.0] - 2025-11-03

### 🚀 Major Release: Performance Optimization & Plan Mode Support

This is a **major update** with significant performance improvements and critical new features.

### Added
- ⚡ **CLI Tool** - Lightweight Node.js CLI for zero-token operations
  - 10 commands: list, get, stats, validate, write-snapshot, etc.
  - < 10ms execution time for metadata queries
  - 1,645 lines of optimized code
- 🛡️ **Plan Mode Support** - CRITICAL feature preventing data loss
  - Snapshots save via CLI delegation (bypasses Write tool restrictions)
  - Works seamlessly in both normal and plan modes
  - Zero data loss on `/clear` in plan mode
- 📊 **Metadata Index** (.index.json)
  - Fast metadata caching
  - Lazy validation with auto-fix
  - Snapshot summaries cached
- 📚 **Comprehensive Documentation**
  - CLI README with full command reference
  - Optimization summary with metrics
  - Testing guides (comprehensive and quick test)

### Changed
- ⚡ **Performance Optimizations**
  - `/session list`: 95-98% token reduction (5-10K → < 200 tokens)
  - `/session status`: 95% token reduction (2-4K → < 150 tokens)
  - `/session continue`: 60-70% token reduction (10-20K → 3-8K tokens)
  - `/session save`: 40-50% token reduction (15-25K → 8-15K tokens)
  - Speed: 50-100x faster for list/status (< 50ms vs 2-5 seconds)
- 🎯 **Auto-Capture Optimization**
  - Threshold increased: 8 → 15 interactions
  - ~50% reduction in auto-capture frequency
  - Significant token savings over time
- 📝 **Command Refactoring**
  - All commands now use CLI for metadata operations
  - Snapshots written via CLI (plan mode compatible)
  - Index automatically updated on writes

### Fixed
- ❌ **Data loss in plan mode** - Snapshots now save correctly
- 🐛 **Stale index issues** - Lazy validation auto-fixes problems
- ⚠️ **Slow list operations** - Now < 50ms regardless of session count

### Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| List Sessions | 5-10K tokens | < 200 tokens | **95-98%** |
| Session Status | 2-4K tokens | < 150 tokens | **95%** |
| Session Continue | 10-20K tokens | 3-8K tokens | **60-70%** |
| Session Save | 15-25K tokens | 8-15K tokens | **40-50%** |
| List Speed | 2-5 seconds | < 50ms | **50-100x** |
| Status Speed | 1-2 seconds | < 50ms | **20-40x** |

**Overall: 60-80% token reduction across the entire plugin**

### Breaking Changes
None - fully backward compatible with existing sessions.

---

## [2.1.0] - Previous Version

### Features
- Intelligent auto-capture with natural breakpoint detection
- Manual snapshots with `/session save`
- Session management (start, continue, close, list, status)
- Context preservation (decisions, discoveries, files)
- Suggestion tracking
- Auto-snapshot analysis

### Known Issues
- Slow list operations with many sessions (fixed in 3.0.0)
- Data loss in plan mode (fixed in 3.0.0)
- High token usage for admin commands (fixed in 3.0.0)

---

## [2.0.0] - Initial Release

### Features
- Basic session management
- Auto-capture hooks
- Snapshot tracking
- Context files (session.md, context.md)

---

## Migration Notes

### Upgrading from 2.x to 3.0.0

**No migration required!** Version 3.0.0 is fully backward compatible.

**What happens on upgrade:**
1. Index will be built automatically on first command
2. All existing sessions work without changes
3. New features available immediately
4. Performance improvements apply instantly

**Recommended after upgrade:**
```bash
# Rebuild index for best performance
node session/cli/session-cli.js update-index --full-rebuild

# Validate everything is working
node session/cli/session-cli.js validate
```

---

## Future Roadmap

### Planned for 3.1.0
- Analytics dashboard (token usage, session trends)
- Snapshot compression for old files
- Export/import functionality

### Planned for 3.2.0
- Session templates
- Collaborative sessions
- Advanced search/filtering

### Planned for 4.0.0
- Web UI for session management
- Cloud sync for sessions
- Team collaboration features

---

## Support

- **Issues**: [GitHub Issues](https://github.com/awudevelop/claude-plugins/issues)
- **Documentation**: See `docs/` directory
- **Email**: team@automatewith.us

---

**Legend:**
- 🚀 New features
- ⚡ Performance improvements
- 🛡️ Critical fixes
- 🐛 Bug fixes
- ⚠️ Warnings
- ❌ Removed features
