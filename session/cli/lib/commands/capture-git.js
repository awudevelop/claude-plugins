const fs = require('fs');
const path = require('path');
const GitHistorian = require('../git-historian');

/**
 * Capture git history for a session
 *
 * Usage:
 *   session-cli capture-git <session-name>
 *
 * @param {string[]} args - Command arguments
 * @returns {object} Result object
 */
async function captureGit(args) {
  if (args.length === 0) {
    throw new Error('Session name required. Usage: capture-git <session-name>');
  }

  const sessionName = args[0];
  const sessionsDir = path.join(process.cwd(), '.claude', 'sessions');
  const sessionDir = path.join(sessionsDir, sessionName);

  // Check if session exists
  if (!fs.existsSync(sessionDir)) {
    throw new Error(`Session '${sessionName}' not found`);
  }

  // Create GitHistorian instance
  const gh = new GitHistorian(sessionDir);

  // Check if git repo exists
  if (!gh.hasGitRepo()) {
    return {
      success: false,
      reason: 'no-git',
      message: 'Not a git repository'
    };
  }

  // Capture git history
  const success = gh.writeSnapshot(sessionName);
  const outputPath = path.join(sessionDir, 'git-history.json');

  // Get file size if successful
  let fileSize = 0;
  let fileSizeKB = 0;
  if (success && fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    fileSize = stats.size;
    fileSizeKB = Math.round(fileSize / 1024 * 10) / 10;
  }

  return {
    success,
    path: outputPath,
    size: fileSize,
    sizeKB: fileSizeKB,
    message: success ? 'Git history captured' : 'Failed to capture git history'
  };
}

module.exports = captureGit;
