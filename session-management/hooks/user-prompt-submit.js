#!/usr/bin/env node
// Intelligent Auto-Capture Hook - Triggers intelligent snapshot analysis
// This hook manages async analysis queue and smart snapshot decisions
// Note: Suggestion detection happens during analysis phase, not in hooks

const fs = require('fs');
const path = require('path');

// Configuration
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
const ANALYSIS_THRESHOLD = 8; // Queue analysis after 8 interactions (looser than old 10)
const MIN_INTERACTIONS_BETWEEN_ANALYSIS = 3; // Don't analyze too frequently

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
const analysisQueueFile = path.join(sessionDir, '.analysis-queue');
const snapshotDecisionFile = path.join(sessionDir, '.snapshot-decision');
const analysisMarkerFile = path.join(sessionDir, '.pending-analysis');

// Initialize state if doesn't exist
let state = {
  file_count: 0,
  interaction_count: 0,
  interactions_since_last_analysis: 0,
  user_requested_suggestions: 0,
  suggestions_since_snapshot: 0,
  last_snapshot: '',
  last_reason: '',
  last_analysis_timestamp: ''
};

if (fs.existsSync(stateFile)) {
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    // Ensure new fields exist
    state.user_requested_suggestions = state.user_requested_suggestions || 0;
    state.suggestions_since_snapshot = state.suggestions_since_snapshot || 0;
  } catch (err) {
    // Use default state if parse fails
  }
}

// Increment interaction count
state.interaction_count++;
state.interactions_since_last_analysis = (state.interactions_since_last_analysis || 0) + 1;

// STEP 1: Check if there's a snapshot decision from previous analysis
if (fs.existsSync(snapshotDecisionFile)) {
  try {
    const decision = JSON.parse(fs.readFileSync(snapshotDecisionFile, 'utf8'));

    if (decision.decision === 'yes') {
      // Create snapshot marker - Claude will process it
      const markerFile = path.join(sessionDir, '.pending-auto-snapshot');
      fs.writeFileSync(markerFile, 'natural_breakpoint');

      // Reset counters
      state.file_count = 0;
      state.interaction_count = 0;
      state.interactions_since_last_analysis = 0;
      state.last_snapshot = new Date().toISOString();
      state.last_reason = decision.reason || 'natural_breakpoint';
    } else if (decision.decision === 'defer') {
      // Keep counters, will check again soon
      // Don't reset interaction_count, but reset analysis counter
      state.interactions_since_last_analysis = 0;
    } else {
      // Decision was 'no' - reset analysis counter but keep interaction count
      state.interactions_since_last_analysis = 0;
    }

    // Delete decision file (consumed)
    fs.unlinkSync(snapshotDecisionFile);

  } catch (err) {
    // Failed to process decision, delete and continue
    try {
      fs.unlinkSync(snapshotDecisionFile);
    } catch {}
  }
}

// STEP 2: Check if there's a queued analysis ready to process
if (fs.existsSync(analysisQueueFile)) {
  // Create marker to tell Claude to run analysis
  fs.writeFileSync(analysisMarkerFile, 'process');
  state.last_analysis_timestamp = new Date().toISOString();
}

// STEP 3: Check if we should queue a NEW analysis
let shouldQueueAnalysis = false;

// Queue analysis if:
// - Interaction count >= threshold
// - Haven't analyzed too recently
// - No analysis already queued
if (
  state.interaction_count >= ANALYSIS_THRESHOLD &&
  state.interactions_since_last_analysis >= MIN_INTERACTIONS_BETWEEN_ANALYSIS &&
  !fs.existsSync(analysisQueueFile) &&
  !fs.existsSync(analysisMarkerFile)
) {
  shouldQueueAnalysis = true;
}

// Also queue if significant file changes + enough interactions
if (
  state.file_count >= 2 &&
  state.interaction_count >= 5 &&
  state.interactions_since_last_analysis >= MIN_INTERACTIONS_BETWEEN_ANALYSIS &&
  !fs.existsSync(analysisQueueFile) &&
  !fs.existsSync(analysisMarkerFile)
) {
  shouldQueueAnalysis = true;
}

// Queue analysis with context
if (shouldQueueAnalysis) {
  const analysisQueue = {
    timestamp: new Date().toISOString(),
    interaction_count: state.interaction_count,
    file_count: state.file_count,
    interactions_since_last_snapshot: state.interaction_count,
    trigger_reason: state.interaction_count >= ANALYSIS_THRESHOLD ? 'interaction_threshold' : 'file_activity',
    suggestions: {
      count_since_snapshot: state.suggestions_since_snapshot || 0,
      detect_suggestions: true  // Flag for Claude to detect suggestions during analysis
    }
  };

  fs.writeFileSync(analysisQueueFile, JSON.stringify(analysisQueue, null, 2));
}

// Update state file
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

process.exit(0);
