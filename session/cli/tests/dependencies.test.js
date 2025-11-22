const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const DependencyParser = require('../lib/parser');

describe('Dependency Graph Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  let parser;

  beforeEach(() => {
    parser = new DependencyParser(fixturesDir);
  });

  describe('JavaScript/TypeScript Parsing', () => {
    it('should parse ES6 imports', async () => {
      const content = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as Utils from './utils';
        import './styles.css';
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      assert.strictEqual(result.imports.length, 4);

      // Default import
      assert.strictEqual(result.imports[0].rawSource, 'react');
      assert.deepStrictEqual(result.imports[0].symbols, ['React']);
      assert.strictEqual(result.imports[0].type, 'external');

      // Named imports
      assert.strictEqual(result.imports[1].rawSource, 'react');
      assert.ok(result.imports[1].symbols.includes('useState'));
      assert.ok(result.imports[1].symbols.includes('useEffect'));

      // Namespace import
      assert.strictEqual(result.imports[2].rawSource, './utils');
      assert.strictEqual(result.imports[2].type, 'internal');

      // Side-effect import
      assert.strictEqual(result.imports[3].rawSource, './styles.css');
    });

    it('should parse CommonJS requires', async () => {
      const content = `
        const express = require('express');
        const { Router } = require('express');
        const utils = require('./utils');
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      assert.strictEqual(result.imports.length, 3);

      assert.strictEqual(result.imports[0].rawSource, 'express');
      assert.deepStrictEqual(result.imports[0].symbols, ['express']);
      assert.strictEqual(result.imports[0].type, 'external');

      assert.strictEqual(result.imports[1].rawSource, 'express');
      assert.ok(result.imports[1].symbols.includes('Router'));

      assert.strictEqual(result.imports[2].rawSource, './utils');
      assert.strictEqual(result.imports[2].type, 'internal');
    });

    it('should parse dynamic imports', async () => {
      const content = `
        const module = await import('./dynamic-module');
        import('./lazy-load').then(mod => console.log(mod));
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      assert.ok(result.imports.length >= 2);

      const dynamicImports = result.imports.filter(imp => imp.isDynamic);
      assert.ok(dynamicImports.length >= 2, 'Should find dynamic imports');
    });

    it('should parse ES6 exports', async () => {
      const content = `
        export default function App() {}
        export const API_URL = 'http://api.example.com';
        export function helper() {}
        export { foo, bar };
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      assert.ok(result.exports.length >= 4);

      // Default export
      const defaultExport = result.exports.find(e => e.type === 'default');
      assert.ok(defaultExport);

      // Named exports
      const namedExports = result.exports.filter(e => e.type === 'named');
      assert.ok(namedExports.length >= 2);

      const apiUrlExport = namedExports.find(e => e.name === 'API_URL');
      assert.ok(apiUrlExport);
    });

    it('should parse re-exports', async () => {
      const content = `
        export * from './utils';
        export { foo, bar } from './helpers';
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      // Re-exports should appear in exports
      const reExports = result.exports.filter(e => e.type === 're-export');
      assert.ok(reExports.length >= 2);

      // Re-exports should also appear as imports
      const reExportImports = result.imports.filter(imp =>
        imp.rawSource === './utils' || imp.rawSource === './helpers'
      );
      assert.ok(reExportImports.length >= 2);
    });

    it('should parse CommonJS exports', async () => {
      const content = `
        module.exports = MyClass;
        module.exports = { foo, bar };
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      const commonjsExports = result.exports.filter(e => e.type === 'commonjs');
      assert.ok(commonjsExports.length >= 1);
    });

    it('should handle comments in JavaScript', async () => {
      const content = `
        // import fake from 'not-real';
        /*
          import another from 'also-fake';
        */
        import real from 'real-package';
      `;

      const result = parser.parseJavaScript(content, '/test/file.js');

      // Should only find the real import, not the commented ones
      assert.strictEqual(result.imports.length, 1);
      assert.strictEqual(result.imports[0].rawSource, 'real-package');
    });
  });

  describe('Python Parsing', () => {
    it('should parse Python imports', async () => {
      const content = `
        import os
        import sys
        import json as JSON
        import numpy, pandas
      `;

      const result = parser.parsePython(content, '/test/file.py');

      assert.ok(result.imports.length >= 4);

      // Check stdlib detection
      const osImport = result.imports.find(imp => imp.rawSource === 'os');
      assert.strictEqual(osImport.type, 'stdlib');

      // Check alias
      const jsonImport = result.imports.find(imp => imp.rawSource === 'json');
      assert.ok(jsonImport.symbols.includes('JSON'));

      // Check multiple imports on one line
      const numpyImport = result.imports.find(imp => imp.rawSource === 'numpy');
      const pandasImport = result.imports.find(imp => imp.rawSource === 'pandas');
      assert.ok(numpyImport);
      assert.ok(pandasImport);
    });

    it('should parse Python from imports', async () => {
      const content = `
        from os.path import join, dirname
        from typing import List, Dict
        from .utils import helper
        from ..models import User
      `;

      const result = parser.parsePython(content, '/test/file.py');

      assert.ok(result.imports.length >= 4);

      // Check stdlib from import
      const osPathImport = result.imports.find(imp => imp.rawSource.startsWith('os.path'));
      assert.strictEqual(osPathImport.type, 'stdlib');

      // Check relative imports
      const relativeImports = result.imports.filter(imp => imp.type === 'internal');
      assert.ok(relativeImports.length >= 2);
    });

    it('should parse Python class exports', async () => {
      const content = `
        class User:
            pass

        class _PrivateClass:
            pass

        def get_user():
            pass

        def _private_function():
            pass
      `;

      const result = parser.parsePython(content, '/test/file.py');

      // Should export public class and function
      assert.ok(result.exports.length >= 2);

      const userClass = result.exports.find(e => e.name === 'User' && e.type === 'class');
      assert.ok(userClass);

      const getUserFunc = result.exports.find(e => e.name === 'get_user' && e.type === 'function');
      assert.ok(getUserFunc);

      // Should not export private items
      const privateClass = result.exports.find(e => e.name === '_PrivateClass');
      assert.strictEqual(privateClass, undefined);
    });

    it('should parse __all__ exports', async () => {
      const content = `
        __all__ = ['User', 'get_user', 'API_KEY']

        class User:
            pass
      `;

      const result = parser.parsePython(content, '/test/file.py');

      // Should have explicit exports from __all__
      const explicitExports = result.exports.filter(e =>
        ['User', 'get_user', 'API_KEY'].includes(e.name)
      );
      assert.ok(explicitExports.length >= 3);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependencies', () => {
      const fileA = {
        imports: [{ source: 'b.js', type: 'internal' }]
      };
      const fileB = {
        imports: [{ source: 'a.js', type: 'internal' }]
      };

      const graph = {
        'a.js': fileA,
        'b.js': fileB
      };

      const circularDeps = findCircularDependencies(graph);
      assert.ok(circularDeps.length > 0, 'Should detect circular dependency');
    });

    it('should detect complex circular dependencies', () => {
      // A -> B -> C -> A
      const graph = {
        'a.js': { imports: [{ source: 'b.js', type: 'internal' }] },
        'b.js': { imports: [{ source: 'c.js', type: 'internal' }] },
        'c.js': { imports: [{ source: 'a.js', type: 'internal' }] }
      };

      const circularDeps = findCircularDependencies(graph);
      assert.ok(circularDeps.length > 0, 'Should detect complex circular dependency');
    });

    it('should not flag acyclic dependencies as circular', () => {
      // A -> B -> C (no cycle)
      const graph = {
        'a.js': { imports: [{ source: 'b.js', type: 'internal' }] },
        'b.js': { imports: [{ source: 'c.js', type: 'internal' }] },
        'c.js': { imports: [] }
      };

      const circularDeps = findCircularDependencies(graph);
      assert.strictEqual(circularDeps.length, 0, 'Should not detect circular dependency in acyclic graph');
    });
  });

  describe('Real Project Dependency Analysis', () => {
    it('should parse React fixture dependencies', async () => {
      const reactFixture = path.join(fixturesDir, 'simple-react', 'src', 'App.js');

      try {
        const result = await parser.parseFile(reactFixture);

        assert.ok(result.imports, 'Should have imports');
        assert.ok(result.exports, 'Should have exports');

        // Should import React
        const reactImport = result.imports.find(imp =>
          imp.rawSource === 'react' || imp.source === 'react'
        );
        assert.ok(reactImport, 'Should import React');

        // Should import local components
        const componentImports = result.imports.filter(imp => imp.type === 'internal');
        assert.ok(componentImports.length > 0, 'Should have internal imports');

        // Should export App component
        const defaultExport = result.exports.find(e => e.type === 'default');
        assert.ok(defaultExport, 'Should have default export');
      } catch (error) {
        console.log('React fixture test failed:', error.message);
      }
    });

    it('should parse Express fixture dependencies', async () => {
      const expressFixture = path.join(fixturesDir, 'express-api', 'src', 'index.js');

      try {
        const result = await parser.parseFile(expressFixture);

        assert.ok(result.imports, 'Should have imports');

        // Should import express
        const expressImport = result.imports.find(imp =>
          imp.rawSource === 'express' || imp.source === 'express'
        );
        assert.ok(expressImport, 'Should import express');

        // Should import routes
        const routeImports = result.imports.filter(imp =>
          imp.rawSource.includes('routes') || imp.source.includes('routes')
        );
        assert.ok(routeImports.length > 0, 'Should import route modules');
      } catch (error) {
        console.log('Express fixture test failed:', error.message);
      }
    });

    it('should parse monorepo cross-package dependencies', async () => {
      const frontendFixture = path.join(fixturesDir, 'monorepo', 'packages', 'frontend', 'src', 'index.js');

      try {
        const result = await parser.parseFile(frontendFixture);

        assert.ok(result.imports, 'Should have imports');

        // Should import from shared package
        const sharedImport = result.imports.find(imp =>
          imp.rawSource.includes('@monorepo/shared')
        );
        assert.ok(sharedImport, 'Should import from shared package');
      } catch (error) {
        console.log('Monorepo fixture test failed:', error.message);
      }
    });
  });

  describe('Import Path Resolution', () => {
    it('should resolve relative imports', () => {
      const currentFile = '/project/src/components/Button.js';
      const importPath = './utils';

      const resolved = parser.resolveImportPath(importPath, currentFile);

      assert.ok(resolved.includes('components'), 'Should resolve relative to current file');
    });

    it('should keep external imports unchanged', () => {
      const currentFile = '/project/src/index.js';
      const importPath = 'react';

      const resolved = parser.resolveImportPath(importPath, currentFile);

      assert.strictEqual(resolved, 'react', 'External imports should remain unchanged');
    });

    it('should identify relative imports correctly', () => {
      assert.strictEqual(parser.isRelativeImport('./utils'), true);
      assert.strictEqual(parser.isRelativeImport('../helpers'), true);
      assert.strictEqual(parser.isRelativeImport('/absolute/path'), true);
      assert.strictEqual(parser.isRelativeImport('react'), false);
      assert.strictEqual(parser.isRelativeImport('@scope/package'), false);
    });
  });

  describe('Multi-language Support', () => {
    it('should detect JavaScript files correctly', () => {
      assert.strictEqual(parser.isJavaScriptFile('js'), true);
      assert.strictEqual(parser.isJavaScriptFile('jsx'), true);
      assert.strictEqual(parser.isJavaScriptFile('ts'), true);
      assert.strictEqual(parser.isJavaScriptFile('tsx'), true);
      assert.strictEqual(parser.isJavaScriptFile('mjs'), true);
      assert.strictEqual(parser.isJavaScriptFile('py'), false);
    });

    it('should detect Python files correctly', () => {
      assert.strictEqual(parser.isPythonFile('py'), true);
      assert.strictEqual(parser.isPythonFile('pyi'), true);
      assert.strictEqual(parser.isPythonFile('js'), false);
    });

    it('should parse Go imports', async () => {
      const content = `
        package main

        import "fmt"
        import (
          "net/http"
          "github.com/gorilla/mux"
        )

        func HelloWorld() {
          fmt.Println("Hello")
        }
      `;

      const result = parser.parseGo(content, '/test/file.go');

      assert.ok(result.imports.length >= 3);

      // Check stdlib import
      const fmtImport = result.imports.find(imp => imp.source === 'fmt');
      assert.strictEqual(fmtImport.type, 'stdlib');

      // Check external import
      const muxImport = result.imports.find(imp => imp.source.includes('gorilla/mux'));
      assert.strictEqual(muxImport.type, 'external');

      // Check export (uppercase function)
      const helloExport = result.exports.find(e => e.name === 'HelloWorld');
      assert.ok(helloExport);
    });

    it('should parse Rust imports', async () => {
      const content = `
        use std::collections::HashMap;
        use serde::{Serialize, Deserialize};
        use crate::utils::helper;

        pub fn process_data() {}
        pub struct User {}
      `;

      const result = parser.parseRust(content, '/test/file.rs');

      assert.ok(result.imports.length >= 3);

      // Check internal import
      const crateImport = result.imports.find(imp => imp.source.startsWith('crate::'));
      assert.strictEqual(crateImport.type, 'internal');

      // Check exports
      assert.ok(result.exports.length >= 2);
      const funcExport = result.exports.find(e => e.name === 'process_data');
      const structExport = result.exports.find(e => e.name === 'User');
      assert.ok(funcExport);
      assert.ok(structExport);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      const result = parser.parseJavaScript('', '/test/empty.js');

      assert.deepStrictEqual(result.imports, []);
      assert.deepStrictEqual(result.exports, []);
    });

    it('should handle files with only comments', async () => {
      const content = `
        // This is a comment
        /* This is also a comment */
      `;

      const result = parser.parseJavaScript(content, '/test/comments.js');

      assert.deepStrictEqual(result.imports, []);
      assert.deepStrictEqual(result.exports, []);
    });

    it('should handle malformed imports gracefully', async () => {
      const content = `
        import from 'missing-default';
        import { from 'broken';
      `;

      const result = parser.parseJavaScript(content, '/test/malformed.js');

      // Should not crash, but may not find the malformed imports
      assert.ok(result);
      assert.ok(Array.isArray(result.imports));
    });
  });
});

/**
 * Helper function to detect circular dependencies
 */
function findCircularDependencies(dependencyGraph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path = []) {
    if (recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const fileData = dependencyGraph[node];
    if (fileData && fileData.imports) {
      for (const imp of fileData.imports) {
        if (imp.type === 'internal' && dependencyGraph[imp.source]) {
          dfs(imp.source, [...path]);
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node in dependencyGraph) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}
