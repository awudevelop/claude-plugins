const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Centralized Path Resolver for Project Maps
 *
 * Handles path resolution for project maps with backward compatibility:
 * - Primary: Project-local storage at {projectRoot}/.claude/project-maps/
 * - Fallback: Legacy global storage at ~/.claude/project-maps/{hash}/
 *
 * Benefits of project-local storage:
 * - Maps travel with the project (git-committable)
 * - No hash collision risk
 * - Multiple developers share same maps
 * - Simpler path logic
 */

class MapPaths {
  /**
   * @param {string} projectRoot - Absolute path to project root
   * @param {Object} options - Configuration options
   * @param {boolean} options.preferLegacy - Force use of legacy global paths (default: false)
   * @param {boolean} options.createDirs - Auto-create directories if missing (default: false)
   */
  constructor(projectRoot, options = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.options = {
      preferLegacy: options.preferLegacy || false,
      createDirs: options.createDirs || false
    };

    // Compute paths
    this.projectHash = this._generateProjectHash(this.projectRoot);
    this.projectLocalPath = path.join(this.projectRoot, '.claude', 'project-maps');
    this.legacyGlobalPath = path.join(process.env.HOME, '.claude/project-maps', this.projectHash);

    // Determine active path (cached after first resolution)
    this._resolvedPath = null;
    this._isLegacy = null;
  }

