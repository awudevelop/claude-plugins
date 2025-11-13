#!/usr/bin/env node
// Truly Automatic Auto-Capture Hook - Creates snapshots automatically
// This hook creates snapshot files directly via CLI with NO manual intervention
// Snapshots are created every N interactions or when file thresholds are met
//
// SAFETY: Includes graceful failure handling to avoid blocking Claude Code
// if plugin is uninstalled or dependencies are missing.
//
// ORPHAN DETECTION: Periodically checks for orphaned hooks and auto-cleans them

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

  const LockManager = require('../cli/lib/lock-manager');

// DEBUG: Log hook execution
const debugLog = path.join(require('os').tmpdir(), 'claude-session-hook-debug.log');
try {
  fs.appendFileSync(debugLog, `\n=== Hook called at ${new Date().toISOString()} ===\n`);
  fs.appendFileSync(debugLog, `CWD: ${process.cwd()}\n`);
  fs.appendFileSync(debugLog, `PLUGIN_ROOT: ${process.env.CLAUDE_PLUGIN_ROOT}\n`);
} catch (e) { /* ignore */ }

// Configuration
const SESSIONS_DIR = '.claude/sessions';
const ACTIVE_SESSION_FILE = path.join(SESSIONS_DIR, '.active-session');
const lockManager = new LockManager(SESSIONS_DIR);

// DEBUG: Log session detection
try {
  fs.appendFileSync(debugLog, `Looking for: ${path.resolve(ACTIVE_SESSION_FILE)}\n`);
  fs.appendFileSync(debugLog, `Exists: ${fs.existsSync(ACTIVE_SESSION_FILE)}\n`);
} catch (e) { /* ignore */ }

// Living Context Configuration
const CONTEXT_UPDATE_THRESHOLD = 2; // Update context every 2 interactions (lightweight)
const SNAPSHOT_THRESHOLD = 5; // Full snapshot every 5 interactions (heavier)

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

// Use lock to prevent race conditions during state read-modify-write
const lock = lockManager.acquireLock(`auto-capture-${activeSession}`, {
  timeout: 1000,
  wait: true
});

if (!lock.acquired) {
  // Could not acquire lock - skip this update to avoid blocking
  // The next interaction will pick up the count
  process.exit(0);
}

try {
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

  // Context update - currently disabled (snapshots contain all needed info)
  // Can be re-enabled later if needed for more frequent lightweight updates
  if (shouldUpdateContext) {
    // Reset counter to prevent continuous triggering
    state.interactions_since_context_update = 0;
    state.last_context_update = new Date().toISOString();

    // Future: Could add lightweight context updates here if needed
    // For now, auto-snapshots (every 5 interactions) are sufficient
  }

  // Create snapshot automatically (heavier, less frequent)
  if (shouldSnapshot) {
    const timestamp = new Date().toISOString();
    const trigger = state.file_count >= 3 ? 'file_threshold' : 'interaction_threshold';

    // Generate snapshot content
    const modifiedFilesList = (state.modified_files || [])
      .map(f => `- ${f.path} (${f.operation}) - ${f.timestamp}`)
      .join('\n');

    const snapshotContent = `# Auto-Snapshot: ${activeSession}
**Timestamp**: ${timestamp}
**Auto-Generated**: Yes
**Trigger**: ${trigger}

## State
- Interaction count: ${state.interaction_count}
- Files modified: ${state.file_count}
- Interactions since last snapshot: ${state.interactions_since_snapshot}

## Modified Files
${modifiedFilesList || 'None'}

## Notes
Auto-generated snapshot created by session hooks. For detailed context with conversation summaries, use manual snapshots with \`/session save\`.
`;

    // Write snapshot directly via CLI (truly automatic, no manual intervention)
    try {
      const { execSync } = require('child_process');
      const pluginRoot = path.dirname(__dirname);
      const cliPath = path.join(pluginRoot, 'cli', 'session-cli.js');

      if (fs.existsSync(cliPath)) {
        execSync(`node "${cliPath}" write-snapshot "${activeSession}" --stdin --type auto`, {
          input: snapshotContent,
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: ['pipe', 'ignore', 'ignore'],  // Silent execution
          timeout: 5000  // 5 second timeout
        });
      }
    } catch (err) {
      // Silent failure - don't block hook execution
    }

    // Process auto-captured files and update session.md
    try {
      const { execSync } = require('child_process');
      const pluginRoot = path.dirname(__dirname);
      const processorPath = path.join(pluginRoot, 'cli', 'process-auto-capture.js');

      if (fs.existsSync(processorPath)) {
        execSync(`node "${processorPath}" "${activeSession}"`, {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'ignore'  // Silent execution, don't block
        });
      }
    } catch (err) {
      // Silent failure - don't block hook execution
    }

    // Reset counters
    state.interactions_since_snapshot = 0;
    state.file_count = 0;
    state.modified_files = [];  // Clear modified files list after snapshot
    state.last_snapshot_timestamp = timestamp;
  }

  // Update state file atomically
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

  // ORPHAN DETECTION: Check for orphaned hooks every 20 prompts
  // This auto-cleans up hooks if plugin was uninstalled without cleanup
  try {
    const orphanCheckFile = path.join(SESSIONS_DIR, '.orphan-check-counter');
    let checkCounter = 0;

    if (fs.existsSync(orphanCheckFile)) {
      try {
        checkCounter = parseInt(fs.readFileSync(orphanCheckFile, 'utf8').trim(), 10) || 0;
      } catch (e) {
        // Use default
      }
    }

    checkCounter++;

    // Check every 20 prompts
    if (checkCounter >= 20) {
      const HooksManager = require('../cli/lib/hooks-manager');
      const pluginRoot = path.dirname(__dirname);
      const manager = new HooksManager(process.cwd());

      // Detect orphaned hooks
      const settings = manager.readSettings();
      const orphaned = manager.detectOrphanedHooks(settings, pluginRoot);

      if (orphaned.length > 0) {
        // Auto-cleanup orphaned hooks
        const cleaned = manager.removePluginHooks(settings, pluginRoot);
        manager.createBackup();
        manager.writeSettings(cleaned);

        // NOTE: We cannot inject context here as this is UserPromptSubmit hook
        // The cleanup happens silently in the background
      }

      checkCounter = 0; // Reset counter
    }

    // Write counter back
    fs.writeFileSync(orphanCheckFile, checkCounter.toString());
  } catch (orphanError) {
    // Silent failure - don't block hook execution
  }

  process.exit(0);

} catch (error) {
  // Outer catch: Handle plugin missing/uninstalled
  // Exit silently to avoid blocking Claude Code
  process.exit(0);
}
