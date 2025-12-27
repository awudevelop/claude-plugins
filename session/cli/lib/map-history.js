const fs = require('fs').promises;
const path = require('path');
const compression = require('./compression');
const MapDiffer = require('./map-differ');
const { MapPaths } = require('./map-paths');

/**
 * Map History Manager
 * Tracks and manages multiple map snapshot versions for cross-generation comparison
 * Enables historical analysis and trend tracking of project maps over time
 *
 * Storage: Uses centralized MapPaths for project-local or legacy paths
 */

class MapHistory {
  constructor(projectRoot, projectHash) {
    this.projectRoot = projectRoot;
    this.projectHash = projectHash;
    // Use centralized path resolver
    this.mapPaths = new MapPaths(projectRoot);
    this.mapsDir = this.mapPaths.getMapsDir();
    this.historyDir = this.mapPaths.getHistoryDir();
  }

  /**
   * Ensure history directory exists
   * @private
   */
  async ensureHistoryDir() {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create history directory: ${error.message}`);
    }
  }

  /**
   * Generate timestamp-based snapshot ID
   * @private
   * @returns {string} Snapshot ID in format: YYYYMMDD-HHMMSS
   */
  generateSnapshotId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Get full path to a history snapshot file
   * @private
   * @param {string} snapshotId - ID of the snapshot
   * @returns {string} Full path to snapshot file
   */
  getSnapshotPath(snapshotId) {
    const filename = snapshotId.endsWith('.json') ? snapshotId : `${snapshotId}.json`;
    return path.join(this.historyDir, filename);
  }

  /**
   * Save current maps to history with timestamp-based ID
   * @param {Object} maps - Map data to save (can be single map or multiple maps)
   * @param {Object} metadata - Optional metadata about this snapshot
   * @returns {Promise<string>} Snapshot ID
   */
  async saveHistorySnapshot(maps, metadata = {}) {
    try {
      await this.ensureHistoryDir();

      const snapshotId = this.generateSnapshotId();
      const snapshotPath = this.getSnapshotPath(snapshotId);

      // Create snapshot data with metadata
      const snapshotData = {
        version: '1.0',
        type: 'history',
        snapshotId,
        projectRoot: this.projectRoot,
        projectHash: this.projectHash,
        timestamp: new Date().toISOString(),
        metadata: {
          reason: metadata.reason || 'manual-save',
          gitCommit: metadata.gitCommit || null,
          gitBranch: metadata.gitBranch || null,
          notes: metadata.notes || null,
          ...metadata
        },
        maps
      };

      // Compress and save the snapshot
      await compression.compressAndSave(snapshotData, snapshotPath);

      return snapshotId;
    } catch (error) {
      throw new Error(`Failed to save history snapshot: ${error.message}`);
    }
  }

  /**
   * List all historical snapshots
   * @returns {Promise<Array<{id: string, timestamp: string, metadata: Object}>>} List of snapshots
   */
  async listSnapshots() {
    try {
      // Check if history directory exists
      try {
        await fs.access(this.historyDir);
      } catch (error) {
        return []; // No history directory means no snapshots
      }

      const files = await fs.readdir(this.historyDir);

      // Filter for .json files
      const snapshotFiles = files.filter(file => file.endsWith('.json'));

      // Load metadata for each snapshot
      const snapshots = [];
      for (const file of snapshotFiles) {
        try {
          const snapshotPath = path.join(this.historyDir, file);
          const snapshotData = await compression.loadAndDecompress(snapshotPath);

          snapshots.push({
            id: snapshotData.snapshotId || file.replace('.json', ''),
            timestamp: snapshotData.timestamp,
            metadata: snapshotData.metadata || {}
          });
        } catch (error) {
          // Skip corrupted snapshots
          console.warn(`Warning: Could not load snapshot ${file}: ${error.message}`);
        }
      }

      // Sort by timestamp (newest first)
      snapshots.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      return snapshots;
    } catch (error) {
      throw new Error(`Failed to list snapshots: ${error.message}`);
    }
  }

  /**
   * Load a specific historical snapshot
   * @param {string} snapshotId - ID of the snapshot to load
   * @returns {Promise<Object>} Snapshot data
   */
  async loadHistoricalSnapshot(snapshotId) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);

      // Check if snapshot exists
      try {
        await fs.access(snapshotPath);
      } catch (error) {
        throw new Error(`Snapshot '${snapshotId}' not found at ${snapshotPath}`);
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
      throw new Error(`Failed to load snapshot '${snapshotId}': ${error.message}`);
    }
  }

  /**
   * Compare two historical snapshots
   * @param {string} snapshotId1 - First snapshot ID
   * @param {string} snapshotId2 - Second snapshot ID
   * @returns {Promise<Object>} Diff report between the two snapshots
   */
  async compareAcrossHistory(snapshotId1, snapshotId2) {
    try {
      // Load both snapshots
      const snapshot1 = await this.loadHistoricalSnapshot(snapshotId1);
      const snapshot2 = await this.loadHistoricalSnapshot(snapshotId2);

      // Generate diff report
      const diff = MapDiffer.generateFullDiff(snapshot1.maps, snapshot2.maps);

      // Add comparison metadata
      diff.comparison = {
        from: {
          snapshotId: snapshotId1,
          timestamp: snapshot1.timestamp,
          metadata: snapshot1.metadata
        },
        to: {
          snapshotId: snapshotId2,
          timestamp: snapshot2.timestamp,
          metadata: snapshot2.metadata
        },
        timeDelta: this._calculateTimeDelta(snapshot1.timestamp, snapshot2.timestamp)
      };

      return diff;
    } catch (error) {
      throw new Error(`Failed to compare snapshots: ${error.message}`);
    }
  }

  /**
   * Calculate time delta between two timestamps
   * @private
   * @param {string} timestamp1 - First timestamp
   * @param {string} timestamp2 - Second timestamp
   * @returns {Object} Time delta information
   */
  _calculateTimeDelta(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const deltaMs = Math.abs(date2 - date1);

    const seconds = Math.floor(deltaMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return {
      milliseconds: deltaMs,
      seconds,
      minutes,
      hours,
      days,
      humanReadable: this._formatTimeDelta(days, hours, minutes, seconds)
    };
  }

  /**
   * Format time delta as human-readable string
   * @private
   */
  _formatTimeDelta(days, hours, minutes, seconds) {
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours % 24} hour${(hours % 24) !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}, ${seconds % 60} second${(seconds % 60) !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Remove old snapshots, keeping only the most recent N
   * @param {number} maxSnapshots - Maximum number of snapshots to keep (default: 10)
   * @returns {Promise<number>} Number of snapshots deleted
   */
  async pruneOldSnapshots(maxSnapshots = 10) {
    try {
      // Get all snapshots sorted by timestamp (newest first)
      const snapshots = await this.listSnapshots();

      // If we're under the limit, nothing to do
      if (snapshots.length <= maxSnapshots) {
        return 0;
      }

      // Identify snapshots to delete (everything beyond maxSnapshots)
      const snapshotsToDelete = snapshots.slice(maxSnapshots);

      // Delete old snapshots
      let deletedCount = 0;
      for (const snapshot of snapshotsToDelete) {
        try {
          const snapshotPath = this.getSnapshotPath(snapshot.id);
          await fs.unlink(snapshotPath);
          deletedCount++;
        } catch (error) {
          console.warn(`Warning: Failed to delete snapshot ${snapshot.id}: ${error.message}`);
        }
      }

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to prune old snapshots: ${error.message}`);
    }
  }

  /**
   * Delete a specific snapshot
   * @param {string} snapshotId - ID of the snapshot to delete
   * @returns {Promise<void>}
   */
  async deleteSnapshot(snapshotId) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);

      // Check if snapshot exists
      try {
        await fs.access(snapshotPath);
      } catch (error) {
        // Silently succeed if snapshot doesn't exist
        return;
      }

      // Delete the snapshot file
      await fs.unlink(snapshotPath);
    } catch (error) {
      throw new Error(`Failed to delete snapshot '${snapshotId}': ${error.message}`);
    }
  }

  /**
   * Check if a snapshot exists
   * @param {string} snapshotId - ID of the snapshot to check
   * @returns {Promise<boolean>} True if snapshot exists
   */
  async hasSnapshot(snapshotId) {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);
      await fs.access(snapshotPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get statistics about the history
   * @returns {Promise<Object>} History statistics
   */
  async getHistoryStats() {
    try {
      const snapshots = await this.listSnapshots();

      if (snapshots.length === 0) {
        return {
          totalSnapshots: 0,
          oldestSnapshot: null,
          newestSnapshot: null,
          totalSize: 0
        };
      }

      // Calculate total size
      let totalSize = 0;
      for (const snapshot of snapshots) {
        try {
          const snapshotPath = this.getSnapshotPath(snapshot.id);
          const stats = await fs.stat(snapshotPath);
          totalSize += stats.size;
        } catch (error) {
          // Skip if file not found
        }
      }

      return {
        totalSnapshots: snapshots.length,
        oldestSnapshot: snapshots[snapshots.length - 1],
        newestSnapshot: snapshots[0],
        totalSize,
        averageSize: Math.round(totalSize / snapshots.length)
      };
    } catch (error) {
      throw new Error(`Failed to get history stats: ${error.message}`);
    }
  }
}

