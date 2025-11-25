/**
 * Update Logger & Audit Trail
 *
 * Logs all plan update operations for audit and recovery purposes.
 * Stores logs in JSONL format with support for:
 * - Timestamps and operation types
 * - Before/after snapshots
 * - Success/failure status
 * - Query by date/operation
 * - Auto-rotation when logs exceed 10MB
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ROTATED_LOGS: 5,            // Keep 5 rotated logs
  LOG_FILENAME: 'update-history.jsonl',
  SNAPSHOT_MAX_SIZE: 50 * 1024    // Max 50KB per snapshot
};

/**
 * @typedef {Object} LogEntry
 * @property {string} id - Unique entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} planId - Plan being updated
 * @property {string} operationType - Type of operation (add/update/delete)
 * @property {string} target - Target type (metadata/phase/task)
 * @property {string} targetId - Target ID
 * @property {string} user - Username performing the operation
 * @property {Object} before - State before operation (snapshot)
 * @property {Object} after - State after operation (snapshot)
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} QueryOptions
 * @property {Date|string} [startDate] - Filter by start date
 * @property {Date|string} [endDate] - Filter by end date
 * @property {string} [operationType] - Filter by operation type
 * @property {string} [target] - Filter by target type
 * @property {string} [targetId] - Filter by target ID
 * @property {boolean} [successOnly] - Only successful operations
 * @property {boolean} [failedOnly] - Only failed operations
 * @property {number} [limit] - Maximum entries to return
 * @property {number} [offset] - Skip N entries
 */

/**
 * Gets the log file path for a plan
 * @param {string} planDir - Plan directory path
 * @returns {string} Log file path
 */
function getLogPath(planDir) {
  return path.join(planDir, CONFIG.LOG_FILENAME);
}

/**
 * Generates a unique log entry ID
 * @returns {string} Unique ID
 */
function generateEntryId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `log-${timestamp}-${random}`;
}

/**
 * Gets the current username
 * @returns {string} Username
 */
function getUsername() {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || 'unknown';
}

/**
 * Creates a snapshot of an object, truncating if too large
 * @param {Object} obj - Object to snapshot
 * @param {number} maxSize - Maximum size in bytes
 * @returns {Object} Snapshot
 */
function createSnapshot(obj, maxSize = CONFIG.SNAPSHOT_MAX_SIZE) {
  if (!obj) return null;

  const json = JSON.stringify(obj);
  if (json.length <= maxSize) {
    return obj;
  }

  // Truncate and indicate truncation
  return {
    _truncated: true,
    _originalSize: json.length,
    _preview: JSON.parse(json.substring(0, maxSize - 100) + '..."')
  };
}

/**
 * Logs an update operation
 * @param {string} planDir - Plan directory path
 * @param {Object} operation - Operation details
 * @param {Object} options - Additional options
 * @returns {Promise<LogEntry>} Created log entry
 */
async function logOperation(planDir, operation, options = {}) {
  const entry = {
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
    planId: path.basename(planDir),
    operationType: operation.type,
    target: operation.target,
    targetId: operation.data?.id || operation.data?.name || null,
    user: options.user || getUsername(),
    before: createSnapshot(options.before),
    after: createSnapshot(options.after),
    success: options.success !== false,
    error: options.error || null,
    metadata: {
      mode: options.mode || 'rollback',
      force: options.force || false,
      source: options.source || 'cli', // cli, api, nl
      ...options.metadata
    }
  };

  await appendEntry(planDir, entry);
  return entry;
}

/**
 * Logs the start of a batch operation
 * @param {string} planDir - Plan directory path
 * @param {Array<Object>} operations - Operations to execute
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Batch ID
 */
async function logBatchStart(planDir, operations, options = {}) {
  const batchId = generateEntryId().replace('log-', 'batch-');

  const entry = {
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
    planId: path.basename(planDir),
    operationType: 'batch_start',
    target: 'batch',
    targetId: batchId,
    user: options.user || getUsername(),
    before: null,
    after: null,
    success: true,
    error: null,
    metadata: {
      batchId,
      operationCount: operations.length,
      mode: options.mode || 'rollback',
      operationSummary: operations.map(op => ({
        type: op.type,
        target: op.target,
        id: op.data?.id
      }))
    }
  };

  await appendEntry(planDir, entry);
  return batchId;
}

