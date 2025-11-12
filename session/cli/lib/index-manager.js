/**
 * IndexManager - Manages metadata index for session management
 *
 * Provides fast metadata queries without reading session files.
 * Maintains .index.json with session metadata, snapshot counts, and statistics.
 */

const fs = require('fs');
const path = require('path');
const LockManager = require('./lock-manager');

class IndexManager {
  /**
   * @param {string} sessionsDir - Path to sessions directory (default: .claude/sessions)
   */
  constructor(sessionsDir = '.claude/sessions') {
    this.sessionsDir = sessionsDir;
    this.indexPath = path.join(sessionsDir, '.index.json');
    this.backupPath = path.join(sessionsDir, '.index.json.backup');
    this.lockManager = new LockManager(sessionsDir);
  }

  /**
   * Read the current index with lazy sync validation
   * @param {Object} options - Options for reading
   * @returns {Object} Index data
   */
  read(options = {}) {
    const skipValidation = options.skipValidation || false;

    if (!fs.existsSync(this.indexPath)) {
      return this.rebuild();
    }

    try {
      const data = fs.readFileSync(this.indexPath, 'utf8');
      const index = JSON.parse(data);

      // Lazy validation - check for issues and auto-fix if needed
      if (!skipValidation) {
        const validation = this.validate();
        if (!validation.valid) {
          // Auto-fix minor issues
          const fixResult = this.fix();
          if (fixResult.fixed > 0) {
            // Re-read the fixed index
            const fixedData = fs.readFileSync(this.indexPath, 'utf8');
            return JSON.parse(fixedData);
          }
        }
      }

      return index;
    } catch (error) {
      // Improved error logging with specific error types
      if (error.code === 'ENOENT') {
        // File doesn't exist - this is expected on first run
        console.log('Index not found, creating new index...');
      } else if (error.code === 'EACCES') {
        console.error('Warning: Permission denied reading index file');
      } else if (error instanceof SyntaxError) {
        console.error('Warning: Index file contains invalid JSON, rebuilding...');
      } else {
        console.error(`Warning: Error reading index (${error.message}), rebuilding...`);
      }

      return this.rebuild();
    }
  }

