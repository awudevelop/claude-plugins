#!/usr/bin/env node

/**
 * SessionEnd Hook
 *
 * Handles cleanup when Claude Code session terminates.
 * Ensures .active-session file is removed and index is updated.
 *
 * Hook receives:
 * - session_id: string
 * - transcript_path: string
 * - cwd: string
 * - permission_mode: string
 * - hook_event_name: "SessionEnd"
 * - reason: "exit" | "clear" | "logout" | "prompt_input_exit" | "other"
 *
 * SAFETY: Includes graceful failure handling to avoid blocking Claude Code shutdown
 * if plugin is uninstalled or dependencies are missing.
 */

const fs = require('fs');
const path = require('path');

// Graceful failure wrapper - protect against plugin uninstallation
try {
  // Check if critical dependencies exist (indicates plugin is installed)
  const cliLibPath = path.join(__dirname, '../cli/lib');
  if (!fs.existsSync(cliLibPath)) {
    // Plugin likely uninstalled, exit silently
    process.exit(0);
  }

  const IndexManager = require('../cli/lib/index-manager');

  // Constants
  const SESSIONS_DIR = '.claude/sessions';
  const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
  const indexManager = new IndexManager(SESSIONS_DIR);

  // DEBUG: Log hook execution
  const debugLog = path.join(require('os').tmpdir(), 'claude-session-hook-debug.log');
  try {
    fs.appendFileSync(debugLog, `\n=== SessionEnd Hook called at ${new Date().toISOString()} ===\n`);
  } catch (e) { /* ignore */ }

  try {
    // Read input from stdin (provided by Claude Code)
    const input = fs.readFileSync(0, 'utf8').trim();

    // Parse the JSON input
    let eventData;
    try {
      eventData = JSON.parse(input);
    } catch (parseError) {
      // If parsing fails, exit silently (no input provided)
      process.exit(0);
    }

    const { reason, session_id } = eventData;

    // DEBUG: Log event details
    try {
      fs.appendFileSync(debugLog, `Reason: ${reason}\n`);
      fs.appendFileSync(debugLog, `Session ID: ${session_id}\n`);
      fs.appendFileSync(debugLog, `Active session file exists: ${fs.existsSync(ACTIVE_SESSION_FILE)}\n`);
    } catch (e) { /* ignore */ }

    // Clean up active session marker
    let sessionName = null;

    if (fs.existsSync(ACTIVE_SESSION_FILE)) {
      try {
        sessionName = fs.readFileSync(ACTIVE_SESSION_FILE, 'utf8').trim();

        // DEBUG: Log session name
        try {
          fs.appendFileSync(debugLog, `Cleaning up session: ${sessionName}\n`);
        } catch (e) { /* ignore */ }
      } catch (readError) {
        // Continue even if read fails
      }

      // Delete the .active-session file
      try {
        fs.unlinkSync(ACTIVE_SESSION_FILE);

        // DEBUG: Log deletion
        try {
          fs.appendFileSync(debugLog, `Deleted .active-session file\n`);
        } catch (e) { /* ignore */ }
      } catch (unlinkError) {
        // File may already be deleted, continue
        try {
          fs.appendFileSync(debugLog, `Failed to delete .active-session: ${unlinkError.message}\n`);
        } catch (e) { /* ignore */ }
      }
    }

    // Update the index.json to clear activeSession using IndexManager
    // This uses proper locking and atomic writes to prevent corruption
    try {
      const index = indexManager.read({ skipValidation: true });
      index.activeSession = null;
      indexManager.write(index);

      // DEBUG: Log index update
      try {
        fs.appendFileSync(debugLog, `Updated index.json to clear activeSession\n`);
      } catch (e) { /* ignore */ }
    } catch (indexError) {
      // Continue even if index update fails
      // This prevents blocking the hook if index is temporarily locked
      try {
        fs.appendFileSync(debugLog, `Failed to update index: ${indexError.message}\n`);
      } catch (e) { /* ignore */ }
    }

    // Log successful cleanup
    try {
      const reasonText = reason === 'exit' ? 'normal exit' :
                        reason === 'clear' ? '/clear command' :
                        reason === 'logout' ? 'user logout' :
                        reason === 'prompt_input_exit' ? 'prompt exit' : reason;

      fs.appendFileSync(debugLog, `✓ SessionEnd cleanup complete (${reasonText})\n`);

      if (sessionName) {
        fs.appendFileSync(debugLog, `  Session '${sessionName}' cleaned up successfully\n`);
      }
    } catch (e) { /* ignore */ }

    // Exit successfully
    process.exit(0);

  } catch (error) {
    // Exit silently on any errors to avoid blocking Claude Code shutdown
    try {
      fs.appendFileSync(debugLog, `Error in SessionEnd hook: ${error.message}\n`);
    } catch (e) { /* ignore */ }
    process.exit(0);
  }
} catch (error) {
  // Outer catch: Handle plugin missing/uninstalled
  // Exit silently to avoid blocking Claude Code
  process.exit(0);
}
