/**
 * Update-status command - Update session status in .auto-capture-state
 */

const fs = require('fs');
const path = require('path');
const IndexManager = require('../index-manager');

/**
 * Update session status (active/closed)
 * @param {Array} args - Command arguments [session-name, status]
 * @returns {Object} Result
 */
async function updateStatusCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));
  const status = args[1];

  if (!sessionName) {
    throw new Error('Session name required. Usage: session-cli update-status <session-name> <status>');
  }

  if (!status || !['active', 'closed'].includes(status)) {
    throw new Error('Valid status required (active or closed). Usage: session-cli update-status <session-name> <status>');
  }

  const sessionsDir = '.claude/sessions';
  const sessionDir = path.join(sessionsDir, sessionName);
  const statePath = path.join(sessionDir, '.auto-capture-state');

  // Verify session exists
  if (!fs.existsSync(sessionDir)) {
    throw new Error(`Session '${sessionName}' not found`);
  }

  // Create or update .auto-capture-state
  let state = {};
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      // If state file is corrupted, start fresh
      state = {
        interaction_count: 0,
        modified_files: [],
        last_snapshot_timestamp: null
      };
    }
  } else {
    // Initialize state if doesn't exist
    state = {
      interaction_count: 0,
      modified_files: [],
      last_snapshot_timestamp: null
    };
  }

  // Update status fields
  state.session_status = status;

  if (status === 'closed' && !state.session_closed) {
    state.session_closed = new Date().toISOString();
  } else if (status === 'active') {
    // If reopening, clear closed timestamp
    state.session_closed = null;
    if (!state.session_started) {
      state.session_started = new Date().toISOString();
    }
  }

  // Write updated state
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Update index
  const indexManager = new IndexManager(sessionsDir);
  try {
    const index = indexManager.read({ skipValidation: true });
    const sessionMeta = index.sessions.find(s => s.name === sessionName);
    if (sessionMeta) {
      sessionMeta.status = status;
      if (status === 'closed') {
        sessionMeta.lastUpdated = new Date().toISOString();
      }
      indexManager.write(index);
    }
  } catch (err) {
    // Continue even if index update fails
  }

  return {
    success: true,
    sessionName,
    status,
    message: `Session '${sessionName}' status updated to '${status}'`
  };
}

module.exports = updateStatusCommand;
