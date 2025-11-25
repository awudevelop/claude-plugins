/**
 * Update Preview Generator
 * Generates human-readable previews of plan update operations
 */

/**
 * @typedef {Object} PreviewOptions
 * @property {boolean} [color=true] - Use ANSI colors in output
 * @property {boolean} [verbose=false] - Show detailed information
 * @property {number} [maxWidth=80] - Maximum line width
 */

/**
 * @typedef {Object} PreviewResult
 * @property {string} text - Formatted preview text
 * @property {Object} summary - Summary statistics
 * @property {Array<string>} warnings - Warning messages
 * @property {Array<string>} errors - Error messages
 */

// ANSI color codes for terminal output
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
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

/**
 * Generates a preview of update operations
 * @param {Object} currentState - Current plan state
 * @param {Array<Object>} operations - Update operations to preview
 * @param {PreviewOptions} options - Preview options
 * @returns {PreviewResult} Preview result
 */
function generatePreview(currentState, operations, options = {}) {
  const useColor = options.color !== false;
  const verbose = options.verbose || false;
  const maxWidth = options.maxWidth || 80;

  const result = {
    text: '',
    summary: {
      totalOperations: operations.length,
      additions: 0,
      updates: 0,
      deletions: 0,
      affectedPhases: new Set(),
      affectedTasks: new Set()
    },
    warnings: [],
    errors: []
  };

  const lines = [];

  // Header
  lines.push(formatHeader('Update Preview', useColor));
  lines.push('');

  // Operations summary
  for (const op of operations) {
    if (op.type === 'add') result.summary.additions++;
    else if (op.type === 'update') result.summary.updates++;
    else if (op.type === 'delete') result.summary.deletions++;

    if (op.target === 'phase') {
      result.summary.affectedPhases.add(op.data.id || op.data.name || 'new');
    } else if (op.target === 'task') {
      result.summary.affectedTasks.add(op.data.id || op.data.description || 'new');
    }
  }

  // Summary section
  lines.push(formatSectionHeader('Summary', useColor));
  lines.push(`  Operations: ${operations.length}`);
  lines.push(`    ${colorize('+ Additions:', 'green', useColor)} ${result.summary.additions}`);
  lines.push(`    ${colorize('~ Updates:', 'yellow', useColor)} ${result.summary.updates}`);
  lines.push(`    ${colorize('- Deletions:', 'red', useColor)} ${result.summary.deletions}`);
  lines.push('');

  // Detailed operations
  lines.push(formatSectionHeader('Operations', useColor));

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const opLines = formatOperation(op, currentState, i + 1, useColor, verbose);
    lines.push(...opLines);

    // Check for warnings
    const opWarnings = checkOperationWarnings(op, currentState);
    result.warnings.push(...opWarnings);
  }

  // Before/After comparison
  if (verbose && operations.length > 0) {
    lines.push('');
    lines.push(formatSectionHeader('Impact Analysis', useColor));
    const impactLines = generateImpactAnalysis(currentState, operations, useColor);
    lines.push(...impactLines);
  }

  // Warnings section
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push(formatSectionHeader('Warnings', useColor));
    for (const warning of result.warnings) {
      lines.push(`  ${colorize('⚠', 'yellow', useColor)}  ${warning}`);
    }
  }

  // Safety warnings for destructive operations
  const safetyWarnings = generateSafetyWarnings(operations, currentState, useColor);
  if (safetyWarnings.length > 0) {
    lines.push('');
    lines.push(formatSectionHeader('Safety Notices', useColor));
    lines.push(...safetyWarnings);
  }

  // Footer
  lines.push('');
  lines.push(formatDivider(maxWidth, useColor));

  result.text = lines.join('\n');
  return result;
}

/**
 * Formats a header
 * @param {string} text - Header text
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted header
 */
function formatHeader(text, useColor) {
  const line = '═'.repeat(text.length + 4);
  const header = [
    colorize(`╔${line}╗`, 'cyan', useColor),
    colorize(`║  ${text}  ║`, 'cyan', useColor),
    colorize(`╚${line}╝`, 'cyan', useColor)
  ];
  return header.join('\n');
}

/**
 * Formats a section header
 * @param {string} text - Section title
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted section header
 */
