/**
 * Comprehensive Error Reporter
 *
 * Formats validation, update, and execution errors with:
 * - Error codes
 * - Clear messages
 * - Suggested fixes
 * - Relevant file paths
 * - Both terminal and JSON output formats
 */

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m'
};

/**
 * Error code definitions with messages and suggestions
 */
const ERROR_CODES = {
  // Validation errors (V1xx)
  V100: {
    name: 'SCHEMA_VALIDATION_FAILED',
    message: 'Schema validation failed',
    suggestion: 'Check that all required fields are present and have correct types'
  },
  V101: {
    name: 'INVALID_OPERATION_TYPE',
    message: 'Invalid operation type',
    suggestion: 'Use one of: add, update, delete'
  },
  V102: {
    name: 'INVALID_TARGET_TYPE',
    message: 'Invalid target type',
    suggestion: 'Use one of: metadata, phase, task'
  },
  V103: {
    name: 'MISSING_REQUIRED_FIELD',
    message: 'Missing required field',
    suggestion: 'Ensure all required fields are provided in the operation data'
  },
  V104: {
    name: 'INVALID_FIELD_VALUE',
    message: 'Invalid field value',
    suggestion: 'Check that field values match expected types and constraints'
  },
  V105: {
    name: 'INVALID_ID_FORMAT',
    message: 'Invalid ID format',
    suggestion: 'IDs should match pattern: phase-N or task-N-M'
  },
  V106: {
    name: 'DUPLICATE_ID',
    message: 'Duplicate ID detected',
    suggestion: 'Each phase and task must have a unique ID'
  },
  V107: {
    name: 'INVALID_STATUS',
    message: 'Invalid status value',
    suggestion: 'Use one of: pending, in_progress, completed, blocked, failed'
  },
  V108: {
    name: 'CIRCULAR_DEPENDENCY',
    message: 'Circular dependency detected',
    suggestion: 'Remove the circular reference in task dependencies'
  },
  V109: {
    name: 'MISSING_DEPENDENCY',
    message: 'Referenced dependency not found',
    suggestion: 'Ensure all referenced dependencies exist in the plan'
  },

  // Update errors (U2xx)
  U200: {
    name: 'UPDATE_FAILED',
    message: 'Update operation failed',
    suggestion: 'Check the operation details and try again'
  },
  U201: {
    name: 'PHASE_NOT_FOUND',
    message: 'Phase not found',
    suggestion: 'Verify the phase ID exists in the plan'
  },
  U202: {
    name: 'TASK_NOT_FOUND',
    message: 'Task not found',
    suggestion: 'Verify the task ID exists in the specified phase'
  },
  U203: {
    name: 'CANNOT_DELETE_COMPLETED',
    message: 'Cannot delete completed item',
    suggestion: 'Use --force flag to delete completed items'
  },
  U204: {
    name: 'CANNOT_MODIFY_IN_PROGRESS',
    message: 'Cannot modify in-progress task',
    suggestion: 'Complete or reset the task before modifying'
  },
  U205: {
    name: 'PHASE_HAS_TASKS',
    message: 'Cannot delete phase with tasks',
    suggestion: 'Delete or move all tasks first, or use --force flag'
  },
  U206: {
    name: 'INVALID_POSITION',
    message: 'Invalid insert position',
    suggestion: 'Position must be between 0 and the current count'
  },
  U207: {
    name: 'METADATA_UPDATE_RESTRICTED',
    message: 'Some metadata fields cannot be modified',
    suggestion: 'Only name, description, and status can be updated'
  },

  // Execution errors (E3xx)
  E300: {
    name: 'EXECUTION_FAILED',
    message: 'Execution failed',
    suggestion: 'Check the error details and try again'
  },
  E301: {
    name: 'BACKUP_FAILED',
    message: 'Failed to create backup',
    suggestion: 'Check disk space and file permissions'
  },
  E302: {
    name: 'ROLLBACK_FAILED',
    message: 'Rollback failed',
    suggestion: 'Manual recovery may be required from backup'
  },
  E303: {
    name: 'FILE_WRITE_ERROR',
    message: 'Failed to write file',
    suggestion: 'Check disk space and file permissions'
  },
  E304: {
    name: 'FILE_READ_ERROR',
    message: 'Failed to read file',
    suggestion: 'Check that the file exists and is readable'
  },
  E305: {
    name: 'PARSE_ERROR',
    message: 'Failed to parse file',
    suggestion: 'Check that the file contains valid JSON'
  },
  E306: {
    name: 'PLAN_NOT_FOUND',
    message: 'Plan not found',
    suggestion: 'Use list-plans to see available plans'
  },
  E307: {
    name: 'PARTIAL_EXECUTION',
    message: 'Some operations failed',
    suggestion: 'Review failed operations and retry or use rollback mode'
  },
  E308: {
    name: 'LOCK_TIMEOUT',
    message: 'Could not acquire lock',
    suggestion: 'Another process may be modifying the plan. Wait and retry.'
  },

  // Parse errors (P4xx)
  P400: {
    name: 'NL_PARSE_FAILED',
    message: 'Failed to parse natural language input',
    suggestion: 'Try rephrasing your request or use structured JSON operations'
  },
  P401: {
    name: 'AMBIGUOUS_TARGET',
    message: 'Ambiguous target reference',
    suggestion: 'Specify the exact phase or task ID'
  },
  P402: {
    name: 'UNKNOWN_OPERATION',
    message: 'Could not determine operation type',
    suggestion: 'Use words like: add, remove, update, change, delete'
  },
  P403: {
    name: 'UNKNOWN_TARGET',
    message: 'Could not determine target type',
    suggestion: 'Specify: phase, task, or plan metadata'
  }
};

