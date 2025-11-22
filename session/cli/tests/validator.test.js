const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const MapValidator = require('../lib/validator');

describe('Map Validator Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testMapsDir = path.join(fixturesDir, 'test-maps');

  beforeEach(async () => {
    // Create test maps directory
    await fs.mkdir(testMapsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test maps
    try {
      await fs.rm(testMapsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('File Completeness Validation', () => {
    it('should pass when all required files exist', async () => {
      // Create all required files
      const requiredFiles = [
        'summary.json',
        'tree.json',
        'metadata.json',
        'content-summaries.json',
        'dependencies-forward.json',
        'dependencies-reverse.json'
      ];

      for (const file of requiredFiles) {
        await fs.writeFile(
          path.join(testMapsDir, file),
          JSON.stringify({ data: 'test' })
        );
      }

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateFileCompleteness();

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.missingRequired.length, 0);
    });

    it('should fail when required files are missing', async () => {
      // Create only some files
      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify({ data: 'test' })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateFileCompleteness();

      assert.strictEqual(result.passed, false);
      assert.ok(result.missingRequired.length > 0);
    });

    it('should warn about missing optional files', async () => {
      // Create all required files
      const requiredFiles = [
        'summary.json',
        'tree.json',
        'metadata.json',
        'content-summaries.json',
        'dependencies-forward.json',
        'dependencies-reverse.json'
      ];

      for (const file of requiredFiles) {
        await fs.writeFile(
          path.join(testMapsDir, file),
          JSON.stringify({ data: 'test' })
        );
      }

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateFileCompleteness();

      // Should pass but have warnings about optional files
      assert.strictEqual(result.passed, true);
      assert.ok(result.missingOptional.length > 0);
    });
  });

  describe('Reference Validation', () => {
    it('should detect broken file references', async () => {
      // Create metadata with file list
      const metadata = {
        files: [
          { path: 'src/index.js', type: 'javascript' },
          { path: 'src/utils.js', type: 'javascript' }
        ]
      };

      // Create dependencies with reference to non-existent file
      const forwardDeps = {
        dependencies: {
          'src/index.js': {
            imports: [
              { source: 'src/missing.js', type: 'internal' }
            ]
          }
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify(forwardDeps)
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateReferences();

      assert.strictEqual(result.passed, false);
      assert.ok(result.brokenReferences.length > 0);
    });

    it('should pass when all references are valid', async () => {
      const metadata = {
        files: [
          { path: 'src/index.js', type: 'javascript' },
          { path: 'src/utils.js', type: 'javascript' }
        ]
      };

      const forwardDeps = {
        dependencies: {
          'src/index.js': {
            imports: [
              { source: 'src/utils.js', type: 'internal' }
            ]
          }
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify(forwardDeps)
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateReferences();

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.brokenReferences.length, 0);
    });

    it('should ignore external dependencies', async () => {
      const metadata = {
        files: [
          { path: 'src/index.js', type: 'javascript' }
        ]
      };

      const forwardDeps = {
        dependencies: {
          'src/index.js': {
            imports: [
              { source: 'react', type: 'external' },
              { source: 'lodash', type: 'external' }
            ]
          }
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify(forwardDeps)
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateReferences();

      // Should pass - external deps are not validated
      assert.strictEqual(result.passed, true);
    });
  });

  describe('Schema Compliance Validation', () => {
    it('should validate summary.json schema', async () => {
      const validSummary = {
        metadata: {
          projectPath: '/test/project',
          generated: new Date().toISOString()
        },
        stats: {
          totalFiles: 100,
          totalLines: 10000
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(validSummary)
      );

      // Create other required files
      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify({ files: [] })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify({ dependencies: {} })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateSchemaCompliance();

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.violations.length, 0);
    });

    it('should detect missing required fields', async () => {
      const invalidSummary = {
        // Missing metadata and stats
        someField: 'value'
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(invalidSummary)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify({ files: [] })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify({ dependencies: {} })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateSchemaCompliance();

      assert.strictEqual(result.passed, false);
      assert.ok(result.violations.length > 0);
    });

    it('should validate metadata file entries', async () => {
      const metadata = {
        files: [
          { path: 'valid.js', type: 'javascript' },
          { type: 'javascript' }, // Missing path
          { path: 'missing-type.js' } // Missing type
        ]
      };

      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify({ metadata: { projectPath: '/test' }, stats: {} })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify({ dependencies: {} })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateSchemaCompliance();

      assert.strictEqual(result.passed, false);
      assert.ok(result.violations.some(v => v.includes('missing path')));
      assert.ok(result.violations.some(v => v.includes('missing type')));
    });
  });

  describe('Data Integrity Validation', () => {
    it('should detect file count mismatch', async () => {
      const summary = {
        metadata: { projectPath: '/test' },
        stats: { totalFiles: 100 }
      };

      const metadata = {
        files: [
          { path: 'file1.js', type: 'javascript' },
          { path: 'file2.js', type: 'javascript' }
          // Only 2 files, but summary says 100
        ]
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(summary)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify({ dependencies: {} })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-reverse.json'),
        JSON.stringify({ dependencies: {} })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateDataIntegrity();

      assert.strictEqual(result.passed, false);
      assert.ok(result.inconsistencies.some(i => i.type === 'file-count-mismatch'));
    });

    it('should validate forward/reverse dependency consistency', async () => {
      const summary = {
        metadata: { projectPath: '/test' },
        stats: { totalFiles: 2 }
      };

      const metadata = {
        files: [
          { path: 'fileA.js', type: 'javascript' },
          { path: 'fileB.js', type: 'javascript' }
        ]
      };

      const forwardDeps = {
        dependencies: {
          'fileA.js': {
            imports: [
              { source: 'fileB.js', type: 'internal' }
            ]
          }
        }
      };

      const reverseDeps = {
        dependencies: {
          'fileB.js': {
            importedBy: [
              { file: 'fileA.js', symbols: [] }
            ]
          }
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(summary)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify(metadata)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify(forwardDeps)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-reverse.json'),
        JSON.stringify(reverseDeps)
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateDataIntegrity();

      // Should pass - forward and reverse are consistent
      assert.strictEqual(result.passed, true);
    });

    it('should check for staleness information', async () => {
      const summaryWithStaleness = {
        metadata: { projectPath: '/test' },
        stats: { totalFiles: 0 },
        staleness: {
          gitHash: 'abc123',
          fileCount: 0,
          lastRefresh: new Date().toISOString()
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(summaryWithStaleness)
      );
      await fs.writeFile(
        path.join(testMapsDir, 'metadata.json'),
        JSON.stringify({ files: [] })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-forward.json'),
        JSON.stringify({ dependencies: {} })
      );
      await fs.writeFile(
        path.join(testMapsDir, 'dependencies-reverse.json'),
        JSON.stringify({ dependencies: {} })
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateDataIntegrity();

      // Should pass with complete staleness info
      assert.strictEqual(result.passed, true);
    });
  });

  describe('Full Validation', () => {
    it('should run all validation checks', async () => {
      // Create valid map set
      const summary = {
        metadata: { projectPath: '/test' },
        stats: { totalFiles: 1 },
        staleness: {
          gitHash: 'abc123',
          fileCount: 1,
          lastRefresh: new Date().toISOString()
        }
      };

      const metadata = {
        files: [
          { path: 'index.js', type: 'javascript' }
        ]
      };

      const forwardDeps = {
        dependencies: {
          'index.js': {
            imports: []
          }
        }
      };

      const reverseDeps = {
        dependencies: {}
      };

      await fs.writeFile(path.join(testMapsDir, 'summary.json'), JSON.stringify(summary));
      await fs.writeFile(path.join(testMapsDir, 'tree.json'), JSON.stringify({ tree: {} }));
      await fs.writeFile(path.join(testMapsDir, 'metadata.json'), JSON.stringify(metadata));
      await fs.writeFile(path.join(testMapsDir, 'content-summaries.json'), JSON.stringify({ summaries: {} }));
      await fs.writeFile(path.join(testMapsDir, 'dependencies-forward.json'), JSON.stringify(forwardDeps));
      await fs.writeFile(path.join(testMapsDir, 'dependencies-reverse.json'), JSON.stringify(reverseDeps));

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const results = await validator.validateAll();

      assert.strictEqual(results.valid, true);
      assert.strictEqual(results.errors.length, 0);
      assert.ok(results.checks.fileCompleteness);
      assert.ok(results.checks.brokenReferences);
      assert.ok(results.checks.schemaCompliance);
      assert.ok(results.checks.dataIntegrity);
    });

    it('should generate validation report', async () => {
      // Create minimal valid maps
      await fs.writeFile(path.join(testMapsDir, 'summary.json'), JSON.stringify({
        metadata: { projectPath: '/test' },
        stats: { totalFiles: 0 }
      }));
      await fs.writeFile(path.join(testMapsDir, 'tree.json'), JSON.stringify({ tree: {} }));
      await fs.writeFile(path.join(testMapsDir, 'metadata.json'), JSON.stringify({ files: [] }));
      await fs.writeFile(path.join(testMapsDir, 'content-summaries.json'), JSON.stringify({ summaries: {} }));
      await fs.writeFile(path.join(testMapsDir, 'dependencies-forward.json'), JSON.stringify({ dependencies: {} }));
      await fs.writeFile(path.join(testMapsDir, 'dependencies-reverse.json'), JSON.stringify({ dependencies: {} }));

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const results = await validator.validateAll();
      const report = validator.generateReport(results);

      assert.ok(report);
      assert.ok(typeof report === 'string');
      assert.ok(report.includes('Validation Report'));
      assert.ok(report.includes('Errors:') || report.includes('Warnings:'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle corrupted JSON files', async () => {
      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        'invalid json {['
      );

      const validator = new MapValidator(fixturesDir, testMapsDir);

      // Should not crash, but should report error
      await assert.rejects(
        async () => await validator.validateSchemaCompliance(),
        'Should reject with JSON parse error'
      );
    });

    it('should handle empty maps directory', async () => {
      const validator = new MapValidator(fixturesDir, testMapsDir);
      const result = await validator.validateFileCompleteness();

      assert.strictEqual(result.passed, false);
      assert.ok(result.missingRequired.length > 0);
    });

    it('should handle compressed map format', async () => {
      const compressedSummary = {
        compressed: true,
        data: JSON.stringify({
          metadata: { projectPath: '/test' },
          stats: { totalFiles: 0 }
        }),
        metadata: {
          compressionLevel: 1
        }
      };

      await fs.writeFile(
        path.join(testMapsDir, 'summary.json'),
        JSON.stringify(compressedSummary)
      );
      await fs.writeFile(path.join(testMapsDir, 'metadata.json'), JSON.stringify({ files: [] }));
      await fs.writeFile(path.join(testMapsDir, 'dependencies-forward.json'), JSON.stringify({ dependencies: {} }));

      const validator = new MapValidator(fixturesDir, testMapsDir);
      const map = await validator.loadMap('summary.json');

      assert.ok(map.metadata);
      assert.ok(map.stats);
    });
  });
});