function formatSectionHeader(text, useColor) {
  return colorize(`─── ${text} ${'─'.repeat(Math.max(0, 60 - text.length))}`, 'dim', useColor);
}

/**
 * Formats a divider line
 * @param {number} width - Line width
 * @param {boolean} useColor - Use colors
 * @returns {string} Formatted divider
 */
function formatDivider(width, useColor) {
  return colorize('─'.repeat(width), 'dim', useColor);
}

/**
 * Formats a single operation
 * @param {Object} op - Operation to format
 * @param {Object} currentState - Current plan state
 * @param {number} index - Operation index
 * @param {boolean} useColor - Use colors
 * @param {boolean} verbose - Verbose output
 * @returns {Array<string>} Formatted lines
 */
function formatOperation(op, currentState, index, useColor, verbose) {
  const lines = [];
  const { type, target, data } = op;

  // Operation type indicator and color
  const typeIndicator = {
    add: { symbol: '+', color: 'green', verb: 'ADD' },
    update: { symbol: '~', color: 'yellow', verb: 'UPDATE' },
    delete: { symbol: '-', color: 'red', verb: 'DELETE' }
  }[type] || { symbol: '?', color: 'white', verb: type.toUpperCase() };

  // Format main operation line
  const symbol = colorize(typeIndicator.symbol, typeIndicator.color, useColor);
  const verb = colorize(typeIndicator.verb, typeIndicator.color, useColor);
  const targetName = formatTargetName(target, data);

  lines.push(`  ${symbol} [${index}] ${verb} ${target}: ${targetName}`);

  // Show details based on operation type
  if (type === 'add') {
    lines.push(...formatAddDetails(target, data, useColor));
  } else if (type === 'update') {
    lines.push(...formatUpdateDetails(target, data, currentState, useColor, verbose));
  } else if (type === 'delete') {
    lines.push(...formatDeleteDetails(target, data, currentState, useColor));
  }

  lines.push('');
  return lines;
}

/**
 * Formats the target name for display
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @returns {string} Formatted target name
 */
function formatTargetName(target, data) {
  if (target === 'metadata') {
    return 'plan metadata';
  }
  if (target === 'phase') {
    return data.id || data.name || 'new phase';
  }
  if (target === 'task') {
    const taskId = data.id || 'new task';
    const phaseId = data.phaseId ? ` (in ${data.phaseId})` : '';
    return `${taskId}${phaseId}`;
  }
  return target;
}

/**
 * Formats add operation details
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @param {boolean} useColor - Use colors
 * @returns {Array<string>} Detail lines
 */
function formatAddDetails(target, data, useColor) {
  const lines = [];
  const indent = '      ';

  if (target === 'phase') {
    if (data.name) lines.push(`${indent}Name: ${colorize(data.name, 'green', useColor)}`);
    if (data.description) lines.push(`${indent}Description: ${truncate(data.description, 50)}`);
    if (data.insertAtIndex !== undefined) lines.push(`${indent}Position: ${data.insertAtIndex}`);
  } else if (target === 'task') {
    if (data.description) lines.push(`${indent}Description: ${colorize(data.description, 'green', useColor)}`);
    if (data.details) lines.push(`${indent}Details: ${truncate(data.details, 50)}`);
    if (data.phaseId) lines.push(`${indent}Phase: ${data.phaseId}`);
    if (data.dependencies?.length) lines.push(`${indent}Dependencies: ${data.dependencies.join(', ')}`);
  }

  return lines;
}

/**
 * Formats update operation details with before/after
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @param {Object} currentState - Current state
 * @param {boolean} useColor - Use colors
 * @param {boolean} verbose - Verbose output
 * @returns {Array<string>} Detail lines
 */
function formatUpdateDetails(target, data, currentState, useColor, verbose) {
  const lines = [];
  const indent = '      ';

  // Find current item
  const current = findCurrentItem(target, data, currentState);

  // Show changed fields
  const changedFields = getChangedFields(target, data);

  for (const field of changedFields) {
    const oldValue = current ? current[field] : '(unknown)';
    const newValue = data[field];

    if (oldValue !== newValue) {
      const oldDisplay = colorize(String(oldValue || '(empty)'), 'red', useColor);
      const newDisplay = colorize(String(newValue), 'green', useColor);
      lines.push(`${indent}${field}: ${oldDisplay} → ${newDisplay}`);
    }
  }

  if (data.force) {
    lines.push(`${indent}${colorize('Force flag enabled', 'yellow', useColor)}`);
  }

  return lines;
}

