/**
 * Project Maps Command - Unified CLI for project context maps
 *
 * Subcommands:
 *   generate [path]           Generate maps for project
 *   load [--tier N] [--map name]   Load and display maps
 *   refresh [--full|--incremental] Refresh maps
 *   list                      List all mapped projects
 *   query <type>              Query project info
 *   stats                     Show compression stats
 */

const path = require('path');
const fs = require('fs').promises;
const MapGenerator = require('../map-generator');
const MapLoader = require('../map-loader');
const RefreshCLI = require('../refresh-cli');
const StalenessChecker = require('../staleness-checker');
const compression = require('../compression');
const IntentRouter = require('../intent-router');
const { SearchAPI } = require('../search-api');
const { OutputFormatter, formatForClaude } = require('../output-formatter');
const { MapPaths, getLegacyBaseDir } = require('../map-paths');
const { PostgresIntrospector, getErrorSuggestion } = require('../db-introspector');

/**
 * Parse command arguments
 */
function parseArgs(args) {
  const result = {
    subcommand: args[0] || 'help',
    projectPath: process.cwd(),
    options: {}
  };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--tier' && args[i + 1]) {
      result.options.tier = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--map' && args[i + 1]) {
      result.options.map = args[i + 1];
      i++;
    } else if (arg === '--full') {
      result.options.mode = 'full';
    } else if (arg === '--incremental') {
      result.options.mode = 'incremental';
    } else if (arg === '--json') {
      result.options.json = true;
    } else if (arg === '--format' && args[i + 1]) {
      result.options.format = args[i + 1]; // 'claude', 'raw', 'json'
      i++;
    } else if (arg === '--annotate') {
      result.options.annotate = true;
    } else if (arg === '--verbose') {
      result.options.verbose = true;
    } else if (arg === '--formatted') {
      result.options.formatted = true;
    } else if (arg === '--delete-old') {
      result.options.deleteOld = true;
    } else if (arg === '--path' && args[i + 1]) {
      result.projectPath = path.resolve(args[i + 1]);
      i++;
    } else if (!arg.startsWith('--') && i === 1 && !['query', 'ask', 'search', 'deps', 'stack'].includes(result.subcommand)) {
      // First non-option argument after subcommand could be path (except for query/ask/search/deps/stack)
      result.projectPath = path.resolve(arg);
    } else if (!arg.startsWith('--') && result.subcommand === 'query') {
      // For query command, argument is the query type
      result.options.queryType = arg;
    } else if (result.subcommand === 'ask' && !arg.startsWith('--')) {
      // For ask command, collect remaining args as the question
      // BUT check if the LAST arg looks like a path (starts with / or . or is an existing directory)
      if (!result.options.question) {
        const remainingArgs = args.slice(i);
        const lastArg = remainingArgs[remainingArgs.length - 1];

        // Check if last arg looks like a path
        const looksLikePath = lastArg && (
          lastArg.startsWith('/') ||
          lastArg.startsWith('./') ||
          lastArg.startsWith('../') ||
          lastArg.includes('/') && !lastArg.includes(' ')
        );

        if (looksLikePath && remainingArgs.length > 1) {
          // Last arg is path, rest is question
          result.projectPath = path.resolve(lastArg);
          result.options.question = remainingArgs.slice(0, -1).join(' ');
        } else {
          // All remaining args are the question
          result.options.question = remainingArgs.join(' ');
        }
        break; // Stop processing
      }
    }
  }

  return result;
}

/**
 * Generate maps for a project
 */
async function generateCommand(projectPath, options) {
  const generator = new MapGenerator(projectPath);

  console.log('Project Maps Generator\n');
  console.log(`Project: ${projectPath}`);
  console.log(`Project hash: ${generator.projectHash}`);
  console.log(`Output directory: ${generator.outputDir}\n`);

  const result = await generator.generateAll();

  return {
    success: true,
    projectPath,
    projectHash: generator.projectHash,
    outputDir: generator.outputDir,
    filesScanned: result.files,
    mapsCreated: 11,
    scanTime: result.stats.scanTime
  };
}

/**
 * Load maps for a project
 */
async function loadCommand(projectPath, options) {
  const loader = new MapLoader(projectPath, { verbose: true });

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  let maps;
  if (options.map) {
    maps = await loader.load(options.map);
    return {
      success: true,
      type: 'single',
      mapName: options.map,
      data: maps
    };
  } else if (options.tier) {
    maps = await loader.loadTier(options.tier);
    return {
      success: true,
      type: 'tier',
      tier: options.tier,
      mapsLoaded: Object.keys(maps).length,
      data: maps
    };
  } else {
    // Default: load tier 1
    maps = await loader.loadTier(1);
    return {
      success: true,
      type: 'tier',
      tier: 1,
      mapsLoaded: Object.keys(maps).length,
      data: maps
    };
  }
}

/**
 * Refresh maps for a project
 */
async function refreshCommand(projectPath, options) {
  const loader = new MapLoader(projectPath);

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  const mode = options.mode || 'auto';

  if (mode === 'full') {
    // Full regeneration
    const generator = new MapGenerator(projectPath);
    const result = await generator.generateAll();
    return {
      success: true,
      mode: 'full',
      filesScanned: result.files,
      mapsUpdated: 11
    };
  } else {
    // Incremental or auto
    const refresher = new RefreshCLI();
    refresher.projectRoot = projectPath;
    refresher.mode = mode;
    refresher.verbose = options.verbose || false;

    // Run refresh
    await refresher.run();

    return {
      success: true,
      mode: mode
    };
  }
}

