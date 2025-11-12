/**
 * SessionWriter - Write session data and files
 *
 * Provides methods to write session files, snapshots, and state.
 * Critical for plan mode support where Write tool is blocked.
 */

const fs = require('fs');
const path = require('path');
const LockManager = require('./lock-manager');

class SessionWriter {
  /**
   * @param {string} sessionsDir - Path to sessions directory
   */
  constructor(sessionsDir = '.claude/sessions') {
    this.sessionsDir = sessionsDir;
    this.lockManager = new LockManager(sessionsDir);
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
   * Ensure session directory exists
   * @param {string} sessionName
   */
  ensureSessionDir(sessionName) {
    const sessionDir = this.getSessionDir(sessionName);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  /**
   * Write snapshot file
   * @param {string} sessionName
   * @param {string} content - Snapshot content
   * @param {Object} options - Options (type: 'auto'|'manual', filename: optional)
   * @returns {Object} Info about written snapshot
   */
  writeSnapshot(sessionName, content, options = {}) {
    this.ensureSessionDir(sessionName);

    const type = options.type || 'manual';
    const timestamp = new Date();

    // Generate filename if not provided
    let filename = options.filename;
    if (!filename) {
      const dateStr = timestamp.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .substring(0, 16); // YYYY-MM-DD_HH-MM

      filename = type === 'auto' ? `auto_${dateStr}.md` : `${dateStr}.md`;
    }

    const filePath = path.join(this.getSessionDir(sessionName), filename);

    // Write the file
    fs.writeFileSync(filePath, content, 'utf8');

    // Get file stats
    const stats = fs.statSync(filePath);

    return {
      filename,
      type,
      timestamp: stats.mtime.toISOString(),
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024),
      path: filePath
    };
  }

  /**
   * Update auto-capture state
   * @param {string} sessionName
   * @param {Object} state - State data to write
   */
  writeAutoCaptureState(sessionName, state) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.auto-capture-state');
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Update specific fields in auto-capture state
   * Protected against race conditions with file locking
   * @param {string} sessionName
   * @param {Object} updates - Fields to update
   */
  updateAutoCaptureState(sessionName, updates) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.auto-capture-state');

    // Use lock to prevent race conditions during read-modify-write
    return this.lockManager.withLock(`auto-capture-${sessionName}`, () => {
      // Read existing state
      let state = {};
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          state = JSON.parse(content);
        } catch (error) {
          console.error('Error reading existing state, creating new:', error.message);
        }
      }

      // Merge updates
      state = { ...state, ...updates };

      // Write back atomically
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      try {
        fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
      } catch (error) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    }, { timeout: 1000 });
  }

  /**
   * Write analysis queue
   * @param {string} sessionName
   * @param {Array} queue - Queue data
   */
  writeAnalysisQueue(sessionName, queue) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.analysis-queue');
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf8');
  }

  /**
   * Write snapshot decision
   * @param {string} sessionName
   * @param {Object} decision - Decision data
   */
  writeSnapshotDecision(sessionName, decision) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.snapshot-decision');
    fs.writeFileSync(filePath, JSON.stringify(decision, null, 2), 'utf8');
  }

  /**
   * Write pending analysis marker
   * @param {string} sessionName
   */
  writePendingAnalysisMarker(sessionName) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.pending-analysis');
    fs.writeFileSync(filePath, '', 'utf8');
  }

  /**
   * Remove pending analysis marker
   * @param {string} sessionName
   */
  removePendingAnalysisMarker(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.pending-analysis');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Write pending auto-snapshot marker
   * @param {string} sessionName
   */
  writePendingAutoSnapshotMarker(sessionName) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.pending-auto-snapshot');
    fs.writeFileSync(filePath, '', 'utf8');
  }

  /**
   * Remove pending auto-snapshot marker
   * @param {string} sessionName
   */
  removePendingAutoSnapshotMarker(sessionName) {
    const filePath = path.join(this.getSessionDir(sessionName), '.pending-auto-snapshot');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Write suggestions file
   * @param {string} sessionName
   * @param {Object} suggestions - Suggestions data
   */
  writeSuggestions(sessionName, suggestions) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), '.suggestions.json');
    fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2), 'utf8');
  }

  /**
   * Update session.md file
   * @param {string} sessionName
   * @param {string} content - New content
   */
  writeSessionFile(sessionName, content) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), 'session.md');
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Update context.md file
   * @param {string} sessionName
   * @param {string} content - New content
   */
  writeContextFile(sessionName, content) {
    this.ensureSessionDir(sessionName);

    const filePath = path.join(this.getSessionDir(sessionName), 'context.md');
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Delete a session directory and all its contents
   * @param {string} sessionName
   * @returns {boolean} True if deleted, false if didn't exist
   */
  deleteSession(sessionName) {
    const sessionDir = this.getSessionDir(sessionName);

    if (!fs.existsSync(sessionDir)) {
      return false;
    }

    // Recursively delete directory
    fs.rmSync(sessionDir, { recursive: true, force: true });
    return true;
  }

  /**
   * Delete a specific snapshot
   * @param {string} sessionName
   * @param {string} filename
   * @returns {boolean} True if deleted, false if didn't exist
   */
  deleteSnapshot(sessionName, filename) {
    const filePath = path.join(this.getSessionDir(sessionName), filename);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    fs.unlinkSync(filePath);
    return true;
  }
}

module.exports = SessionWriter;
