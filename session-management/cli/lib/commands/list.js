/**
 * List command - List all sessions
 */

const IndexManager = require('../index-manager');

/**
 * Parse command arguments
 * @param {Array} args
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  return {
    json: args.includes('--json'),
    activeOnly: args.includes('--active-only')
  };
}

/**
 * List all sessions
 * @param {Array} args - Command arguments
 * @returns {Object} Session list
 */
async function listCommand(args) {
  const options = parseArgs(args);
  const indexManager = new IndexManager();

  // Read index (will rebuild if missing/corrupt)
  const index = indexManager.read();

  // Get all sessions
  let sessions = Object.values(index.sessions);

  // Filter to active only if requested
  if (options.activeOnly) {
    sessions = sessions.filter(s => s.status === 'active');
  }

  // Sort by last updated (most recent first)
  sessions.sort((a, b) => {
    const dateA = new Date(a.lastUpdated || 0);
    const dateB = new Date(b.lastUpdated || 0);
    return dateB - dateA;
  });

  return {
    activeSession: index.activeSession,
    totalSessions: sessions.length,
    sessions: sessions.map(s => ({
      name: s.name,
      status: s.status,
      started: s.started,
      lastUpdated: s.lastUpdated,
      snapshotCount: s.snapshotCount,
      filesInvolvedCount: s.filesInvolvedCount,
      goal: s.goal?.substring(0, 100) + (s.goal?.length > 100 ? '...' : ''),
      latestSnapshot: s.latestSnapshot,
      latestSnapshotSummary: s.latestSnapshotSummary
    }))
  };
}

module.exports = listCommand;
