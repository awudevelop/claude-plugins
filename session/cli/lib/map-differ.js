/**
 * Map Differ
 * Compares old and new map snapshots to generate structured diff data
 * Used for incremental map updates and change detection
 */

class MapDiffer {
  /**
   * Compare metadata maps (file-level changes)
   * @param {Object} oldMap - Previous metadata map
   * @param {Object} newMap - Current metadata map
   * @returns {Object} Metadata differences
   */
  static compareMetadata(oldMap, newMap) {
    const result = {
      addedFiles: [],
      removedFiles: [],
      modifiedFiles: [],
      stats: {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
        unchanged: 0
      }
    };

    // Handle missing or invalid maps
    if (!oldMap || !oldMap.files) {
      return {
        ...result,
        addedFiles: newMap?.files || [],
        stats: {
          ...result.stats,
          totalAdded: newMap?.files?.length || 0
        }
      };
    }

    if (!newMap || !newMap.files) {
      return {
        ...result,
        removedFiles: oldMap?.files || [],
        stats: {
          ...result.stats,
          totalRemoved: oldMap?.files?.length || 0
        }
      };
    }

    // Create lookup maps by file path
    const oldFileMap = new Map();
    const newFileMap = new Map();

    oldMap.files.forEach(file => {
      oldFileMap.set(file.path, file);
    });

    newMap.files.forEach(file => {
      newFileMap.set(file.path, file);
    });

    // Find added and modified files
    for (const [path, newFile] of newFileMap) {
      const oldFile = oldFileMap.get(path);

      if (!oldFile) {
        // File was added
        result.addedFiles.push(newFile);
        result.stats.totalAdded++;
      } else {
        // Check if file was modified
        const isModified = this._isFileModified(oldFile, newFile);
        if (isModified) {
          result.modifiedFiles.push({
            path: newFile.path,
            changes: this._getFileChanges(oldFile, newFile),
            old: oldFile,
            new: newFile
          });
          result.stats.totalModified++;
        } else {
          result.stats.unchanged++;
        }
      }
    }

    // Find removed files
    for (const [path, oldFile] of oldFileMap) {
      if (!newFileMap.has(path)) {
        result.removedFiles.push(oldFile);
        result.stats.totalRemoved++;
      }
    }

    return result;
  }

  /**
   * Compare dependency maps (forward dependencies)
   * @param {Object} oldForward - Previous dependencies-forward map
   * @param {Object} newForward - Current dependencies-forward map
   * @returns {Object} Dependency differences
   */
  static compareDependencies(oldForward, newForward) {
    const result = {
      addedDeps: [],
      removedDeps: [],
      changedDeps: [],
      stats: {
        totalAdded: 0,
        totalRemoved: 0,
        totalChanged: 0,
        unchanged: 0
      }
    };

    // Handle missing maps
    if (!oldForward || !oldForward.dependencies) {
      return {
        ...result,
        addedDeps: this._extractAllDependencies(newForward),
        stats: {
          ...result.stats,
          totalAdded: this._extractAllDependencies(newForward).length
        }
      };
    }

    if (!newForward || !newForward.dependencies) {
      return {
        ...result,
        removedDeps: this._extractAllDependencies(oldForward),
        stats: {
          ...result.stats,
          totalRemoved: this._extractAllDependencies(oldForward).length
        }
      };
    }

    const oldDeps = oldForward.dependencies || {};
    const newDeps = newForward.dependencies || {};

    // Create lookup for old dependencies
    const oldDepMap = new Map();
    for (const [file, deps] of Object.entries(oldDeps)) {
      if (deps && deps.imports) {
        deps.imports.forEach(imp => {
          const key = `${file}::${imp.source || imp.module}`;
          oldDepMap.set(key, { file, import: imp });
        });
      }
    }

    // Create lookup for new dependencies
    const newDepMap = new Map();
    for (const [file, deps] of Object.entries(newDeps)) {
      if (deps && deps.imports) {
        deps.imports.forEach(imp => {
          const key = `${file}::${imp.source || imp.module}`;
          newDepMap.set(key, { file, import: imp });
        });
      }
    }

    // Find added and changed dependencies
    for (const [key, newDep] of newDepMap) {
      const oldDep = oldDepMap.get(key);

      if (!oldDep) {
        result.addedDeps.push(newDep);
        result.stats.totalAdded++;
      } else {
        // Check if dependency changed (different imports/exports)
        const changed = this._isDependencyChanged(oldDep.import, newDep.import);
        if (changed) {
          result.changedDeps.push({
            file: newDep.file,
            module: newDep.import.source || newDep.import.module,
            old: oldDep.import,
            new: newDep.import
          });
          result.stats.totalChanged++;
        } else {
          result.stats.unchanged++;
        }
      }
    }

    // Find removed dependencies
    for (const [key, oldDep] of oldDepMap) {
      if (!newDepMap.has(key)) {
        result.removedDeps.push(oldDep);
        result.stats.totalRemoved++;
      }
    }

    return result;
  }