module.exports = MapHistory;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node map-history.js <command> <project-path> [args...]');
    console.log('\nCommands:');
    console.log('  list <project-path>                                    - List all historical snapshots');
    console.log('  save <project-path> [reason]                           - Save current maps to history');
    console.log('  load <project-path> <snapshot-id>                      - Load a historical snapshot');
    console.log('  compare <project-path> <snapshot-id-1> <snapshot-id-2> - Compare two snapshots');
    console.log('  prune <project-path> [max-snapshots]                   - Prune old snapshots (default: 10)');
    console.log('  delete <project-path> <snapshot-id>                    - Delete a specific snapshot');
    console.log('  stats <project-path>                                   - Show history statistics');
    console.log('\nExamples:');
    console.log('  node map-history.js list .');
    console.log('  node map-history.js save . "before-refactor"');
    console.log('  node map-history.js compare . 20250108-143022 20250108-150045');
    console.log('  node map-history.js prune . 5');
    console.log('  node map-history.js stats .');
    process.exit(1);
  }

  const command = args[0];
  const projectPath = path.resolve(args[1]);

  const crypto = require('crypto');
  const normalized = path.resolve(projectPath);
  const projectHash = crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);

  const history = new MapHistory(projectPath, projectHash);

  (async () => {
    try {
      switch (command) {
        case 'list': {
          const snapshots = await history.listSnapshots();
          if (snapshots.length === 0) {
            console.log('No historical snapshots found');
          } else {
            console.log(`Found ${snapshots.length} historical snapshot(s):\n`);
            snapshots.forEach(snapshot => {
              console.log(`  ID: ${snapshot.id}`);
              console.log(`  Timestamp: ${snapshot.timestamp}`);
              console.log(`  Reason: ${snapshot.metadata.reason || 'N/A'}`);
              if (snapshot.metadata.notes) {
                console.log(`  Notes: ${snapshot.metadata.notes}`);
              }
              console.log('');
            });
          }
          break;
        }

        case 'save': {
          const reason = args[2] || 'manual-save';
          console.error('Error: save command requires map data from stdin (not implemented in CLI mode)');
          console.error('Use the class programmatically to save snapshots');
          console.error(`Example: history.saveHistorySnapshot(maps, { reason: '${reason}' })`);
          process.exit(1);
        }

        case 'load': {
          const snapshotId = args[2];
          if (!snapshotId) {
            console.error('Error: snapshot-id required');
            process.exit(1);
          }
          const data = await history.loadHistoricalSnapshot(snapshotId);
          console.log(JSON.stringify(data, null, 2));
          break;
        }

        case 'compare': {
          const snapshotId1 = args[2];
          const snapshotId2 = args[3];
          if (!snapshotId1 || !snapshotId2) {
            console.error('Error: two snapshot-ids required');
            process.exit(1);
          }
          const diff = await history.compareAcrossHistory(snapshotId1, snapshotId2);
          console.log(JSON.stringify(diff, null, 2));
          break;
        }

        case 'prune': {
          const maxSnapshots = args[2] ? parseInt(args[2]) : 10;
          const deletedCount = await history.pruneOldSnapshots(maxSnapshots);
          console.log(`Pruned ${deletedCount} old snapshot(s), keeping ${maxSnapshots} most recent`);
          break;
        }

        case 'delete': {
          const snapshotId = args[2];
          if (!snapshotId) {
            console.error('Error: snapshot-id required');
            process.exit(1);
          }
          await history.deleteSnapshot(snapshotId);
          console.log(`Deleted snapshot: ${snapshotId}`);
          break;
        }

        case 'stats': {
          const stats = await history.getHistoryStats();
          console.log('History Statistics:');
          console.log(`  Total Snapshots: ${stats.totalSnapshots}`);
          if (stats.totalSnapshots > 0) {
            console.log(`  Oldest: ${stats.oldestSnapshot.timestamp} (${stats.oldestSnapshot.id})`);
            console.log(`  Newest: ${stats.newestSnapshot.timestamp} (${stats.newestSnapshot.id})`);
            console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
            console.log(`  Average Size: ${(stats.averageSize / 1024).toFixed(2)} KB`);
          }
          break;
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
