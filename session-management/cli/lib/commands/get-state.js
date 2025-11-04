/**
 * Get State command - Get auto-capture state
 */

const SessionReader = require('../session-reader');

/**
 * Get session state
 * @param {Array} args - Command arguments
 * @returns {Object} State data
 */
async function getStateCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));

  if (!sessionName) {
    throw new Error('Session name required. Usage: session-cli get-state <session-name>');
  }

  const sessionReader = new SessionReader();

  if (!sessionReader.exists(sessionName)) {
    throw new Error(`Session not found: ${sessionName}`);
  }

  const state = {
    autoCaptureState: sessionReader.readAutoCaptureState(sessionName),
    analysisQueue: sessionReader.readAnalysisQueue(sessionName),
    snapshotDecision: sessionReader.readSnapshotDecision(sessionName),
    hasPendingAnalysis: sessionReader.hasPendingAnalysis(sessionName),
    hasPendingAutoSnapshot: sessionReader.hasPendingAutoSnapshot(sessionName)
  };

  return state;
}

module.exports = getStateCommand;
