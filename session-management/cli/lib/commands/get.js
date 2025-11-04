/**
 * Get command - Get session details
 */

const IndexManager = require('../index-manager');
const SessionReader = require('../session-reader');

/**
 * Parse command arguments
 * @param {Array} args
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));

  return {
    sessionName,
    includeSnapshots: args.includes('--include-snapshots'),
    includeState: args.includes('--include-state')
  };
}

/**
 * Get session details
 * @param {Array} args - Command arguments
 * @returns {Object} Session details
 */
async function getCommand(args) {
  const options = parseArgs(args);

  if (!options.sessionName) {
    throw new Error('Session name required. Usage: session-cli get <session-name>');
  }

  const indexManager = new IndexManager();
  const sessionReader = new SessionReader();

  // Get from index first
  const indexData = indexManager.getSession(options.sessionName);

  if (!indexData) {
    throw new Error(`Session not found: ${options.sessionName}`);
  }

  // Build response
  const response = {
    ...indexData
  };

  // Add snapshot list if requested
  if (options.includeSnapshots) {
    response.snapshots = sessionReader.listSnapshots(options.sessionName);
  }

  // Add state if requested
  if (options.includeState) {
    response.autoCaptureState = sessionReader.readAutoCaptureState(options.sessionName);
    response.analysisQueue = sessionReader.readAnalysisQueue(options.sessionName);
    response.snapshotDecision = sessionReader.readSnapshotDecision(options.sessionName);
    response.hasPendingAnalysis = sessionReader.hasPendingAnalysis(options.sessionName);
    response.hasPendingAutoSnapshot = sessionReader.hasPendingAutoSnapshot(options.sessionName);
  }

  return response;
}

module.exports = getCommand;
