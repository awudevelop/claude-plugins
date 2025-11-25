const crypto = require('crypto');

/**
 * Generates a unique phase ID with format 'phase-{uuid}'
 * @returns {string} Phase ID in format 'phase-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
 */
function generatePhaseId() {
  const uuid = crypto.randomUUID();
  return `phase-${uuid}`;
}

/**
 * Generates a unique task ID with format 'task-{uuid}'
 * @returns {string} Task ID in format 'task-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
 */
function generateTaskId() {
  const uuid = crypto.randomUUID();
  return `task-${uuid}`;
}

/**
 * Validates an ID format and optionally checks for uniqueness
 * @param {string} id - The ID to validate
 * @param {Object} options - Validation options
 * @param {string} options.type - Expected type ('phase' or 'task')
 * @param {Array<string>} [options.existingIds] - List of existing IDs to check uniqueness against
 * @returns {Object} Validation result with success and error properties
 */
function validateId(id, options = {}) {
  // Check if ID is provided
  if (!id || typeof id !== 'string') {
    return {
      success: false,
      error: 'ID must be a non-empty string',
      code: 'INVALID_ID_TYPE'
    };
  }

  // Validate format based on type
  const { type, existingIds } = options;

  if (type) {
    const validTypes = ['phase', 'task'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        error: `Invalid type '${type}'. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_TYPE'
      };
    }

    // Check if ID starts with expected prefix
    const expectedPrefix = `${type}-`;
    if (!id.startsWith(expectedPrefix)) {
      return {
        success: false,
        error: `ID must start with '${expectedPrefix}' for type '${type}'`,
        code: 'INVALID_PREFIX'
      };
    }
  }

  // Validate UUID format (with or without prefix)
  const uuidPart = id.includes('-') ? id.split('-').slice(1).join('-') : id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuidPart)) {
    return {
      success: false,
      error: 'ID does not contain a valid UUID v4 format',
      code: 'INVALID_UUID_FORMAT'
    };
  }

  // Check for uniqueness if existingIds provided
  if (existingIds && Array.isArray(existingIds)) {
    if (existingIds.includes(id)) {
      return {
        success: false,
        error: `ID '${id}' already exists`,
        code: 'DUPLICATE_ID'
      };
    }
  }

  // All validations passed
  return {
    success: true,
    id,
    type: type || (id.startsWith('phase-') ? 'phase' : id.startsWith('task-') ? 'task' : 'unknown')
  };
}

/**
 * Extracts the type from an ID
 * @param {string} id - The ID to extract type from
 * @returns {string|null} The type ('phase' or 'task') or null if not recognized
 */
function getIdType(id) {
  if (!id || typeof id !== 'string') {
    return null;
  }

  if (id.startsWith('phase-')) {
    return 'phase';
  }

  if (id.startsWith('task-')) {
    return 'task';
  }

  return null;
}

/**
 * Checks if an ID is valid without throwing errors
 * @param {string} id - The ID to check
 * @param {string} [type] - Optional type to validate against
 * @returns {boolean} True if ID is valid
 */
function isValidId(id, type) {
  const result = validateId(id, { type });
  return result.success;
}

module.exports = {
  generatePhaseId,
  generateTaskId,
  validateId,
  getIdType,
  isValidId
};
