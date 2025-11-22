const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const compression = require('./compression');
const StalenessChecker = require('./staleness-checker');

/**
 * Map Loader
 * Loads project context maps with automatic staleness checking
 * Shows warnings when maps are outdated
 */

class MapLoader {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.projectHash = this.generateProjectHash(projectRoot);
    this.mapsDir = path.join(process.env.HOME, '.claude/project-maps', this.projectHash);

    // Staleness thresholds
    this.options = {
      warnThreshold: options.warnThreshold || 30,
      criticalThreshold: options.criticalThreshold || 60,
      autoCheck: options.autoCheck !== false, // Default true
      verbose: options.verbose || false
    };

    this.stalenessResult = null;
  }

  /**
   * Generate project hash
   */
  generateProjectHash(projectPath) {
    const normalized = path.resolve(projectPath);
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Load a map file with automatic staleness checking
   * @param {string} mapName - Name of the map (e.g., 'summary', 'metadata')
   * @param {Object} options - Loading options
   * @returns {Object} Map data
   */
  async load(mapName, options = {}) {
    const checkStaleness = options.checkStaleness !== false && this.options.autoCheck;

    try {
      // Ensure .json extension
      const filename = mapName.endsWith('.json') ? mapName : `${mapName}.json`;
      const filePath = path.join(this.mapsDir, filename);

      // Check if map exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Map '${mapName}' not found at ${filePath}. Run generation first.`);
      }

      // Load and decompress map file
      const decompressed = await compression.loadAndDecompress(filePath);
      const mapData = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;

      // Perform staleness check if enabled
      if (checkStaleness && mapData.staleness) {
        this.stalenessResult = StalenessChecker.checkStaleness(this.projectRoot, mapData);

        // Show warnings based on threshold
        if (this.stalenessResult.score >= this.options.criticalThreshold) {
          console.warn('\n⚠️  WARNING: Project maps are critically outdated!');
          console.warn(`   Staleness score: ${this.stalenessResult.score}/100`);
          console.warn(`   Recommendation: ${this.stalenessResult.recommendation}`);
          if (this.stalenessResult.reasons.length > 0) {
            console.warn('\n   Reasons:');
            this.stalenessResult.reasons.forEach(r => console.warn(`   • ${r}`));
          }
          console.warn('\n   Run: /project-maps refresh --full\n');
        } else if (this.stalenessResult.score >= this.options.warnThreshold) {
          console.warn('\n⚠️  Maps may be outdated');
          console.warn(`   Staleness: ${this.stalenessResult.score}/100 - ${this.stalenessResult.recommendation}`);
          console.warn('   Consider running: /project-maps refresh --incremental\n');
        } else if (this.options.verbose && this.stalenessResult.score > 0) {
          console.log(`✓ Maps are mostly fresh (staleness: ${this.stalenessResult.score}/100)`);
        }

        // Add staleness info to returned data
        mapData._staleness = this.stalenessResult;
      }

      return mapData;

    } catch (error) {
      throw new Error(`Failed to load map '${mapName}': ${error.message}`);
    }
  }

  /**
   * Load multiple maps at once
   * @param {string[]} mapNames - Array of map names
   * @param {Object} options - Loading options
   * @returns {Object} Object with map names as keys
   */
  async loadMultiple(mapNames, options = {}) {
    const results = {};

    // Only check staleness once for the first map
    let checkStaleness = options.checkStaleness !== false && this.options.autoCheck;

    for (const mapName of mapNames) {
      try {
        results[mapName] = await this.load(mapName, {
          ...options,
          checkStaleness
        });
        checkStaleness = false; // Don't check again for subsequent maps
      } catch (error) {
        if (options.throwOnError) {
          throw error;
        }
        results[mapName] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Load maps by tier (for tiered loading architecture)
   * @param {number} tier - Tier level (1, 2, or 3)
   * @returns {Object} Maps for that tier
   */
  async loadTier(tier) {
    const tierMaps = {
      1: ['summary', 'quick-queries'],
      2: ['tree', 'existence-proofs'],
      3: ['metadata', 'content-summaries', 'indices',
          'dependencies-forward', 'dependencies-reverse',
          'relationships', 'issues']
    };

    const maps = tierMaps[tier];
    if (!maps) {
      throw new Error(`Invalid tier: ${tier}. Must be 1, 2, or 3.`);
    }

    return await this.loadMultiple(maps);
  }

  /**
   * Load all available maps
   * @returns {Object} All maps
   */
  async loadAll() {
    const allMaps = [
      'summary',
      'tree',
      'metadata',
      'content-summaries',
      'indices',
      'existence-proofs',
      'quick-queries',
      'dependencies-forward',
      'dependencies-reverse',
      'relationships',
      'issues'
    ];

    return await this.loadMultiple(allMaps);
  }

  /**
   * Check staleness without loading full map
   * @returns {Object} Staleness result
   */
  async checkStaleness() {
    try {
      const summaryMap = await this.load('summary', { checkStaleness: false });
      this.stalenessResult = StalenessChecker.checkStaleness(this.projectRoot, summaryMap);
      return this.stalenessResult;
    } catch (error) {
      return {
        error: error.message,
        recommendation: 'Unable to check staleness'
      };
    }
  }

  /**
   * Get the last staleness check result
   */
  getStalenessResult() {
    return this.stalenessResult;
  }

  /**
   * Check if maps exist for this project
   */
  async exists() {
    try {
      await fs.access(this.mapsDir);
      const summaryPath = path.join(this.mapsDir, 'summary.json');
      await fs.access(summaryPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get map directory path
   */
  getMapsDirectory() {
    return this.mapsDir;
  }

  /**
   * Get project hash
   */
  getProjectHash() {
    return this.projectHash;
  }
}

module.exports = MapLoader;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node map-loader.js <project-path> [map-name] [--no-check]');
    console.log('Examples:');
    console.log('  node map-loader.js .                    # Check if maps exist');
    console.log('  node map-loader.js . summary            # Load summary map');
    console.log('  node map-loader.js . --tier 1           # Load tier 1 maps');
    console.log('  node map-loader.js . --all              # Load all maps');
    console.log('  node map-loader.js . --staleness-only   # Just check staleness');
    process.exit(1);
  }

  const projectPath = args[0];
  const noCheck = args.includes('--no-check');

  const loader = new MapLoader(projectPath, {
    autoCheck: !noCheck,
    verbose: true
  });

  (async () => {
    try {
      const exists = await loader.exists();
      if (!exists) {
        console.log('❌ No maps found for this project');
        console.log(`   Expected at: ${loader.getMapsDirectory()}`);
        console.log('   Run generation first: /project-maps generate');
        process.exit(1);
      }

      console.log(`✓ Maps found at: ${loader.getMapsDirectory()}`);
      console.log(`  Project hash: ${loader.getProjectHash()}\n`);

      if (args.includes('--staleness-only')) {
        const result = await loader.checkStaleness();
        console.log('Staleness Check:');
        console.log(`  Score: ${result.score}/100`);
        console.log(`  Level: ${result.level}`);
        console.log(`  Recommendation: ${result.recommendation}`);
        process.exit(0);
      }

      if (args.includes('--tier')) {
        const tierIndex = args.indexOf('--tier');
        const tier = parseInt(args[tierIndex + 1]);
        const maps = await loader.loadTier(tier);
        console.log(`Loaded ${Object.keys(maps).length} maps from tier ${tier}`);
      } else if (args.includes('--all')) {
        const maps = await loader.loadAll();
        console.log(`Loaded ${Object.keys(maps).length} maps`);
      } else if (args[1] && !args[1].startsWith('--')) {
        const mapName = args[1];
        const map = await loader.load(mapName);
        console.log(`Loaded map: ${mapName}`);
        console.log(JSON.stringify(map, null, 2));
      }

    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