  /**
   * Write index to disk with atomic operation and locking
   * @param {Object} index - Index data
   */
  write(index) {
    return this.lockManager.withLock('index', () => {
      // Ensure sessions directory exists
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }

      // Create backup of existing index before overwriting
      if (fs.existsSync(this.indexPath)) {
        try {
          fs.copyFileSync(this.indexPath, this.backupPath);
        } catch (backupError) {
          // Log but don't fail - backup is nice-to-have
          console.warn('Warning: Could not create index backup:', backupError.message);
        }
      }

      index.lastIndexUpdate = new Date().toISOString();

      // Atomic write: write to temp file, then rename
      const tempPath = `${this.indexPath}.tmp.${Date.now()}`;
      try {
        // Write to temp file
        fs.writeFileSync(
          tempPath,
          JSON.stringify(index, null, 2),
          'utf8'
        );

        // Verify the written file is valid JSON
        const verification = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
        if (!verification || typeof verification !== 'object') {
          throw new Error('Written index verification failed');
        }

        // Atomic rename (overwrites existing file on same filesystem)
        fs.renameSync(tempPath, this.indexPath);
      } catch (writeError) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }

        // Attempt to restore from backup if write failed
        if (fs.existsSync(this.backupPath)) {
          console.error('Write failed, restoring from backup...');
          try {
            fs.copyFileSync(this.backupPath, this.indexPath);
          } catch (restoreError) {
            console.error('Failed to restore from backup:', restoreError.message);
          }
        }

        throw new Error(`Failed to write index: ${writeError.message}`);
      }
    }, { timeout: 2000 });
  }

  /**
   * Create empty index structure
   * @returns {Object} Empty index
   */
  createEmptyIndex() {
    return {
      version: '1.0',
      sessions: {},
      activeSession: null,
      lastIndexUpdate: new Date().toISOString()
    };
  }

  /**
   * Rebuild entire index from session files
   * @returns {Object} Rebuilt index
   */
  rebuild() {
    const index = this.createEmptyIndex();

    // Read active session
    const activeFile = path.join(this.sessionsDir, '.active-session');
    if (fs.existsSync(activeFile)) {
      index.activeSession = fs.readFileSync(activeFile, 'utf8').trim();
    }

    // Scan all session directories
    const sessions = this.listSessionDirectories();

    for (const sessionName of sessions) {
      try {
        const sessionData = this.extractSessionMetadata(sessionName);
        if (sessionData) {
          index.sessions[sessionName] = sessionData;
        }
      } catch (error) {
        console.error(`Warning: Error reading session ${sessionName}:`, error.message);
      }
    }

    this.write(index);
    return index;
  }

  /**
   * List all session directories
   * @returns {string[]} Session names
   */
  listSessionDirectories() {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    return fs.readdirSync(this.sessionsDir)
      .filter(name => {
        if (name.startsWith('.')) return false;
        const fullPath = path.join(this.sessionsDir, name);
        return fs.statSync(fullPath).isDirectory();
      });
  }

  /**
   * Extract metadata from session files
   * @param {string} sessionName
   * @returns {Object|null} Session metadata
   */
  extractSessionMetadata(sessionName) {
    const sessionDir = path.join(this.sessionsDir, sessionName);
    const sessionFile = path.join(sessionDir, 'session.md');

    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    const content = fs.readFileSync(sessionFile, 'utf8');
    const metadata = this.parseSessionMarkdown(content);

    // Get file stats
    const stats = fs.statSync(sessionFile);
    metadata.lastUpdated = stats.mtime.toISOString();

    // Count snapshots
    const files = fs.readdirSync(sessionDir);
    const snapshots = files.filter(f =>
      f.endsWith('.md') &&
      f !== 'session.md' &&
      f !== 'context.md'
    );
    metadata.snapshotCount = snapshots.length;

    // Find latest snapshot
    if (snapshots.length > 0) {
      const latest = snapshots
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(sessionDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time)[0];

      metadata.latestSnapshot = latest.name;
      metadata.latestSnapshotTime = latest.time.toISOString();
      metadata.latestSnapshotSize = fs.statSync(
        path.join(sessionDir, latest.name)
      ).size;

      // Extract snapshot summary (first 200 chars of "Conversation Summary" section)
      metadata.latestSnapshotSummary = this.extractSnapshotSummary(
        path.join(sessionDir, latest.name)
      );
    }

    // Get files involved count
    metadata.filesInvolvedCount = metadata.filesInvolved?.length || 0;

    return metadata;
  }

  /**
   * Parse session.md markdown file
   * @param {string} content - File content
   * @returns {Object} Parsed metadata
   */
  parseSessionMarkdown(content) {
    const metadata = {
      name: '',
      status: 'active',
      started: null,
      lastUpdated: null,
      closed: null,
      goal: '',
      filesInvolved: []
    };

    // Extract using regex patterns
    const nameMatch = content.match(/^#\s+Session:\s+(.+)$/m);
    if (nameMatch) metadata.name = nameMatch[1].trim();

    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)$/m);
    if (statusMatch) metadata.status = statusMatch[1].trim().toLowerCase();

    const startedMatch = content.match(/\*\*Started\*\*:\s*(.+)$/m);
    if (startedMatch) metadata.started = startedMatch[1].trim();

    const closedMatch = content.match(/\*\*Closed\*\*:\s*(.+)$/m);
    if (closedMatch) metadata.closed = closedMatch[1].trim();

    // Extract goal (text under ## Goal heading)
    const goalMatch = content.match(/##\s+Goal\s*\n(.+?)(?=\n##|\n\*\*|$)/s);
    if (goalMatch) metadata.goal = goalMatch[1].trim();

    // Extract files involved
    const filesSection = content.match(/##\s+Files Involved\s*\n([\s\S]+?)(?=\n##|$)/);
    if (filesSection) {
      metadata.filesInvolved = filesSection[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(Boolean);
    }

    return metadata;
  }

  /**
   * Extract summary from snapshot file
   * @param {string} snapshotPath
   * @returns {string} Summary (max 200 chars)
   */
  extractSnapshotSummary(snapshotPath) {
    try {
      const content = fs.readFileSync(snapshotPath, 'utf8');
      const summaryMatch = content.match(/##\s+Conversation Summary\s*\n(.+?)(?=\n##|$)/s);

      if (summaryMatch) {
        let summary = summaryMatch[1].trim();
        // Remove markdown formatting
        summary = summary.replace(/\*\*|__/g, '').replace(/\n/g, ' ');
        if (summary.length > 200) {
          summary = summary.substring(0, 197) + '...';
        }
        return summary;
      }

      return 'No summary available';
    } catch (error) {
      return 'Error reading summary';
    }
  }

  /**
   * Update a single session in the index
   * @param {string} sessionName
   */
  updateSession(sessionName) {
    const index = this.read();
    const metadata = this.extractSessionMetadata(sessionName);

    if (metadata) {
      index.sessions[sessionName] = metadata;
      this.write(index);
    } else {
      // Session doesn't exist, remove from index
      if (index.sessions[sessionName]) {
        delete index.sessions[sessionName];
        this.write(index);
      }
    }
  }

  /**
   * Add a new session to the index
   * @param {string} sessionName
   * @param {Object} metadata - Initial metadata
   */
  addSession(sessionName, metadata = {}) {
    const index = this.read();

    // Extract full metadata from session file if it exists
    const fullMetadata = this.extractSessionMetadata(sessionName);

    if (fullMetadata) {
      index.sessions[sessionName] = fullMetadata;
    } else {
      // Use provided metadata if session file doesn't exist yet
      index.sessions[sessionName] = {
        name: sessionName,
        status: 'active',
        started: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        snapshotCount: 0,
        filesInvolvedCount: 0,
        ...metadata
      };
    }

    this.write(index);
  }

  /**
   * Remove a session from the index
   * @param {string} sessionName
   */
  removeSession(sessionName) {
    const index = this.read();

    if (index.sessions[sessionName]) {
      delete index.sessions[sessionName];

      // Clear active session if it was the removed one
      if (index.activeSession === sessionName) {
        index.activeSession = null;
      }

      this.write(index);
    }
  }

  /**
   * Set active session
   * @param {string} sessionName
   */
  setActive(sessionName) {
    const index = this.read();

    if (!index.sessions[sessionName]) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    index.activeSession = sessionName;
    this.write(index);

    // Also update .active-session file
    const activeFile = path.join(this.sessionsDir, '.active-session');
    fs.writeFileSync(activeFile, sessionName, 'utf8');
  }

  /**
   * Get active session name
   * @returns {string|null}
   */
  getActive() {
    const index = this.read();
    return index.activeSession;
  }

  /**
   * Get session metadata from index
   * @param {string} sessionName
   * @returns {Object|null}
   */
  getSession(sessionName) {
    const index = this.read();
    return index.sessions[sessionName] || null;
  }

  /**
   * Get all sessions
   * @returns {Object} All sessions from index
   */
  getAllSessions() {
    const index = this.read();
    return index.sessions;
  }

  /**
   * Validate index integrity
   * @returns {Object} Validation result
   */
  validate() {
    const index = this.read({ skipValidation: true });
    const issues = [];

    // Check if active session exists
    if (index.activeSession && !index.sessions[index.activeSession]) {
      issues.push({
        type: 'active_not_found',
        message: `Active session "${index.activeSession}" not in index`
      });
    }

    // Check if all session directories are indexed
    const directories = this.listSessionDirectories();
    const indexed = Object.keys(index.sessions);

    const missing = directories.filter(d => !indexed.includes(d));
    if (missing.length > 0) {
      issues.push({
        type: 'missing_sessions',
        message: `${missing.length} sessions not indexed: ${missing.join(', ')}`
      });
    }

    // Check for orphaned index entries
    const orphaned = indexed.filter(s => !directories.includes(s));
    if (orphaned.length > 0) {
      issues.push({
        type: 'orphaned_entries',
        message: `${orphaned.length} index entries without directories: ${orphaned.join(', ')}`
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fix index issues (remove orphaned entries, add missing sessions)
   * @returns {Object} Fix result
   */
  fix() {
    const validation = this.validate();

    if (validation.valid) {
      return { fixed: 0, issues: [] };
    }

    const index = this.read({ skipValidation: true });
    const fixed = [];

    // Remove orphaned entries
    const orphanedIssue = validation.issues.find(i => i.type === 'orphaned_entries');
    if (orphanedIssue) {
      const directories = this.listSessionDirectories();
      const indexed = Object.keys(index.sessions);
      const orphaned = indexed.filter(s => !directories.includes(s));

      orphaned.forEach(sessionName => {
        delete index.sessions[sessionName];
        fixed.push(`Removed orphaned entry: ${sessionName}`);
      });
    }

    // Add missing sessions
    const missingIssue = validation.issues.find(i => i.type === 'missing_sessions');
    if (missingIssue) {
      const directories = this.listSessionDirectories();
      const indexed = Object.keys(index.sessions);
      const missing = directories.filter(d => !indexed.includes(d));

      missing.forEach(sessionName => {
        const metadata = this.extractSessionMetadata(sessionName);
        if (metadata) {
          index.sessions[sessionName] = metadata;
          fixed.push(`Added missing session: ${sessionName}`);
        }
      });
    }

    // Fix active session if needed
    const activeIssue = validation.issues.find(i => i.type === 'active_not_found');
    if (activeIssue) {
      index.activeSession = null;
      const activeFile = path.join(this.sessionsDir, '.active-session');
      if (fs.existsSync(activeFile)) {
        fs.unlinkSync(activeFile);
      }
      fixed.push('Cleared invalid active session');
    }

    this.write(index);

    return {
      fixed: fixed.length,
      issues: fixed
    };
  }
}

module.exports = IndexManager;
