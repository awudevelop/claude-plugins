/**
 * Plan Map Loader
 *
 * Loads project maps for plan finalization and execution.
 * Provides helper methods for:
 * - Suggesting file locations
 * - Finding similar code patterns
 * - Determining import patterns
 * - Looking up types and interfaces
 */

const MapLoader = require('./map-loader');
const path = require('path');

class PlanMapLoader {
  /**
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.mapLoader = new MapLoader(projectRoot);
    this._cache = {};
  }

  /**
   * Load maps needed for plan finalization
   * @returns {Promise<Object>}
   */
  async loadForFinalize() {
    const maps = {
      tree: await this._loadSafe('tree'),
      signatures: await this._loadSafe('function-signatures'),
      types: await this._loadSafe('types-map'),
      modules: await this._loadSafe('modules'),
      layers: await this._loadSafe('backend-layers'),
      database: await this._loadSafe('database-schema'),
      dependencies: await this._loadSafe('npm-dependencies')
    };

    return maps;
  }

  /**
   * Load maps needed for plan execution
   * @returns {Promise<Object>}
   */
  async loadForExecute() {
    return {
      signatures: await this._loadSafe('function-signatures'),
      types: await this._loadSafe('types-map'),
      dependencies: await this._loadSafe('dependencies-forward'),
      tree: await this._loadSafe('tree')
    };
  }

  /**
   * Safely load a map, returning null if not available
   */
  async _loadSafe(mapName) {
    if (this._cache[mapName]) {
      return this._cache[mapName];
    }

    try {
      const map = await this.mapLoader.load(mapName);
      this._cache[mapName] = map;
      return map;
    } catch (err) {
      return null;
    }
  }

  /**
   * Suggest best file location for a new file
   * @param {string} taskType - Task type (create_function, create_class, etc.)
   * @param {string} name - Name of the entity being created
   * @param {Object} context - Additional context (module, purpose, etc.)
   * @returns {Promise<Object>}
   */
  async suggestLocation(taskType, name, context = {}) {
    const tree = await this._loadSafe('tree');
    const modules = await this._loadSafe('modules');

    if (!tree) {
      return {
        suggested: null,
        confidence: 'low',
        reason: 'No project tree available'
      };
    }

    const files = tree.files || [];
    const directories = tree.directories || [];

    // Type-specific location patterns
    const patterns = {
      create_hook: ['hooks/', 'src/hooks/', 'lib/hooks/'],
      create_component: ['components/', 'src/components/', 'app/components/'],
      create_context: ['contexts/', 'src/contexts/', 'lib/contexts/', 'providers/'],
      create_class: ['lib/', 'src/lib/', 'services/', 'src/services/'],
      create_function: ['lib/', 'src/lib/', 'utils/', 'src/utils/'],
      create_interface: ['types/', 'src/types/', '@types/'],
      create_table: ['supabase/migrations/', 'migrations/', 'database/'],
      create_migration: ['supabase/migrations/', 'migrations/', 'prisma/migrations/'],
      create_rpc: ['supabase/functions/', 'functions/', 'api/'],
      create_test: ['tests/', '__tests__/', 'src/__tests__/', 'test/'],
      create_cli_command: ['cli/', 'cli/commands/', 'commands/']
    };

    const typePatterns = patterns[taskType] || ['src/', 'lib/'];

    // Find matching directories
    for (const pattern of typePatterns) {
      const matches = directories.filter(d =>
        d.includes(pattern) || d.endsWith(pattern.replace('/', ''))
      );

      if (matches.length > 0) {
        // Use shortest match as most specific
        const best = matches.sort((a, b) => a.length - b.length)[0];

        return {
          suggested: path.join(best, this._generateFileName(taskType, name)),
          confidence: 'high',
          reason: `Found matching directory pattern: ${best}`,
          alternatives: matches.slice(1).map(m =>
            path.join(m, this._generateFileName(taskType, name))
          )
        };
      }
    }

    // Fallback: find similar files
    const extension = this._getExtension(taskType);
    const similarFiles = files.filter(f => f.endsWith(extension));

    if (similarFiles.length > 0) {
      // Use directory of first similar file
      const firstSimilar = similarFiles[0];
      const dir = path.dirname(firstSimilar);

      return {
        suggested: path.join(dir, this._generateFileName(taskType, name)),
        confidence: 'medium',
        reason: `Similar files found in: ${dir}`,
        alternatives: []
      };
    }

    // Ultimate fallback
    return {
      suggested: path.join('src', this._generateFileName(taskType, name)),
      confidence: 'low',
      reason: 'No matching patterns found, using default location'
    };
  }

  /**
   * Generate filename from task type and name
   */
  _generateFileName(taskType, name) {
    const ext = this._getExtension(taskType);

    // Convert name to appropriate format
    switch (taskType) {
      case 'create_component':
        return `${this._toPascalCase(name)}${ext}`;

      case 'create_hook':
        const hookName = name.startsWith('use') ? name : `use${this._toPascalCase(name)}`;
        return `${hookName}${ext}`;

      case 'create_table':
      case 'create_migration':
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        return `${timestamp}_${this._toSnakeCase(name)}${ext}`;

      default:
        return `${this._toKebabCase(name)}${ext}`;
    }
  }

  /**
   * Get file extension for task type
   */
  _getExtension(taskType) {
    const extensions = {
      create_component: '.tsx',
      create_hook: '.ts',
      create_context: '.tsx',
      create_class: '.ts',
      create_function: '.ts',
      create_interface: '.ts',
      create_table: '.sql',
      create_migration: '.sql',
      create_rpc: '.sql',
      create_test: '.test.ts',
      create_cli_command: '.js',
      create_config: '.json',
      create_readme: '.md'
    };

    return extensions[taskType] || '.ts';
  }

