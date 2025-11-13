#!/usr/bin/env node
/**
 * Background Consolidation Worker (Fallback/Manual Use)
 *
 * NOTE: As of v3.5.1, Claude inline analysis at session boundaries
 * is the default (1-3s wait is acceptable there).
 *
 * This worker is now used for:
 * - Manual consolidation via /session:consolidate
 * - Batch processing multiple sessions
 * - Fallback if Claude analysis fails
 * - Development/testing
 *
 * Runs as a detached background process to consolidate conversation logs
 * into intelligent snapshots without blocking the user.
 *
 * Usage:
 *   node consolidate-worker.js <sessionName> <sessionDir> [configPath]
 *
 * Performance: 1-3 seconds (runs in background, user doesn't wait)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command-line arguments
const [sessionName, sessionDir, configPath] = process.argv.slice(2);

if (!sessionName || !sessionDir) {
  console.error('Usage: consolidate-worker.js <sessionName> <sessionDir> [configPath]');
  process.exit(1);
}

// Main consolidation function
async function consolidate() {
  const errorLogPath = path.join(sessionDir, '.consolidation-errors.log');

  try {
    // Load dependencies
    const ConversationLogger = require('./lib/conversation-logger');
    const AnalysisBackendManager = require('./lib/analysis-backend');

    // Initialize logger
    const logger = new ConversationLogger(sessionDir);

    // Check if log exists
    if (!logger.hasUnconsolidatedLog()) {
      // No log to consolidate - exit silently
      process.exit(0);
    }

    const logPath = logger.getLogPath();
    const logStats = logger.getLogStats();

    // Load configuration
    let config = {
      primaryBackend: 'heuristic', // Default to free, fast analysis
      enableOllama: false,
      enableAnthropicApi: false
    };

    if (configPath && fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        // Use default config
      }
    }

    // Initialize backend manager
    const backend = new AnalysisBackendManager(sessionDir, config);

    // Perform analysis
    const startTime = Date.now();
    const result = await backend.analyze(logPath, sessionName);
    const analysisTime = Date.now() - startTime;

    if (!result.success) {
      throw new Error('Analysis failed: ' + (result.error || 'Unknown error'));
    }

    // Write consolidated snapshot via CLI
    const cliPath = path.join(__dirname, 'session-cli.js');

    if (fs.existsSync(cliPath)) {
      try {
        execSync(`node "${cliPath}" write-snapshot "${sessionName}" --stdin --type auto`, {
          input: result.snapshot,
          encoding: 'utf8',
          stdio: ['pipe', 'ignore', 'pipe'],
          timeout: 5000
        });
      } catch (cliError) {
        throw new Error(`Failed to write snapshot: ${cliError.message}`);
      }
    } else {
      throw new Error('CLI not found at: ' + cliPath);
    }

    // Delete raw log after successful consolidation
    const deleted = logger.deleteLog();

    // Log success (optional, for debugging)
    const successLog = path.join(sessionDir, '.consolidation-log.jsonl');
    const successEntry = {
      timestamp: new Date().toISOString(),
      sessionName: sessionName,
      success: true,
      backend: result.backend,
      interactions: logStats.interactions,
      files: logStats.totalFiles,
      analysisTime: analysisTime,
      logDeleted: deleted,
      spaceSaved: logStats.size
    };

    try {
      fs.appendFileSync(successLog, JSON.stringify(successEntry) + '\n');
    } catch (e) {
      // Ignore logging errors
    }

    process.exit(0);
  } catch (error) {
    // Log error for debugging
    const errorEntry = {
      timestamp: new Date().toISOString(),
      sessionName: sessionName,
      error: error.message,
      stack: error.stack
    };

    try {
      fs.appendFileSync(errorLogPath, JSON.stringify(errorEntry, null, 2) + '\n\n');
    } catch (e) {
      // Can't even log the error - silent failure
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run consolidation
consolidate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
