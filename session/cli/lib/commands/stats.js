/**
 * Stats command - Get session statistics
 */

const SessionReader = require('../session-reader');
const IndexManager = require('../index-manager');

/**
 * Get session statistics
 * @param {Array} args - Command arguments
 * @returns {Object} Statistics
 */
async function statsCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));
  const detailed = args.includes('--detailed');

  if (!sessionName) {
    throw new Error('Session name required. Usage: session-cli stats <session-name>');
  }

  const sessionReader = new SessionReader();
  const indexManager = new IndexManager();

  // Get basic stats
  const stats = sessionReader.getStats(sessionName);

  // Add index metadata
  const indexData = indexManager.getSession(sessionName);
  if (indexData) {
    stats.goal = indexData.goal;
    stats.status = indexData.status;
    stats.filesInvolved = indexData.filesInvolved;
  }

  // Add detailed snapshot info if requested
  if (detailed) {
    stats.snapshots = sessionReader.listSnapshots(sessionName);
  }

  return stats;
}

module.exports = statsCommand;