/**
 * @typedef {Object} FormattedError
 * @property {string} code - Error code
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} suggestion - Suggested fix
 * @property {string} [path] - Relevant file path
 * @property {Object} [details] - Additional details
 * @property {string} [context] - Context where error occurred
 */

/**
 * @typedef {Object} FormatOptions
 * @property {boolean} [color=true] - Use ANSI colors
 * @property {boolean} [verbose=false] - Include stack traces
 * @property {'terminal'|'json'} [format='terminal'] - Output format
 * @property {number} [maxWidth=80] - Max line width for terminal
 */

/**
 * Formats validation errors for display
 * @param {Array<Object>} errors - Validation errors
 * @param {FormatOptions} options - Formatting options
 * @returns {string|Object} Formatted output
 */
function formatValidationErrors(errors, options = {}) {
  const { color = true, format = 'terminal', verbose = false } = options;

  if (format === 'json') {
    return formatValidationErrorsJSON(errors, verbose);
  }

  return formatValidationErrorsTerminal(errors, color, verbose);
}

/**
 * Formats validation errors as JSON
 * @param {Array<Object>} errors - Validation errors
 * @param {boolean} verbose - Include additional details
 * @returns {Object} JSON structure
 */
function formatValidationErrorsJSON(errors, verbose) {
  return {
    type: 'validation_errors',
    count: errors.length,
    errors: errors.map((err, index) => {
      const errorInfo = lookupErrorCode(err.code) || ERROR_CODES.V100;
      return {
        index,
        code: err.code || 'V100',
        name: errorInfo.name,
        message: err.message || errorInfo.message,
        suggestion: errorInfo.suggestion,
        field: err.field,
        value: verbose ? err.value : undefined,
        path: err.path,
        details: verbose ? err.details : undefined
      };
    })
  };
}

/**
 * Formats validation errors for terminal
 * @param {Array<Object>} errors - Validation errors
 * @param {boolean} useColor - Use colors
 * @param {boolean} verbose - Verbose output
 * @returns {string} Formatted string
 */
function formatValidationErrorsTerminal(errors, useColor, verbose) {
  const lines = [];

  lines.push(formatHeader('Validation Errors', errors.length, useColor));
  lines.push('');

  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    const errorInfo = lookupErrorCode(err.code) || ERROR_CODES.V100;

    lines.push(formatErrorBlock({
      index: i + 1,
      code: err.code || 'V100',
      name: errorInfo.name,
      message: err.message || errorInfo.message,
      suggestion: errorInfo.suggestion,
      field: err.field,
      path: err.path,
      details: verbose ? err.details : null
    }, useColor));
    lines.push('');
  }

  lines.push(formatSuggestionBox('Fix the validation errors above before proceeding.', useColor));

  return lines.join('\n');
}

/**
 * Formats update errors for display
 * @param {Array<Object>} errors - Update errors
 * @param {FormatOptions} options - Formatting options
 * @returns {string|Object} Formatted output
 */
function formatUpdateErrors(errors, options = {}) {
  const { color = true, format = 'terminal', verbose = false } = options;

  if (format === 'json') {
    return formatUpdateErrorsJSON(errors, verbose);
  }

  return formatUpdateErrorsTerminal(errors, color, verbose);
}

/**
 * Formats update errors as JSON
 * @param {Array<Object>} errors - Update errors
 * @param {boolean} verbose - Include additional details
 * @returns {Object} JSON structure
 */
