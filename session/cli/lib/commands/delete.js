/**
 * Delete command - Delete a session and all its data
 */

const fs = require('fs');
const path = require('path');
const IndexManager = require('../index-manager');

/**
 * Delete a session directory recursively
 * @param {string} dirPath - Directory path to delete
 */
function deleteDirectoryRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  // Read all files and subdirectories
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively delete subdirectory
      deleteDirectoryRecursive(fullPath);
    } else {
      // Delete file
      fs.unlinkSync(fullPath);
    }
  }

  // Remove the now-empty directory
  fs.rmdirSync(dirPath);
}

/**
 * Delete a session
 * @param {Array} args - Command arguments
 * @returns {Object} Result
 */
async function deleteCommand(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));

  if (!sessionName) {
    throw new Error('Session name required. Usage: session-cli delete <session-name>');
  }

  const indexManager = new IndexManager();
  const index = indexManager.read();

  // Check if session exists
  const session = index.sessions[sessionName];
  if (!session) {
    throw new Error(`Session '${sessionName}' not found`);
  }

  // Check if it's the active session
  const wasActive = index.activeSession === sessionName;

  // Get session statistics before deletion
  const snapshotCount = session.snapshotCount || 0;
  const filesInvolvedCount = session.filesInvolvedCount || 0;

  // Delete the session directory
  const sessionDir = path.join(indexManager.sessionsDir, sessionName);

  try {
    deleteDirectoryRecursive(sessionDir);
  } catch (error) {
    // Even if directory deletion fails, continue to clean up index
    console.error(`Warning: Error deleting directory: ${error.message}`);
  }

  // Remove from index
  indexManager.removeSession(sessionName);

  return {
    success: true,
    sessionName: sessionName,
    wasActive: wasActive,
    snapshotsDeleted: snapshotCount,
    filesInvolved: filesInvolvedCount,
    message: `Session '${sessionName}' has been deleted`
  };
}

module.exports = deleteCommand;
