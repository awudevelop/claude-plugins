# Project Context Maps - Test Suite

This directory contains comprehensive tests for the project-context-maps feature (Phase 11: Testing and Validation).

## Test Structure

```
tests/
├── fixtures/                      # Test project fixtures
│   ├── simple-react/             # Small React app (<10 files)
│   ├── express-api/              # Express API backend
│   └── monorepo/                 # Monorepo with multiple packages
├── integration/                   # Integration tests
│   └── map-generation.test.js    # End-to-end map generation tests
├── performance/                   # Performance benchmarks
│   └── benchmarks.test.js        # Performance and scalability tests
├── compression.test.js           # Compression utility tests
├── dependencies.test.js          # Dependency parsing and graph tests
├── refresh.test.js               # Staleness detection and refresh tests
├── validator.test.js             # Map validation tests
└── README.md                     # This file
```

## Running Tests

### Run All Tests
```bash
cd session/cli
node --test tests/**/*.test.js
```

### Run Specific Test Suites

**Compression Tests:**
```bash
node --test tests/compression.test.js
```

**Dependency Tests:**
```bash
node --test tests/dependencies.test.js
```

**Integration Tests:**
```bash
node --test tests/integration/map-generation.test.js
```

**Performance Benchmarks:**
```bash
node --test tests/performance/benchmarks.test.js
```

**Staleness/Refresh Tests:**
```bash
node --test tests/refresh.test.js
```

**Validator Tests:**
```bash
node --test tests/validator.test.js
```

## Test Coverage

### Task 11-1: Test Fixtures ✓
- **simple-react/**: React app with components, hooks, and dependencies
- **express-api/**: Express backend with routes, models, and database config
- **monorepo/**: Multi-package workspace with cross-package dependencies

### Task 11-2: Compression Unit Tests ✓
**File:** `compression.test.js`

Tests:
- Level 1 minification (20-30% reduction)
- Level 2 key abbreviation (30-40% additional reduction)
- Level 3 value deduplication (40-50% additional reduction)
- Compression/decompression round-trips
- File operations
- Edge cases (empty objects, nulls, arrays)

**Coverage:**
- ✓ Minification accuracy
- ✓ Abbreviation correctness
- ✓ Deduplication efficiency
- ✓ 60-80% compression ratio for large datasets
- ✓ Data integrity after round-trip

### Task 11-3: Integration Tests ✓
**File:** `integration/map-generation.test.js`

Tests:
- End-to-end map generation on fixtures
- Framework detection (React, Express)
- Monorepo structure detection
- Map size constraints
- Content verification
- Error handling

**Coverage:**
- ✓ All map files generated correctly
- ✓ Structure validation
- ✓ Size constraints (summary <5KB, tree <15KB)
- ✓ Project hash consistency

### Task 11-4: Dependency Graph Tests ✓
**File:** `dependencies.test.js`

Tests:
- JavaScript/TypeScript parsing (ES6, CommonJS, dynamic imports)
- Python parsing (imports, from imports, __all__)
- Go parsing (import blocks, exports)
- Rust parsing (use statements, pub items)
- Circular dependency detection
- Import path resolution
- Real project dependency analysis

**Coverage:**
- ✓ Multi-language support
- ✓ Circular detection accuracy
- ✓ Path resolution
- ✓ Comment handling

### Task 11-5: Staleness Detection Tests ✓
**File:** `refresh.test.js`

Tests:
- Git hash change detection (40 points)
- File count change detection (30 points)
- Time-based staleness (30 points)
- Staleness levels (fresh, minor, moderate, critical)
- Incremental update logic
- Reverse dependency generation
- Performance requirements

**Coverage:**
- ✓ Staleness scoring algorithm
- ✓ Recommendation accuracy
- ✓ Incremental vs full refresh logic
- ✓ Git integration

### Task 11-6: Performance Benchmarks ✓
**File:** `performance/benchmarks.test.js`

Benchmarks:
- Small project scan (<1 second for <100 files)
- Medium project handling (100-1000 files)
- Large project compression (>1000 files, 60-80% ratio)
- Compression performance across levels
- Decompression speed
- Tiered loading efficiency
- Parsing throughput (>50 files/second)

**Targets:**
- Small project scan: < 1s
- Summary generation: < 500ms
- Compression (large): < 5s
- Decompression: < 2s
- Compression ratio: 60-80%
- Summary size: < 5KB
- Staleness check: < 1s

### Task 11-7: Validation Suite ✓
**Files:**
- `lib/validator.js` (implementation)
- `validator.test.js` (tests)

Validation Checks:
1. **File Completeness**: Ensures all required map files exist
2. **Broken References**: Detects invalid file references in dependencies
3. **Schema Compliance**: Validates map structure against expected schema
4. **Data Integrity**: Checks consistency across maps (file counts, dependencies)

**Coverage:**
- ✓ File completeness validation
- ✓ Reference validation (internal imports)
- ✓ Schema validation (required fields)
- ✓ Data consistency checks
- ✓ Validation report generation

## Usage Examples

### Running Validator
```bash
# Validate project maps
node session/cli/lib/validator.js /path/to/project ~/.claude/project-maps/abc123

# Example output:
# ========================================
#   Project Map Validation Report
# ========================================
#
# ✓ VALIDATION PASSED
#
# Summary:
#   Errors: 0
#   Warnings: 2
#
# Warnings:
#   ⚠ Missing optional file: modules.json
#   ⚠ Missing optional file: database-schema.json
#
# Detailed Checks:
#   File Completeness: ✓
#   Reference Validation: ✓
#   Schema Compliance: ✓
#   Data Integrity: ✓
```

### Performance Benchmarking
```bash
# Run performance benchmarks with output
node --test tests/performance/benchmarks.test.js

# Example output:
# Small project scan: 234.52ms
# Summary map generation: 145.23ms
# Compression ratio: 72.3%
# Compression time: 456.78ms
```

## Test Patterns

### Node.js Test Framework
All tests use the built-in Node.js test framework (`node:test`):

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Feature Tests', () => {
  beforeEach(() => {
    // Setup
  });

  it('should pass test', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
```

### Time Measurement
```javascript
async function measureTimeAsync(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1000000;
  return { result, duration: durationMs };
}
```

## Contributing

When adding new features to project-context-maps:

1. **Add fixtures** if testing new file types or structures
2. **Write unit tests** for individual functions
3. **Add integration tests** for end-to-end workflows
4. **Update benchmarks** if performance-critical
5. **Validate** with the validator suite

## Test Quality Metrics

- **Coverage:** All major functions tested
- **Assertions:** 100+ assertions across all tests
- **Edge Cases:** Null handling, empty files, malformed data
- **Performance:** Benchmarks with documented targets
- **Integration:** Real fixture projects tested

## Known Limitations

1. Some tests require git to be installed and initialized
2. Performance benchmarks may vary based on system resources
3. Integration tests may need additional dependencies installed in fixtures
4. Compression tests require schema files to be present

## Future Improvements

- Add code coverage reporting
- Mock git commands for more reliable tests
- Add stress tests for very large projects (10,000+ files)
- Test parallel map generation
- Add mutation testing
