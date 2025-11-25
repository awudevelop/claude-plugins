/**
 * Update Confirmation Flow
 * Interactive confirmation for plan update operations
 */

const readline = require('readline');
const { generatePreview, generateCompactSummary } = require('./update-preview');

/**
 * @typedef {Object} ConfirmationOptions
 * @property {boolean} [yes=false] - Auto-confirm without prompting
 * @property {number} [timeout=0] - Timeout in ms (0 = no timeout)
 * @property {boolean} [allowEdit=true] - Allow editing operations
 * @property {boolean} [showPreview=true] - Show preview before confirming
 * @property {boolean} [color=true] - Use colors in output
 * @property {NodeJS.ReadableStream} [input] - Input stream (default: stdin)
 * @property {NodeJS.WritableStream} [output] - Output stream (default: stdout)
 */

/**
 * @typedef {Object} ConfirmationResult
 * @property {boolean} confirmed - Whether user confirmed
 * @property {string} action - Action taken: 'confirm', 'cancel', 'edit', 'timeout'
 * @property {Array<Object>} [operations] - Modified operations (if edited)
 * @property {string} [reason] - Reason for cancellation/timeout
 */

/**
 * Prompts for confirmation of update operations
 * @param {Object} currentState - Current plan state
 * @param {Array<Object>} operations - Operations to confirm
 * @param {ConfirmationOptions} options - Confirmation options
 * @returns {Promise<ConfirmationResult>} Confirmation result
 */
async function promptForConfirmation(currentState, operations, options = {}) {
  const {
    yes = false,
    timeout = 0,
    allowEdit = true,
    showPreview = true,
    color = true,
    input = process.stdin,
    output = process.stdout
  } = options;

  // Auto-confirm if --yes flag
  if (yes) {
    return {
      confirmed: true,
      action: 'confirm',
      operations
    };
  }

  // Show preview if enabled
  if (showPreview && operations.length > 0) {
    const preview = generatePreview(currentState, operations, { color, verbose: true });
    output.write(preview.text + '\n\n');
  }

  // Build prompt message
  const promptMessage = buildPromptMessage(operations, allowEdit, color);

  // Get user response
  try {
    const response = await promptUser(promptMessage, {
      timeout,
      input,
      output,
      validResponses: buildValidResponses(allowEdit)
    });

    return handleResponse(response, operations, currentState, options);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      return {
        confirmed: false,
        action: 'timeout',
        reason: `No response within ${timeout}ms`
      };
    }
    throw error;
  }
}

/**
 * Builds the prompt message
 * @param {Array<Object>} operations - Operations
 * @param {boolean} allowEdit - Allow editing
 * @param {boolean} color - Use colors
 * @returns {string} Prompt message
 */
function buildPromptMessage(operations, allowEdit, color) {
  const summary = generateCompactSummary(operations);
  const c = color ? {
    bold: '\x1b[1m',
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
  } : { bold: '', reset: '', green: '', yellow: '', red: '', cyan: '' };

  let message = `${c.bold}Apply these changes?${c.reset} [${summary}]\n`;
  message += `  ${c.green}[y]${c.reset} Yes, apply changes\n`;
  message += `  ${c.red}[n]${c.reset} No, cancel\n`;

  if (allowEdit) {
    message += `  ${c.yellow}[e]${c.reset} Edit operations\n`;
  }

  message += `  ${c.cyan}[?]${c.reset} Show help\n`;
  message += `\n${c.bold}Choice:${c.reset} `;

  return message;
}

/**
 * Builds valid response map
 * @param {boolean} allowEdit - Allow editing
 * @returns {Object} Valid responses map
 */
function buildValidResponses(allowEdit) {
  const responses = {
    'y': 'confirm',
    'yes': 'confirm',
    'n': 'cancel',
    'no': 'cancel',
    '?': 'help',
    'help': 'help'
  };

  if (allowEdit) {
    responses['e'] = 'edit';
    responses['edit'] = 'edit';
  }

  return responses;
}

