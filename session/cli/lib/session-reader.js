/**
 * SessionReader - Read session data and files
 *
 * Provides methods to read session files, snapshots, and state.
 */

const fs = require('fs');
const path = require('path');

class SessionReader {
  /**
   * @param {string} sessionsDir - Path to sessions directory
   */
  constructor(sessionsDir = '.claude/sessions') {
    this.sessionsDir = sessionsDir;
  }

  /**
   * Get session directory path
   * @param {string} sessionName
   * @returns {string}
   */
  getSessionDir(sessionName) {
    return path.join(this.sessionsDir, sessionName);
  }

  /**
   * Check if session exists
   * @param {string} sessionName
   * @returns {boolean}
   */
  exists(sessionName) {
    const sessionDir = this.getSessionDir(sessionName);
    return fs.existsSync(sessionDir) &&
           fs.existsSync(path.join(sessionDir, 'session.md'));
  }

  /**
   * Read full session data
   * @param {string} sessionName
   * @param {Object} options - Options for what to include
   * @returns {Object} Session data
   */
  read(sessionName, options = {}) {
    if (!this.exists(sessionName)) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const data = {
      name: sessionName,
      sessionFile: this.readSessionFile(sessionName),
      contextFile: this.readContextFile(sessionName),
    };

    if (options.includeSnapshots) {
      data.snapshots = this.listSnapshots(sessionName);
    }

    if (options.includeLatestSnapshot) {
      data.latestSnapshot = this.readLatestSnapshot(sessionName);
    }

    if (options.includeState) {
      data.autoCaptureState = this.readAutoCaptureState(sessionName);
    }

    return data;
  }

  /**
   * Read session.md file
   * @param {string} sessionName
   * @returns {string} File content
   */
  readSessionFile(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), 'session.md');
    if (!fs.existsSync(filePath)) {
      throw new Error(`session.md not found for session: ${sessionName}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Read context.md file
   * @param {string} sessionName
   * @returns {string|null} File content or null if doesn't exist
   */
  readContextFile(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), 'context.md');
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * List all snapshots for a session
   * @param {string} sessionName
   * @returns {Array} Array of snapshot info
   */
  listSnapshots(sessionName) {
    const sessionDir = this.getSessionDir(sessionName);
    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const files = fs.readdirSync(sessionDir);
    const snapshots = files
      .filter(f =>
        f.endsWith('.md') &&
        f !== 'session.md' &&
        f !== 'context.md'
      )
      .map(filename => {
        const filePath = path.join(sessionDir, filename);
        const stats = fs.statSync(filePath);

        return {
          filename,
          type: filename.startsWith('auto_') ? 'auto' : 'manual',
          timestamp: stats.mtime.toISOString(),
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024)
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return snapshots;
  }

  /**
   * Read latest snapshot
   * @param {string} sessionName
   * @returns {Object|null} Snapshot info with content
   */
  readLatestSnapshot(sessionName) {
    const snapshots = this.listSnapshots(sessionName);

    if (snapshots.length === 0) {
      return null;
    }

    const latest = snapshots[0];
    const filePath = path.join(this.getSessionDir(sessionName), latest.filename);
    const content = fs.readFileSync(filePath, 'utf8');

    return {
      ...latest,
      content
    };
  }

  /**
   * Read specific snapshot by filename
   * @param {string} sessionName
   * @param {string} filename
   * @returns {Object} Snapshot info with content
   */
  readSnapshot(sessionName, filename) {
    const filePath = path.join(this.getSessionDir(sessionName), filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot not found: ${filename}`);
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    return {
      filename,
      type: filename.startsWith('auto_') ? 'auto' : 'manual',
      timestamp: stats.mtime.toISOString(),
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024),
      content
    };
  }

  /**
   * Read auto-capture state
   * @param {string} sessionName
   * @returns {Object|null} State data or null if doesn't exist
   */
  readAutoCaptureState(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.auto-capture-state');

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing auto-capture state for ${sessionName}:`, error.message);
      return null;
    }
  }

  /**
   * Read analysis queue
   * @param {string} sessionName
   * @returns {Array|null} Queue data or null if doesn't exist
   */
  readAnalysisQueue(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.analysis-queue');

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing analysis queue for ${sessionName}:`, error.message);
      return null;
    }
  }

  /**
   * Read snapshot decision
   * @param {string} sessionName
   * @returns {Object|null} Decision data or null if doesn't exist
   */
  readSnapshotDecision(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.snapshot-decision');

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing snapshot decision for ${sessionName}:`, error.message);
      return null;
    }
  }

  /**
   * Check if pending analysis marker exists
   * @param {string} sessionName
   * @returns {boolean}
   */
  hasPendingAnalysis(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.pending-analysis');
    return fs.existsSync(filePath);
  }

  /**
   * Check if pending auto-snapshot marker exists
   * @param {string} sessionName
   * @returns {boolean}
   */
  hasPendingAutoSnapshot(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.pending-auto-snapshot');
    return fs.existsSync(filePath);
  }

  /**
   * Read suggestions file
   * @param {string} sessionName
   * @returns {Object|null} Suggestions data or null if doesn't exist
   */
  readSuggestions(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.suggestions.json');

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing suggestions for ${sessionName}:`, error.message);
      return null;
    }
  }

  /**
   * Get session statistics
   * @param {string} sessionName
   * @returns {Object} Statistics
   */
  getStats(sessionName) {
    if (!this.exists(sessionName)) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const sessionDir = this.getSessionDir(sessionName);
    const snapshots = this.listSnapshots(sessionName);

    // Calculate total size
    const totalSize = snapshots.reduce((sum, snap) => sum + snap.size, 0);

    // Get session file info
    const sessionFilePath = path.join(sessionDir, 'session.md');
    const sessionFileStats = fs.statSync(sessionFilePath);

    // Get context file info
    const contextFilePath = path.join(sessionDir, 'context.md');
    const contextFileSize = fs.existsSync(contextFilePath)
      ? fs.statSync(contextFilePath).size
      : 0;

    // Count auto vs manual snapshots
    const autoSnapshots = snapshots.filter(s => s.type === 'auto').length;
    const manualSnapshots = snapshots.filter(s => s.type === 'manual').length;

    return {
      sessionName,
      snapshotCount: snapshots.length,
      autoSnapshotCount: autoSnapshots,
      manualSnapshotCount: manualSnapshots,
      totalSnapshotSize: totalSize,
      totalSnapshotSizeKB: Math.round(totalSize / 1024),
      totalSnapshotSizeMB: Math.round(totalSize / (1024 * 1024) * 10) / 10,
      sessionFileSize: sessionFileStats.size,
      contextFileSize,
      created: sessionFileStats.birthtime.toISOString(),
      lastModified: sessionFileStats.mtime.toISOString(),
      hasPendingAnalysis: this.hasPendingAnalysis(sessionName),
      hasPendingAutoSnapshot: this.hasPendingAutoSnapshot(sessionName)
    };
  }
}

module.exports = SessionReader;
