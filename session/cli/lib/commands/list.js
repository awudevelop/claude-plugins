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
    activeOnly: args.includes('--active-only'),
    formatted: args.includes('--formatted')
  };
}

/**
 * Calculate relative time string
 * @param {string} dateStr - Date string (ISO or custom format like "2025-11-16_04:32")
 * @returns {string} Relative time (e.g., "2h ago", "3d ago")
 */
function relativeTime(dateStr) {
  if (!dateStr) return 'unknown';

  // Handle custom format "YYYY-MM-DD_HH:MM" -> convert to parseable format
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
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${diffWeeks}w ago`;
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

/**
 * Get badges for a session
 * @param {Object} session - Session object
 * @param {string} activeSession - Currently active session name
 * @returns {string} Badge string
 */
function getBadges(session, activeSession) {
  const badges = [];
  const now = Date.now();
  const lastUpdate = new Date(session.lastUpdated || 0).getTime();
  const diffMs = now - lastUpdate;
  const diffHours = diffMs / 3600000;
  const diffDays = diffMs / 86400000;

  // Active session badge
  if (session.name === activeSession) {
    badges.push('[ACTIVE]');
  }

  // Status badge
  if (session.status === 'closed') {
    badges.push('✅ CLOSED');
  } else if (diffHours < 1) {
    badges.push('🔥 HOT');
  } else if (diffDays > 7) {
    badges.push('🧊 COLD');
  }

  return badges.join(' ');
}

/**
 * Format session list for display (pre-formatted markdown)
 * @param {Object} data - Session data from listCommand
 * @returns {string} Formatted markdown output
 */
function formatOutput(data) {
  const { activeSession, sessions } = data;

  if (sessions.length === 0) {
    return `No sessions found.

💡 Create your first session with:
   /session:start [name]

Example:
   /session:start my-feature`;
  }

  const active = sessions.filter(s => s.status === 'active').length;
  const closed = sessions.length - active;

  let out = `**Available Sessions (${active} active, ${closed} closed):**\n`;
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  sessions.forEach((s, i) => {
    const badges = getBadges(s, activeSession);
    const badgeStr = badges ? ` ${badges}` : '';

    out += `**${i + 1}. ${s.name}**${badgeStr}\n`;
    out += `   📅 ${relativeTime(s.lastUpdated)} (started ${relativeTime(s.started)})`;
    out += `  📸 ${s.snapshotCount || 0} snapshots`;
    if (s.filesInvolvedCount) {
      out += `  📁 ${s.filesInvolvedCount} files`;
    }
    out += '\n';

    if (s.goal) {
      out += `   🎯 ${s.goal}\n`;
    }

    if (s.latestSnapshotSummary) {
      out += `   💬 Last: "${s.latestSnapshotSummary}"\n`;
    }

    out += '\n';
  });

  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  out += '💡 Select a session: `/session:list [number]`\n';
  out += '💡 Create new: `/session:start [name]`';

  return out;
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

  const result = {
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

  // Return pre-formatted output when --formatted flag is used
  if (options.formatted) {
    return { formatted: formatOutput(result) };
  }

  return result;
}

module.exports = listCommand;