function formatUpdateErrorsJSON(errors, verbose) {
  return {
    type: 'update_errors',
    count: errors.length,
    errors: errors.map((err, index) => {
      const errorInfo = lookupErrorCode(err.code) || ERROR_CODES.U200;
      return {
        index,
        code: err.code || 'U200',
        name: errorInfo.name,
        message: err.message || errorInfo.message,
        suggestion: errorInfo.suggestion,
        operation: err.operation ? {
          type: err.operation.type,
          target: err.operation.target,
          id: err.operation.data?.id
        } : undefined,
        path: err.path,
        details: verbose ? err.details : undefined
      };
    })
  };
}

/**
 * Formats update errors for terminal
 * @param {Array<Object>} errors - Update errors
 * @param {boolean} useColor - Use colors
 * @param {boolean} verbose - Verbose output
 * @returns {string} Formatted string
 */
function formatUpdateErrorsTerminal(errors, useColor, verbose) {
  const lines = [];

  lines.push(formatHeader('Update Errors', errors.length, useColor));
  lines.push('');

  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    const errorInfo = lookupErrorCode(err.code) || ERROR_CODES.U200;

    // Format operation context
    let context = null;
    if (err.operation) {
      context = `${err.operation.type.toUpperCase()} ${err.operation.target}`;
      if (err.operation.data?.id) {
        context += `: ${err.operation.data.id}`;
      }
    }

    lines.push(formatErrorBlock({
      index: i + 1,
      code: err.code || 'U200',
      name: errorInfo.name,
      message: err.message || errorInfo.message,
      suggestion: errorInfo.suggestion,
      context,
      path: err.path,
      details: verbose ? err.details : null
    }, useColor));
    lines.push('');
  }

  // Add recovery suggestions
  const hasCompletedErrors = errors.some(e => e.code === 'U203' || e.code === 'U204');
  if (hasCompletedErrors) {
    lines.push(formatSuggestionBox('Use --force flag to modify completed or in-progress items.', useColor));
  }

  return lines.join('\n');
}

/**
 * Formats execution errors for display
 * @param {Object} report - Execution report with errors
 * @param {FormatOptions} options - Formatting options
 * @returns {string|Object} Formatted output
 */
function formatExecutionErrors(report, options = {}) {
  const { color = true, format = 'terminal', verbose = false } = options;

  if (format === 'json') {
    return formatExecutionErrorsJSON(report, verbose);
  }

  return formatExecutionErrorsTerminal(report, color, verbose);
}

/**
 * Formats execution errors as JSON
 * @param {Object} report - Execution report
 * @param {boolean} verbose - Include additional details
 * @returns {Object} JSON structure
 */
function formatExecutionErrorsJSON(report, verbose) {
  const result = {
    type: 'execution_errors',
    success: report.success,
    summary: {
      total: (report.completed?.length || 0) + (report.failed?.length || 0),
      completed: report.completed?.length || 0,
      failed: report.failed?.length || 0
    },
    error: report.error,
    rollback: report.rollback,
    backupPath: verbose ? report.backupPath : undefined
  };

  if (report.validationErrors?.length > 0) {
    result.validationErrors = report.validationErrors.map(err => ({
      index: err.index,
      code: err.code,
      error: err.error,
      operation: err.operation ? {
        type: err.operation.type,
        target: err.operation.target
      } : undefined
    }));
  }

  if (report.failed?.length > 0) {
    result.failedOperations = report.failed.map(f => ({
      index: f.index,
      error: f.error,
      operation: f.operation ? {
        type: f.operation.type,
        target: f.operation.target,
        id: f.operation.data?.id
      } : undefined
    }));
  }

  if (verbose && report.completed?.length > 0) {
    result.completedOperations = report.completed.map(c => ({
      index: c.index,
      operation: {
        type: c.operation.type,
        target: c.operation.target,
        id: c.operation.data?.id
      }
    }));
  }

  return result;
}

/**
 * Formats execution errors for terminal
 * @param {Object} report - Execution report
 * @param {boolean} useColor - Use colors
 * @param {boolean} verbose - Verbose output
 * @returns {string} Formatted string
 */
