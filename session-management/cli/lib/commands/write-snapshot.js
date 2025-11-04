/**
 * Write Snapshot command - Write snapshot file
 * CRITICAL for plan mode support - allows writing via CLI delegation
 */

const SessionWriter = require('../session-writer');
const IndexManager = require('../index-manager');
const fs = require('fs');

/**
 * Parse command arguments
 * @param {Array} args
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const sessionName = args.find(arg => !arg.startsWith('--'));

  const typeIndex = args.indexOf('--type');
  const type = typeIndex >= 0 ? args[typeIndex + 1] : 'manual';

  const contentIndex = args.indexOf('--content');
  const content = contentIndex >= 0 ? args[contentIndex + 1] : null;

  const filenameIndex = args.indexOf('--filename');
  const filename = filenameIndex >= 0 ? args[filenameIndex + 1] : null;

  return {
    sessionName,
    type,
    content,
    filename,
    useStdin: args.includes('--stdin')
  };
}

/**
 * Read content from stdin
 * @returns {Promise<string>} Content from stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Write snapshot file
 * @param {Array} args - Command arguments
 * @returns {Object} Result
 */
async function writeSnapshotCommand(args) {
  const options = parseArgs(args);

  if (!options.sessionName) {
    throw new Error('Session name required. Usage: session-cli write-snapshot <session-name> [options]');
  }

  // Get content from stdin or --content flag
  let content = options.content;

  if (options.useStdin) {
    content = await readStdin();
  }

  if (!content) {
    throw new Error('Content required. Use --stdin or --content "..."');
  }

  // Validate type
  if (!['auto', 'manual'].includes(options.type)) {
    throw new Error('Invalid type. Must be "auto" or "manual"');
  }

  const sessionWriter = new SessionWriter();
  const indexManager = new IndexManager();

  // Write the snapshot
  const result = sessionWriter.writeSnapshot(options.sessionName, content, {
    type: options.type,
    filename: options.filename
  });

  // Update index to reflect new snapshot
  indexManager.updateSession(options.sessionName);

  return {
    success: true,
    ...result
  };
}

module.exports = writeSnapshotCommand;