  /**
   * Compare frontend component maps
   * @param {Object} oldComponents - Previous frontend-components map
   * @param {Object} newComponents - Current frontend-components map
   * @returns {Object} Component differences
   */
  static compareComponents(oldComponents, newComponents) {
    const result = {
      addedComponents: [],
      removedComponents: [],
      modifiedComponents: [],
      stats: {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
        unchanged: 0
      }
    };

    // Handle missing maps
    if (!oldComponents || !oldComponents.components) {
      const newComps = newComponents?.components || {};
      return {
        ...result,
        addedComponents: Object.values(newComps),
        stats: {
          ...result.stats,
          totalAdded: Object.keys(newComps).length
        }
      };
    }

    if (!newComponents || !newComponents.components) {
      const oldComps = oldComponents?.components || {};
      return {
        ...result,
        removedComponents: Object.values(oldComps),
        stats: {
          ...result.stats,
          totalRemoved: Object.keys(oldComps).length
        }
      };
    }

    const oldComps = oldComponents.components || {};
    const newComps = newComponents.components || {};

    // Find added and modified components
    for (const [path, newComp] of Object.entries(newComps)) {
      const oldComp = oldComps[path];

      if (!oldComp) {
        result.addedComponents.push(newComp);
        result.stats.totalAdded++;
      } else {
        // Check if component was modified
        const isModified = this._isComponentModified(oldComp, newComp);
        if (isModified) {
          result.modifiedComponents.push({
            path: newComp.path,
            name: newComp.name,
            changes: this._getComponentChanges(oldComp, newComp),
            old: oldComp,
            new: newComp
          });
          result.stats.totalModified++;
        } else {
          result.stats.unchanged++;
        }
      }
    }

    // Find removed components
    for (const [path, oldComp] of Object.entries(oldComps)) {
      if (!newComps[path]) {
        result.removedComponents.push(oldComp);
        result.stats.totalRemoved++;
      }
    }

    return result;
  }

  /**
   * Compare module maps
   * @param {Object} oldModules - Previous modules map
   * @param {Object} newModules - Current modules map
   * @returns {Object} Module differences
   */
  static compareModules(oldModules, newModules) {
    const result = {
      addedModules: [],
      removedModules: [],
      modifiedModules: [],
      stats: {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
        unchanged: 0
      }
    };

    // Handle missing maps
    if (!oldModules || !oldModules.modules) {
      const newMods = newModules?.modules || {};
      return {
        ...result,
        addedModules: Object.values(newMods),
        stats: {
          ...result.stats,
          totalAdded: Object.keys(newMods).length
        }
      };
    }

    if (!newModules || !newModules.modules) {
      const oldMods = oldModules?.modules || {};
      return {
        ...result,
        removedModules: Object.values(oldMods),
        stats: {
          ...result.stats,
          totalRemoved: Object.keys(oldMods).length
        }
      };
    }

    const oldMods = oldModules.modules || {};
    const newMods = newModules.modules || {};

    // Find added and modified modules
    for (const [name, newMod] of Object.entries(newMods)) {
      const oldMod = oldMods[name];

      if (!oldMod) {
        result.addedModules.push(newMod);
        result.stats.totalAdded++;
      } else {
        // Check if module was modified
        const isModified = this._isModuleModified(oldMod, newMod);
        if (isModified) {
          result.modifiedModules.push({
            name: newMod.name,
            changes: this._getModuleChanges(oldMod, newMod),
            old: oldMod,
            new: newMod
          });
          result.stats.totalModified++;
        } else {
          result.stats.unchanged++;
        }
      }
    }

    // Find removed modules
    for (const [name, oldMod] of Object.entries(oldMods)) {
      if (!newMods[name]) {
        result.removedModules.push(oldMod);
        result.stats.totalRemoved++;
      }
    }

    return result;
  }

