#!/usr/bin/env node

const path = require('path');
const MapGenerator = require('./map-generator');
const MapLoader = require('./map-loader');
const IncrementalUpdater = require('./incremental-updater');
const StalenessChecker = require('./staleness-checker');
const MapSnapshot = require('./map-snapshot');
const MapDiffer = require('./map-differ');
const { DiffFormatter } = require('./diff-formatter');

/**
 * Project Maps Refresh CLI
 * Refresh project context maps (full or incremental)
 */

class RefreshCLI {
  constructor() {
    this.projectRoot = process.cwd();
    this.mode = 'auto'; // auto, full, or incremental
    this.verbose = false;
  }

  async run() {
    try {
      // Parse arguments
      const args = process.argv.slice(2);
      this.parseArguments(args);

      console.log('Project Maps Refresh\n');

      // Step 1: Check if maps exist
      const loader = new MapLoader(this.projectRoot);
      const mapsExist = await loader.exists();

      if (!mapsExist) {
        console.log('❌ No project maps found\n');
        console.log('Generate maps first with:\n');
        console.log('  node session/cli/lib/map-generator.js\n');
        process.exit(1);
      }

      const projectHash = loader.getProjectHash();
      const mapsDir = loader.getMapsDirectory();

      console.log(`✓ Maps found`);
      console.log(`  Location: ${mapsDir}`);
      console.log(`  Project hash: ${projectHash}\n`);

      // Step 2: Determine refresh mode
      const refreshMode = await this.determineRefreshMode(loader);

      console.log(`Refresh mode: ${refreshMode}\n`);

      // Step 3: Perform refresh
      const startTime = Date.now();
      let result;

      if (refreshMode === 'full') {
        result = await this.performFullRefresh();
      } else {
        result = await this.performIncrementalRefresh(projectHash);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Step 4: Show results
      this.showResults(result, refreshMode, totalTime);

      // Step 5: Verify staleness
      await this.verifyFreshness(loader);

      console.log('\n✓ Refresh complete!\n');

    } catch (error) {
      console.error('\n❌ Refresh failed:', error.message);
      console.error('\nTry:');
      console.error('  1. Check git status');
      console.error('  2. Ensure no file permission issues');
      console.error('  3. Run full refresh: node refresh-cli.js --full\n');
      process.exit(1);
    }
  }

  parseArguments(args) {
    if (args.includes('--full')) {
      this.mode = 'full';
    } else if (args.includes('--incremental')) {
      this.mode = 'incremental';
    } else {
      this.mode = 'auto';
    }

    // Check for verbose flag
    if (args.includes('--verbose')) {
      this.verbose = true;
    }

    // Override project root if specified
    const pathIndex = args.indexOf('--project');
    if (pathIndex >= 0 && args[pathIndex + 1]) {
      this.projectRoot = path.resolve(args[pathIndex + 1]);
    }
  }

  async determineRefreshMode(loader) {
    if (this.mode !== 'auto') {
      return this.mode;
    }

    // Auto-detect mode based on changes
    try {
      const summaryMap = await loader.load('summary', { checkStaleness: false });
      const stalenessResult = StalenessChecker.checkStaleness(this.projectRoot, summaryMap);

      // If score >= 60 or git hash changed, recommend full refresh
      if (stalenessResult.score >= 60) {
        console.log('⚠️  Significant changes detected');
        console.log(`   Staleness: ${stalenessResult.score}/100`);
        return 'full';
      }

      // Otherwise use incremental
      return 'incremental';

    } catch (error) {
      // If we can't determine, use full refresh to be safe
      console.log('⚠️  Could not auto-detect, using full refresh');
      return 'full';
    }
  }

  async performFullRefresh() {
    console.log('Performing full refresh...\n');

    // Step 1: Load current maps for snapshot
    const loader = new MapLoader(this.projectRoot);
    const snapshot = new MapSnapshot(this.projectRoot, loader.getProjectHash());

    // Step 2: Save snapshot of current state
    let oldMaps = null;
    if (await loader.exists()) {
      try {
        oldMaps = await loader.loadAll();
        await snapshot.saveSnapshot(oldMaps, 'pre-refresh');
        console.log('✓ Saved snapshot of current maps\n');
      } catch (error) {
        console.warn(`⚠️  Could not save snapshot: ${error.message}\n`);
      }
    }

    // Step 3: Generate new maps
    const generator = new MapGenerator(this.projectRoot);
    const result = await generator.generateAll();

    // Step 4: Generate diff if we had old maps
    let diffReport = null;
    if (oldMaps) {
      try {
        const newMaps = await loader.loadAll();
        diffReport = MapDiffer.generateFullDiff(oldMaps, newMaps);
        await snapshot.deleteSnapshot('pre-refresh');
      } catch (error) {
        console.warn(`⚠️  Could not generate diff: ${error.message}\n`);
      }
    }

    return {
      type: 'full',
      filesScanned: result.files,
      mapsGenerated: 11,
      diffReport
    };
  }

  async performIncrementalRefresh(projectHash) {
    console.log('Performing incremental refresh...\n');

    const loader = new MapLoader(this.projectRoot);
    const summaryMap = await loader.load('summary', { checkStaleness: false });

    const lastCommitHash = summaryMap.staleness?.gitHash || summaryMap.lastCommit?.hash;

    if (!lastCommitHash || lastCommitHash === 'no-git') {
      console.log('⚠️  No git history found, falling back to full refresh\n');
      return await this.performFullRefresh();
    }

    // Step 1: Save snapshot of current state
    const snapshot = new MapSnapshot(this.projectRoot, projectHash);
    let oldMaps = null;
    try {
      oldMaps = await loader.loadAll();
      await snapshot.saveSnapshot(oldMaps, 'pre-refresh');
      console.log('✓ Saved snapshot of current maps\n');
    } catch (error) {
      console.warn(`⚠️  Could not save snapshot: ${error.message}\n`);
    }

    // Step 2: Perform incremental update
    const updater = new IncrementalUpdater(this.projectRoot, projectHash);
    const result = await updater.performUpdate(lastCommitHash);

    if (!result.success) {
      if (result.message && result.message.includes('full rescan')) {
        console.log(`\n${result.message}`);
        console.log('Switching to full refresh...\n');
        return await this.performFullRefresh();
      }
      throw new Error(result.error || result.message);
    }

    // Step 3: Generate diff if we had old maps
    let diffReport = null;
    if (oldMaps) {
      try {
        const newMaps = await loader.loadAll();
        diffReport = MapDiffer.generateFullDiff(oldMaps, newMaps);
        await snapshot.deleteSnapshot('pre-refresh');
      } catch (error) {
        console.warn(`⚠️  Could not generate diff: ${error.message}\n`);
      }
    }

    return {
      type: 'incremental',
      filesScanned: result.filesScanned,
      mapsUpdated: result.mapsUpdated?.length || 0,
      updateTime: result.updateTime,
      diffReport
    };
  }

  showResults(result, mode, totalTime) {
    console.log('\n=== Refresh Results ===\n');

    if (mode === 'full') {
      console.log('✓ Full refresh completed\n');
      console.log('Maps regenerated: 11 maps');
      console.log(`  • summary.json (Level 1)`);
      console.log(`  • tree.json (Level 2)`);
      console.log(`  • metadata.json (Level 3)`);
      console.log(`  • content-summaries.json (Level 3)`);
      console.log(`  • indices.json (Level 3)`);
      console.log(`  • existence-proofs.json (Level 2)`);
      console.log(`  • quick-queries.json (Level 1)`);
      console.log(`  • dependencies-forward.json (Level 4)`);
      console.log(`  • dependencies-reverse.json (Level 4)`);
      console.log(`  • relationships.json (Level 4)`);
      console.log(`  • issues.json (Level 4)\n`);
    } else {
      console.log('✓ Incremental refresh completed\n');
      console.log(`Files scanned: ${result.filesScanned}`);
      console.log(`Maps updated: ${result.mapsUpdated}\n`);
    }

    console.log('Statistics:');
    console.log(`  Files processed: ${result.filesScanned}`);
    console.log(`  Time taken: ${totalTime}ms`);

    // Show diff results if available
    if (result.diffReport) {
      this.showDiffResults(result.diffReport);
    }
  }

  showDiffResults(diffReport) {
    if (!diffReport || !diffReport.summary) {
      return;
    }

    console.log('\n=== Changes Detected ===\n');

    const formatter = new DiffFormatter({ projectRoot: this.projectRoot });

    if (this.verbose) {
      // Verbose mode: show detailed diff
      const verboseOutput = formatter.formatVerbose(diffReport);
      console.log(verboseOutput);
    } else {
      // Summary mode: show one-line summary
      const summary = formatter.formatSummary(diffReport);
      console.log(summary);
    }
  }

  async verifyFreshness(loader) {
    const stalenessResult = await loader.checkStaleness();

    if (stalenessResult.error) {
      console.log('\n⚠️  Could not verify freshness');
      return;
    }

    console.log(`\nStaleness: ${stalenessResult.score}/100 (${stalenessResult.level})`);
    console.log(`Recommendation: ${stalenessResult.recommendation}`);
  }
}

// Run CLI
if (require.main === module) {
  const cli = new RefreshCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = RefreshCLI;
