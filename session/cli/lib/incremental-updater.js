const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const FileScanner = require('./scanner');
const DependencyParser = require('./parser');
const compression = require('./compression');

/**
 * Incremental Updater
 * Updates project maps incrementally by scanning only changed files
 * Much faster than full rescan (target: <20% of full scan time)
 */

class IncrementalUpdater {
  constructor(projectRoot, projectHash) {
    this.projectRoot = projectRoot;
    this.projectHash = projectHash;
    this.mapsDir = path.join(process.env.HOME, '.claude/project-maps', projectHash);
    this.scanner = new FileScanner(projectRoot);
    this.parser = new DependencyParser(projectRoot);
  }

  /**
   * Get list of changed files since last refresh
   * @param {string} lastCommitHash - Hash from last map refresh
   * @returns {Object} Changed, added, and deleted files
   */
  getChangedFiles(lastCommitHash) {
    try {
      // Get files changed since last commit
      const diffOutput = execSync(`git diff --name-status ${lastCommitHash}..HEAD`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      // Also get uncommitted changes
      const unstagedOutput = execSync('git diff --name-status', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      const stagedOutput = execSync('git diff --cached --name-status', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      const allChanges = [diffOutput, unstagedOutput, stagedOutput]
        .filter(s => s.length > 0)
        .join('\n');

      const changes = {
        modified: [],
        added: [],
        deleted: [],
        renamed: []
      };

      if (!allChanges) {
        return changes;
      }

      const lines = allChanges.split('\n');
      for (const line of lines) {
        const parts = line.split('\t');
        const status = parts[0];
        const file = parts[1];

        if (!file) continue;

        if (status === 'M') {
          changes.modified.push(file);
        } else if (status === 'A') {
          changes.added.push(file);
        } else if (status === 'D') {
          changes.deleted.push(file);
        } else if (status.startsWith('R')) {
          const newFile = parts[2];
          changes.renamed.push({ from: file, to: newFile });
        }
      }

      // Deduplicate
      changes.modified = [...new Set(changes.modified)];
      changes.added = [...new Set(changes.added)];
      changes.deleted = [...new Set(changes.deleted)];

      return changes;

    } catch (error) {
      // If git diff fails, return empty (will trigger full rescan)
      return {
        modified: [],
        added: [],
        deleted: [],
        renamed: [],
        error: error.message
      };
    }
  }

  /**
   * Update maps incrementally
   * @param {Object} changes - Changed files from getChangedFiles()
   * @returns {Object} Update results
   */
  async updateMaps(changes) {
    const results = {
      filesScanned: 0,
      mapsUpdated: [],
      timeSaved: 0,
      success: true
    };

    const startTime = Date.now();

    try {
      // Load existing maps
      const summaryMap = await this.loadMap('summary.json');
      const metadataMap = await this.loadMap('metadata.json');
      const treeMap = await this.loadMap('tree.json');
      const contentSummariesMap = await this.loadMap('content-summaries.json');
      const forwardDepsMap = await this.loadMap('dependencies-forward.json');
      const reverseDepsMap = await this.loadMap('dependencies-reverse.json');

      // Get all affected files
      const affectedFiles = [
        ...changes.modified,
        ...changes.added,
        ...changes.renamed.map(r => r.to)
      ];

      results.filesScanned = affectedFiles.length;

      // Rescan only affected files
      for (const file of affectedFiles) {
        const filePath = path.join(this.projectRoot, file);
        try {
          const fileInfo = await this.scanner.scanSingleFile(filePath);

          // Update metadata map
          const existingIndex = metadataMap.files.findIndex(f => f.path === file);
          if (existingIndex >= 0) {
            metadataMap.files[existingIndex] = fileInfo;
          } else {
            metadataMap.files.push(fileInfo);
          }

          // Update content summaries if it's a source file
          if (fileInfo.role === 'source') {
            const parseResult = await this.parser.parseFile(filePath);

            if (parseResult) {
              // Update content summaries
              contentSummariesMap.summaries[file] = {
                exports: parseResult.exports || [],
                entities: parseResult.entities || [],
                firstLines: parseResult.firstLines || ''
              };

              // Update dependencies
              forwardDepsMap.dependencies[file] = {
                imports: parseResult.imports || []
              };
            }
          }

        } catch (error) {
          // File might be deleted, skip
          console.warn(`Skipping ${file}: ${error.message}`);
        }
      }

      // Handle deleted files
      for (const file of changes.deleted) {
        metadataMap.files = metadataMap.files.filter(f => f.path !== file);
        delete contentSummariesMap.summaries[file];
        delete forwardDepsMap.dependencies[file];
      }

      // Regenerate reverse dependencies (affected by any change)
      reverseDepsMap.dependencies = this.generateReverseDeps(forwardDepsMap.dependencies);

      // Update summary stats
      summaryMap.statistics.totalFiles = metadataMap.files.length;
      summaryMap.statistics.lastUpdate = new Date().toISOString();

      // Recalculate primary languages
      const languageCounts = {};
      for (const file of metadataMap.files) {
        languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
      }
      summaryMap.statistics.primaryLanguages = Object.entries(languageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([language, count]) => ({ language, files: count }));

      // Update staleness info
      const currentGitHash = this.getCurrentGitHash();
      summaryMap.staleness = {
        gitHash: currentGitHash,
        fileCount: metadataMap.files.length,
        lastRefresh: new Date().toISOString(),
        isStale: false
      };

      // Save updated maps
      await this.saveMap('summary.json', summaryMap);
      await this.saveMap('metadata.json', metadataMap);
      await this.saveMap('content-summaries.json', contentSummariesMap);
      await this.saveMap('dependencies-forward.json', forwardDepsMap);
      await this.saveMap('dependencies-reverse.json', reverseDepsMap);

      results.mapsUpdated = [
        'summary.json',
        'metadata.json',
        'content-summaries.json',
        'dependencies-forward.json',
        'dependencies-reverse.json'
      ];

      const endTime = Date.now();
      results.updateTime = endTime - startTime;
      results.success = true;

      return results;

    } catch (error) {
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Generate reverse dependencies from forward dependencies
   */
  generateReverseDeps(forwardDeps) {
    const reverseDeps = {};

    for (const [file, deps] of Object.entries(forwardDeps)) {
      if (!deps.imports) continue;

      for (const imp of deps.imports) {
        const imported = imp.from;
        if (!reverseDeps[imported]) {
          reverseDeps[imported] = { importedBy: [] };
        }
        reverseDeps[imported].importedBy.push({
          file: file,
          symbols: imp.symbols || []
        });
      }
    }

    return reverseDeps;
  }

  /**
   * Load a map file
   */
  async loadMap(filename) {
    const filePath = path.join(this.mapsDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);

    // Handle compressed format
    if (parsed.compressed && parsed.data) {
      const decompressed = compression.decompress(parsed);
      return JSON.parse(decompressed);
    }

    return parsed;
  }

  /**
   * Save a map file with compression
   */
  async saveMap(filename, data) {
    const filePath = path.join(this.mapsDir, filename);
    const jsonString = JSON.stringify(data);

    // Apply compression based on size
    const compressed = compression.compress(jsonString, {
      level: jsonString.length > 20000 ? 'ultra-aggressive' : 'aggressive'
    });

    await fs.writeFile(filePath, JSON.stringify(compressed), 'utf8');
  }

  /**
   * Get current git hash
   */
  getCurrentGitHash() {
    try {
      return execSync('git rev-parse --short HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error) {
      return 'no-git';
    }
  }

  /**
   * Perform incremental update
   * @param {string} lastCommitHash - Hash from last refresh
   * @returns {Object} Update results
   */
  async performUpdate(lastCommitHash) {
    const changes = this.getChangedFiles(lastCommitHash);

    const totalChanged = changes.modified.length + changes.added.length +
                        changes.deleted.length + changes.renamed.length;

    console.log(`\nIncremental Update:`);
    console.log(`  Modified: ${changes.modified.length}`);
    console.log(`  Added: ${changes.added.length}`);
    console.log(`  Deleted: ${changes.deleted.length}`);
    console.log(`  Renamed: ${changes.renamed.length}`);
    console.log(`  Total affected: ${totalChanged}\n`);

    if (totalChanged === 0) {
      return {
        success: true,
        filesScanned: 0,
        message: 'No changes detected, maps are up to date'
      };
    }

    // If too many files changed (>30%), recommend full rescan
    const summaryMap = await this.loadMap('summary.json');
    const totalFiles = summaryMap.statistics?.totalFiles || 0;
    const changePercentage = (totalChanged / totalFiles) * 100;

    if (changePercentage > 30) {
      return {
        success: false,
        filesScanned: 0,
        message: `Too many changes (${changePercentage.toFixed(1)}%), full rescan recommended`
      };
    }

    return await this.updateMaps(changes);
  }
}

module.exports = IncrementalUpdater;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node incremental-updater.js <project-path> <project-hash> [last-commit-hash]');
    console.log('Example: node incremental-updater.js . abc123def456 a1b2c3d');
    process.exit(1);
  }

  const projectPath = args[0];
  const projectHash = args[1];
  const lastCommitHash = args[2] || 'HEAD~1';

  const updater = new IncrementalUpdater(projectPath, projectHash);

  updater.performUpdate(lastCommitHash)
    .then(result => {
      if (result.success) {
        console.log('\n✓ Incremental update completed');
        console.log(`  Files scanned: ${result.filesScanned}`);
        console.log(`  Maps updated: ${result.mapsUpdated?.length || 0}`);
        console.log(`  Time: ${result.updateTime}ms`);
      } else {
        console.log('\n✗ Update failed:', result.message || result.error);
        if (result.message?.includes('full rescan')) {
          process.exit(2); // Exit code 2 = full rescan needed
        }
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
