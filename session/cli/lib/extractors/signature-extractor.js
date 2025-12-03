/**
 * Signature Extractor for JavaScript/TypeScript
 * Extracts function signatures, class methods, parameters, and types
 * Uses regex-based parsing (no external AST dependencies)
 */

const fs = require('fs').promises;
const path = require('path');

class SignatureExtractor {
  constructor() {
    // Track statistics during extraction
    this.stats = {
      totalFunctions: 0,
      totalClasses: 0,
      totalMethods: 0,
      byKind: {
        functions: 0,
        arrowFunctions: 0,
        asyncFunctions: 0,
        generators: 0,
        methods: 0,
        getters: 0,
        setters: 0,
        constructors: 0
      },
      byVisibility: {
        public: 0,
        private: 0,
        protected: 0
      },
      withTypeAnnotations: 0,
      withJsdoc: 0,
      filesProcessed: 0
    };
  }

  /**
   * Parse a JavaScript file and extract all function signatures
   * @param {string} source - File content
   * @param {string} filePath - Relative file path
   * @returns {Object} Extracted functions and classes
   */
  parseJavaScriptFile(source, filePath) {
    const result = {
      functions: [],
      classes: []
    };

    // Store original source for line number calculation
    const lines = source.split('\n');

    // Remove multi-line comments but preserve line structure for line counting
    const cleanSource = this.preserveLineStructure(source);

    // Extract JSDoc comments mapped by line number
    const jsdocMap = this.extractJSDocComments(source);

    // Extract standalone functions
    result.functions = this.extractFunctions(cleanSource, filePath, jsdocMap, lines);

    // Extract classes with their methods
    result.classes = this.extractClasses(cleanSource, filePath, jsdocMap, lines);

    this.stats.filesProcessed++;

    return result;
  }

  /**
   * Preserve line structure while removing comments
   * Replaces comments with whitespace of same length to preserve line numbers
   */
  preserveLineStructure(source) {
    // Remove single-line comments
    let result = source.replace(/\/\/[^\n]*/g, match => ' '.repeat(match.length));

    // Remove multi-line comments while preserving newlines
    result = result.replace(/\/\*[\s\S]*?\*\//g, match => {
      return match.split('\n').map((line, i) =>
        i === 0 ? ' '.repeat(line.length) : '\n' + ' '.repeat(line.length - 1)
      ).join('');
    });

