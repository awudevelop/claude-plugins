/**
 * JSDoc documentation verifier for generated code
 *
 * Ensures all functions, classes, and methods have proper JSDoc comments
 * with required tags (@param, @returns, @example, @category).
 *
 * @module doc-verifier
 * @category CLI
 */

/**
 * Documentation issue severity
 * @typedef {'error'|'warning'} IssueSeverity
 */

/**
 * Documentation issue
 * @typedef {Object} DocIssue
 * @property {string} type - Issue type (missing_jsdoc, missing_param, etc.)
 * @property {string} entity - Function/class/method name
 * @property {number} line - Line number in file
 * @property {IssueSeverity} severity - error or warning
 * @property {string} [param] - Parameter name if relevant
 * @property {string} message - Human-readable message
 */

/**
 * Documentation verification result
 * @typedef {Object} DocVerifyResult
 * @property {boolean} valid - True if no errors (warnings OK)
 * @property {DocIssue[]} issues - All issues found
 * @property {number} errorCount - Count of errors
 * @property {number} warningCount - Count of warnings
 * @property {Object} stats - Documentation statistics
 */

/**
 * Extracted entity from code
 * @typedef {Object} CodeEntity
 * @property {string} type - function, class, method
 * @property {string} name - Entity name
 * @property {number} line - Line number
 * @property {string[]} params - Parameter names
 * @property {string} returnType - Return type (void if none)
 * @property {Object} jsdoc - Parsed JSDoc if present
 */

/**
 * Verify JSDoc documentation quality in generated code
 *
 * @param {string} filePath - Path to file (for reporting)
 * @param {string} content - File content
 * @returns {DocVerifyResult} Verification result
 *
 * @example
 * const result = verifyDocumentation('src/auth.ts', fileContent);
 * if (!result.valid) {
 *   console.log('Missing documentation:', result.issues);
 * }
 *
 * @category CLI
 */
function verifyDocumentation(filePath, content) {
  const issues = [];
  const entities = extractEntities(content);

  for (const entity of entities) {
    // Check for JSDoc presence
    if (!entity.jsdoc) {
      issues.push({
        type: 'missing_jsdoc',
        entity: entity.name,
        line: entity.line,
        severity: 'error',
        message: `Missing JSDoc for ${entity.type} "${entity.name}"`
      });
      continue;
    }

    // Check required tags for functions/methods
    if (entity.type === 'function' || entity.type === 'method') {
      // Must have @param for each parameter
      for (const param of entity.params) {
        const paramDoc = entity.jsdoc.params?.find(p => p.name === param);
        if (!paramDoc) {
          issues.push({
            type: 'missing_param',
            entity: entity.name,
            param: param,
            line: entity.line,
            severity: 'error',
            message: `Missing @param for "${param}" in ${entity.name}`
          });
        }
      }

      // Must have @returns if not void
      if (entity.returnType && entity.returnType !== 'void' && !entity.jsdoc.returns) {
        issues.push({
          type: 'missing_returns',
          entity: entity.name,
          line: entity.line,
          severity: 'error',
          message: `Missing @returns for ${entity.name} (returns ${entity.returnType})`
        });
      }

      // Should have @example (warning)
      if (!entity.jsdoc.examples?.length) {
        issues.push({
          type: 'missing_example',
          entity: entity.name,
          line: entity.line,
          severity: 'warning',
          message: `Missing @example for ${entity.name}`
        });
      }
    }

    // Check @category for module organization (warning)
    if (!entity.jsdoc.category) {
      issues.push({
        type: 'missing_category',
        entity: entity.name,
        line: entity.line,
        severity: 'warning',
        message: `Missing @category for ${entity.name}`
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    stats: {
      totalEntities: entities.length,
      documented: entities.filter(e => e.jsdoc).length,
      withExamples: entities.filter(e => e.jsdoc?.examples?.length).length,
      withCategory: entities.filter(e => e.jsdoc?.category).length
    }
  };
}

/**
 * Extract functions, classes, and methods from code
 *
 * @param {string} content - File content
 * @returns {CodeEntity[]} Extracted entities
 *
 * @example
 * const entities = extractEntities(fileContent);
 * for (const entity of entities) {
 *   console.log(`${entity.type}: ${entity.name}`);
 * }
 */
function extractEntities(content) {
  const entities = [];
  const lines = content.split('\n');

  // Track JSDoc blocks
  let currentJsDoc = null;
  let jsDocStartLine = -1;
  let inJsDoc = false;
  let jsDocContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Start of JSDoc
    if (line.includes('/**')) {
      inJsDoc = true;
      jsDocStartLine = lineNum;
      jsDocContent = [line];
      continue;
    }

    // Inside JSDoc
    if (inJsDoc) {
      jsDocContent.push(line);
      if (line.includes('*/')) {
        inJsDoc = false;
        currentJsDoc = parseJsDoc(jsDocContent.join('\n'));
      }
      continue;
    }

    // Function declarations
    const funcMatch = line.match(
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/
    );
    if (funcMatch) {
      entities.push({
        type: 'function',
        name: funcMatch[1],
        line: lineNum,
        params: parseParams(funcMatch[2]),
        returnType: funcMatch[3]?.trim() || 'void',
        jsdoc: currentJsDoc
      });
      currentJsDoc = null;
      continue;
    }

    // Arrow function exports
    const arrowMatch = line.match(
      /^(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/
    );
    if (arrowMatch) {
      entities.push({
        type: 'function',
        name: arrowMatch[1],
        line: lineNum,
        params: parseParams(arrowMatch[2]),
        returnType: arrowMatch[3]?.trim() || 'void',
        jsdoc: currentJsDoc
      });
      currentJsDoc = null;
      continue;
    }

    // Class declarations
    const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      entities.push({
        type: 'class',
        name: classMatch[1],
        line: lineNum,
        params: [],
        returnType: '',
        jsdoc: currentJsDoc
      });
      currentJsDoc = null;
      continue;
    }

    // Class methods
    const methodMatch = line.match(
      /^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/
    );
    if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
      // Skip constructor for param/return checks but still verify JSDoc
      const isConstructor = methodMatch[1] === 'constructor';
      entities.push({
        type: 'method',
        name: methodMatch[1],
        line: lineNum,
        params: isConstructor ? [] : parseParams(methodMatch[2]),
        returnType: isConstructor ? '' : (methodMatch[3]?.trim() || 'void'),
        jsdoc: currentJsDoc
      });
      currentJsDoc = null;
      continue;
    }

    // React component (function component)
    const componentMatch = line.match(
      /^(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?::\s*React\.FC)?/
    );
    if (componentMatch) {
      entities.push({
        type: 'function',
        name: componentMatch[1],
        line: lineNum,
        params: ['props'],
        returnType: 'JSX.Element',
        jsdoc: currentJsDoc
      });
      currentJsDoc = null;
      continue;
    }

    // Clear JSDoc if not followed by entity
    if (currentJsDoc && line.trim() && !line.trim().startsWith('//')) {
      currentJsDoc = null;
    }
  }

  return entities;
}

/**
 * Parse JSDoc comment content
 *
 * @param {string} jsDocText - JSDoc comment text
 * @returns {Object} Parsed JSDoc with params, returns, examples, category
 */
function parseJsDoc(jsDocText) {
  const result = {
    description: '',
    params: [],
    returns: null,
    examples: [],
    category: null,
    throws: [],
    see: [],
    tags: {}
  };

  // Extract description (first lines before tags)
  const descMatch = jsDocText.match(/\/\*\*\s*\n?\s*\*?\s*([^@]+)/);
  if (descMatch) {
    result.description = descMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l)
      .join(' ')
      .trim();
  }

  // Extract @param tags
  const paramRegex = /@param\s+(?:\{([^}]+)\}\s+)?(?:\[)?(\w+)(?:\])?\s*-?\s*(.*)/g;
  let match;
  while ((match = paramRegex.exec(jsDocText)) !== null) {
    result.params.push({
      type: match[1] || 'any',
      name: match[2],
      description: match[3]?.trim() || ''
    });
  }

  // Extract @returns
  const returnsMatch = jsDocText.match(/@returns?\s+(?:\{([^}]+)\}\s+)?(.*)/);
  if (returnsMatch) {
    result.returns = {
      type: returnsMatch[1] || 'any',
      description: returnsMatch[2]?.trim() || ''
    };
  }

  // Extract @example blocks
  const exampleRegex = /@example\s*([\s\S]*?)(?=(?:@\w|$|\*\/))/g;
  while ((match = exampleRegex.exec(jsDocText)) !== null) {
    const example = match[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
    if (example) {
      result.examples.push(example);
    }
  }

  // Extract @category
  const categoryMatch = jsDocText.match(/@category\s+(\w+)/);
  if (categoryMatch) {
    result.category = categoryMatch[1];
  }

  // Extract @throws
  const throwsRegex = /@throws?\s+(?:\{([^}]+)\}\s+)?(.*)/g;
  while ((match = throwsRegex.exec(jsDocText)) !== null) {
    result.throws.push({
      type: match[1] || 'Error',
      description: match[2]?.trim() || ''
    });
  }

  // Extract @see
  const seeRegex = /@see\s+(.+)/g;
  while ((match = seeRegex.exec(jsDocText)) !== null) {
    result.see.push(match[1].trim());
  }

  return result;
}

