#!/usr/bin/env node
// Intelligent Post-Tool-Use Hook - Tracks file modifications for smart analysis
// Works with async analysis system for intelligent snapshots

const fs = require('fs');
const path = require('path');

// Get tool name from environment (Claude Code provides this)
const toolName = process.env.CLAUDE_TOOL_NAME || 'unknown';

// Only track file modifications
if (toolName !== 'Write' && toolName !== 'Edit') {
  process.exit(0);
}

// Configuration
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');

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

// Initialize state if doesn't exist
let state = {
  file_count: 0,
  interaction_count: 0,
  interactions_since_last_analysis: 0,
  last_snapshot: '',
  last_reason: '',
  last_analysis_timestamp: ''
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

// Update state
// Note: We no longer immediately create snapshot markers here
// Instead, the file_count contributes to analysis queue logic in user-prompt-submit.js
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

process.exit(0);
