const fs = require('fs');
const path = require('path');

/**
 * ConversationLogger - Handles incremental conversation logging
 *
 * Captures conversation interactions in JSONL format for later consolidation.
 * Designed for minimal overhead (<2ms per interaction).
 */
class ConversationLogger {
  constructor(sessionDir) {
    this.sessionDir = sessionDir;
    this.logFile = path.join(sessionDir, 'conversation-log.jsonl');
  }

  /**
   * Check if unconsolidated log exists
   * @returns {boolean}
   */
  hasUnconsolidatedLog() {
    return fs.existsSync(this.logFile);
  }

  /**
   * Log a single interaction
   * Performance target: <2ms
   *
   * COMPACT FORMAT (v3.8.9+):
   * - ts: Unix timestamp (seconds)
   * - p: User prompt
   * - f: Modified files as [[path, status_code], ...]
   *
   * @param {object} interaction - Interaction data
   * @param {string} interaction.timestamp - ISO timestamp
   * @param {string} interaction.user_prompt - User's message text
   * @param {Array} interaction.modified_files - Files modified since last snapshot
   */
  logInteraction(interaction) {
    try {
      // COMPACT FORMAT - 61% size reduction
      const entry = {
        ts: Math.floor(Date.now() / 1000),  // Unix seconds
        p: interaction.user_prompt || null
      };

      // Add files if present (array format for compactness)
      const files = interaction.modified_files || interaction.state?.modified_files || [];
      if (files.length > 0) {
        entry.f = files.map(file => [
          file.path,
          this._statusToCode(file.status)
        ]);
      }

      // Remove null values to save space
      if (!entry.p) delete entry.p;

      // Append to log file (JSONL format - one JSON object per line)
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, line, 'utf8');

      return true;
    } catch (error) {
      // Silent failure - don't block hook execution
      return false;
    }
  }

  /**
   * Log Claude's assistant response (called from Stop hook)
   * Performance target: <5ms
   *
   * COMPACT FORMAT (v3.8.9+):
   * - ts: Unix timestamp (seconds)
   * - r: Response text
   * - tl: Tool names only (no input details)
   *
   * @param {object} response - Response data
   * @param {string} response.response_text - Claude's response text
   * @param {Array} response.tools_used - Tools used in response [{tool, input, id}]
   */
  logAssistantResponse(response) {
    try {
      // COMPACT FORMAT - 53% size reduction
      const entry = {
        ts: Math.floor(Date.now() / 1000),  // Unix seconds
        r: response.response_text || ''
      };

      // Only include tool names (not input details) to save tokens
      if (response.tools_used && response.tools_used.length > 0) {
        entry.tl = response.tools_used.map(t => t.tool);
      }

      // Append to log file (JSONL format - one JSON object per line)
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, line, 'utf8');

      return true;
    } catch (error) {
      // Silent failure - don't block hook execution
      return false;
    }
  }

  /**
   * Convert file status string to numeric code (for compact format)
   * @param {string} status - Status code (M, A, D, R)
   * @returns {number} Numeric status code
   * @private
   */
  _statusToCode(status) {
    const codes = { 'M': 1, 'A': 2, 'D': 3, 'R': 4 };
    return codes[status] || 1;  // Default to Modified
  }

  /**
   * Convert numeric status code to string (for backward compatibility)
   * @param {number} code - Numeric status code
   * @returns {string} Status string
   * @private
   */
  _codeToStatus(code) {
    const statuses = { 1: 'M', 2: 'A', 3: 'D', 4: 'R' };
    return statuses[code] || 'M';
  }

  /**
   * Get log file path
   * @returns {string}
   */
  getLogPath() {
    return this.logFile;
  }

  /**
   * Get log file size
   * @returns {number} Size in bytes, or 0 if doesn't exist
   */
  getLogSize() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        return stats.size;
      }
    } catch (error) {
      // Ignore
    }
    return 0;
  }

  /**
   * Delete log file (called after successful consolidation)
   */
  deleteLog() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
        return true;
      }
    } catch (error) {
      // If deletion fails, log will be retried next time
      return false;
    }
    return false;
  }

  /**
   * Archive log file (optional - for debugging/backup)
   * @param {string} archiveDir - Directory to archive to
   */
  archiveLog(archiveDir) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return false;
      }

      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const archivePath = path.join(archiveDir, `conversation-log-${timestamp}.jsonl`);

      fs.copyFileSync(this.logFile, archivePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read all interactions from log
   * Supports both old and compact formats for backward compatibility
   * @returns {Array} Array of interaction objects
   */
  readLog() {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            const entry = JSON.parse(line);

            // Auto-detect format and normalize
            if (entry.type) {
              // Old format - convert to compact for consistency
              return this._normalizeOldFormat(entry);
            } else {
              // New compact format - return as-is
              return entry;
            }
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  /**
   * Convert old format entries to compact format (for backward compatibility)
   * @param {object} entry - Old format entry
   * @returns {object} Compact format entry
   * @private
   */
  _normalizeOldFormat(entry) {
    if (entry.type === 'interaction') {
      const result = {
        ts: Math.floor(new Date(entry.timestamp).getTime() / 1000),
        p: entry.user_prompt
      };

      if (entry.modified_files && entry.modified_files.length > 0) {
        result.f = entry.modified_files.map(f => [
          f.path,
          this._statusToCode(f.status)
        ]);
      }

      return result;
    } else if (entry.type === 'assistant_response') {
      const result = {
        ts: Math.floor(new Date(entry.timestamp).getTime() / 1000),
        r: entry.response_text
      };

      if (entry.tools_used && entry.tools_used.length > 0) {
        result.tl = entry.tools_used.map(t => t.tool);
      }

      return result;
    }

    return entry;
  }

  /**
   * Get summary stats about the log
   * Handles both old and compact formats
   * @returns {object} Stats object
   */
  getLogStats() {
    const interactions = this.readLog();

    if (interactions.length === 0) {
      return {
        exists: false,
        interactions: 0,
        size: 0,
        timespan: 0
      };
    }

    const first = interactions[0];
    const last = interactions[interactions.length - 1];

    // Handle both compact (ts) and old (timestamp) formats
    const startTime = first.ts ? new Date(first.ts * 1000) : new Date(first.timestamp);
    const endTime = last.ts ? new Date(last.ts * 1000) : new Date(last.timestamp);
    const timespan = endTime - startTime;

    // Calculate total files modified (handle both compact and old formats)
    const allFiles = new Set();
    interactions.forEach(i => {
      // Compact format: f = [[path, code], ...]
      if (i.f) {
        i.f.forEach(file => allFiles.add(file[0]));
      }
      // Old format: modified_files = [{path, status}, ...]
      if (i.modified_files) {
        i.modified_files.forEach(f => allFiles.add(f.path));
      }
    });

    return {
      exists: true,
      interactions: interactions.length,
      size: this.getLogSize(),
      timespan: timespan,
      timespanMinutes: Math.round(timespan / 1000 / 60),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalFiles: allFiles.size
    };
  }
}

module.exports = ConversationLogger;
