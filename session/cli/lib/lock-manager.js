const fs = require('fs');
const path = require('path');

/**
 * LockManager - Provides file-based locking using mkdir (atomic operation)
 *
 * This implementation uses directory creation as a lock mechanism because:
 * - mkdir is atomic across all platforms (Windows, macOS, Linux)
 * - Works reliably on network filesystems
 * - Zero external dependencies
 * - Same approach used by popular lockfile libraries
 */
class LockManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  /**
   * Acquire a lock with optional retry logic
   *
   * @param {string} lockName - Name of the lock (e.g., 'index', 'auto-capture-state')
   * @param {object} options - Lock options
   * @param {number} options.timeout - Maximum time to wait for lock in ms (default: 5000)
   * @param {number} options.retryInterval - Time between retry attempts in ms (default: 50)
   * @param {number} options.staleTimeout - Time after which a lock is considered stale in ms (default: 30000)
   * @param {boolean} options.wait - Whether to wait for lock or fail immediately (default: true)
   * @returns {object} Lock object with acquired status and release function
   */
  acquireLock(lockName, options = {}) {
    const timeout = options.timeout || 5000;
    const retryInterval = options.retryInterval || 50;
    const staleTimeout = options.staleTimeout || 30000;
    const wait = options.wait !== false;

    // Ensure base directory exists before creating lock
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (mkdirError) {
        // Directory might have been created by another process
        if (mkdirError.code !== 'EEXIST' && !fs.existsSync(this.baseDir)) {
          throw new Error(`Failed to create base directory for locks: ${mkdirError.message}`);
        }
      }
    }

    const lockDir = path.join(this.baseDir, `.${lockName}.lock`);
    const startTime = Date.now();

    while (true) {
      try {
        // Try to create lock directory (atomic operation)
        fs.mkdirSync(lockDir, { recursive: false });

        // Lock acquired successfully
        return {
          acquired: true,
          lockDir: lockDir,
          release: () => this.releaseLock(lockName)
        };
      } catch (err) {
        if (err.code === 'EEXIST') {
          // Lock directory exists - another process holds the lock

          // Check for stale locks
          try {
            const stats = fs.statSync(lockDir);
            const age = Date.now() - stats.mtimeMs;

            if (age > staleTimeout) {
              // Stale lock detected - remove and retry
              try {
                fs.rmdirSync(lockDir);
                continue; // Retry immediately
              } catch (removeErr) {
                // Another process may have already removed it
                continue;
              }
            }
          } catch (statErr) {
            // Lock was removed between EEXIST and stat - retry
            continue;
          }

          // Lock is active, not stale
          if (!wait) {
            // Caller doesn't want to wait
            return {
              acquired: false,
              lockDir: null,
              release: () => {}
            };
          }

          // Check if we've exceeded timeout
          const elapsed = Date.now() - startTime;
          if (elapsed >= timeout) {
            return {
              acquired: false,
              lockDir: null,
              release: () => {}
            };
          }

          // Wait and retry
          const remainingTime = timeout - elapsed;
          const sleepTime = Math.min(retryInterval, remainingTime);

          // Synchronous sleep (necessary for hook compatibility)
          const sleepEnd = Date.now() + sleepTime;
          while (Date.now() < sleepEnd) {
            // Busy wait
          }

          continue; // Retry
        } else {
          // Unexpected error (permissions, disk full, etc.)
          throw new Error(`Failed to acquire lock '${lockName}': ${err.message}`);
        }
      }
    }
  }

  /**
   * Release a lock by removing the lock directory
   *
   * @param {string} lockName - Name of the lock to release
   */
  releaseLock(lockName) {
    const lockDir = path.join(this.baseDir, `.${lockName}.lock`);

    try {
      fs.rmdirSync(lockDir);
    } catch (err) {
      // Ignore errors - lock may have been:
      // - Already released
      // - Cleaned up as stale
      // - Never acquired
    }
  }

  /**
   * Execute a function while holding a lock
   *
   * @param {string} lockName - Name of the lock
   * @param {function} fn - Function to execute while holding the lock
   * @param {object} options - Lock options (see acquireLock)
   * @returns {any} Result of fn()
   */
  withLock(lockName, fn, options = {}) {
    const lock = this.acquireLock(lockName, options);

    if (!lock.acquired) {
      throw new Error(`Failed to acquire lock '${lockName}' within timeout`);
    }

    try {
      return fn();
    } finally {
      lock.release();
    }
  }
}

module.exports = LockManager;
