#!/usr/bin/env node

/**
 * SessionStart Hook
 *
 * Handles session state cleanup when /clear is executed.
 * Clears active session markers to prevent confusion when context is lost.
 *
 * Hook receives:
 * - source: "startup" | "resume" | "clear" | "compact"
 * - session_id: string
 * - cwd: string
 * - permission_mode: string
 *
 * SAFETY: Includes graceful failure handling to avoid blocking Claude Code
 * if plugin is uninstalled or dependencies are missing.
 */

const fs = require('fs');
const path = require('path');

// Debug logging to file (safe for hooks - doesn't interfere with stdout/stderr)
const DEBUG = true; // TEMP: Enable to diagnose hook error
const debugLog = (msg) => {
  if (!DEBUG) return;
  const logPath = '/tmp/session-start-hook-debug.log';
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
};

// Graceful failure wrapper - protect against plugin uninstallation
try {
  debugLog('Hook started');

  // Check if critical dependencies exist (indicates plugin is installed)
  const cliLibPath = path.join(__dirname, '../cli/lib');
  if (!fs.existsSync(cliLibPath)) {
    debugLog('cli/lib not found, exiting');
    // Plugin likely uninstalled, exit silently
    process.exit(0);
  }

  // Import IndexManager for safe index updates
  const IndexManager = require('../cli/lib/index-manager');
  debugLog('IndexManager loaded');

  try {
  // Read input from stdin (provided by Claude Code)
  const input = fs.readFileSync(0, 'utf8').trim();
  debugLog(`Input received: ${input.substring(0, 200)}`);

  // Parse the JSON input
  let eventData;
  try {
    eventData = JSON.parse(input);
  } catch (parseError) {
    debugLog(`Parse error: ${parseError.message}`);
    // If parsing fails, exit silently (no input provided)
    process.exit(0);
  }

  const { source, cwd } = eventData;
  debugLog(`source=${source}, cwd=${cwd}`);

  // Construct absolute paths using cwd from event data
  // This ensures hooks work regardless of Claude Code's working directory
  const projectRoot = cwd || process.cwd();
  const SESSIONS_DIR = path.join(projectRoot, '.claude/sessions');
  const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
  debugLog(`SESSIONS_DIR=${SESSIONS_DIR}`);

  const indexManager = new IndexManager(SESSIONS_DIR);
  debugLog('IndexManager instantiated');

  // Only process when source is "clear"
  // Other sources ("startup", "resume", "compact") should allow normal auto-resume
  if (source === 'clear') {
    let sessionName = null;

    // Read the active session name before clearing (for the message)
    if (fs.existsSync(ACTIVE_SESSION_FILE)) {
      try {
        sessionName = fs.readFileSync(ACTIVE_SESSION_FILE, 'utf8').trim();
      } catch (readError) {
        // Continue even if read fails
      }

      // Clear the .active-session file
      try {
        fs.unlinkSync(ACTIVE_SESSION_FILE);
      } catch (unlinkError) {
        // File may already be deleted, continue
      }
    }

    // Update the index.json to clear activeSession using IndexManager
    // This uses proper locking and atomic writes to prevent corruption
    try {
      debugLog('Reading index...');
      const index = indexManager.read({ skipValidation: true });
      debugLog(`Index read, activeSession=${index.activeSession}`);
      index.activeSession = null;
      debugLog('Writing index...');
      indexManager.write(index);
      debugLog('Index written successfully');
    } catch (indexError) {
      debugLog(`IndexManager error: ${indexError.message}\n${indexError.stack}`);
      // Continue even if index update fails
      // This prevents blocking the hook if index is temporarily locked
    }

    // Inject helpful context message to Claude
    const output = {
      hookSpecificOutput: {
        additionalContext: sessionName
          ? `📋 Session '${sessionName}' was auto-closed due to /clear command. The conversation context has been cleared.\n\nTo resume your work on this session, use: /session:continue ${sessionName}\nTo view all sessions, use: /session:list`
          : 'Previous session was auto-closed due to /clear command. Use /session:list to view available sessions.'
      }
    };

    // Output the context injection
    debugLog(`Outputting: ${JSON.stringify(output)}`);
    console.log(JSON.stringify(output));
    debugLog('Output complete');
  }

  // Exit successfully
  debugLog('Exiting with 0');
  process.exit(0);

  } catch (error) {
    debugLog(`Inner catch: ${error.message}\n${error.stack}`);
    // Exit silently on any errors to avoid blocking Claude Code startup
    process.exit(0);
  }
} catch (error) {
  debugLog(`Outer catch: ${error.message}\n${error.stack}`);
  // Outer catch: Handle plugin missing/uninstalled
  // Exit silently to avoid blocking Claude Code
  process.exit(0);
}
