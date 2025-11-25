/**
 * Plan Update CLI Command
 *
 * Comprehensive command for updating plans with support for:
 * - Structured JSON operations (--operations)
 * - Natural language updates (--nl)
 * - Execution modes (--mode rollback|selective)
 * - Dry-run preview (--dry-run)
 * - Auto-confirm (--yes, --force)
 */

const fs = require('fs').promises;
const path = require('path');
const { parseUpdateRequest, parseMultipleRequests, describeOperation } = require('../../parsers/nl-update-parser');
const { executeUpdate } = require('../../operations/update-orchestrator');
const { generatePreview, generateCompactSummary } = require('../../ui/update-preview');
const { confirmOrAuto } = require('../../ui/update-confirmation');
const { formatValidationErrors, formatExecutionErrors, createError } = require('../../ui/error-reporter');
const planOps = require('./plan-ops');

// Get working directory from environment or use current
const workingDir = process.env.CLAUDE_WORKING_DIR || process.cwd();

/**
 * Get plans directory path
 */
function getPlansDirectory() {
  return path.join(workingDir, '.claude/plans');
}

/**
 * Parse CLI arguments for plan-update command
 * @param {Array<string>} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    planName: null,
    operationsFile: null,
    nlText: null,
    force: false,
    yes: false,
    dryRun: false,
    mode: 'rollback', // Default to rollback mode for safety
    verbose: false,
    noColor: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--operations' || arg === '-o') {
      parsed.operationsFile = args[++i];
    } else if (arg === '--nl' || arg === '-n') {
      // Collect all remaining text until next flag or end
      const nlParts = [];
      i++;
      while (i < args.length && !args[i].startsWith('-')) {
        nlParts.push(args[i]);
        i++;
      }
      parsed.nlText = nlParts.join(' ');
      i--; // Back up one since loop will increment
    } else if (arg === '--force' || arg === '-f') {
      parsed.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      parsed.yes = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      parsed.dryRun = true;
    } else if (arg === '--mode' || arg === '-m') {
      const mode = args[++i];
      if (!['rollback', 'selective'].includes(mode)) {
        throw new Error(`Invalid mode: ${mode}. Must be 'rollback' or 'selective'`);
      }
      parsed.mode = mode;
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--no-color') {
      parsed.noColor = true;
    } else if (!arg.startsWith('-') && !parsed.planName) {
      parsed.planName = arg;
    }

    i++;
  }

  return parsed;
}

/**
 * Show help message
 */
function showHelp() {
  return `
Plan Update Command
===================

Update plan metadata, phases, and tasks using structured operations or natural language.

Usage:
  session-cli plan-update <plan-name> [options]

Arguments:
  <plan-name>              Name of the plan to update

Options:
  -o, --operations <file>  JSON file containing update operations
  -n, --nl <text>          Natural language update request
  -m, --mode <mode>        Execution mode: 'rollback' (default) or 'selective'
                           - rollback: All-or-nothing, rollback on any failure
                           - selective: Continue on errors, partial updates allowed
  -d, --dry-run            Preview changes without executing
  -y, --yes                Auto-confirm without prompting
  -f, --force              Force update (implies --yes, overrides safety checks)
  -v, --verbose            Show detailed output
  --no-color               Disable colored output
  -h, --help               Show this help message

Examples:
  # Update using natural language
  session-cli plan-update my-plan --nl "rename phase-1 to 'Setup & Configuration'"

  # Update using operations file
  session-cli plan-update my-plan --operations updates.json

  # Preview changes without applying
  session-cli plan-update my-plan --nl "add task 'Write tests' to phase-2" --dry-run

  # Force update completed tasks
  session-cli plan-update my-plan --nl "mark task-2-1 as pending --force"

  # Use selective mode (continue on errors)
  session-cli plan-update my-plan --operations updates.json --mode selective

Operations File Format:
  {
    "operations": [
      {
        "type": "update",
        "target": "phase",
        "data": {
          "id": "phase-1",
          "name": "New Phase Name"
        }
      },
      {
        "type": "add",
        "target": "task",
        "data": {
          "phaseId": "phase-2",
          "description": "New task description",
          "details": "Task details here"
        }
      }
    ]
  }

Supported Operations:
  - Update plan metadata (name, description, status)
  - Add/update/delete phases
  - Add/update/delete tasks
  - Reorder phases and tasks

Natural Language Examples:
  - "rename phase 'Setup' to 'Initial Configuration'"
  - "add a new task 'Write unit tests' to the Testing phase"
  - "mark task-3-2 as completed"
  - "delete task-1-4"
  - "change plan description to 'Updated project plan'"
`;
}

