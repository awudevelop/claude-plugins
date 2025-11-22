const fs = require('fs').promises;
const path = require('path');

/**
 * Multi-level compression utility for project context maps
 * Implements 3 compression strategies based on file size:
 * 1. Minification (all files) - 20-30% reduction
 * 2. Key abbreviation (>5KB) - 30-40% additional reduction
 * 3. Value deduplication (>20KB) - 40-50% additional reduction
 * Target: 60-80% total size reduction
 */

class CompressionUtility {
  constructor() {
    this.schemaPath = path.join(process.env.HOME, '.claude/project-maps/schemas/.compression-schema.json');
    this.schema = null;
  }

  /**
   * Load compression schema
   */
  async loadSchema() {
    if (this.schema) return this.schema;

    try {
      const schemaContent = await fs.readFile(this.schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      return this.schema;
    } catch (error) {
      throw new Error(`Failed to load compression schema: ${error.message}`);
    }
  }

  /**
   * Level 1: Minify JSON (remove whitespace)
   * Applied to all files
   */
  minify(data) {
    return JSON.stringify(data);
  }

  /**
   * Level 2: Abbreviate keys using schema mappings
   * Applied to files > 5KB
   */
  abbreviateKeys(obj, schema) {
    if (!schema || !schema.keyMappings || !schema.keyMappings.mappings) {
      return obj;
    }

    const mappings = schema.keyMappings.mappings;
    const reverseMap = {};

    // Create reverse mapping (fullName -> abbreviation)
    for (const [abbrev, full] of Object.entries(mappings)) {
      reverseMap[full] = abbrev;
    }

    const abbreviate = (item) => {
      if (Array.isArray(item)) {
        return item.map(abbreviate);
      }

      if (item && typeof item === 'object') {
        const abbreviated = {};
        for (const [key, value] of Object.entries(item)) {
          const newKey = reverseMap[key] || key;
          abbreviated[newKey] = abbreviate(value);
        }
        return abbreviated;
      }

      return item;
    };

    return abbreviate(obj);
  }

  /**
   * Level 3: Deduplicate repeated values using reference tables
   * Applied to files > 20KB
   */
  deduplicateValues(obj, schema) {
    if (!schema || !schema.valueReferences) {
      return obj;
    }

    const valueTables = {
      fileTypes: new Map(),
      fileRoles: new Map(),
      commonPaths: new Map(),
      frequentImports: new Map()
    };

    // First pass: collect frequent values
    const collectValues = (item, key) => {
      if (typeof item === 'string' && item.length > 3) {
        if (key === 'type' || key === 't') {
          const existing = valueTables.fileTypes.get(item) || 0;
          valueTables.fileTypes.set(item, existing + 1);
        } else if (key === 'role' || key === 'r') {
          const existing = valueTables.fileRoles.get(item) || 0;
          valueTables.fileRoles.set(item, existing + 1);
        } else if (key === 'path' || key === 'p') {
          const existing = valueTables.commonPaths.get(item) || 0;
          valueTables.commonPaths.set(item, existing + 1);
        } else if (key === 'import') {
          const existing = valueTables.frequentImports.get(item) || 0;
          valueTables.frequentImports.set(item, existing + 1);
        }
      }

      if (Array.isArray(item)) {
        item.forEach((val, idx) => collectValues(val, key));
      } else if (item && typeof item === 'object') {
        for (const [k, v] of Object.entries(item)) {
          collectValues(v, k);
        }
      }
    };

    collectValues(obj, null);

    // Build reference tables (only values that appear 3+ times)
    const refTables = {
      fileTypes: [],
      fileRoles: [],
      commonPaths: [],
      frequentImports: []
    };

    for (const [table, map] of Object.entries(valueTables)) {
      const filtered = Array.from(map.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .map(([value, _]) => value);
      refTables[table] = filtered;
    }

    // Second pass: replace values with references
    const deduplicate = (item, key) => {
      if (typeof item === 'string') {
        let tableKey = null;
        let table = null;

        if (key === 'type' || key === 't') {
          tableKey = 'fileTypes';
          table = refTables.fileTypes;
        } else if (key === 'role' || key === 'r') {
          tableKey = 'fileRoles';
          table = refTables.fileRoles;
        } else if (key === 'path' || key === 'p') {
          tableKey = 'commonPaths';
          table = refTables.commonPaths;
        } else if (key === 'import') {
          tableKey = 'frequentImports';
          table = refTables.frequentImports;
        }

        if (table) {
          const index = table.indexOf(item);
          if (index !== -1) {
            return `@${tableKey}:${index}`;
          }
        }
      }

      if (Array.isArray(item)) {
        return item.map((val, idx) => deduplicate(val, key));
      }

      if (item && typeof item === 'object') {
        const deduplicated = {};
        for (const [k, v] of Object.entries(item)) {
          deduplicated[k] = deduplicate(v, k);
        }
        return deduplicated;
      }

      return item;
    };

    const deduplicated = deduplicate(obj, null);

    return {
      data: deduplicated,
      references: refTables
    };
  }

  /**
   * Compress data with appropriate level based on size
   */
  async compress(data, options = {}) {
    await this.loadSchema();

    const originalJson = JSON.stringify(data);
    const originalSize = Buffer.byteLength(originalJson, 'utf8');

    let compressed = data;
    let compressionLevel = 1;
    let references = null;

    // Level 1: Always minify
    compressed = this.minify(compressed);
    let compressedSize = Buffer.byteLength(compressed, 'utf8');

    // Level 2: Abbreviate keys if > 5KB
    if (originalSize > 5120 || options.forceAbbreviation) {
      compressed = JSON.parse(compressed);
      compressed = this.abbreviateKeys(compressed, this.schema);
      compressed = this.minify(compressed);
      compressedSize = Buffer.byteLength(compressed, 'utf8');
      compressionLevel = 2;
    }

    // Level 3: Deduplicate values if > 20KB
    if (originalSize > 20480 || options.forceDeduplication) {
      compressed = JSON.parse(compressed);
      const result = this.deduplicateValues(compressed, this.schema);
      compressed = result.data;
      references = result.references;
      compressed = this.minify(compressed);
      compressedSize = Buffer.byteLength(compressed, 'utf8');
      compressionLevel = 3;
    }

    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    return {
      compressed: typeof compressed === 'string' ? compressed : JSON.stringify(compressed),
      metadata: {
        originalSize,
        compressedSize,
        compressionRatio: `${compressionRatio}%`,
        compressionLevel,
        method: compressionLevel === 1 ? 'minification' :
                compressionLevel === 2 ? 'key-abbreviation' : 'value-deduplication',
        timestamp: new Date().toISOString()
      },
      references
    };
  }

  /**
   * Decompress data back to original format
   */
  async decompress(compressedData, metadata, references = null) {
    await this.loadSchema();

    let data = typeof compressedData === 'string' ?
      JSON.parse(compressedData) : compressedData;

    // Reverse level 3: Restore deduplicated values
    if (metadata.compressionLevel >= 3 && references) {
      const restore = (item, key) => {
        if (typeof item === 'string' && item.startsWith('@')) {
          const match = item.match(/@([^:]+):(\d+)/);
          if (match) {
            const [_, tableKey, index] = match;
            const table = references[tableKey];
            if (table && table[parseInt(index)] !== undefined) {
              return table[parseInt(index)];
            }
          }
        }

        if (Array.isArray(item)) {
          return item.map((val, idx) => restore(val, key));
        }

        if (item && typeof item === 'object') {
          const restored = {};
          for (const [k, v] of Object.entries(item)) {
            restored[k] = restore(v, k);
          }
          return restored;
        }

        return item;
      };

      data = restore(data, null);
    }

    // Reverse level 2: Expand abbreviated keys
    if (metadata.compressionLevel >= 2) {
      const mappings = this.schema.keyMappings.mappings;

      const expand = (item) => {
        if (Array.isArray(item)) {
          return item.map(expand);
        }

        if (item && typeof item === 'object') {
          const expanded = {};
          for (const [key, value] of Object.entries(item)) {
            const fullKey = mappings[key] || key;
            expanded[fullKey] = expand(value);
          }
          return expanded;
        }

        return item;
      };

      data = expand(data);
    }

    return data;
  }

  /**
   * Compress and save to file
   */
  async compressAndSave(data, outputPath, options = {}) {
    const result = await this.compress(data, options);

    const fileContent = {
      version: '1.0',
      compressed: true,
      metadata: result.metadata,
      references: result.references,
      data: result.compressed
    };

    await fs.writeFile(outputPath, JSON.stringify(fileContent), 'utf8');

    return result.metadata;
  }

  /**
   * Load and decompress from file
   */
  async loadAndDecompress(inputPath) {
    const fileContent = await fs.readFile(inputPath, 'utf8');
    const parsed = JSON.parse(fileContent);

    if (!parsed.compressed) {
      return parsed.data || parsed;
    }

    return await this.decompress(
      parsed.data,
      parsed.metadata,
      parsed.references
    );
  }
}

module.exports = new CompressionUtility();
