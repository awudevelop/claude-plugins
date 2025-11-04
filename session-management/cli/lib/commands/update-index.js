/**
 * Update Index command - Update metadata index
 */

const IndexManager = require('../index-manager');

/**
 * Parse command arguments
 * @param {Array} args
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const sessionIndex = args.indexOf('--session');
  const sessionName = sessionIndex >= 0 ? args[sessionIndex + 1] : null;

  return {
    sessionName,
    fullRebuild: args.includes('--full-rebuild')
  };
}

/**
 * Update index
 * @param {Array} args - Command arguments
 * @returns {Object} Result
 */
async function updateIndexCommand(args) {
  const options = parseArgs(args);
  const indexManager = new IndexManager();

  if (options.fullRebuild) {
    // Full rebuild
    const index = indexManager.rebuild();
    return {
      success: true,
      action: 'full_rebuild',
      sessionsIndexed: Object.keys(index.sessions).length,
      activeSession: index.activeSession
    };
  } else if (options.sessionName) {
    // Update single session
    indexManager.updateSession(options.sessionName);
    return {
      success: true,
      action: 'update_session',
      sessionName: options.sessionName
    };
  } else {
    // Lazy update - just validate and fix issues
    const validation = indexManager.validate();

    if (!validation.valid) {
      const fixResult = indexManager.fix();
      return {
        success: true,
        action: 'fix_issues',
        issuesFixed: fixResult.fixed,
        details: fixResult.issues
      };
    }

    return {
      success: true,
      action: 'validate',
      message: 'Index is valid, no updates needed'
    };
  }
}

module.exports = updateIndexCommand;
