#!/usr/bin/env node
// Stop Hook - Captures Claude's complete response for self-contained conversation logs
// This hook fires after Claude completes each response
//
// SAFETY: Includes graceful failure handling to avoid blocking Claude Code
// if plugin is uninstalled or dependencies are missing.

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
  fs.appendFileSync(debugLog, `\n=== Stop Hook called at ${new Date().toISOString()} ===\n`);
} catch (e) { /* ignore */ }

// Read stdin to get transcript path
let stdinData;
try {
  const stdinInput = fs.readFileSync(0, 'utf8').trim();
  if (!stdinInput) {
    process.exit(0);
  }
  stdinData = JSON.parse(stdinInput);
} catch (stdinErr) {
  // Cannot parse stdin, exit silently
  process.exit(0);
}

const transcriptPath = stdinData.transcript_path;

if (!transcriptPath || !fs.existsSync(transcriptPath)) {
  // No transcript path or file doesn't exist
  process.exit(0);
}

// Read transcript file to get Claude's last response
let lastAssistantMessage = null;
try {
  const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');
  const lines = transcriptContent.trim().split('\n');

  // Find last assistant message (search backwards for efficiency)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.role === 'assistant' && entry.content) {
        lastAssistantMessage = entry;
        break;
      }
    } catch (parseErr) {
      // Skip malformed lines
      continue;
    }
  }
} catch (readErr) {
  // Cannot read transcript file
  process.exit(0);
}

if (!lastAssistantMessage) {
  // No assistant message found
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

// Use lock to prevent race conditions
const lockManager = new LockManager(SESSIONS_DIR);
const lock = lockManager.acquireLock(`auto-capture-${activeSession}`, {
  timeout: 1000,
  wait: true
});

if (!lock.acquired) {
  // Could not acquire lock - skip this update to avoid blocking
  process.exit(0);
}

try {
  // Extract tool uses from response
  const toolUses = [];
  if (lastAssistantMessage.content && Array.isArray(lastAssistantMessage.content)) {
    lastAssistantMessage.content.forEach(block => {
      if (block.type === 'tool_use') {
        toolUses.push({
          tool: block.name,
          input: block.input,
          id: block.id || null
        });
      }
    });
  }

  // Helper to extract text from content blocks
  function extractTextContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    return '';
  }

  // Log Claude's response
  const ConversationLogger = require('../cli/lib/conversation-logger');
  const logger = new ConversationLogger(sessionDir);

  logger.logAssistantResponse({
    timestamp: new Date().toISOString(),
    response_text: extractTextContent(lastAssistantMessage.content),
    tools_used: toolUses,
    message_id: lastAssistantMessage.id || null
  });

  // DEBUG: Log success
  try {
    fs.appendFileSync(debugLog, `Successfully logged assistant response\n`);
  } catch (e) { /* ignore */ }

} catch (error) {
  // Silent failure - don't block hook execution
  try {
    fs.appendFileSync(debugLog, `Error in stop hook: ${error.message}\n`);
  } catch (e) { /* ignore */ }
} finally {
  // Always release lock
  lock.release();
}

process.exit(0);

} catch (error) {
  // Outer catch: Handle plugin missing/uninstalled
  // Exit silently to avoid blocking Claude Code
  process.exit(0);
}
