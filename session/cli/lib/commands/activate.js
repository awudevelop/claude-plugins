/**
 * Activate command - Set a session as active
 *
 * This command:
 * 1. Auto-closes any previously active session (if different)
 * 2. Sets the session as the active session (.active-session file + index.activeSession)
 * 3. Updates the session status to "active" (.auto-capture-state + index.sessions[name].status)
 *
 * The auto-close feature (v3.29.0) eliminates the need for command templates
 * to manually check and close previous sessions.
 */

const fs = require('fs');
const path = require('path');
const IndexManager = require('../index-manager');

/**
 * Close a session by updating its state to "closed"
 * @param {string} sessionsDir - Sessions directory path
 * @param {string} sessionName - Session to close
 * @param {IndexManager} indexManager - Index manager instance
 * @returns {boolean} Whether close was successful
 */
function closeSession(sessionsDir, sessionName, indexManager) {
  const sessionDir = path.join(sessionsDir, sessionName);
  const statePath = path.join(sessionDir, '.auto-capture-state');

  // Update state file
  let state = {};
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      state = {};
    }
  }

  state.session_status = 'closed';
  state.session_closed = new Date().toISOString();

  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    return false;
  }

  // Update index
  try {
    const index = indexManager.read({ skipValidation: true });
    if (index.sessions && index.sessions[sessionName]) {
      index.sessions[sessionName].status = 'closed';
      indexManager.write(index);
    }
  } catch (err) {
    // Continue even if index update fails
  }

  return true;
}

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
  const activeSessionPath = path.join(sessionsDir, '.active-session');

  const indexManager = new IndexManager(sessionsDir);

  // Check for previously active session and close it if different
  let previousSession = null;
  let previousSessionClosed = false;

  if (fs.existsSync(activeSessionPath)) {
    try {
      previousSession = fs.readFileSync(activeSessionPath, 'utf8').trim();
      if (previousSession && previousSession !== sessionName) {
        // Close the previous session
        previousSessionClosed = closeSession(sessionsDir, previousSession, indexManager);
      } else {
        previousSession = null; // Same session, don't report as "closed"
      }
    } catch (err) {
      // Ignore read errors, continue with activation
    }
  }

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

  const result = {
    success: true,
    activeSession: sessionName,
    status: 'active',
    message: `Session '${sessionName}' is now active`
  };

  // Include info about previous session if it was closed
  if (previousSession && previousSessionClosed) {
    result.previousSession = previousSession;
    result.previousSessionClosed = true;
    result.message = `Session '${sessionName}' is now active (closed '${previousSession}')`;
  }

  return result;
}

module.exports = activateCommand;