/**
 * Format relative time for project maps
 */
function projectRelativeTime(dateStr) {
  if (!dateStr || dateStr === 'Unknown') return 'unknown';

  const parsed = new Date(dateStr);
  const now = Date.now();
  const then = parsed.getTime();
  if (isNaN(then)) return 'unknown';

  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Format project list for display
 */
function formatProjectList(projects) {
  if (projects.length === 0) {
    return `📁 **No project maps found**

No projects have been mapped yet.

**Get started:**
\`/session:project-maps-generate\` - Generate maps for current project`;
  }

  let out = `📁 **Project Maps (${projects.length} projects)**\n\n`;

  projects.forEach((p, i) => {
    const staleBadge = p.staleness?.score > 60 ? ' 🔄 STALE' : '';
    const name = p.name || path.basename(p.path) || 'Unknown';

    out += `**${i + 1}. ${name}**${staleBadge}\n`;
    out += `   📂 ${p.path}\n`;
    out += `   📊 ${p.files} files | Generated: ${projectRelativeTime(p.generated)}\n`;
    if (p.staleness?.score > 0) {
      out += `   ⚡ Staleness: ${p.staleness.score}/100\n`;
    }
    out += '\n';
  });

  // Show stale projects warning
  const staleProjects = projects.filter(p => p.staleness?.score > 60);
  if (staleProjects.length > 0) {
    out += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `⚠️ **${staleProjects.length} project(s) need refresh**\n`;
    out += `💡 \`/session:project-maps-refresh --full\` to update\n`;
  }

  return out;
}

/**
 * List all projects with maps
 * Scans both project-local (.claude/project-maps/) and legacy global (~/.claude/project-maps/)
 */
async function listCommand(options) {
  const legacyBaseDir = getLegacyBaseDir();
  const formatted = options.formatted;
  const projects = [];
  const seenPaths = new Set(); // Avoid duplicates

  // Helper to load project info from a summary file
  async function loadProjectInfo(summaryPath, source, hash = null) {
    try {
      const summary = await compression.loadAndDecompress(summaryPath);
      const projectPath = summary.projectPath || summary.project?.path || 'Unknown';

      // Skip if we've already seen this project path
      if (seenPaths.has(projectPath)) return null;
      seenPaths.add(projectPath);

      return {
        hash: hash || 'local',
        name: summary.projectName || summary.project?.name || 'Unknown',
        path: projectPath,
        files: summary.statistics?.totalFiles || 0,
        generated: summary.staleness?.lastRefresh || summary.generated || 'Unknown',
        staleness: summary.staleness || null,
        storage: source // 'project-local' or 'legacy-global'
      };
    } catch (error) {
      return {
        hash: hash || 'local',
        name: 'Unknown',
        path: 'Unknown',
        error: error.message,
        storage: source
      };
    }
  }

  try {
    // 1. Check current project's local maps first
    const currentProjectPath = options.projectPath || process.cwd();
    const currentMapPaths = new MapPaths(currentProjectPath);
    const currentLocalPath = path.join(currentProjectPath, '.claude', 'project-maps', 'summary.json');

    try {
      await fs.access(currentLocalPath);
      const projectInfo = await loadProjectInfo(currentLocalPath, 'project-local');
      if (projectInfo) {
        projectInfo.current = true; // Mark as current project
        projects.push(projectInfo);
      }
    } catch {
      // No local maps for current project
    }

    // 2. Scan legacy global directory for other projects
    try {
      const entries = await fs.readdir(legacyBaseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (['maps', 'schemas', 'temp'].includes(entry.name)) continue;

        const projectHash = entry.name;
        const summaryPath = path.join(legacyBaseDir, projectHash, 'summary.json');

        const projectInfo = await loadProjectInfo(summaryPath, 'legacy-global', projectHash);
        if (projectInfo) {
          projects.push(projectInfo);
        }
      }
    } catch {
      // Legacy directory doesn't exist or can't be read
    }

    // Return pre-formatted output if requested
    if (formatted) {
      return { formatted: formatProjectList(projects) };
    }

    return {
      success: true,
      count: projects.length,
      projects,
      note: projects.some(p => p.storage === 'legacy-global')
        ? 'Some projects use legacy global storage. Run /project-maps migrate to move them.'
        : null
    };
  } catch (error) {
    if (formatted) {
      return { formatted: formatProjectList([]) };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Query project info
 */
async function queryCommand(projectPath, options) {
  const loader = new MapLoader(projectPath);

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  const queryType = options.queryType || 'summary';

  // Load quick-queries map for fast answers
  const quickQueries = await loader.load('quick-queries');

  // Define query handlers - both quick queries and map-based queries
  const queryMap = {
    // Quick queries (from quick-queries.json)
    'entry-points': () => ({
      primary: quickQueries.entryPoint,
      all: quickQueries.allEntryPoints
    }),
    'framework': () => quickQueries.framework,
    'tests': () => ({
      framework: quickQueries.testingFramework,
      location: quickQueries.testLocation
    }),
    'largest': () => quickQueries.largestFiles,
    'recent': () => quickQueries.recentlyModified || quickQueries.recentFiles,
    'structure': () => quickQueries.topLevelStructure,
    'languages': () => quickQueries.primaryLanguages,
    'summary': () => quickQueries,

    // Extended queries (from dedicated map files)
    'backend-layers': async () => {
      const map = await loader.load('backend-layers');
      const behaviorAnalysis = map.behaviorAnalysis;

      return {
        // Traditional folder-based detection
        architecture: map.architecture,
        layers: Object.keys(map.layers || {}).map(layer => ({
          name: layer,
          files: (map.layers[layer] || []).length
        })),
        statistics: map.statistics,

        // Behavior-based analysis (more accurate for BaaS, serverless, etc.)
        behaviorAnalysis: behaviorAnalysis ? {
          type: behaviorAnalysis.architecture?.type,
          confidence: behaviorAnalysis.architecture?.confidence,
          description: behaviorAnalysis.architecture?.description,
          evidence: behaviorAnalysis.architecture?.evidence,
          gateways: behaviorAnalysis.gateways,
          apiSpec: behaviorAnalysis.apiSpec,
          formatted: behaviorAnalysis.formatted
        } : null
      };
    },
    'modules': async () => {
      const map = await loader.load('modules');
      return {
        totalModules: map.summary?.totalModules || 0,
        modules: Object.keys(map.modules || {}).map(name => ({
          name,
          fileCount: map.modules[name]?.stats?.fileCount || 0,
          detectionMethod: map.modules[name]?.detectionMethod
        }))
      };
    },
    'module-deps': async () => {
      const map = await loader.load('module-dependencies');
      return {
        summary: map.summary,
        dependencies: map.dependencies
      };
    },
    'components': async () => {
      const map = await loader.load('frontend-components');
      return {
        framework: map.framework,
        patterns: map.componentPatterns,
        statistics: map.statistics,
        components: Object.keys(map.components || {}).map(path => ({
          name: map.components[path]?.name,
          path,
          layer: map.components[path]?.layer,
          reusable: map.components[path]?.reusable
        }))
      };
    },
    'component-meta': async () => {
      const map = await loader.load('component-metadata');
      return {
        framework: map.framework,
        coverage: map.coverage,
        metadata: Object.keys(map.metadata || {}).map(path => ({
          name: map.metadata[path]?.name,
          path,
          hooks: map.metadata[path]?.hooks || [],
          state: map.metadata[path]?.state || [],
          exports: map.metadata[path]?.exports || []
        }))
      };
    },
    'database': async () => {
      const map = await loader.load('database-schema');
      return {
        detection: map.detection?.summary,
        tables: map.tables || [],
        statistics: map.statistics
      };
    },
    'data-flow': async () => {
      const map = await loader.load('data-flow');
      return {
        architecture: map.architecture,
        flows: map.flows || [],
        statistics: map.statistics,
        patterns: map.patterns
      };
    },
    'table-mapping': async () => {
      const map = await loader.load('table-module-mapping');
      return {
        tablesToModules: map.tablesToModules || {},
        modulesToTables: map.modulesToTables || {},
        statistics: map.statistics
      };
    },
    // Additional tier 3 maps
    'dependencies': async () => {
      const forward = await loader.load('dependencies-forward');
      const reverse = await loader.load('dependencies-reverse');
      return {
        forward: {
          totalFiles: Object.keys(forward.dependencies || {}).length,
          sample: Object.entries(forward.dependencies || {}).slice(0, 10)
        },
        reverse: {
          totalFiles: Object.keys(reverse.dependencies || {}).length,
          sample: Object.entries(reverse.dependencies || {}).slice(0, 10)
        }
      };
    },
    'issues': async () => {
      const map = await loader.load('issues');
      // Handle both old format (sum) and new format (summary)
      const summary = map.sum || map.summary || {};
      const issues = map.issues || {};
      return {
        summary: {
          brokenImports: summary.brokenImports || 0,
          circularDependencies: summary.circularDependencies || 0,
          unusedFiles: summary.unusedFiles || 0,
          totalIssues: summary.totalIssues || 0
        },
        brokenImports: (issues.brokenImports || []).slice(0, 10),
        unusedFiles: (issues.unusedFiles || []).slice(0, 10),
        circularDependencies: issues.circularDependencies || []
      };
    },
    'relationships': async () => {
      const map = await loader.load('relationships');
      return {
        totalRelationships: Object.keys(map.relationships || {}).length,
        sample: Object.entries(map.relationships || {}).slice(0, 10)
      };
    },
    // NPM dependencies queries
    'npm-deps': async () => {
      const map = await loader.load('npm-dependencies');
      return {
        stack: map.stack,
        summary: map.summary,
        packages: Object.entries(map.packages || {}).map(([name, info]) => ({
          name,
          version: info.v || info.version,
          type: info.t || info.type,
          usedIn: info.u || info.usedIn || 0
        }))
      };
    },
    'stack': async () => {
      const map = await loader.load('npm-dependencies');
      return {
        stack: map.stack,
        summary: {
          totalPackages: map.summary?.totalPackages || 0,
          production: map.summary?.production || 0,
          development: map.summary?.development || 0,
          peer: map.summary?.peer || 0
        }
      };
    }
  };

  const handler = queryMap[queryType];
  if (!handler) {
    return {
      success: false,
      error: `Unknown query type: ${queryType}`,
      availableTypes: Object.keys(queryMap)
    };
  }

  // Handle both sync and async handlers
  const result = await Promise.resolve(handler());

  return {
    success: true,
    queryType,
    result
  };
}

/**
 * Show stats for project maps
 */
async function statsCommand(projectPath, options) {
  const loader = new MapLoader(projectPath);

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  const mapsDir = loader.getMapsDirectory();
  const mapFiles = [
    'summary.json', 'tree.json', 'metadata.json', 'content-summaries.json',
    'indices.json', 'existence-proofs.json', 'quick-queries.json',
    'dependencies-forward.json', 'dependencies-reverse.json',
    'relationships.json', 'issues.json'
  ];

  const stats = {
    totalOriginal: 0,
    totalCompressed: 0,
    maps: []
  };

  for (const mapFile of mapFiles) {
    try {
      const filePath = path.join(mapsDir, mapFile);
      const fileStats = await fs.stat(filePath);
      const compressedSize = fileStats.size;

      // Load and decompress to get original size
      const decompressed = await compression.loadAndDecompress(filePath);
      const originalSize = JSON.stringify(decompressed).length;

      stats.maps.push({
        name: mapFile,
        original: originalSize,
        compressed: compressedSize,
        ratio: ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%'
      });

      stats.totalOriginal += originalSize;
      stats.totalCompressed += compressedSize;
    } catch (error) {
      // Skip missing maps
    }
  }

  stats.totalRatio = ((1 - stats.totalCompressed / stats.totalOriginal) * 100).toFixed(1) + '%';

  return {
    success: true,
    projectHash: loader.getProjectHash(),
    mapsDirectory: mapsDir,
    stats
  };
}

/**
 * Ask a natural language question about the project
 */
async function askCommand(projectPath, options) {
  const question = options.question;

  if (!question) {
    return {
      success: false,
      error: 'No question provided',
      usage: 'session-cli project-maps ask "your question here"',
      examples: [
        'session-cli project-maps ask "what framework is this project using?"',
        'session-cli project-maps ask "what would break if I change auth.js?"',
        'session-cli project-maps ask "where are the tests?"',
        'session-cli project-maps ask "show me the largest files"',
        'session-cli project-maps ask "what modules does this project have?"'
      ]
    };
  }

  const router = new IntentRouter(projectPath);
  const result = await router.executeIntent(question);

  return result;
}

/**
 * Search across project maps
 */
async function searchCommand(projectPath, options, args) {
  // Parse search arguments: search <type> <pattern> [path] [--flags]
  const searchArgs = args.slice(1); // Remove 'search' subcommand
  let searchType = 'all';
  let pattern = '';
  const searchOptions = {};
  let detectedPath = null;

  // First, check if last non-flag arg looks like a path
  const lastNonFlag = searchArgs.filter(a => !a.startsWith('--')).pop();
  if (lastNonFlag && (
    lastNonFlag.startsWith('/') ||
    lastNonFlag.startsWith('./') ||
    lastNonFlag.startsWith('../') ||
    (lastNonFlag.includes('/') && !lastNonFlag.includes('*') && !lastNonFlag.includes(' '))
  )) {
    detectedPath = lastNonFlag;
  }

  for (let i = 0; i < searchArgs.length; i++) {
    const arg = searchArgs[i];

    // Skip if this is the detected path
    if (arg === detectedPath) {
      continue;
    }

    if (arg === '--async') {
      searchOptions.isAsync = true;
    } else if (arg.startsWith('--params=')) {
      searchOptions.paramCount = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--returns=')) {
      searchOptions.returnType = arg.split('=')[1];
    } else if (arg.startsWith('--visibility=')) {
      searchOptions.visibility = arg.split('=')[1];
    } else if (arg === '--fuzzy') {
      searchOptions.fuzzy = true;
    } else if (!arg.startsWith('--')) {
      if (!searchType || searchType === 'all') {
        // First non-flag arg could be type
        if (['file', 'export', 'import', 'signature', 'class', 'type', 'all'].includes(arg)) {
          searchType = arg;
        } else {
          // It's the pattern
          pattern = arg;
        }
      } else if (!pattern) {
        pattern = arg;
      }
    }
  }

  // Use detected path if found, otherwise use passed projectPath
  if (detectedPath) {
    projectPath = path.resolve(detectedPath);
  }

  // If only one arg and it's not a valid type, treat it as pattern
  if (!pattern && searchType && !['file', 'export', 'import', 'signature', 'class', 'type', 'all'].includes(searchType)) {
    pattern = searchType;
    searchType = 'all';
  }

  if (!pattern && Object.keys(searchOptions).length === 0) {
    return {
      success: false,
      error: 'No search pattern provided',
      usage: 'project-maps search <type> <pattern>\nTypes: file, export, import, signature, class, type, all'
    };
  }

  // Find project maps directory (uses backward-compatible path resolution)
  const loader = new MapLoader(projectPath);
  const mapDir = loader.getMapsDirectory(); // Use resolved path from loader

  // Check if maps exist
  const mapsExist = await loader.exists();
  if (!mapsExist) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run "project-maps generate" first'
    };
  }

  // Load search API
  const searchAPI = new SearchAPI();
  await searchAPI.loadMaps(mapDir);

  const startTime = Date.now();
  let results;

  // Execute search based on type
  if (searchOptions.fuzzy && pattern) {
    results = searchAPI.fuzzySearch(pattern, 2);
  } else if (Object.keys(searchOptions).length > 0 && searchType === 'signature') {
    // Criteria-based signature search
    if (pattern) searchOptions.name = pattern;
    results = { functions: searchAPI.searchBySignatureCriteria(searchOptions) };
  } else {
    switch (searchType) {
      case 'file':
        results = { files: searchAPI.searchByFileName(pattern) };
        break;
      case 'export':
        results = { exports: searchAPI.searchByExport(pattern) };
        break;
      case 'import':
        results = { imports: searchAPI.searchByImport(pattern) };
        break;
      case 'signature':
        results = { functions: searchAPI.searchBySignature(pattern) };
        break;
      case 'class':
        results = { classes: searchAPI.searchByClass(pattern) };
        break;
      case 'type':
        results = { types: searchAPI.searchByType(pattern) };
        break;
      case 'all':
      default:
        results = searchAPI.search(pattern);
        break;
    }
  }

  const searchTime = Date.now() - startTime;

  // Calculate total count
  let totalCount = 0;
  for (const category of Object.values(results)) {
    if (Array.isArray(category)) {
      totalCount += category.length;
    }
  }

  // Format results - default to lean for token efficiency, use --verbose for full output
  const outputFormat = options.verbose ? 'claude' : (options.format || 'lean');

  // Lean format - minimal output for token efficiency
  if (outputFormat === 'lean' && !options.json) {
    const formatter = new OutputFormatter({ projectRoot: projectPath });

    let output;
    if (searchType === 'all') {
      output = formatter.formatLeanUnified(results);
    } else {
      const items = results[Object.keys(results)[0]] || [];
      output = formatter.formatLean(items, searchType);
    }

    return {
      success: true,
      output,
      count: totalCount,
      time: `${searchTime}ms`
    };
  }

  if (outputFormat === 'claude' && !options.json) {
    // Create formatter with project context
    const formatter = new OutputFormatter({ projectRoot: projectPath });

    // Optionally load additional maps for contextual annotations
    let maps = {};
    if (options.annotate) {
      try {
        maps = await loader.loadMultiple(['dependencies-reverse', 'modules', 'backend-layers']);
      } catch (e) {
        // Maps not available, continue without annotations
      }
    }

    // Flatten results for formatting
    let flatResults = [];
    for (const [category, items] of Object.entries(results)) {
      if (Array.isArray(items)) {
        flatResults.push(...items);
      }
    }

    // Add contextual annotations if requested and maps available
    if (options.annotate && Object.keys(maps).length > 0) {
      flatResults = formatter.addContextAnnotations(flatResults, {
        dependenciesReverse: maps['dependencies-reverse'],
        modules: maps['modules'],
        backendLayers: maps['backend-layers']
      });
    }

    // Format for Claude
    const formatted = formatter.formatForClaude(
      totalCount === flatResults.length ? flatResults : results,
      searchType === 'all' ? 'unified' : searchType,
      { showSuggestions: options.annotate }
    );

    return {
      success: true,
      formatted,
      data: {
        query: pattern,
        type: searchType,
        totalCount,
        searchTime: `${searchTime}ms`
      },
      message: `Found ${totalCount} result(s) in ${searchTime}ms`
    };
  }

  // Raw JSON output
  return {
    success: true,
    data: {
      query: pattern,
      type: searchType,
      options: searchOptions,
      results,
      totalCount,
      searchTime: `${searchTime}ms`
    },
    message: `Found ${totalCount} result(s) in ${searchTime}ms`
  };
}

/**
 * Search npm dependencies by package name pattern
 */
async function depsCommand(projectPath, options, args) {
  const loader = new MapLoader(projectPath);

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  // Parse deps args: deps [pattern]
  const depsArgs = args.slice(1).filter(a => !a.startsWith('--'));
  const pattern = depsArgs[0]; // Optional pattern to filter

  // Load npm-dependencies map
  let npmDeps;
  try {
    npmDeps = await loader.load('npm-dependencies');
  } catch (error) {
    return {
      success: false,
      error: 'npm-dependencies map not found',
      suggestion: 'Regenerate maps with: session-cli project-maps generate'
    };
  }

  const startTime = Date.now();
  let results = [];

  // List packages, optionally filtered by pattern
  for (const [pkgName, pkgInfo] of Object.entries(npmDeps.packages || {})) {
    // If pattern provided, filter by name
    if (pattern && !pkgName.toLowerCase().includes(pattern.toLowerCase())) {
      continue;
    }
    results.push({
      name: pkgName,
      version: pkgInfo.v || pkgInfo.version,
      type: pkgInfo.t || pkgInfo.type,
      usedIn: pkgInfo.u || pkgInfo.usedIn || 0,
      files: pkgInfo.f || pkgInfo.files || []
    });
  }

  // Sort by usage (most used first)
  results.sort((a, b) => b.usedIn - a.usedIn);

  const searchTime = Date.now() - startTime;

  // Format output - lean by default
  if (!options.verbose && !options.json) {
    // Lean format: name@version (type) [N files]
    const lines = results.map(r => {
      const usage = r.usedIn > 0 ? ` [${r.usedIn} files]` : '';
      return `${r.name}@${r.version} (${r.type})${usage}`;
    });

    return {
      success: true,
      output: lines.join('\n'),
      count: results.length,
      time: `${searchTime}ms`
    };
  }

  // Verbose/JSON format
  return {
    success: true,
    data: {
      query: pattern || 'all',
      results,
      totalCount: results.length,
      searchTime: `${searchTime}ms`
    },
    formatted: options.verbose ? formatDepsVerbose(results, pattern) : undefined,
    message: `Found ${results.length} package(s) in ${searchTime}ms`
  };
}

/**
 * Format deps results in verbose markdown
 */
function formatDepsVerbose(results, pattern) {
  const lines = ['## NPM Dependencies\n'];

  if (pattern) {
    lines.push(`Search: \`${pattern}\`\n`);
  }

  // Group by type (prod, dev, peer)
  const byType = { prod: [], dev: [], peer: [] };
  for (const pkg of results) {
    const type = pkg.type || 'prod';
    if (!byType[type]) byType[type] = [];
    byType[type].push(pkg);
  }

  const typeLabels = { prod: 'Production', dev: 'Development', peer: 'Peer' };

  for (const [type, pkgs] of Object.entries(byType)) {
    if (pkgs.length === 0) continue;
    lines.push(`\n### ${typeLabels[type] || type} (${pkgs.length})\n`);
    for (const pkg of pkgs) {
      const usage = pkg.usedIn > 0 ? ` - used in ${pkg.usedIn} files` : '';
      lines.push(`- **${pkg.name}** v${pkg.version}${usage}`);
    }
  }

  return lines.join('\n');
}

/**
 * Show detected tech stack from npm-dependencies
 */
async function stackCommand(projectPath, options) {
  const loader = new MapLoader(projectPath);

  const exists = await loader.exists();
  if (!exists) {
    return {
      success: false,
      error: 'No maps found for this project',
      suggestion: 'Run: session-cli project-maps generate'
    };
  }

  // Load npm-dependencies map
  let npmDeps;
  try {
    npmDeps = await loader.load('npm-dependencies');
  } catch (error) {
    return {
      success: false,
      error: 'npm-dependencies map not found',
      suggestion: 'Regenerate maps with: session-cli project-maps generate'
    };
  }

  const stack = npmDeps.stack || {};
  const summary = npmDeps.summary || {};

  // Helper to format stack item (handles both string "name@version" and object {name, version})
  const formatStackItem = (item) => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (item.name) return `${item.name}${item.version ? '@' + item.version : ''}`;
    return null;
  };

  // Lean format by default
  if (!options.verbose && !options.json) {
    const lines = [];

    // Handle both string format ("node@20") and object format ({node: "20"})
    if (stack.runtime) {
      const runtime = typeof stack.runtime === 'string' ? stack.runtime : `node@${stack.runtime.node || stack.runtime}`;
      lines.push(`runtime: ${runtime}`);
    }
    if (stack.packageManager) lines.push(`pkg-manager: ${stack.packageManager}`);
    if (stack.framework) lines.push(`framework: ${formatStackItem(stack.framework)}`);
    if (stack.bundler) lines.push(`bundler: ${formatStackItem(stack.bundler)}`);
    if (stack.testing) lines.push(`testing: ${formatStackItem(stack.testing)}`);

    lines.push('---');
    const prodCount = summary.production || summary.prodDeps || 0;
    const devCount = summary.development || summary.devDeps || 0;
    const peerCount = summary.peer || 0;
    lines.push(`packages: ${summary.totalPackages || 0} (${prodCount} prod, ${devCount} dev, ${peerCount} peer)`);

    return {
      success: true,
      output: lines.join('\n'),
      count: 1,
      time: '0ms'
    };
  }

  // Verbose markdown format
  if (options.verbose) {
    const lines = ['## Tech Stack\n'];

    if (stack.runtime) {
      const runtime = typeof stack.runtime === 'string' ? stack.runtime : `Node.js ${stack.runtime.node || stack.runtime}`;
      lines.push(`- **Runtime:** ${runtime}`);
    }
    if (stack.packageManager) lines.push(`- **Package Manager:** ${stack.packageManager}`);
    if (stack.framework) lines.push(`- **Framework:** ${formatStackItem(stack.framework)}`);
    if (stack.bundler) lines.push(`- **Bundler:** ${formatStackItem(stack.bundler)}`);
    if (stack.testing) lines.push(`- **Testing:** ${formatStackItem(stack.testing)}`);

    lines.push('\n### Package Summary\n');
    const prodCount = summary.production || summary.prodDeps || 0;
    const devCount = summary.development || summary.devDeps || 0;
    const peerCount = summary.peer || 0;
    lines.push(`- Total: ${summary.totalPackages || 0} packages`);
    lines.push(`- Production: ${prodCount}`);
    lines.push(`- Development: ${devCount}`);
    lines.push(`- Peer: ${peerCount}`);

    return {
      success: true,
      formatted: lines.join('\n'),
      message: 'Tech stack detected from package.json'
    };
  }

  // JSON format
  return {
    success: true,
    data: {
      stack,
      summary
    }
  };
}

/**
 * Show help
 */
function helpCommand() {
  return {
    success: true,
    usage: `
Project Maps - Unified CLI for project context maps

Usage:
  session-cli project-maps <subcommand> [options]

Subcommands:
  generate [path]                Generate maps for project (default: current dir)
  load [--tier N] [--map name]   Load and display maps
  refresh [--full|--incremental] Refresh maps
  list                           List all mapped projects
  query <type>                   Query project info
  ask <question>                 Ask natural language question (uses intent routing)
  search <type> <pattern>        Search across maps (file, export, import, signature, class, type, all)
  deps [pattern]                 List npm dependencies (optionally filter by name)
  stack                          Show detected tech stack (framework, bundler, testing, etc.)
  introspect [options]           Introspect live database to generate schema map
  migrate [--delete-old]         Migrate maps from legacy global to project-local storage
  stats                          Show compression stats

Storage:
  Maps are stored in {project}/.claude/project-maps/ (project-local)
  Legacy maps in ~/.claude/project-maps/{hash}/ are auto-detected

Options:
  --path <path>      Specify project path
  --tier <N>         Load specific tier (1-4)
  --map <name>       Load specific map
  --full             Force full refresh
  --incremental      Force incremental refresh
  --json             Output as raw JSON
  --format <type>    Output format: lean (default), claude, json
  --verbose          Use verbose/claude format (rich markdown output)
  --annotate         Add contextual annotations (dependency info, module info)

Introspect Options:
  --url <string>     PostgreSQL connection URL (postgres://user:pass@host:port/db)
  --host <host>      Database host
  --port <port>      Database port (default: 5432)
  --database <name>  Database name
  --user <user>      Database user
  --password <pass>  Database password
  --schema <name>    PostgreSQL schema (default: public)
  --no-ssl           Disable SSL connection
  --output <path>    Custom output file path

Output Formats:
  lean (default)     Minimal output - file paths only, signature:line format
  claude             Rich markdown with grouping, summaries, and hints
  json               Raw JSON data structure

Query Types (Quick - from quick-queries.json):
  entry-points       Show entry point files
  framework          Show detected framework
  tests              Show test configuration
  largest            Show largest files
  recent             Show recently modified files
  structure          Show top-level structure
  languages          Show primary languages
  summary            Show full summary (default)

Query Types (Extended - from dedicated map files):
  backend-layers     Show backend architecture layers
  modules            Show detected business modules
  module-deps        Show module dependencies & coupling
  components         Show frontend components
  component-meta     Show component metadata (hooks, state, exports)
  database           Show database schema info
  data-flow          Show data flow patterns
  table-mapping      Show table-to-module mapping
  dependencies       Show file dependencies (forward & reverse)
  issues             Show detected code issues
  relationships      Show file relationships
  npm-deps           Show npm packages with usage stats
  stack              Show detected tech stack (framework, bundler, testing)

Examples:
  session-cli project-maps generate
  session-cli project-maps generate /path/to/project
  session-cli project-maps load --tier 1
  session-cli project-maps load --map summary
  session-cli project-maps refresh --incremental
  session-cli project-maps list
  session-cli project-maps query framework
  session-cli project-maps search file "*.controller.ts"
  session-cli project-maps search signature "fetch*" --async
  session-cli project-maps search all "User"
  session-cli project-maps deps                    # List all packages (sorted by usage)
  session-cli project-maps deps react              # Filter packages containing "react"
  session-cli project-maps stack                   # Show tech stack
  session-cli project-maps stack --verbose         # Show detailed tech stack
  session-cli project-maps migrate                 # Move legacy maps to project-local
  session-cli project-maps migrate --delete-old   # Migrate and delete legacy maps
  session-cli project-maps stats

Database Introspection Examples:
  session-cli project-maps introspect --url "postgres://user:pass@localhost:5432/mydb"
  session-cli project-maps introspect --host db.xxx.supabase.co --port 5432 --database postgres --user postgres
  DATABASE_URL=postgres://... session-cli project-maps introspect
  session-cli project-maps introspect --url "..." --schema my_schema
`.trim()
  };
}

/**
 * Migrate maps from legacy global storage to project-local storage
 */
async function migrateCommand(projectPath, options) {
  const mapPaths = new MapPaths(projectPath);
  const pathsInfo = mapPaths.getPathsInfo();

  // Check if already using project-local
  if (!mapPaths.isUsingLegacy()) {
    if (pathsInfo.mapsExist) {
      return {
        success: true,
        message: 'Maps are already stored in project-local directory',
        path: pathsInfo.projectLocalPath
      };
    } else {
      return {
        success: false,
        error: 'No maps found for this project',
        suggestion: 'Run: project-maps generate'
      };
    }
  }

  // Migrate from legacy to project-local
  const legacyPath = pathsInfo.legacyGlobalPath;
  const targetPath = pathsInfo.projectLocalPath;

  try {
    // Create target directory
    await fs.mkdir(targetPath, { recursive: true });

    // Copy all files from legacy to project-local
    const entries = await fs.readdir(legacyPath, { withFileTypes: true });
    let filesCopied = 0;

    for (const entry of entries) {
      const srcPath = path.join(legacyPath, entry.name);
      const destPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy directories (.history, .snapshots)
        await fs.mkdir(destPath, { recursive: true });
        const subEntries = await fs.readdir(srcPath);
        for (const subEntry of subEntries) {
          await fs.copyFile(
            path.join(srcPath, subEntry),
            path.join(destPath, subEntry)
          );
          filesCopied++;
        }
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
        filesCopied++;
      }
    }

    // Optionally delete legacy directory
    if (options.deleteOld) {
      await fs.rm(legacyPath, { recursive: true, force: true });
    }

    return {
      success: true,
      message: `Migrated ${filesCopied} files to project-local storage`,
      from: legacyPath,
      to: targetPath,
      deletedOld: options.deleteOld || false,
      note: options.deleteOld
        ? 'Legacy maps deleted'
        : 'Legacy maps preserved. Use --delete-old to remove them.'
    };
  } catch (error) {
    return {
      success: false,
      error: `Migration failed: ${error.message}`,
      from: legacyPath,
      to: targetPath
    };
  }
}