/**
 * Prompts user for input
 * @param {string} message - Prompt message
 * @param {Object} options - Prompt options
 * @returns {Promise<string>} User response
 */
function promptUser(message, options) {
  const { timeout, input, output, validResponses } = options;

  return new Promise((resolve, reject) => {
    // Handle non-interactive mode
    if (!input.isTTY) {
      reject(createError('NON_INTERACTIVE', 'Cannot prompt in non-interactive mode. Use --yes flag.'));
      return;
    }

    const rl = readline.createInterface({
      input,
      output,
      terminal: true
    });

    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      rl.close();
    };

    // Set timeout if specified
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(createError('TIMEOUT', `Prompt timed out after ${timeout}ms`));
      }, timeout);
    }

    output.write(message);

    rl.on('line', (answer) => {
      const normalized = answer.toLowerCase().trim();
      const action = validResponses[normalized];

      if (action) {
        cleanup();
        resolve(action);
      } else {
        // Invalid response, prompt again
        output.write(`Invalid choice. Valid options: ${Object.keys(validResponses).join(', ')}\n`);
        output.write('Choice: ');
      }
    });

    rl.on('close', () => {
      cleanup();
      reject(createError('CLOSED', 'Input stream closed'));
    });

    rl.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Handles user response
 * @param {string} action - User action
 * @param {Array<Object>} operations - Original operations
 * @param {Object} currentState - Current state
 * @param {Object} options - Options
 * @returns {Promise<ConfirmationResult>} Result
 */
async function handleResponse(action, operations, currentState, options) {
  switch (action) {
    case 'confirm':
      return {
        confirmed: true,
        action: 'confirm',
        operations
      };

    case 'cancel':
      return {
        confirmed: false,
        action: 'cancel',
        reason: 'User cancelled'
      };

    case 'edit':
      return await handleEditFlow(operations, currentState, options);

    case 'help':
      showHelp(options.output || process.stdout);
      // Re-prompt after showing help
      return promptForConfirmation(currentState, operations, {
        ...options,
        showPreview: false // Don't show preview again
      });

    default:
      return {
        confirmed: false,
        action: 'unknown',
        reason: `Unknown action: ${action}`
      };
  }
}

/**
 * Handles the edit flow
 * @param {Array<Object>} operations - Original operations
 * @param {Object} currentState - Current state
 * @param {Object} options - Options
 * @returns {Promise<ConfirmationResult>} Result
 */
async function handleEditFlow(operations, currentState, options) {
  const output = options.output || process.stdout;
  const input = options.input || process.stdin;

  output.write('\n--- Edit Mode ---\n');
  output.write('Operations:\n');

  // List operations with indices
  operations.forEach((op, i) => {
    const desc = describeOp(op);
    output.write(`  [${i + 1}] ${desc}\n`);
  });

  output.write('\nCommands:\n');
  output.write('  remove <n>  - Remove operation #n\n');
  output.write('  done        - Finish editing and confirm\n');
  output.write('  cancel      - Cancel all changes\n');
  output.write('\n');

  let editedOperations = [...operations];

  try {
    while (true) {
      const cmd = await promptSimple('Edit> ', { input, output, timeout: options.timeout });

      if (cmd === 'done') {
        if (editedOperations.length === 0) {
          output.write('No operations remaining. Cancelling.\n');
          return {
            confirmed: false,
            action: 'cancel',
            reason: 'All operations removed during edit'
          };
        }
        return {
          confirmed: true,
          action: 'edit',
          operations: editedOperations
        };
      }

      if (cmd === 'cancel') {
        return {
          confirmed: false,
          action: 'cancel',
          reason: 'User cancelled during edit'
        };
      }

      if (cmd.startsWith('remove ')) {
        const index = parseInt(cmd.substring(7)) - 1;
        if (index >= 0 && index < editedOperations.length) {
          const removed = editedOperations.splice(index, 1)[0];
          output.write(`Removed: ${describeOp(removed)}\n`);
          output.write(`Remaining operations: ${editedOperations.length}\n`);
        } else {
          output.write(`Invalid operation number. Use 1-${editedOperations.length}\n`);
        }
      } else {
        output.write('Unknown command. Use: remove <n>, done, cancel\n');
      }
    }
  } catch (error) {
    return {
      confirmed: false,
      action: 'error',
      reason: error.message
    };
  }
}

