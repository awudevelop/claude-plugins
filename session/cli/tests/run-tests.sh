#!/bin/bash

# Test Runner for Project Context Maps
# Phase 11: Testing and Validation

set -e

echo "================================================"
echo "  Project Context Maps - Test Suite"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test suite
run_test() {
  local test_name=$1
  local test_file=$2

  echo "Running: $test_name"
  echo "----------------------------------------"

  if node --test "$test_file" 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
  fi

  echo ""
}

# Change to tests directory
cd "$(dirname "$0")"

# Run individual test suites
run_test "Compression Tests" "compression.test.js"
run_test "Dependency Graph Tests" "dependencies.test.js"
run_test "Staleness & Refresh Tests" "refresh.test.js"
run_test "Validator Tests" "validator.test.js"
run_test "Integration Tests" "integration/map-generation.test.js"
run_test "Performance Benchmarks" "performance/benchmarks.test.js"

# Summary
echo "================================================"
echo "  Test Summary"
echo "================================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
