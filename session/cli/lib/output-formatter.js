/**
 * Output Formatter for Project Maps
 * Formats query results and search outputs for optimal Claude consumption
 * Provides actionable file paths, context, and intelligent summarization
 */

const path = require('path');

/**
 * Default configuration for the formatter
 */
const DEFAULT_CONFIG = {
  summarizeThreshold: 50,       // Summarize when results exceed this count
  maxResultsInSummary: 10,      // Show top N items when summarizing
  groupByDirectory: true,       // Group results by directory
  includeLineNumbers: true,     // Include line numbers when available
  absolutePaths: true,          // Always use absolute paths
  contextLines: 3,              // Lines of context to show
  maxPathLength: 80,            // Truncate paths longer than this
};

/**
 * Main formatter class for Claude-optimized output
 */
class OutputFormatter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.projectRoot = config.projectRoot || process.cwd();
  }

  /**
   * Format results in lean format for token efficiency
   * Returns minimal output optimized for Claude's context window
   * @param {Array} results - Search results
   * @param {string} queryType - Type of query
   * @returns {string} Lean formatted output (newline-separated)
   */
  formatLean(results, queryType) {
    if (!Array.isArray(results) || results.length === 0) {
      return '';
    }

    switch (queryType) {
      case 'file':
      case 'files':
        return this.formatLeanFiles(results);
      case 'signature':
      case 'function':
      case 'functions':
        return this.formatLeanSignatures(results);
      case 'export':
      case 'exports':
        return this.formatLeanExports(results);
      case 'import':
      case 'imports':
        return this.formatLeanImports(results);
      case 'class':
      case 'classes':
        return this.formatLeanClasses(results);
      case 'type':
      case 'types':
        return this.formatLeanTypes(results);
      default:
        return this.formatLeanFiles(results);
    }
  }

  /**
   * Format unified search results in minimal JSON
   * Uses short keys: f=files, s=signatures, e=exports, i=imports, c=classes, t=types
   * @param {Object} results - Unified search results object
   * @returns {string} Minimal JSON string
   */
  formatLeanUnified(results) {
    const o = {};
    if (results.files?.length) {
      o.f = results.files.map(r => r.path || r.file).filter(Boolean);
    }
    if (results.functions?.length) {
      o.s = results.functions.map(r =>
        `${r.location?.file || ''}:${r.location?.line || ''}:${r.name}`
      );
    }
    if (results.exports?.length) {
      o.e = results.exports.map(r => `${r.file}:${r.symbol}`);
    }
    if (results.imports?.length) {
      o.i = results.imports.map(r => `${r.importedBy}:${r.module}`);
    }
    if (results.classes?.length) {
      o.c = results.classes.map(r =>
        `${r.location?.file || ''}:${r.location?.line || ''}:${r.name}`
      );
    }
    if (results.types?.length) {
      o.t = results.types.map(r =>
        `${r.location?.file || ''}:${r.location?.line || ''}:${r.name}`
      );
    }
    return JSON.stringify(o);
  }

  /**
   * Lean format for file results - just paths, one per line (like Glob)
   */
  formatLeanFiles(results) {
    return results.map(r => r.path || r.file || r.name).filter(Boolean).join('\n');
  }

  /**
   * Lean format for signatures - file:line:name(params)
   */
  formatLeanSignatures(results) {
    return results.map(r => {
      const file = r.location?.file || r.file || '';
      const line = r.location?.line || '';
      const name = r.name || 'anonymous';
      const params = (r.parameters || []).map(p => p.name || 'arg').join(',');
      return `${file}:${line}:${name}(${params})`;
    }).join('\n');
  }

  /**
   * Lean format for exports - file:symbol:type
   */
  formatLeanExports(results) {
    return results.map(r =>
      `${r.file}:${r.symbol}:${r.exportType || 'unknown'}`
    ).join('\n');
  }

  /**
   * Lean format for imports - file:module
   */
  formatLeanImports(results) {
    return results.map(r => `${r.importedBy}:${r.module}`).join('\n');
  }

  /**
   * Lean format for classes - file:line:ClassName
   */
  formatLeanClasses(results) {
    return results.map(r => {
      const file = r.location?.file || r.file || '';
      const line = r.location?.line || '';
      return `${file}:${line}:${r.name}`;
    }).join('\n');
  }

  /**
   * Lean format for types - file:line:TypeName
   */
  formatLeanTypes(results) {
    return results.map(r => {
      const file = r.location?.file || r.file || '';
      const line = r.location?.line || '';
      return `${file}:${line}:${r.name}`;
    }).join('\n');
  }

  /**
   * Format results for Claude consumption
   * @param {Array|Object} results - Search/query results
   * @param {string} queryType - Type of query (file, export, import, signature, class, type, unified)
   * @param {Object} options - Additional formatting options
   * @returns {string} Formatted output string
   */
  formatForClaude(results, queryType, options = {}) {
    // Handle unified search results (object with multiple categories)
    if (this.isUnifiedResult(results)) {
      return this.formatUnifiedResults(results, options);
    }

    // Handle array results
    if (!Array.isArray(results)) {
      results = [results];
    }

    // Empty results
    if (results.length === 0) {
      return this.formatEmptyResults(queryType);
    }

    // Determine if summarization needed
    const needsSummary = results.length > this.config.summarizeThreshold;

    // Build output
    const output = [];

    // Add header with result count and query type
    output.push(this.formatHeader(results, queryType));

    // Add summarization if needed
    if (needsSummary) {
      output.push(this.formatSummary(results, queryType));
      output.push('');
      output.push(`### Top ${this.config.maxResultsInSummary} Results`);
      results = results.slice(0, this.config.maxResultsInSummary);
    }

    // Group by directory if enabled and applicable
    if (this.config.groupByDirectory && this.canGroupByDirectory(results)) {
      output.push(this.formatGroupedResults(results, queryType));
    } else {
      output.push(this.formatFlatResults(results, queryType));
    }

    // Add metadata footer
    output.push(this.formatMetadataFooter(results, queryType, needsSummary));

    return output.filter(Boolean).join('\n');
  }

  /**
   * Check if results are from unified search
   */
  isUnifiedResult(results) {
    return results && typeof results === 'object' && !Array.isArray(results) &&
      ('files' in results || 'exports' in results || 'functions' in results);
  }

  /**
   * Format unified search results (multiple categories)
   */
  formatUnifiedResults(results, options = {}) {
    const output = [];
    const categories = ['files', 'exports', 'imports', 'functions', 'classes', 'types'];
    const totalCount = categories.reduce((sum, cat) => sum + (results[cat]?.length || 0), 0);

    output.push(`## Search Results (${totalCount} total matches)\n`);

    for (const category of categories) {
      const items = results[category];
      if (items && items.length > 0) {
        output.push(`### ${this.capitalizeFirst(category)} (${items.length})`);
        output.push(this.formatFlatResults(items.slice(0, 15), category));
        if (items.length > 15) {
          output.push(`  _...and ${items.length - 15} more ${category}_\n`);
        }
        output.push('');
      }
    }

    return output.join('\n');
  }

  /**
   * Format header with result count and query type
   */
  formatHeader(results, queryType) {
    const count = results.length;
    const typeLabel = this.getQueryTypeLabel(queryType);
    return `## ${typeLabel} (${count} result${count !== 1 ? 's' : ''})\n`;
  }

  /**
   * Get human-readable label for query type
   */
  getQueryTypeLabel(queryType) {
    const labels = {
      file: 'File Search Results',
      export: 'Exported Symbols',
      import: 'Import References',
      signature: 'Function Signatures',
      function: 'Functions',
      method: 'Methods',
      class: 'Classes',
      type: 'Types & Interfaces',
      unified: 'Search Results',
      files: 'Files',
      exports: 'Exports',
      imports: 'Imports',
      functions: 'Functions',
      classes: 'Classes',
      types: 'Types'
    };
    return labels[queryType] || 'Results';
  }

  /**
   * Format empty results message
   */
  formatEmptyResults(queryType) {
    const suggestions = {
      file: 'Try a broader file pattern or check the file extension.',
      export: 'The symbol may not be exported or may have a different name.',
      import: 'Check if the module name is correct.',
      signature: 'Try searching by function name or use criteria search.',
      class: 'Verify the class name spelling.',
      type: 'TypeScript types might not be extracted yet.'
    };

    return `## No Results Found

No matches for this ${queryType || 'search'} query.

**Suggestion**: ${suggestions[queryType] || 'Try refining your search pattern.'}

**Alternatives**:
- Use wildcard patterns: \`*pattern*\`
- Try fuzzy search for typo tolerance
- Check if maps are up-to-date: \`/session:project-maps-stats\`
`;
  }

  /**
   * Format summary for large result sets
   */
  formatSummary(results, queryType) {
    const summary = this.analyzePatternsInResults(results, queryType);
    const lines = [];

    lines.push(`### Summary (${results.length} total results)`);
    lines.push('');

    // Directory distribution
    if (summary.directories.length > 0) {
      lines.push('**By Directory:**');
      const topDirs = summary.directories.slice(0, 5);
      for (const dir of topDirs) {
        lines.push(`- \`${dir.dir}\`: ${dir.count} file${dir.count !== 1 ? 's' : ''}`);
      }
      if (summary.directories.length > 5) {
        lines.push(`- _...and ${summary.directories.length - 5} more directories_`);
      }
      lines.push('');
    }

    // Type distribution (for exports/functions)
    if (summary.types && summary.types.length > 0) {
      lines.push('**By Type:**');
      for (const type of summary.types.slice(0, 5)) {
        lines.push(`- ${type.type}: ${type.count}`);
      }
      lines.push('');
    }

    // Pattern insights
    if (summary.patterns.length > 0) {
      lines.push('**Patterns Detected:**');
      for (const pattern of summary.patterns) {
        lines.push(`- ${pattern}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Analyze patterns in results for summarization
   */
  analyzePatternsInResults(results, queryType) {
    const dirCounts = new Map();
    const typeCounts = new Map();
    const patterns = [];

    for (const result of results) {
      // Count by directory
      const filePath = this.extractFilePath(result);
      if (filePath) {
        const dir = path.dirname(filePath);
        const shortDir = this.shortenPath(dir);
        dirCounts.set(shortDir, (dirCounts.get(shortDir) || 0) + 1);
      }

      // Count by type
      const resultType = result.type || result.exportType || result.kind;
      if (resultType) {
        typeCounts.set(resultType, (typeCounts.get(resultType) || 0) + 1);
      }
    }

    // Detect patterns
    const topDir = [...dirCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topDir && topDir[1] > results.length * 0.5) {
      patterns.push(`Most results (${topDir[1]}) are in \`${topDir[0]}\``);
    }

    const asyncCount = results.filter(r => r.isAsync).length;
    if (asyncCount > results.length * 0.3) {
      patterns.push(`${asyncCount} async functions found`);
    }

    return {
      directories: [...dirCounts.entries()]
        .map(([dir, count]) => ({ dir, count }))
        .sort((a, b) => b.count - a.count),
      types: [...typeCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      patterns
    };
  }

  /**
   * Summarize results with relevance scoring
   * @param {Array} results - Results to summarize
   * @param {number} limit - Maximum results to return
   * @param {Object} context - Optional context for relevance scoring (e.g., dependencies map)
   * @returns {Object} Summarized and scored results
   */
  summarizeResults(results, limit = 10, context = {}) {
    if (!Array.isArray(results) || results.length === 0) {
      return {
        results: [],
        summary: 'No results found',
        totalCount: 0,
        shownCount: 0,
        hasMore: false
      };
    }

    // Score each result for relevance
    const scoredResults = results.map(result => ({
      ...result,
      _relevanceScore: this.calculateRelevanceScore(result, context)
    }));

    // Sort by relevance score (highest first)
    scoredResults.sort((a, b) => b._relevanceScore - a._relevanceScore);

    // Get top results
    const topResults = scoredResults.slice(0, limit);
    const hasMore = results.length > limit;

    // Build summary
    const summary = this.buildSummaryText(results, topResults, context);

    return {
      results: topResults,
      summary,
      totalCount: results.length,
      shownCount: topResults.length,
      hasMore,
      showMoreInstruction: hasMore ?
        `\n_Showing top ${limit} of ${results.length} results. Use more specific search patterns for focused results._` :
        ''
    };
  }

  /**
   * Calculate relevance score for a result
   * Factors: recency, centrality in dependency graph, match quality, export status
   */
  calculateRelevanceScore(result, context = {}) {
    let score = 50; // Base score

    // Recency bonus (if modified date available)
    if (result.modified || result.modifiedAt) {
      const modified = new Date(result.modified || result.modifiedAt);
      const daysSinceModified = (Date.now() - modified.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceModified < 1) score += 20;       // Modified today
      else if (daysSinceModified < 7) score += 15;  // Modified this week
      else if (daysSinceModified < 30) score += 10; // Modified this month
      else if (daysSinceModified < 90) score += 5;  // Modified this quarter
    }

    // Centrality bonus (based on dependency count)
    if (context.dependencies) {
      const filePath = this.extractFilePath(result);
      if (filePath) {
        const dependencyCount = context.dependencies[filePath]?.length || 0;
        score += Math.min(dependencyCount * 2, 20); // Max 20 points from centrality
      }
    }

    // Export/visibility bonus
    if (result.isExported) score += 10;
    if (result.visibility === 'public') score += 5;

    // Type-specific bonuses
    if (result.type === 'class') score += 5;         // Classes are often important entry points
    if (result.type === 'interface') score += 5;    // Interfaces define contracts
    if (result.isAsync) score += 3;                 // Async functions often do I/O

    // Match quality bonus (exact vs partial)
    if (result._matchQuality === 'exact') score += 15;
    else if (result._matchQuality === 'prefix') score += 10;
    else if (result._matchQuality === 'contains') score += 5;

    // Location completeness bonus
    if (result.location?.line) score += 5;  // Has line number
    if (result.location?.file) score += 5;  // Has file path

    // Signature completeness bonus (for functions)
    if (result.parameters?.length > 0) score += 3;
    if (result.returnType) score += 3;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Build summary text for results
   */
  buildSummaryText(allResults, topResults, context = {}) {
    const lines = [];

    // Count by category
    const categories = new Map();
    for (const result of allResults) {
      const cat = result.type || 'other';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }

    if (categories.size > 1) {
      lines.push('**By Category:**');
      for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${this.capitalizeFirst(cat)}: ${count}`);
      }
    }

    // Patterns detected
    const patterns = this.analyzePatternsInResults(allResults, 'unified');
    if (patterns.patterns.length > 0) {
      lines.push('');
      lines.push('**Patterns:**');
      for (const pattern of patterns.patterns) {
        lines.push(`- ${pattern}`);
      }
    }

    // Top scoring items summary
    const topScoring = topResults.slice(0, 3);
    if (topScoring.length > 0 && topScoring[0]._relevanceScore > 70) {
      lines.push('');
      lines.push('**Most Relevant:**');
      for (const item of topScoring) {
        const name = item.name || item.symbol || 'Unknown';
        lines.push(`- ${name} (relevance: ${item._relevanceScore})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if results can be grouped by directory
   */
  canGroupByDirectory(results) {
    return results.some(r => this.extractFilePath(r));
  }

  /**
   * Format results grouped by directory
   */
  formatGroupedResults(results, queryType) {
    const groups = new Map();

    for (const result of results) {
      const filePath = this.extractFilePath(result);
      const dir = filePath ? path.dirname(filePath) : 'Other';
      const shortDir = this.shortenPath(dir);

      if (!groups.has(shortDir)) {
        groups.set(shortDir, []);
      }
      groups.get(shortDir).push(result);
    }

    const output = [];
    for (const [dir, items] of groups) {
      output.push(`\n#### \`${dir}/\``);
      for (const item of items) {
        output.push(this.formatSingleResult(item, queryType, { showDirectory: false }));
      }
    }

    return output.join('\n');
  }

  /**
   * Format results as flat list
   */
  formatFlatResults(results, queryType) {
    const output = [];
    for (const result of results) {
      output.push(this.formatSingleResult(result, queryType));
    }
    return output.join('\n');
  }

  /**
   * Format a single result based on its type
   */
  formatSingleResult(result, queryType, options = {}) {
    const type = result.type || queryType;
    let output;

    switch (type) {
      case 'file':
        output = this.formatFileResult(result, options);
        break;
      case 'export':
        output = this.formatExportResult(result, options);
        break;
      case 'import':
        output = this.formatImportResult(result, options);
        break;
      case 'function':
      case 'method':
      case 'signature':
        output = this.formatFunctionResult(result, options);
        break;
      case 'class':
        output = this.formatClassResult(result, options);
        break;
      case 'type':
      case 'interface':
      case 'enum':
        output = this.formatTypeResult(result, options);
        break;
      default:
        output = this.formatGenericResult(result, options);
    }

    // Add annotations if present
    if (result._annotations && result._annotations.length > 0 && !options.hideAnnotations) {
      output += '\n' + this.formatAnnotations(result._annotations);
    }

    // Add suggestions if present and requested
    if (result._suggestions && result._suggestions.length > 0 && options.showSuggestions) {
      output += '\n' + this.formatSuggestions(result._suggestions);
    }

    return output;
  }

  /**
   * Format file result
   */
  formatFileResult(result, options = {}) {
    const filePath = this.toAbsolutePath(result.path || result.file);
    const location = this.formatLocation(filePath, result.line);
    const size = result.size ? ` (${this.formatSize(result.size)})` : '';
    const fileType = result.fileType ? ` [${result.fileType}]` : '';

    return `- **${result.name}**${fileType}${size}
  \`${location}\``;
  }

  /**
   * Format export result
   */
  formatExportResult(result, options = {}) {
    const filePath = this.toAbsolutePath(result.file);
    const exportType = result.exportType || 'unknown';
    const location = this.formatLocation(filePath, result.line);

    return `- **${result.symbol}** (${exportType})
  \`${location}\`
  _Exported from this file_`;
  }

  /**
   * Format import result
   */
  formatImportResult(result, options = {}) {
    const filePath = this.toAbsolutePath(result.importedBy);
    const location = this.formatLocation(filePath, result.line);

    return `- **${result.module}** imported by:
  \`${location}\``;
  }

  /**
   * Format function/method result
   */
  formatFunctionResult(result, options = {}) {
    const isMethod = result.type === 'method' || result.className;
    const name = result.className ? `${result.className}.${result.name}` : result.name;
    const location = result.location ?
      this.formatLocation(
        this.toAbsolutePath(result.location.file || result.location.path),
        result.location.line
      ) : '';

    const signature = result.signature || this.buildSignature(result);
    const asyncBadge = result.isAsync ? ' `async`' : '';
    const visibilityBadge = result.visibility && result.visibility !== 'public' ?
      ` \`${result.visibility}\`` : '';

    let output = `- **${name}**${asyncBadge}${visibilityBadge}
  \`${signature}\``;

    if (location) {
      output += `\n  Location: \`${location}\``;
    }

    // Add parameter details if complex
    if (result.parameters && result.parameters.length > 2) {
      output += '\n  Parameters:';
      for (const param of result.parameters.slice(0, 5)) {
        const paramType = param.type?.raw || param.type?.name || 'any';
        const optional = param.isOptional ? '?' : '';
        output += `\n    - \`${param.name}${optional}\`: ${paramType}`;
      }
      if (result.parameters.length > 5) {
        output += `\n    - _...and ${result.parameters.length - 5} more_`;
      }
    }

    return output;
  }

  /**
   * Format class result
   */
  formatClassResult(result, options = {}) {
    const location = result.location ?
      this.formatLocation(
        this.toAbsolutePath(result.location.file || result.location.path),
        result.location.line
      ) : '';

    const extendsInfo = result.extends ? ` extends \`${result.extends}\`` : '';
    const implementsInfo = result.implements?.length ?
      ` implements \`${result.implements.join(', ')}\`` : '';

    let output = `- **class ${result.name}**${extendsInfo}${implementsInfo}`;

    if (location) {
      output += `\n  Location: \`${location}\``;
    }

    // Show methods summary
    if (result.methods && result.methods.length > 0) {
      const methodCount = result.methods.length;
      output += `\n  Methods (${methodCount}): ${result.methods.slice(0, 5).join(', ')}`;
      if (methodCount > 5) {
        output += `, _...and ${methodCount - 5} more_`;
      }
    }

    // Show properties summary
    if (result.properties && result.properties.length > 0) {
      const propCount = result.properties.length;
      output += `\n  Properties (${propCount}): ${result.properties.slice(0, 5).join(', ')}`;
      if (propCount > 5) {
        output += `, _...and ${propCount - 5} more_`;
      }
    }

    return output;
  }

  /**
   * Format type/interface result
   */
  formatTypeResult(result, options = {}) {
    const kind = result.kind || result.type || 'type';
    const location = result.location ?
      this.formatLocation(
        this.toAbsolutePath(result.location.file || result.location.path),
        result.location.line
      ) : '';

    const extendsInfo = result.extends ? ` extends \`${result.extends}\`` : '';
    const exportedBadge = result.isExported ? ' `exported`' : '';

    let output = `- **${kind} ${result.name}**${extendsInfo}${exportedBadge}`;

    if (location) {
      output += `\n  Location: \`${location}\``;
    }

    // Show properties for interfaces
    if (result.properties && result.properties.length > 0) {
      const propCount = result.properties.length;
      const propNames = result.properties
        .slice(0, 5)
        .map(p => typeof p === 'string' ? p : p.name)
        .filter(Boolean);
      output += `\n  Properties (${propCount}): ${propNames.join(', ')}`;
      if (propCount > 5) {
        output += `, _...and ${propCount - 5} more_`;
      }
    }

    return output;
  }

  /**
   * Format generic result (fallback)
   */
  formatGenericResult(result, options = {}) {
    const name = result.name || result.symbol || 'Unknown';
    const type = result.type || 'item';
    const filePath = this.extractFilePath(result);
    const location = filePath ? `\n  \`${this.toAbsolutePath(filePath)}\`` : '';

    return `- **${name}** (${type})${location}`;
  }

  /**
   * Format metadata footer
   */
  formatMetadataFooter(results, queryType, wasSummarized) {
    const lines = ['\n---'];

    // Add relevance explanation
    lines.push(`**Query Type**: ${this.getQueryTypeLabel(queryType)}`);
    lines.push(`**Results Shown**: ${Math.min(results.length, this.config.maxResultsInSummary)} of ${results.length}`);

    if (wasSummarized) {
      lines.push('\n_Results were summarized due to large count. Use more specific patterns for focused results._');
    }

    // Add actionable hints based on query type
    const hints = this.getActionableHints(queryType, results);
    if (hints.length > 0) {
      lines.push('\n**Next Steps:**');
      for (const hint of hints) {
        lines.push(`- ${hint}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get actionable hints based on query type
   */
  getActionableHints(queryType, results) {
    const hints = [];

    switch (queryType) {
      case 'function':
      case 'method':
      case 'signature':
        hints.push('Use `Read` tool to view full implementation');
        if (results.some(r => r.location?.line)) {
          hints.push('Line numbers provided - navigate directly to definition');
        }
        break;
      case 'class':
        hints.push('Search for class methods with `/session:project-maps-search --type signature <ClassName>.*`');
        hints.push('Check inheritance with `/session:project-maps-query relationships`');
        break;
      case 'export':
        hints.push('Find usages with `/session:project-maps-search --type import <symbol>`');
        break;
      case 'import':
        hints.push('View export source with `/session:project-maps-search --type export <module>`');
        break;
      case 'file':
        hints.push('Read file contents with `Read` tool');
        break;
    }

    return hints;
  }

  // ============ Contextual Annotations ============

  /**
   * Add contextual annotations to results
   * Enriches results with insights from cross-map references
   * @param {Array} results - Results to annotate
   * @param {Object} maps - Loaded maps (dependencies, relationships, modules, etc.)
   * @returns {Array} Annotated results
   */
  addContextAnnotations(results, maps = {}) {
    if (!Array.isArray(results)) return results;

    return results.map(result => {
      const annotations = [];
      const filePath = this.extractFilePath(result);

      // Dependency annotations
      if (maps.dependenciesReverse && filePath) {
        const importers = this.countImporters(filePath, maps.dependenciesReverse);
        if (importers > 0) {
          annotations.push({
            type: 'dependency',
            text: `Called by ${importers} other file${importers !== 1 ? 's' : ''}`,
            importance: importers > 10 ? 'high' : importers > 3 ? 'medium' : 'low'
          });
        }
      }

      // Module/layer annotations
      if (maps.modules || maps.backendLayers) {
        const moduleInfo = this.getModuleInfo(filePath, maps);
        if (moduleInfo) {
          annotations.push({
            type: 'module',
            text: `Part of ${moduleInfo.name}${moduleInfo.layer ? ` (${moduleInfo.layer} layer)` : ''}`,
            importance: 'medium'
          });
        }
      }

      // Interface implementation annotations (for classes)
      if (result.implements && result.implements.length > 0) {
        annotations.push({
          type: 'implements',
          text: `Implements ${result.implements.join(', ')}`,
          importance: 'high'
        });
      }

      // Inheritance annotations
      if (result.extends) {
        annotations.push({
          type: 'extends',
          text: `Extends ${result.extends}`,
          importance: 'medium'
        });
      }

      // Export annotations
      if (result.isExported) {
        annotations.push({
          type: 'export',
          text: 'Exported (public API)',
          importance: 'medium'
        });
      }

      // Async/performance annotations
      if (result.isAsync) {
        annotations.push({
          type: 'async',
          text: 'Async function (may involve I/O)',
          importance: 'low'
        });
      }

      // Complexity annotations (for functions with many params)
      if (result.parameters && result.parameters.length > 4) {
        annotations.push({
          type: 'complexity',
          text: `Complex signature (${result.parameters.length} parameters)`,
          importance: 'low'
        });
      }

      // Add suggestions based on annotations
      const suggestions = this.generateSuggestions(result, annotations, maps);

      return {
        ...result,
        _annotations: annotations,
        _suggestions: suggestions
      };
    });
  }

  /**
   * Count files that import/use a given file
   */
  countImporters(filePath, dependenciesReverse) {
    if (!dependenciesReverse?.files) return 0;

    // Normalize path for comparison
    const normalizedPath = this.normalizePath(filePath);
    let count = 0;

    for (const [file, data] of Object.entries(dependenciesReverse.files)) {
      if (data.imports?.some(imp => {
        const source = imp.source || imp.module || '';
        return source.includes(normalizedPath) || normalizedPath.includes(source);
      })) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get module information for a file
   */
  getModuleInfo(filePath, maps) {
    if (!filePath) return null;

    const normalizedPath = this.normalizePath(filePath);

    // Check modules map
    if (maps.modules?.modules) {
      for (const mod of maps.modules.modules) {
        if (mod.files?.some(f => normalizedPath.includes(f) || f.includes(normalizedPath))) {
          return {
            name: mod.name,
            type: 'module'
          };
        }
      }
    }

    // Check backend layers
    if (maps.backendLayers?.layers) {
      for (const [layerName, layerData] of Object.entries(maps.backendLayers.layers)) {
        if (layerData.files?.some(f => normalizedPath.includes(f) || f.includes(normalizedPath))) {
          return {
            name: layerName,
            layer: layerData.type || 'backend',
            type: 'layer'
          };
        }
      }
    }

    // Infer from path
    const pathParts = normalizedPath.split('/');
    const commonModules = ['controllers', 'services', 'models', 'utils', 'lib', 'helpers', 'middleware', 'routes', 'api'];

    for (const part of pathParts) {
      if (commonModules.includes(part.toLowerCase())) {
        return {
          name: part,
          type: 'inferred'
        };
      }
    }

    return null;
  }

  /**
   * Generate actionable suggestions based on result and annotations
   */
  generateSuggestions(result, annotations, maps) {
    const suggestions = [];
    const type = result.type || 'unknown';

    // High-dependency suggestions
    const highDep = annotations.find(a => a.type === 'dependency' && a.importance === 'high');
    if (highDep) {
      suggestions.push({
        text: 'Consider checking callers before refactoring - high impact',
        action: 'search-importers'
      });
    }

    // Interface implementation suggestions
    if (result.implements?.length > 0) {
      suggestions.push({
        text: `Check interface contract: ${result.implements[0]}`,
        action: 'view-interface'
      });
    }

    // Exported API suggestions
    if (result.isExported && type === 'function') {
      suggestions.push({
        text: 'This is part of the public API - changes may affect consumers',
        action: 'review-impact'
      });
    }

    // Class method suggestions
    if (type === 'class' && result.methods?.length > 0) {
      suggestions.push({
        text: `Explore ${result.methods.length} methods for implementation details`,
        action: 'view-methods'
      });
    }

    return suggestions;
  }

  /**
   * Normalize file path for comparison
   */
  normalizePath(filePath) {
    if (!filePath) return '';
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Format annotations for display
   */
  formatAnnotations(annotations) {
    if (!annotations || annotations.length === 0) return '';

    const lines = ['  _Context:_'];
    for (const ann of annotations) {
      const icon = this.getAnnotationIcon(ann.type);
      lines.push(`  ${icon} ${ann.text}`);
    }
    return lines.join('\n');
  }

  /**
   * Get icon for annotation type
   */
  getAnnotationIcon(type) {
    const icons = {
      dependency: '📊',
      module: '📦',
      implements: '🔌',
      extends: '🔗',
      export: '📤',
      async: '⚡',
      complexity: '🔧'
    };
    return icons[type] || '•';
  }

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';

    const lines = ['  _Suggestions:_'];
    for (const sug of suggestions) {
      lines.push(`  💡 ${sug.text}`);
    }
    return lines.join('\n');
  }

  // ============ Utility Methods ============

  /**
   * Extract file path from various result formats
   */
  extractFilePath(result) {
    return result.path || result.file || result.importedBy ||
      result.location?.file || result.location?.path || null;
  }

  /**
   * Convert to absolute path
   */
  toAbsolutePath(filePath) {
    if (!filePath) return '';

    if (this.config.absolutePaths && !path.isAbsolute(filePath)) {
      return path.join(this.projectRoot, filePath);
    }
    return filePath;
  }

  /**
   * Format location string with optional line number
   */
  formatLocation(filePath, line) {
    if (!filePath) return '';

    if (this.config.includeLineNumbers && line) {
      return `${filePath}:${line}`;
    }
    return filePath;
  }

  /**
   * Shorten path for display
   */
  shortenPath(filePath) {
    if (!filePath) return '';

    // Remove project root prefix if present
    let shortened = filePath;
    if (filePath.startsWith(this.projectRoot)) {
      shortened = filePath.slice(this.projectRoot.length + 1);
    }

    // Truncate if too long
    if (shortened.length > this.config.maxPathLength) {
      const parts = shortened.split(path.sep);
      if (parts.length > 3) {
        shortened = `.../${parts.slice(-3).join('/')}`;
      }
    }

    return shortened;
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Build signature string from function data
   */
  buildSignature(func) {
    const params = (func.parameters || [])
      .map(p => {
        let param = p.name || 'arg';
        if (p.isOptional) param += '?';
        if (p.type?.raw) param += `: ${p.type.raw}`;
        return param;
      })
      .join(', ');

    const returnType = func.returnType?.raw ? `: ${func.returnType.raw}` : '';
    const asyncPrefix = func.isAsync ? 'async ' : '';
    const name = func.name || 'anonymous';

    return `${asyncPrefix}function ${name}(${params})${returnType}`;
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Convenience function to format results
 * @param {Array|Object} results - Search/query results
 * @param {string} queryType - Type of query
 * @param {Object} options - Formatting options including projectRoot
 * @returns {string} Formatted output
 */
function formatForClaude(results, queryType, options = {}) {
  const formatter = new OutputFormatter(options);
  return formatter.formatForClaude(results, queryType, options);
}

module.exports = {
  OutputFormatter,
  formatForClaude,
  DEFAULT_CONFIG
};
