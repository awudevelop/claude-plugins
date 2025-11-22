const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const compressionModule = require('../lib/compression');

describe('Compression Utility', () => {
  const testSchemaDir = path.join(process.env.HOME, '.claude/project-maps/schemas');
  const schemaPath = path.join(testSchemaDir, '.compression-schema.json');
  let originalSchema = null;

  const testSchema = {
    version: '1.0',
    keyMappings: {
      mappings: {
        'p': 'path',
        't': 'type',
        'r': 'role',
        'd': 'dependencies',
        'i': 'imports',
        'e': 'exports',
        'l': 'lines',
        's': 'size'
      }
    },
    valueReferences: {
      fileTypes: [],
      fileRoles: [],
      commonPaths: [],
      frequentImports: []
    }
  };

  beforeEach(async () => {
    // Backup existing schema if it exists
    try {
      const existing = await fs.readFile(schemaPath, 'utf8');
      originalSchema = existing;
    } catch (error) {
      // No existing schema
    }

    // Create test schema
    await fs.mkdir(testSchemaDir, { recursive: true });
    await fs.writeFile(schemaPath, JSON.stringify(testSchema, null, 2));

    // Reset the singleton instance
    compressionModule.schema = null;
  });

  afterEach(async () => {
    // Restore original schema or remove test schema
    if (originalSchema) {
      await fs.writeFile(schemaPath, originalSchema);
    } else {
      try {
        await fs.unlink(schemaPath);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('Level 1: Minification', () => {
    it('should minify JSON by removing whitespace', () => {
      const data = {
        name: 'test',
        value: 123,
        nested: {
          key: 'value'
        }
      };

      const minified = compressionModule.minify(data);
      assert.strictEqual(typeof minified, 'string');
      assert.strictEqual(minified.includes('\n'), false);
      assert.strictEqual(minified.includes('  '), false);

      const parsed = JSON.parse(minified);
      assert.deepStrictEqual(parsed, data);
    });

    it('should achieve 20-30% reduction for formatted JSON', () => {
      const data = {
        files: [
          { path: 'src/index.js', type: 'javascript' },
          { path: 'src/app.js', type: 'javascript' },
          { path: 'src/utils.js', type: 'javascript' }
        ]
      };

      const formatted = JSON.stringify(data, null, 2);
      const minified = compressionModule.minify(data);

      const reduction = ((formatted.length - minified.length) / formatted.length) * 100;
      assert.ok(reduction >= 20, `Reduction ${reduction}% should be >= 20%`);
    });
  });

  describe('Level 2: Key Abbreviation', () => {
    it('should abbreviate keys using schema mappings', async () => {
      await compressionModule.loadSchema();

      const data = {
        path: '/src/index.js',
        type: 'javascript',
        role: 'entry',
        dependencies: ['react', 'lodash']
      };

      const abbreviated = compressionModule.abbreviateKeys(data, compressionModule.schema);

      assert.strictEqual(abbreviated.p, '/src/index.js');
      assert.strictEqual(abbreviated.t, 'javascript');
      assert.strictEqual(abbreviated.r, 'entry');
      assert.deepStrictEqual(abbreviated.d, ['react', 'lodash']);
    });

    it('should handle nested objects', async () => {
      await compressionModule.loadSchema();

      const data = {
        path: '/src/index.js',
        imports: [
          { path: './utils', type: 'local' },
          { path: 'react', type: 'external' }
        ]
      };

      const abbreviated = compressionModule.abbreviateKeys(data, compressionModule.schema);

      assert.strictEqual(abbreviated.p, '/src/index.js');
      assert.strictEqual(abbreviated.i[0].p, './utils');
      assert.strictEqual(abbreviated.i[0].t, 'local');
    });

    it('should preserve unknown keys', async () => {
      await compressionModule.loadSchema();

      const data = {
        path: '/src/index.js',
        customField: 'value',
        unknownKey: 123
      };

      const abbreviated = compressionModule.abbreviateKeys(data, compressionModule.schema);

      assert.strictEqual(abbreviated.p, '/src/index.js');
      assert.strictEqual(abbreviated.customField, 'value');
      assert.strictEqual(abbreviated.unknownKey, 123);
    });
  });

  describe('Level 3: Value Deduplication', () => {
    it('should deduplicate repeated values', async () => {
      await compressionModule.loadSchema();

      const data = {
        files: [
          { type: 'javascript', role: 'component' },
          { type: 'javascript', role: 'component' },
          { type: 'javascript', role: 'component' },
          { type: 'javascript', role: 'component' }
        ]
      };

      const result = compressionModule.deduplicateValues(data, compressionModule.schema);

      assert.ok(result.references);
      assert.ok(result.references.fileTypes.includes('javascript'));
      assert.ok(result.references.fileRoles.includes('component'));

      // Check that values were replaced with references
      const firstFile = result.data.files[0];
      assert.ok(firstFile.type.startsWith('@fileTypes:'));
      assert.ok(firstFile.role.startsWith('@fileRoles:'));
    });

    it('should only deduplicate values appearing 3+ times', async () => {
      await compressionModule.loadSchema();

      const data = {
        files: [
          { type: 'javascript' },
          { type: 'javascript' },
          { type: 'css' },
          { type: 'css' }
        ]
      };

      const result = compressionModule.deduplicateValues(data, compressionModule.schema);

      // 'javascript' appears 2 times, shouldn't be deduplicated
      assert.strictEqual(result.references.fileTypes.length, 0);
    });

    it('should handle multiple reference tables', async () => {
      await compressionModule.loadSchema();

      const data = {
        files: [
          { type: 'javascript', role: 'component', path: '/src/components/A.js' },
          { type: 'javascript', role: 'component', path: '/src/components/B.js' },
          { type: 'javascript', role: 'component', path: '/src/components/C.js' },
          { type: 'javascript', role: 'utility', path: '/src/utils/D.js' }
        ]
      };

      const result = compressionModule.deduplicateValues(data, compressionModule.schema);

      assert.ok(result.references.fileTypes.includes('javascript'));
      assert.ok(result.references.fileRoles.includes('component'));
    });
  });

  describe('Compression Levels', () => {
    it('should use level 1 for small files (<5KB)', async () => {
      const data = { small: 'data', value: 123 };

      const result = await compressionModule.compress(data);

      assert.strictEqual(result.metadata.compressionLevel, 1);
      assert.strictEqual(result.metadata.method, 'minification');
    });

    it('should use level 2 for medium files (>5KB)', async () => {
      // Create data > 5KB
      const files = [];
      for (let i = 0; i < 100; i++) {
        files.push({
          path: `/src/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 150,
          size: 4500
        });
      }
      const data = { files };

      const result = await compressionModule.compress(data);

      assert.ok(result.metadata.compressionLevel >= 2);
      assert.ok(['key-abbreviation', 'value-deduplication'].includes(result.metadata.method));
    });

    it('should use level 3 for large files (>20KB)', async () => {
      // Create data > 20KB
      const files = [];
      for (let i = 0; i < 500; i++) {
        files.push({
          path: `/src/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 150,
          size: 4500,
          dependencies: ['react', 'lodash', 'axios'],
          imports: ['./utils', './constants']
        });
      }
      const data = { files };

      const result = await compressionModule.compress(data);

      assert.strictEqual(result.metadata.compressionLevel, 3);
      assert.strictEqual(result.metadata.method, 'value-deduplication');
      assert.ok(result.references);
    });

    it('should achieve 60-80% compression for large datasets', async () => {
      // Create realistic large dataset
      const files = [];
      for (let i = 0; i < 500; i++) {
        files.push({
          path: `/src/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 150,
          size: 4500,
          dependencies: ['react', 'react-dom', 'lodash', 'axios'],
          imports: ['./utils', './constants', './hooks'],
          exports: ['default', 'Component' + i]
        });
      }
      const data = {
        project: 'test-project',
        version: '1.0.0',
        files
      };

      const result = await compressionModule.compress(data);

      const compressionRatio = parseFloat(result.metadata.compressionRatio);
      assert.ok(compressionRatio >= 60, `Compression ratio ${compressionRatio}% should be >= 60%`);
      assert.ok(compressionRatio <= 85, `Compression ratio ${compressionRatio}% should be <= 85%`);
    });
  });

  describe('Compression/Decompression Round-trip', () => {
    it('should restore original data after compression/decompression', async () => {
      const data = {
        path: '/src/index.js',
        type: 'javascript',
        role: 'entry',
        dependencies: ['react', 'lodash'],
        imports: [
          { path: './utils', type: 'local' },
          { path: 'react', type: 'external' }
        ]
      };

      const result = await compressionModule.compress(data, { forceAbbreviation: true });
      const decompressed = await compressionModule.decompress(
        result.compressed,
        result.metadata,
        result.references
      );

      assert.deepStrictEqual(decompressed, data);
    });

    it('should handle deduplication round-trip', async () => {
      const data = {
        files: [
          { type: 'javascript', role: 'component', path: '/a.js' },
          { type: 'javascript', role: 'component', path: '/b.js' },
          { type: 'javascript', role: 'component', path: '/c.js' },
          { type: 'javascript', role: 'utility', path: '/d.js' }
        ]
      };

      const result = await compressionModule.compress(data, { forceDeduplication: true });
      const decompressed = await compressionModule.decompress(
        result.compressed,
        result.metadata,
        result.references
      );

      assert.deepStrictEqual(decompressed, data);
    });
  });

  describe('File Operations', () => {
    const testOutputPath = path.join(__dirname, 'fixtures', 'test-compressed.json');

    afterEach(async () => {
      try {
        await fs.unlink(testOutputPath);
      } catch (error) {
        // Ignore
      }
    });

    it('should compress and save to file', async () => {
      const data = {
        path: '/src/index.js',
        type: 'javascript',
        role: 'entry'
      };

      const metadata = await compressionModule.compressAndSave(data, testOutputPath);

      assert.ok(metadata);
      assert.ok(metadata.originalSize > 0);
      assert.ok(metadata.compressedSize > 0);

      const fileExists = await fs.access(testOutputPath).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, true);
    });

    it('should load and decompress from file', async () => {
      const data = {
        path: '/src/index.js',
        type: 'javascript',
        role: 'entry',
        dependencies: ['react']
      };

      await compressionModule.compressAndSave(data, testOutputPath, { forceAbbreviation: true });
      const loaded = await compressionModule.loadAndDecompress(testOutputPath);

      assert.deepStrictEqual(loaded, data);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', async () => {
      const data = {};
      const result = await compressionModule.compress(data);

      assert.ok(result.compressed);
      assert.strictEqual(result.metadata.compressionLevel, 1);
    });

    it('should handle arrays', async () => {
      const data = [1, 2, 3, 4, 5];
      const result = await compressionModule.compress(data);

      const decompressed = await compressionModule.decompress(
        result.compressed,
        result.metadata,
        result.references
      );

      assert.deepStrictEqual(decompressed, data);
    });

    it('should handle null and undefined values', async () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        nested: {
          nullValue: null
        }
      };

      const result = await compressionModule.compress(data);
      const decompressed = await compressionModule.decompress(
        result.compressed,
        result.metadata,
        result.references
      );

      // undefined gets stripped by JSON.stringify
      assert.strictEqual(decompressed.nullValue, null);
      assert.strictEqual(decompressed.nested.nullValue, null);
    });
  });
});
