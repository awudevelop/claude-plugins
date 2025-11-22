const path = require('path');
const ConfigManager = require('./config');

/**
 * Module detector for project context maps
 * Identifies business modules based on directory structure, naming patterns,
 * and file co-location. Supports custom module definitions.
 *
 * Detection strategies:
 * 1. Directory grouping (features/, modules/, src/*/index)
 * 2. Naming conventions (auth*, user*, product*, tenant*)
 * 3. File co-location (related files in same directory)
 * 4. Custom definitions from config
 */

class ModuleDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.configManager = new ConfigManager(projectRoot);
    this.modules = new Map();

    // Common module name patterns
    this.modulePatterns = [
      /^auth/i,
      /^user/i,
      /^product/i,
      /^tenant/i,
      /^billing/i,
      /^payment/i,
      /^notification/i,
      /^admin/i,
      /^dashboard/i,
      /^report/i,
      /^analytics/i,
      /^settings/i,
      /^profile/i,
      /^api/i,
      /^common/i,
      /^shared/i,
      /^core/i,
      /^utils/i,
      /^lib/i
    ];

    // Common module directory patterns
    this.moduleDirPatterns = [
      'features',
      'modules',
      'domains',
      'packages',
      'apps',
      'services'
    ];
  }

  /**
   * Initialize detector (load config)
   */
  async initialize() {
    await this.configManager.loadConfig();

    // Load custom module definitions from config
    const config = this.configManager.config;
    if (config.modules && config.modules.custom) {
      this.customModules = config.modules.custom;
    }

    if (config.modules && config.modules.patterns) {
      this.modulePatterns.push(...config.modules.patterns.map(p => new RegExp(p, 'i')));
    }
  }

  /**
   * Detect modules from scanned files
   * @param {Array} scannedFiles - Array of file metadata from scanner
   * @returns {Map} Map of module name to module metadata
   */
  async detectModules(scannedFiles) {
    await this.initialize();

    this.modules.clear();

    // Strategy 1: Directory-based detection
    this.detectByDirectory(scannedFiles);

    // Strategy 2: Naming pattern detection
    this.detectByNaming(scannedFiles);

    // Strategy 3: File co-location detection
    this.detectByCoLocation(scannedFiles);

    // Strategy 4: Custom module definitions
    this.applyCustomModules(scannedFiles);

    // Assign remaining uncategorized files to 'core' or 'common'
    this.categorizeUncategorized(scannedFiles);

    return this.modules;
  }

  /**
   * Detect modules based on directory structure
   * Looks for: features/, modules/, domains/, etc.
   */
  detectByDirectory(scannedFiles) {
    for (const file of scannedFiles) {
      const relativePath = path.relative(this.projectRoot, file.path);
      const parts = relativePath.split(path.sep);

      // Look for module directory patterns
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Check if this is a module container directory
        if (this.moduleDirPatterns.includes(part) && i + 1 < parts.length) {
          const moduleName = parts[i + 1];
          this.addFileToModule(moduleName, file, 'directory');
          break;
        }

        // Check for monorepo structure (packages/*, apps/*)
        if ((part === 'packages' || part === 'apps') && i + 1 < parts.length) {
          const moduleName = parts[i + 1];
          this.addFileToModule(moduleName, file, 'monorepo');
          break;
        }
      }
    }
  }

  /**
   * Detect modules based on file naming patterns
   * Looks for: auth*, user*, product*, etc.
   */
  detectByNaming(scannedFiles) {
    for (const file of scannedFiles) {
      if (file.module) continue; // Already categorized

      const fileName = path.basename(file.path, path.extname(file.path));
      const relativePath = path.relative(this.projectRoot, file.path);

      // Check against module patterns
      for (const pattern of this.modulePatterns) {
        if (pattern.test(fileName) || pattern.test(relativePath)) {
          const match = fileName.match(pattern) || relativePath.match(pattern);
          const moduleName = match[0].toLowerCase();
          this.addFileToModule(moduleName, file, 'naming');
          break;
        }
      }
    }
  }

  /**
   * Detect modules based on file co-location
   * Files in the same directory likely belong to the same module
   */
  detectByCoLocation(scannedFiles) {
    const dirGroups = new Map();

    // Group files by directory
    for (const file of scannedFiles) {
      if (file.module) continue; // Already categorized

      const dir = path.dirname(file.path);
      const relativePath = path.relative(this.projectRoot, dir);

      // Skip root-level files and common directories
      if (!relativePath || relativePath.split(path.sep).length < 2) {
        continue;
      }

      if (!dirGroups.has(dir)) {
        dirGroups.set(dir, []);
      }
      dirGroups.get(dir).push(file);
    }

    // Identify directories with 3+ related files as potential modules
    for (const [dir, files] of dirGroups.entries()) {
      if (files.length >= 3) {
        const relativePath = path.relative(this.projectRoot, dir);
        const parts = relativePath.split(path.sep);
        const moduleName = parts[parts.length - 1];

        // Only create module if name seems meaningful
        if (moduleName.length > 2 && !['src', 'lib', 'utils', 'helpers'].includes(moduleName)) {
          for (const file of files) {
            this.addFileToModule(moduleName, file, 'colocation');
          }
        }
      }
    }
  }

  /**
   * Apply custom module definitions from config
   */
  applyCustomModules(scannedFiles) {
    if (!this.customModules) return;

    for (const [moduleName, definition] of Object.entries(this.customModules)) {
      const patterns = definition.patterns || [];
      const paths = definition.paths || [];

      for (const file of scannedFiles) {
        const relativePath = path.relative(this.projectRoot, file.path);

        // Check path patterns
        for (const pathPattern of paths) {
          if (relativePath.includes(pathPattern)) {
            this.addFileToModule(moduleName, file, 'custom', true);
            break;
          }
        }

        // Check naming patterns
        for (const namePattern of patterns) {
          const regex = new RegExp(namePattern, 'i');
          if (regex.test(relativePath)) {
            this.addFileToModule(moduleName, file, 'custom', true);
            break;
          }
        }
      }
    }
  }

  /**
   * Categorize remaining uncategorized files
   */
  categorizeUncategorized(scannedFiles) {
    const uncategorized = scannedFiles.filter(f => !f.module);

    for (const file of uncategorized) {
      const relativePath = path.relative(this.projectRoot, file.path);

      // Determine if file is shared/common or core
      if (
        relativePath.includes('common') ||
        relativePath.includes('shared') ||
        relativePath.includes('utils') ||
        relativePath.includes('helpers') ||
        relativePath.includes('lib')
      ) {
        this.addFileToModule('common', file, 'default');
      } else {
        this.addFileToModule('core', file, 'default');
      }
    }
  }

  /**
   * Add file to a module
   */
  addFileToModule(moduleName, file, detectionMethod, override = false) {
    // Don't override unless explicitly requested
    if (file.module && !override) return;

    file.module = moduleName;
    file.moduleDetectionMethod = detectionMethod;

    if (!this.modules.has(moduleName)) {
      this.modules.set(moduleName, {
        name: moduleName,
        files: [],
        detectionMethod: detectionMethod,
        fileCount: 0,
        totalSize: 0,
        totalLines: 0,
        filesByRole: {},
        filesByType: {}
      });
    }

    const module = this.modules.get(moduleName);
    module.files.push(file.path);
    module.fileCount++;
    module.totalSize += file.size || 0;
    module.totalLines += file.lines || 0;

    // Track by role
    const role = file.role || 'unknown';
    module.filesByRole[role] = (module.filesByRole[role] || 0) + 1;

    // Track by type
    const type = file.type || 'unknown';
    module.filesByType[type] = (module.filesByType[type] || 0) + 1;
  }

  /**
   * Get module statistics
   */
  getModuleStats() {
    const stats = {
      totalModules: this.modules.size,
      modules: []
    };

    for (const [name, module] of this.modules.entries()) {
      stats.modules.push({
        name: name,
        fileCount: module.fileCount,
        totalSize: module.totalSize,
        totalLines: module.totalLines,
        detectionMethod: module.detectionMethod,
        roles: Object.keys(module.filesByRole),
        types: Object.keys(module.filesByType)
      });
    }

    // Sort by file count (largest first)
    stats.modules.sort((a, b) => b.fileCount - a.fileCount);

    return stats;
  }

  /**
   * Export modules in standardized format
   */
  exportModules() {
    const exported = {};

    for (const [name, module] of this.modules.entries()) {
      exported[name] = {
        name: module.name,
        detectionMethod: module.detectionMethod,
        stats: {
          fileCount: module.fileCount,
          totalSize: module.totalSize,
          totalLines: module.totalLines
        },
        files: module.files,
        filesByRole: module.filesByRole,
        filesByType: module.filesByType
      };
    }

    return exported;
  }
}

module.exports = ModuleDetector;
