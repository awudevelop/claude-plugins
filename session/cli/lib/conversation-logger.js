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
   * @param {object} interaction - Interaction data
   * @param {number} interaction.num - Interaction number
   * @param {string} interaction.timestamp - ISO timestamp
   * @param {object} interaction.state - Session state (interaction_count, file_count, etc.)
   * @param {Array} interaction.modified_files - Files modified since last snapshot
   */
  logInteraction(interaction) {
    try {
      const entry = {
        type: 'interaction',
        num: interaction.num,
        timestamp: interaction.timestamp || new Date().toISOString(),
        interaction_count: interaction.state?.interaction_count || interaction.num,
        file_count: interaction.state?.file_count || 0,
        modified_files: interaction.modified_files || interaction.state?.modified_files || []
      };

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
            return JSON.parse(line);
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
   * Get summary stats about the log
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
    const startTime = new Date(first.timestamp);
    const endTime = new Date(last.timestamp);
    const timespan = endTime - startTime;

    // Calculate total files modified
    const allFiles = new Set();
    interactions.forEach(i => {
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
