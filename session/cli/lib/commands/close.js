/**
 * Close command - Close the currently active session
 *
 * This command:
 * 1. Validates there's an active session
 * 2. Updates .auto-capture-state (session_status: "closed", session_closed: timestamp)
 * 3. Updates session.md Status field to "Closed"
 * 4. Updates index (sessions[name].status = "closed", activeSession = null)
 * 5. Deletes .active-session file
 * 6. Returns stats for display
 *
 * Options:
 *   --name <name>  Validate the active session matches this name (safety check)
 *   --json         Output in JSON format (default)
 *   --formatted    Output pre-rendered for display
 */

const fs = require('fs');
const path = require('path');
const IndexManager = require('../index-manager');

/**
 * Parse session.md to extract metadata
 * @param {string} content - session.md content
 * @returns {Object} Parsed metadata
 */
function parseSessionMd(content) {
  const metadata = {
    started: null,
    lastUpdated: null,
    goal: '',
    filesInvolved: []
  };

  const startedMatch = content.match(/\*\*Started\*\*:\s*(.+)$/m);
  if (startedMatch) metadata.started = startedMatch[1].trim();

  const lastUpdatedMatch = content.match(/\*\*Last Updated\*\*:\s*(.+)$/m);
  if (lastUpdatedMatch) metadata.lastUpdated = lastUpdatedMatch[1].trim();

  const goalMatch = content.match(/##\s+Goal\s*\n(.+?)(?=\n##|\n\*\*|$)/s);
  if (goalMatch) metadata.goal = goalMatch[1].trim();

  const filesSection = content.match(/##\s+Files Involved\s*\n([\s\S]+?)(?=\n##|$)/);
  if (filesSection) {
    metadata.filesInvolved = filesSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(f => f && !f.startsWith('['));
  }

  return metadata;
}

/**
 * Update session.md with closed status
 * @param {string} sessionMdPath - Path to session.md
 * @param {string} timestamp - ISO timestamp
 * @returns {boolean} Success
 */
function updateSessionMd(sessionMdPath, timestamp) {
  try {
    let content = fs.readFileSync(sessionMdPath, 'utf8');

    // Update or add Status field
    if (content.includes('**Status**:')) {
      content = content.replace(/\*\*Status\*\*:\s*.+$/m, `**Status**: Closed`);
    } else {
      // Add Status after Started line
      content = content.replace(
        /(\*\*Started\*\*:\s*.+)$/m,
        `$1\n**Status**: Closed`
      );
    }

    // Update or add Closed field
    const formattedTime = timestamp.replace('T', ' ').replace('Z', ' UTC').slice(0, -5);
    if (content.includes('**Closed**:')) {
      content = content.replace(/\*\*Closed\*\*:\s*.+$/m, `**Closed**: ${formattedTime}`);
    } else {
      // Add Closed after Status line
      content = content.replace(
        /(\*\*Status\*\*:\s*.+)$/m,
        `$1\n**Closed**: ${formattedTime}`
      );
    }

    // Update Last Updated
    content = content.replace(
      /\*\*Last Updated\*\*:\s*.+$/m,
      `**Last Updated**: ${formattedTime}`
    );

    fs.writeFileSync(sessionMdPath, content);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Calculate session duration
 * @param {string} started - Start timestamp (various formats)
 * @returns {string} Formatted duration
 */
function calculateDuration(started) {
  if (!started) return 'Unknown';

  try {
    // Handle various timestamp formats
    let startDate;
    if (started.includes('T')) {
      startDate = new Date(started);
    } else if (started.includes('_')) {
      // Format: YYYY-MM-DD_HH:MM
      const [datePart, timePart] = started.split('_');
      startDate = new Date(`${datePart}T${timePart}:00`);
    } else {
      startDate = new Date(started);
    }

    if (isNaN(startDate.getTime())) return 'Unknown';

    const now = new Date();
    const diffMs = now - startDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      return `${days}d ${hours}h`;
    }
    return `${diffHours}h ${diffMins}m`;
  } catch (err) {
    return 'Unknown';
  }
}

/**
 * Close the currently active session
 * @param {Array} args - Command arguments
 * @returns {Object} Result with stats
 */
async function closeCommand(args) {
  const sessionsDir = '.claude/sessions';
  const activeSessionPath = path.join(sessionsDir, '.active-session');

  // Parse arguments
  const nameIndex = args.indexOf('--name');
  const expectedName = nameIndex !== -1 ? args[nameIndex + 1] : null;
  const jsonOutput = args.includes('--json');
  const formattedOutput = args.includes('--formatted');

  // Step 1: Check if there's an active session
  if (!fs.existsSync(activeSessionPath)) {
    const error = {
      success: false,
      error: 'NO_ACTIVE_SESSION',
      message: 'No active session to close'
    };
    if (formattedOutput) {
      error.formatted = `❌ Error: No active session to close

💡 Use /session:list to see available sessions
💡 Use /session:start [name] to create a new session`;
    }
    return error;
  }

  // Step 2: Read the active session name
  let sessionName;
  try {
    sessionName = fs.readFileSync(activeSessionPath, 'utf8').trim();
  } catch (err) {
    // Clean up unreadable file
    try {
      fs.unlinkSync(activeSessionPath);
    } catch (e) { /* ignore */ }

    const error = {
      success: false,
      error: 'READ_ERROR',
      message: 'Failed to read active session file'
    };
    if (formattedOutput) {
      error.formatted = `❌ Error: Failed to read active session file

The file was corrupted and has been cleaned up.

💡 Use /session:list to see available sessions
💡 Use /session:start [name] to create a new session`;
    }
    return error;
  }

  if (!sessionName) {
    // Clean up empty file
    try {
      fs.unlinkSync(activeSessionPath);
    } catch (e) { /* ignore */ }

    const error = {
      success: false,
      error: 'EMPTY_ACTIVE_SESSION',
      message: 'Active session file is empty'
    };
    if (formattedOutput) {
      error.formatted = `❌ Error: Active session file is empty

The file was corrupted and has been cleaned up.

💡 Use /session:list to see available sessions
💡 Use /session:start [name] to create a new session`;
    }
    return error;
  }

  // Step 3: Validate --name matches (if provided)
  if (expectedName && expectedName !== sessionName) {
    const error = {
      success: false,
      error: 'NAME_MISMATCH',
      message: `Active session is '${sessionName}', not '${expectedName}'`,
      activeSession: sessionName,
      expectedName
    };
    if (formattedOutput) {
      error.formatted = `❌ Error: Session name mismatch

Active session: ${sessionName}
Expected: ${expectedName}

💡 Use /session:close without --name to close '${sessionName}'`;
    }
    return error;
  }

  const sessionDir = path.join(sessionsDir, sessionName);
  const statePath = path.join(sessionDir, '.auto-capture-state');
  const sessionMdPath = path.join(sessionDir, 'session.md');
  const closedTimestamp = new Date().toISOString();

  // Verify session directory exists
  if (!fs.existsSync(sessionDir)) {
    // Clean up orphaned .active-session
    try {
      fs.unlinkSync(activeSessionPath);
    } catch (e) { /* ignore */ }

    // Also clear index.activeSession
    const indexManager = new IndexManager(sessionsDir);
    try {
      const index = indexManager.read({ skipValidation: true });
      index.activeSession = null;
      indexManager.write(index);
    } catch (e) { /* ignore */ }

    const error = {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: `Session directory '${sessionName}' not found`,
      sessionName,
      cleaned: true
    };
    if (formattedOutput) {
      error.formatted = `❌ Error: Session '${sessionName}' not found

The .active-session file pointed to a non-existent session.
This has been cleaned up automatically.

💡 Use /session:list to see available sessions
💡 Use /session:start [name] to create a new session`;
    }
    return error;
  }

  // Step 4: Update .auto-capture-state
  let state = {};
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      state = {};
    }
  }

  state.session_status = 'closed';
  state.session_closed = closedTimestamp;

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Step 5: Update session.md
  let sessionMeta = { started: null, goal: '', filesInvolved: [] };
  if (fs.existsSync(sessionMdPath)) {
    try {
      const content = fs.readFileSync(sessionMdPath, 'utf8');
      sessionMeta = parseSessionMd(content);
      updateSessionMd(sessionMdPath, closedTimestamp);
    } catch (err) {
      // Continue even if session.md update fails
    }
  }

  // Step 6: Update index
  const indexManager = new IndexManager(sessionsDir);
  let snapshotCount = 0;

  try {
    const index = indexManager.read({ skipValidation: true });

    // Update session status in index
    if (index.sessions && index.sessions[sessionName]) {
      index.sessions[sessionName].status = 'closed';
      index.sessions[sessionName].closed = closedTimestamp;
      snapshotCount = index.sessions[sessionName].snapshotCount || 0;
    }

    // Clear active session
    index.activeSession = null;

    indexManager.write(index);
  } catch (err) {
    // Continue even if index update fails
  }

  // Step 7: Delete .active-session file
  try {
    fs.unlinkSync(activeSessionPath);
  } catch (err) {
    // File may already be deleted
  }

  // Step 8: Calculate stats
  const duration = calculateDuration(sessionMeta.started || state.session_started);
  const filesModified = sessionMeta.filesInvolved.length ||
    (state.modified_files ? state.modified_files.length : 0);

  const result = {
    success: true,
    sessionName,
    closed: closedTimestamp,
    stats: {
      duration,
      snapshotCount,
      filesModified,
      started: sessionMeta.started || state.session_started,
      goal: sessionMeta.goal || ''
    },
    message: `Session '${sessionName}' closed successfully`
  };

  // Add formatted output if requested
  if (formattedOutput) {
    result.formatted = `✓ Session '${sessionName}' closed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Session Summary:
   Duration: ${duration}
   Snapshots: ${snapshotCount}
   Files modified: ${filesModified}

🎯 Goal: ${sessionMeta.goal || '[Not specified]'}

📁 Session saved to: .claude/sessions/${sessionName}/

💡 Use /session:continue ${sessionName} to resume later
💡 Use /session:list to see all sessions`;
  }

  return result;
}

module.exports = closeCommand;