  /**
   * Find similar code patterns in the project
   * @param {string} taskType - Task type
   * @param {string} name - Entity name
   * @returns {Promise<Object[]>}
   */
  async findSimilar(taskType, name) {
    const signatures = await this._loadSafe('function-signatures');
    const types = await this._loadSafe('types-map');

    const results = [];

    if (signatures) {
      switch (taskType) {
        case 'create_function':
          results.push(...this._findSimilarFunctions(signatures, name));
          break;

        case 'create_class':
          results.push(...this._findSimilarClasses(signatures, name));
          break;

        case 'create_hook':
          results.push(...this._findSimilarHooks(signatures, name));
          break;

        case 'create_component':
          results.push(...this._findSimilarComponents(signatures, name));
          break;
      }
    }

    if (types && taskType === 'create_interface') {
      results.push(...this._findSimilarTypes(types, name));
    }

    return results.slice(0, 5); // Return top 5
  }

  /**
   * Find similar functions
   */
  _findSimilarFunctions(signatures, name) {
    const functions = signatures.functions || [];
    const nameLower = name.toLowerCase();

    return functions
      .filter(fn => {
        const fnName = (fn.name || '').toLowerCase();
        return fnName.includes(nameLower) || nameLower.includes(fnName);
      })
      .map(fn => ({
        type: 'function',
        name: fn.name,
        file: fn.file,
        line: fn.line,
        signature: fn.signature
      }));
  }

  /**
   * Find similar classes
   */
  _findSimilarClasses(signatures, name) {
    const classes = signatures.classes || {};
    const nameLower = name.toLowerCase();

    return Object.entries(classes)
      .filter(([className]) => {
        const clsLower = className.toLowerCase();
        return clsLower.includes(nameLower) || nameLower.includes(clsLower);
      })
      .map(([className, cls]) => ({
        type: 'class',
        name: className,
        file: cls.file,
        line: cls.line,
        methods: cls.methods?.slice(0, 5)
      }));
  }

  /**
   * Find similar hooks
   */
  _findSimilarHooks(signatures, name) {
    const functions = signatures.functions || [];
    const hooks = signatures.hooks || [];
    const nameLower = name.toLowerCase().replace('use', '');

    const allHooks = [
      ...hooks,
      ...functions.filter(fn => fn.name?.startsWith('use'))
    ];

    return allHooks
      .filter(hook => {
        const hookName = (hook.name || '').toLowerCase().replace('use', '');
        return hookName.includes(nameLower) || nameLower.includes(hookName);
      })
      .map(hook => ({
        type: 'hook',
        name: hook.name,
        file: hook.file,
        line: hook.line,
        returns: hook.returns
      }));
  }

  /**
   * Find similar components
   */
  _findSimilarComponents(signatures, name) {
    const components = signatures.components || [];
    const exports = signatures.exports || [];
    const nameLower = name.toLowerCase();

    const allComponents = [
      ...components,
      ...exports.filter(e => e.type === 'component' || /^[A-Z]/.test(e.name || ''))
    ];

    return allComponents
      .filter(comp => {
        const compName = (comp.name || '').toLowerCase();
        return compName.includes(nameLower) || nameLower.includes(compName);
      })
      .map(comp => ({
        type: 'component',
        name: comp.name,
        file: comp.file,
        line: comp.line,
        props: comp.props
      }));
  }

  /**
   * Find similar types/interfaces
   */
  _findSimilarTypes(types, name) {
    const interfaces = types.interfaces || {};
    const typeAliases = types.types || {};
    const nameLower = name.toLowerCase();

    const results = [];

    for (const [typeName, info] of Object.entries({ ...interfaces, ...typeAliases })) {
      const typeLower = typeName.toLowerCase();
      if (typeLower.includes(nameLower) || nameLower.includes(typeLower)) {
        results.push({
          type: 'interface',
          name: typeName,
          file: info.file,
          line: info.line,
          properties: info.properties?.slice(0, 5)
        });
      }
    }

    return results;
  }

  /**
   * Get import patterns for a file location
   * @param {string} filePath - Target file path
   * @returns {Promise<Object>}
   */
  async getImportPatterns(filePath) {
    const dependencies = await this._loadSafe('dependencies-forward');
    const dir = path.dirname(filePath);

    if (!dependencies) {
      return { patterns: [], siblings: [] };
    }

    // Find files in same directory
    const siblings = Object.keys(dependencies)
      .filter(f => path.dirname(f) === dir)
      .slice(0, 5);

    // Get imports from sibling files
    const patterns = [];

    for (const sibling of siblings) {
      const imports = dependencies[sibling] || [];
      patterns.push({
        file: sibling,
        imports: imports.slice(0, 10)
      });
    }

    return { patterns, siblings };
  }

  /**
   * Lookup type definitions
   * @param {string} typeName - Type to look up
   * @returns {Promise<Object|null>}
   */
  async lookupType(typeName) {
    const types = await this._loadSafe('types-map');

    if (!types) return null;

    // Check interfaces
    if (types.interfaces?.[typeName]) {
      return {
        type: 'interface',
        ...types.interfaces[typeName]
      };
    }

    // Check type aliases
    if (types.types?.[typeName]) {
      return {
        type: 'type',
        ...types.types[typeName]
      };
    }

    // Check enums
    if (types.enums?.[typeName]) {
      return {
        type: 'enum',
        ...types.enums[typeName]
      };
    }

    return null;
  }

  // Utility methods for name conversion
  _toPascalCase(str) {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, c => c.toUpperCase());
  }

  _toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  _toSnakeCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache = {};
  }
}

module.exports = { PlanMapLoader };
