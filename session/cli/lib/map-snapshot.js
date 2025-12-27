const fs = require('fs').promises;
const path = require('path');
const compression = require('./compression');
const { MapPaths } = require('./map-paths');

/**
 * Map Snapshot Manager
 * Handles saving and loading temporary map snapshots for diff comparison
 * during map refresh operations
 *
 * Storage: Uses centralized MapPaths for project-local or legacy paths
 */

class MapSnapshot {
  constructor(projectRoot, projectHash) {
    this.projectRoot = projectRoot;
    this.projectHash = projectHash;
    // Use centralized path resolver
    this.mapPaths = new MapPaths(projectRoot);
    this.mapsDir = this.mapPaths.getMapsDir();
    this.snapshotsDir = this.mapPaths.getSnapshotsDir();
  }

  /**
   * Ensure snapshots directory exists
   * @private
   */
  async ensureSnapshotsDir() {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create snapshots directory: ${error.message}`);
    }
  }

  /**
   * Get full path to a snapshot file
   * @param {string} snapshotName - Name of the snapshot
   * @returns {string} Full path to snapshot file
   */
  getSnapshotPath(snapshotName) {
    const filename = snapshotName.endsWith('.json') ? snapshotName : `${snapshotName}.json`;
    return path.join(this.snapshotsDir, filename);
  }

  /**
   * Save current maps to a snapshot
   * @param {Object} maps - Map data to snapshot (can be single map or multiple maps)
   * @param {string} snapshotName - Name for the snapshot
   * @returns {Promise<string>} Path to saved snapshot
   */
  async saveSnapshot(maps, snapshotName) {
    try {
      await this.ensureSnapshotsDir();

      const snapshotPath = this.getSnapshotPath(snapshotName);

      // Create snapshot data with metadata
      const snapshotData = {
        version: '1.0',
        snapshotName,
        projectRoot: this.projectRoot,
        projectHash: this.projectHash,
        timestamp: new Date().toISOString(),
        maps
      };

      // Compress and save the snapshot
      await compression.compressAndSave(snapshotData, snapshotPath);

      return snapshotPath;
    } catch (error) {
      throw new Error(`Failed to save snapshot '${snapshotName}': ${error.message}`);
    }
  }

  /**
   * Load a snapshot
   * @param {string} snapshotName - Name of the snapshot to load
   * @returns {Promise<Object>} Snapshot data
   */
  async loadSnapshot(snapshotName) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotName);

      // Check if snapshot exists
      try {
        await fs.access(snapshotPath);
      } catch (error) {
        throw new Error(`Snapshot '${snapshotName}' not found at ${snapshotPath}`);
      }

      // Load and decompress snapshot
      const snapshotData = await compression.loadAndDecompress(snapshotPath);

      // Validate snapshot structure
      if (!snapshotData.maps) {
        throw new Error(`Invalid snapshot format: missing maps data`);
      }

      // Verify project hash matches (optional warning)
      if (snapshotData.projectHash !== this.projectHash) {
        console.warn(`Warning: Snapshot project hash mismatch. Snapshot may be from a different project.`);
      }

      return snapshotData;
    } catch (error) {
      throw new Error(`Failed to load snapshot '${snapshotName}': ${error.message}`);
    }
  }

  /**
   * Check if a snapshot exists
   * @param {string} snapshotName - Name of the snapshot to check
   * @returns {Promise<boolean>} True if snapshot exists
   */
  async hasSnapshot(snapshotName) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotName);
      await fs.access(snapshotPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a snapshot
   * @param {string} snapshotName - Name of the snapshot to delete
   * @returns {Promise<void>}
   */
  async deleteSnapshot(snapshotName) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotName);

      // Check if snapshot exists
      const exists = await this.hasSnapshot(snapshotName);
      if (!exists) {
        // Silently succeed if snapshot doesn't exist
        return;
      }

      // Delete the snapshot file
      await fs.unlink(snapshotPath);
    } catch (error) {
      throw new Error(`Failed to delete snapshot '${snapshotName}': ${error.message}`);
    }
  }

  /**
   * List all snapshots for this project
   * @returns {Promise<Array>} Array of snapshot names
   */
  async listSnapshots() {
    try {
      // Check if snapshots directory exists
      try {
        await fs.access(this.snapshotsDir);
      } catch (error) {
        return []; // No snapshots directory means no snapshots
      }

      const files = await fs.readdir(this.snapshotsDir);

      // Filter for .json files and remove extension
      const snapshots = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      return snapshots;
    } catch (error) {
      throw new Error(`Failed to list snapshots: ${error.message}`);
    }
  }

  /**
   * Clean up old snapshots (optional utility)
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of snapshots deleted
   */
  async cleanupOldSnapshots(maxAge = 24 * 60 * 60 * 1000) { // Default: 24 hours
    try {
      const snapshots = await this.listSnapshots();
      const now = Date.now();
      let deletedCount = 0;

      for (const snapshotName of snapshots) {
        const snapshotPath = this.getSnapshotPath(snapshotName);
        const stats = await fs.stat(snapshotPath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await this.deleteSnapshot(snapshotName);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to cleanup old snapshots: ${error.message}`);
    }
  }
}

