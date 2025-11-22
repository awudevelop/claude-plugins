const fs = require('fs').promises;
const path = require('path');

/**
 * Import/Export Parser for multiple languages
 * Extracts import and export statements from source files
 * Supports: JavaScript, TypeScript, Python, and more
 * Handles: ES6 imports, CommonJS requires, dynamic imports, re-exports
 */

class DependencyParser {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  /**
   * Parse a file and extract all imports and exports
   */
  async parseFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const ext = path.extname(filePath).slice(1);

      if (this.isJavaScriptFile(ext)) {
        return this.parseJavaScript(content, filePath);
      } else if (this.isPythonFile(ext)) {
        return this.parsePython(content, filePath);
      } else if (this.isGoFile(ext)) {
        return this.parseGo(content, filePath);
      } else if (this.isRustFile(ext)) {
        return this.parseRust(content, filePath);
      }

      return { imports: [], exports: [] };

    } catch (error) {
      return { imports: [], exports: [], error: error.message };
    }
  }

  /**
   * Check file types
   */
  isJavaScriptFile(ext) {
    return ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext);
  }

  isPythonFile(ext) {
    return ['py', 'pyi'].includes(ext);
  }

  isGoFile(ext) {
    return ext === 'go';
  }

  isRustFile(ext) {
    return ext === 'rs';
  }

  /**
   * Parse JavaScript/TypeScript files
   */
  parseJavaScript(content, filePath) {
    const imports = [];
    const exports = [];

    // Remove comments to avoid false matches
    const cleanContent = this.removeComments(content);

    // ES6 Import statements
    // import foo from 'bar'
    // import { a, b } from 'bar'
    // import * as foo from 'bar'
    // import 'bar' (side-effect import)
    const importRegex = /import\s+(?:(?:(\w+)|(\*\s+as\s+\w+)|{([^}]+)})\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(cleanContent)) !== null) {
      const defaultImport = match[1];
      const namespaceImport = match[2];
      const namedImports = match[3];
      const source = match[4];

      const symbols = [];
      if (defaultImport) symbols.push(defaultImport);
      if (namespaceImport) symbols.push(namespaceImport);
      if (namedImports) {
        symbols.push(...namedImports.split(',').map(s => s.trim()).filter(Boolean));
      }

      imports.push({
        source: this.resolveImportPath(source, filePath),
        rawSource: source,
        symbols: symbols.length > 0 ? symbols : ['*'],
        type: this.isRelativeImport(source) ? 'internal' : 'external',
        isDynamic: false
      });
    }

    // CommonJS require statements
    // const foo = require('bar')
    // const { a, b } = require('bar')
    const requireRegex = /(?:const|let|var)\s+(?:(\w+)|{([^}]+)})\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(cleanContent)) !== null) {
      const defaultImport = match[1];
      const namedImports = match[2];
      const source = match[3];

      const symbols = [];
      if (defaultImport) symbols.push(defaultImport);
      if (namedImports) {
        symbols.push(...namedImports.split(',').map(s => s.trim()).filter(Boolean));
      }

      imports.push({
        source: this.resolveImportPath(source, filePath),
        rawSource: source,
        symbols,
        type: this.isRelativeImport(source) ? 'internal' : 'external',
        isDynamic: false
      });
    }

    // Dynamic imports
    // import('bar')
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicImportRegex.exec(cleanContent)) !== null) {
      const source = match[1];

      imports.push({
        source: this.resolveImportPath(source, filePath),
        rawSource: source,
        symbols: ['*'],
        type: this.isRelativeImport(source) ? 'internal' : 'external',
        isDynamic: true
      });
    }

    // ES6 Export statements
    // export default foo
    // export const foo = ...
    // export { a, b }
    // export * from 'bar'
    const exportDefaultRegex = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;
    while ((match = exportDefaultRegex.exec(cleanContent)) !== null) {
      exports.push({
        name: match[1] || 'default',
        type: 'default'
      });
    }

    const exportNamedRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    while ((match = exportNamedRegex.exec(cleanContent)) !== null) {
      exports.push({
        name: match[1],
        type: 'named'
      });
    }

    const exportListRegex = /export\s+{([^}]+)}/g;
    while ((match = exportListRegex.exec(cleanContent)) !== null) {
      const names = match[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        // Handle re-naming: export { foo as bar }
        const parts = name.split(/\s+as\s+/);
        exports.push({
          name: parts[parts.length - 1],
          originalName: parts[0],
          type: 'named'
        });
      }
    }

    // Re-exports: export * from 'bar' or export { a } from 'bar'
    const reExportRegex = /export\s+(?:\*|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = reExportRegex.exec(cleanContent)) !== null) {
      const symbols = match[1] ? match[1].split(',').map(s => s.trim()) : ['*'];
      const source = match[2];

      exports.push({
        name: '*',
        type: 're-export',
        from: this.resolveImportPath(source, filePath),
        rawFrom: source,
        symbols
      });

      // Also add as import since re-exports require importing first
      imports.push({
        source: this.resolveImportPath(source, filePath),
        rawSource: source,
        symbols,
        type: this.isRelativeImport(source) ? 'internal' : 'external',
        isDynamic: false
      });
    }

    // module.exports = foo
    const moduleExportsRegex = /module\.exports\s*=\s*(\w+|{[^}]+})/g;
    while ((match = moduleExportsRegex.exec(cleanContent)) !== null) {
      exports.push({
        name: 'default',
        type: 'commonjs',
        value: match[1]
      });
    }

    return { imports, exports };
  }

  /**
   * Parse Python files
   */
  parsePython(content, filePath) {
    const imports = [];
    const exports = [];

    // Remove comments
    const cleanContent = content.replace(/#.*/g, '');

    // import foo
    // import foo as bar
    // import foo, bar
    const importRegex = /^import\s+([^\n]+)/gm;
    let match;
    while ((match = importRegex.exec(cleanContent)) !== null) {
      const importList = match[1].split(',').map(s => s.trim());

      for (const imp of importList) {
        const parts = imp.split(/\s+as\s+/);
        const moduleName = parts[0].trim();
        const alias = parts[1] ? parts[1].trim() : moduleName;

        imports.push({
          source: moduleName,
          rawSource: moduleName,
          symbols: [alias],
          type: this.isPythonStdLib(moduleName) ? 'stdlib' : 'external',
          isDynamic: false
        });
      }
    }

    // from foo import bar
    // from foo import bar as baz
    // from foo import *
    const fromImportRegex = /^from\s+(\S+)\s+import\s+([^\n]+)/gm;
    while ((match = fromImportRegex.exec(cleanContent)) !== null) {
      const source = match[1];
      const importList = match[2].split(',').map(s => s.trim());

      const symbols = [];
      for (const imp of importList) {
        const parts = imp.split(/\s+as\s+/);
        symbols.push(parts[parts.length - 1]);
      }

      imports.push({
        source: this.resolvePythonImport(source, filePath),
        rawSource: source,
        symbols,
        type: source.startsWith('.') ? 'internal' : (this.isPythonStdLib(source) ? 'stdlib' : 'external'),
        isDynamic: false
      });
    }

    // Python exports are implicit - any top-level def/class is exported
    // Extract classes and functions that don't start with _
    const classRegex = /^class\s+(\w+)/gm;
    while ((match = classRegex.exec(cleanContent)) !== null) {
      const name = match[1];
      if (!name.startsWith('_')) {
        exports.push({
          name,
          type: 'class'
        });
      }
    }

    const functionRegex = /^def\s+(\w+)/gm;
    while ((match = functionRegex.exec(cleanContent)) !== null) {
      const name = match[1];
      if (!name.startsWith('_')) {
        exports.push({
          name,
          type: 'function'
        });
      }
    }

    // __all__ = [...]
    const allRegex = /__all__\s*=\s*\[([^\]]+)\]/;
    const allMatch = cleanContent.match(allRegex);
    if (allMatch) {
      const explicitExports = allMatch[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);

      // Mark these as explicit exports
      for (const name of explicitExports) {
        if (!exports.some(e => e.name === name)) {
          exports.push({
            name,
            type: 'explicit'
          });
        }
      }
    }

    return { imports, exports };
  }

  /**
   * Parse Go files
   */
  parseGo(content, filePath) {
    const imports = [];
    const exports = [];

    // import "foo"
    // import foo "bar"
    // import ( ... )
    const singleImportRegex = /import\s+(?:(\w+)\s+)?["']([^"']+)["']/g;
    let match;
    while ((match = singleImportRegex.exec(content)) !== null) {
      const alias = match[1];
      const source = match[2];

      imports.push({
        source,
        rawSource: source,
        symbols: alias ? [alias] : ['*'],
        type: source.includes('.') ? 'external' : 'stdlib',
        isDynamic: false
      });
    }

    const blockImportRegex = /import\s+\(([^)]+)\)/gs;
    const blockMatch = content.match(blockImportRegex);
    if (blockMatch) {
      const importLines = blockMatch[0].match(/(?:(\w+)\s+)?["']([^"']+)["']/g);
      if (importLines) {
        for (const line of importLines) {
          const m = line.match(/(?:(\w+)\s+)?["']([^"']+)["']/);
          if (m) {
            const alias = m[1];
            const source = m[2];

            imports.push({
              source,
              rawSource: source,
              symbols: alias ? [alias] : ['*'],
              type: source.includes('.') ? 'external' : 'stdlib',
              isDynamic: false
            });
          }
        }
      }
    }

    // Go exports are uppercase identifiers
    // func FooBar() or type FooBar struct
    const exportRegex = /(?:func|type)\s+([A-Z]\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        type: 'exported'
      });
    }

    return { imports, exports };
  }

  /**
   * Parse Rust files
   */
  parseRust(content, filePath) {
    const imports = [];
    const exports = [];

    // use foo::bar;
    // use foo::{a, b};
    const useRegex = /use\s+([\w:]+)(?:::{([^}]+)})?/g;
    let match;
    while ((match = useRegex.exec(content)) !== null) {
      const source = match[1];
      const symbols = match[2] ? match[2].split(',').map(s => s.trim()) : [source.split('::').pop()];

      imports.push({
        source,
        rawSource: source,
        symbols,
        type: source.startsWith('crate::') ? 'internal' : 'external',
        isDynamic: false
      });
    }

    // pub fn foo() or pub struct Foo
    const exportRegex = /pub\s+(?:fn|struct|enum|trait|const|static)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        type: 'public'
      });
    }

    return { imports, exports };
  }

  /**
   * Resolve import path to absolute path (for internal imports)
   */
  resolveImportPath(importPath, currentFile) {
    // If it's a relative import, resolve it
    if (this.isRelativeImport(importPath)) {
      const currentDir = path.dirname(currentFile);
      const resolved = path.resolve(currentDir, importPath);

      // Try to find the actual file
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        const relativePath = path.relative(this.projectRoot, fullPath);
        return relativePath;
      }

      return path.relative(this.projectRoot, resolved);
    }

    // External module - return as-is
    return importPath;
  }

  /**
   * Resolve Python import path
   */
  resolvePythonImport(importPath, currentFile) {
    if (importPath.startsWith('.')) {
      // Relative import
      const currentDir = path.dirname(currentFile);
      const resolved = path.join(currentDir, importPath.replace(/\./g, path.sep));
      return path.relative(this.projectRoot, resolved);
    }

    return importPath;
  }

  /**
   * Check if import is relative
   */
  isRelativeImport(importPath) {
    return importPath.startsWith('.') || importPath.startsWith('/');
  }

  /**
   * Check if Python module is stdlib
   */
  isPythonStdLib(moduleName) {
    const stdlibs = [
      'os', 'sys', 'json', 'math', 'random', 'datetime', 'time', 'collections',
      're', 'itertools', 'functools', 'typing', 'pathlib', 'subprocess', 'threading',
      'multiprocessing', 'asyncio', 'unittest', 'pytest', 'argparse', 'logging'
    ];

    return stdlibs.includes(moduleName.split('.')[0]);
  }

  /**
   * Remove comments from JavaScript code
   */
  removeComments(code) {
    // Remove single-line comments
    code = code.replace(/\/\/.*/g, '');

    // Remove multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');

    return code;
  }

  /**
   * Batch parse multiple files
   */
  async parseFiles(filePaths) {
    const results = {};

    for (const filePath of filePaths) {
      results[filePath] = await this.parseFile(filePath);
    }

    return results;
  }
}

module.exports = DependencyParser;
