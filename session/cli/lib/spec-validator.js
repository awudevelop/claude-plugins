/**
 * Spec Validator
 *
 * Validates task specs/sketches for completeness.
 * Supports both legacy structured specs and new sketch format (v3.0).
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Sketch validation heuristics by task type
 */
const SKETCH_HEURISTICS = {
  create_function: {
    required: [
      { pattern: /\(.*\)/, message: 'Missing function parameters (parentheses)' },
      { pattern: /:.*|->/, message: 'Missing return type' }
    ],
    recommended: [
      { pattern: /\/\//, message: 'Consider adding behavior comments' }
    ]
  },
  create_class: {
    required: [
      { pattern: /class\s+\w+/i, message: 'Missing class declaration' },
      { pattern: /\w+\s*\(.*\)\s*:?/, message: 'Missing method signatures' }
    ],
    recommended: [
      { pattern: /constructor/i, message: 'Consider adding constructor' }
    ]
  },
  create_interface: {
    required: [
      { pattern: /interface\s+\w+/i, message: 'Missing interface declaration' },
      { pattern: /\w+\s*:\s*\w+/, message: 'Missing property type annotations' }
    ],
    recommended: []
  },
  create_hook: {
    required: [
      { pattern: /use[A-Z]\w*/, message: 'Hook name must start with "use"' },
      { pattern: /\(.*\)/, message: 'Missing hook parameters' }
    ],
    recommended: [
      { pattern: /\/\/\s*(State|Effect|Returns)/i, message: 'Consider documenting state/effects/returns' }
    ]
  },
  create_component: {
    required: [
      { pattern: /[A-Z]\w+/, message: 'Missing component name (PascalCase)' }
    ],
    recommended: [
      { pattern: /props|Props/, message: 'Consider defining props interface' }
    ]
  },
  create_table: {
    required: [
      { pattern: /CREATE\s+TABLE/i, message: 'Missing CREATE TABLE statement' },
      { pattern: /\w+\s+(UUID|INT|VARCHAR|TEXT|BOOLEAN|TIMESTAMP)/i, message: 'Missing column type definitions' }
    ],
    recommended: [
      { pattern: /PRIMARY\s+KEY/i, message: 'Consider adding primary key' }
    ]
  }
};

/**
 * Required fields for each task type (legacy spec format)
 */
const REQUIRED_FIELDS = {
  create_function: ['function', 'does'],
  create_class: ['class', 'purpose'],
  create_hook: ['hook', 'behavior'],
  create_component: ['component', 'renders'],
  create_interface: ['interface'],
  create_table: ['table', 'columns'],
  create_migration: ['operations'],
  create_rpc: ['function', 'returns'],
  create_trigger: ['trigger', 'table', 'timing'],
  create_cli: ['cli', 'commands'],
  create_cli_command: ['command', 'does'],
  create_config: ['config_type'],
  create_package_json: ['package'],
  create_barrel: ['exports'],
  create_readme: ['sections'],
  create_test: ['describes'],
  create_context: ['context', 'provider'],
  run_command: ['command'],
  add_dependency: ['dependencies'],
  modify_file: ['modifications'],
  modify_markdown: ['sections'],
  create_directory: ['paths'],
  create_file: ['content'],
  custom: ['purpose']
};

/**
 * Recommended fields that generate warnings
 */
const RECOMMENDED_FIELDS = {
  create_function: ['params', 'returns', 'imports'],
  create_class: ['methods', 'imports'],
  create_hook: ['uses', 'returns'],
  create_component: ['props', 'hooks'],
  create_table: ['indexes'],
  create_test: ['imports', 'mocks']
};

class SpecValidator {
  constructor(schemasDir = null) {
    this.schemasDir = schemasDir || path.join(__dirname, '../../schemas/task-specs');
    this._schemas = {};
  }

  /**
   * Load a schema for a task type
   * @param {string} taskType
   * @returns {Promise<Object|null>}
   */
  async loadSchema(taskType) {
    if (this._schemas[taskType]) {
      return this._schemas[taskType];
    }

    const schemaPath = path.join(this.schemasDir, `${taskType}.json`);

    try {
      const content = await fs.readFile(schemaPath, 'utf8');
      this._schemas[taskType] = JSON.parse(content);
      return this._schemas[taskType];
    } catch (err) {
      // Schema not found - use required fields fallback
      return null;
    }
  }

  /**
   * Validate a task (supports both sketch and legacy spec formats)
   * @param {Object} task - Task with type and sketch/spec
   * @returns {Promise<Object>} Validation result
   */
  async validate(task) {
    const { type, spec, sketch, file } = task;

    // Prefer sketch format if present
    if (sketch) {
      return this.validateSketch(task);
    }

    // Fall back to legacy spec validation
    return this.validateSpec(task);
  }

  /**
   * Validate a task sketch (v3.0 format)
   * @param {Object} task - Task with type and sketch
   * @returns {Object} Validation result
   */
  validateSketch(task) {
    const errors = [];
    const warnings = [];

    const { type, sketch, file } = task;

    // Check task has required top-level fields
    if (!type) {
      errors.push({ field: 'type', message: 'Task type is required' });
    }

    if (!file) {
      errors.push({ field: 'file', message: 'Target file path is required' });
    }

    if (!sketch || typeof sketch !== 'string' || sketch.trim().length === 0) {
      errors.push({ field: 'sketch', message: 'Task sketch is required (non-empty string)' });
      return { valid: false, errors, warnings, format: 'sketch' };
    }

    // Get heuristics for this task type
    const heuristics = SKETCH_HEURISTICS[type];

    if (heuristics) {
      // Check required patterns
      for (const check of heuristics.required) {
        if (!check.pattern.test(sketch)) {
          errors.push({
            field: 'sketch',
            message: check.message,
            suggestion: `Sketch should include: ${check.pattern.toString()}`
          });
        }
      }

      // Check recommended patterns
      for (const check of heuristics.recommended) {
        if (!check.pattern.test(sketch)) {
          warnings.push({
            field: 'sketch',
            message: check.message
          });
        }
      }
    }

    // Check for common incomplete sketch patterns
    this._checkIncompletePatterns(sketch, type, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      format: 'sketch'
    };
  }

  /**
   * Check for common incomplete sketch patterns
   */
  _checkIncompletePatterns(sketch, type, errors, warnings) {
    // Check for method names without signatures (the original lean format issue!)
    // Pattern: word, word, word (comma-separated names without parentheses)
    const commaListPattern = /^\s*\w+\s*,\s*\w+/m;
    const hasSignature = /\w+\s*\([^)]*\)/;

    if (commaListPattern.test(sketch) && !hasSignature.test(sketch)) {
      errors.push({
        field: 'sketch',
        message: 'Sketch appears to be a list of names without signatures',
        suggestion: 'Convert "methodA, methodB" to "methodA(params): ReturnType"'
      });
    }

    // Check for missing behavior comments
    if (!sketch.includes('//') && !sketch.includes('/*')) {
      warnings.push({
        field: 'sketch',
        message: 'Sketch has no behavior comments - implementor may make assumptions'
      });
    }
  }

  /**
   * Validate a task spec (legacy v2.0 format)
   * @param {Object} task - Task with type and spec
   * @returns {Promise<Object>} Validation result
   */
  async validateSpec(task) {
    const errors = [];
    const warnings = [];

    const { type, spec, file } = task;

    // Check task has required top-level fields
    if (!type) {
      errors.push({ field: 'type', message: 'Task type is required' });
    }

    if (!file) {
      errors.push({ field: 'file', message: 'Target file path is required' });
    }

    if (!spec) {
      errors.push({ field: 'spec', message: 'Task spec is required' });
      return { valid: false, errors, warnings, format: 'spec' };
    }

    // Check required fields for this task type
    const required = REQUIRED_FIELDS[type] || [];
    for (const field of required) {
      if (!spec[field] && spec[field] !== false && spec[field] !== 0) {
        errors.push({
          field: `spec.${field}`,
          message: `Required field '${field}' is missing for ${type}`,
          suggestion: this._getSuggestion(type, field)
        });
      }
    }

    // Check recommended fields
    const recommended = RECOMMENDED_FIELDS[type] || [];
    for (const field of recommended) {
      if (!spec[field]) {
        warnings.push({
          field: `spec.${field}`,
          message: `Recommended field '${field}' is missing - may reduce code quality`
        });
      }
    }

    // Type-specific validation
    await this._validateTypeSpecific(task, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      format: 'spec'
    };
  }

  /**
   * Validate multiple tasks
   * @param {Object[]} tasks
   * @returns {Promise<Object>}
   */
  async validateAll(tasks) {
    const results = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const task of tasks) {
      const result = await this.validate(task);
      results.push({
        taskId: task.id,
        ...result
      });

      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    return {
      valid: totalErrors === 0,
      totalErrors,
      totalWarnings,
      results
    };
  }

  /**
   * Type-specific validation rules
   */
  async _validateTypeSpecific(task, errors, warnings) {
    const { type, spec } = task;

    switch (type) {
      case 'create_function':
        this._validateFunction(spec, errors, warnings);
        break;

      case 'create_hook':
        this._validateHook(spec, errors, warnings);
        break;

      case 'create_component':
        this._validateComponent(spec, errors, warnings);
        break;

      case 'create_table':
        this._validateTable(spec, errors, warnings);
        break;

      case 'create_test':
        this._validateTest(spec, errors, warnings);
        break;
    }
  }

  /**
   * Validate function spec
   */
  _validateFunction(spec, errors, warnings) {
    // Check function name format
    if (spec.function && !/^[a-z_][a-zA-Z0-9_]*$/.test(spec.function)) {
      warnings.push({
        field: 'spec.function',
        message: 'Function name should be camelCase or snake_case'
      });
    }

    // Check async with Promise return
    if (spec.async && spec.returns && !spec.returns.includes('Promise')) {
      warnings.push({
        field: 'spec.returns',
        message: 'Async function should return Promise<T>'
      });
    }

    // Check params format
    if (spec.params && Array.isArray(spec.params)) {
      spec.params.forEach((param, i) => {
        if (!param.includes(':')) {
          warnings.push({
            field: `spec.params[${i}]`,
            message: `Parameter '${param}' should include type annotation`
          });
        }
      });
    }
  }

  /**
   * Validate hook spec
   */
  _validateHook(spec, errors, warnings) {
    // Check hook name starts with 'use'
    if (spec.hook && !spec.hook.startsWith('use')) {
      errors.push({
        field: 'spec.hook',
        message: 'Hook name must start with "use"'
      });
    }

    // Check behavior is array
    if (spec.behavior && !Array.isArray(spec.behavior)) {
      errors.push({
        field: 'spec.behavior',
        message: 'Behavior must be an array of steps'
      });
    }
  }

  /**
   * Validate component spec
   */
  _validateComponent(spec, errors, warnings) {
    // Check component name is PascalCase
    if (spec.component && !/^[A-Z][a-zA-Z0-9]*$/.test(spec.component)) {
      warnings.push({
        field: 'spec.component',
        message: 'Component name should be PascalCase'
      });
    }

    // Check props have types
    if (spec.props && Array.isArray(spec.props)) {
      spec.props.forEach((prop, i) => {
        if (!prop.type) {
          warnings.push({
            field: `spec.props[${i}]`,
            message: `Prop '${prop.name}' should have a type`
          });
        }
      });
    }
  }

  /**
   * Validate table spec
   */
  _validateTable(spec, errors, warnings) {
    // Check table name format
    if (spec.table && !/^[a-z_][a-z0-9_]*$/.test(spec.table)) {
      warnings.push({
        field: 'spec.table',
        message: 'Table name should be snake_case'
      });
    }

    // Check columns have types
    if (spec.columns && Array.isArray(spec.columns)) {
      spec.columns.forEach((col, i) => {
        if (!col.type) {
          errors.push({
            field: `spec.columns[${i}]`,
            message: `Column '${col.name}' must have a type`
          });
        }
      });

      // Check for primary key
      const hasPK = spec.columns.some(col => col.pk);
      if (!hasPK) {
        warnings.push({
          field: 'spec.columns',
          message: 'Table should have a primary key column'
        });
      }
    }
  }

  /**
   * Validate test spec
   */
  _validateTest(spec, errors, warnings) {
    // Check describes have tests
    if (spec.describes && Array.isArray(spec.describes)) {
      spec.describes.forEach((describe, i) => {
        if (!describe.tests || describe.tests.length === 0) {
          errors.push({
            field: `spec.describes[${i}]`,
            message: `Describe block '${describe.name}' has no tests`
          });
        }
      });
    }
  }

  /**
   * Get suggestion for missing field
   */
  _getSuggestion(type, field) {
    const suggestions = {
      function: 'Add function name, e.g. "signIn"',
      does: 'Add description of what the function/command does',
      class: 'Add class name, e.g. "AuthService"',
      purpose: 'Add description of what the class does',
      hook: 'Add hook name starting with "use", e.g. "useAuth"',
      behavior: 'Add array of behavior steps',
      component: 'Add component name, e.g. "LoginForm"',
      renders: 'Add description of what component renders',
      interface: 'Add interface name, e.g. "User"',
      table: 'Add table name, e.g. "users"',
      columns: 'Add array of column definitions',
      command: 'Add command name',
      modifications: 'Add array of modifications to make'
    };

    return suggestions[field] || `Add ${field} to spec`;
  }
}

module.exports = { SpecValidator, REQUIRED_FIELDS, RECOMMENDED_FIELDS, SKETCH_HEURISTICS };