    return result;
  }

  /**
   * Extract JSDoc comments and map them to their target line
   * @returns {Map<number, Object>} Map of line number to JSDoc info
   */
  extractJSDocComments(source) {
    const jsdocMap = new Map();
    const jsdocRegex = /\/\*\*\s*([\s\S]*?)\s*\*\//g;

    let match;
    while ((match = jsdocRegex.exec(source)) !== null) {
      const jsdocContent = match[1];
      const endIndex = match.index + match[0].length;

      // Find the line number after the JSDoc
      const linesBefore = source.slice(0, endIndex).split('\n');
      const targetLine = linesBefore.length; // Next line after JSDoc

      const parsed = this.parseJSDoc(jsdocContent);
      if (parsed) {
        jsdocMap.set(targetLine, parsed);
        // Also set for a few lines after to handle blank lines
        jsdocMap.set(targetLine + 1, parsed);
        jsdocMap.set(targetLine + 2, parsed);
      }
    }

    return jsdocMap;
  }

  /**
   * Parse JSDoc content into structured object
   */
  parseJSDoc(content) {
    const result = {
      description: '',
      params: [],
      returns: null,
      throws: [],
      examples: [],
      deprecated: null,
      see: [],
      since: null,
      tags: {}
    };

    // Clean up content
    const lines = content.split('\n').map(line =>
      line.replace(/^\s*\*\s?/, '').trim()
    ).filter(Boolean);

    let currentTag = null;
    let descriptionLines = [];

    for (const line of lines) {
      const tagMatch = line.match(/^@(\w+)\s*(.*)/);

      if (tagMatch) {
        const [, tag, value] = tagMatch;
        currentTag = tag;

        switch (tag) {
          case 'param': {
            const paramMatch = value.match(/^\{([^}]+)\}\s*(\[?\w+\]?)\s*[-–]?\s*(.*)/);
            if (paramMatch) {
              const [, type, name, desc] = paramMatch;
              result.params.push({
                name: name.replace(/[\[\]]/g, ''),
                type: type,
                description: desc,
                optional: name.startsWith('[')
              });
            }
            break;
          }
          case 'returns':
          case 'return': {
            const returnMatch = value.match(/^\{([^}]+)\}\s*(.*)/);
            if (returnMatch) {
              result.returns = {
                type: returnMatch[1],
                description: returnMatch[2]
              };
            }
            break;
          }
          case 'throws':
          case 'throw': {
            const throwMatch = value.match(/^\{([^}]+)\}\s*(.*)/);
            if (throwMatch) {
              result.throws.push({
                type: throwMatch[1],
                description: throwMatch[2]
              });
            }
            break;
          }
          case 'example':
            result.examples.push(value);
            break;
          case 'deprecated':
            result.deprecated = value || true;
            break;
          case 'see':
            result.see.push(value);
            break;
          case 'since':
            result.since = value;
            break;
          default:
            result.tags[tag] = value;
        }
      } else if (!currentTag) {
        descriptionLines.push(line);
      } else if (currentTag === 'example') {
        // Continuation of example
        result.examples[result.examples.length - 1] += '\n' + line;
      }
    }

    result.description = descriptionLines.join(' ').trim();

    // Return null if no useful content
    if (!result.description && result.params.length === 0 && !result.returns) {
      return null;
    }

    return result;
  }

  /**
   * Extract standalone functions from source
   */
  extractFunctions(source, filePath, jsdocMap, lines) {
    const functions = [];

    // Pattern for regular function declarations
    // function name(params) { or async function name(params) { or function* name(params) {
    const funcDeclRegex = /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*(\*)?\s*(\w+)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;

    // Pattern for arrow functions assigned to const/let/var
    // const name = (params) => or const name = async (params) =>
    const arrowFuncRegex = /(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*(?::\s*([^=]+))?\s*=\s*(async\s+)?(?:\(([^)]*)\)|(\w+))\s*(?::\s*([^=]+))?\s*=>/g;

    // Pattern for object method shorthand (for module.exports = { methodName() {} })
    const methodShorthandRegex = /^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/gm;

    let match;

    // Extract regular function declarations
    while ((match = funcDeclRegex.exec(source)) !== null) {
      const isGenerator = match[1] === '*';
      const name = match[2] || 'anonymous';
      const paramsStr = match[3];
      const returnType = match[4]?.trim();

      const lineNumber = this.getLineNumber(source, match.index);
      const isAsync = source.slice(Math.max(0, match.index - 20), match.index).includes('async');
      const isExported = source.slice(Math.max(0, match.index - 30), match.index).includes('export');
      const isDefault = source.slice(Math.max(0, match.index - 30), match.index).includes('default');

      const jsdoc = this.findJSDoc(jsdocMap, lineNumber);

      const func = {
        name,
        kind: isGenerator ? 'generator' : (isAsync ? 'async' : 'function'),
        parameters: this.parseParameters(paramsStr),
        returnType: returnType ? this.parseTypeAnnotation(returnType) : null,
        isExported,
        isDefault,
        jsdoc,
        location: {
          file: filePath,
          line: lineNumber
        }
      };

      functions.push(func);
      this.stats.totalFunctions++;

      if (isGenerator) this.stats.byKind.generators++;
      else if (isAsync) this.stats.byKind.asyncFunctions++;
      else this.stats.byKind.functions++;

      if (returnType) this.stats.withTypeAnnotations++;
      if (jsdoc) this.stats.withJsdoc++;
    }

    // Extract arrow functions
    while ((match = arrowFuncRegex.exec(source)) !== null) {
      const name = match[1];
      const typeAnnotation = match[2]?.trim();
      const isAsync = !!match[3];
      const paramsStr = match[4] || match[5] || '';
      const returnType = match[6]?.trim();

      const lineNumber = this.getLineNumber(source, match.index);
      const isExported = source.slice(Math.max(0, match.index - 20), match.index).includes('export');
      const isDefault = source.slice(Math.max(0, match.index - 20), match.index).includes('default');

      const jsdoc = this.findJSDoc(jsdocMap, lineNumber);

      const func = {
        name,
        kind: isAsync ? 'async' : 'arrow',
        parameters: this.parseParameters(paramsStr),
        returnType: returnType ? this.parseTypeAnnotation(returnType) : null,
        isExported,
        isDefault,
        jsdoc,
        location: {
          file: filePath,
          line: lineNumber
        }
      };

      functions.push(func);
      this.stats.totalFunctions++;
      this.stats.byKind.arrowFunctions++;

      if (returnType || typeAnnotation) this.stats.withTypeAnnotations++;
      if (jsdoc) this.stats.withJsdoc++;
    }

    return functions;
  }

  /**
   * Extract classes and their methods
   */
  extractClasses(source, filePath, jsdocMap, lines) {
    const classes = [];

    // Pattern for class declarations
    const classRegex = /(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{/g;

    let match;
    while ((match = classRegex.exec(source)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      const implementsStr = match[3];

      const classStartLine = this.getLineNumber(source, match.index);
      const isAbstract = source.slice(Math.max(0, match.index - 20), match.index).includes('abstract');
      const isExported = source.slice(Math.max(0, match.index - 30), match.index).includes('export');
      const isDefault = source.slice(Math.max(0, match.index - 30), match.index).includes('default');

      // Find class body end
      const classBody = this.extractBracedContent(source, match.index + match[0].length - 1);
      const classEndLine = classStartLine + classBody.split('\n').length - 1;

      const jsdoc = this.findJSDoc(jsdocMap, classStartLine);

      // Extract methods from class body
      const { methods, properties, constructorSig } = this.extractClassMembers(
        classBody,
        filePath,
        classStartLine,
        jsdocMap
      );

      const classObj = {
        name: className,
        extends: extendsClass || null,
        implements: implementsStr ? implementsStr.split(',').map(s => s.trim()) : [],
        isAbstract,
        isExported,
        isDefault,
        constructor: constructorSig,
        methods,
        properties,
        jsdoc,
        location: {
          file: filePath,
          line: classStartLine,
          endLine: classEndLine
        }
      };

      classes.push(classObj);
      this.stats.totalClasses++;
      this.stats.totalMethods += methods.length;
      if (jsdoc) this.stats.withJsdoc++;
    }

    return classes;
  }

  /**
   * Extract class members (methods and properties)
   */
  extractClassMembers(classBody, filePath, classStartLine, jsdocMap) {
    const methods = [];
    const properties = [];
    let constructorSig = null;

    // Pattern for class methods
    // [visibility] [static] [async] methodName(params) [: returnType] {
    const methodRegex = /(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?(?:(get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;

    // Pattern for class properties
    // [visibility] [static] [readonly] propName[?]: type [= value];
    const propRegex = /(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)(\?)?\s*(?::\s*([^;=]+))?(?:\s*=\s*[^;]+)?;/g;

    let match;

    // Extract methods
    while ((match = methodRegex.exec(classBody)) !== null) {
      const visibility = match[1] || 'public';
      const isStatic = !!match[2];
      const isAsync = !!match[3];
      const accessorKind = match[4]; // get or set
      const name = match[5];
      const paramsStr = match[6];
      const returnType = match[7]?.trim();

      const relativeLineNumber = this.getLineNumber(classBody, match.index);
      const absoluteLineNumber = classStartLine + relativeLineNumber - 1;

      const jsdoc = this.findJSDoc(jsdocMap, absoluteLineNumber);

      if (name === 'constructor') {
        constructorSig = {
          name: 'constructor',
          kind: 'constructor',
          parameters: this.parseParameters(paramsStr),
          location: { file: filePath, line: absoluteLineNumber }
        };
        this.stats.byKind.constructors++;
        continue;
      }

      const method = {
        name,
        kind: accessorKind || 'method',
        visibility,
        isStatic,
        isAsync,
        parameters: this.parseParameters(paramsStr),
        returnType: returnType ? this.parseTypeAnnotation(returnType) : null,
        jsdoc,
        location: { file: filePath, line: absoluteLineNumber }
      };

      methods.push(method);

      // Update stats
      this.stats.byVisibility[visibility]++;
      if (accessorKind === 'get') this.stats.byKind.getters++;
      else if (accessorKind === 'set') this.stats.byKind.setters++;
      else this.stats.byKind.methods++;

      if (returnType) this.stats.withTypeAnnotations++;
      if (jsdoc) this.stats.withJsdoc++;
    }

    // Extract properties
    while ((match = propRegex.exec(classBody)) !== null) {
      const visibility = match[1] || 'public';
      const isStatic = !!match[2];
      const isReadonly = !!match[3];
      const name = match[4];
      const isOptional = !!match[5];
      const type = match[6]?.trim();

      // Skip if it looks like a method (matched by method regex)
      if (classBody.slice(match.index + match[0].length).trimStart().startsWith('{')) {
        continue;
      }

      const relativeLineNumber = this.getLineNumber(classBody, match.index);
      const absoluteLineNumber = classStartLine + relativeLineNumber - 1;

      const property = {
        name,
        visibility,
        isStatic,
        isReadonly,
        isOptional,
        type: type ? this.parseTypeAnnotation(type) : null,
        location: { file: filePath, line: absoluteLineNumber }
      };

      properties.push(property);
      this.stats.byVisibility[visibility]++;
    }

    return { methods, properties, constructorSig };
  }

  /**
   * Parse parameter string into structured parameter objects
   */
  parseParameters(paramsStr) {
    if (!paramsStr || !paramsStr.trim()) return [];

    const params = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    // Handle nested brackets and strings
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];

      if (inString) {
        current += char;
        if (char === stringChar && paramsStr[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(' || char === '[' || char === '{' || char === '<') {
        depth++;
        current += char;
        continue;
      }

      if (char === ')' || char === ']' || char === '}' || char === '>') {
        depth--;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        if (current.trim()) {
          params.push(this.parseParameter(current.trim()));
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      params.push(this.parseParameter(current.trim()));
    }

    return params;
  }

  /**
   * Parse a single parameter
   */
  parseParameter(paramStr) {
    const param = {
      name: '',
      isOptional: false,
      isRest: false,
      hasDefault: false,
      pattern: 'identifier'
    };

    // Check for rest parameter
    if (paramStr.startsWith('...')) {
      param.isRest = true;
      paramStr = paramStr.slice(3);
    }

    // Check for destructuring
    if (paramStr.startsWith('{')) {
      param.pattern = 'object';
      param.name = this.extractDestructuringNames(paramStr);

      // Check for type annotation after destructuring
      const typeMatch = paramStr.match(/\}\s*:\s*([^=]+?)(?:\s*=|$)/);
      if (typeMatch) {
        param.type = this.parseTypeAnnotation(typeMatch[1].trim());
      }

      // Check for default value
      if (paramStr.includes('=')) {
        param.hasDefault = true;
      }

      return param;
    }

    if (paramStr.startsWith('[')) {
      param.pattern = 'array';
      param.name = this.extractDestructuringNames(paramStr);

      const typeMatch = paramStr.match(/\]\s*:\s*([^=]+?)(?:\s*=|$)/);
      if (typeMatch) {
        param.type = this.parseTypeAnnotation(typeMatch[1].trim());
      }

      if (paramStr.includes('=')) {
        param.hasDefault = true;
      }

      return param;
    }

    // Regular parameter: name?: Type = default
    const parts = paramStr.split('=');
    const nameAndType = parts[0].trim();

    if (parts.length > 1) {
      param.hasDefault = true;
      param.defaultValue = parts.slice(1).join('=').trim();
    }

    // Parse name and type
    const typeMatch = nameAndType.match(/^(\w+)(\?)?\s*:\s*(.+)$/);
    if (typeMatch) {
      param.name = typeMatch[1];
      param.isOptional = !!typeMatch[2];
      param.type = this.parseTypeAnnotation(typeMatch[3].trim());
    } else {
      // Just a name, possibly with ?
      const name = nameAndType.replace(/\?$/, '');
      param.name = name;
      param.isOptional = nameAndType.endsWith('?');
    }

    return param;
  }

  /**
   * Extract names from destructuring pattern
   */
  extractDestructuringNames(pattern) {
    // Extract property names from { a, b: c, d = 5 } or [a, b, c]
    const inner = pattern.match(/^[\[{](.*)[\]}]/s);
    if (!inner) return pattern;

    const content = inner[1];
    const names = [];

    // Simple extraction of identifiers
    const identifiers = content.match(/\b(\w+)\b(?:\s*[=:,\]}])/g);
    if (identifiers) {
      for (const id of identifiers) {
        const name = id.match(/(\w+)/)[1];
        if (!['true', 'false', 'null', 'undefined'].includes(name)) {
          names.push(name);
        }
      }
    }

    return `{${names.join(', ')}}`;
  }

  /**
   * Parse type annotation string into structured object
   */
  parseTypeAnnotation(typeStr) {
    if (!typeStr) return null;

    typeStr = typeStr.trim();

    const type = {
      raw: typeStr
    };

    // Primitive types
    if (['string', 'number', 'boolean', 'null', 'undefined', 'void', 'never', 'any', 'unknown', 'symbol', 'bigint'].includes(typeStr)) {
      type.kind = 'primitive';
      return type;
    }

    // Array type: Type[] or Array<Type>
    if (typeStr.endsWith('[]')) {
      type.kind = 'array';
      type.elementType = this.parseTypeAnnotation(typeStr.slice(0, -2));
      return type;
    }

    if (typeStr.startsWith('Array<')) {
      type.kind = 'array';
      const inner = typeStr.slice(6, -1);
      type.elementType = this.parseTypeAnnotation(inner);
      return type;
    }

    // Union type: A | B
    if (typeStr.includes('|') && !typeStr.includes('<')) {
      type.kind = 'union';
      type.members = typeStr.split('|').map(t => this.parseTypeAnnotation(t.trim()));
      type.isNullable = typeStr.includes('null');
      type.isUndefinable = typeStr.includes('undefined');
      return type;
    }

    // Intersection type: A & B
    if (typeStr.includes('&') && !typeStr.includes('<')) {
      type.kind = 'intersection';
      type.members = typeStr.split('&').map(t => this.parseTypeAnnotation(t.trim()));
      return type;
    }

    // Generic type: Type<A, B>
    const genericMatch = typeStr.match(/^(\w+)<(.+)>$/);
    if (genericMatch) {
      type.kind = 'generic';
      type.name = genericMatch[1];
      type.typeArguments = this.parseTypeArguments(genericMatch[2]);
      return type;
    }

    // Function type: (a: A) => B
    if (typeStr.includes('=>')) {
      type.kind = 'function';
      return type;
    }

    // Object literal type: { a: A, b: B }
    if (typeStr.startsWith('{')) {
      type.kind = 'object';
      return type;
    }

    // Tuple type: [A, B, C]
    if (typeStr.startsWith('[')) {
      type.kind = 'tuple';
      return type;
    }

    // Literal type: 'value' or 123
    if (typeStr.startsWith('"') || typeStr.startsWith("'") || /^\d+$/.test(typeStr)) {
      type.kind = 'literal';
      return type;
    }

    // Reference type (class, interface, etc.)
    type.kind = 'reference';
    type.name = typeStr;
    return type;
  }

  /**
   * Parse generic type arguments
   */
  parseTypeArguments(argsStr) {
    const args = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '<') {
        depth++;
        current += char;
      } else if (char === '>') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        if (current.trim()) {
          args.push(this.parseTypeAnnotation(current.trim()));
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(this.parseTypeAnnotation(current.trim()));
    }

    return args;
  }

  /**
   * Extract content within braces, handling nesting
   */
  extractBracedContent(source, startIndex) {
    let depth = 0;
    let start = startIndex;
    let end = startIndex;

    for (let i = startIndex; i < source.length; i++) {
      const char = source[i];

      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    return source.slice(start + 1, end);
  }

  /**
   * Get line number for a position in source
   */
  getLineNumber(source, index) {
    return source.slice(0, index).split('\n').length;
  }

  /**
   * Find JSDoc for a given line number
   */
  findJSDoc(jsdocMap, lineNumber) {
    // Check the line itself and a few lines before
    for (let i = 0; i <= 3; i++) {
      const jsdoc = jsdocMap.get(lineNumber - i);
      if (jsdoc) return jsdoc;
    }
    return null;
  }

  /**
   * Get extraction statistics
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalFunctions: 0,
      totalClasses: 0,
      totalMethods: 0,
      byKind: {
        functions: 0,
        arrowFunctions: 0,
        asyncFunctions: 0,
        generators: 0,
        methods: 0,
        getters: 0,
        setters: 0,
        constructors: 0
      },
      byVisibility: {
        public: 0,
        private: 0,
        protected: 0
      },
      withTypeAnnotations: 0,
      withJsdoc: 0,
      filesProcessed: 0
    };
  }

  // ============================================
  // TypeScript-Specific Methods (task-3-3)
  // ============================================

  /**
   * Parse a TypeScript file with full type information
   * Handles .ts and .tsx files
   * @param {string} source - File content
   * @param {string} filePath - Relative file path
   * @returns {Object} Extracted signatures with types
   */
  parseTypeScriptFile(source, filePath) {
    // Start with JavaScript parsing (handles functions and classes)
    const result = this.parseJavaScriptFile(source, filePath);

    // Add TypeScript-specific extractions
    const cleanSource = this.preserveLineStructure(source);
    const jsdocMap = this.extractJSDocComments(source);

    // Extract interfaces
    result.interfaces = this.extractInterfaces(cleanSource, filePath, jsdocMap);

    // Extract type aliases
    result.typeAliases = this.extractTypeAliases(cleanSource, filePath, jsdocMap);

    // Extract enums
    result.enums = this.extractEnums(cleanSource, filePath, jsdocMap);

    // Extract generic type parameters from classes
    result.classes = result.classes.map(cls =>
      this.enrichClassWithGenerics(cls, source)
    );

    // Extract generic type parameters from functions
    result.functions = result.functions.map(func =>
      this.enrichFunctionWithGenerics(func, source)
    );

    return result;
  }

  /**
   * Extract generic type parameters from a function declaration
   */
  enrichFunctionWithGenerics(func, source) {
    // Find the function declaration and extract generics
    const funcPattern = new RegExp(
      `(?:function\\s+${func.name}|const\\s+${func.name}\\s*=)\\s*<([^>]+)>`,
      'g'
    );

    const match = funcPattern.exec(source);
    if (match) {
      func.generics = this.parseGenericParameters(match[1]);
    }

    return func;
  }

  /**
   * Extract generic type parameters from a class declaration
   */
  enrichClassWithGenerics(cls, source) {
    const classPattern = new RegExp(
      `class\\s+${cls.name}\\s*<([^>]+)>`,
      'g'
    );

    const match = classPattern.exec(source);
    if (match) {
      cls.generics = this.parseGenericParameters(match[1]);
    }

    return cls;
  }

  /**
   * Parse generic type parameters string
   * @param {string} genericsStr - String like "T, K extends keyof T, V = string"
   * @returns {Array} Array of generic parameter objects
   */
  parseGenericParameters(genericsStr) {
    const params = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < genericsStr.length; i++) {
      const char = genericsStr[i];

      if (char === '<') {
        depth++;
        current += char;
      } else if (char === '>') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        if (current.trim()) {
          params.push(this.parseGenericParameter(current.trim()));
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(this.parseGenericParameter(current.trim()));
    }

    return params;
  }

  /**
   * Parse a single generic type parameter
   * @param {string} paramStr - String like "T extends Base = Default"
   */
  parseGenericParameter(paramStr) {
    const param = { name: '' };

    // Check for default: T = Default
    const defaultMatch = paramStr.match(/^(.+?)\s*=\s*(.+)$/);
    if (defaultMatch) {
      paramStr = defaultMatch[1].trim();
      param.default = this.parseTypeAnnotation(defaultMatch[2].trim());
    }

    // Check for constraint: T extends Base
    const extendsMatch = paramStr.match(/^(\w+)\s+extends\s+(.+)$/);
    if (extendsMatch) {
      param.name = extendsMatch[1];
      param.constraint = this.parseTypeAnnotation(extendsMatch[2].trim());
    } else {
      param.name = paramStr;
    }

    return param;
  }

  /**
   * Extract TypeScript interfaces
   */
  extractInterfaces(source, filePath, jsdocMap) {
    const interfaces = [];

    // Pattern for interface declarations
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:<([^>]+)>)?(?:\s+extends\s+([\w\s,<>]+))?\s*\{/g;

    let match;
    while ((match = interfaceRegex.exec(source)) !== null) {
      const name = match[1];
      const genericsStr = match[2];
      const extendsStr = match[3];

      const lineNumber = this.getLineNumber(source, match.index);
      const isExported = source.slice(Math.max(0, match.index - 15), match.index).includes('export');

      // Extract interface body
      const body = this.extractBracedContent(source, match.index + match[0].length - 1);
      const endLine = lineNumber + body.split('\n').length;

      const jsdoc = this.findJSDoc(jsdocMap, lineNumber);

      // Parse interface members
      const { properties, methods, indexSignatures } = this.parseInterfaceMembers(body, filePath, lineNumber);

      const iface = {
        name,
        generics: genericsStr ? this.parseGenericParameters(genericsStr) : [],
        extends: extendsStr ? extendsStr.split(',').map(s => s.trim()) : [],
        properties,
        methods,
        indexSignatures,
        isExported,
        jsdoc,
        location: {
          file: filePath,
          line: lineNumber,
          endLine
        }
      };

      interfaces.push(iface);
    }

    return interfaces;
  }

  /**
   * Parse interface members (properties, methods, index signatures)
   */
  parseInterfaceMembers(body, filePath, startLine) {
    const properties = [];
    const methods = [];
    const indexSignatures = [];

    // Property pattern: name?: Type;
    const propRegex = /(?:readonly\s+)?(\w+)(\?)?\s*:\s*([^;]+);/g;

    // Method pattern: name(params): ReturnType;
    const methodRegex = /(\w+)(\?)?\s*(?:<([^>]+)>)?\s*\(([^)]*)\)\s*:\s*([^;]+);/g;

    // Index signature pattern: [key: KeyType]: ValueType;
    const indexRegex = /\[(\w+)\s*:\s*(\w+)\]\s*:\s*([^;]+);/g;

    let match;

    // Extract properties (that aren't methods)
    while ((match = propRegex.exec(body)) !== null) {
      // Skip if this looks like a method (has parentheses after)
      const afterMatch = body.slice(match.index + match[0].length).trimStart();
      if (body.slice(match.index).match(/^\w+\s*\(/)) continue;

      const isReadonly = body.slice(Math.max(0, match.index - 10), match.index).includes('readonly');
      const relLine = this.getLineNumber(body, match.index);

      properties.push({
        name: match[1],
        isOptional: !!match[2],
        isReadonly,
        type: this.parseTypeAnnotation(match[3].trim()),
        location: { file: filePath, line: startLine + relLine - 1 }
      });
    }

    // Extract methods
    while ((match = methodRegex.exec(body)) !== null) {
      const relLine = this.getLineNumber(body, match.index);

      methods.push({
        name: match[1],
        isOptional: !!match[2],
        generics: match[3] ? this.parseGenericParameters(match[3]) : [],
        parameters: this.parseParameters(match[4]),
        returnType: this.parseTypeAnnotation(match[5].trim()),
        location: { file: filePath, line: startLine + relLine - 1 }
      });
    }

    // Extract index signatures
    while ((match = indexRegex.exec(body)) !== null) {
      indexSignatures.push({
        keyName: match[1],
        keyType: this.parseTypeAnnotation(match[2]),
        valueType: this.parseTypeAnnotation(match[3].trim())
      });
    }

    return { properties, methods, indexSignatures };
  }

  /**
   * Extract TypeScript type aliases
   */
  extractTypeAliases(source, filePath, jsdocMap) {
    const typeAliases = [];

    // Pattern for type alias declarations
    const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<([^>]+)>)?\s*=\s*([^;]+);/g;

    let match;
    while ((match = typeRegex.exec(source)) !== null) {
      const name = match[1];
      const genericsStr = match[2];
      const typeValue = match[3].trim();

      const lineNumber = this.getLineNumber(source, match.index);
      const isExported = source.slice(Math.max(0, match.index - 15), match.index).includes('export');

      const jsdoc = this.findJSDoc(jsdocMap, lineNumber);

      typeAliases.push({
        name,
        generics: genericsStr ? this.parseGenericParameters(genericsStr) : [],
        type: this.parseTypeAnnotation(typeValue),
        isExported,
        jsdoc,
        location: {
          file: filePath,
          line: lineNumber
        }
      });
    }

    return typeAliases;
  }

  /**
   * Extract TypeScript enums
   */
  extractEnums(source, filePath, jsdocMap) {
    const enums = [];

    // Pattern for enum declarations
    const enumRegex = /(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/g;

    let match;
    while ((match = enumRegex.exec(source)) !== null) {
      const name = match[1];
      const isConst = source.slice(Math.max(0, match.index - 10), match.index).includes('const');
      const isExported = source.slice(Math.max(0, match.index - 15), match.index).includes('export');

      const lineNumber = this.getLineNumber(source, match.index);
      const body = this.extractBracedContent(source, match.index + match[0].length - 1);
      const endLine = lineNumber + body.split('\n').length;

      const jsdoc = this.findJSDoc(jsdocMap, lineNumber);

      // Parse enum members
      const members = this.parseEnumMembers(body);

      enums.push({
        name,
        isConst,
        isExported,
        members,
        jsdoc,
        location: {
          file: filePath,
          line: lineNumber,
          endLine
        }
      });
    }

    return enums;
  }

  /**
   * Parse enum members
   */
  parseEnumMembers(body) {
    const members = [];

    // Pattern for enum members: Name = value, or just Name,
    const memberRegex = /(\w+)\s*(?:=\s*([^,\n]+))?[,\n]/g;

    let match;
    while ((match = memberRegex.exec(body)) !== null) {
      const name = match[1];
      let value = match[2]?.trim();

      // Determine value type
      if (value) {
        if (value.startsWith('"') || value.startsWith("'")) {
          value = value.slice(1, -1); // Remove quotes
        } else if (/^\d+$/.test(value)) {
          value = parseInt(value, 10);
        }
      }

      members.push({ name, value });
    }

    return members;
  }

  // ============================================
  // Enhanced Class Method Extraction (task-3-4)
  // ============================================

  /**
   * Extract all methods from a class, including inherited context
   * @param {string} source - Full source code
   * @param {string} className - Name of the class to extract methods from
   * @param {string} filePath - File path
   * @returns {Object} Class with detailed method information
   */
  extractClassMethods(source, className, filePath) {
    const cleanSource = this.preserveLineStructure(source);
    const jsdocMap = this.extractJSDocComments(source);

    // Find the specific class
    const classPattern = new RegExp(
      `(?:export\\s+(?:default\\s+)?)?(?:abstract\\s+)?class\\s+${className}(?:\\s+extends\\s+(\\w+))?(?:\\s+implements\\s+([\\w\\s,]+))?\\s*\\{`,
      'g'
    );

    const match = classPattern.exec(cleanSource);
    if (!match) {
      return null;
    }

    const classStartLine = this.getLineNumber(cleanSource, match.index);
    const classBody = this.extractBracedContent(cleanSource, match.index + match[0].length - 1);

    const { methods, properties, constructorSig } = this.extractClassMembers(
      classBody,
      filePath,
      classStartLine,
      jsdocMap
    );

    // Also extract decorators for the class
    const decorators = this.extractDecorators(source, match.index);

    return {
      name: className,
      extends: match[1] || null,
      implements: match[2] ? match[2].split(',').map(s => s.trim()) : [],
      decorators,
      constructor: constructorSig,
      methods,
      properties,
      location: {
        file: filePath,
        line: classStartLine
      }
    };
  }

  /**
   * Extract decorators preceding a declaration
   */
  extractDecorators(source, declarationIndex) {
    const decorators = [];

    // Look backwards from the declaration for decorators
    const beforeDecl = source.slice(Math.max(0, declarationIndex - 500), declarationIndex);

    // Find all decorators
    const decoratorRegex = /@(\w+)(?:\(([^)]*)\))?/g;

    let match;
    while ((match = decoratorRegex.exec(beforeDecl)) !== null) {
      decorators.push({
        name: match[1],
        arguments: match[2] ? match[2].split(',').map(a => a.trim()) : []
      });
    }

    return decorators;
  }
}

/**
 * Convenience function to parse a JavaScript file
 * @param {string} source - File content
 * @param {string} filePath - Relative file path
 * @returns {Object} Extracted signatures
 */
function parseJavaScriptFunction(source, filePath = 'unknown') {
  const extractor = new SignatureExtractor();
  return extractor.parseJavaScriptFile(source, filePath);
}

/**
 * Convenience function to parse a TypeScript file with full type info
 * @param {string} source - File content
 * @param {string} filePath - Relative file path
 * @returns {Object} Extracted signatures with interfaces, types, enums
 */
function parseTypeScriptFunction(source, filePath = 'unknown') {
  const extractor = new SignatureExtractor();
  return extractor.parseTypeScriptFile(source, filePath);
}

/**
 * Convenience function to extract methods from a specific class
 * @param {string} source - File content
 * @param {string} className - Class name to extract
 * @param {string} filePath - Relative file path
 * @returns {Object|null} Class with methods or null if not found
 */
function extractClassMethods(source, className, filePath = 'unknown') {
  const extractor = new SignatureExtractor();
  return extractor.extractClassMethods(source, className, filePath);
}

/**
 * Convenience function to extract type definitions from TypeScript
 * @param {string} source - File content
 * @param {string} filePath - Relative file path
 * @returns {Object} Interfaces, type aliases, and enums
 */
function extractTypeDefinitions(source, filePath = 'unknown') {
  const extractor = new SignatureExtractor();
  const cleanSource = extractor.preserveLineStructure(source);
  const jsdocMap = extractor.extractJSDocComments(source);

  return {
    interfaces: extractor.extractInterfaces(cleanSource, filePath, jsdocMap),
    typeAliases: extractor.extractTypeAliases(cleanSource, filePath, jsdocMap),
    enums: extractor.extractEnums(cleanSource, filePath, jsdocMap)
  };
}

module.exports = {
  SignatureExtractor,
  parseJavaScriptFunction,
  parseTypeScriptFunction,
  extractClassMethods,
  extractTypeDefinitions
};
