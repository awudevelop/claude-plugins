/**
 * Search API for Project Maps
 * Provides unified search capabilities across all map types
 * Supports file names, exports, imports, signatures, and patterns
 */

const fs = require('fs').promises;
const path = require('path');

class SearchAPI {
  constructor() {
    this.maps = {};
    this.indexes = {
      files: new Map(),          // filename -> file info
      exports: new Map(),        // symbol -> [file locations]
      imports: new Map(),        // module -> [importing files]
      functions: new Map(),      // function name -> [signatures]
      classes: new Map(),        // class name -> [class info]
      types: new Map(),          // type/interface name -> [definitions]
      paths: []                  // all file paths for fuzzy matching
    };
    this.loaded = false;
  }

  /**
   * Load maps from a project's map directory
   * @param {string} mapDir - Path to the project's map directory
   */
  async loadMaps(mapDir) {
    const mapFiles = [
      'summary.json',
      'tree.json',
      'quick-queries.json',
      'dependencies-forward.json',
      'dependencies-reverse.json',
      'function-signatures.json',
      'types-map.json',
      'modules.json',
      'relationships.json'
    ];

    for (const mapFile of mapFiles) {
      try {
        const filePath = path.join(mapDir, mapFile);
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);

        // Handle compressed maps
        const mapName = mapFile.replace('.json', '');
        if (parsed.data && typeof parsed.data === 'string') {
          this.maps[mapName] = JSON.parse(parsed.data);
        } else {
          this.maps[mapName] = parsed;
        }
      } catch (err) {
        // Map doesn't exist or can't be parsed - skip
      }
    }