  /**
   * Generate comprehensive diff report across all map types
   * @param {Object} oldMaps - Previous map snapshots
   * @param {Object} newMaps - Current map snapshots
   * @returns {Object} Full diff report with all changes
   */
  static generateFullDiff(oldMaps, newMaps) {
    const diff = {
      timestamp: new Date().toISOString(),
      summary: {
        hasChanges: false,
        totalChanges: 0,
        changesByType: {}
      },
      metadata: null,
      dependencies: null,
      components: null,
      modules: null
    };

    // Compare metadata if available
    if (oldMaps.metadata || newMaps.metadata) {
      diff.metadata = this.compareMetadata(oldMaps.metadata, newMaps.metadata);
      diff.summary.changesByType.metadata =
        diff.metadata.stats.totalAdded +
        diff.metadata.stats.totalRemoved +
        diff.metadata.stats.totalModified;
    }

    // Compare dependencies if available
    if (oldMaps['dependencies-forward'] || newMaps['dependencies-forward']) {
      diff.dependencies = this.compareDependencies(
        oldMaps['dependencies-forward'],
        newMaps['dependencies-forward']
      );
      diff.summary.changesByType.dependencies =
        diff.dependencies.stats.totalAdded +
        diff.dependencies.stats.totalRemoved +
        diff.dependencies.stats.totalChanged;
    }

    // Compare components if available
    if (oldMaps['frontend-components'] || newMaps['frontend-components']) {
      diff.components = this.compareComponents(
        oldMaps['frontend-components'],
        newMaps['frontend-components']
      );
      diff.summary.changesByType.components =
        diff.components.stats.totalAdded +
        diff.components.stats.totalRemoved +
        diff.components.stats.totalModified;
    }

    // Compare modules if available
    if (oldMaps.modules || newMaps.modules) {
      diff.modules = this.compareModules(oldMaps.modules, newMaps.modules);
      diff.summary.changesByType.modules =
        diff.modules.stats.totalAdded +
        diff.modules.stats.totalRemoved +
        diff.modules.stats.totalModified;
    }

    // Calculate total changes
    diff.summary.totalChanges = Object.values(diff.summary.changesByType)
      .reduce((sum, count) => sum + count, 0);
    diff.summary.hasChanges = diff.summary.totalChanges > 0;

    return diff;
  }

  // ===== Private Helper Methods =====

  /**
   * Check if a file was modified
   */
  static _isFileModified(oldFile, newFile) {
    // Compare key properties
    if (oldFile.size !== newFile.size) return true;
    if (oldFile.lines !== newFile.lines) return true;
    if (oldFile.modified !== newFile.modified) return true;
    if (oldFile.gitStatus !== newFile.gitStatus) return true;

    return false;
  }

  /**
   * Get detailed file changes
   */
  static _getFileChanges(oldFile, newFile) {
    const changes = [];

    if (oldFile.size !== newFile.size) {
      changes.push({
        property: 'size',
        old: oldFile.size,
        new: newFile.size,
        delta: newFile.size - oldFile.size
      });
    }

    if (oldFile.lines !== newFile.lines) {
      changes.push({
        property: 'lines',
        old: oldFile.lines,
        new: newFile.lines,
        delta: newFile.lines - oldFile.lines
      });
    }

    if (oldFile.modified !== newFile.modified) {
      changes.push({
        property: 'modified',
        old: oldFile.modified,
        new: newFile.modified
      });
    }

    if (oldFile.gitStatus !== newFile.gitStatus) {
      changes.push({
        property: 'gitStatus',
        old: oldFile.gitStatus,
        new: newFile.gitStatus
      });
    }

    return changes;
  }

