const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const FileScanner = require('./scanner');
const ConfigManager = require('./config');
const compression = require('./compression');
const DependencyParser = require('./parser');
const ModuleDetector = require('./module-detector');
const DatabaseDetector = require('./db-detector');
const FrameworkDetector = require('./framework-detector');
const ArchitectureDetector = require('./architecture-detector');

/**
 * Map Generator for project context maps
 * Generates multi-layered JSON maps with tiered loading architecture
 * Level 1: Summary (~2KB) - always loaded
 * Level 2: Tree/Modules (~8KB) - loaded on demand
 * Level 3: Detailed metadata (~40KB) - loaded when needed
 */

class MapGenerator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.projectHash = this.generateProjectHash(projectRoot);
    this.outputDir = path.join(process.env.HOME, '.claude/project-maps', this.projectHash);
    this.scanner = new FileScanner(projectRoot);
    this.configManager = new ConfigManager(projectRoot);
    this.parser = new DependencyParser(projectRoot);
    this.moduleDetector = new ModuleDetector(projectRoot);
    this.dbDetector = new DatabaseDetector(projectRoot);
    this.frameworkDetector = new FrameworkDetector(projectRoot);
    this.architectureDetector = new ArchitectureDetector(projectRoot);
    this.scanResults = null;
    this.dependencyData = null;
    this.dbDetectionResults = null;
    this.architectureData = null;
  }

  /**
   * Generate unique hash for project
   */
  generateProjectHash(projectPath) {
    const normalized = path.resolve(projectPath);
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Initialize and scan project
   */
  async initialize() {
    await this.configManager.loadConfig();
    console.log('Scanning project...');
    this.scanResults = await this.scanner.scan();
    console.log(`Scanned ${this.scanResults.stats.totalFiles} files in ${this.scanResults.stats.scanTime}ms`);

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  /**
   * Generate all maps
   */
  async generateAll() {
    await this.initialize();

    console.log('Generating maps...');

    // Phase 2: Technical Maps
    await this.generateSummaryMap();        // Level 1
    await this.generateTreeMap();           // Level 2
    await this.generateMetadataMap();       // Level 3
    await this.generateContentSummaries();  // Level 3
    await this.generateIndices();           // Level 3
    await this.generateExistenceProofs();   // Level 2
    await this.generateQuickQueries();      // Level 1

    // Phase 3: Relationship Graphs
    await this.generateForwardDependencies();   // Dependencies forward
    await this.generateReverseDependencies();   // Dependencies reverse
    await this.generateRelationships();         // Relationships map
    await this.generateIssuesMap();             // Issues detection

    // Phase 4: Business Modules
    await this.generateModulesMap();            // Business modules map
    await this.generateModuleDependencies();    // Module dependency graph

    // Phase 5: Frontend Architecture Maps
    await this.generateFrontendComponentsMap();    // Frontend components and dependencies
    await this.generateComponentMetadataMap();     // Component metadata (props, state, hooks)

    // Phase 6: Backend Architecture Maps
    await this.generateBackendLayersMap();      // Backend layers categorization
    await this.generateDataFlowMap();           // Data flow through layers
    await this.updateIssuesWithArchitectureViolations(); // Architecture violations

    // Phase 7: Database Schema Maps
    await this.generateDatabaseSchema();        // Database schema and relationships
    await this.generateTableModuleMapping();    // Table-to-module mapping

    console.log('All maps generated successfully!');

    return {
      projectHash: this.projectHash,
      outputDir: this.outputDir,
      files: this.scanResults.files.length,
      stats: this.scanResults.stats
    };
  }

  /**
   * Task 2-1: Generate Level 1 summary map (~2KB)
   * Always loaded - provides project overview
   */
  async generateSummaryMap() {
    const config = this.configManager.config;
    const gitInfo = this.configManager.getGitCommitInfo();
    const stats = this.scanResults.stats;

    // Detect primary languages
    const languageCounts = {};
    for (const file of this.scanResults.files) {
      const lang = this.getLanguageFromType(file.type);
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }

    const primaryLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => ({ language: lang, files: count }));

    // Detect framework
    const framework = this.detectFramework();

    // Find entry points
    const entryPoints = this.findEntryPoints();

    const summary = {
      version: '1.0.0',
      projectPath: this.projectRoot,
      projectName: path.basename(this.projectRoot),
      projectHash: this.projectHash,
      generated: new Date().toISOString(),

      lastCommit: gitInfo,

      statistics: {
        totalFiles: stats.totalFiles,
        totalDirectories: this.countDirectories(),
        totalSize: stats.totalSize,
        totalLines: stats.totalLines,
        primaryLanguages
      },

      framework,
      entryPoints,

      mapType: 'summary',

      staleness: {
        gitHash: gitInfo ? gitInfo.hash : null,
        fileCount: stats.totalFiles,
        lastRefresh: new Date().toISOString(),
        isStale: false
      }
    };

    // Compress and save
    const outputPath = path.join(this.outputDir, 'summary.json');
    const metadata = await compression.compressAndSave(summary, outputPath, { forceAbbreviation: false });

    console.log(`✓ Generated summary.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Count directories in project
   */
  countDirectories() {
    const dirs = new Set();
    for (const file of this.scanResults.files) {
      const dir = path.dirname(file.relativePath);
      const parts = dir.split(path.sep);

      for (let i = 1; i <= parts.length; i++) {
        dirs.add(parts.slice(0, i).join(path.sep));
      }
    }
    return dirs.size;
  }

  /**
   * Detect framework from files
   */
  detectFramework() {
    const files = this.scanResults.files;
    const fileNames = files.map(f => f.name.toLowerCase());
    const packageJsonFile = files.find(f => f.name === 'package.json');

    // Check for framework-specific files
    if (fileNames.includes('next.config.js') || fileNames.includes('next.config.ts')) {
      return { name: 'Next.js', type: 'react-framework' };
    }
    if (fileNames.includes('nuxt.config.js') || fileNames.includes('nuxt.config.ts')) {
      return { name: 'Nuxt.js', type: 'vue-framework' };
    }
    if (fileNames.includes('angular.json')) {
      return { name: 'Angular', type: 'angular-framework' };
    }
    if (fileNames.includes('vue.config.js')) {
      return { name: 'Vue.js', type: 'vue-framework' };
    }
    if (fileNames.includes('svelte.config.js')) {
      return { name: 'Svelte', type: 'svelte-framework' };
    }
    if (fileNames.includes('remix.config.js')) {
      return { name: 'Remix', type: 'react-framework' };
    }

    // Check package.json dependencies
    if (packageJsonFile) {
      // Would need to read and parse package.json
      // For now, return generic
    }

    return { name: 'Unknown', type: 'unknown' };
  }

  /**
   * Find entry points
   */
  findEntryPoints() {
    const entryPointFiles = [
      'index.js', 'index.ts', 'index.jsx', 'index.tsx',
      'main.js', 'main.ts',
      'app.js', 'app.ts', 'app.jsx', 'app.tsx',
      'server.js', 'server.ts',
      'index.html'
    ];

    const entryPoints = [];

    for (const file of this.scanResults.files) {
      if (entryPointFiles.includes(file.name.toLowerCase())) {
        entryPoints.push({
          file: file.relativePath,
          type: this.getEntryPointType(file.name)
        });
      }
    }

    return entryPoints;
  }

  /**
   * Get entry point type
   */
  getEntryPointType(fileName) {
    if (fileName.includes('server')) return 'backend';
    if (fileName === 'index.html') return 'web';
    if (fileName.includes('app')) return 'application';
    return 'main';
  }

  /**
   * Get language from file type
   */
  getLanguageFromType(type) {
    const map = {
      'javascript': 'JavaScript',
      'javascript-react': 'JavaScript',
      'typescript': 'TypeScript',
      'typescript-react': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rust': 'Rust',
      'ruby': 'Ruby',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'c': 'C',
      'cpp': 'C++',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'CSS'
    };

    return map[type] || 'Other';
  }

  /**
   * Task 2-2: Generate Level 2 tree/modules map (~8KB)
   */
  async generateTreeMap() {
    const tree = this.scanner.getDirectoryTree();
    const stats = this.scanResults.stats;

    // Build directory structure with counts
    const directoryMap = this.buildDirectoryMap(tree);

    // Find modules/packages
    const modules = this.findModules();

    const treeData = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'tree',

      directoryTree: directoryMap,
      modules,

      fileTypeDistribution: stats.filesByType,
      fileRoleDistribution: stats.filesByRole
    };

    const outputPath = path.join(this.outputDir, 'tree.json');
    const metadata = await compression.compressAndSave(treeData, outputPath);

    console.log(`✓ Generated tree.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Build directory map with file counts
   */
  buildDirectoryMap(tree, currentPath = '') {
    const result = {};

    for (const [key, value] of Object.entries(tree)) {
      if (key === '_files') {
        continue;
      }

      const fullPath = currentPath ? `${currentPath}/${key}` : key;
      const files = value._files || [];
      const fileCount = files.length;

      result[key] = {
        path: fullPath,
        fileCount,
        files: files.map(f => f.name),
        subdirectories: Object.keys(value).filter(k => k !== '_files'),
        children: this.buildDirectoryMap(value, fullPath)
      };
    }

    return result;
  }

  /**
   * Find modules/packages in project
   */
  findModules() {
    const modules = [];
    const files = this.scanResults.files;

    // Look for package.json files (npm/node modules)
    const packageFiles = files.filter(f => f.name === 'package.json');
    for (const pkg of packageFiles) {
      modules.push({
        type: 'npm',
        path: path.dirname(pkg.relativePath),
        configFile: pkg.relativePath
      });
    }

    // Look for __init__.py (Python modules)
    const initFiles = files.filter(f => f.name === '__init__.py');
    for (const init of initFiles) {
      modules.push({
        type: 'python',
        path: path.dirname(init.relativePath),
        configFile: init.relativePath
      });
    }

    // Look for go.mod (Go modules)
    const goModFiles = files.filter(f => f.name === 'go.mod');
    for (const goMod of goModFiles) {
      modules.push({
        type: 'go',
        path: path.dirname(goMod.relativePath),
        configFile: goMod.relativePath
      });
    }

    return modules;
  }

  /**
   * Task 2-3: Generate Level 3 detailed metadata map (~40KB)
   */
  async generateMetadataMap() {
    const files = this.scanResults.files;
    const gitInfo = this.configManager.getGitCommitInfo();

    const metadataMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'metadata',

      compressionMetadata: {
        method: 'value-deduplication',
        compressionLevel: 3
      },

      staleness: {
        gitHash: gitInfo ? gitInfo.hash : null,
        fileCount: files.length,
        lastRefresh: new Date().toISOString(),
        isStale: false
      },

      files: files.map(f => ({
        path: f.relativePath,
        name: f.name,
        type: f.type,
        extension: f.extension,
        role: f.role,
        size: f.size,
        lines: f.lines || 0,
        modified: f.modified,
        gitStatus: f.gitStatus
      }))
    };

    const outputPath = path.join(this.outputDir, 'metadata.json');
    const metadata = await compression.compressAndSave(metadataMap, outputPath, { forceDeduplication: true });

    console.log(`✓ Generated metadata.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 2-4: Generate content summaries for source files
   * Extracts exports, imports, entities, first lines, JSDoc comments
   */
  async generateContentSummaries() {
    const sourceFiles = this.scanResults.files.filter(f =>
      f.role === 'source' || f.role === 'test'
    );

    const summaries = [];
    let successCount = 0;

    for (const file of sourceFiles) {
      try {
        const summary = await this.extractContentSummary(file);
        if (summary) {
          summaries.push(summary);
          successCount++;
        }
      } catch (error) {
        // Skip files that fail to parse
        continue;
      }
    }

    const contentSummaries = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'content-summaries',

      coverage: {
        totalSourceFiles: sourceFiles.length,
        summarizedFiles: successCount,
        coveragePercent: Math.round((successCount / sourceFiles.length) * 100)
      },

      summaries
    };

    const outputPath = path.join(this.outputDir, 'content-summaries.json');
    const metadata = await compression.compressAndSave(contentSummaries, outputPath);

    console.log(`✓ Generated content-summaries.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction, ${successCount}/${sourceFiles.length} files)`);

    return { file: outputPath, metadata };
  }

  /**
   * Extract content summary from a single file
   */
  async extractContentSummary(file) {
    const filePath = file.path;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      // Extract first 3-5 significant lines (skip blanks and comments)
      const firstLines = this.extractFirstSignificantLines(lines, 5);

      // Extract based on file type
      let exports = [];
      let imports = [];
      let entities = [];
      let comments = [];

      if (this.isJavaScriptFile(file.extension)) {
        const parsed = this.parseJavaScriptContent(content);
        exports = parsed.exports;
        imports = parsed.imports;
        entities = parsed.entities;
        comments = parsed.comments;
      } else if (this.isPythonFile(file.extension)) {
        const parsed = this.parsePythonContent(content);
        exports = parsed.exports;
        imports = parsed.imports;
        entities = parsed.entities;
        comments = parsed.comments;
      } else {
        // For other files, just get first lines
        return {
          path: file.relativePath,
          type: file.type,
          firstLines,
          exports: [],
          imports: [],
          entities: [],
          comments: []
        };
      }

      return {
        path: file.relativePath,
        type: file.type,
        firstLines,
        exports,
        imports,
        entities,
        comments
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Extract first N significant lines (skip blanks and comments)
   */
  extractFirstSignificantLines(lines, count) {
    const significant = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Skip single-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

      significant.push(trimmed);

      if (significant.length >= count) break;
    }

    return significant;
  }

  /**
   * Check if file is JavaScript/TypeScript
   */
  isJavaScriptFile(ext) {
    return ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext);
  }

  /**
   * Check if file is Python
   */
  isPythonFile(ext) {
    return ['py', 'pyi'].includes(ext);
  }

  /**
   * Parse JavaScript/TypeScript content using regex
   */
  parseJavaScriptContent(content) {
    const exports = [];
    const imports = [];
    const entities = [];
    const comments = [];

    // Extract imports (ES6 and CommonJS)
    const importMatches = content.matchAll(/import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      imports.push({
        symbols: match[1] ? match[1].split(',').map(s => s.trim()) : [match[2] || match[3]],
        source: match[4]
      });
    }

    const requireMatches = content.matchAll(/(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      imports.push({
        symbols: match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]],
        source: match[3]
      });
    }

    // Extract exports (ES6 and CommonJS)
    const exportMatches = content.matchAll(/export\s+(?:(?:default|const|let|var|function|class|async\s+function)\s+)?(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[1]);
    }

    const moduleExports = content.matchAll(/module\.exports\s*=\s*(\w+)/g);
    for (const match of moduleExports) {
      exports.push(match[1]);
    }

    // Extract entities (classes, functions)
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      entities.push({ type: 'class', name: match[1] });
    }

    const functionMatches = content.matchAll(/(?:function|async\s+function)\s+(\w+)/g);
    for (const match of functionMatches) {
      entities.push({ type: 'function', name: match[1] });
    }

    const arrowFunctions = content.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
    for (const match of arrowFunctions) {
      entities.push({ type: 'function', name: match[1] });
    }

    // Extract JSDoc comments
    const jsdocMatches = content.matchAll(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\//g);
    for (const match of jsdocMatches) {
      const comment = match[0]
        .replace(/\/\*\*|\*\//g, '')
        .replace(/^\s*\*\s?/gm, '')
        .trim();

      if (comment.length > 0 && comment.length < 200) {
        comments.push(comment.substring(0, 150));
      }
    }

    return { exports, imports, entities, comments };
  }

  /**
   * Parse Python content using regex
   */
  parsePythonContent(content) {
    const exports = [];
    const imports = [];
    const entities = [];
    const comments = [];

    // Extract imports
    const importMatches = content.matchAll(/(?:from\s+(\S+)\s+)?import\s+([^\n]+)/g);
    for (const match of importMatches) {
      imports.push({
        symbols: match[2].split(',').map(s => s.trim()),
        source: match[1] || 'builtin'
      });
    }

    // Extract classes
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      entities.push({ type: 'class', name: match[1] });
      exports.push(match[1]); // Assume classes are exported
    }

    // Extract functions
    const functionMatches = content.matchAll(/def\s+(\w+)/g);
    for (const match of functionMatches) {
      const funcName = match[1];
      if (!funcName.startsWith('_')) {
        // Only public functions are considered exports
        entities.push({ type: 'function', name: funcName });
        exports.push(funcName);
      }
    }

    // Extract docstrings
    const docstringMatches = content.matchAll(/"""([^"]*)"""|'''([^']*)'''/g);
    for (const match of docstringMatches) {
      const docstring = (match[1] || match[2]).trim();
      if (docstring.length > 0 && docstring.length < 200) {
        comments.push(docstring.substring(0, 150));
      }
    }

    return { exports, imports, entities, comments };
  }

  /**
   * Task 2-5: Build navigation indices for O(1) filtering
   * Organizes files by type, role, recency, size, and depth
   */
  async generateIndices() {
    const files = this.scanResults.files;

    // Index by type
    const byType = {};
    for (const file of files) {
      if (!byType[file.type]) {
        byType[file.type] = [];
      }
      byType[file.type].push(file.relativePath);
    }

    // Index by role
    const byRole = {};
    for (const file of files) {
      if (!byRole[file.role]) {
        byRole[file.role] = [];
      }
      byRole[file.role].push(file.relativePath);
    }

    // Index by recency (most recently modified first)
    const byRecency = files
      .slice()
      .sort((a, b) => new Date(b.modified) - new Date(a.modified))
      .map(f => ({
        path: f.relativePath,
        modified: f.modified
      }))
      .slice(0, 100); // Top 100 most recent

    // Index by size (largest first)
    const bySize = files
      .slice()
      .sort((a, b) => b.size - a.size)
      .map(f => ({
        path: f.relativePath,
        size: f.size
      }))
      .slice(0, 100); // Top 100 largest

    // Index by depth
    const byDepth = {};
    for (const file of files) {
      const depth = file.relativePath.split(path.sep).length - 1;
      if (!byDepth[depth]) {
        byDepth[depth] = [];
      }
      byDepth[depth].push(file.relativePath);
    }

    const indices = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'indices',

      byType,
      byRole,
      byRecency,
      bySize,
      byDepth
    };

    const outputPath = path.join(this.outputDir, 'indices.json');
    const metadata = await compression.compressAndSave(indices, outputPath);

    console.log(`✓ Generated indices.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 2-6: Generate existence proofs map
   * Provides exhaustive file lists and negative space detection
   */
  async generateExistenceProofs() {
    const files = this.scanResults.files;

    // Complete file manifest
    const fileManifest = files.map(f => f.relativePath).sort();

    // Directory existence map
    const directories = new Set();
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      for (let i = 0; i < parts.length - 1; i++) {
        directories.add(parts.slice(0, i + 1).join(path.sep));
      }
    }
    const directoryManifest = Array.from(directories).sort();

    // File counts by type
    const fileCountsByType = {};
    for (const file of files) {
      fileCountsByType[file.type] = (fileCountsByType[file.type] || 0) + 1;
    }

    // File counts by directory
    const fileCountsByDirectory = {};
    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      fileCountsByDirectory[dir] = (fileCountsByDirectory[dir] || 0) + 1;
    }

    // Common missing files detection
    const commonConfigFiles = [
      'package.json', 'package-lock.json', 'yarn.lock',
      'tsconfig.json', 'jsconfig.json',
      '.eslintrc.js', '.eslintrc.json', '.prettierrc',
      'jest.config.js', 'vitest.config.js',
      'webpack.config.js', 'vite.config.js',
      'docker-compose.yml', 'Dockerfile',
      '.gitignore', '.env', '.env.example',
      'README.md', 'LICENSE',
      'Makefile', 'CMakeLists.txt'
    ];

    const existingConfigFiles = [];
    const missingConfigFiles = [];

    for (const configFile of commonConfigFiles) {
      const exists = files.some(f => f.name === configFile && !f.relativePath.includes(path.sep));
      if (exists) {
        existingConfigFiles.push(configFile);
      } else {
        missingConfigFiles.push(configFile);
      }
    }

    const existenceProofs = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'existence-proofs',

      fileManifest,
      directoryManifest,
      fileCountsByType,
      fileCountsByDirectory,

      configFiles: {
        existing: existingConfigFiles,
        missing: missingConfigFiles
      },

      statistics: {
        totalFiles: fileManifest.length,
        totalDirectories: directoryManifest.length,
        uniqueTypes: Object.keys(fileCountsByType).length
      }
    };

    const outputPath = path.join(this.outputDir, 'existence-proofs.json');
    const metadata = await compression.compressAndSave(existenceProofs, outputPath);

    console.log(`✓ Generated existence-proofs.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 2-7: Pre-compute common queries
   * Provides instant answers to frequently asked questions
   */
  async generateQuickQueries() {
    const files = this.scanResults.files;
    const stats = this.scanResults.stats;

    // What's the entry point?
    const entryPoints = this.findEntryPoints();

    // Which framework?
    const framework = this.detectFramework();

    // Where are tests?
    const testFiles = files.filter(f => f.role === 'test');
    const testLocations = [...new Set(testFiles.map(f => path.dirname(f.relativePath)))];

    // Largest files
    const largestFiles = files
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(f => ({
        path: f.relativePath,
        size: f.size,
        type: f.type
      }));

    // Most recently modified
    const recentlyModified = files
      .slice()
      .sort((a, b) => new Date(b.modified) - new Date(a.modified))
      .slice(0, 10)
      .map(f => ({
        path: f.relativePath,
        modified: f.modified,
        type: f.type
      }));

    // Architectural patterns detected
    const architecturalPatterns = this.detectArchitecturalPatterns(files);

    // Build tool detection
    const buildTools = this.detectBuildTools(files);

    // Package manager detection
    const packageManager = this.detectPackageManager(files);

    // Testing framework detection
    const testingFramework = this.detectTestingFramework(files);

    // Primary languages (from summary)
    const languageCounts = {};
    for (const file of files) {
      const lang = this.getLanguageFromType(file.type);
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }

    const primaryLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => ({
        language: lang,
        files: count,
        percentage: Math.round((count / files.length) * 100)
      }));

    // Phase 6 - Task 6-5: Extract API endpoints
    const apiEndpointsData = await this.extractAPIEndpoints();

    const quickQueries = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'quick-queries',

      entryPoint: entryPoints.length > 0 ? entryPoints[0] : null,
      allEntryPoints: entryPoints,

      framework,
      buildTool: buildTools,
      packageManager,
      testingFramework,

      testLocations,
      testFileCount: testFiles.length,

      largestFiles,
      recentlyModified,

      primaryLanguages,

      architecturalPatterns,

      // Phase 6: API endpoints
      apiEndpoints: apiEndpointsData.endpoints.slice(0, 30), // Top 30 endpoints
      apiEndpointsStats: apiEndpointsData.statistics,
      apiEndpointsByMethod: apiEndpointsData.byMethod,

      statistics: {
        totalFiles: files.length,
        totalSize: stats.totalSize,
        totalLines: stats.totalLines,
        averageFileSize: Math.round(stats.totalSize / files.length)
      }
    };

    const outputPath = path.join(this.outputDir, 'quick-queries.json');
    const metadata = await compression.compressAndSave(quickQueries, outputPath, { forceAbbreviation: false });

    console.log(`✓ Generated quick-queries.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Detect architectural patterns in the project
   */
  detectArchitecturalPatterns(files) {
    const patterns = [];

    // Check for MVC pattern
    const hasMVC = files.some(f => f.relativePath.includes('models')) &&
                   files.some(f => f.relativePath.includes('views')) &&
                   files.some(f => f.relativePath.includes('controllers'));
    if (hasMVC) patterns.push('MVC');

    // Check for microservices
    const hasServices = files.filter(f => f.relativePath.includes('service')).length > 3;
    if (hasServices) patterns.push('Microservices');

    // Check for layered architecture
    const hasLayers = files.some(f => f.relativePath.match(/\/(api|business|data|presentation)\//));
    if (hasLayers) patterns.push('Layered');

    // Check for monorepo
    const packageJsonCount = files.filter(f => f.name === 'package.json').length;
    if (packageJsonCount > 1) patterns.push('Monorepo');

    // Check for component-based
    const hasComponents = files.filter(f => f.relativePath.includes('component')).length > 5;
    if (hasComponents) patterns.push('Component-Based');

    return patterns.length > 0 ? patterns : ['Unknown'];
  }

  /**
   * Detect build tools
   */
  detectBuildTools(files) {
    const tools = [];

    if (files.some(f => f.name === 'webpack.config.js')) tools.push('Webpack');
    if (files.some(f => f.name === 'vite.config.js' || f.name === 'vite.config.ts')) tools.push('Vite');
    if (files.some(f => f.name === 'rollup.config.js')) tools.push('Rollup');
    if (files.some(f => f.name === 'esbuild.config.js')) tools.push('esbuild');
    if (files.some(f => f.name === 'tsup.config.ts')) tools.push('tsup');
    if (files.some(f => f.name === 'Makefile')) tools.push('Make');
    if (files.some(f => f.name === 'CMakeLists.txt')) tools.push('CMake');
    if (files.some(f => f.name === 'build.gradle')) tools.push('Gradle');
    if (files.some(f => f.name === 'pom.xml')) tools.push('Maven');

    return tools.length > 0 ? tools : ['None detected'];
  }

  /**
   * Detect package manager
   */
  detectPackageManager(files) {
    if (files.some(f => f.name === 'pnpm-lock.yaml')) return 'pnpm';
    if (files.some(f => f.name === 'yarn.lock')) return 'yarn';
    if (files.some(f => f.name === 'package-lock.json')) return 'npm';
    if (files.some(f => f.name === 'Pipfile.lock')) return 'pipenv';
    if (files.some(f => f.name === 'poetry.lock')) return 'poetry';
    if (files.some(f => f.name === 'Cargo.lock')) return 'cargo';
    if (files.some(f => f.name === 'go.sum')) return 'go modules';

    return 'Unknown';
  }

  /**
   * Detect testing framework
   */
  detectTestingFramework(files) {
    const frameworks = [];

    if (files.some(f => f.name === 'jest.config.js' || f.name === 'jest.config.ts')) frameworks.push('Jest');
    if (files.some(f => f.name === 'vitest.config.js' || f.name === 'vitest.config.ts')) frameworks.push('Vitest');
    if (files.some(f => f.name === 'mocha.opts' || f.relativePath.includes('mocha'))) frameworks.push('Mocha');
    if (files.some(f => f.name === 'karma.conf.js')) frameworks.push('Karma');
    if (files.some(f => f.name === 'cypress.json' || f.relativePath.includes('cypress'))) frameworks.push('Cypress');
    if (files.some(f => f.name === 'playwright.config.ts' || f.relativePath.includes('playwright'))) frameworks.push('Playwright');
    if (files.some(f => f.name === 'pytest.ini' || f.relativePath.includes('pytest'))) frameworks.push('Pytest');

    return frameworks.length > 0 ? frameworks : ['None detected'];
  }

  /**
   * Task 3-2: Build forward dependency map
   * Maps each file to its imports
   */
  async generateForwardDependencies() {
    const sourceFiles = this.scanResults.files.filter(f =>
      f.role === 'source' || f.role === 'test'
    );

    const forwardMap = {};
    let parsedCount = 0;

    for (const file of sourceFiles) {
      const parseResult = await this.parser.parseFile(file.path);

      if (!parseResult.error && parseResult.imports.length > 0) {
        forwardMap[file.relativePath] = {
          imports: parseResult.imports.map(imp => ({
            source: imp.source,
            rawSource: imp.rawSource,
            symbols: imp.symbols,
            type: imp.type,
            isDynamic: imp.isDynamic
          }))
        };
        parsedCount++;
      }
    }

    const forwardDeps = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'dependencies-forward',

      coverage: {
        totalSourceFiles: sourceFiles.length,
        filesWithDependencies: parsedCount,
        coveragePercent: Math.round((parsedCount / sourceFiles.length) * 100)
      },

      dependencies: forwardMap
    };

    const outputPath = path.join(this.outputDir, 'dependencies-forward.json');
    const metadata = await compression.compressAndSave(forwardDeps, outputPath);

    console.log(`✓ Generated dependencies-forward.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction, ${parsedCount}/${sourceFiles.length} files)`);

    // Store for use in reverse map
    this.dependencyData = forwardMap;

    return { file: outputPath, metadata };
  }

  /**
   * Task 3-3: Build reverse dependency map
   * Maps each file to files that import it
   */
  async generateReverseDependencies() {
    if (!this.dependencyData) {
      // Need to generate forward dependencies first
      await this.generateForwardDependencies();
    }

    const reverseMap = {};

    // Initialize reverse map with all source files
    const sourceFiles = this.scanResults.files.filter(f =>
      f.role === 'source' || f.role === 'test'
    );

    for (const file of sourceFiles) {
      reverseMap[file.relativePath] = {
        importedBy: []
      };
    }

    // Build reverse mappings
    for (const [filePath, data] of Object.entries(this.dependencyData)) {
      for (const imp of data.imports) {
        // Only track internal imports
        if (imp.type === 'internal') {
          const targetFile = imp.source;

          if (!reverseMap[targetFile]) {
            reverseMap[targetFile] = { importedBy: [] };
          }

          reverseMap[targetFile].importedBy.push({
            file: filePath,
            symbols: imp.symbols,
            isDynamic: imp.isDynamic
          });
        }
      }
    }

    const reverseDeps = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'dependencies-reverse',

      statistics: {
        totalFiles: Object.keys(reverseMap).length,
        filesWithImporters: Object.values(reverseMap).filter(v => v.importedBy.length > 0).length
      },

      dependencies: reverseMap
    };

    const outputPath = path.join(this.outputDir, 'dependencies-reverse.json');
    const metadata = await compression.compressAndSave(reverseDeps, outputPath);

    console.log(`✓ Generated dependencies-reverse.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 3-4: Generate comprehensive relationships map
   */
  async generateRelationships() {
    const files = this.scanResults.files;
    const sourceFiles = files.filter(f => f.role === 'source' || f.role === 'test');

    // Ensure we have dependency data
    if (!this.dependencyData) {
      await this.generateForwardDependencies();
    }

    // Analyze dependency depth for each file
    const depthMap = this.calculateDependencyDepth();

    // Find import chains (transitive dependencies)
    const importChains = this.findImportChains();

    // Categorize imports
    const importStats = {
      internal: 0,
      external: 0,
      stdlib: 0,
      dynamic: 0
    };

    for (const data of Object.values(this.dependencyData)) {
      for (const imp of data.imports) {
        if (imp.type === 'internal') importStats.internal++;
        else if (imp.type === 'external') importStats.external++;
        else if (imp.type === 'stdlib') importStats.stdlib++;

        if (imp.isDynamic) importStats.dynamic++;
      }
    }

    const relationships = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'relationships',

      statistics: {
        totalFiles: sourceFiles.length,
        filesWithDependencies: Object.keys(this.dependencyData).length,
        totalImports: importStats.internal + importStats.external + importStats.stdlib,
        internalImports: importStats.internal,
        externalImports: importStats.external,
        stdlibImports: importStats.stdlib,
        dynamicImports: importStats.dynamic
      },

      depthAnalysis: depthMap,
      importChains: importChains.slice(0, 20), // Top 20 longest chains

      // Include both forward and reverse for complete picture
      forward: this.dependencyData,
      reverse: {} // Will be populated if reverse map was generated
    };

    const outputPath = path.join(this.outputDir, 'relationships.json');
    const metadata = await compression.compressAndSave(relationships, outputPath);

    console.log(`✓ Generated relationships.json (${metadata.compressedSize} bytes, ${metadata.compressionRatio} reduction)`);

    return { file: outputPath, metadata };
  }

  /**
   * Calculate dependency depth for each file
   */
  calculateDependencyDepth() {
    const depthMap = {};

    for (const [filePath, data] of Object.entries(this.dependencyData)) {
      const internalDeps = data.imports.filter(imp => imp.type === 'internal').length;
      depthMap[filePath] = internalDeps;
    }

    // Sort by depth
    const sortedByDepth = Object.entries(depthMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, depth]) => ({ file, depth }));

    return {
      byFile: depthMap,
      mostDependent: sortedByDepth
    };
  }

  /**
   * Find longest import chains
   */
  findImportChains() {
    const chains = [];

    // Simple chain detection: find files that import files that import other files
    for (const [filePath, data] of Object.entries(this.dependencyData)) {
      for (const imp of data.imports) {
        if (imp.type === 'internal' && this.dependencyData[imp.source]) {
          const chain = [filePath, imp.source];

          // Follow the chain one more level
          for (const nestedImp of this.dependencyData[imp.source].imports) {
            if (nestedImp.type === 'internal' && !chain.includes(nestedImp.source)) {
              chains.push({
                chain: [...chain, nestedImp.source],
                length: 3
              });
            }
          }
        }
      }
    }

    return chains.sort((a, b) => b.length - a.length);
  }

  /**
   * Task 3-5: Detect dependency issues
   */
  async generateIssuesMap() {
    const issues = {
      brokenImports: [],
      circularDependencies: [],
      unusedFiles: [],
      missingDependencies: []
    };

    // Detect broken imports (imports to non-existent files)
    for (const [filePath, data] of Object.entries(this.dependencyData)) {
      for (const imp of data.imports) {
        if (imp.type === 'internal') {
          const targetExists = this.scanResults.files.some(f =>
            f.relativePath === imp.source ||
            f.relativePath === imp.source + '.js' ||
            f.relativePath === imp.source + '.ts'
          );

          if (!targetExists) {
            issues.brokenImports.push({
              file: filePath,
              import: imp.rawSource,
              resolvedTo: imp.source,
              severity: 'error'
            });
          }
        }
      }
    }

    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies();
    issues.circularDependencies = circularDeps;

    // Detect unused files (files that are never imported)
    const sourceFiles = this.scanResults.files.filter(f => f.role === 'source');
    const importedFiles = new Set();

    for (const data of Object.values(this.dependencyData)) {
      for (const imp of data.imports) {
        if (imp.type === 'internal') {
          importedFiles.add(imp.source);
        }
      }
    }

    for (const file of sourceFiles) {
      if (!importedFiles.has(file.relativePath) && !this.isEntryPoint(file)) {
        issues.unusedFiles.push({
          file: file.relativePath,
          severity: 'warning',
          suggestion: 'This file is never imported. Consider removing it if it\'s not an entry point.'
        });
      }
    }

    const issuesMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'issues',

      summary: {
        brokenImports: issues.brokenImports.length,
        circularDependencies: issues.circularDependencies.length,
        unusedFiles: issues.unusedFiles.length,
        totalIssues: issues.brokenImports.length + issues.circularDependencies.length + issues.unusedFiles.length
      },

      issues
    };

    const outputPath = path.join(this.outputDir, 'issues.json');
    const metadata = await compression.compressAndSave(issuesMap, outputPath, { forceAbbreviation: false });

    console.log(`✓ Generated issues.json (${metadata.compressedSize} bytes, ${issuesMap.summary.totalIssues} issues found)`);

    return { file: outputPath, metadata };
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies() {
    const circular = [];
    const visited = new Set();
    const recursionStack = new Set();

    const detectCycle = (file, path = []) => {
      if (recursionStack.has(file)) {
        // Found a cycle
        const cycleStart = path.indexOf(file);
        const cycle = path.slice(cycleStart);
        cycle.push(file);

        circular.push({
          cycle,
          length: cycle.length - 1,
          severity: 'warning'
        });

        return;
      }

      if (visited.has(file)) {
        return;
      }

      visited.add(file);
      recursionStack.add(file);
      path.push(file);

      const data = this.dependencyData[file];
      if (data) {
        for (const imp of data.imports) {
          if (imp.type === 'internal') {
            detectCycle(imp.source, [...path]);
          }
        }
      }

      recursionStack.delete(file);
    };

    for (const file of Object.keys(this.dependencyData)) {
      if (!visited.has(file)) {
        detectCycle(file);
      }
    }

    return circular;
  }

  /**
   * Task 4-2: Generate business modules map
   * Groups files by business features/modules with role categorization
   */
  async generateModulesMap() {
    console.log('Detecting modules...');
    const modules = await this.moduleDetector.detectModules(this.scanResults.files);

    // Build comprehensive modules map with role categorization
    const modulesMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'business-modules',

      summary: {
        totalModules: modules.size,
        totalFiles: this.scanResults.files.length
      },

      modules: {}
    };

    // Process each module
    for (const [moduleName, moduleData] of modules.entries()) {
      const moduleFiles = this.scanResults.files.filter(f => f.module === moduleName);

      // Categorize files by role
      const categorized = {
        screens: [],
        pages: [],
        components: [],
        apis: [],
        routes: [],
        controllers: [],
        services: [],
        models: [],
        schemas: [],
        tests: [],
        docs: [],
        configs: [],
        utils: [],
        other: []
      };

      for (const file of moduleFiles) {
        const category = this.categorizeFileRole(file);
        if (categorized[category]) {
          categorized[category].push(file.relativePath);
        } else {
          categorized.other.push(file.relativePath);
        }
      }

      // Remove empty categories
      for (const [key, value] of Object.entries(categorized)) {
        if (value.length === 0) {
          delete categorized[key];
        }
      }

      // Task 4-3: Extract database table usage for this module
      const tablesUsed = this.extractTableUsage(moduleFiles);

      modulesMap.modules[moduleName] = {
        name: moduleName,
        detectionMethod: moduleData.detectionMethod,
        stats: {
          fileCount: moduleData.fileCount,
          totalSize: moduleData.totalSize,
          totalLines: moduleData.totalLines
        },
        files: categorized,
        filesByRole: moduleData.filesByRole,
        filesByType: moduleData.filesByType,
        tablesUsed: tablesUsed
      };
    }

    const outputPath = path.join(this.outputDir, 'modules.json');
    const metadata = await compression.compressAndSave(modulesMap, outputPath);

    console.log(`✓ Generated modules.json (${metadata.compressedSize} bytes, ${modulesMap.summary.totalModules} modules)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 4-4: Generate module dependency graph
   * Shows inter-module relationships based on file imports
   */
  async generateModuleDependencies() {
    console.log('Analyzing module dependencies...');

    // Build module dependency graph
    const moduleDeps = {};
    const moduleFiles = {};

    // Group files by module
    for (const file of this.scanResults.files) {
      if (file.module) {
        if (!moduleFiles[file.module]) {
          moduleFiles[file.module] = [];
        }
        moduleFiles[file.module].push(file.relativePath);
      }
    }

    // Initialize dependency structure for each module
    for (const moduleName of Object.keys(moduleFiles)) {
      moduleDeps[moduleName] = {
        name: moduleName,
        dependsOn: new Set(),
        dependedBy: new Set(),
        importCount: 0,
        coupling: 'unknown'
      };
    }

    // Analyze imports between modules
    if (this.dependencyData) {
      for (const [filePath, data] of Object.entries(this.dependencyData)) {
        const sourceFile = this.scanResults.files.find(f => f.relativePath === filePath);
        if (!sourceFile || !sourceFile.module) continue;

        const sourceModule = sourceFile.module;

        for (const imp of data.imports) {
          if (imp.type === 'internal') {
            const targetFile = this.scanResults.files.find(f =>
              f.relativePath === imp.source ||
              f.relativePath === imp.source + '.js' ||
              f.relativePath === imp.source + '.ts'
            );

            if (targetFile && targetFile.module && targetFile.module !== sourceModule) {
              moduleDeps[sourceModule].dependsOn.add(targetFile.module);
              moduleDeps[targetFile.module].dependedBy.add(sourceModule);
              moduleDeps[sourceModule].importCount++;
            }
          }
        }
      }
    }

    // Calculate coupling scores
    for (const [moduleName, deps] of Object.entries(moduleDeps)) {
      const totalConnections = deps.dependsOn.size + deps.dependedBy.size;
      if (totalConnections === 0) {
        deps.coupling = 'isolated';
      } else if (totalConnections <= 2) {
        deps.coupling = 'loose';
      } else if (totalConnections <= 5) {
        deps.coupling = 'moderate';
      } else {
        deps.coupling = 'tight';
      }

      // Convert Sets to Arrays for JSON serialization
      deps.dependsOn = Array.from(deps.dependsOn).sort();
      deps.dependedBy = Array.from(deps.dependedBy).sort();
    }

    const moduleDepsMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'module-dependencies',

      summary: {
        totalModules: Object.keys(moduleDeps).length,
        isolatedModules: Object.values(moduleDeps).filter(d => d.coupling === 'isolated').length,
        tightlyCoupled: Object.values(moduleDeps).filter(d => d.coupling === 'tight').length
      },

      dependencies: moduleDeps
    };

    const outputPath = path.join(this.outputDir, 'module-dependencies.json');
    const metadata = await compression.compressAndSave(moduleDepsMap, outputPath);

    console.log(`✓ Generated module-dependencies.json (${metadata.compressedSize} bytes, ${moduleDepsMap.summary.totalModules} modules)`);

    return { file: outputPath, metadata };
  }

  /**
   * Categorize file by role within module
   */
  categorizeFileRole(file) {
    const fileName = file.name.toLowerCase();
    const relativePath = file.relativePath.toLowerCase();
    const role = file.role;

    // Test files
    if (role === 'test' || fileName.includes('.test.') || fileName.includes('.spec.') || relativePath.includes('/test/')) {
      return 'tests';
    }

    // Documentation
    if (role === 'doc' || fileName.endsWith('.md') || fileName.endsWith('.mdx')) {
      return 'docs';
    }

    // Configuration
    if (role === 'config' || fileName.includes('config') || fileName.endsWith('.json') || fileName.endsWith('.yaml')) {
      return 'configs';
    }

    // Frontend: Screens/Pages
    if (relativePath.includes('/screens/') || relativePath.includes('/pages/') || fileName.includes('screen') || fileName.includes('page')) {
      if (relativePath.includes('/pages/')) {
        return 'pages';
      }
      return 'screens';
    }

    // Frontend: Components
    if (
      relativePath.includes('/components/') ||
      file.type === 'javascript-react' ||
      file.type === 'typescript-react' ||
      fileName.endsWith('.jsx') ||
      fileName.endsWith('.tsx')
    ) {
      return 'components';
    }

    // Backend: Routes/Controllers
    if (relativePath.includes('/routes/') || relativePath.includes('/router/') || fileName.includes('route')) {
      return 'routes';
    }

    if (relativePath.includes('/controllers/') || fileName.includes('controller')) {
      return 'controllers';
    }

    // Backend: APIs
    if (relativePath.includes('/api/') || fileName.includes('api')) {
      return 'apis';
    }

    // Backend: Services
    if (relativePath.includes('/services/') || fileName.includes('service')) {
      return 'services';
    }

    // Backend: Models/Schemas
    if (relativePath.includes('/models/') || fileName.includes('model')) {
      return 'models';
    }

    if (relativePath.includes('/schemas/') || fileName.includes('schema')) {
      return 'schemas';
    }

    // Utils/Helpers
    if (relativePath.includes('/utils/') || relativePath.includes('/helpers/') || fileName.includes('util') || fileName.includes('helper')) {
      return 'utils';
    }

    return 'other';
  }

  /**
   * Task 4-3: Extract database table usage from module files
   * Analyzes models, schemas, and queries to identify table references
   */
  extractTableUsage(moduleFiles) {
    const tables = new Set();

    for (const file of moduleFiles) {
      const fileName = file.name.toLowerCase();
      const relativePath = file.relativePath.toLowerCase();

      // Model files often indicate table names
      if (relativePath.includes('/models/') || fileName.includes('model')) {
        // Extract potential table name from file name
        const baseName = path.basename(file.name, path.extname(file.name));
        // Convert camelCase/PascalCase to snake_case (common convention)
        const tableName = baseName
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');

        if (tableName && tableName.length > 2) {
          tables.add(tableName);
          // Also add plural form (common convention)
          if (!tableName.endsWith('s')) {
            tables.add(tableName + 's');
          }
        }
      }

      // Schema files (Prisma, TypeORM)
      if (fileName.includes('schema') || fileName.endsWith('.prisma')) {
        const baseName = path.basename(file.name, path.extname(file.name));
        if (baseName !== 'schema' && baseName !== 'index') {
          tables.add(baseName.toLowerCase());
        }
      }

      // Migration files often contain table names
      if (relativePath.includes('/migrations/') || fileName.includes('migration')) {
        // Extract table names from migration file names (e.g., create_users_table)
        const tableMatch = fileName.match(/create[_-](\w+)[_-]table/);
        if (tableMatch) {
          tables.add(tableMatch[1]);
        }
      }
    }

    return Array.from(tables).sort();
  }

  /**
   * Check if file is an entry point
   */
  isEntryPoint(file) {
    const entryPointNames = [
      'index.js', 'index.ts', 'index.jsx', 'index.tsx',

      'main.js', 'main.ts',
      'app.js', 'app.ts', 'app.jsx', 'app.tsx',
      'server.js', 'server.ts'
    ];

    return entryPointNames.includes(file.name.toLowerCase());
  }

  /**
   * Task 5-1, 5-2, 5-3, 5-4, 5-5: Generate frontend components map
   * Detects framework, extracts component metadata, builds dependency graph,
   * categorizes components by layer, and identifies reusable components
   */
  async generateFrontendComponentsMap() {
    console.log('Detecting frontend framework...');

    // Task 5-1: Detect frontend framework
    const frameworkInfo = await this.frameworkDetector.detectFramework(this.scanResults.files);

    // Only proceed if we detected a frontend framework
    if (!frameworkInfo.framework || frameworkInfo.framework.name === 'Unknown') {
      console.log('No frontend framework detected, skipping frontend components map');
      return null;
    }

    console.log(`Detected framework: ${frameworkInfo.framework.name}`);

    // Get component files
    const frameworkType = frameworkInfo.framework.type.split('-')[0];
    const componentFiles = this.scanResults.files.filter(f =>
      this.isComponentFile(f, frameworkType)
    );

    console.log(`Found ${componentFiles.length} component files`);

    // Task 5-3: Build component dependency graph
    const componentGraph = {};

    for (const file of componentFiles) {
      const relativePath = file.relativePath;

      // Initialize component entry
      componentGraph[relativePath] = {
        name: path.basename(file.name, path.extname(file.name)),
        path: relativePath,
        type: file.type,
        size: file.size,
        uses: [],
        usedBy: [],
        layer: 'unknown',
        reusable: false
      };
    }

    // Build import relationships from dependency data
    if (this.dependencyData) {
      for (const [filePath, data] of Object.entries(this.dependencyData)) {
        const sourceComponent = componentGraph[filePath];
        if (!sourceComponent) continue;

        for (const imp of data.imports) {
          if (imp.type === 'internal') {
            const targetComponent = componentGraph[imp.source];
            if (targetComponent) {
              // Add to uses/usedBy relationships
              sourceComponent.uses.push({
                component: imp.source,
                symbols: imp.symbols
              });

              targetComponent.usedBy.push({
                component: filePath,
                symbols: imp.symbols
              });
            }
          }
        }
      }
    }

    // Task 5-4: Categorize components into layers
    for (const [componentPath, component] of Object.entries(componentGraph)) {
      component.layer = this.categorizeComponentLayer(componentPath);
    }

    // Task 5-5: Identify reusable vs feature-specific components
    for (const [componentPath, component] of Object.entries(componentGraph)) {
      component.reusable = this.isReusableComponent(componentPath, component);
    }

    // Generate statistics
    const layerStats = {};
    const reusableCount = { reusable: 0, featureSpecific: 0 };

    for (const component of Object.values(componentGraph)) {
      layerStats[component.layer] = (layerStats[component.layer] || 0) + 1;
      if (component.reusable) {
        reusableCount.reusable++;
      } else {
        reusableCount.featureSpecific++;
      }
    }

    const componentsMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'frontend-components',

      framework: frameworkInfo.framework,
      stateManagement: frameworkInfo.stateManagement,
      componentPatterns: frameworkInfo.componentPatterns,

      statistics: {
        totalComponents: componentFiles.length,
        byLayer: layerStats,
        reusability: reusableCount
      },

      components: componentGraph
    };

    const outputPath = path.join(this.outputDir, 'frontend-components.json');
    const metadata = await compression.compressAndSave(componentsMap, outputPath);

    console.log(`✓ Generated frontend-components.json (${metadata.compressedSize} bytes, ${componentFiles.length} components)`);

    return { file: outputPath, metadata };
  }

  /**
   * Task 5-2: Generate component metadata map
   * Extracts props, state, hooks, lifecycle methods from components
   */
  async generateComponentMetadataMap() {
    // Check if we have a frontend framework
    const frameworkInfo = await this.frameworkDetector.detectFramework(this.scanResults.files);

    if (!frameworkInfo.framework || frameworkInfo.framework.name === 'Unknown') {
      console.log('No frontend framework detected, skipping component metadata map');
      return null;
    }

    // Get component files
    const frameworkType = frameworkInfo.framework.type.split('-')[0];
    const componentFiles = this.scanResults.files.filter(f =>
      this.isComponentFile(f, frameworkType)
    );

    console.log(`Extracting metadata from ${componentFiles.length} components...`);

    const componentMetadata = {};
    let extractedCount = 0;

    // Sample components (extract from up to 50 components to avoid performance issues)
    const sampleSize = Math.min(50, componentFiles.length);
    const sampledComponents = this.sampleComponents(componentFiles, sampleSize);

    for (const file of sampledComponents) {
      try {
        const metadata = await this.frameworkDetector.extractComponentMetadata(file.path);

        if (metadata) {
          componentMetadata[file.relativePath] = {
            name: path.basename(file.name, path.extname(file.name)),
            path: file.relativePath,
            ...metadata
          };
          extractedCount++;
        }
      } catch (error) {
        // Skip components that fail to parse
        continue;
      }
    }

    const metadataMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'component-metadata',

      framework: frameworkInfo.framework,

      coverage: {
        totalComponents: componentFiles.length,
        extractedComponents: extractedCount,
        sampleSize: sampleSize,
        coveragePercent: Math.round((extractedCount / sampleSize) * 100)
      },

      metadata: componentMetadata
    };

    const outputPath = path.join(this.outputDir, 'component-metadata.json');
    const metadata = await compression.compressAndSave(metadataMap, outputPath);

    console.log(`✓ Generated component-metadata.json (${metadata.compressedSize} bytes, ${extractedCount}/${sampleSize} components)`);

    return { file: outputPath, metadata };
  }

  /**
   * Check if file is a component file based on framework
   */
  isComponentFile(file, frameworkType) {
    const fileName = file.name.toLowerCase();
    const relativePath = file.relativePath.toLowerCase();

    switch (frameworkType) {
      case 'react':
        return (file.type === 'javascript-react' || file.type === 'typescript-react') ||
               (fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) ||
               relativePath.includes('/components/');

      case 'vue':
        return file.extension === 'vue';

      case 'angular':
        return fileName.endsWith('.component.ts');

      case 'svelte':
        return file.extension === 'svelte';

      default:
        return false;
    }
  }

  /**
   * Categorize component by layer (pages, features, UI, layouts)
   */
  categorizeComponentLayer(componentPath) {
    const lowerPath = componentPath.toLowerCase();
    const fileName = path.basename(componentPath).toLowerCase();

    // Pages layer
    if (lowerPath.includes('/pages/') || lowerPath.includes('/views/') ||
        lowerPath.includes('/screens/') || fileName.includes('page') ||
        fileName.includes('screen') || fileName.includes('view')) {
      return 'page';
    }

    // Layout layer
    if (lowerPath.includes('/layout') || fileName.includes('layout') ||
        fileName.includes('template') || fileName.includes('wrapper')) {
      return 'layout';
    }

    // UI layer (common/shared components)
    if (lowerPath.includes('/ui/') || lowerPath.includes('/common/') ||
        lowerPath.includes('/shared/') || lowerPath.includes('/primitives/') ||
        lowerPath.includes('/base/') || lowerPath.includes('/atoms/')) {
      return 'ui';
    }

    // Feature layer (business logic components)
    if (lowerPath.includes('/features/') || lowerPath.includes('/modules/') ||
        lowerPath.includes('/domains/')) {
      return 'feature';
    }

    // Default to feature if in components directory
    if (lowerPath.includes('/components/')) {
      return 'feature';
    }

    return 'unknown';
  }

  /**
   * Determine if component is reusable
   * Criteria: used by 3+ components, in common/ui/shared dirs, generic naming
   */
  isReusableComponent(componentPath, component) {
    const lowerPath = componentPath.toLowerCase();
    const fileName = path.basename(componentPath).toLowerCase();

    // Check usage count (used by 3+ components)
    if (component.usedBy && component.usedBy.length >= 3) {
      return true;
    }

    // Check directory location
    if (lowerPath.includes('/common/') || lowerPath.includes('/shared/') ||
        lowerPath.includes('/ui/') || lowerPath.includes('/primitives/') ||
        lowerPath.includes('/base/') || lowerPath.includes('/atoms/')) {
      return true;
    }

    // Check generic naming patterns
    const genericPatterns = [
      'button', 'input', 'select', 'checkbox', 'radio', 'form',
      'modal', 'dialog', 'tooltip', 'dropdown', 'menu', 'card',
      'list', 'table', 'grid', 'icon', 'avatar', 'badge',
      'alert', 'toast', 'spinner', 'loader', 'header', 'footer',
      'sidebar', 'navigation', 'nav', 'tabs', 'accordion'
    ];

    for (const pattern of genericPatterns) {
      if (fileName.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sample components for metadata extraction
   */
  sampleComponents(components, sampleSize) {
    if (components.length <= sampleSize) {
      return components;
    }

    const sampled = [];
    const indices = new Set();

    while (sampled.length < sampleSize) {
      const index = Math.floor(Math.random() * components.length);
      if (!indices.has(index)) {
        indices.add(index);
        sampled.push(components[index]);
      }
    }

    return sampled;
  }

  /**
   * Phase 6 - Task 6-1 & 6-2: Generate Backend Layers Map
   * Detects architecture pattern and categorizes backend files into layers
   */
  async generateBackendLayersMap() {
    console.log('Detecting backend architecture...');

    // Detect architecture pattern
    this.architectureData = this.architectureDetector.detectArchitecture(this.scanResults.files);

    // Build backend layers map
    const backendLayersMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'backend-layers',

      architecture: {
        primaryPattern: this.architectureData.primaryPattern,
        detectedPatterns: this.architectureData.detectedPatterns,
        confidence: this.architectureData.confidence,
        layerCounts: this.architectureData.layerCounts
      },

      layers: this.architectureData.layers,

      statistics: {
        totalLayers: Object.keys(this.architectureData.layers).length,
        totalFiles: Object.values(this.architectureData.layers).reduce((sum, layer) => sum + layer.length, 0),
        layerDistribution: Object.fromEntries(
          Object.entries(this.architectureData.layers).map(([layer, files]) => [layer, files.length])
        )
      }
    };

    const outputPath = path.join(this.outputDir, 'backend-layers.json');
    const metadata = await compression.compressAndSave(backendLayersMap, outputPath);

    console.log(`✓ Generated backend-layers.json (${metadata.compressedSize} bytes, ${this.architectureData.primaryPattern.name} architecture)`);

    return { file: outputPath, metadata };
  }

  /**
   * Phase 6 - Task 6-3: Generate Data Flow Map
   * Traces request paths through architectural layers (route -> controller -> service -> model)
   */
  async generateDataFlowMap() {
    console.log('Building data flow map...');

    // Ensure we have dependencies and architecture data
    if (!this.dependencyData) {
      await this.generateForwardDependencies();
    }

    if (!this.architectureData) {
      this.architectureData = this.architectureDetector.detectArchitecture(this.scanResults.files);
    }

    // Build data flow chains
    const flows = this.architectureDetector.buildDataFlowMap(
      this.architectureData.layers,
      this.dependencyData
    );

    // Analyze flow patterns
    const flowStats = {
      totalFlows: flows.length,
      averageDepth: flows.length > 0 ? flows.reduce((sum, f) => sum + f.depth, 0) / flows.length : 0,
      maxDepth: flows.length > 0 ? Math.max(...flows.map(f => f.depth)) : 0,
      layerUsage: {}
    };

    // Count layer usage across flows
    for (const flow of flows) {
      for (const layer of flow.layers) {
        flowStats.layerUsage[layer] = (flowStats.layerUsage[layer] || 0) + 1;
      }
    }

    const dataFlowMap = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'data-flow',

      architecture: this.architectureData.primaryPattern.name,

      flows: flows.slice(0, 50), // Top 50 most significant flows

      statistics: flowStats,

      patterns: {
        commonFlows: this.identifyCommonFlowPatterns(flows),
        isolatedEndpoints: this.findIsolatedEndpoints(flows)
      }
    };

    const outputPath = path.join(this.outputDir, 'data-flow.json');
    const metadata = await compression.compressAndSave(dataFlowMap, outputPath);

    console.log(`✓ Generated data-flow.json (${metadata.compressedSize} bytes, ${flows.length} flows traced)`);

    return { file: outputPath, metadata };
  }

  /**
   * Identify common flow patterns (routes that follow similar paths)
   */
  identifyCommonFlowPatterns(flows) {
    const patterns = {};

    for (const flow of flows) {
      const signature = flow.layers.join(' -> ');
      if (!patterns[signature]) {
        patterns[signature] = {
          pattern: signature,
          count: 0,
          examples: []
        };
      }

      patterns[signature].count++;
      if (patterns[signature].examples.length < 3) {
        patterns[signature].examples.push(flow.entryPoint);
      }
    }

    return Object.values(patterns)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Find isolated endpoints (routes with no dependencies)
   */
  findIsolatedEndpoints(flows) {
    return flows
      .filter(f => f.depth === 1)
      .map(f => f.entryPoint)
      .slice(0, 20);
  }

  /**
   * Phase 6 - Task 6-4: Update Issues Map with Architecture Violations
   * Detects layer violations, upward dependencies, and circular issues
   */
  async updateIssuesWithArchitectureViolations() {
    console.log('Detecting architecture violations...');

    // Ensure we have architecture and dependency data
    if (!this.architectureData) {
      this.architectureData = this.architectureDetector.detectArchitecture(this.scanResults.files);
    }

    if (!this.dependencyData) {
      await this.generateForwardDependencies();
    }

    // Detect violations
    const violations = this.architectureDetector.detectViolations(
      this.architectureData,
      this.dependencyData,
      this.scanResults.files
    );

    // Read existing issues map
    const issuesPath = path.join(this.outputDir, 'issues.json');
    let issuesData;

    try {
      const issuesContent = await compression.loadAndDecompress(issuesPath);
      issuesData = issuesContent;
    } catch (error) {
      // If issues.json doesn't exist, create a new structure
      issuesData = {
        version: '1.0.0',
        projectHash: this.projectHash,
        generated: new Date().toISOString(),
        mapType: 'issues',
        summary: {},
        issues: {}
      };
    }

    // Add architecture violations to issues
    issuesData.issues.architectureViolations = violations;
    issuesData.summary.architectureViolations = violations.length;
    issuesData.summary.totalIssues = (issuesData.summary.totalIssues || 0) + violations.length;

    // Update architecture section
    issuesData.architecture = {
      pattern: this.architectureData.primaryPattern.name,
      confidence: this.architectureData.confidence,
      violationCount: violations.length,
      violationsByType: {
        'upward-dependency': violations.filter(v => v.type === 'upward-dependency').length
      }
    };

    // Save updated issues map
    const metadata = await compression.compressAndSave(issuesData, issuesPath, { forceAbbreviation: false });

    console.log(`✓ Updated issues.json with architecture violations (${violations.length} violations found)`);

    return { file: issuesPath, metadata, violations };
  }

  /**
   * Phase 6 - Task 6-5: Extract API Endpoints (updates quick-queries.json)
   * Parses route files to extract HTTP methods, paths, and handlers
   */
  async extractAPIEndpoints() {
    console.log('Extracting API endpoints...');

    const endpoints = [];

    // Find route files
    const routeFiles = this.scanResults.files.filter(f => {
      const relativePath = f.relativePath || f.path;
      const fileName = path.basename(f.path || f.relativePath);

      return (
        relativePath.includes('/routes/') ||
        relativePath.includes('/router/') ||
        fileName.includes('route') ||
        fileName.includes('router') ||
        relativePath.includes('/api/')
      );
    });

    // Parse each route file
    for (const file of routeFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        const fileEndpoints = await this.architectureDetector.parseRouteFile(
          file.relativePath || file.path,
          content
        );

        endpoints.push(...fileEndpoints);
      } catch (error) {
        // Skip files that can't be read or parsed
        continue;
      }
    }

    // Group by method
    const byMethod = {};
    for (const endpoint of endpoints) {
      if (!byMethod[endpoint.method]) {
        byMethod[endpoint.method] = [];
      }
      byMethod[endpoint.method].push(endpoint);
    }

    // Categorize by path pattern
    const byCategory = {
      auth: endpoints.filter(e => e.path.includes('auth') || e.path.includes('login') || e.path.includes('register')),
      users: endpoints.filter(e => e.path.includes('user')),
      admin: endpoints.filter(e => e.path.includes('admin')),
      api: endpoints.filter(e => e.path.includes('/api/')),
      other: []
    };

    return {
      endpoints,
      byMethod,
      byCategory,
      statistics: {
        total: endpoints.length,
        byMethod: Object.fromEntries(
          Object.entries(byMethod).map(([method, eps]) => [method, eps.length])
        ),
        routeFiles: routeFiles.length
      }
    };
  }

  async generateDatabaseSchema() {
    console.log('Detecting database technologies...');
  
    // Task 7-1: Detect ORM and database files
    this.dbDetectionResults = await this.dbDetector.detect(this.scanResults.files);
  
    const { orms, schemaFiles, migrationDirs, modelFiles, primary } = this.dbDetectionResults;
  
    console.log(`Detected ${orms.length} database technologies (primary: ${primary || 'none'})`);
  
    // Task 7-2 & 7-3: Extract table schemas and relationships
    const tables = await this.extractTableSchemas();
  
    const databaseSchema = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'database-schema',
  
      detection: {
        orms: orms.map(orm => ({
          name: orm.name,
          confidence: orm.confidence,
          evidenceCount: orm.evidence.length
        })),
        primaryORM: primary,
        summary: this.dbDetector.getSummary()
      },
  
      schemaFiles: schemaFiles.map(f => ({
        path: f.path,
        type: f.type,
        orm: f.orm
      })),
  
      migrationDirectories: migrationDirs.map(dir => ({
        path: dir.path,
        fileCount: dir.fileCount
      })),
  
      modelFiles: modelFiles.map(f => ({
        path: f.path,
        name: f.name
      })),
  
      tables: tables,
  
      statistics: {
        totalTables: tables.length,
        totalColumns: tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0),
        totalRelationships: tables.reduce((sum, t) => sum + (t.relationships?.length || 0), 0),
        totalIndexes: tables.reduce((sum, t) => sum + (t.indexes?.length || 0), 0),
        tablesWithPrimaryKey: tables.filter(t => t.primaryKey).length,
        tablesWithRelationships: tables.filter(t => t.relationships?.length > 0).length
      }
    };
  
    const outputPath = path.join(this.outputDir, 'database-schema.json');
    const metadata = await compression.compressAndSave(databaseSchema, outputPath);
  
    console.log(`✓ Generated database-schema.json (${metadata.compressedSize} bytes, ${databaseSchema.tables.length} tables)`);
  
    return { file: outputPath, metadata };
  }
  
  /**
   * Task 7-2 & 7-3: Extract table schemas from model files
   * Parses model definitions to extract columns, types, constraints, relationships
   */
  async extractTableSchemas() {
    const tables = [];
    const { modelFiles, primary } = this.dbDetectionResults;
  
    for (const modelFile of modelFiles) {
      try {
        const fullPath = path.join(this.projectRoot, modelFile.path);
        const content = await fs.readFile(fullPath, 'utf8');
  
        // Extract table schema based on ORM type
        let tableSchema = null;
  
        if (primary === 'Prisma' && modelFile.path.endsWith('.prisma')) {
          tableSchema = this.parsePrismaSchema(content, modelFile);
        } else if (primary === 'Sequelize' || content.includes('sequelize')) {
          tableSchema = this.parseSequelizeModel(content, modelFile);
        } else if (primary === 'TypeORM' || content.includes('typeorm') || content.includes('@Entity')) {
          tableSchema = this.parseTypeORMEntity(content, modelFile);
        } else if (primary === 'Mongoose' || content.includes('mongoose')) {
          tableSchema = this.parseMongooseSchema(content, modelFile);
        } else if (primary === 'Django ORM' && modelFile.path.endsWith('.py')) {
          tableSchema = this.parseDjangoModel(content, modelFile);
        } else if (primary === 'SQLAlchemy' && modelFile.path.endsWith('.py')) {
          tableSchema = this.parseSQLAlchemyModel(content, modelFile);
        } else if (primary === 'ActiveRecord' && modelFile.path.endsWith('.rb')) {
          tableSchema = this.parseActiveRecordModel(content, modelFile);
        }
  
        if (tableSchema) {
          if (Array.isArray(tableSchema)) {
            tables.push(...tableSchema);
          } else {
            tables.push(tableSchema);
          }
        }
  
      } catch (error) {
        // Skip files that fail to parse
        continue;
      }
    }
  
    return tables;
  }
  
  /**
   * Parse Prisma schema file
   */
  parsePrismaSchema(content, modelFile) {
    const tables = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
  
    while ((match = modelRegex.exec(content)) !== null) {
      const [, modelName, body] = match;
      const table = {
        name: modelName,
        tableName: this.toSnakeCase(modelName),
        source: modelFile.path,
        orm: 'Prisma',
        columns: [],
        relationships: [],
        indexes: [],
        primaryKey: null
      };
  
      // Parse fields
      const fieldRegex = /(\w+)\s+(\w+)(\??|\[\])?(?:\s+@(.+))?/g;
      let fieldMatch;
  
      while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const [, fieldName, fieldType, modifier, decorators] = fieldMatch;
  
        const column = {
          name: fieldName,
          type: fieldType,
          nullable: modifier === '?',
          isArray: modifier === '[]',
          isPrimary: decorators?.includes('@id'),
          isUnique: decorators?.includes('@unique'),
          hasDefault: decorators?.includes('@default')
        };
  
        table.columns.push(column);
  
        if (column.isPrimary) {
          table.primaryKey = fieldName;
        }
  
        // Detect relationships
        if (!this.isPrimitiveType(fieldType)) {
          const relationType = modifier === '[]' ? 'hasMany' : 'hasOne';
          table.relationships.push({
            type: relationType,
            targetTable: fieldType,
            foreignKey: fieldName
          });
        }
  
        // Extract indexes from decorators
        if (decorators?.includes('@index')) {
          table.indexes.push({
            columns: [fieldName],
            type: 'index'
          });
        }
      }
  
      // Parse model-level indexes
      const indexRegex = /@@index\(\[([^\]]+)\]/g;
      let indexMatch;
      while ((indexMatch = indexRegex.exec(body)) !== null) {
        const columns = indexMatch[1].split(',').map(c => c.trim());
        table.indexes.push({
          columns,
          type: 'compound-index'
        });
      }
  
      tables.push(table);
    }
  
    return tables;
  }
  
  /**
   * Parse Sequelize model
   */
  parseSequelizeModel(content, modelFile) {
    const table = {
      name: path.basename(modelFile.name, path.extname(modelFile.name)),
      tableName: null,
      source: modelFile.path,
      orm: 'Sequelize',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };
  
    // Extract table name from sequelize.define
    const defineMatch = content.match(/sequelize\.define\(['"](\w+)['"]/i);
    if (defineMatch) {
      table.tableName = defineMatch[1];
    }
  
    // Extract columns from define second argument
    const defineBodyMatch = content.match(/sequelize\.define\([^,]+,\s*\{([^}]+)\}/s);
    if (defineBodyMatch) {
      const body = defineBodyMatch[1];
  
      // Parse field definitions
      const fieldRegex = /(\w+):\s*\{[^}]*type:\s*DataTypes\.(\w+)/g;
      let fieldMatch;
  
      while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const [, fieldName, fieldType] = fieldMatch;
  
        table.columns.push({
          name: fieldName,
          type: fieldType,
          nullable: !body.includes(`${fieldName}:`) || !body.includes('allowNull: false')
        });
      }
    }
  
    // Extract associations
    if (content.includes('hasMany')) {
      const hasManyRegex = /hasMany\(models\.(\w+)/g;
      let match;
      while ((match = hasManyRegex.exec(content)) !== null) {
        table.relationships.push({
          type: 'hasMany',
          targetTable: match[1],
          foreignKey: null
        });
      }
    }
  
    if (content.includes('belongsTo')) {
      const belongsToRegex = /belongsTo\(models\.(\w+)/g;
      let match;
      while ((match = belongsToRegex.exec(content)) !== null) {
        table.relationships.push({
          type: 'belongsTo',
          targetTable: match[1],
          foreignKey: null
        });
      }
    }
  
    return table.columns.length > 0 ? table : null;
  }
  
  /**
   * Parse TypeORM entity
   */
  parseTypeORMEntity(content, modelFile) {
    const entityMatch = content.match(/@Entity\(['"]?(\w+)?['"]?\)\s*(?:export\s+)?class\s+(\w+)/);
    if (!entityMatch) return null;
  
    const [, tableName, className] = entityMatch;
    const table = {
      name: className,
      tableName: tableName || this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'TypeORM',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: null
    };
  
    // Extract columns
    const columnRegex = /@Column\(([^)]*)\)\s+(\w+):\s*(\w+)/g;
    let match;
  
    while ((match = columnRegex.exec(content)) !== null) {
      const [, options, fieldName, fieldType] = match;
  
      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: options.includes('nullable: true')
      });
    }
  
    // Extract primary key
    const pkMatch = content.match(/@PrimaryGeneratedColumn\(\)\s+(\w+):/);
    if (pkMatch) {
      table.primaryKey = pkMatch[1];
      table.columns.push({
        name: pkMatch[1],
        type: 'number',
        isPrimary: true,
        nullable: false
      });
    }
  
    // Extract relationships
    const relationRegex = /@(OneToMany|ManyToOne|OneToOne|ManyToMany)\(\(\)\s*=>\s*(\w+)/g;
    let relMatch;
  
    while ((relMatch = relationRegex.exec(content)) !== null) {
      const [, relationType, targetEntity] = relMatch;
  
      table.relationships.push({
        type: relationType,
        targetTable: targetEntity,
        foreignKey: null
      });
    }
  
    // Extract indexes
    const indexRegex = /@Index\(\[['"](\w+)['"]\]\)/g;
    let indexMatch;
  
    while ((indexMatch = indexRegex.exec(content)) !== null) {
      table.indexes.push({
        columns: [indexMatch[1]],
        type: 'index'
      });
    }
  
    return table;
  }
  
  /**
   * Parse Mongoose schema
   */
  parseMongooseSchema(content, modelFile) {
    const schemaMatch = content.match(/new\s+(?:mongoose\.)?Schema\(\{([^}]+)\}/s);
    if (!schemaMatch) return null;
  
    const modelNameMatch = content.match(/model\(['"](\w+)['"]/);
    const modelName = modelNameMatch ? modelNameMatch[1] : path.basename(modelFile.name, path.extname(modelFile.name));
  
    const table = {
      name: modelName,
      tableName: modelName.toLowerCase(),
      source: modelFile.path,
      orm: 'Mongoose',
      database: 'MongoDB',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: '_id'
    };
  
    const body = schemaMatch[1];
  
    // Parse fields
    const fieldRegex = /(\w+):\s*\{[^}]*type:\s*(\w+)/g;
    let fieldMatch;
  
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const [, fieldName, fieldType] = fieldMatch;
  
      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: true
      });
    }
  
    // Extract references (relationships)
    const refRegex = /(\w+):\s*\{[^}]*ref:\s*['"](\w+)['"]/g;
    let refMatch;
  
    while ((refMatch = refRegex.exec(body)) !== null) {
      table.relationships.push({
        type: 'ref',
        targetTable: refMatch[2],
        foreignKey: refMatch[1]
      });
    }
  
    return table;
  }
  
  /**
   * Parse Django model
   */
  parseDjangoModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\(models\.Model\)/);
    if (!classMatch) return null;
  
    const className = classMatch[1];
    const table = {
      name: className,
      tableName: this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'Django ORM',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };
  
    // Extract fields
    const fieldRegex = /(\w+)\s*=\s*models\.(\w+Field)/g;
    let match;
  
    while ((match = fieldRegex.exec(content)) !== null) {
      const [, fieldName, fieldType] = match;
  
      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: false
      });
    }
  
    // Extract foreign keys
    const fkRegex = /(\w+)\s*=\s*models\.ForeignKey\(['"]?(\w+)['"]?/g;
    let fkMatch;
  
    while ((fkMatch = fkRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'ForeignKey',
        targetTable: fkMatch[2],
        foreignKey: fkMatch[1]
      });
    }
  
    return table;
  }
  
  /**
   * Parse SQLAlchemy model
   */
  parseSQLAlchemyModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\(.*Base.*\)/);
    if (!classMatch) return null;
  
    const className = classMatch[1];
    const tableNameMatch = content.match(/__tablename__\s*=\s*['"](\w+)['"]/);
  
    const table = {
      name: className,
      tableName: tableNameMatch ? tableNameMatch[1] : this.toSnakeCase(className),
      source: modelFile.path,
      orm: 'SQLAlchemy',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };
  
    // Extract columns
    const columnRegex = /(\w+)\s*=\s*Column\((\w+)/g;
    let match;
  
    while ((match = columnRegex.exec(content)) !== null) {
      const [, fieldName, fieldType] = match;
  
      table.columns.push({
        name: fieldName,
        type: fieldType,
        nullable: false
      });
    }
  
    // Extract relationships
    const relRegex = /(\w+)\s*=\s*relationship\(['"](\w+)['"]/g;
    let relMatch;
  
    while ((relMatch = relRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'relationship',
        targetTable: relMatch[2],
        foreignKey: relMatch[1]
      });
    }
  
    return table;
  }
  
  /**
   * Parse ActiveRecord model (Rails)
   */
  parseActiveRecordModel(content, modelFile) {
    const classMatch = content.match(/class\s+(\w+)\s*<\s*ApplicationRecord/);
    if (!classMatch) return null;
  
    const className = classMatch[1];
    const table = {
      name: className,
      tableName: this.toSnakeCase(className) + 's',
      source: modelFile.path,
      orm: 'ActiveRecord',
      columns: [],
      relationships: [],
      indexes: [],
      primaryKey: 'id'
    };
  
    // Extract associations
    const hasManyRegex = /has_many\s+:(\w+)/g;
    let match;
  
    while ((match = hasManyRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'has_many',
        targetTable: match[1],
        foreignKey: null
      });
    }
  
    const belongsToRegex = /belongs_to\s+:(\w+)/g;
    while ((match = belongsToRegex.exec(content)) !== null) {
      table.relationships.push({
        type: 'belongs_to',
        targetTable: match[1],
        foreignKey: `${match[1]}_id`
      });
    }
  
    return table;
  }
  
  /**
   * Task 7-4: Generate table-to-module mapping
   * Shows which modules use which tables
   */
  async generateTableModuleMapping() {
    console.log('Generating table-to-module mapping...');
  
    // Load modules data to get tablesUsed from Phase 4
    const modulesPath = path.join(this.outputDir, 'modules.json');
    let modulesData = null;
  
    try {
      modulesData = await compression.loadAndDecompress(modulesPath);
    } catch (error) {
      console.log('⚠ modules.json not found, skipping table-to-module mapping');
      return null;
    }
  
    // Build table-to-modules mapping
    const tablesToModules = {};
    const modulesToTables = {};
  
    for (const [moduleName, moduleData] of Object.entries(modulesData.modules)) {
      if (moduleData.tablesUsed && moduleData.tablesUsed.length > 0) {
        modulesToTables[moduleName] = moduleData.tablesUsed;
  
        for (const tableName of moduleData.tablesUsed) {
          if (!tablesToModules[tableName]) {
            tablesToModules[tableName] = [];
          }
          tablesToModules[tableName].push(moduleName);
        }
      }
    }
  
    const mapping = {
      version: '1.0.0',
      projectHash: this.projectHash,
      generated: new Date().toISOString(),
      mapType: 'table-module-mapping',
  
      tablesToModules: tablesToModules,
      modulesToTables: modulesToTables,
  
      statistics: {
        totalTables: Object.keys(tablesToModules).length,
        totalModules: Object.keys(modulesToTables).length,
        averageTablesPerModule: Object.keys(modulesToTables).length > 0
          ? (Object.values(modulesToTables).reduce((sum, tables) => sum + tables.length, 0) / Object.keys(modulesToTables).length).toFixed(2)
          : 0,
        averageModulesPerTable: Object.keys(tablesToModules).length > 0
          ? (Object.values(tablesToModules).reduce((sum, modules) => sum + modules.length, 0) / Object.keys(tablesToModules).length).toFixed(2)
          : 0,
        sharedTables: Object.values(tablesToModules).filter(modules => modules.length > 1).length
      }
    };
  
    const outputPath = path.join(this.outputDir, 'table-module-mapping.json');
    const metadata = await compression.compressAndSave(mapping, outputPath);
  
    console.log(`✓ Generated table-module-mapping.json (${metadata.compressedSize} bytes, ${mapping.statistics.totalTables} tables)`);
  
    return { file: outputPath, metadata };
  }
  
  /**
   * Helper: Check if type is a primitive Prisma type
   */
  isPrimitiveType(type) {
    const primitiveTypes = [
      'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
      'DateTime', 'Json', 'Bytes'
    ];
    return primitiveTypes.includes(type);
  }
  
  /**
   * Helper: Convert PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
  
}

module.exports = MapGenerator;

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help')) {
    console.log('Project Maps Generator');
    console.log('\nUsage: node map-generator.js <project-path>');
    console.log('\nOptions:');
    console.log('  --help     Show this help message');
    console.log('\nExample:');
    console.log('  node map-generator.js .');
    console.log('  node map-generator.js /path/to/project');
    process.exit(0);
  }

  const projectPath = path.resolve(args[0]);

  (async () => {
    try {
      console.log('Project Maps Generator\n');
      console.log(`Project: ${projectPath}`);

      const generator = new MapGenerator(projectPath);
      console.log(`Project hash: ${generator.projectHash}`);
      console.log(`Output directory: ${generator.outputDir}\n`);

      const result = await generator.generateAll();

      console.log(`\n✓ Maps generated successfully!\n`);
      console.log('Summary:');
      console.log(`  Files scanned: ${result.files}`);
      console.log(`  Maps created: 11`);
      console.log(`  Storage location: ${result.outputDir}`);
      console.log(`  Scan time: ${result.stats.scanTime}ms\n`);

    } catch (error) {
      console.error('\n❌ Generation failed:', error.message);
      if (error.stack && process.env.DEBUG) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
}
