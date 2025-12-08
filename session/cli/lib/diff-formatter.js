/**
 * Diff Formatter
 * Formats diff reports from MapDiffer into human-readable output
 * Supports both summary and verbose modes with anomaly detection
 */

const path = require('path');

/**
 * Default thresholds for anomaly detection
 */
const DEFAULT_ANOMALY_THRESHOLDS = {
  massRemovalCount: 20,        // Warn if more than 20 files removed
  massChangePercent: 30,       // Warn if more than 30% of files changed
  totalChangePercent: 50,      // Warn if more than 50% total changes
  suspiciousPatterns: [
    { pattern: /node_modules/i, message: 'Changes affecting node_modules detected' },
    { pattern: /\.git/i, message: 'Changes affecting .git directory detected' },
    { pattern: /package-lock\.json/i, message: 'Package lock file changed' }
  ]
};

/**
 * Main formatter class for diff reports
 */
class DiffFormatter {
  constructor(config = {}) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.anomalyThresholds = { ...DEFAULT_ANOMALY_THRESHOLDS, ...config.anomalyThresholds };
  }

  /**
   * Format diff report as one-line summary
   * @param {Object} diffReport - Full diff report from MapDiffer.generateFullDiff()
   * @returns {string} One-line summary like "Changes: +5 files, -2 files, ~3 modified"
   */
  formatSummary(diffReport) {
    if (!diffReport || !diffReport.summary) {
      return 'No changes detected';
    }

    const { summary } = diffReport;

    if (!summary.hasChanges) {
      return 'No changes detected';
    }

    const parts = [];

    // Metadata changes (files)
    if (summary.changesByType.metadata) {
      const meta = diffReport.metadata;
      if (meta) {
        if (meta.stats.totalAdded > 0) {
          parts.push(`+${meta.stats.totalAdded} file${meta.stats.totalAdded !== 1 ? 's' : ''}`);
        }
        if (meta.stats.totalRemoved > 0) {
          parts.push(`-${meta.stats.totalRemoved} file${meta.stats.totalRemoved !== 1 ? 's' : ''}`);
        }
        if (meta.stats.totalModified > 0) {
          parts.push(`~${meta.stats.totalModified} modified`);
        }
      }
    }

    // Dependency changes
    if (summary.changesByType.dependencies) {
      const deps = diffReport.dependencies;
      if (deps) {
        const total = deps.stats.totalAdded + deps.stats.totalRemoved + deps.stats.totalChanged;
        parts.push(`${total} dep change${total !== 1 ? 's' : ''}`);
      }
    }

    // Component changes
    if (summary.changesByType.components) {
      const comps = diffReport.components;
      if (comps) {
        const total = comps.stats.totalAdded + comps.stats.totalRemoved + comps.stats.totalModified;
        parts.push(`${total} component${total !== 1 ? 's' : ''}`);
      }
    }

    // Module changes
    if (summary.changesByType.modules) {
      const mods = diffReport.modules;
      if (mods) {
        const total = mods.stats.totalAdded + mods.stats.totalRemoved + mods.stats.totalModified;
        parts.push(`${total} module${total !== 1 ? 's' : ''}`);
      }
    }

    if (parts.length === 0) {
      return 'Changes detected (details unavailable)';
    }

    return `Changes: ${parts.join(', ')}`;
  }

  /**
   * Format diff report with detailed file-by-file changes
   * @param {Object} diffReport - Full diff report from MapDiffer.generateFullDiff()
   * @returns {string} Detailed multi-line formatted output
   */
  formatVerbose(diffReport) {
    if (!diffReport || !diffReport.summary) {
      return 'No diff report available';
    }

    const output = [];

    // Header
    output.push('# Map Diff Report');
    output.push(`Generated: ${diffReport.timestamp || new Date().toISOString()}`);
    output.push('');

    // Summary section
    output.push('## Summary');
    output.push(this.formatSummary(diffReport));
    output.push('');

    // Stats overview
    const stats = this.formatStats(diffReport);
    output.push(`Total changes: ${stats.totalChanges}`);
    output.push(`Change rate: ${stats.changeRate.toFixed(1)}%`);
    output.push('');

    // Anomaly warnings (if any)
    const anomalies = detectAnomalies(diffReport, this.anomalyThresholds);
    if (anomalies.hasAnomalies) {
      output.push('## Warnings');
      for (const warning of anomalies.warnings) {
        output.push(`⚠️  ${warning}`);
      }
      output.push('');
    }

    // Detailed sections
    if (diffReport.metadata) {
      output.push(this.formatFileChanges(diffReport.metadata));
      output.push('');
    }

    if (diffReport.dependencies) {
      output.push(this.formatDependencyChanges(diffReport.dependencies));
      output.push('');
    }

    if (diffReport.components) {
      output.push(this.formatComponentChanges(diffReport.components));
      output.push('');
    }

    if (diffReport.modules && diffReport.modules.stats.totalModified > 0) {
      output.push(this.formatModuleChanges(diffReport.modules));
      output.push('');
    }

    return output.filter(Boolean).join('\n');
  }

  /**
   * Format file changes (metadata)
   * @param {Object} fileChanges - Metadata diff from MapDiffer.compareMetadata()
   * @returns {string} Formatted file changes
   */
  formatFileChanges(fileChanges) {
    const output = [];
    output.push('## File Changes');

    const { stats, addedFiles, removedFiles, modifiedFiles } = fileChanges;

    // Stats summary
    output.push(`Added: ${stats.totalAdded} | Removed: ${stats.totalRemoved} | Modified: ${stats.totalModified} | Unchanged: ${stats.unchanged}`);
    output.push('');

    // Added files
    if (addedFiles && addedFiles.length > 0) {
      output.push('### Added Files');
      const displayLimit = 20;
      const filesToShow = addedFiles.slice(0, displayLimit);

      for (const file of filesToShow) {
        const filePath = this._shortenPath(file.path);
        const size = file.size ? ` (${this._formatSize(file.size)})` : '';
        output.push(`  + ${filePath}${size}`);
      }

      if (addedFiles.length > displayLimit) {
        output.push(`  ... and ${addedFiles.length - displayLimit} more files`);
      }
      output.push('');
    }

    // Removed files
    if (removedFiles && removedFiles.length > 0) {
      output.push('### Removed Files');
      const displayLimit = 20;
      const filesToShow = removedFiles.slice(0, displayLimit);

      for (const file of filesToShow) {
        const filePath = this._shortenPath(file.path);
        output.push(`  - ${filePath}`);
      }

      if (removedFiles.length > displayLimit) {
        output.push(`  ... and ${removedFiles.length - displayLimit} more files`);
      }
      output.push('');
    }

    // Modified files
    if (modifiedFiles && modifiedFiles.length > 0) {
      output.push('### Modified Files');
      const displayLimit = 15;
      const filesToShow = modifiedFiles.slice(0, displayLimit);

      for (const file of filesToShow) {
        const filePath = this._shortenPath(file.path);
        output.push(`  ~ ${filePath}`);

        // Show changes
        if (file.changes && file.changes.length > 0) {
          for (const change of file.changes) {
            output.push(`    ${this._formatChange(change)}`);
          }
        }
      }

      if (modifiedFiles.length > displayLimit) {
        output.push(`  ... and ${modifiedFiles.length - displayLimit} more files`);
      }
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Format dependency changes
   * @param {Object} depChanges - Dependency diff from MapDiffer.compareDependencies()
   * @returns {string} Formatted dependency changes
   */
  formatDependencyChanges(depChanges) {
    const output = [];
    output.push('## Dependency Changes');

    const { stats, addedDeps, removedDeps, changedDeps } = depChanges;

    // Stats summary
    output.push(`Added: ${stats.totalAdded} | Removed: ${stats.totalRemoved} | Changed: ${stats.totalChanged} | Unchanged: ${stats.unchanged}`);
    output.push('');

    // Added dependencies
    if (addedDeps && addedDeps.length > 0) {
      output.push('### New Dependencies');
      const displayLimit = 15;
      const depsToShow = addedDeps.slice(0, displayLimit);

      for (const dep of depsToShow) {
        const file = this._shortenPath(dep.file);
        const module = dep.import.source || dep.import.module || 'unknown';
        const imports = dep.import.names ? ` { ${dep.import.names.join(', ')} }` : '';
        output.push(`  + ${file} → ${module}${imports}`);
      }

      if (addedDeps.length > displayLimit) {
        output.push(`  ... and ${addedDeps.length - displayLimit} more`);
      }
      output.push('');
    }

    // Removed dependencies
    if (removedDeps && removedDeps.length > 0) {
      output.push('### Removed Dependencies');
      const displayLimit = 15;
      const depsToShow = removedDeps.slice(0, displayLimit);

      for (const dep of depsToShow) {
        const file = this._shortenPath(dep.file);
        const module = dep.import.source || dep.import.module || 'unknown';
        output.push(`  - ${file} → ${module}`);
      }

      if (removedDeps.length > displayLimit) {
        output.push(`  ... and ${removedDeps.length - displayLimit} more`);
      }
      output.push('');
    }

    // Changed dependencies
    if (changedDeps && changedDeps.length > 0) {
      output.push('### Changed Dependencies');
      const displayLimit = 10;
      const depsToShow = changedDeps.slice(0, displayLimit);

      for (const dep of depsToShow) {
        const file = this._shortenPath(dep.file);
        const module = dep.module || 'unknown';
        output.push(`  ~ ${file} → ${module}`);

        // Show what changed
        const oldNames = dep.old.names || [];
        const newNames = dep.new.names || [];
        if (JSON.stringify(oldNames.sort()) !== JSON.stringify(newNames.sort())) {
          output.push(`    imports: [${oldNames.join(', ')}] → [${newNames.join(', ')}]`);
        }
      }

      if (changedDeps.length > displayLimit) {
        output.push(`  ... and ${changedDeps.length - displayLimit} more`);
      }
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Format component changes
   * @param {Object} componentChanges - Component diff from MapDiffer.compareComponents()
   * @returns {string} Formatted component changes
   */
  formatComponentChanges(componentChanges) {
    const output = [];
    output.push('## Component Changes');

    const { stats, addedComponents, removedComponents, modifiedComponents } = componentChanges;

    // Stats summary
    output.push(`Added: ${stats.totalAdded} | Removed: ${stats.totalRemoved} | Modified: ${stats.totalModified} | Unchanged: ${stats.unchanged}`);
    output.push('');

    // Added components
    if (addedComponents && addedComponents.length > 0) {
      output.push('### New Components');
      const displayLimit = 15;
      const compsToShow = addedComponents.slice(0, displayLimit);

      for (const comp of compsToShow) {
        const name = comp.name || path.basename(comp.path, path.extname(comp.path));
        const layer = comp.layer ? ` [${comp.layer}]` : '';
        const reusable = comp.reusable ? ' (reusable)' : '';
        output.push(`  + ${name}${layer}${reusable}`);
        output.push(`    ${this._shortenPath(comp.path)}`);
      }

      if (addedComponents.length > displayLimit) {
        output.push(`  ... and ${addedComponents.length - displayLimit} more`);
      }
      output.push('');
    }

    // Removed components
    if (removedComponents && removedComponents.length > 0) {
      output.push('### Removed Components');
      const displayLimit = 15;
      const compsToShow = removedComponents.slice(0, displayLimit);

      for (const comp of compsToShow) {
        const name = comp.name || path.basename(comp.path, path.extname(comp.path));
        output.push(`  - ${name}`);
      }

      if (removedComponents.length > displayLimit) {
        output.push(`  ... and ${removedComponents.length - displayLimit} more`);
      }
      output.push('');
    }

    // Modified components
    if (modifiedComponents && modifiedComponents.length > 0) {
      output.push('### Modified Components');
      const displayLimit = 10;
      const compsToShow = modifiedComponents.slice(0, displayLimit);

      for (const comp of compsToShow) {
        const name = comp.name || 'unknown';
        output.push(`  ~ ${name}`);

        // Show changes
        if (comp.changes && comp.changes.length > 0) {
          for (const change of comp.changes) {
            output.push(`    ${this._formatChange(change)}`);
          }
        }
      }

      if (modifiedComponents.length > displayLimit) {
        output.push(`  ... and ${modifiedComponents.length - displayLimit} more`);
      }
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Format module changes
   * @param {Object} moduleChanges - Module diff from MapDiffer.compareModules()
   * @returns {string} Formatted module changes
   */
  formatModuleChanges(moduleChanges) {
    const output = [];
    output.push('## Module Changes');

    const { stats, addedModules, removedModules, modifiedModules } = moduleChanges;

    // Stats summary
    output.push(`Added: ${stats.totalAdded} | Removed: ${stats.totalRemoved} | Modified: ${stats.totalModified} | Unchanged: ${stats.unchanged}`);
    output.push('');

    // Added modules
    if (addedModules && addedModules.length > 0) {
      output.push('### New Modules');
      for (const mod of addedModules) {
        const name = mod.name || 'unknown';
        const fileCount = mod.stats?.fileCount || 0;
        output.push(`  + ${name} (${fileCount} files)`);
      }
      output.push('');
    }

    // Removed modules
    if (removedModules && removedModules.length > 0) {
      output.push('### Removed Modules');
      for (const mod of removedModules) {
        const name = mod.name || 'unknown';
        output.push(`  - ${name}`);
      }
      output.push('');
    }

    // Modified modules
    if (modifiedModules && modifiedModules.length > 0) {
      output.push('### Modified Modules');
      for (const mod of modifiedModules) {
        const name = mod.name || 'unknown';
        output.push(`  ~ ${name}`);

        // Show changes
        if (mod.changes && mod.changes.length > 0) {
          for (const change of mod.changes) {
            output.push(`    ${this._formatChange(change)}`);
          }
        }
      }
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Calculate quick stats from diff report
   * @param {Object} diffReport - Full diff report
   * @returns {Object} Calculated statistics
   */
  formatStats(diffReport) {
    const stats = {
      totalChanges: 0,
      totalFiles: 0,
      filesAdded: 0,
      filesRemoved: 0,
      filesModified: 0,
      filesUnchanged: 0,
      changeRate: 0,
      dependencyChanges: 0,
      componentChanges: 0,
      moduleChanges: 0
    };

    // File statistics
    if (diffReport.metadata) {
      const meta = diffReport.metadata;
      stats.filesAdded = meta.stats.totalAdded;
      stats.filesRemoved = meta.stats.totalRemoved;
      stats.filesModified = meta.stats.totalModified;
      stats.filesUnchanged = meta.stats.unchanged;
      stats.totalFiles = stats.filesAdded + stats.filesRemoved + stats.filesModified + stats.filesUnchanged;
    }

    // Dependency statistics
    if (diffReport.dependencies) {
      const deps = diffReport.dependencies;
      stats.dependencyChanges = deps.stats.totalAdded + deps.stats.totalRemoved + deps.stats.totalChanged;
    }

    // Component statistics
    if (diffReport.components) {
      const comps = diffReport.components;
      stats.componentChanges = comps.stats.totalAdded + comps.stats.totalRemoved + comps.stats.totalModified;
    }

    // Module statistics
    if (diffReport.modules) {
      const mods = diffReport.modules;
      stats.moduleChanges = mods.stats.totalAdded + mods.stats.totalRemoved + mods.stats.totalModified;
    }

    // Total changes
    stats.totalChanges = diffReport.summary?.totalChanges || 0;

    // Calculate change rate
    if (stats.totalFiles > 0) {
      const changedFiles = stats.filesAdded + stats.filesRemoved + stats.filesModified;
      stats.changeRate = (changedFiles / stats.totalFiles) * 100;
    }

    return stats;
  }

  // ===== Private Helper Methods =====

  /**
   * Format a single change object
   */
  _formatChange(change) {
    const prop = change.property;
    const old = change.old;
    const newVal = change.new;

    // Handle different types of changes
    if (change.delta !== undefined) {
      const sign = change.delta > 0 ? '+' : '';
      return `${prop}: ${old} → ${newVal} (${sign}${change.delta})`;
    }

    // Arrays
    if (Array.isArray(old) && Array.isArray(newVal)) {
      const added = newVal.filter(v => !old.includes(v));
      const removed = old.filter(v => !newVal.includes(v));

      if (added.length > 0 && removed.length > 0) {
        return `${prop}: +${added.length}, -${removed.length}`;
      } else if (added.length > 0) {
        return `${prop}: +${added.slice(0, 3).join(', ')}${added.length > 3 ? '...' : ''}`;
      } else if (removed.length > 0) {
        return `${prop}: -${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '...' : ''}`;
      }
    }

    // Simple value change
    return `${prop}: ${old} → ${newVal}`;
  }

  /**
   * Shorten file path for display
   */
  _shortenPath(filePath) {
    if (!filePath) return '';

    // Remove project root if present
    let shortened = filePath;
    if (filePath.startsWith(this.projectRoot)) {
      shortened = filePath.slice(this.projectRoot.length + 1);
    }

    // Limit path length
    const maxLength = 80;
    if (shortened.length > maxLength) {
      const parts = shortened.split(path.sep);
      if (parts.length > 3) {
        shortened = `.../${parts.slice(-3).join('/')}`;
      } else if (shortened.length > maxLength) {
        shortened = '...' + shortened.slice(-(maxLength - 3));
      }
    }

    return shortened;
  }

  /**
   * Format file size in human-readable format
   */
  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

/**
 * Detect anomalies in diff report
 * @param {Object} diffReport - Full diff report
 * @param {Object} thresholds - Anomaly detection thresholds
 * @returns {Object} { hasAnomalies: boolean, warnings: string[] }
 */
function detectAnomalies(diffReport, thresholds = DEFAULT_ANOMALY_THRESHOLDS) {
  const warnings = [];

  if (!diffReport || !diffReport.metadata) {
    return { hasAnomalies: false, warnings };
  }

  const meta = diffReport.metadata;
  const stats = meta.stats;

  // Check for mass file removal
  if (stats.totalRemoved >= thresholds.massRemovalCount) {
    warnings.push(
      `Mass file removal detected: ${stats.totalRemoved} files removed (threshold: ${thresholds.massRemovalCount})`
    );
  }

  // Check for high percentage of changed files
  const totalFiles = stats.totalAdded + stats.totalRemoved + stats.totalModified + stats.unchanged;
  if (totalFiles > 0) {
    const changedFiles = stats.totalAdded + stats.totalRemoved + stats.totalModified;
    const changePercent = (changedFiles / totalFiles) * 100;

    if (changePercent >= thresholds.massChangePercent) {
      warnings.push(
        `High change rate detected: ${changePercent.toFixed(1)}% of files changed (threshold: ${thresholds.massChangePercent}%)`
      );
    }
  }

  // Check for suspicious file patterns
  const allChangedFiles = [
    ...(meta.addedFiles || []),
    ...(meta.removedFiles || []),
    ...(meta.modifiedFiles || []).map(f => ({ path: f.path }))
  ];

  for (const pattern of thresholds.suspiciousPatterns) {
    const matchingFiles = allChangedFiles.filter(file => pattern.pattern.test(file.path));
    if (matchingFiles.length > 0) {
      warnings.push(`${pattern.message} (${matchingFiles.length} files)`);
    }
  }

  // Check for large dependency changes
  if (diffReport.dependencies) {
    const depStats = diffReport.dependencies.stats;
    const totalDepChanges = depStats.totalAdded + depStats.totalRemoved + depStats.totalChanged;
    const totalDeps = totalDepChanges + depStats.unchanged;

    if (totalDeps > 0) {
      const depChangePercent = (totalDepChanges / totalDeps) * 100;
      if (depChangePercent >= thresholds.totalChangePercent) {
        warnings.push(
          `Large dependency graph changes: ${depChangePercent.toFixed(1)}% of dependencies changed`
        );
      }
    }
  }

  // Check for complete module removal
  if (diffReport.modules && diffReport.modules.removedModules) {
    const removedCount = diffReport.modules.removedModules.length;
    if (removedCount > 0) {
      warnings.push(`${removedCount} entire module${removedCount !== 1 ? 's' : ''} removed`);
    }
  }

  return {
    hasAnomalies: warnings.length > 0,
    warnings
  };
}

module.exports = {
  DiffFormatter,
  detectAnomalies,
  DEFAULT_ANOMALY_THRESHOLDS
};
