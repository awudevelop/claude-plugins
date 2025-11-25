const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * Configuration system for project context map scanning
 * Reads .projectmaprc or uses defaults
 * Respects .gitignore patterns
 * Supports custom exclusions and inclusions
 */

class ConfigManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.gitignorePatterns = [];
  }

  /**
   * Default configuration
   */
  getDefaults() {
    return {
      version: '1.0',

      // Scan scope
      scanDepth: 100,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      followSymlinks: false,

      // Include patterns (glob)
      include: [
        '**/*.js',
        '**/*.ts',
        '**/*.jsx',
        '**/*.tsx',
        '**/*.json',
        '**/*.md',
        '**/*.py',
        '**/*.java',
        '**/*.go',
        '**/*.rs',
        '**/*.c',
        '**/*.cpp',
        '**/*.h',
        '**/*.hpp',
        '**/*.css',
        '**/*.scss',
        '**/*.html',
        '**/*.vue',
        '**/*.rb',
        '**/*.php',
        '**/*.swift',
        '**/*.kt'
      ],

      // Exclude directories (always excluded)
      excludeDirectories: [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        '.next',
        '.nuxt',
        'out',
        'target',
        'bin',
        'obj',
        '__pycache__',
        '.pytest_cache',
        '.venv',
        'venv',
        'vendor',
        '.idea',
        '.vscode',
        '.DS_Store',
        'tmp',
        'temp',
        '.cache'
      ],

      // Exclude patterns (glob)
      exclude: [
        '**/*.min.js',
        '**/*.bundle.js',
        '**/*.map',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
        '**/*.log',
        '**/.env*',
        '**/.*cache*'
      ],

      // Respect .gitignore
      respectGitignore: true,

      // File categorization
      fileRoles: {
        source: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'rb', 'php', 'swift', 'kt'],
        test: ['test.js', 'test.ts', 'spec.js', 'spec.ts', '_test.go', '_test.py'],
        config: ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config.js', 'config.ts'],
        documentation: ['md', 'txt', 'rst', 'adoc'],
        build: ['Makefile', 'Dockerfile', 'docker-compose.yml', 'package.json', 'tsconfig.json'],
        style: ['css', 'scss', 'sass', 'less', 'styl']
      },

      // Map generation settings
      maps: {
        generateTechnical: true,
        generateBusiness: true,
        generateSummary: true,
        compression: {
          enabled: true,
          level: 'auto' // auto, minify, abbreviate, deduplicate
        }
      }
    };
  }

  /**
   * Load configuration from .projectmaprc
   */
  async loadConfig() {
    if (this.config) return this.config;

    const configPath = path.join(this.projectRoot, '.projectmaprc');
    let userConfig = {};

    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      userConfig = JSON.parse(configContent);
    } catch (error) {
      // No config file or invalid JSON - use defaults
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Could not parse .projectmaprc: ${error.message}`);
      }
    }

    // Merge with defaults
    this.config = this.mergeConfigs(this.getDefaults(), userConfig);

    // Load gitignore patterns if enabled
    if (this.config.respectGitignore) {
      await this.loadGitignore();
    }

    return this.config;
  }

  /**
   * Merge user config with defaults (deep merge)
   */
  mergeConfigs(defaults, user) {
    const merged = { ...defaults };

    for (const [key, value] of Object.entries(user)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this.mergeConfigs(defaults[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Load .gitignore patterns
   */
  async loadGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');

    try {
      const content = await fs.readFile(gitignorePath, 'utf8');
      this.gitignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => this.convertGitignoreToGlob(pattern));
    } catch (error) {
      // No .gitignore file - that's okay
      this.gitignorePatterns = [];
    }
  }

  /**
   * Convert gitignore pattern to glob pattern
   */
  convertGitignoreToGlob(pattern) {
    // Basic conversion - can be enhanced
    if (pattern.endsWith('/')) {
      return pattern + '**';
    }
    if (!pattern.includes('/')) {
      return '**/' + pattern;
    }
    return pattern;
  }

  /**
   * Check if a file should be excluded
   */
  shouldExclude(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    const config = this.config || this.getDefaults();

    // Check excluded directories
    const pathParts = relativePath.split(path.sep);
    for (const dir of config.excludeDirectories) {
      if (pathParts.includes(dir)) {
        return true;
      }
    }

    // Check exclude patterns
    for (const pattern of config.exclude) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }

    // Check gitignore patterns
    if (config.respectGitignore) {
      for (const pattern of this.gitignorePatterns) {
        if (this.matchGlob(relativePath, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a file should be included
   */
  shouldInclude(filePath) {
    if (this.shouldExclude(filePath)) {
      return false;
    }

    const relativePath = path.relative(this.projectRoot, filePath);
    const config = this.config || this.getDefaults();

    // Check include patterns
    for (const pattern of config.include) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob matching (basic implementation)
   *
   * Converts glob patterns to regex:
   * - Double-star-slash matches zero or more directories (including root-level files)
   * - Double-star matches any path (including nested directories)
   * - Single star matches any filename component (no slashes)
   * - Question mark matches any single character
   * - Dots are escaped
   */
  matchGlob(filePath, pattern) {
    // Use placeholders to protect special patterns from being affected by later replacements
    const DOUBLE_STAR_SLASH = '\x00DOUBLESTARSLASH\x00';
    const DOUBLE_STAR = '\x00DOUBLESTAR\x00';
    const QUESTION_MARK = '\x00QUESTIONMARK\x00';

    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')                                           // Escape dots first
      .replace(/\?/g, QUESTION_MARK)                                   // Protect ? early (glob single-char match)
      .replace(/\*\*\//g, DOUBLE_STAR_SLASH)                           // Protect **/ (zero or more dirs)
      .replace(/\*\*/g, DOUBLE_STAR)                                   // Protect standalone **
      .replace(/\*/g, '[^/]*')                                         // Single * matches non-slash chars
      .replace(new RegExp(DOUBLE_STAR_SLASH, 'g'), '(.*/)?')           // **/ = optional path prefix
      .replace(new RegExp(DOUBLE_STAR, 'g'), '.*')                     // ** = any characters
      .replace(new RegExp(QUESTION_MARK, 'g'), '.');                   // ? matches any single char

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Determine file role based on extension and name
   */
  getFileRole(filePath) {
    const config = this.config || this.getDefaults();
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).slice(1);

    // Check test patterns first
    for (const testPattern of config.fileRoles.test) {
      if (fileName.includes(testPattern) || fileName.endsWith(testPattern)) {
        return 'test';
      }
    }

    // Check by extension
    for (const [role, extensions] of Object.entries(config.fileRoles)) {
      if (role === 'test') continue; // Already checked

      if (Array.isArray(extensions)) {
        for (const pattern of extensions) {
          if (ext === pattern || fileName === pattern || fileName.endsWith(pattern)) {
            return role;
          }
        }
      }
    }

    return 'unknown';
  }

  /**
   * Get compression level for a given file size
   */
  getCompressionLevel(fileSize) {
    const config = this.config || this.getDefaults();

    if (!config.maps.compression.enabled) {
      return 0; // No compression
    }

    const level = config.maps.compression.level;

    if (level === 'auto') {
      if (fileSize > 20 * 1024) return 3; // > 20KB: full compression
      if (fileSize > 5 * 1024) return 2;  // > 5KB: key abbreviation
      return 1; // Default: minification only
    }

    const levels = {
      'none': 0,
      'minify': 1,
      'abbreviate': 2,
      'deduplicate': 3
    };

    return levels[level] || 1;
  }

  /**
   * Get project root directory
   */
  getProjectRoot() {
    return this.projectRoot;
  }

  /**
   * Check if project is a git repository
   */
  isGitRepository() {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.projectRoot,
        stdio: 'ignore'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current git commit hash
   */
  getGitCommitHash() {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Get current git commit info
   */
  getGitCommitInfo() {
    try {
      const hash = execSync('git rev-parse --short HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      const message = execSync('git log -1 --pretty=%s', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      const author = execSync('git log -1 --pretty=%an', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      const timestamp = execSync('git log -1 --pretty=%cI', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      return { hash, message, author, timestamp };
    } catch {
      return null;
    }
  }

  /**
   * Save current configuration to .projectmaprc
   */
  async saveConfig(config) {
    const configPath = path.join(this.projectRoot, '.projectmaprc');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    this.config = config;
  }

  /**
   * Get configuration for a specific project
   */
  static async getConfig(projectRoot) {
    const manager = new ConfigManager(projectRoot);
    return await manager.loadConfig();
  }
}

module.exports = ConfigManager;
