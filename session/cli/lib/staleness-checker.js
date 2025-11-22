const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Staleness Checker
 * Detects if project maps are outdated by comparing:
 * - Git commit hash
 * - File count
 * - Directory structure changes
 * Returns staleness score (0-100)
 */

class StalenessChecker {
  /**
   * Check staleness of a project map
   * @param {string} projectPath - Path to the project
   * @param {Object} storedMetadata - Metadata from the map file
   * @returns {Object} Staleness result with score and reasons
   */
  static checkStaleness(projectPath, storedMetadata) {
    const result = {
      score: 0,
      isStale: false,
      reasons: [],
      currentState: {},
      storedState: {}
    };

    try {
      // Get current state
      const currentGitHash = this.getCurrentGitHash(projectPath);
      const currentFileCount = this.getFileCount(projectPath);
      const currentDirStructure = this.getDirectoryStructure(projectPath);

      result.currentState = {
        gitHash: currentGitHash,
        fileCount: currentFileCount,
        dirCount: currentDirStructure.length
      };

      // Extract stored state
      const storedState = storedMetadata.staleness || {};
      result.storedState = {
        gitHash: storedState.gitHash,
        fileCount: storedState.fileCount,
        lastRefresh: storedState.lastRefresh
      };

      // Calculate staleness factors

      // 1. Git hash changed (40 points)
      if (currentGitHash !== storedState.gitHash) {
        result.score += 40;
        result.reasons.push(`Git hash changed: ${storedState.gitHash} → ${currentGitHash}`);
      }

      // 2. File count changed (30 points)
      const fileCountDiff = Math.abs(currentFileCount - (storedState.fileCount || 0));
      if (fileCountDiff > 0) {
        const fileCountScore = Math.min(30, fileCountDiff * 3);
        result.score += fileCountScore;
        result.reasons.push(`File count changed by ${fileCountDiff}: ${storedState.fileCount} → ${currentFileCount}`);
      }

      // 3. Time since last refresh (30 points max)
      if (storedState.lastRefresh) {
        const timeDiff = Date.now() - new Date(storedState.lastRefresh).getTime();
        const daysSinceRefresh = timeDiff / (1000 * 60 * 60 * 24);

        if (daysSinceRefresh > 7) {
          const timeScore = Math.min(30, Math.floor(daysSinceRefresh * 4));
          result.score += timeScore;
          result.reasons.push(`${Math.floor(daysSinceRefresh)} days since last refresh`);
        }
      }

      // Cap score at 100
      result.score = Math.min(100, result.score);

      // Determine staleness level
      if (result.score >= 60) {
        result.isStale = true;
        result.level = 'critical';
        result.recommendation = 'Full refresh recommended';
      } else if (result.score >= 30) {
        result.isStale = true;
        result.level = 'moderate';
        result.recommendation = 'Incremental refresh recommended';
      } else if (result.score > 0) {
        result.isStale = false;
        result.level = 'minor';
        result.recommendation = 'Maps are mostly fresh';
      } else {
        result.isStale = false;
        result.level = 'fresh';
        result.recommendation = 'Maps are up to date';
      }

      return result;

    } catch (error) {
      return {
        score: 0,
        isStale: false,
        error: error.message,
        recommendation: 'Unable to check staleness'
      };
    }
  }

  /**
   * Get current git commit hash
   */
  static getCurrentGitHash(projectPath) {
    try {
      const hash = execSync('git rev-parse --short HEAD', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return hash;
    } catch (error) {
      return 'no-git';
    }
  }

  /**
   * Get current file count (excluding ignored files)
   */
  static getFileCount(projectPath) {
    try {
      // Use git ls-files to get tracked files only
      const files = execSync('git ls-files', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim().split('\n').filter(f => f.length > 0);
      return files.length;
    } catch (error) {
      // Fallback: count all files recursively (excluding common ignore patterns)
      return this.countFilesRecursive(projectPath);
    }
  }

  /**
   * Get directory structure (top-level directories)
   */
  static getDirectoryStructure(projectPath) {
    try {
      const items = fs.readdirSync(projectPath);
      const dirs = items.filter(item => {
        const itemPath = path.join(projectPath, item);
        return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
      });
      return dirs;
    } catch (error) {
      return [];
    }
  }

  /**
   * Count files recursively (fallback method)
   */
  static countFilesRecursive(dirPath, count = 0) {
    try {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        // Skip common ignored directories
        if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') {
          continue;
        }

        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          count = this.countFilesRecursive(itemPath, count);
        } else {
          count++;
        }
      }
      return count;
    } catch (error) {
      return count;
    }
  }

  /**
   * Quick check if map needs refresh (returns boolean)
   */
  static needsRefresh(projectPath, storedMetadata, threshold = 30) {
    const result = this.checkStaleness(projectPath, storedMetadata);
    return result.score >= threshold;
  }
}

module.exports = StalenessChecker;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node staleness-checker.js <project-path> <map-file>');
    console.log('Example: node staleness-checker.js . ~/.claude/project-maps/abc123/summary.json');
    process.exit(1);
  }

  const projectPath = args[0];
  const mapFile = args[1];

  try {
    const mapData = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    const metadata = typeof mapData.data === 'string' ? JSON.parse(mapData.data) : mapData.data;

    const result = StalenessChecker.checkStaleness(projectPath, metadata);

    console.log('\n=== Staleness Check ===\n');
    console.log(`Score: ${result.score}/100`);
    console.log(`Level: ${result.level}`);
    console.log(`Is Stale: ${result.isStale}`);
    console.log(`Recommendation: ${result.recommendation}`);

    if (result.reasons.length > 0) {
      console.log('\nReasons:');
      result.reasons.forEach(reason => console.log(`  - ${reason}`));
    }

    console.log('\nCurrent State:', result.currentState);
    console.log('Stored State:', result.storedState);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
