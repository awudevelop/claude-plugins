/**
 * Update State command - Update session state
 */

const SessionWriter = require('../session-writer');

/**
 * Parse command arguments
 * @param {Array} args
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const sessionName = args.find(arg => !arg.startsWith('--') && !arg.startsWith('{'));
  const jsonData = args.find(arg => arg.startsWith('{'));

  return {
    sessionName,
    jsonData
  };
}

/**
 * Update session state
 * @param {Array} args - Command arguments
 * @returns {Object} Result
 */
async function updateStateCommand(args) {
  const options = parseArgs(args);

  if (!options.sessionName) {
    throw new Error('Session name required. Usage: session-cli update-state <session-name> \'{"field": "value"}\'');
  }

  if (!options.jsonData) {
    throw new Error('JSON data required. Usage: session-cli update-state <session-name> \'{"field": "value"}\'');
  }

  let updates;
  try {
    updates = JSON.parse(options.jsonData);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  const sessionWriter = new SessionWriter();

  // Update the state
  sessionWriter.updateAutoCaptureState(options.sessionName, updates);

  return {
    success: true,
    sessionName: options.sessionName,
    updatedFields: Object.keys(updates)
  };
}

module.exports = updateStateCommand;