/**
 * Build plan context for NL parser
 * @param {Object} plan - Plan data with phases loaded
 * @returns {Object} Plan context
 */
async function buildPlanContext(planName) {
  const plansDir = getPlansDirectory();
  const planDir = path.join(plansDir, planName);

  // Read orchestration
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  let orchestration;
  try {
    const content = await fs.readFile(orchestrationPath, 'utf-8');
    orchestration = JSON.parse(content);
  } catch (error) {
    throw new Error(`Plan '${planName}' not found or invalid`);
  }

  // Build context
  const context = {
    planId: planName,
    phases: orchestration.phases.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status
    })),
    tasksByPhase: {},
    metadata: orchestration.metadata
  };

  // Load tasks from each phase file
  for (const phaseMeta of orchestration.phases) {
    const phaseFilePath = path.join(planDir, phaseMeta.file);
    try {
      const phaseContent = await fs.readFile(phaseFilePath, 'utf-8');
      const phaseData = JSON.parse(phaseContent);
      context.tasksByPhase[phaseMeta.id] = phaseData.tasks || [];
    } catch (error) {
      console.warn(`Warning: Could not load phase ${phaseMeta.id}`);
      context.tasksByPhase[phaseMeta.id] = [];
    }
  }

  return context;
}

/**
 * Load current plan state for preview
 * @param {string} planName - Plan name
 * @returns {Object} Current state
 */
async function loadCurrentState(planName) {
  const context = await buildPlanContext(planName);
  const plansDir = getPlansDirectory();
  const planDir = path.join(plansDir, planName);

  // Load execution state if exists
  let executionState = null;
  try {
    const execPath = path.join(planDir, 'execution-state.json');
    const execContent = await fs.readFile(execPath, 'utf-8');
    executionState = JSON.parse(execContent);
  } catch (error) {
    // No execution state yet
  }

  return {
    planId: planName,
    phases: context.phases,
    tasksByPhase: context.tasksByPhase,
    metadata: context.metadata,
    executionState
  };
}

/**
 * Load operations from JSON file
 * @param {string} filePath - Path to operations file
 * @returns {Array<Object>} Operations
 */
async function loadOperationsFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.operations || !Array.isArray(data.operations)) {
      throw new Error('Operations file must contain an "operations" array');
    }

    return data.operations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Operations file not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in operations file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Format execution report for output
 * @param {Object} report - Execution report
 * @param {boolean} verbose - Verbose output
 * @param {boolean} noColor - Disable colors
 * @returns {Object} Formatted result
 */
function formatResult(report, verbose, noColor = false) {
  // Print detailed error report to stderr if there are errors
  if (!report.success) {
    const formattedErrors = formatExecutionErrors(report, {
      color: !noColor,
      verbose,
      format: 'terminal'
    });
    console.error(formattedErrors);
  }

  // Return JSON result
  const result = {
    success: report.success,
    message: report.message || report.error
  };

  if (report.success) {
    result.data = {
      completed: report.completed.length,
      failed: report.failed.length
    };

    if (verbose && report.completed.length > 0) {
      result.data.operations = report.completed.map(c => ({
        type: c.operation.type,
        target: c.operation.target,
        result: c.result?.message || 'Success'
      }));
    }
  } else {
    // Include structured error data for programmatic use
    result.error = formatExecutionErrors(report, {
      verbose,
      format: 'json'
    });

    if (report.rollback) {
      result.rollback = report.rollback;
    }
  }

  return result;
}

