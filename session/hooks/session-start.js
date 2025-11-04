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
 */

const fs = require('fs');
const path = require('path');

// Constants
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
const INDEX_FILE = path.join(SESSIONS_DIR, '.index.json');

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

  const { source } = eventData;

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

    // Update the index.json to clear activeSession
    if (fs.existsSync(INDEX_FILE)) {
      try {
        const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
        const index = JSON.parse(indexContent);

        // Clear the active session marker
        index.activeSession = null;

        // Write back to index
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n');
      } catch (indexError) {
        // Continue even if index update fails
      }
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
    console.log(JSON.stringify(output));
  }

  // Exit successfully
  process.exit(0);

} catch (error) {
  // Exit silently on any errors to avoid blocking Claude Code startup
  process.exit(0);
}