/**
 * Parse function parameters from signature
 *
 * @param {string} paramsStr - Parameters string from signature
 * @returns {string[]} Parameter names
 */
function parseParams(paramsStr) {
  if (!paramsStr || !paramsStr.trim()) return [];

  // Handle complex parameter patterns
  const params = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '(' || char === '<' || char === '{' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === '>' || char === '}' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        const paramName = extractParamName(current.trim());
        if (paramName) params.push(paramName);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Handle last parameter
  if (current.trim()) {
    const paramName = extractParamName(current.trim());
    if (paramName) params.push(paramName);
  }

  return params;
}

/**
 * Extract parameter name from parameter declaration
 *
 * @param {string} paramDecl - Parameter declaration
 * @returns {string|null} Parameter name
 */
function extractParamName(paramDecl) {
  // Handle destructuring: { a, b }: Type -> null (skip)
  if (paramDecl.startsWith('{') || paramDecl.startsWith('[')) {
    return null;
  }

  // Handle normal params: name: Type or name?: Type or name = default
  const match = paramDecl.match(/^(\w+)/);
  return match ? match[1] : null;
}

/**
 * Format documentation issues as human-readable text
 *
 * @param {DocIssue[]} issues - Issues to format
 * @returns {string} Formatted issues
 *
 * @example
 * const result = verifyDocumentation('file.ts', content);
 * if (result.issues.length > 0) {
 *   console.log(formatIssues(result.issues));
 * }
 */
function formatIssues(issues) {
  if (issues.length === 0) return 'No documentation issues found';

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  let output = '';

  if (errors.length > 0) {
    output += `Errors (${errors.length}):\n`;
    for (const issue of errors) {
      output += `  Line ${issue.line}: ${issue.message}\n`;
    }
  }

  if (warnings.length > 0) {
    if (output) output += '\n';
    output += `Warnings (${warnings.length}):\n`;
    for (const issue of warnings) {
      output += `  Line ${issue.line}: ${issue.message}\n`;
    }
  }

  return output;
}

module.exports = {
  verifyDocumentation,
  extractEntities,
  parseJsDoc,
  formatIssues
};