/**
 * Simple prompt without validation
 * @param {string} message - Prompt message
 * @param {Object} options - Options
 * @returns {Promise<string>} User input
 */
function promptSimple(message, options) {
  const { input, output, timeout } = options;

  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      reject(createError('NON_INTERACTIVE', 'Cannot prompt in non-interactive mode'));
      return;
    }

    const rl = readline.createInterface({ input, output, terminal: true });
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      rl.close();
    };

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(createError('TIMEOUT', 'Edit timed out'));
      }, timeout);
    }

    output.write(message);

    rl.once('line', (answer) => {
      cleanup();
      resolve(answer.trim());
    });

    rl.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Shows help information
 * @param {NodeJS.WritableStream} output - Output stream
 */
function showHelp(output) {
  output.write('\n--- Help ---\n');
  output.write('This prompt asks you to confirm plan update operations.\n\n');
  output.write('Options:\n');
  output.write('  y/yes  - Apply all listed changes to the plan\n');
  output.write('  n/no   - Cancel without making any changes\n');
  output.write('  e/edit - Enter edit mode to remove specific operations\n');
  output.write('  ?/help - Show this help message\n');
  output.write('\nTips:\n');
  output.write('  - Review the preview carefully before confirming\n');
  output.write('  - Watch for ⚠ warnings about destructive changes\n');
  output.write('  - Use --yes flag to skip this prompt in scripts\n');
  output.write('\n');
}

/**
 * Describes an operation briefly
 * @param {Object} op - Operation
 * @returns {string} Brief description
 */
function describeOp(op) {
  const { type, target, data } = op;
  const id = data.id || data.name || data.description || 'new';
  return `${type.toUpperCase()} ${target}: ${truncate(String(id), 40)}`;
}

/**
 * Truncates text
 * @param {string} text - Text to truncate
 * @param {number} max - Max length
 * @returns {string} Truncated text
 */
function truncate(text, max) {
  return text.length > max ? text.substring(0, max - 3) + '...' : text;
}

/**
 * Creates an error with code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @returns {Error} Error with code
 */
function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Quick confirmation with simple yes/no
 * @param {string} message - Confirmation message
 * @param {Object} options - Options
 * @returns {Promise<boolean>} True if confirmed
 */
async function quickConfirm(message, options = {}) {
  if (options.yes) return true;

  const output = options.output || process.stdout;
  const input = options.input || process.stdin;

  output.write(`${message} [y/N]: `);

  try {
    const response = await promptSimple('', { input, output, timeout: options.timeout || 30000 });
    return response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
  } catch (error) {
    return false;
  }
}

/**
 * Auto-confirms or prompts based on options
 * @param {Object} currentState - Current state
 * @param {Array<Object>} operations - Operations
 * @param {Object} cliArgs - CLI arguments (--yes, --force, etc.)
 * @returns {Promise<ConfirmationResult>} Result
 */
async function confirmOrAuto(currentState, operations, cliArgs = {}) {
  // Check for auto-confirm flags
  if (cliArgs.yes || cliArgs.y || cliArgs.force) {
    return {
      confirmed: true,
      action: 'confirm',
      operations
    };
  }

  // Check for non-interactive environment
  if (!process.stdin.isTTY) {
    return {
      confirmed: false,
      action: 'cancel',
      reason: 'Non-interactive mode requires --yes flag'
    };
  }

  return promptForConfirmation(currentState, operations, {
    yes: false,
    timeout: cliArgs.timeout || 0,
    allowEdit: !cliArgs.noEdit,
    showPreview: !cliArgs.noPreview,
    color: cliArgs.color !== false
  });
}

module.exports = {
  promptForConfirmation,
  quickConfirm,
  confirmOrAuto,
  handleEditFlow,
  showHelp,
  buildPromptMessage,
  describeOp
};