/**
 * Formats delete operation details
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @param {Object} currentState - Current state
 * @param {boolean} useColor - Use colors
 * @returns {Array<string>} Detail lines
 */
function formatDeleteDetails(target, data, currentState, useColor) {
  const lines = [];
  const indent = '      ';

  const current = findCurrentItem(target, data, currentState);

  if (current) {
    if (target === 'phase') {
      lines.push(`${indent}${colorize('Will delete:', 'red', useColor)} ${current.name || current.id}`);
      if (currentState.tasksByPhase?.[current.id]) {
        const taskCount = currentState.tasksByPhase[current.id].length;
        if (taskCount > 0) {
          lines.push(`${indent}${colorize(`⚠ Contains ${taskCount} task(s) that will also be deleted`, 'red', useColor)}`);
        }
      }
    } else if (target === 'task') {
      lines.push(`${indent}${colorize('Will delete:', 'red', useColor)} ${current.description || current.task_id}`);
    }
  }

  if (data.force) {
    lines.push(`${indent}${colorize('Force flag enabled - will delete even if completed', 'yellow', useColor)}`);
  }

  return lines;
}

/**
 * Finds the current item in state
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @param {Object} currentState - Current state
 * @returns {Object|null} Current item or null
 */
function findCurrentItem(target, data, currentState) {
  if (!currentState) return null;

  if (target === 'phase') {
    return currentState.phases?.find(p => p.id === data.id);
  }

  if (target === 'task') {
    if (currentState.tasksByPhase && data.phaseId) {
      const tasks = currentState.tasksByPhase[data.phaseId] || [];
      return tasks.find(t => t.task_id === data.id);
    }
  }

  if (target === 'metadata') {
    return currentState.metadata;
  }

  return null;
}

/**
 * Gets the list of fields that are being changed
 * @param {string} target - Target type
 * @param {Object} data - Operation data
 * @returns {Array<string>} Changed field names
 */
function getChangedFields(target, data) {
  const ignoredFields = ['id', 'phaseId', 'planId', 'force', 'insertAtIndex'];
  return Object.keys(data).filter(k => !ignoredFields.includes(k));
}

/**
 * Checks for warnings related to an operation
 * @param {Object} op - Operation
 * @param {Object} currentState - Current state
 * @returns {Array<string>} Warning messages
 */
function checkOperationWarnings(op, currentState) {
  const warnings = [];
  const { type, target, data } = op;

  // Check for deletion of completed items
  if (type === 'delete') {
    if (currentState?.executionState?.taskStatuses?.[data.id] === 'completed') {
      warnings.push(`Deleting completed task '${data.id}' - work may be lost`);
    }
    if (currentState?.executionState?.phaseStatuses?.[data.id] === 'completed') {
      warnings.push(`Deleting completed phase '${data.id}' - all completed work in this phase may be lost`);
    }
  }

  // Check for updating completed items
  if (type === 'update') {
    if (currentState?.executionState?.taskStatuses?.[data.id] === 'completed' && !data.force) {
      warnings.push(`Modifying completed task '${data.id}' may require force flag`);
    }
  }

  // Check for missing dependencies
  if (data.dependencies?.length) {
    for (const dep of data.dependencies) {
      const exists = findDependencyInState(dep, currentState);
      if (!exists) {
        warnings.push(`Dependency '${dep}' may not exist in the plan`);
      }
    }
  }

  return warnings;
}

/**
 * Checks if a dependency exists in state
 * @param {string} depId - Dependency ID
 * @param {Object} currentState - Current state
 * @returns {boolean} True if dependency exists
 */
function findDependencyInState(depId, currentState) {
  if (!currentState) return true; // Assume exists if no state

  // Check tasks
  if (currentState.tasksByPhase) {
    for (const tasks of Object.values(currentState.tasksByPhase)) {
      if (tasks.some(t => t.task_id === depId)) return true;
    }
  }

  // Check phases
  if (currentState.phases?.some(p => p.id === depId)) return true;

  return false;
}

/**
 * Generates impact analysis section
 * @param {Object} currentState - Current state
 * @param {Array<Object>} operations - Operations
 * @param {boolean} useColor - Use colors
 * @returns {Array<string>} Analysis lines
 */
