/**
 * Activate command - Set a session as active
 *
 * This command both:
 * 1. Sets the session as the active session (.active-session file + index.activeSession)
 * 2. Updates the session status to "active" (.auto-capture-state + index.sessions[name].status)
 *
 * Previously these were two separate commands (activate + update-status "active"),
 * but they are now merged for efficiency and semantic correctness.
 */

const fs = require('fs');
const path = require('path');
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

  const sessionsDir = '.claude/sessions';
  const sessionDir = path.join(sessionsDir, sessionName);

  const indexManager = new IndexManager(sessionsDir);

  // This will throw if session doesn't exist
  indexManager.setActive(sessionName);

  // Also update status to "active" (merged from update-status command)
  const statePath = path.join(sessionDir, '.auto-capture-state');

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
  state.session_status = 'active';
  state.session_closed = null;  // Clear closed timestamp if reopening
  if (!state.session_started) {
    state.session_started = new Date().toISOString();
  }

  // Write updated state
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Update index with active status
  try {
    const index = indexManager.read({ skipValidation: true });
    const sessionMeta = index.sessions[sessionName];
    if (sessionMeta) {
      sessionMeta.status = 'active';
      indexManager.write(index);
    }
  } catch (err) {
    // Continue even if index update fails
  }

  return {
    success: true,
    activeSession: sessionName,
    status: 'active',
    message: `Session '${sessionName}' is now active`
  };
}

module.exports = activateCommand;