function formatExecutionErrorsTerminal(report, useColor, verbose) {
  const lines = [];

  const totalOps = (report.completed?.length || 0) + (report.failed?.length || 0);
  const failedCount = report.failed?.length || 0;

  lines.push(formatHeader('Execution Report', null, useColor, report.success ? 'green' : 'red'));
  lines.push('');

  // Summary
  lines.push(colorize('Summary:', 'bold', useColor));
  lines.push(`  Total Operations: ${totalOps}`);
  lines.push(`  ${colorize('Completed:', 'green', useColor)} ${report.completed?.length || 0}`);
  lines.push(`  ${colorize('Failed:', 'red', useColor)} ${failedCount}`);
  lines.push('');

  // Main error message
  if (report.error) {
    lines.push(colorize('Error:', 'red', useColor));
    lines.push(`  ${report.error}`);
    lines.push('');
  }

  // Validation errors
  if (report.validationErrors?.length > 0) {
    lines.push(colorize('Validation Errors:', 'yellow', useColor));
    for (const err of report.validationErrors) {
      lines.push(`  [${err.index}] ${err.error}`);
      if (err.code) {
        const info = lookupErrorCode(err.code);
        if (info) {
          lines.push(`      ${colorize('Suggestion:', 'dim', useColor)} ${info.suggestion}`);
        }
      }
    }
    lines.push('');
  }

  // Failed operations
  if (report.failed?.length > 0) {
    lines.push(colorize('Failed Operations:', 'red', useColor));
    for (const f of report.failed) {
      const opDesc = f.operation
        ? `${f.operation.type.toUpperCase()} ${f.operation.target}${f.operation.data?.id ? ': ' + f.operation.data.id : ''}`
        : 'Unknown operation';
      lines.push(`  ${colorize('[' + f.index + ']', 'dim', useColor)} ${opDesc}`);
      lines.push(`      ${colorize('Error:', 'red', useColor)} ${f.error}`);
    }
    lines.push('');
  }

  // Rollback status
  if (report.rollback) {
    if (report.rollback.performed) {
      lines.push(colorize('Rollback:', 'yellow', useColor));
      lines.push(`  Changes have been rolled back to backup.`);
      if (verbose && report.rollback.backupRestored) {
        lines.push(`  Backup: ${report.rollback.backupRestored}`);
      }
    } else if (report.rollback.error) {
      lines.push(colorize('Rollback Failed:', 'red', useColor));
      lines.push(`  ${report.rollback.error}`);
      lines.push(`  ${colorize('Manual recovery may be required!', 'bgRed', useColor)}`);
    }
    lines.push('');
  }

  // Backup path (verbose only)
  if (verbose && report.backupPath) {
    lines.push(colorize('Backup Location:', 'dim', useColor));
    lines.push(`  ${report.backupPath}`);
    lines.push('');
  }

  // Completed operations (verbose only)
  if (verbose && report.completed?.length > 0) {
    lines.push(colorize('Completed Operations:', 'green', useColor));
    for (const c of report.completed) {
      const opDesc = c.operation
        ? `${c.operation.type.toUpperCase()} ${c.operation.target}${c.operation.data?.id ? ': ' + c.operation.data.id : ''}`
        : 'Unknown operation';
      lines.push(`  ${colorize('[' + c.index + ']', 'dim', useColor)} ${opDesc}`);
    }
    lines.push('');
  }

  // Recovery suggestions
  if (!report.success) {
    const suggestions = generateRecoverySuggestions(report);
    if (suggestions.length > 0) {
      lines.push(formatSuggestionBox(suggestions.join('\n'), useColor));
    }
  }

  return lines.join('\n');
}

/**
 * Looks up error code information
 * @param {string} code - Error code
 * @returns {Object|null} Error info or null
 */
function lookupErrorCode(code) {
  if (!code) return null;
  return ERROR_CODES[code] || null;
}

/**
 * Generates recovery suggestions based on error report
 * @param {Object} report - Execution report
 * @returns {Array<string>} Suggestions
 */
function generateRecoverySuggestions(report) {
  const suggestions = [];

  if (report.validationErrors?.length > 0) {
    suggestions.push('Fix validation errors and retry the operation.');
  }

  if (report.failed?.some(f => f.error?.includes('not found'))) {
    suggestions.push('Verify that all referenced IDs exist in the plan.');
  }

  if (report.failed?.some(f => f.error?.includes('completed') || f.error?.includes('in_progress'))) {
    suggestions.push('Use --force flag to modify completed or in-progress items.');
  }

  if (report.rollback?.error) {
    suggestions.push('Check the backup directory for manual recovery.');
  }

  if (suggestions.length === 0 && !report.success) {
    suggestions.push('Review the error details above and try again.');
  }

  return suggestions;
}

/**
 * Formats a header line
 * @param {string} title - Header title
 * @param {number|null} count - Optional count
 * @param {boolean} useColor - Use colors
 * @param {string} color - Header color
 * @returns {string} Formatted header
 */
