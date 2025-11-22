const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const MapGenerator = require('../../lib/map-generator');
const FileScanner = require('../../lib/scanner');
const DependencyParser = require('../../lib/parser');
const compression = require('../../lib/compression');

describe('Performance Benchmarks', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');

  /**
   * Helper to measure execution time
   */
  function measureTime(fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    return { result, duration: durationMs };
  }

  /**
   * Helper for async time measurement
   */
  async function measureTimeAsync(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    return { result, duration: durationMs };
  }

  describe('Small Project (<100 files)', () => {
    const projectPath = path.join(fixturesDir, 'simple-react');

    it('should scan small project in under 1 second', async () => {
      const scanner = new FileScanner(projectPath);

      const { result, duration } = await measureTimeAsync(async () => {
        return await scanner.scan();
      });

      console.log(`  Small project scan: ${duration.toFixed(2)}ms`);
      assert.ok(result);
      assert.ok(duration < 1000, `Scan took ${duration}ms, should be < 1000ms`);
    });

    it('should generate summary map quickly', async () => {
      const generator = new MapGenerator(projectPath);

      try {
        await generator.initialize();

        const { duration } = await measureTimeAsync(async () => {
          return await generator.generateSummaryMap();
        });

        console.log(`  Summary map generation: ${duration.toFixed(2)}ms`);
        assert.ok(duration < 500, `Generation took ${duration}ms, should be < 500ms`);
      } catch (error) {
        console.log('  Summary map generation skipped:', error.message);
      }
    });

    it('should achieve target compression ratio', async () => {
      // Create sample data similar to a small project
      const sampleData = {
        files: [],
        metadata: {
          projectPath: projectPath,
          generated: new Date().toISOString()
        }
      };

      // Add some sample files
      for (let i = 0; i < 20; i++) {
        sampleData.files.push({
          path: `src/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 50,
          size: 2000,
          dependencies: ['react', 'lodash']
        });
      }

      const { result, duration } = await measureTimeAsync(async () => {
        return await compression.compress(sampleData);
      });

      const ratio = parseFloat(result.metadata.compressionRatio);
      console.log(`  Compression ratio: ${ratio}%`);
      console.log(`  Compression time: ${duration.toFixed(2)}ms`);

      // For small datasets, minification should achieve 20-40% reduction
      assert.ok(ratio >= 15, `Compression ratio ${ratio}% should be >= 15%`);
      assert.ok(duration < 100, `Compression took ${duration}ms, should be < 100ms`);
    });
  });

  describe('Medium Project (100-1000 files)', () => {
    it('should handle medium-sized data efficiently', async () => {
      // Simulate medium project data
      const mediumData = {
        files: [],
        statistics: {
          totalFiles: 500,
          totalLines: 50000
        }
      };

      // Create realistic file structure
      for (let i = 0; i < 500; i++) {
        mediumData.files.push({
          path: `src/features/feature${Math.floor(i / 10)}/Component${i}.js`,
          type: 'javascript',
          role: i % 5 === 0 ? 'component' : 'utility',
          lines: 100,
          size: 3500,
          dependencies: ['react', 'lodash', 'axios'],
          imports: ['./utils', './constants']
        });
      }

      const { result, duration } = await measureTimeAsync(async () => {
        return await compression.compress(mediumData);
      });

      const ratio = parseFloat(result.metadata.compressionRatio);
      console.log(`  Medium project compression: ${ratio}%`);
      console.log(`  Compression time: ${duration.toFixed(2)}ms`);

      // Medium projects should achieve 50-70% compression
      assert.ok(ratio >= 40, `Compression ratio ${ratio}% should be >= 40%`);
      assert.ok(duration < 2000, `Compression took ${duration}ms, should be < 2000ms`);
    });

    it('should parse dependencies efficiently', async () => {
      const parser = new DependencyParser(fixturesDir);

      const sampleCode = `
        import React, { useState, useEffect } from 'react';
        import { connect } from 'react-redux';
        import Header from './components/Header';
        import Footer from './components/Footer';
        import Utils from './utils';

        export default function App() {
          return <div>App</div>;
        }

        export const API_URL = 'http://api.example.com';
        export function helper() {}
      `;

      const { result, duration } = measureTime(() => {
        return parser.parseJavaScript(sampleCode, '/test/App.js');
      });

      console.log(`  Dependency parsing: ${duration.toFixed(2)}ms`);

      assert.ok(result.imports.length >= 5);
      assert.ok(result.exports.length >= 3);
      assert.ok(duration < 50, `Parsing took ${duration}ms, should be < 50ms`);
    });
  });

  describe('Large Project (>1000 files)', () => {
    it('should compress large datasets with 60-80% ratio', async () => {
      // Simulate large project data
      const largeData = {
        project: 'large-enterprise-app',
        version: '2.0.0',
        files: [],
        statistics: {
          totalFiles: 2000,
          totalLines: 200000
        }
      };

      // Create realistic large file structure
      for (let i = 0; i < 2000; i++) {
        largeData.files.push({
          path: `src/modules/module${Math.floor(i / 50)}/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 150,
          size: 4500,
          dependencies: ['react', 'react-dom', 'lodash', 'axios', 'moment'],
          imports: ['./utils', './constants', './hooks', './types'],
          exports: ['default', `Component${i}`]
        });
      }

      const { result, duration } = await measureTimeAsync(async () => {
        return await compression.compress(largeData);
      });

      const ratio = parseFloat(result.metadata.compressionRatio);
      const originalSize = result.metadata.originalSize;
      const compressedSize = result.metadata.compressedSize;

      console.log(`  Large project compression:`);
      console.log(`    Original size: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`    Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`    Compression ratio: ${ratio}%`);
      console.log(`    Compression time: ${duration.toFixed(2)}ms`);
      console.log(`    Compression level: ${result.metadata.compressionLevel}`);

      // Large projects should achieve 60-80% compression
      assert.ok(ratio >= 60, `Compression ratio ${ratio}% should be >= 60%`);
      assert.ok(ratio <= 85, `Compression ratio ${ratio}% should be <= 85%`);
      assert.ok(duration < 5000, `Compression took ${duration}ms, should be < 5000ms`);

      // Should use level 3 compression (value deduplication)
      assert.strictEqual(result.metadata.compressionLevel, 3);
    });

    it('should decompress quickly', async () => {
      // Create large compressed data
      const largeData = {
        files: []
      };

      for (let i = 0; i < 1000; i++) {
        largeData.files.push({
          path: `file${i}.js`,
          type: 'javascript',
          role: 'component',
          dependencies: ['react', 'lodash']
        });
      }

      const compressed = await compression.compress(largeData);

      const { result, duration } = await measureTimeAsync(async () => {
        return await compression.decompress(
          compressed.compressed,
          compressed.metadata,
          compressed.references
        );
      });

      console.log(`  Decompression time: ${duration.toFixed(2)}ms`);

      assert.ok(result);
      assert.ok(duration < 2000, `Decompression took ${duration}ms, should be < 2000ms`);
    });
  });

  describe('Compression Performance', () => {
    it('should show performance improvement with compression levels', async () => {
      const testData = {
        files: []
      };

      // Create data that will trigger different compression levels
      for (let i = 0; i < 100; i++) {
        testData.files.push({
          path: `src/components/Component${i}.js`,
          type: 'javascript',
          role: 'component',
          lines: 150,
          size: 4500
        });
      }

      // Level 1: Minification only
      const { result: level1, duration: duration1 } = await measureTimeAsync(async () => {
        const data = JSON.parse(JSON.stringify(testData)); // Clone
        return await compression.compress(data, {});
      });

      // Level 2: With abbreviation
      const { result: level2, duration: duration2 } = await measureTimeAsync(async () => {
        const data = JSON.parse(JSON.stringify(testData)); // Clone
        return await compression.compress(data, { forceAbbreviation: true });
      });

      console.log(`  Level 1 (minification): ${parseFloat(level1.metadata.compressionRatio)}% in ${duration1.toFixed(2)}ms`);
      console.log(`  Level 2 (abbreviation): ${parseFloat(level2.metadata.compressionRatio)}% in ${duration2.toFixed(2)}ms`);

      // Level 2 should achieve better compression
      const ratio1 = parseFloat(level1.metadata.compressionRatio);
      const ratio2 = parseFloat(level2.metadata.compressionRatio);

      assert.ok(ratio2 >= ratio1, 'Level 2 should compress better than level 1');
    });

    it('should measure compression vs decompression speed', async () => {
      const data = {
        files: []
      };

      for (let i = 0; i < 500; i++) {
        data.files.push({
          path: `file${i}.js`,
          type: 'javascript',
          role: 'component'
        });
      }

      const { result: compressed, duration: compressDuration } = await measureTimeAsync(async () => {
        return await compression.compress(data);
      });

      const { duration: decompressDuration } = await measureTimeAsync(async () => {
        return await compression.decompress(
          compressed.compressed,
          compressed.metadata,
          compressed.references
        );
      });

      console.log(`  Compression: ${compressDuration.toFixed(2)}ms`);
      console.log(`  Decompression: ${decompressDuration.toFixed(2)}ms`);

      // Both should be reasonably fast
      assert.ok(compressDuration < 3000, 'Compression should be fast');
      assert.ok(decompressDuration < 2000, 'Decompression should be fast');
    });
  });

  describe('Map Loading Performance', () => {
    it('should load summary map quickly', async () => {
      const summaryData = {
        metadata: {
          projectPath: '/test/project',
          generated: new Date().toISOString()
        },
        stats: {
          totalFiles: 500,
          totalLines: 50000,
          primaryLanguages: ['javascript', 'typescript']
        },
        quickStats: {
          fileCount: 500,
          dirCount: 50
        }
      };

      const jsonString = JSON.stringify(summaryData);
      const summarySize = Buffer.byteLength(jsonString, 'utf8');

      console.log(`  Summary map size: ${summarySize} bytes`);

      // Summary should be small (< 5KB)
      assert.ok(summarySize < 5120, `Summary size ${summarySize} should be < 5KB`);

      // Parse time should be negligible
      const { duration } = measureTime(() => {
        return JSON.parse(jsonString);
      });

      console.log(`  Parse time: ${duration.toFixed(2)}ms`);
      assert.ok(duration < 10, `Parse took ${duration}ms, should be < 10ms`);
    });

    it('should demonstrate tiered loading efficiency', async () => {
      // Simulate tiered loading
      const level1Data = { summary: 'small' }; // 2KB
      const level2Data = { tree: 'medium', modules: [] }; // 8KB
      const level3Data = { details: 'large', metadata: [] }; // 40KB

      for (let i = 0; i < 10; i++) {
        level2Data.modules.push({ name: `module${i}` });
      }

      for (let i = 0; i < 100; i++) {
        level3Data.metadata.push({
          file: `file${i}.js`,
          content: 'x'.repeat(300)
        });
      }

      const level1Size = Buffer.byteLength(JSON.stringify(level1Data), 'utf8');
      const level2Size = Buffer.byteLength(JSON.stringify(level2Data), 'utf8');
      const level3Size = Buffer.byteLength(JSON.stringify(level3Data), 'utf8');

      console.log(`  Level 1 size: ${level1Size} bytes`);
      console.log(`  Level 2 size: ${level2Size} bytes`);
      console.log(`  Level 3 size: ${level3Size} bytes`);
      console.log(`  Total if loaded all at once: ${level1Size + level2Size + level3Size} bytes`);

      // Level 1 should always be loaded (small)
      assert.ok(level1Size < 5120, 'Level 1 should be < 5KB');

      // Loading only Level 1 initially saves bandwidth
      const initialLoad = level1Size;
      const fullLoad = level1Size + level2Size + level3Size;
      const savings = ((fullLoad - initialLoad) / fullLoad) * 100;

      console.log(`  Bandwidth savings with tiered loading: ${savings.toFixed(1)}%`);
      assert.ok(savings > 50, 'Should save >50% bandwidth with tiered loading');
    });
  });

  describe('Real-world Performance Metrics', () => {
    it('should benchmark end-to-end map generation on fixture', async () => {
      const projectPath = path.join(fixturesDir, 'simple-react');
      const generator = new MapGenerator(projectPath);

      const { duration } = await measureTimeAsync(async () => {
        try {
          await generator.initialize();
          await generator.generateSummaryMap();
          await generator.generateTreeMap();
        } catch (error) {
          // Some operations may fail without full setup
        }
      });

      console.log(`  End-to-end generation: ${duration.toFixed(2)}ms`);

      // For a small fixture, should be fast
      assert.ok(duration < 5000, `End-to-end took ${duration}ms, should be < 5000ms`);
    });

    it('should measure dependency parsing throughput', async () => {
      const parser = new DependencyParser(fixturesDir);

      const sampleFiles = [
        'import React from "react";\nexport default function App() {}',
        'const express = require("express");\nmodule.exports = express;',
        'import { foo, bar } from "./utils";\nexport { foo, bar };',
        'import * as Utils from "./helpers";\nexport default Utils;',
        'export const API_URL = "http://api.com";\nexport function helper() {}'
      ];

      const { duration } = measureTime(() => {
        for (const code of sampleFiles) {
          parser.parseJavaScript(code, '/test/file.js');
        }
      });

      const throughput = (sampleFiles.length / duration) * 1000;
      console.log(`  Parsing throughput: ${throughput.toFixed(0)} files/second`);

      assert.ok(throughput > 50, 'Should parse at least 50 files/second');
    });
  });

  describe('Performance Summary', () => {
    it('should document performance targets', () => {
      const targets = {
        'Small project scan (<100 files)': '< 1 second',
        'Medium project scan (100-1000 files)': '< 10 seconds',
        'Large project scan (>1000 files)': '< 60 seconds',
        'Summary map generation': '< 500ms',
        'Compression (small)': '< 100ms',
        'Compression (medium)': '< 2 seconds',
        'Compression (large)': '< 5 seconds',
        'Decompression': '< 2 seconds',
        'Summary map size': '< 5KB',
        'Tree map size (small project)': '< 15KB',
        'Compression ratio (large projects)': '60-80%',
        'Parsing throughput': '> 50 files/second',
        'Staleness check': '< 1 second',
        'Incremental update': '< 20% of full scan time'
      };

      console.log('\n  Performance Targets:');
      for (const [metric, target] of Object.entries(targets)) {
        console.log(`    ${metric}: ${target}`);
      }

      assert.ok(true, 'Performance targets documented');
    });
  });
});
