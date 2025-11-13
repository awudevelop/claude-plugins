#!/usr/bin/env node

/**
 * Session Management CLI Tool
 *
 * Lightweight Node.js CLI for managing Claude Code sessions.
 * Handles file I/O, metadata indexing, and data management without Claude involvement.
 *
 * Usage:
 *   node session-cli.js <command> [options]
 *
 * Commands:
 *   list                    List all sessions
 *   get <name>              Get session details
 *   activate <name>         Activate a session
 *   delete <name>           Delete a session permanently
 *   update-index            Update metadata index
 *   validate                Validate index integrity
 *   stats <name>            Get session statistics
 *   stats-all               Get statistics for all sessions
 *   write-snapshot          Write snapshot file
 *   get-state <name>        Get session state
 *   update-state <name>     Update session state
 *   capture-git <name>      Capture git history in compressed format
 */

const fs = require('fs');
const path = require('path');

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  SESSION_NOT_FOUND: 2,
  INVALID_ARGUMENTS: 3,
  FILE_SYSTEM_ERROR: 4,
  INDEX_CORRUPTION: 5
};

// Command handlers
const commands = {
  list: require('./lib/commands/list'),
  get: require('./lib/commands/get'),
  activate: require('./lib/commands/activate'),
  delete: require('./lib/commands/delete'),
  'update-index': require('./lib/commands/update-index'),
  validate: require('./lib/commands/validate'),
  stats: require('./lib/commands/stats'),
  'stats-all': require('./lib/commands/stats-all'),
  'write-snapshot': require('./lib/commands/write-snapshot'),
  'get-state': require('./lib/commands/get-state'),
  'update-state': require('./lib/commands/update-state'),
  'setup-hooks': require('./lib/commands/setup-hooks'),
  'capture-git': require('./lib/commands/capture-git')
};

/**
 * Display help text
 */
function showHelp() {
  console.log(`
Session Management CLI Tool

Usage:
  session-cli <command> [options]

Commands:
  list [--json] [--active-only]
      List all sessions with metadata

  get <session-name> [--include-snapshots]
      Get detailed information about a specific session

  activate <session-name>
      Set a session as active

  delete <session-name>
      Delete a session permanently (cannot be undone)

  update-index [--session <name>] [--full-rebuild]
      Update the metadata index

  validate [--fix]
      Validate index integrity and optionally fix issues

  stats <session-name> [--detailed]
      Get statistics for a specific session

  stats-all
      Get statistics for all sessions

  write-snapshot <session-name> [--type auto|manual] [--stdin] [--content "..."]
      Write a snapshot file (content via stdin or --content flag)

  get-state <session-name>
      Get auto-capture state for a session

  update-state <session-name> <json-data>
      Update session state with JSON data

  setup-hooks [--remove] [--status] [--force-cleanup] [--dry-run]
      Manage session plugin hooks in .claude/settings.json
      --remove: Remove hooks instead of installing
      --status: Show current hook configuration
      --force-cleanup: Clean up orphaned hooks
      --dry-run: Preview changes without applying

  capture-git <session-name>
      Capture git history in compressed JSON format (~2-3KB)

Options:
  --help              Show this help message
  --version           Show version information
  --json              Output in JSON format

Exit Codes:
  0  Success
  1  General error
  2  Session not found
  3  Invalid arguments
  4  File system error
  5  Index corruption

Examples:
  session-cli list --json
  session-cli get my-session --include-snapshots
  session-cli activate my-session
  session-cli update-index --full-rebuild
  echo "snapshot content" | session-cli write-snapshot my-session --stdin --type auto
`);
}

/**
 * Show version information
 */
function showVersion() {
  const pkg = require('./package.json');
  console.log(`Session CLI v${pkg.version}`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle no arguments or help flag
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Check if command exists
  if (!commands.hasOwnProperty(command)) {
    console.error(`Error: Unknown command '${command}'`);
    console.error('Run "session-cli --help" for usage information');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  // Check if command is implemented
  const handler = commands[command];
  if (!handler) {
    console.error(`Error: Command '${command}' not yet implemented`);
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  // Execute command
  try {
    const result = await handler(commandArgs);

    // Output result if present
    if (result !== undefined && result !== null) {
      if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Handle known error types
    if (error.code === 'ENOENT') {
      console.error(`Error: File or directory not found - ${error.path}`);
      process.exit(EXIT_CODES.FILE_SYSTEM_ERROR);
    } else if (error.code === 'EACCES') {
      console.error(`Error: Permission denied - ${error.path}`);
      process.exit(EXIT_CODES.FILE_SYSTEM_ERROR);
    } else if (error.message && error.message.includes('not found')) {
      console.error(`Error: ${error.message}`);
      process.exit(EXIT_CODES.SESSION_NOT_FOUND);
    } else if (error.message && error.message.includes('Index corrupt')) {
      console.error(`Error: ${error.message}`);
      process.exit(EXIT_CODES.INDEX_CORRUPTION);
    } else {
      console.error(`Error: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { EXIT_CODES };