  /**
   * Generate MD5 hash for legacy path compatibility
   * @private
   */
  _generateProjectHash(projectPath) {
    const normalized = path.resolve(projectPath);
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if a directory exists
   * @private
   */
  _existsSync(dirPath) {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if maps exist at a given path (looks for summary.json)
   * @private
   */
  _hasMapsSync(dirPath) {
    try {
      return fs.statSync(path.join(dirPath, 'summary.json')).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get the maps directory path with backward-compatible resolution
   *
   * Resolution order:
   * 1. If preferLegacy option is set, use legacy path
   * 2. If project-local path has maps, use it
   * 3. If legacy path has maps, use it (with isLegacy flag)
   * 4. Default to project-local for new projects
   *
   * @returns {string} Resolved maps directory path
   */
  getMapsDir() {
    if (this._resolvedPath !== null) {
      return this._resolvedPath;
    }

    // Option to force legacy behavior
    if (this.options.preferLegacy) {
      this._resolvedPath = this.legacyGlobalPath;
      this._isLegacy = true;
      return this._resolvedPath;
    }

    // Check project-local first
    if (this._hasMapsSync(this.projectLocalPath)) {
      this._resolvedPath = this.projectLocalPath;
      this._isLegacy = false;
      return this._resolvedPath;
    }

    // Check legacy global path
    if (this._hasMapsSync(this.legacyGlobalPath)) {
      this._resolvedPath = this.legacyGlobalPath;
      this._isLegacy = true;
      return this._resolvedPath;
    }

    // Default to project-local for new projects
    this._resolvedPath = this.projectLocalPath;
    this._isLegacy = false;
    return this._resolvedPath;
  }

  /**
   * Get the output directory for map generation
   * Always returns project-local path for new generation
   *
   * @param {boolean} forceProjectLocal - Force project-local even if legacy exists
   * @returns {string} Output directory path
   */
  getOutputDir(forceProjectLocal = true) {
    if (forceProjectLocal) {
      return this.projectLocalPath;
    }
    return this.getMapsDir();
  }

  /**
   * Get path for a specific map file
   * @param {string} mapName - Name of the map (e.g., 'summary', 'metadata')
   * @returns {string} Full path to the map file
   */
  getMapPath(mapName) {
    const filename = mapName.endsWith('.json') ? mapName : `${mapName}.json`;
    return path.join(this.getMapsDir(), filename);
  }

  /**
   * Get the history subdirectory path
   * @returns {string} Path to .history directory
   */
  getHistoryDir() {
    return path.join(this.getMapsDir(), '.history');
  }

  /**
   * Get the snapshots subdirectory path
   * @returns {string} Path to .snapshots directory
   */
  getSnapshotsDir() {
    return path.join(this.getMapsDir(), '.snapshots');
  }

  /**
   * Get the compression schema path
   * Schema is stored per-project alongside maps
   * @returns {string} Path to compression schema file
   */
  getSchemaPath() {
    return path.join(this.getMapsDir(), '.compression-schema.json');
  }

  /**
   * Check if currently using legacy global path
   * @returns {boolean} True if using legacy path
   */
  isUsingLegacy() {
    this.getMapsDir(); // Ensure resolution has happened
    return this._isLegacy;
  }

  /**
   * Get the project hash (for backward compatibility APIs)
   * @returns {string} 16-character MD5 hash
   */
  getProjectHash() {
    return this.projectHash;
  }

  /**
   * Get the project root path
   * @returns {string} Absolute project root path
   */
  getProjectRoot() {
    return this.projectRoot;
  }

  /**
   * Create all necessary directories for map storage
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    const fsPromises = require('fs').promises;
    const mapsDir = this.getOutputDir();

    await fsPromises.mkdir(mapsDir, { recursive: true });
    await fsPromises.mkdir(this.getHistoryDir(), { recursive: true });
    await fsPromises.mkdir(this.getSnapshotsDir(), { recursive: true });
  }

  /**
   * Check if maps exist for this project (at any location)
   * @returns {boolean}
   */
  mapsExist() {
    return this._hasMapsSync(this.projectLocalPath) ||
           this._hasMapsSync(this.legacyGlobalPath);
  }

  /**
   * Get migration info if using legacy path
   * @returns {Object|null} Migration info or null if not using legacy
   */
  getMigrationInfo() {
    if (!this.isUsingLegacy()) {
      return null;
    }

    return {
      currentPath: this.legacyGlobalPath,
      targetPath: this.projectLocalPath,
      projectHash: this.projectHash,
      recommendation: 'Run /project-maps migrate to move maps to project directory'
    };
  }

  /**
   * Get all paths info (for debugging/logging)
   * @returns {Object}
   */
  getPathsInfo() {
    return {
      projectRoot: this.projectRoot,
      projectHash: this.projectHash,
      projectLocalPath: this.projectLocalPath,
      legacyGlobalPath: this.legacyGlobalPath,
      activePath: this.getMapsDir(),
      isLegacy: this.isUsingLegacy(),
      mapsExist: this.mapsExist()
    };
  }
}

/**
 * Factory function for creating MapPaths instances
 * @param {string} projectRoot - Project root path
 * @param {Object} options - Configuration options
 * @returns {MapPaths}
 */
function createMapPaths(projectRoot, options = {}) {
  return new MapPaths(projectRoot, options);
}

/**
 * Get the legacy global base directory for listing all projects
 * Used by list command for backward compatibility
 * @returns {string}
 */
function getLegacyBaseDir() {
  return path.join(process.env.HOME, '.claude/project-maps');
}

module.exports = {
  MapPaths,
  createMapPaths,
  getLegacyBaseDir
};

// CLI usage for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectPath = args[0] || process.cwd();

  const paths = new MapPaths(projectPath);
  const info = paths.getPathsInfo();

  console.log('Map Paths Resolution:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Project Root:     ${info.projectRoot}`);
  console.log(`Project Hash:     ${info.projectHash}`);
  console.log(`Project Local:    ${info.projectLocalPath}`);
  console.log(`Legacy Global:    ${info.legacyGlobalPath}`);
  console.log(`Active Path:      ${info.activePath}`);
  console.log(`Using Legacy:     ${info.isLegacy}`);
  console.log(`Maps Exist:       ${info.mapsExist}`);

  if (paths.isUsingLegacy()) {
    console.log('\n⚠️  Using legacy global storage');
    const migration = paths.getMigrationInfo();
    console.log(`   ${migration.recommendation}`);
  }
}