    // Build search indexes from loaded maps
    this.buildSearchIndex();
    this.loaded = true;
  }

  /**
   * Build in-memory search indexes from all loaded maps
   * Creates efficient lookup structures for O(1) search
   */
  buildSearchIndex() {
    // Index file paths from tree map (v2.0.0 flat structure with path references)
    if (this.maps.tree?.files && this.maps.tree?.paths) {
      const paths = this.maps.tree.paths;
      for (const file of this.maps.tree.files) {
        const fileName = file.n;  // name
        const dirPath = paths[file.p] || '.';  // path from reference
        const fullPath = dirPath === '.' ? fileName : `${dirPath}/${fileName}`;

        if (fileName) {
          if (!this.indexes.files.has(fileName)) {
            this.indexes.files.set(fileName, []);
          }
          this.indexes.files.get(fileName).push({
            path: fullPath,
            relativePath: fullPath,
            size: file.s,
            type: file.t
          });
          this.indexes.paths.push(fullPath);
        }
      }
    }

    // Index exports from dependencies-forward (v2.0.0 flat structure)
    // Handle both full key (exports) and abbreviated key (e) from compression
    const depsForward = this.maps['dependencies-forward'];
    const depExports = depsForward?.exports || depsForward?.e;  // 'e' is abbreviated key
    const depImports = depsForward?.imports || depsForward?.i;  // 'i' is abbreviated key
    const depFiles = depsForward?.files;

    if (depExports && depFiles) {
      for (const exp of depExports) {
        const filePath = depFiles[exp.f];  // file from reference
        const symbol = exp.n;  // export name

        if (symbol && filePath) {
          if (!this.indexes.exports.has(symbol)) {
            this.indexes.exports.set(symbol, []);
          }
          this.indexes.exports.get(symbol).push({
            file: filePath,
            export: exp,
            type: exp.t || 'unknown'
          });
        }
      }
    }

    // Index imports from dependencies-forward (v2.0.0 flat structure)
    if (depImports && depFiles) {
      for (const imp of depImports) {
        const filePath = depFiles[imp.f];  // file from reference
        const moduleName = imp.src;  // source module

        if (moduleName && filePath) {
          if (!this.indexes.imports.has(moduleName)) {
            this.indexes.imports.set(moduleName, []);
          }
          this.indexes.imports.get(moduleName).push({
            file: filePath,
            symbols: imp.sym,
            type: imp.t,
            import: imp
          });
        }
      }
    }

    // Index function signatures
    if (this.maps['function-signatures']) {
      const sigMap = this.maps['function-signatures'];

      // Index standalone functions
      if (sigMap.functions) {
        for (const func of sigMap.functions) {
          const name = func.name || func.n;
          if (name) {
            if (!this.indexes.functions.has(name)) {
              this.indexes.functions.set(name, []);
            }
            this.indexes.functions.get(name).push(func);
          }
        }
      }

      // Index classes and their methods
      if (sigMap.classes) {
        for (const cls of sigMap.classes) {
          const className = cls.name || cls.n;
          if (className) {
            if (!this.indexes.classes.has(className)) {
              this.indexes.classes.set(className, []);
            }
            this.indexes.classes.get(className).push(cls);

            // Also index methods
            if (cls.methods) {
              for (const method of cls.methods) {
                const methodName = method.name || method.n;
                if (methodName) {
                  const fullName = `${className}.${methodName}`;
                  if (!this.indexes.functions.has(fullName)) {
                    this.indexes.functions.set(fullName, []);
                  }
                  this.indexes.functions.get(fullName).push({
                    ...method,
                    className,
                    isMethod: true
                  });
                }
              }
            }
          }
        }
      }
    }

    // Index types from types-map
    if (this.maps['types-map']) {
      const typesMap = this.maps['types-map'];

      // Index interfaces
      if (typesMap.interfaces) {
        for (const iface of typesMap.interfaces) {
          const name = iface.name || iface.n;
          if (name) {
            if (!this.indexes.types.has(name)) {
              this.indexes.types.set(name, []);
            }
            this.indexes.types.get(name).push({ ...iface, kind: 'interface' });
          }
        }
      }

      // Index type aliases
      if (typesMap.typeAliases) {
        for (const alias of typesMap.typeAliases) {
          const name = alias.name || alias.n;
          if (name) {
            if (!this.indexes.types.has(name)) {
              this.indexes.types.set(name, []);
            }
            this.indexes.types.get(name).push({ ...alias, kind: 'type' });
          }
        }
      }

      // Index enums
      if (typesMap.enums) {
        for (const enumDef of typesMap.enums) {
          const name = enumDef.name || enumDef.n;
          if (name) {
            if (!this.indexes.types.has(name)) {
              this.indexes.types.set(name, []);
            }
            this.indexes.types.get(name).push({ ...enumDef, kind: 'enum' });
          }
        }
      }
    }
  }

  /**
   * Search by file name pattern
   * @param {string|RegExp} pattern - File name pattern (string or regex)
   * @returns {Array} Matching files with metadata
   */
  searchByFileName(pattern) {
    const results = [];
    const regex = this.toRegex(pattern);

    for (const [fileName, files] of this.indexes.files) {
      if (regex.test(fileName)) {
        for (const file of files) {
          results.push({
            type: 'file',
            name: fileName,
            path: file.path || file.relativePath,
            size: file.size,
            modified: file.modified,
            fileType: file.type
          });
        }
      }
    }

    // Also search full paths
    for (const filePath of this.indexes.paths) {
      if (regex.test(filePath) && !results.some(r => r.path === filePath)) {
        results.push({
          type: 'file',
          name: path.basename(filePath),
          path: filePath
        });
      }
    }

    return this.dedupeResults(results);
  }

  /**
   * Search by exported symbol
   * @param {string|RegExp} symbol - Export symbol pattern
   * @returns {Array} Files exporting matching symbols
   */
  searchByExport(symbol) {
    const results = [];
    const regex = this.toRegex(symbol);

    for (const [exportName, locations] of this.indexes.exports) {
      if (regex.test(exportName)) {
        for (const loc of locations) {
          results.push({
            type: 'export',
            symbol: exportName,
            file: loc.file,
            exportType: loc.type,
            details: loc.export
          });
        }
      }
    }

    return results;
  }

  /**
   * Search by imported module
   * @param {string|RegExp} moduleName - Module name pattern
   * @returns {Array} Files importing matching modules
   */
  searchByImport(moduleName) {
    const results = [];
    const regex = this.toRegex(moduleName);

    for (const [module, importers] of this.indexes.imports) {
      if (regex.test(module)) {
        for (const imp of importers) {
          results.push({
            type: 'import',
            module: module,
            importedBy: imp.file,
            details: imp.import
          });
        }
      }
    }

    return results;
  }

  /**
   * Search by function/method signature
   * @param {string|Object} pattern - Search pattern (string, regex, or criteria object)
   * @returns {Array} Matching functions with full signature details
   */
  searchBySignature(pattern) {
    const results = [];

    // Handle object-based criteria
    if (typeof pattern === 'object' && !(pattern instanceof RegExp)) {
      return this.searchBySignatureCriteria(pattern);
    }

    const regex = this.toRegex(pattern);

    // Search function names
    for (const [funcName, funcs] of this.indexes.functions) {
      if (regex.test(funcName)) {
        for (const func of funcs) {
          results.push({
            type: func.isMethod ? 'method' : 'function',
            name: funcName,
            className: func.className,
            signature: this.formatSignature(func),
            location: func.location,
            parameters: func.parameters,
            returnType: func.returnType,
            kind: func.kind,
            isAsync: func.isAsync || func.kind === 'async',
            visibility: func.visibility
          });
        }
      }
    }

    return results;
  }

  /**
   * Search functions by criteria object
   * Supports: paramCount, isAsync, returnType, hasParameter
   */
  searchBySignatureCriteria(criteria) {
    const results = [];

    for (const [funcName, funcs] of this.indexes.functions) {
      for (const func of funcs) {
        if (this.matchesCriteria(func, criteria)) {
          results.push({
            type: func.isMethod ? 'method' : 'function',
            name: funcName,
            className: func.className,
            signature: this.formatSignature(func),
            location: func.location,
            parameters: func.parameters,
            returnType: func.returnType,
            kind: func.kind,
            isAsync: func.isAsync || func.kind === 'async',
            visibility: func.visibility
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if function matches criteria
   */
  matchesCriteria(func, criteria) {
    // Check parameter count
    if (criteria.paramCount !== undefined) {
      const paramCount = (func.parameters || []).length;
      if (paramCount !== criteria.paramCount) return false;
    }

    // Check min/max parameter count
    if (criteria.minParams !== undefined) {
      const paramCount = (func.parameters || []).length;
      if (paramCount < criteria.minParams) return false;
    }

    if (criteria.maxParams !== undefined) {
      const paramCount = (func.parameters || []).length;
      if (paramCount > criteria.maxParams) return false;
    }

    // Check if async
    if (criteria.isAsync !== undefined) {
      const isAsync = func.isAsync || func.kind === 'async';
      if (isAsync !== criteria.isAsync) return false;
    }

    // Check return type
    if (criteria.returnType) {
      const returnType = func.returnType?.raw || func.returnType?.name || '';
      const regex = this.toRegex(criteria.returnType);
      if (!regex.test(returnType)) return false;
    }

    // Check if has parameter with name
    if (criteria.hasParameter) {
      const params = func.parameters || [];
      const regex = this.toRegex(criteria.hasParameter);
      const hasParam = params.some(p => regex.test(p.name || ''));
      if (!hasParam) return false;
    }

    // Check parameter type
    if (criteria.parameterType) {
      const params = func.parameters || [];
      const regex = this.toRegex(criteria.parameterType);
      const hasType = params.some(p => {
        const type = p.type?.raw || p.type?.name || '';
        return regex.test(type);
      });
      if (!hasType) return false;
    }

    // Check visibility
    if (criteria.visibility) {
      if (func.visibility !== criteria.visibility) return false;
    }

    // Check if static
    if (criteria.isStatic !== undefined) {
      if (func.isStatic !== criteria.isStatic) return false;
    }

    // Check kind (function, arrow, async, generator, method, getter, setter)
    if (criteria.kind) {
      if (func.kind !== criteria.kind) return false;
    }

    return true;
  }

  /**
   * Search by class name
   * @param {string|RegExp} pattern - Class name pattern
   * @returns {Array} Matching classes with methods
   */
  searchByClass(pattern) {
    const results = [];
    const regex = this.toRegex(pattern);

    for (const [className, classes] of this.indexes.classes) {
      if (regex.test(className)) {
        for (const cls of classes) {
          results.push({
            type: 'class',
            name: className,
            extends: cls.extends,
            implements: cls.implements,
            methods: (cls.methods || []).map(m => m.name || m.n),
            properties: (cls.properties || []).map(p => p.name || p.n),
            location: cls.location,
            isAbstract: cls.isAbstract,
            isExported: cls.isExported
          });
        }
      }
    }

    return results;
  }

  /**
   * Search by type/interface name
   * @param {string|RegExp} pattern - Type name pattern
   * @returns {Array} Matching types with definitions
   */
  searchByType(pattern) {
    const results = [];
    const regex = this.toRegex(pattern);

    for (const [typeName, types] of this.indexes.types) {
      if (regex.test(typeName)) {
        for (const typeDef of types) {
          results.push({
            type: typeDef.kind,
            name: typeName,
            properties: typeDef.properties,
            methods: typeDef.methods,
            extends: typeDef.extends,
            generics: typeDef.generics,
            location: typeDef.location,
            isExported: typeDef.isExported
          });
        }
      }
    }

    return results;
  }

  /**
   * Unified search across all indexes
   * @param {string} query - Search query
   * @returns {Object} Results categorized by type
   */
  search(query) {
    return {
      files: this.searchByFileName(query),
      exports: this.searchByExport(query),
      imports: this.searchByImport(query),
      functions: this.searchBySignature(query),
      classes: this.searchByClass(query),
      types: this.searchByType(query)
    };
  }

  /**
   * Fuzzy search with typo tolerance
   * Uses Levenshtein distance for approximate matching
   * @param {string} query - Search query
   * @param {number} maxDistance - Maximum edit distance (default: 2)
   */
  fuzzySearch(query, maxDistance = 2) {
    const results = {
      files: [],
      functions: [],
      classes: [],
      types: []
    };

    // Fuzzy match file names
    for (const [fileName] of this.indexes.files) {
      if (this.levenshteinDistance(query.toLowerCase(), fileName.toLowerCase()) <= maxDistance) {
        results.files.push(...this.searchByFileName(fileName));
      }
    }

    // Fuzzy match function names
    for (const [funcName] of this.indexes.functions) {
      if (this.levenshteinDistance(query.toLowerCase(), funcName.toLowerCase()) <= maxDistance) {
        results.functions.push(...this.searchBySignature(funcName));
      }
    }

    // Fuzzy match class names
    for (const [className] of this.indexes.classes) {
      if (this.levenshteinDistance(query.toLowerCase(), className.toLowerCase()) <= maxDistance) {
        results.classes.push(...this.searchByClass(className));
      }
    }

    // Fuzzy match type names
    for (const [typeName] of this.indexes.types) {
      if (this.levenshteinDistance(query.toLowerCase(), typeName.toLowerCase()) <= maxDistance) {
        results.types.push(...this.searchByType(typeName));
      }
    }

    return results;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Convert string pattern to regex
   */
  toRegex(pattern) {
    if (pattern instanceof RegExp) {
      return pattern;
    }

    // Escape special regex characters but allow * as wildcard
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    return new RegExp(escaped, 'i');
  }

  /**
   * Format function signature for display
   */
  formatSignature(func) {
    const params = (func.parameters || [])
      .map(p => {
        let param = p.name || 'arg';
        if (p.isOptional) param += '?';
        if (p.type?.raw) param += `: ${p.type.raw}`;
        if (p.hasDefault && p.defaultValue) param += ` = ${p.defaultValue}`;
        return param;
      })
      .join(', ');

    const returnType = func.returnType?.raw ? `: ${func.returnType.raw}` : '';
    const asyncPrefix = (func.isAsync || func.kind === 'async') ? 'async ' : '';
    const name = func.name || 'anonymous';

    return `${asyncPrefix}${name}(${params})${returnType}`;
  }

  /**
   * Remove duplicate results
   */
  dedupeResults(results) {
    const seen = new Set();
    return results.filter(r => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      loaded: this.loaded,
      mapsLoaded: Object.keys(this.maps).length,
      indexedFiles: this.indexes.files.size,
      indexedExports: this.indexes.exports.size,
      indexedImports: this.indexes.imports.size,
      indexedFunctions: this.indexes.functions.size,
      indexedClasses: this.indexes.classes.size,
      indexedTypes: this.indexes.types.size,
      totalPaths: this.indexes.paths.length
    };
  }
}

/**
 * Convenience function to create and load a search API instance
 */
async function createSearchAPI(mapDir) {
  const api = new SearchAPI();
  await api.loadMaps(mapDir);
  return api;
}

module.exports = {
  SearchAPI,
  createSearchAPI
};