  /**
   * Extract all dependencies from a map
   */
  static _extractAllDependencies(depMap) {
    if (!depMap || !depMap.dependencies) return [];

    const allDeps = [];
    for (const [file, deps] of Object.entries(depMap.dependencies)) {
      if (deps && deps.imports) {
        deps.imports.forEach(imp => {
          allDeps.push({ file, import: imp });
        });
      }
    }
    return allDeps;
  }

  /**
   * Check if a dependency changed
   */
  static _isDependencyChanged(oldDep, newDep) {
    // Compare import names/specifiers
    const oldNames = (oldDep.names || []).sort().join(',');
    const newNames = (newDep.names || []).sort().join(',');
    if (oldNames !== newNames) return true;

    // Compare default import
    if (oldDep.default !== newDep.default) return true;

    // Compare namespace import
    if (oldDep.namespace !== newDep.namespace) return true;

    return false;
  }

  /**
   * Check if a component was modified
   */
  static _isComponentModified(oldComp, newComp) {
    if (oldComp.size !== newComp.size) return true;
    if (oldComp.layer !== newComp.layer) return true;
    if (oldComp.reusable !== newComp.reusable) return true;

    // Compare uses/usedBy arrays
    const oldUses = (oldComp.uses || []).sort().join(',');
    const newUses = (newComp.uses || []).sort().join(',');
    if (oldUses !== newUses) return true;

    const oldUsedBy = (oldComp.usedBy || []).sort().join(',');
    const newUsedBy = (newComp.usedBy || []).sort().join(',');
    if (oldUsedBy !== newUsedBy) return true;

    return false;
  }

  /**
   * Get detailed component changes
   */
  static _getComponentChanges(oldComp, newComp) {
    const changes = [];

    if (oldComp.size !== newComp.size) {
      changes.push({
        property: 'size',
        old: oldComp.size,
        new: newComp.size,
        delta: newComp.size - oldComp.size
      });
    }

    if (oldComp.layer !== newComp.layer) {
      changes.push({
        property: 'layer',
        old: oldComp.layer,
        new: newComp.layer
      });
    }

    if (oldComp.reusable !== newComp.reusable) {
      changes.push({
        property: 'reusable',
        old: oldComp.reusable,
        new: newComp.reusable
      });
    }

    const oldUses = oldComp.uses || [];
    const newUses = newComp.uses || [];
    if (JSON.stringify(oldUses.sort()) !== JSON.stringify(newUses.sort())) {
      changes.push({
        property: 'uses',
        old: oldUses,
        new: newUses
      });
    }

    const oldUsedBy = oldComp.usedBy || [];
    const newUsedBy = newComp.usedBy || [];
    if (JSON.stringify(oldUsedBy.sort()) !== JSON.stringify(newUsedBy.sort())) {
      changes.push({
        property: 'usedBy',
        old: oldUsedBy,
        new: newUsedBy
      });
    }

    return changes;
  }

  /**
   * Check if a module was modified
   */
  static _isModuleModified(oldMod, newMod) {
    // Compare stats
    if (oldMod.stats?.fileCount !== newMod.stats?.fileCount) return true;
    if (oldMod.stats?.totalSize !== newMod.stats?.totalSize) return true;
    if (oldMod.stats?.totalLines !== newMod.stats?.totalLines) return true;

    // Compare file lists (deep comparison)
    const oldFiles = JSON.stringify(this._normalizeModuleFiles(oldMod.files));
    const newFiles = JSON.stringify(this._normalizeModuleFiles(newMod.files));
    if (oldFiles !== newFiles) return true;

    return false;
  }

