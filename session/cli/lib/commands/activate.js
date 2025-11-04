/**
 * Activate command - Set a session as active
 */

const IndexManager = require('../index-manager');

/**
 * Activate a session
 * @param {Array} args - Command arguments
 * @returns {Object} Result
 */
async function activateCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));

  if (!sessionName) {
    throw new Error('Session name required. Usage: session-cli activate <session-name>');
  }

  const indexManager = new IndexManager();

  // This will throw if session doesn't exist
  indexManager.setActive(sessionName);

  return {
    success: true,
    activeSession: sessionName,
    message: `Session '${sessionName}' is now active`
  };
}

module.exports = activateCommand;
