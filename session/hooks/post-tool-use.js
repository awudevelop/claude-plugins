#!/usr/bin/env node
// Intelligent Post-Tool-Use Hook - Tracks file modifications for smart analysis
// Works with async analysis system for intelligent snapshots

const fs = require('fs');
const path = require('path');
const LockManager = require('../cli/lib/lock-manager');

// Read tool operation data from stdin (Claude Code provides this as JSON)
// NOTE: Do NOT use process.env.CLAUDE_TOOL_NAME - it's always "unknown" due to Claude Code bug
let toolName = 'unknown';
let filePath = null;

try {
  const input = fs.readFileSync(0, 'utf8').trim();
  if (input) {
    const eventData = JSON.parse(input);

    // Get tool name from stdin data (NOT environment variable)
    toolName = eventData.tool_name || 'unknown';

    // Extract file path from tool input
    // Different tools use different field names for file paths
    if (eventData.tool_input) {
      if (eventData.tool_input.file_path) {
        filePath = eventData.tool_input.file_path;
      } else if (eventData.tool_input.notebook_path) {
        // NotebookEdit uses notebook_path instead of file_path
        filePath = eventData.tool_input.notebook_path;
      }
    }
  }
} catch (err) {
  // If we can't read stdin or parse it, exit early
  process.exit(0);
}

// Only track file modifications (Write, Edit, and NotebookEdit tools)
if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'NotebookEdit') {
  process.exit(0);
}

// Configuration
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
const lockManager = new LockManager(SESSIONS_DIR);

// Exit early if no active session
if (!fs.existsSync(ACTIVE_SESSION_FILE)) {
  process.exit(0);
}

// Read active session name
let activeSession;
try {
  activeSession = fs.readFileSync(ACTIVE_SESSION_FILE, 'utf8').trim();
} catch (err) {
  process.exit(0);
}

if (!activeSession) {
  process.exit(0);
}

const sessionDir = path.join(SESSIONS_DIR, activeSession);
if (!fs.existsSync(sessionDir)) {
  process.exit(0);
}

// Check if auto-capture is enabled
const sessionMd = path.join(sessionDir, 'session.md');
if (fs.existsSync(sessionMd)) {
  try {
    const content = fs.readFileSync(sessionMd, 'utf8');
    if (content.includes('Auto-capture: disabled')) {
      process.exit(0);
    }
  } catch (err) {
    // Continue if we can't read the file
  }
}

// State file
const stateFile = path.join(sessionDir, '.auto-capture-state');

// Use lock to prevent race conditions with user-prompt-submit.js hook
const lock = lockManager.acquireLock(`auto-capture-${activeSession}`, {
  timeout: 1000,
  wait: true
});

if (!lock.acquired) {
  // Could not acquire lock - skip this update to avoid blocking
  // The file will be captured on next tool use
  process.exit(0);
}

try {
  // Initialize state if doesn't exist
  let state = {
    file_count: 0,
    interaction_count: 0,
    interactions_since_last_analysis: 0,
    last_snapshot: '',
    last_reason: '',
    last_analysis_timestamp: '',
    modified_files: []  // Track actual file paths
  };

  if (fs.existsSync(stateFile)) {
    try {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch (err) {
      // Use default state if parse fails
    }
  }

  // Increment file count
  state.file_count++;

  // Track the modified file path if we captured it
  if (filePath) {
    // Initialize modified_files array if it doesn't exist (backward compatibility)
    if (!state.modified_files) {
      state.modified_files = [];
    }

    // Add file to list if not already tracked
    const fileEntry = {
      path: filePath,
      operation: toolName.toLowerCase(),
      timestamp: new Date().toISOString()
    };

    // Avoid duplicates - check if file already in list
    const existingIndex = state.modified_files.findIndex(f => f.path === filePath);
    if (existingIndex >= 0) {
      // Update existing entry with latest operation
      state.modified_files[existingIndex] = fileEntry;
    } else {
      // Add new file
      state.modified_files.push(fileEntry);
    }
  }

  // Update state atomically
  // Note: We no longer immediately create snapshot markers here
  // Instead, the file_count contributes to analysis queue logic in user-prompt-submit.js
  const tempPath = `${stateFile}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, stateFile);
  } catch (writeError) {
    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        // Ignore
      }
    }
    throw writeError;
  }
} finally {
  // Always release lock
  lock.release();
}

process.exit(0);