function formatHeader(title, count, useColor, color = 'red') {
  const countStr = count !== null ? ` (${count})` : '';
  const text = `${title}${countStr}`;
  const line = '═'.repeat(text.length + 4);

  return [
    colorize(`╔${line}╗`, color, useColor),
    colorize(`║  ${text}  ║`, color, useColor),
    colorize(`╚${line}╝`, color, useColor)
  ].join('\n');
}

/**
 * Formats a single error block
 * @param {Object} error - Error details
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted error block
 */
function formatErrorBlock(error, useColor) {
  const lines = [];

  // Error header with code
  const codeDisplay = colorize(`[${error.code}]`, 'red', useColor);
  const nameDisplay = colorize(error.name, 'bold', useColor);
  lines.push(`${codeDisplay} ${nameDisplay}`);

  // Index if provided
  if (error.index !== undefined) {
    lines.push(`  ${colorize('Operation:', 'dim', useColor)} #${error.index}`);
  }

  // Context if provided
  if (error.context) {
    lines.push(`  ${colorize('Context:', 'dim', useColor)} ${error.context}`);
  }

  // Message
  lines.push(`  ${colorize('Message:', 'dim', useColor)} ${error.message}`);

  // Field if provided
  if (error.field) {
    lines.push(`  ${colorize('Field:', 'dim', useColor)} ${error.field}`);
  }

  // Path if provided
  if (error.path) {
    lines.push(`  ${colorize('File:', 'dim', useColor)} ${error.path}`);
  }

  // Suggestion
  lines.push(`  ${colorize('Fix:', 'cyan', useColor)} ${error.suggestion}`);

  // Details if provided
  if (error.details) {
    lines.push(`  ${colorize('Details:', 'dim', useColor)}`);
    const detailStr = typeof error.details === 'string'
      ? error.details
      : JSON.stringify(error.details, null, 2);
    detailStr.split('\n').forEach(line => {
      lines.push(`    ${line}`);
    });
  }

  return lines.join('\n');
}

/**
 * Formats a suggestion box
 * @param {string} text - Suggestion text
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted suggestion box
 */
function formatSuggestionBox(text, useColor) {
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length));
  const border = '─'.repeat(maxLen + 4);

  const result = [
    colorize(`┌${border}┐`, 'cyan', useColor),
    colorize(`│  ${colorize('Suggestion:', 'bold', useColor)}${' '.repeat(maxLen - 9)}  │`, 'cyan', useColor)
  ];

  for (const line of lines) {
    const padding = ' '.repeat(maxLen - line.length);
    result.push(colorize(`│  ${line}${padding}  │`, 'cyan', useColor));
  }

  result.push(colorize(`└${border}┘`, 'cyan', useColor));

  return result.join('\n');
}

/**
 * Applies color to text
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @param {boolean} useColor - Whether to apply color
 * @returns {string} Colorized text
 */
function colorize(text, color, useColor) {
  if (!useColor) return text;
  const colorCode = COLORS[color] || '';
  return colorCode ? `${colorCode}${text}${COLORS.reset}` : text;
}

/**
 * Creates a formatted error object for CLI output
 * @param {string} code - Error code
 * @param {Object} context - Additional context
 * @returns {Object} Formatted error
 */
function createError(code, context = {}) {
  const info = ERROR_CODES[code] || {
    name: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    suggestion: 'Check the error details'
  };

  return {
    success: false,
    error: {
      code,
      name: info.name,
      message: context.message || info.message,
      suggestion: info.suggestion,
      ...context
    }
  };
}

/**
 * Formats a simple error message for quick display
 * @param {string} code - Error code
 * @param {string} message - Custom message
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted message
 */
function formatSimpleError(code, message, useColor = true) {
  const info = ERROR_CODES[code];
  const codeDisplay = colorize(`[${code}]`, 'red', useColor);
  const msgDisplay = message || (info ? info.message : 'Unknown error');

  return `${codeDisplay} ${msgDisplay}`;
}

/**
 * Gets all error codes for documentation
 * @returns {Object} All error codes
 */
function getAllErrorCodes() {
  return { ...ERROR_CODES };
}

module.exports = {
  formatValidationErrors,
  formatUpdateErrors,
  formatExecutionErrors,
  createError,
  formatSimpleError,
  lookupErrorCode,
  getAllErrorCodes,
  ERROR_CODES,
  // Export internal formatters for testing
  formatErrorBlock,
  formatHeader,
  formatSuggestionBox,
  colorize
};
