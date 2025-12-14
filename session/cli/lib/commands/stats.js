/**
 * Stats command - Get session statistics
 */

const SessionReader = require('../session-reader');
const IndexManager = require('../index-manager');

/**
 * Calculate relative time string
 * @param {string} dateStr - Date string (ISO or custom format)
 * @returns {string} Relative time
 */
function relativeTime(dateStr) {
  if (!dateStr) return 'unknown';

  let parsed = new Date(dateStr);
  if (isNaN(parsed.getTime()) && dateStr.includes('_')) {
    parsed = new Date(dateStr.replace('_', 'T') + ':00');
  }

  const now = Date.now();
  const then = parsed.getTime();
  if (isNaN(then)) return 'unknown';

  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Calculate duration from start time
 * @param {string} started - Start timestamp
 * @returns {string} Duration string
 */
function calculateDuration(started) {
  if (!started) return 'unknown';

  let parsed = new Date(started);
  if (isNaN(parsed.getTime()) && started.includes('_')) {
    parsed = new Date(started.replace('_', 'T') + ':00');
  }

  const now = Date.now();
  const then = parsed.getTime();
  if (isNaN(then)) return 'unknown';

  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * Format session stats for display
 * @param {Object} stats - Session stats
 * @param {string} sessionName - Session name
 * @returns {string} Formatted output
 */
function formatStats(stats, sessionName) {
  const status = stats.status || 'active';
  const statusIcon = status === 'closed' ? '✓' : '✓';

  let out = `${statusIcon} Session: ${sessionName} (${status})\n`;
  out += `  Working for: ${calculateDuration(stats.started)} (started ${formatShortDate(stats.started)})\n`;
  out += `  Snapshots: ${stats.snapshotCount || 0} total\n`;
  out += `  Files: ${stats.filesInvolvedCount || 0} tracked\n`;
  out += `  Last activity: ${relativeTime(stats.lastUpdated)}\n`;
  out += '\n';

  if (status === 'closed') {
    out += `💡 /session:continue ${sessionName} to resume`;
  } else {
    out += `💡 /session:save to capture milestones\n`;
    out += `💡 /session:close to finalize`;
  }

  return out;
}

/**
 * Format short date for display
 * @param {string} dateStr - Date string
 * @returns {string} Short date format
 */
function formatShortDate(dateStr) {
  if (!dateStr) return 'unknown';

  let parsed = new Date(dateStr);
  if (isNaN(parsed.getTime()) && dateStr.includes('_')) {
    parsed = new Date(dateStr.replace('_', 'T') + ':00');
  }
  if (isNaN(parsed.getTime())) return 'unknown';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[parsed.getMonth()];
  const day = parsed.getDate();
  const hours = parsed.getHours().toString().padStart(2, '0');
  const mins = parsed.getMinutes().toString().padStart(2, '0');

  return `${month} ${day}, ${hours}:${mins}`;
}

/**
 * Get session statistics
 * @param {Array} args - Command arguments
 * @returns {Object} Statistics
 */
async function statsCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));
  const detailed = args.includes('--detailed');
  const formatted = args.includes('--formatted');

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
    stats.filesInvolvedCount = indexData.filesInvolvedCount;
  }

  // Add detailed snapshot info if requested
  if (detailed) {
    stats.snapshots = sessionReader.listSnapshots(sessionName);
  }

  // Return pre-formatted output if requested
  if (formatted) {
    return { formatted: formatStats(stats, sessionName) };
  }

  return stats;
}

module.exports = statsCommand;