function generateImpactAnalysis(currentState, operations, useColor) {
  const lines = [];

  // Count affected items
  const affected = {
    phases: new Set(),
    tasks: new Set()
  };

  for (const op of operations) {
    if (op.target === 'phase') {
      affected.phases.add(op.data.id || 'new');
    } else if (op.target === 'task') {
      affected.tasks.add(op.data.id || 'new');
      if (op.data.phaseId) affected.phases.add(op.data.phaseId);
    }
  }

  lines.push(`  Affected phases: ${affected.phases.size}`);
  lines.push(`  Affected tasks: ${affected.tasks.size}`);

  // Check for cascade effects
  const deletedPhases = operations
    .filter(op => op.type === 'delete' && op.target === 'phase')
    .map(op => op.data.id);

  if (deletedPhases.length > 0 && currentState?.tasksByPhase) {
    let cascadeCount = 0;
    for (const phaseId of deletedPhases) {
      const tasks = currentState.tasksByPhase[phaseId] || [];
      cascadeCount += tasks.length;
    }
    if (cascadeCount > 0) {
      lines.push(`  ${colorize(`Cascade deletions: ${cascadeCount} tasks`, 'red', useColor)}`);
    }
  }

  return lines;
}

/**
 * Generates safety warnings for destructive operations
 * @param {Array<Object>} operations - Operations
 * @param {Object} currentState - Current state
 * @param {boolean} useColor - Use colors
 * @returns {Array<string>} Safety warning lines
 */
function generateSafetyWarnings(operations, currentState, useColor) {
  const lines = [];

  const deletions = operations.filter(op => op.type === 'delete');
  const hasForce = operations.some(op => op.data?.force);

  if (deletions.length > 0) {
    lines.push(`  ${colorize('⚠ DESTRUCTIVE:', 'red', useColor)} This update includes ${deletions.length} deletion(s)`);
    lines.push(`    Deleted items cannot be automatically recovered.`);

    if (currentState?.executionState?.hasStarted) {
      lines.push(`  ${colorize('⚠ EXECUTION IN PROGRESS:', 'yellow', useColor)} Plan execution has started`);
      lines.push(`    Some tasks may already be completed. Consider using rollback mode.`);
    }
  }

  if (hasForce) {
    lines.push(`  ${colorize('⚠ FORCE FLAG:', 'yellow', useColor)} Force flag will override safety checks`);
    lines.push(`    Completed items may be modified or deleted.`);
  }

  // Check for in-progress task modifications
  const inProgressMods = operations.filter(op => {
    if (op.target !== 'task') return false;
    return currentState?.executionState?.taskStatuses?.[op.data.id] === 'in_progress';
  });

  if (inProgressMods.length > 0) {
    lines.push(`  ${colorize('⚠ IN-PROGRESS TASKS:', 'red', useColor)} ${inProgressMods.length} operation(s) affect tasks currently in progress`);
    lines.push(`    These operations may be blocked. Use rollback mode for structural changes.`);
  }

  return lines;
}

/**
 * Applies color to text if colors are enabled
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
 * Truncates text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generates a simple text-only preview (no colors)
 * @param {Object} currentState - Current state
 * @param {Array<Object>} operations - Operations
 * @returns {string} Plain text preview
 */
function generatePlainPreview(currentState, operations) {
  return generatePreview(currentState, operations, { color: false }).text;
}

/**
 * Generates a compact one-line summary of operations
 * @param {Array<Object>} operations - Operations
 * @returns {string} Compact summary
 */
function generateCompactSummary(operations) {
  const counts = { add: 0, update: 0, delete: 0 };

  for (const op of operations) {
    counts[op.type] = (counts[op.type] || 0) + 1;
  }

  const parts = [];
  if (counts.add > 0) parts.push(`+${counts.add}`);
  if (counts.update > 0) parts.push(`~${counts.update}`);
  if (counts.delete > 0) parts.push(`-${counts.delete}`);

  return parts.join(' ') || 'No changes';
}

module.exports = {
  generatePreview,
  generatePlainPreview,
  generateCompactSummary,
  formatOperation,
  formatTargetName,
  checkOperationWarnings,
  generateSafetyWarnings,
  generateImpactAnalysis,
  colorize,
  truncate
};