module.exports = MapSnapshot;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node map-snapshot.js <command> <project-path> [snapshot-name]');
    console.log('\nCommands:');
    console.log('  list <project-path>                     - List all snapshots');
    console.log('  save <project-path> <snapshot-name>     - Save a snapshot (reads from stdin)');
    console.log('  load <project-path> <snapshot-name>     - Load a snapshot');
    console.log('  has <project-path> <snapshot-name>      - Check if snapshot exists');
    console.log('  delete <project-path> <snapshot-name>   - Delete a snapshot');
    console.log('  cleanup <project-path> [max-age-hours]  - Delete old snapshots');
    console.log('\nExamples:');
    console.log('  node map-snapshot.js list .');
    console.log('  node map-snapshot.js has . pre-refresh');
    console.log('  node map-snapshot.js delete . pre-refresh');
    console.log('  node map-snapshot.js cleanup . 48');
    process.exit(1);
  }

  const command = args[0];
  const projectPath = path.resolve(args[1]);
  const snapshotName = args[2];

  const crypto = require('crypto');
  const normalized = path.resolve(projectPath);
  const projectHash = crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);

  const snapshot = new MapSnapshot(projectPath, projectHash);

  (async () => {
    try {
      switch (command) {
        case 'list': {
          const snapshots = await snapshot.listSnapshots();
          if (snapshots.length === 0) {
            console.log('No snapshots found');
          } else {
            console.log(`Found ${snapshots.length} snapshot(s):`);
            snapshots.forEach(name => console.log(`  - ${name}`));
          }
          break;
        }

        case 'has': {
          if (!snapshotName) {
            console.error('Error: snapshot-name required');
            process.exit(1);
          }
          const exists = await snapshot.hasSnapshot(snapshotName);
          console.log(exists ? 'true' : 'false');
          process.exit(exists ? 0 : 1);
        }

        case 'load': {
          if (!snapshotName) {
            console.error('Error: snapshot-name required');
            process.exit(1);
          }
          const data = await snapshot.loadSnapshot(snapshotName);
          console.log(JSON.stringify(data, null, 2));
          break;
        }

        case 'delete': {
          if (!snapshotName) {
            console.error('Error: snapshot-name required');
            process.exit(1);
          }
          await snapshot.deleteSnapshot(snapshotName);
          console.log(`Deleted snapshot: ${snapshotName}`);
          break;
        }

        case 'cleanup': {
          const maxAgeHours = snapshotName ? parseInt(snapshotName) : 24;
          const maxAge = maxAgeHours * 60 * 60 * 1000;
          const deletedCount = await snapshot.cleanupOldSnapshots(maxAge);
          console.log(`Cleaned up ${deletedCount} old snapshot(s)`);
          break;
        }

        case 'save': {
          if (!snapshotName) {
            console.error('Error: snapshot-name required');
            process.exit(1);
          }
          console.error('Error: save command requires map data from stdin (not implemented in CLI mode)');
          console.error('Use the class programmatically to save snapshots');
          process.exit(1);
        }

        default:
          console.error(`Unknown command: ${command}`);
          process.exit(1);
      }

    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