/**
 * Logs the completion of a batch operation
 * @param {string} planDir - Plan directory path
 * @param {string} batchId - Batch ID from logBatchStart
 * @param {Object} result - Execution result
 * @param {Object} options - Additional options
 * @returns {Promise<LogEntry>} Created log entry
 */
async function logBatchComplete(planDir, batchId, result, options = {}) {
  const entry = {
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
    planId: path.basename(planDir),
    operationType: 'batch_complete',
    target: 'batch',
    targetId: batchId,
    user: options.user || getUsername(),
    before: null,
    after: null,
    success: result.success,
    error: result.error || null,
    metadata: {
      batchId,
      completed: result.completed?.length || 0,
      failed: result.failed?.length || 0,
      rolledBack: result.rollback?.performed || false,
      backupPath: result.backupPath || null,
      duration: options.duration || null
    }
  };

  await appendEntry(planDir, entry);
  return entry;
}

/**
 * Appends a log entry to the log file
 * @param {string} planDir - Plan directory path
 * @param {LogEntry} entry - Entry to append
 */
async function appendEntry(planDir, entry) {
  const logPath = getLogPath(planDir);

  // Ensure plan directory exists
  await fs.mkdir(planDir, { recursive: true });

  // Check if rotation is needed
  await rotateIfNeeded(planDir);

  // Append entry
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(logPath, line, 'utf8');
}

/**
 * Rotates log file if it exceeds max size
 * @param {string} planDir - Plan directory path
 */
async function rotateIfNeeded(planDir) {
  const logPath = getLogPath(planDir);

  try {
    const stats = await fs.stat(logPath);
    if (stats.size < CONFIG.MAX_LOG_SIZE) {
      return; // No rotation needed
    }

    // Rotate logs
    for (let i = CONFIG.MAX_ROTATED_LOGS - 1; i >= 0; i--) {
      const oldPath = i === 0 ? logPath : `${logPath}.${i}`;
      const newPath = `${logPath}.${i + 1}`;

      try {
        await fs.access(oldPath);
        if (i === CONFIG.MAX_ROTATED_LOGS - 1) {
          // Delete oldest log
          await fs.unlink(oldPath);
        } else {
          // Rename to next number
          await fs.rename(oldPath, newPath);
        }
      } catch (error) {
        // File doesn't exist, skip
      }
    }

    // Create new empty log file
    await fs.writeFile(logPath, '', 'utf8');
  } catch (error) {
    // Log file doesn't exist yet, no rotation needed
  }
}

/**
 * Queries the log file
 * @param {string} planDir - Plan directory path
 * @param {QueryOptions} options - Query options
 * @returns {Promise<Array<LogEntry>>} Matching entries
 */
async function queryLog(planDir, options = {}) {
  const logPath = getLogPath(planDir);
  const entries = [];

  try {
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Apply filters
        if (!matchesFilters(entry, options)) {
          continue;
        }

        entries.push(entry);
      } catch (error) {
        // Skip malformed lines
        console.warn('Skipping malformed log entry');
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // No log file yet
    }
    throw error;
  }

  // Apply offset and limit
  let result = entries;

  if (options.offset) {
    result = result.slice(options.offset);
  }

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Checks if an entry matches the query filters
 * @param {LogEntry} entry - Log entry
 * @param {QueryOptions} options - Query options
 * @returns {boolean} True if matches
 */
function matchesFilters(entry, options) {
  // Date filters
  if (options.startDate) {
    const start = new Date(options.startDate);
    if (new Date(entry.timestamp) < start) {
      return false;
    }
  }

  if (options.endDate) {
    const end = new Date(options.endDate);
    if (new Date(entry.timestamp) > end) {
      return false;
    }
  }

  // Operation type filter
  if (options.operationType && entry.operationType !== options.operationType) {
    return false;
  }

  // Target filter
  if (options.target && entry.target !== options.target) {
    return false;
  }

  // Target ID filter
  if (options.targetId && entry.targetId !== options.targetId) {
    return false;
  }

  // Success/failure filters
  if (options.successOnly && !entry.success) {
    return false;
  }

  if (options.failedOnly && entry.success) {
    return false;
  }

  return true;
}

/**
 * Gets log statistics
 * @param {string} planDir - Plan directory path
 * @returns {Promise<Object>} Log statistics
 */