/**
 * Main plan-update command handler
 * @param {Array<string>} args - Command arguments
 * @returns {Promise<Object>} Command result
 */
async function planUpdate(args) {
  // Parse arguments
  const parsed = parseArgs(args);

  // Show help if requested
  if (parsed.help) {
    console.log(showHelp());
    return { success: true };
  }

  // Validate required arguments
  if (!parsed.planName) {
    return {
      success: false,
      error: {
        code: 'MISSING_PLAN_NAME',
        message: 'Plan name is required',
        suggestion: 'Usage: session-cli plan-update <plan-name> [options]'
      }
    };
  }

  if (!parsed.operationsFile && !parsed.nlText) {
    return {
      success: false,
      error: {
        code: 'MISSING_OPERATIONS',
        message: 'Either --operations or --nl is required',
        suggestion: 'Use --nl "your update request" or --operations <file.json>'
      }
    };
  }

  try {
    // Check if plan exists
    const existsResult = await planOps.planExists(parsed.planName);
    if (!existsResult.data.exists) {
      return {
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: `Plan '${parsed.planName}' not found`,
          suggestion: 'Use list-plans command to see available plans'
        }
      };
    }

    // Build plan context
    const planContext = await buildPlanContext(parsed.planName);

    // Parse operations
    let operations = [];

    if (parsed.operationsFile) {
      // Load from file
      operations = await loadOperationsFromFile(parsed.operationsFile);
    } else if (parsed.nlText) {
      // Parse natural language
      const parseResult = parseMultipleRequests(parsed.nlText, planContext);

      if (!parseResult.success) {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: parseResult.error,
            suggestion: 'Try rephrasing your request or use --operations with a JSON file'
          }
        };
      }

      operations = parseResult.operations;

      if (parseResult.warnings.length > 0) {
        console.warn('Warnings:');
        parseResult.warnings.forEach(w => console.warn(`  - ${w}`));
      }
    }

    if (operations.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_OPERATIONS',
          message: 'No valid operations to execute',
          suggestion: 'Check your input and try again'
        }
      };
    }

    // Load current state for preview
    const currentState = await loadCurrentState(parsed.planName);

    // Generate preview
    const preview = generatePreview(currentState, operations, {
      color: !parsed.noColor,
      verbose: parsed.verbose
    });

    // Show preview
    console.log(preview.text);

    // Check for dry-run
    if (parsed.dryRun) {
      return {
        success: true,
        message: 'Dry run completed - no changes applied',
        data: {
          operations: operations.length,
          summary: generateCompactSummary(operations),
          warnings: preview.warnings
        }
      };
    }

    // Get confirmation (unless --yes or --force)
    const confirmation = await confirmOrAuto(currentState, operations, {
      yes: parsed.yes || parsed.force,
      force: parsed.force,
      color: !parsed.noColor
    });

    if (!confirmation.confirmed) {
      return {
        success: false,
        cancelled: true,
        message: confirmation.reason || 'Update cancelled by user'
      };
    }

    // Use possibly edited operations
    const finalOperations = confirmation.operations || operations;

    // Execute update
    const plansDir = getPlansDirectory();
    const planDir = path.join(plansDir, parsed.planName);

    const report = await executeUpdate(planDir, finalOperations, {
      dryRun: false,
      stopOnError: parsed.mode === 'rollback'
    });

    // Format and return result
    return formatResult(report, parsed.verbose, parsed.noColor);

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message,
        stack: process.env.DEBUG ? error.stack : undefined
      }
    };
  }
}

module.exports = planUpdate;
module.exports.parseArgs = parseArgs;
module.exports.showHelp = showHelp;
module.exports.buildPlanContext = buildPlanContext;
module.exports.loadCurrentState = loadCurrentState;
module.exports.loadOperationsFromFile = loadOperationsFromFile;