/**
 * Parse introspect command arguments
 */
function parseIntrospectArgs(args) {
  const options = {
    connectionString: null,
    host: null,
    port: 5432,
    database: null,
    user: null,
    password: null,
    schema: 'public',
    ssl: true,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--connection':
      case '--url':
        options.connectionString = args[++i];
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--port':
        options.port = parseInt(args[++i]) || 5432;
        break;
      case '--database':
      case '--db':
        options.database = args[++i];
        break;
      case '--user':
        options.user = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--schema':
        options.schema = args[++i];
        break;
      case '--no-ssl':
        options.ssl = false;
        break;
      case '--output':
        options.output = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Introspect live database to generate schema map
 */
async function introspectCommand(projectPath, options, args) {
  // Parse introspect-specific arguments
  const introspectArgs = args.slice(1); // Remove 'introspect' subcommand
  const introspectOptions = parseIntrospectArgs(introspectArgs);

  // Create introspector
  const introspector = new PostgresIntrospector({
    projectRoot: projectPath,
    schema: introspectOptions.schema,
    timeout: 30000
  });

  // Resolve credentials from CLI args or environment
  const credentials = introspector.resolveCredentials(introspectOptions);

  if (!credentials) {
    return {
      success: false,
      error: 'No database credentials provided',
      suggestion: 'Provide credentials using one of these methods:\n' +
        '  --url "postgres://user:pass@host:port/database"\n' +
        '  --host localhost --port 5432 --database mydb --user admin --password secret\n' +
        '  Set DATABASE_URL or SUPABASE_DB_URL environment variable',
      examples: [
        'project-maps introspect --url "postgres://user:pass@localhost:5432/mydb"',
        'project-maps introspect --host db.xxx.supabase.co --port 5432 --database postgres --user postgres',
        'DATABASE_URL=postgres://... project-maps introspect'
      ]
    };
  }

  try {
    const startTime = Date.now();

    // Perform introspection
    const schema = await introspector.introspect(credentials);

    const introspectionTime = Date.now() - startTime;

    // Determine output path
    const mapsDir = path.join(projectPath, '.claude', 'project-maps');
    const outputPath = introspectOptions.output ||
      path.join(mapsDir, 'database-schema-live.json');

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Save with compression
    await compression.compressAndSave(schema, outputPath);

    // Format success output
    const stats = schema.statistics;

    return {
      success: true,
      outputPath,
      database: {
        type: 'PostgreSQL',
        schema: introspectOptions.schema
      },
      statistics: stats,
      introspectionTime: `${introspectionTime}ms`,
      formatted: formatIntrospectResult(stats, outputPath, introspectionTime),
      message: `Introspected ${stats.totalTables} tables with ${stats.totalColumns} columns in ${introspectionTime}ms`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      suggestion: getErrorSuggestion(error),
      hint: 'Common issues:\n' +
        '  - Check host/port are correct and DB is running\n' +
        '  - Verify username/password\n' +
        '  - Ensure user has SELECT on information_schema\n' +
        '  - For Supabase, use port 5432 for direct or 6543 for pooler'
    };
  }
}

/**
 * Format introspect result for display
 */
function formatIntrospectResult(stats, outputPath, time) {
  const lines = [
    '## Database Introspection Complete\n',
    `**Tables:** ${stats.totalTables}`,
    `**Columns:** ${stats.totalColumns}`,
    `**Relationships:** ${stats.totalRelationships}`,
    `**Indexes:** ${stats.totalIndexes}`,
    '',
    `**Output:** \`${outputPath}\``,
    `**Time:** ${time}ms`,
    '',
    '### Next Steps',
    '- `/session:project-maps-query database` - View schema details',
    '- Load the schema in your code for reference'
  ];

  return lines.join('\n');
}

/**
 * Main command handler
 */
async function projectMapsCommand(args) {
  const { subcommand, projectPath, options } = parseArgs(args);

  try {
    switch (subcommand) {
      case 'generate':
        return await generateCommand(projectPath, options);
      case 'load':
        return await loadCommand(projectPath, options);
      case 'refresh':
        return await refreshCommand(projectPath, options);
      case 'list':
        return await listCommand(options);
      case 'query':
        return await queryCommand(projectPath, options);
      case 'ask':
        return await askCommand(projectPath, options);
      case 'stats':
        return await statsCommand(projectPath, options);
      case 'search':
        return await searchCommand(projectPath, options, args);
      case 'deps':
        return await depsCommand(projectPath, options, args);
      case 'stack':
        return await stackCommand(projectPath, options);
      case 'migrate':
        return await migrateCommand(projectPath, options);
      case 'introspect':
        return await introspectCommand(projectPath, options, args);
      case 'help':
      default:
        return helpCommand();
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: process.env.DEBUG ? error.stack : undefined
    };
  }
}

module.exports = projectMapsCommand;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');

  projectMapsCommand(args)
    .then(result => {
      // Lean format - print raw output directly
      if (result.output !== undefined && !isJson) {
        console.log(result.output);
        // Print count to stderr so it doesn't pollute output
        if (result.count !== undefined) {
          console.error(`# ${result.count} results in ${result.time}`);
        }
      } else if (result.formatted && !isJson) {
        // Verbose/claude format
        console.log(result.formatted);
        if (result.message) {
          console.log(`\n---\n${result.message}`);
        }
      } else {
        // JSON output
        console.log(JSON.stringify(result, null, 2));
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
