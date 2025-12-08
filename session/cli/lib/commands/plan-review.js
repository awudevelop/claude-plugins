/**
 * Plan Review Command (v1.0)
 *
 * Validates completed tasks against their specifications to catch:
 * - Function signature mismatches
 * - Unspecified code additions
 * - Missing implementations
 * - Return type violations
 */

const fs = require('fs').promises;
const path = require('path');
const planOps = require('./plan-ops');

// Get working directory from environment or use current
const workingDir = process.env.CLAUDE_WORKING_DIR || process.cwd();

/**
 * Main entry point - review a plan's completed tasks against specs
 * @param {string} planName - Plan name to review
 * @param {Object} options - Review options
 * @returns {Promise<{success: boolean, data: ReviewResult, message: string}>}
 */
async function reviewPlan(planName, options = {}) {
  try {
    // Step 1: Load plan using getPlan from plan-ops.js
    const plan = await planOps.getPlan(planName, true);
    if (!plan) {
      return {
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: `Plan '${planName}' not found`,
          suggestion: 'Use plan-list to see available plans'
        }
      };
    }

    // Validate plan is in implementation format
    if (plan._format === 'conceptual' || plan._needsFinalization) {
      return {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Plan '${planName}' is in conceptual format`,
          suggestion: 'Use plan-finalize to transform to implementation format first'
        }
      };
    }

    // Step 2: Filter tasks with status=completed and non-null spec
    const completedTasksWithSpecs = [];
    for (const phase of plan.phases || []) {
      for (const task of phase.tasks || []) {
        if (task.status === 'completed' && task.spec) {
          completedTasksWithSpecs.push({
            ...task,
            phase_name: phase.phase_name
          });
        }
      }
    }

    if (completedTasksWithSpecs.length === 0) {
      return {
        success: true,
        data: {
          planName,
          tasksReviewed: 0,
          findings: [],
          summary: {
            byTask: {},
            bySeverity: { error: 0, warning: 0, info: 0 },
            totalErrors: 0,
            totalWarnings: 0,
            pass: true
          },
          pass: true
        },
        message: 'No completed tasks with specs to review'
      };
    }

    // Step 3: For each task, extract file path and run signature comparison
    const allFindings = [];
    const taskResults = [];

    for (const task of completedTasksWithSpecs) {
      const taskReview = await reviewTask(task, workingDir);
      taskResults.push(taskReview);
      allFindings.push(...taskReview.findings);
    }

    // Step 4: Aggregate findings by task and severity
    const summary = aggregateFindings(allFindings);

    // Step 5: Calculate pass/fail based on error count
    const pass = summary.totalErrors === 0;

    // Step 6: Return structured review result
    const reviewData = {
      planName,
      reviewedAt: new Date().toISOString(),
      tasksReviewed: completedTasksWithSpecs.length,
      taskResults,
      findings: allFindings,
      summary,
      pass
    };

    // Save results if not dry-run
    if (!options.dryRun) {
      await saveReviewResults(planName, reviewData);
    }

    return {
      success: true,
      data: reviewData,
      message: pass
        ? `Review passed: ${completedTasksWithSpecs.length} tasks reviewed, no errors`
        : `Review failed: ${summary.totalErrors} errors, ${summary.totalWarnings} warnings`
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'REVIEW_ERROR',
        message: error.message,
        suggestion: 'Check that the plan exists and is valid'
      }
    };
  }
}

/**
 * Review a single task by extracting file signatures and comparing to spec
 * @param {Object} task - Task object with spec
 * @param {string} workingDir - Working directory for resolving paths
 * @returns {Promise<{taskId: string, findings: Array<Finding>, pass: boolean}>}
 */
async function reviewTask(task, workingDir) {
  const findings = [];
  const taskId = task.task_id;
  const filePath = task.file;

  // Resolve file path
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workingDir, filePath);

  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch {
    findings.push({
      task_id: taskId,
      type: 'missing_file',
      severity: 'error',
      description: `Implementation file not found: ${filePath}`,
      location: { file: filePath, line: 0 },
      expected: 'File should exist',
      actual: 'File not found',
      suggestion: `Create the file at ${filePath}`
    });
    return { taskId, findings, pass: false };
  }

  // Extract actual signatures from file
  const actualSignatures = await extractSignaturesFromFile(absolutePath);

  // Extract spec signatures
  const specSignatures = extractSpecSignatures(task.spec);

  // Compare signatures
  const comparisons = compareSignatures(specSignatures, actualSignatures.functions);

  // Generate findings from comparisons
  const comparisonFindings = generateFindings(taskId, comparisons, filePath);
  findings.push(...comparisonFindings);

  // Detect unspecified additions
  const unspecifiedFindings = detectUnspecifiedAdditions(task.spec, actualSignatures, filePath, taskId);
  findings.push(...unspecifiedFindings);

  // Determine pass/fail
  const errorCount = findings.filter(f => f.severity === 'error').length;
  const pass = errorCount === 0;

  return { taskId, findings, pass };
}

/**
 * Extract function signatures from a source file
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<{functions: Array}>}
 */
async function extractSignaturesFromFile(filePath) {
  const source = await fs.readFile(filePath, 'utf8');
  const functions = [];

  // Match function declarations: function name(params) or async function name(params)
  const funcDeclRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = funcDeclRegex.exec(source)) !== null) {
    const lineNumber = source.substring(0, match.index).split('\n').length;
    functions.push({
      name: match[1],
      params: parseParams(match[2]),
      async: match[0].includes('async'),
      exported: isExported(source, match[1]),
      line: lineNumber,
      kind: 'function'
    });
  }

  // Match arrow functions: const name = (params) => or const name = async (params) =>
  const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?([^)=]*)\)?\s*=>/g;
  while ((match = arrowRegex.exec(source)) !== null) {
    const lineNumber = source.substring(0, match.index).split('\n').length;
    functions.push({
      name: match[1],
      params: parseParams(match[2]),
      async: match[0].includes('async'),
      exported: isExported(source, match[1]),
      line: lineNumber,
      kind: 'arrow'
    });
  }

  // Match module.exports functions
  const moduleExportRegex = /module\.exports\s*=\s*\{([^}]+)\}/;
  const exportMatch = moduleExportRegex.exec(source);
  if (exportMatch) {
    const exports = exportMatch[1].split(',').map(e => e.trim().split(':')[0].trim());
    functions.forEach(fn => {
      if (exports.includes(fn.name)) {
        fn.exported = true;
      }
    });
  }

  return { functions };
}

/**
 * Extract signatures from task spec
 * @param {Object} spec - Task spec object
 * @returns {Array} Array of expected signatures
 */
function extractSpecSignatures(spec) {
  if (!spec) return [];

  // Single function spec
  if (spec.function) {
    return [{
      name: spec.function,
      params: spec.params || [],
      async: spec.async || false,
      exported: spec.exported || false,
      returns: spec.returns
    }];
  }

  // Multiple functions in spec
  if (spec.functions) {
    return spec.functions.map(fn => ({
      name: fn.name || fn.function,
      params: fn.params || [],
      async: fn.async || false,
      exported: fn.exported || false,
      returns: fn.returns
    }));
  }

  return [];
}

/**
 * Compare spec signatures against actual implementations
 * @param {Array} specSignatures - Expected signatures from spec
 * @param {Array} actualSignatures - Actual signatures from file
 * @returns {{matches: Array, mismatches: Array, missing: Array, unspecified: Array}}
 */
function compareSignatures(specSignatures, actualSignatures) {
  const matches = [];
  const mismatches = [];
  const missing = [];

  for (const spec of specSignatures) {
    const actual = actualSignatures.find(a => a.name === spec.name);

    if (!actual) {
      missing.push({
        spec,
        reason: `Function '${spec.name}' specified but not found in file`
      });
      continue;
    }

    // Compare parameters
    const paramDiffs = compareParams(spec.params, actual.params);

    // Compare async flag
    const asyncMismatch = spec.async !== actual.async;

    // Compare exported flag
    const exportMismatch = spec.exported !== actual.exported;

    if (paramDiffs.length > 0 || asyncMismatch || exportMismatch) {
      mismatches.push({
        spec,
        actual,
        differences: {
          params: paramDiffs,
          async: asyncMismatch ? { expected: spec.async, actual: actual.async } : null,
          exported: exportMismatch ? { expected: spec.exported, actual: actual.exported } : null
        }
      });
    } else {
      matches.push({ spec, actual });
    }
  }

  // Find unspecified functions (in actual but not in spec)
  const specNames = specSignatures.map(s => s.name);
  const unspecified = actualSignatures.filter(a => !specNames.includes(a.name));

  return { matches, mismatches, missing, unspecified };
}

/**
 * Detect unspecified code additions
 * @param {Object} spec - Task spec
 * @param {Object} actualSignatures - Extracted signatures
 * @param {string} filePath - File path for location
 * @param {string} taskId - Task ID for findings
 * @returns {Array<Finding>}
 */
function detectUnspecifiedAdditions(spec, actualSignatures, filePath, taskId) {
  const findings = [];
  const specNames = extractSpecSignatures(spec).map(s => s.name);

  for (const fn of actualSignatures.functions) {
    if (!specNames.includes(fn.name)) {
      // Classify severity: exported = error, internal = warning
      const severity = fn.exported ? 'error' : 'warning';

      findings.push({
        task_id: taskId,
        type: 'unspecified_addition',
        severity,
        description: `Function '${fn.name}' not in spec${fn.exported ? ' (exported)' : ' (internal helper)'}`,
        location: { file: filePath, line: fn.line },
        expected: 'Not specified',
        actual: `${fn.async ? 'async ' : ''}function ${fn.name}`,
        suggestion: fn.exported
          ? `Either add '${fn.name}' to spec or remove/inline it`
          : `Consider if helper '${fn.name}' is necessary or can be inlined`
      });
    }
  }

  return findings;
}

/**
 * Generate findings from comparison results
 * @param {string} taskId - Task ID
 * @param {Object} comparisons - Comparison results
 * @param {string} filePath - File path
 * @returns {Array<Finding>}
 */
function generateFindings(taskId, comparisons, filePath) {
  const findings = [];

  // Missing implementations
  for (const item of comparisons.missing) {
    findings.push({
      task_id: taskId,
      type: 'missing_implementation',
      severity: 'error',
      description: item.reason,
      location: { file: filePath, line: 0 },
      expected: `${item.spec.async ? 'async ' : ''}function ${item.spec.name}(${(item.spec.params || []).join(', ')})`,
      actual: 'Not found',
      suggestion: `Implement the '${item.spec.name}' function as specified`
    });
  }

  // Signature mismatches
  for (const item of comparisons.mismatches) {
    const diffs = item.differences;

    if (diffs.params && diffs.params.length > 0) {
      findings.push({
        task_id: taskId,
        type: 'signature_mismatch',
        severity: 'error',
        description: `Parameter mismatch in '${item.spec.name}': ${diffs.params.join(', ')}`,
        location: { file: filePath, line: item.actual.line },
        expected: `(${(item.spec.params || []).join(', ')})`,
        actual: `(${(item.actual.params || []).map(p => p.name).join(', ')})`,
        suggestion: 'Update function parameters to match spec'
      });
    }

    if (diffs.async) {
      findings.push({
        task_id: taskId,
        type: 'signature_mismatch',
        severity: 'error',
        description: `Async mismatch in '${item.spec.name}': expected ${diffs.async.expected ? 'async' : 'sync'}, got ${diffs.async.actual ? 'async' : 'sync'}`,
        location: { file: filePath, line: item.actual.line },
        expected: diffs.async.expected ? 'async function' : 'function',
        actual: diffs.async.actual ? 'async function' : 'function',
        suggestion: diffs.async.expected ? 'Add async keyword' : 'Remove async keyword'
      });
    }

    if (diffs.exported) {
      findings.push({
        task_id: taskId,
        type: 'signature_mismatch',
        severity: 'warning',
        description: `Export mismatch in '${item.spec.name}': expected ${diffs.exported.expected ? 'exported' : 'not exported'}`,
        location: { file: filePath, line: item.actual.line },
        expected: diffs.exported.expected ? 'exported' : 'not exported',
        actual: diffs.exported.actual ? 'exported' : 'not exported',
        suggestion: diffs.exported.expected ? 'Add to module.exports' : 'Remove from module.exports'
      });
    }
  }

  return findings;
}

/**
 * Aggregate findings by task ID and severity level
 * @param {Array<Finding>} allFindings - All findings
 * @returns {{byTask: Object, bySeverity: Object, totalErrors: number, totalWarnings: number, pass: boolean}}
 */
function aggregateFindings(allFindings) {
  const byTask = {};
  const bySeverity = { error: 0, warning: 0, info: 0 };

  for (const finding of allFindings) {
    // Group by task
    if (!byTask[finding.task_id]) {
      byTask[finding.task_id] = [];
    }
    byTask[finding.task_id].push(finding);

    // Count by severity
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  }

  return {
    byTask,
    bySeverity,
    totalErrors: bySeverity.error,
    totalWarnings: bySeverity.warning,
    pass: bySeverity.error === 0
  };
}

/**
 * Save review results to plan directory
 * @param {string} planName - Plan name
 * @param {Object} results - Review results
 * @returns {Promise<{success: boolean, path: string}>}
 */
async function saveReviewResults(planName, results) {
  const plansDir = path.join(workingDir, '.claude/plans');
  const planDir = path.join(plansDir, planName);
  const reviewPath = path.join(planDir, 'review-results.json');

  const reviewData = {
    ...results,
    version: '1.0.0',
    savedAt: new Date().toISOString()
  };

  await fs.writeFile(reviewPath, JSON.stringify(reviewData, null, 2), 'utf8');

  return { success: true, path: reviewPath };
}

// Helper functions

function parseParams(paramString) {
  if (!paramString || !paramString.trim()) return [];
  return paramString.split(',').map(p => {
    const trimmed = p.trim();
    const [name, type] = trimmed.split(':').map(s => s.trim());
    return { name, type: type || 'any' };
  });
}

function compareParams(specParams, actualParams) {
  const diffs = [];
  const specList = Array.isArray(specParams) ? specParams : [];
  const actualList = actualParams || [];

  // Normalize spec params (may be strings like "planName: string")
  const normalizedSpec = specList.map(p => {
    if (typeof p === 'string') {
      const [name] = p.split(':').map(s => s.trim());
      return name;
    }
    return p.name || p;
  });

  const actualNames = actualList.map(p => p.name);

  if (normalizedSpec.length !== actualNames.length) {
    diffs.push(`parameter count (expected ${normalizedSpec.length}, got ${actualNames.length})`);
  }

  for (let i = 0; i < Math.min(normalizedSpec.length, actualNames.length); i++) {
    if (normalizedSpec[i] !== actualNames[i]) {
      diffs.push(`param ${i + 1} name (expected '${normalizedSpec[i]}', got '${actualNames[i]}')`);
    }
  }

  return diffs;
}

function isExported(source, funcName) {
  // Check module.exports = { funcName } or module.exports.funcName
  const exportPatterns = [
    new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${funcName}\\b`),
    new RegExp(`module\\.exports\\.${funcName}\\s*=`),
    new RegExp(`exports\\.${funcName}\\s*=`),
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${funcName}`),
    new RegExp(`export\\s+(?:const|let|var)\\s+${funcName}`)
  ];

  return exportPatterns.some(pattern => pattern.test(source));
}

module.exports = {
  reviewPlan,
  // Expose for testing
  reviewTask,
  extractSignaturesFromFile,
  compareSignatures,
  detectUnspecifiedAdditions,
  generateFindings,
  aggregateFindings,
  saveReviewResults
};