async function getLogStats(planDir) {
  const logPath = getLogPath(planDir);
  const stats = {
    totalEntries: 0,
    successfulOps: 0,
    failedOps: 0,
    byOperationType: {},
    byTarget: {},
    firstEntry: null,
    lastEntry: null,
    fileSizeBytes: 0,
    rotatedFiles: 0
  };

  try {
    const fileStats = await fs.stat(logPath);
    stats.fileSizeBytes = fileStats.size;

    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        stats.totalEntries++;

        if (entry.success) {
          stats.successfulOps++;
        } else {
          stats.failedOps++;
        }

        // Count by operation type
        stats.byOperationType[entry.operationType] =
          (stats.byOperationType[entry.operationType] || 0) + 1;

        // Count by target
        stats.byTarget[entry.target] =
          (stats.byTarget[entry.target] || 0) + 1;

        // Track first/last entries
        if (!stats.firstEntry || entry.timestamp < stats.firstEntry) {
          stats.firstEntry = entry.timestamp;
        }
        if (!stats.lastEntry || entry.timestamp > stats.lastEntry) {
          stats.lastEntry = entry.timestamp;
        }
      } catch (error) {
        // Skip malformed lines
      }
    }

    // Count rotated files
    for (let i = 1; i <= CONFIG.MAX_ROTATED_LOGS; i++) {
      try {
        await fs.access(`${logPath}.${i}`);
        stats.rotatedFiles++;
      } catch (error) {
        break;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return stats;
}

/**
 * Gets recent entries from the log
 * @param {string} planDir - Plan directory path
 * @param {number} count - Number of entries to get
 * @returns {Promise<Array<LogEntry>>} Recent entries (newest first)
 */
async function getRecentEntries(planDir, count = 10) {
  const entries = await queryLog(planDir, {});
  return entries.slice(-count).reverse();
}

/**
 * Gets entries for a specific batch
 * @param {string} planDir - Plan directory path
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array<LogEntry>>} Batch entries
 */
async function getBatchEntries(planDir, batchId) {
  const entries = await queryLog(planDir, {});
  return entries.filter(e =>
    e.targetId === batchId ||
    e.metadata?.batchId === batchId
  );
}

/**
 * Clears the log file (for testing)
 * @param {string} planDir - Plan directory path
 */
async function clearLog(planDir) {
  const logPath = getLogPath(planDir);
  try {
    await fs.unlink(logPath);

    // Also remove rotated files
    for (let i = 1; i <= CONFIG.MAX_ROTATED_LOGS; i++) {
      try {
        await fs.unlink(`${logPath}.${i}`);
      } catch (error) {
        // File doesn't exist
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Exports log to different formats
 * @param {string} planDir - Plan directory path
 * @param {string} format - Export format (json, csv, markdown)
 * @param {QueryOptions} options - Query options
 * @returns {Promise<string>} Exported content
 */
async function exportLog(planDir, format = 'json', options = {}) {
  const entries = await queryLog(planDir, options);

  switch (format) {
    case 'json':
      return JSON.stringify(entries, null, 2);

    case 'csv':
      return exportToCsv(entries);

    case 'markdown':
      return exportToMarkdown(entries);

    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

/**
 * Exports entries to CSV format
 * @param {Array<LogEntry>} entries - Log entries
 * @returns {string} CSV content
 */
function exportToCsv(entries) {
  const headers = ['id', 'timestamp', 'planId', 'operationType', 'target', 'targetId', 'user', 'success', 'error'];
  const lines = [headers.join(',')];

  for (const entry of entries) {
    const row = headers.map(h => {
      const value = entry[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Exports entries to Markdown format
 * @param {Array<LogEntry>} entries - Log entries
 * @returns {string} Markdown content
 */
function exportToMarkdown(entries) {
  const lines = ['# Update History Log', ''];

  for (const entry of entries) {
    const status = entry.success ? ':white_check_mark:' : ':x:';
    lines.push(`## ${status} ${entry.operationType.toUpperCase()} ${entry.target}`);
    lines.push('');
    lines.push(`- **ID:** ${entry.id}`);
    lines.push(`- **Time:** ${entry.timestamp}`);
    lines.push(`- **Target:** ${entry.targetId || 'N/A'}`);
    lines.push(`- **User:** ${entry.user}`);
    lines.push(`- **Success:** ${entry.success}`);

    if (entry.error) {
      lines.push(`- **Error:** ${entry.error}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  logOperation,
  logBatchStart,
  logBatchComplete,
  queryLog,
  getLogStats,
  getRecentEntries,
  getBatchEntries,
  clearLog,
  exportLog,
  // Export for testing
  getLogPath,
  generateEntryId,
  createSnapshot,
  rotateIfNeeded,
  CONFIG
};
