#!/usr/bin/env node
// Intelligent Auto-Capture Hook - Triggers intelligent snapshot analysis
// This hook manages async analysis queue and smart snapshot decisions
// Note: Suggestion detection happens during analysis phase, not in hooks

const fs = require('fs');
const path = require('path');

// Configuration
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');

// Living Context Configuration
const CONTEXT_UPDATE_THRESHOLD = 2; // Update context every 2 interactions (lightweight)
const SNAPSHOT_THRESHOLD = 12; // Full snapshot every 12 interactions (heavier)

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

// File paths
const stateFile = path.join(sessionDir, '.auto-capture-state');
const contextUpdateMarkerFile = path.join(sessionDir, '.pending-context-update');
const snapshotMarkerFile = path.join(sessionDir, '.pending-auto-snapshot');

// Initialize state if doesn't exist
let state = {
  file_count: 0,
  interaction_count: 0,
  interactions_since_context_update: 0,
  interactions_since_snapshot: 0,
  last_context_update: '',
  last_snapshot_timestamp: ''
};

if (fs.existsSync(stateFile)) {
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    // Ensure Living Context fields exist
    state.interactions_since_context_update = state.interactions_since_context_update || 0;
    state.interactions_since_snapshot = state.interactions_since_snapshot || 0;
    state.last_context_update = state.last_context_update || '';
    state.last_snapshot_timestamp = state.last_snapshot_timestamp || '';
  } catch (err) {
    // Use default state if parse fails
  }
}

// Increment interaction count
state.interaction_count++;
state.interactions_since_context_update++;
state.interactions_since_snapshot++;

// LIVING CONTEXT SYSTEM: Check for context update and snapshot thresholds
let shouldUpdateContext = false;
let shouldSnapshot = false;

// Context update every N interactions (lightweight, fast)
if (state.interactions_since_context_update >= CONTEXT_UPDATE_THRESHOLD) {
  shouldUpdateContext = true;
}

// Full snapshot every N interactions (heavier, less frequent)
if (state.interactions_since_snapshot >= SNAPSHOT_THRESHOLD) {
  shouldSnapshot = true;
}

// Also trigger snapshot if significant file changes
if (state.file_count >= 3 && state.interactions_since_snapshot >= 5) {
  shouldSnapshot = true;
}

// Create context update marker (lightweight, frequent)
if (shouldUpdateContext) {
  const contextUpdateData = {
    timestamp: new Date().toISOString(),
    interaction_count: state.interaction_count,
    trigger: 'periodic_update'
  };

  fs.writeFileSync(contextUpdateMarkerFile, JSON.stringify(contextUpdateData, null, 2));

  // Reset counter
  state.interactions_since_context_update = 0;
  state.last_context_update = new Date().toISOString();
}

// Create snapshot marker (heavier, less frequent)
if (shouldSnapshot) {
  const snapshotData = {
    timestamp: new Date().toISOString(),
    interaction_count: state.interaction_count,
    file_count: state.file_count,
    trigger: state.file_count >= 3 ? 'file_threshold' : 'interaction_threshold'
  };

  fs.writeFileSync(snapshotMarkerFile, JSON.stringify(snapshotData, null, 2));

  // Reset counters
  state.interactions_since_snapshot = 0;
  state.file_count = 0;
  state.last_snapshot_timestamp = new Date().toISOString();
}

// Update state file
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

process.exit(0);
