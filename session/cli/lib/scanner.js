const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const ConfigManager = require('./config');

/**
 * File system scanner for project context maps
 * Traverses directory tree and extracts file metadata
 * Respects configuration exclusions and .gitignore
 * Categorizes files by role (source, test, config, doc, build)
 */

class FileScanner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.configManager = new ConfigManager(projectRoot);
    this.scannedFiles = [];
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
      filesByType: {},
      filesByRole: {},
      scanTime: 0
    };
  }

  /**
   * Initialize scanner (load config)
   */
  async initialize() {
    await this.configManager.loadConfig();
  }

  /**
   * Scan entire project
   */
  async scan() {
    const startTime = Date.now();

    await this.initialize();

    this.scannedFiles = [];
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
      filesByType: {},
      filesByRole: {},
      scanTime: 0
    };

    await this.scanDirectory(this.projectRoot);

    this.stats.scanTime = Date.now() - startTime;

    return {
      files: this.scannedFiles,
      stats: this.stats,
      projectRoot: this.projectRoot
    };
  }

  /**
   * Recursively scan directory
   */
  async scanDirectory(dirPath, depth = 0) {
    const config = this.configManager.config;

    // Check depth limit
    if (depth > config.scanDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

      // Check exclusions
      if (this.configManager.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Follow symlinks if configured
        if (entry.isSymbolicLink() && !config.followSymlinks) {
          continue;
        }

        await this.scanDirectory(fullPath, depth + 1);
      } else if (entry.isFile()) {
        // Check if file should be included
        if (this.configManager.shouldInclude(fullPath)) {
          await this.scanFile(fullPath, relativePath);
        }
      }
    }
  }

  /**
   * Scan individual file and extract metadata
   */
  async scanFile(fullPath, relativePath) {
    try {
      const stats = await fs.stat(fullPath);
      const config = this.configManager.config;

      // Skip files that exceed max size
      if (stats.size > config.maxFileSize) {
        return;
      }

      const ext = path.extname(fullPath).slice(1);
      const role = this.configManager.getFileRole(fullPath);

      // Get git status for this file
      const gitStatus = this.getGitStatus(fullPath);

      // Count lines (for text files)
      let lines = 0;
      if (this.isTextFile(ext)) {
        lines = await this.countLines(fullPath);
      }

      // Build file metadata
      const fileMetadata = {
        path: fullPath,
        relativePath,
        name: path.basename(fullPath),
        extension: ext,
        type: this.getFileType(ext),
        role,
        size: stats.size,
        lines,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        gitStatus
      };

      this.scannedFiles.push(fileMetadata);

      // Update statistics
      this.stats.totalFiles++;
      this.stats.totalSize += stats.size;
      this.stats.totalLines += lines;

      // Count by type
      this.stats.filesByType[ext] = (this.stats.filesByType[ext] || 0) + 1;

      // Count by role
      this.stats.filesByRole[role] = (this.stats.filesByRole[role] || 0) + 1;

    } catch (error) {
      // Skip files we can't read
      return;
    }
  }

  /**
   * Determine file type from extension
   */
  getFileType(ext) {
    const typeMap = {
      // JavaScript/TypeScript
      js: 'javascript',
      jsx: 'javascript-react',
      ts: 'typescript',
      tsx: 'typescript-react',
      mjs: 'javascript-module',
      cjs: 'javascript-commonjs',

      // Python
      py: 'python',
      pyi: 'python-interface',

      // Java/JVM
      java: 'java',
      kt: 'kotlin',
      scala: 'scala',
      groovy: 'groovy',

      // C/C++
      c: 'c',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      h: 'c-header',
      hpp: 'cpp-header',
      hh: 'cpp-header',

      // Web
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',

      // Other languages
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      vue: 'vue',

      // Config/Data
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      xml: 'xml',
      ini: 'ini',

      // Documentation
      md: 'markdown',
      txt: 'text',
      rst: 'restructuredtext',
      adoc: 'asciidoc'
    };

    return typeMap[ext] || ext;
  }

  /**
   * Check if file is a text file (can count lines)
   */
  isTextFile(ext) {
    const textExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'py', 'pyi',
      'java', 'kt', 'scala', 'groovy',
      'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh',
      'html', 'css', 'scss', 'sass', 'less',
      'go', 'rs', 'rb', 'php', 'swift', 'vue',
      'json', 'yaml', 'yml', 'toml', 'xml', 'ini',
      'md', 'txt', 'rst', 'adoc',
      'sh', 'bash', 'zsh',
      'sql',
      'graphql', 'gql'
    ];

    return textExtensions.includes(ext);
  }

  /**
   * Count lines in a text file
   */
  async countLines(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Get git status for a file
   */
  getGitStatus(filePath) {
    if (!this.configManager.isGitRepository()) {
      return 'not-in-repo';
    }

    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      const output = execSync(`git status --porcelain "${relativePath}"`, {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      if (!output) {
        return 'tracked';
      }

      const status = output.substring(0, 2);

      const statusMap = {
        'M ': 'modified-staged',
        ' M': 'modified-unstaged',
        'MM': 'modified-both',
        'A ': 'added',
        'D ': 'deleted',
        'R ': 'renamed',
        'C ': 'copied',
        '??': 'untracked',
        '!!': 'ignored'
      };

      return statusMap[status] || 'unknown';

    } catch {
      return 'unknown';
    }
  }

  /**
   * Get file by path
   */
  getFile(filePath) {
    return this.scannedFiles.find(f =>
      f.path === filePath || f.relativePath === filePath
    );
  }

  /**
   * Get files by role
   */
  getFilesByRole(role) {
    return this.scannedFiles.filter(f => f.role === role);
  }

  /**
   * Get files by type
   */
  getFilesByType(type) {
    return this.scannedFiles.filter(f => f.type === type);
  }

  /**
   * Get files by extension
   */
  getFilesByExtension(ext) {
    return this.scannedFiles.filter(f => f.extension === ext);
  }

  /**
   * Get directory tree structure
   */
  getDirectoryTree() {
    const tree = {};

    for (const file of this.scannedFiles) {
      const parts = file.relativePath.split(path.sep);
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          if (!current._files) {
            current._files = [];
          }
          current._files.push(file);
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }

    return tree;
  }

  /**
   * Get statistics summary
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Export scan results to JSON
   */
  async exportToJson(outputPath) {
    const data = {
      projectRoot: this.projectRoot,
      scannedAt: new Date().toISOString(),
      files: this.scannedFiles,
      stats: this.stats,
      config: this.configManager.config
    };

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Quick scan (lightweight - no line counting, no git status)
   */
  async quickScan() {
    const startTime = Date.now();

    await this.initialize();

    this.scannedFiles = [];
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      filesByType: {},
      filesByRole: {},
      scanTime: 0
    };

    await this.quickScanDirectory(this.projectRoot);

    this.stats.scanTime = Date.now() - startTime;

    return {
      files: this.scannedFiles,
      stats: this.stats,
      projectRoot: this.projectRoot
    };
  }

  /**
   * Quick scan directory (no line counting or git status)
   */
  async quickScanDirectory(dirPath, depth = 0) {
    const config = this.configManager.config;

    if (depth > config.scanDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (this.configManager.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.isSymbolicLink() && !config.followSymlinks) {
          continue;
        }
        await this.quickScanDirectory(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (this.configManager.shouldInclude(fullPath)) {
          await this.quickScanFile(fullPath);
        }
      }
    }
  }

  /**
   * Quick scan file (lightweight metadata only)
   */
  async quickScanFile(fullPath) {
    try {
      const stats = await fs.stat(fullPath);
      const config = this.configManager.config;

      if (stats.size > config.maxFileSize) {
        return;
      }

      const relativePath = path.relative(this.projectRoot, fullPath);
      const ext = path.extname(fullPath).slice(1);
      const role = this.configManager.getFileRole(fullPath);

      const fileMetadata = {
        path: fullPath,
        relativePath,
        name: path.basename(fullPath),
        extension: ext,
        type: this.getFileType(ext),
        role,
        size: stats.size,
        modified: stats.mtime.toISOString()
      };

      this.scannedFiles.push(fileMetadata);

      this.stats.totalFiles++;
      this.stats.totalSize += stats.size;
      this.stats.filesByType[ext] = (this.stats.filesByType[ext] || 0) + 1;
      this.stats.filesByRole[role] = (this.stats.filesByRole[role] || 0) + 1;

    } catch {
      return;
    }
  }

  /**
   * Scan a single file and return its metadata
   * Used by incremental updater to rescan changed files
   * @param {string} fullPath - Absolute path to the file
   * @returns {Object} File metadata
   */
  async scanSingleFile(fullPath) {
    await this.initialize();

    const stats = await fs.stat(fullPath);
    const config = this.configManager.config;

    // Skip files that exceed max size
    if (stats.size > config.maxFileSize) {
      throw new Error('File too large');
    }

    const relativePath = path.relative(this.projectRoot, fullPath);
    const ext = path.extname(fullPath).slice(1);
    const role = this.configManager.getFileRole(fullPath);
    const gitStatus = this.getGitStatus(fullPath);

    // Count lines (for text files)
    let lines = 0;
    if (this.isTextFile(ext)) {
      lines = await this.countLines(fullPath);
    }

    // Build file metadata
    const fileMetadata = {
      path: relativePath, // Use relative path for consistency with maps
      relativePath,
      name: path.basename(fullPath),
      extension: ext,
      type: this.getFileType(ext),
      language: this.getLanguage(ext),
      role,
      size: stats.size,
      lines,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      gitStatus
    };

    return fileMetadata;
  }
}

module.exports = FileScanner;