  /**
   * Get detailed module changes
   */
  static _getModuleChanges(oldMod, newMod) {
    const changes = [];

    if (oldMod.stats?.fileCount !== newMod.stats?.fileCount) {
      changes.push({
        property: 'fileCount',
        old: oldMod.stats?.fileCount,
        new: newMod.stats?.fileCount,
        delta: (newMod.stats?.fileCount || 0) - (oldMod.stats?.fileCount || 0)
      });
    }

    if (oldMod.stats?.totalSize !== newMod.stats?.totalSize) {
      changes.push({
        property: 'totalSize',
        old: oldMod.stats?.totalSize,
        new: newMod.stats?.totalSize,
        delta: (newMod.stats?.totalSize || 0) - (oldMod.stats?.totalSize || 0)
      });
    }

    if (oldMod.stats?.totalLines !== newMod.stats?.totalLines) {
      changes.push({
        property: 'totalLines',
        old: oldMod.stats?.totalLines,
        new: newMod.stats?.totalLines,
        delta: (newMod.stats?.totalLines || 0) - (oldMod.stats?.totalLines || 0)
      });
    }

    // Compare file lists
    const oldFiles = this._normalizeModuleFiles(oldMod.files);
    const newFiles = this._normalizeModuleFiles(newMod.files);
    const oldFilesStr = JSON.stringify(oldFiles);
    const newFilesStr = JSON.stringify(newFiles);

    if (oldFilesStr !== newFilesStr) {
      changes.push({
        property: 'files',
        old: oldFiles,
        new: newFiles
      });
    }

    return changes;
  }

  /**
   * Normalize module files for comparison
   */
  static _normalizeModuleFiles(files) {
    if (!files) return {};

    const normalized = {};
    for (const [category, fileList] of Object.entries(files)) {
      if (Array.isArray(fileList)) {
        normalized[category] = fileList.sort();
      }
    }
    return normalized;
  }
}

module.exports = MapDiffer;

// CLI usage
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const compression = require('./compression');

  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node map-differ.js <old-map-dir> <new-map-dir> <map-type>');
    console.log('');
    console.log('Map types:');
    console.log('  metadata              - Compare metadata.json');
    console.log('  dependencies          - Compare dependencies-forward.json');
    console.log('  components            - Compare frontend-components.json');
    console.log('  modules               - Compare modules.json');
    console.log('  full                  - Compare all available maps');
    console.log('');
    console.log('Examples:');
    console.log('  node map-differ.js ~/.claude/project-maps/old ~/.claude/project-maps/new metadata');
    console.log('  node map-differ.js ./old-maps ./new-maps full');
    process.exit(1);
  }

  const oldMapDir = path.resolve(args[0]);
  const newMapDir = path.resolve(args[1]);
  const mapType = args[2];

  async function loadMap(dir, filename) {
    try {
      const filePath = path.join(dir, filename);
      const decompressed = await compression.loadAndDecompress(filePath);
      return typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
    } catch (error) {
      return null;
    }
  }

  (async () => {
    try {
      let result;

      switch (mapType) {
        case 'metadata': {
          const oldMap = await loadMap(oldMapDir, 'metadata.json');
          const newMap = await loadMap(newMapDir, 'metadata.json');
          result = MapDiffer.compareMetadata(oldMap, newMap);
          break;
        }

        case 'dependencies': {
          const oldMap = await loadMap(oldMapDir, 'dependencies-forward.json');
          const newMap = await loadMap(newMapDir, 'dependencies-forward.json');
          result = MapDiffer.compareDependencies(oldMap, newMap);
          break;
        }

        case 'components': {
          const oldMap = await loadMap(oldMapDir, 'frontend-components.json');
          const newMap = await loadMap(newMapDir, 'frontend-components.json');
          result = MapDiffer.compareComponents(oldMap, newMap);
          break;
        }

        case 'modules': {
          const oldMap = await loadMap(oldMapDir, 'modules.json');
          const newMap = await loadMap(newMapDir, 'modules.json');
          result = MapDiffer.compareModules(oldMap, newMap);
          break;
        }

        case 'full': {
          const oldMaps = {
            metadata: await loadMap(oldMapDir, 'metadata.json'),
            'dependencies-forward': await loadMap(oldMapDir, 'dependencies-forward.json'),
            'frontend-components': await loadMap(oldMapDir, 'frontend-components.json'),
            modules: await loadMap(oldMapDir, 'modules.json')
          };

          const newMaps = {
            metadata: await loadMap(newMapDir, 'metadata.json'),
            'dependencies-forward': await loadMap(newMapDir, 'dependencies-forward.json'),
            'frontend-components': await loadMap(newMapDir, 'frontend-components.json'),
            modules: await loadMap(newMapDir, 'modules.json')
          };

          result = MapDiffer.generateFullDiff(oldMaps, newMaps);
          break;
        }

        default:
          console.error(`Unknown map type: ${mapType}`);
          process.exit(1);
      }

      console.log(JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
