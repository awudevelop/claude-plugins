/**
 * Stats All command - Get statistics for all sessions
 */

const IndexManager = require('../index-manager');
const SessionReader = require('../session-reader');

/**
 * Get statistics for all sessions
 * @param {Array} args - Command arguments
 * @returns {Object} All statistics
 */
async function statsAllCommand(args) {
  const indexManager = new IndexManager();
  const sessionReader = new SessionReader();

  const index = indexManager.read();
  const sessionNames = Object.keys(index.sessions);

  // Calculate aggregate stats
  let totalSnapshots = 0;
  let totalSize = 0;
  let totalAutoSnapshots = 0;
  let totalManualSnapshots = 0;

  const sessions = sessionNames.map(name => {
    try {
      const stats = sessionReader.getStats(name);
      totalSnapshots += stats.snapshotCount;
      totalSize += stats.totalSnapshotSize;
      totalAutoSnapshots += stats.autoSnapshotCount;
      totalManualSnapshots += stats.manualSnapshotCount;

      return {
        name,
        snapshotCount: stats.snapshotCount,
        autoSnapshots: stats.autoSnapshotCount,
        manualSnapshots: stats.manualSnapshotCount,
        totalSizeMB: stats.totalSnapshotSizeMB,
        lastModified: stats.lastModified,
        status: index.sessions[name].status
      };
    } catch (error) {
      console.error(`Error getting stats for ${name}:`, error.message);
      return null;
    }
  }).filter(Boolean);

  return {
    totalSessions: sessionNames.length,
    activeSessions: sessions.filter(s => s.status === 'active').length,
    totalSnapshots,
    totalAutoSnapshots,
    totalManualSnapshots,
    totalSizeMB: Math.round(totalSize / (1024 * 1024) * 10) / 10,
    sessions
  };
}

module.exports = statsAllCommand;
