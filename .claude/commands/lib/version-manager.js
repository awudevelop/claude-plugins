#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const PLUGINS = ['session', 'deployment', 'devops'];
const MARKER_FILE = path.join(PROJECT_ROOT, '.version-update-in-progress');

// Load config for static descriptions
const CONFIG_PATH = path.join(__dirname, 'version-update-config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const STATIC_DESCRIPTIONS = CONFIG.f.find(f => f.n === '.claude-plugin/marketplace.json')?.sd || {};

class VersionManager {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.changes = [];
  }

  // Main entry point
  async run(args = []) {
    const flags = this.parseFlags(args);

    try {
      // Step 1: Validate current state
      console.log('📋 Validating current version consistency...\n');
      const isValid = this.validateAll();

      if (!isValid && !flags.force) {
        this.reportErrors();
        process.exit(1);
      }

      // Step 2: If validate-only mode, exit
      if (flags.validateOnly) {
        console.log('✅ All version checks passed!\n');
        return;
      }

      // Step 3: Determine which plugin to update
      const plugin = flags.plugin || this.detectPluginFromGit();
      if (!plugin) {
        console.error('❌ Could not detect which plugin to update. Use --plugin=<name>');
        process.exit(1);
      }

      console.log(`🎯 Updating plugin: ${plugin}\n`);

      // Step 4: Create marker file (allows hooks to permit version changes)
      this.createMarkerFile(plugin);

      // Step 5: Get current commit (this will be the baseline for next update)
      const currentCommit = this.getCurrentCommit();
      const lastUpdateInfo = this.getLastUpdateInfo(plugin);

      // Step 6: Analyze changes since last version update
      const changesSummary = this.getChangesSummary(plugin, lastUpdateInfo);
      if (changesSummary) {
        console.log(changesSummary);
      }

      // Step 7: Determine version bump type
      const bumpType = flags.bumpType || this.analyzeChanges(plugin, lastUpdateInfo);
      console.log(`📈 Bump type: ${bumpType.toUpperCase()}\n`);

      // Step 8: Calculate new version
      const currentVersion = this.getCurrentVersion(plugin);
      const newVersion = this.bumpVersion(currentVersion, bumpType);
      console.log(`🔄 Version: ${currentVersion} → ${newVersion}\n`);

      // Step 9: Update all files (including versionMetadata)
      this.updatePluginVersion(plugin, newVersion, bumpType, currentCommit);

      // Step 10: Report changes
      this.reportChanges();

      console.log('\n✅ Version update complete!');
      console.log(`📍 Baseline commit saved: ${currentCommit.substring(0, 7)}`);
      console.log('\n⚠️  Next steps:');
      console.log('   1. Update CHANGELOG.md manually');
      console.log('   2. Review and commit changes');
      console.log('   3. Create git tag: git tag -a v' + newVersion + ' -m "v' + newVersion + ': description"\n');

    } catch (error) {
      console.error('❌ Error:', error.message);
      if (flags.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      // Always clean up marker file
      this.removeMarkerFile();
    }
  }

  parseFlags(args) {
    const flags = {
      validateOnly: args.includes('--validate'),
      force: args.includes('--force'),
      debug: args.includes('--debug'),
      plugin: null,
      bumpType: null
    };

    // Extract plugin name
    const pluginArg = args.find(arg => arg.startsWith('--plugin='));
    if (pluginArg) {
      flags.plugin = pluginArg.split('=')[1];
    }

    // Extract bump type
    if (args.includes('--force-major')) flags.bumpType = 'major';
    if (args.includes('--force-minor')) flags.bumpType = 'minor';
    if (args.includes('--force-patch')) flags.bumpType = 'patch';

    return flags;
  }

  // Marker file methods (for hook integration)
  createMarkerFile(plugin) {
    const data = {
      plugin,
      timestamp: new Date().toISOString(),
      pid: process.pid
    };
    fs.writeFileSync(MARKER_FILE, JSON.stringify(data, null, 2));
  }

  removeMarkerFile() {
    if (fs.existsSync(MARKER_FILE)) {
      fs.unlinkSync(MARKER_FILE);
    }
  }

  // Git methods
  getCurrentCommit() {
    try {
      return execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT })
        .toString()
        .trim();
    } catch (error) {
      throw new Error('Failed to get current git commit. Is this a git repository?');
    }
  }

  getLastUpdateInfo(plugin) {
    const pluginJsonPath = path.join(PROJECT_ROOT, plugin, 'plugin.json');
    const data = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));

    if (data.versionMetadata) {
      return {
        commit: data.versionMetadata.lastUpdateCommit,
        date: data.versionMetadata.lastUpdateDate,
        bumpType: data.versionMetadata.lastBumpType,
        version: data.version
      };
    }

    return null;
  }

  getChangesSummary(plugin, lastUpdateInfo) {
    if (!lastUpdateInfo || !lastUpdateInfo.commit) {
      return '📊 First version tracking - no baseline commit found\n';
    }

    try {
      // Validate commit exists
      execSync(`git cat-file -e ${lastUpdateInfo.commit}`, { cwd: PROJECT_ROOT });

      // Get stats
      const diffStats = execSync(
        `git diff ${lastUpdateInfo.commit}...HEAD --stat -- ${plugin}/`,
        { cwd: PROJECT_ROOT }
      ).toString().trim();

      if (!diffStats) {
        this.warnings.push(`No changes detected since last version update (${lastUpdateInfo.version})`);
        return '';
      }

      // Get commit count
      const commitCount = execSync(
        `git rev-list ${lastUpdateInfo.commit}..HEAD --count -- ${plugin}/`,
        { cwd: PROJECT_ROOT }
      ).toString().trim();

      // Calculate days ago
      const lastUpdateDate = new Date(lastUpdateInfo.date);
      const daysAgo = Math.floor((Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));

      const summary = [
        `📊 Changes since v${lastUpdateInfo.version} (${lastUpdateInfo.commit.substring(0, 7)}, ${daysAgo} days ago):`,
        `   ${commitCount} commits affecting ${plugin}/`,
        '',
        diffStats.split('\n').map(line => '   ' + line).join('\n'),
        ''
      ].join('\n');

      return summary;

    } catch (error) {
      this.warnings.push(`Could not analyze changes: ${error.message}`);
      return '';
    }
  }

  // Validation methods
  validateAll() {
    let isValid = true;

    for (const plugin of PLUGINS) {
      if (!this.validatePlugin(plugin)) {
        isValid = false;
      }
    }

    return isValid;
  }

  validatePlugin(plugin) {
    let isValid = true;
    const pluginRoot = path.join(PROJECT_ROOT, plugin);

    // Load versions from all sources
    const versions = this.getPluginVersions(plugin);

    // Check 1: plugin.json exists and has version
    if (!versions.pluginJson) {
      this.errors.push(`${plugin}: plugin.json missing or has no version`);
      return false;
    }

    // Check 2: marketplace.json matches plugin.json
    if (versions.marketplace && versions.marketplace !== versions.pluginJson) {
      this.errors.push(
        `${plugin}: marketplace.json version (${versions.marketplace}) doesn't match plugin.json (${versions.pluginJson})`
      );
      isValid = false;
    }

    // Check 3: CLI package.json matches (if exists)
    if (versions.cliPackage && versions.cliPackage !== versions.pluginJson) {
      this.errors.push(
        `${plugin}: cli/package.json version (${versions.cliPackage}) doesn't match plugin.json (${versions.pluginJson})`
      );
      isValid = false;
    }

    // Check 4: Description has version prefix
    const pluginJsonPath = path.join(pluginRoot, 'plugin.json');
    const pluginData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    const descriptionPrefix = pluginData.description.match(/^v(\d+\.\d+\.\d+)\s*-\s*/);

    if (!descriptionPrefix) {
      this.errors.push(`${plugin}: plugin.json description missing version prefix (should start with "vX.Y.Z - ")`);
      isValid = false;
    } else if (descriptionPrefix[1] !== versions.pluginJson) {
      this.errors.push(
        `${plugin}: plugin.json description prefix (v${descriptionPrefix[1]}) doesn't match version (${versions.pluginJson})`
      );
      isValid = false;
    }

    // Check 5: marketplace.json description has version prefix
    const marketplacePath = path.join(PROJECT_ROOT, '.claude-plugin/marketplace.json');
    if (fs.existsSync(marketplacePath)) {
      const marketplaceData = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
      const pluginEntry = marketplaceData.plugins.find(p => p.name === plugin);
      if (pluginEntry) {
        const marketplaceDescPrefix = pluginEntry.description.match(/^v(\d+\.\d+\.\d+)\s*-\s*/);
        if (!marketplaceDescPrefix) {
          this.errors.push(`${plugin}: marketplace.json description missing version prefix`);
          isValid = false;
        } else if (marketplaceDescPrefix[1] !== versions.pluginJson) {
          this.errors.push(
            `${plugin}: marketplace.json description prefix (v${marketplaceDescPrefix[1]}) doesn't match version (${versions.pluginJson})`
          );
          isValid = false;
        }
      }
    }

    // Check 6: README version matches (if exists)
    const readmePath = path.join(pluginRoot, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readmeContent = fs.readFileSync(readmePath, 'utf8');
      const readmeVersion = readmeContent.match(/\*\*Version (\d+\.\d+\.\d+)\*\*/);
      if (readmeVersion && readmeVersion[1] !== versions.pluginJson) {
        this.errors.push(
          `${plugin}: README.md version (${readmeVersion[1]}) doesn't match plugin.json (${versions.pluginJson})`
        );
        isValid = false;
      }
    }

    // Check 7: Validate versionMetadata if it exists
    if (pluginData.versionMetadata) {
      const metadata = pluginData.versionMetadata;

      // Check commit hash format
      if (metadata.lastUpdateCommit && !/^[0-9a-f]{40}$/.test(metadata.lastUpdateCommit)) {
        this.warnings.push(`${plugin}: lastUpdateCommit has invalid format (should be 40-char git hash)`);
      }

      // Check date format
      if (metadata.lastUpdateDate && isNaN(Date.parse(metadata.lastUpdateDate))) {
        this.warnings.push(`${plugin}: lastUpdateDate has invalid format (should be ISO 8601)`);
      }

      // Check bumpType
      if (metadata.lastBumpType && !['major', 'minor', 'patch'].includes(metadata.lastBumpType)) {
        this.warnings.push(`${plugin}: lastBumpType has invalid value (should be major/minor/patch)`);
      }
    }

    return isValid;
  }

  getPluginVersions(plugin) {
    const versions = {};
    const pluginRoot = path.join(PROJECT_ROOT, plugin);

    // Get plugin.json version
    const pluginJsonPath = path.join(pluginRoot, 'plugin.json');
    if (fs.existsSync(pluginJsonPath)) {
      const data = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      versions.pluginJson = data.version;
    }

    // Get marketplace.json version
    const marketplacePath = path.join(PROJECT_ROOT, '.claude-plugin/marketplace.json');
    if (fs.existsSync(marketplacePath)) {
      const data = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
      const pluginEntry = data.plugins.find(p => p.name === plugin);
      if (pluginEntry) {
        versions.marketplace = pluginEntry.version;
      }
    }

    // Get CLI package.json version (if exists)
    const cliPackagePath = path.join(pluginRoot, 'cli/package.json');
    if (fs.existsSync(cliPackagePath)) {
      const data = JSON.parse(fs.readFileSync(cliPackagePath, 'utf8'));
      versions.cliPackage = data.version;
    }

    return versions;
  }

  getCurrentVersion(plugin) {
    const pluginJsonPath = path.join(PROJECT_ROOT, plugin, 'plugin.json');
    const data = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    return data.version;
  }

  // Git analysis to detect change type
  detectPluginFromGit() {
    try {
      const changedFiles = execSync('git diff --name-only HEAD', { cwd: PROJECT_ROOT })
        .toString()
        .trim()
        .split('\n');

      for (const plugin of PLUGINS) {
        if (changedFiles.some(f => f.startsWith(`${plugin}/`))) {
          return plugin;
        }
      }
    } catch (error) {
      // If git fails, return null
    }
    return null;
  }

  analyzeChanges(plugin, lastUpdateInfo) {
    try {
      let diff;

      // If we have a baseline commit, diff from there
      if (lastUpdateInfo && lastUpdateInfo.commit) {
        try {
          diff = execSync(
            `git diff ${lastUpdateInfo.commit}...HEAD -- ${plugin}/`,
            { cwd: PROJECT_ROOT }
          ).toString();
        } catch (error) {
          // Fall back to HEAD if commit doesn't exist
          diff = execSync(`git diff HEAD -- ${plugin}/`, { cwd: PROJECT_ROOT }).toString();
        }
      } else {
        // No baseline, just use HEAD
        diff = execSync(`git diff HEAD -- ${plugin}/`, { cwd: PROJECT_ROOT }).toString();
      }

      // Simple heuristics for determining bump type
      // MAJOR: Breaking changes, removed features, API changes
      if (
        diff.includes('BREAKING') ||
        diff.includes('breaking change') ||
        diff.match(/^-\s*(export|function|class)/m)
      ) {
        return 'major';
      }

      // MINOR: New features, new commands, new functionality
      if (
        diff.includes('feat:') ||
        diff.includes('feature:') ||
        diff.match(/^\+\s*(export|function|class)/m) ||
        diff.includes('new command') ||
        diff.includes('new feature')
      ) {
        return 'minor';
      }

      // PATCH: Bug fixes, docs, refactoring
      return 'patch';
    } catch (error) {
      // Default to patch if we can't analyze
      return 'patch';
    }
  }

  bumpVersion(version, type) {
    const parts = version.split('.').map(Number);

    switch (type) {
      case 'major':
        return `${parts[0] + 1}.0.0`;
      case 'minor':
        return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch':
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
      default:
        throw new Error(`Invalid bump type: ${type}`);
    }
  }

  // Update methods
  updatePluginVersion(plugin, newVersion, bumpType, currentCommit) {
    // Update plugin.json (with versionMetadata)
    this.updatePluginJson(plugin, newVersion, bumpType, currentCommit);

    // Update marketplace.json
    this.updateMarketplaceJson(plugin, newVersion);

    // Update CLI package.json (if exists)
    this.updateCliPackageJson(plugin, newVersion);

    // Update README.md (if exists)
    this.updateReadme(plugin, newVersion);

    // Update root README.md
    this.updateRootReadme(plugin, newVersion);
  }

  updatePluginJson(plugin, newVersion, bumpType, currentCommit) {
    const filePath = path.join(PROJECT_ROOT, plugin, 'plugin.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldVersion = data.version;

    data.version = newVersion;

    // Update description version prefix
    data.description = data.description.replace(/^v\d+\.\d+\.\d+/, `v${newVersion}`);

    // Add/update versionMetadata
    data.versionMetadata = {
      lastUpdateCommit: currentCommit,
      lastUpdateDate: new Date().toISOString(),
      lastBumpType: bumpType
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    this.changes.push(`${plugin}/plugin.json: ${oldVersion} → ${newVersion} (baseline: ${currentCommit.substring(0, 7)})`);
  }

  updateMarketplaceJson(plugin, newVersion) {
    const filePath = path.join(PROJECT_ROOT, '.claude-plugin/marketplace.json');
    if (!fs.existsSync(filePath)) return;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const pluginEntry = data.plugins.find(p => p.name === plugin);

    if (pluginEntry) {
      const oldVersion = pluginEntry.version;
      pluginEntry.version = newVersion;

      // Use static description from config (enforces evergreen description)
      const staticDesc = STATIC_DESCRIPTIONS[plugin];
      if (staticDesc) {
        const oldDesc = pluginEntry.description;
        pluginEntry.description = `v${newVersion} - ${staticDesc}`;

        // Check if description had deviated from static baseline
        const oldDescBody = oldDesc.replace(/^v\d+\.\d+\.\d+\s*-\s*/, '');
        if (oldDescBody !== staticDesc) {
          this.warnings.push(
            `${plugin}: marketplace.json description was reset to static baseline ` +
            `(had deviated from canonical description)`
          );
        }
      } else {
        // Fallback: just update version prefix (shouldn't happen with config)
        pluginEntry.description = pluginEntry.description.replace(/^v\d+\.\d+\.\d+/, `v${newVersion}`);
        this.warnings.push(`${plugin}: No static description in config, only updating version prefix`);
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      this.changes.push(`.claude-plugin/marketplace.json: ${plugin} ${oldVersion} → ${newVersion}`);
    }
  }

  updateCliPackageJson(plugin, newVersion) {
    const filePath = path.join(PROJECT_ROOT, plugin, 'cli/package.json');
    if (!fs.existsSync(filePath)) return;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldVersion = data.version;

    data.version = newVersion;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    this.changes.push(`${plugin}/cli/package.json: ${oldVersion} → ${newVersion}`);
  }

  updateReadme(plugin, newVersion) {
    const filePath = path.join(PROJECT_ROOT, plugin, 'README.md');
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    const oldContent = content;

    // Update version header (e.g., **Version 3.7.1**)
    content = content.replace(
      /\*\*Version \d+\.\d+\.\d+\*\*/g,
      `**Version ${newVersion}**`
    );

    // Update version badges
    content = content.replace(
      /version-v?\d+\.\d+\.\d+-/g,
      `version-v${newVersion}-`
    );

    // Update "What's New in vX.Y.Z" section
    content = content.replace(
      /What's New in v\d+\.\d+\.\d+/g,
      `What's New in v${newVersion}`
    );

    if (content !== oldContent) {
      fs.writeFileSync(filePath, content);
      this.changes.push(`${plugin}/README.md: Updated to v${newVersion}`);
    }
  }

  updateRootReadme(plugin, newVersion) {
    const filePath = path.join(PROJECT_ROOT, 'README.md');
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    const oldContent = content;

    // Update plugin section title (e.g., ### Session Management (v3.7.1))
    const pluginNames = {
      session: 'Session Management',
      deployment: 'Deployment Automation',
      devops: 'DevOps Automation'
    };

    const pluginName = pluginNames[plugin];
    if (pluginName) {
      content = content.replace(
        new RegExp(`(###\\s+${pluginName})\\s+\\(v\\d+\\.\\d+\\.\\d+\\)`, 'g'),
        `$1 (v${newVersion})`
      );
    }

    if (content !== oldContent) {
      fs.writeFileSync(filePath, content);
      this.changes.push(`README.md: Updated ${plugin} to v${newVersion}`);
    }
  }

  // Reporting methods
  reportErrors() {
    if (this.errors.length > 0) {
      console.error('❌ Validation Errors:\n');
      this.errors.forEach(error => console.error(`  • ${error}`));
      console.error('');
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️  Warnings:\n');
      this.warnings.forEach(warning => console.warn(`  • ${warning}`));
      console.warn('');
    }
  }

  reportChanges() {
    if (this.changes.length > 0) {
      console.log('📝 Changes made:\n');
      this.changes.forEach(change => console.log(`  ✓ ${change}`));
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const manager = new VersionManager();
  manager.run(args);
}

module.exports = VersionManager;
