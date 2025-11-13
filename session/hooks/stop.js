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

// Read transcript file to get Claude's last response (with exponential backoff retry)
// Uses smart retry strategy: fast success path (0-50ms), patient for edge cases (750ms max)
const MAX_RETRIES = 5;
const RETRY_DELAYS = [0, 50, 100, 200, 400]; // Exponential backoff in milliseconds

function tryFindAssistantMessage() {
  try {
    const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');
    const lines = transcriptContent.trim().split('\n');

    // Find last assistant message (search backwards for efficiency)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        // Claude Code transcript format: {type: 'assistant', message: {role, content}}
        if (entry.type === 'assistant' && entry.message) {
          return entry.message; // Return the message object which has role and content
        }
      } catch (parseErr) {
        // Skip malformed lines
        continue;
      }
    }
    return null;
  } catch (readErr) {
    return null;
  }
}

// Sleep function for retry delays
function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy wait (acceptable for short delays in hooks)
  }
}

// Try to find assistant message with exponential backoff retries
let lastAssistantMessage = null;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  lastAssistantMessage = tryFindAssistantMessage();

  if (lastAssistantMessage) {
    break;
  }

  // If not found and not last attempt, wait with exponential backoff
  if (attempt < MAX_RETRIES) {
    const nextDelay = RETRY_DELAYS[attempt]; // Next delay for next attempt
    sleep(nextDelay);
  }
}

if (!lastAssistantMessage) {
  // No assistant message found after all retries
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

  const responseText = extractTextContent(lastAssistantMessage.content);

  // Log Claude's response
  const ConversationLogger = require('../cli/lib/conversation-logger');
  const logger = new ConversationLogger(sessionDir);

  logger.logAssistantResponse({
    timestamp: new Date().toISOString(),
    response_text: responseText,
    tools_used: toolUses,
    message_id: lastAssistantMessage.id || null
  });

} catch (error) {
  // Silent failure - don't block hook execution
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
