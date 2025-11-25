const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} ValidationError
 * @property {string} field - Field path (e.g., "metadata.name")
 * @property {string} message - Error message
 * @property {string} code - Error code
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<ValidationError>} errors - List of validation errors
 */

/**
 * Validates data against a JSON schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - JSON schema object
 * @param {string} [basePath=''] - Base path for error messages
 * @returns {ValidationResult} Validation result
 */
function validateAgainstSchema(data, schema, basePath = '') {
  const errors = [];

  // Check type
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    let expectedType = schema.type;

    // Handle 'integer' type (JSON Schema) - in JavaScript, integers are numbers
    if (expectedType === 'integer') {
      if (typeof data !== 'number') {
        errors.push({
          field: basePath || 'root',
          message: `Expected type integer (number), got ${actualType}`,
          code: 'TYPE_MISMATCH'
        });
        return { valid: false, errors };
      }
      // Check if it's actually an integer
      if (!Number.isInteger(data)) {
        errors.push({
          field: basePath || 'root',
          message: `Expected integer, got non-integer number`,
          code: 'NOT_AN_INTEGER'
        });
      }
    } else if (actualType !== expectedType) {
      errors.push({
        field: basePath || 'root',
        message: `Expected type ${expectedType}, got ${actualType}`,
        code: 'TYPE_MISMATCH'
      });
      // If type doesn't match, further validation may not make sense
      return { valid: false, errors };
    }
  }

  // Validate object properties
  if (schema.type === 'object' && typeof data === 'object' && !Array.isArray(data)) {
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (data[requiredField] === undefined) {
          errors.push({
            field: basePath ? `${basePath}.${requiredField}` : requiredField,
            message: `Required field is missing`,
            code: 'REQUIRED_FIELD_MISSING'
          });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          const fieldPath = basePath ? `${basePath}.${key}` : key;
          const result = validateAgainstSchema(data[key], propSchema, fieldPath);
          errors.push(...result.errors);
        }
      }
    }
  }

  // Validate array items
  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.items) {
      data.forEach((item, index) => {
        const fieldPath = `${basePath}[${index}]`;
        const result = validateAgainstSchema(item, schema.items, fieldPath);
        errors.push(...result.errors);
      });
    }

    // Check minItems/maxItems
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        field: basePath,
        message: `Array must have at least ${schema.minItems} items, got ${data.length}`,
        code: 'ARRAY_TOO_SHORT'
      });
    }

    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        field: basePath,
        message: `Array must have at most ${schema.maxItems} items, got ${data.length}`,
        code: 'ARRAY_TOO_LONG'
      });
    }
  }

  // Validate string constraints
  if (schema.type === 'string' && typeof data === 'string') {
    // Check enum
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        field: basePath,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE'
      });
    }

    // Check pattern
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          field: basePath,
          message: `Value does not match pattern: ${schema.pattern}`,
          code: 'PATTERN_MISMATCH'
        });
      }
    }

    // Check minLength/maxLength
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        field: basePath,
        message: `String must be at least ${schema.minLength} characters, got ${data.length}`,
        code: 'STRING_TOO_SHORT'
      });
    }

    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        field: basePath,
        message: `String must be at most ${schema.maxLength} characters, got ${data.length}`,
        code: 'STRING_TOO_LONG'
      });
    }
  }

  // Validate number constraints
  if (schema.type === 'number' && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        field: basePath,
        message: `Number must be at least ${schema.minimum}, got ${data}`,
        code: 'NUMBER_TOO_SMALL'
      });
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        field: basePath,
        message: `Number must be at most ${schema.maximum}, got ${data}`,
        code: 'NUMBER_TOO_LARGE'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Loads a schema file from the schemas directory
 * @param {string} schemaName - Schema file name (without .json extension)
 * @returns {Promise<Object>} Schema object
 */
async function loadSchema(schemaName) {
  const schemaPath = path.join(__dirname, '../../schemas', `${schemaName}.json`);

  try {
    const content = await fs.readFile(schemaPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Schema file not found: ${schemaName}.json`);
    }
    throw new Error(`Failed to load schema: ${error.message}`);
  }
}

/**
 * Validates orchestration data against the orchestration schema
 * @param {Object} data - Orchestration data to validate
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateOrchestration(data) {
  try {
    const schema = await loadSchema('orchestration-schema');
    return validateAgainstSchema(data, schema);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'schema',
        message: error.message,
        code: 'SCHEMA_LOAD_ERROR'
      }]
    };
  }
}

/**
 * Validates phase data against the phase schema
 * @param {Object} data - Phase data to validate
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validatePhase(data) {
  try {
    const schema = await loadSchema('phase-schema');
    return validateAgainstSchema(data, schema);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'schema',
        message: error.message,
        code: 'SCHEMA_LOAD_ERROR'
      }]
    };
  }
}

/**
 * Validates requirements data against the requirements schema
 * @param {Object} data - Requirements data to validate
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateRequirements(data) {
  try {
    const schema = await loadSchema('requirements-schema');
    return validateAgainstSchema(data, schema);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'schema',
        message: error.message,
        code: 'SCHEMA_LOAD_ERROR'
      }]
    };
  }
}

/**
 * Validates data against a schema file from the schemas directory
 * @param {Object} data - Data to validate
 * @param {string} schemaPath - Relative path to schema file in schemas directory
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateWithSchemaFile(data, schemaPath) {
  try {
    const fullPath = path.join(__dirname, '../../schemas', schemaPath);
    const content = await fs.readFile(fullPath, 'utf8');
    const schema = JSON.parse(content);
    return validateAgainstSchema(data, schema);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'schema',
        message: `Failed to load schema from ${schemaPath}: ${error.message}`,
        code: 'SCHEMA_LOAD_ERROR'
      }]
    };
  }
}

/**
 * Formats validation errors as a human-readable string
 * @param {Array<ValidationError>} errors - Validation errors
 * @returns {string} Formatted error message
 */
function formatValidationErrors(errors) {
  if (errors.length === 0) {
    return 'No errors';
  }

  const lines = ['Validation errors:'];
  errors.forEach((error, index) => {
    lines.push(`  ${index + 1}. [${error.field}] ${error.message} (${error.code})`);
  });

  return lines.join('\n');
}

module.exports = {
  validateAgainstSchema,
  loadSchema,
  validateOrchestration,
  validatePhase,
  validateRequirements,
  validateWithSchemaFile,
  formatValidationErrors
};
