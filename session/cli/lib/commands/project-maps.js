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
    } else if (arg === '--path' && args[i + 1]) {
      result.projectPath = path.resolve(args[i + 1]);
      i++;
    } else if (!arg.startsWith('--') && i === 1 && result.subcommand !== 'query' && result.subcommand !== 'ask' && result.subcommand !== 'search') {
      // First non-option argument after subcommand could be path (except for query/ask/search)
      result.projectPath = path.resolve(arg);
    } else if (!arg.startsWith('--') && result.subcommand === 'query') {
      // For query command, argument is the query type
      result.options.queryType = arg;
    } else if (result.subcommand === 'ask' && !arg.startsWith('--')) {
      // For ask command, collect all remaining args as the question
      if (!result.options.question) {
        result.options.question = args.slice(i).join(' ');
        break; // Stop processing, rest is the question
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

    // Run refresh
    await refresher.run();

    return {
      success: true,
      mode: mode
    };
  }
}

/**
 * List all projects with maps
 */
async function listCommand(options) {
  const mapsBaseDir = path.join(process.env.HOME, '.claude/project-maps');

  try {
    const entries = await fs.readdir(mapsBaseDir, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['maps', 'schemas', 'temp'].includes(entry.name)) continue;

      const projectHash = entry.name;
      const summaryPath = path.join(mapsBaseDir, projectHash, 'summary.json');

      try {
        // Use loadAndDecompress which handles all compression formats
        const summary = await compression.loadAndDecompress(summaryPath);

        projects.push({
          hash: projectHash,
          name: summary.projectName || summary.project?.name || 'Unknown',
          path: summary.projectPath || summary.project?.path || 'Unknown',
          files: summary.statistics?.totalFiles || 0,
          generated: summary.staleness?.lastRefresh || summary.generated || 'Unknown',
          staleness: summary.staleness || null
        });
      } catch (error) {
        // Skip projects with corrupt/missing summary
        projects.push({
          hash: projectHash,
          name: 'Unknown',
          path: 'Unknown',
          error: error.message
        });
      }
    }

    return {
      success: true,
      count: projects.length,
      projects
    };
  } catch (error) {
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
      return {
        architecture: map.architecture,
        layers: Object.keys(map.layers || {}).map(layer => ({
          name: layer,
          files: (map.layers[layer] || []).length
        })),
        statistics: map.statistics
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
  // Parse search arguments: search <type> <pattern> [--flags]
  const searchArgs = args.slice(1); // Remove 'search' subcommand
  let searchType = 'all';
  let pattern = '';
  const searchOptions = {};

  for (let i = 0; i < searchArgs.length; i++) {
    const arg = searchArgs[i];

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

  // Find project maps directory
  const loader = new MapLoader(projectPath);
  const projectHash = loader.projectHash;
  const mapDir = path.join(process.env.HOME, '.claude/project-maps', projectHash);

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
  stats                          Show compression stats

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
  session-cli project-maps stats
`.trim()
  };
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
