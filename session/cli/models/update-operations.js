/**
 * @typedef {Object} UpdateOperation
 * @property {string} type - Operation type: 'add', 'update', 'delete'
 * @property {string} target - Target of the operation: 'metadata', 'phase', 'task'
 * @property {Object} data - Operation-specific data
 * @property {string} [planId] - ID of the plan to update
 * @property {string} [timestamp] - ISO timestamp of operation
 */

/**
 * @typedef {Object} MetadataUpdate
 * @property {'update'} type - Always 'update' for metadata
 * @property {'metadata'} target - Always 'metadata'
 * @property {Object} data - Metadata fields to update
 * @property {string} [data.name] - Plan name
 * @property {string} [data.description] - Plan description
 * @property {string} [data.status] - Plan status: 'pending', 'in_progress', 'completed', 'cancelled'
 * @property {string} [data.workType] - Work type: 'feature', 'bug', 'refactor', 'docs', 'test'
 * @property {Array<string>} [data.derivedFrom] - List of requirement IDs
 * @property {string} planId - ID of the plan
 */

/**
 * @typedef {Object} PhaseUpdate
 * @property {'add'|'update'|'delete'} type - Operation type
 * @property {'phase'} target - Always 'phase'
 * @property {Object} data - Phase data
 * @property {string} [data.id] - Phase ID (required for update/delete)
 * @property {string} [data.name] - Phase name
 * @property {string} [data.description] - Phase description
 * @property {string} [data.file] - Phase file path
 * @property {'sequential'|'parallel'} [data.type] - Execution type
 * @property {Array<string>} [data.dependencies] - Phase dependencies
 * @property {string} [data.status] - Phase status
 * @property {number} [data.estimatedTokens] - Estimated tokens
 * @property {string} [data.estimatedDuration] - Estimated duration
 * @property {number} [data.insertAtIndex] - Index to insert at (for add operation)
 * @property {string} planId - ID of the plan
 */

/**
 * @typedef {Object} TaskUpdate
 * @property {'add'|'update'|'delete'} type - Operation type
 * @property {'task'} target - Always 'task'
 * @property {Object} data - Task data
 * @property {string} [data.id] - Task ID (required for update/delete)
 * @property {string} data.phaseId - Parent phase ID
 * @property {string} [data.description] - Task description
 * @property {string} [data.details] - Detailed task information
 * @property {string} [data.status] - Task status: 'pending', 'in_progress', 'completed', 'failed'
 * @property {string} [data.from_requirement] - Source requirement ID
 * @property {number} [data.estimated_tokens] - Estimated tokens
 * @property {Array<string>} [data.dependencies] - Task dependencies
 * @property {Object} [data.validation] - Validation criteria
 * @property {Object} [data.result] - Task result data
 * @property {number} [data.insertAtIndex] - Index to insert at (for add operation)
 * @property {string} planId - ID of the plan
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [code] - Error code
 * @property {Array<string>} [details] - Additional error details
 */

/**
 * Validates an update operation
 * @param {UpdateOperation} operation - The operation to validate
 * @returns {ValidationResult} Validation result
 */
function validateUpdateOperation(operation) {
  // Check basic structure
  if (!operation || typeof operation !== 'object') {
    return {
      success: false,
      error: 'Operation must be an object',
      code: 'INVALID_OPERATION_TYPE'
    };
  }

  // Validate type
  const validTypes = ['add', 'update', 'delete'];
  if (!operation.type || !validTypes.includes(operation.type)) {
    return {
      success: false,
      error: `Operation type must be one of: ${validTypes.join(', ')}`,
      code: 'INVALID_OPERATION_TYPE'
    };
  }

  // Validate target
  const validTargets = ['metadata', 'phase', 'task'];
  if (!operation.target || !validTargets.includes(operation.target)) {
    return {
      success: false,
      error: `Operation target must be one of: ${validTargets.join(', ')}`,
      code: 'INVALID_OPERATION_TARGET'
    };
  }

  // Validate data exists
  if (!operation.data || typeof operation.data !== 'object') {
    return {
      success: false,
      error: 'Operation data must be an object',
      code: 'MISSING_OPERATION_DATA'
    };
  }

  // Validate planId
  if (!operation.planId || typeof operation.planId !== 'string') {
    return {
      success: false,
      error: 'Operation must include a valid planId',
      code: 'MISSING_PLAN_ID'
    };
  }

  // Target-specific validation
  switch (operation.target) {
    case 'metadata':
      return validateMetadataUpdate(operation);
    case 'phase':
      return validatePhaseUpdate(operation);
    case 'task':
      return validateTaskUpdate(operation);
    default:
      return { success: true };
  }
}

/**
 * Validates a metadata update operation
 * @param {MetadataUpdate} operation - The metadata update operation
 * @returns {ValidationResult} Validation result
 */
function validateMetadataUpdate(operation) {
  // Metadata can only be updated, not added or deleted
  if (operation.type !== 'update') {
    return {
      success: false,
      error: 'Metadata operations must have type "update"',
      code: 'INVALID_METADATA_OPERATION'
    };
  }

  // At least one field must be provided
  const validFields = ['name', 'description', 'status', 'workType', 'derivedFrom'];
  const hasValidField = validFields.some(field => operation.data[field] !== undefined);

  if (!hasValidField) {
    return {
      success: false,
      error: `Metadata update must include at least one of: ${validFields.join(', ')}`,
      code: 'NO_METADATA_FIELDS'
    };
  }

  // Validate status if provided
  if (operation.data.status) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(operation.data.status)) {
      return {
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      };
    }
  }

  // Validate workType if provided
  if (operation.data.workType) {
    const validWorkTypes = ['feature', 'bug', 'refactor', 'docs', 'test'];
    if (!validWorkTypes.includes(operation.data.workType)) {
      return {
        success: false,
        error: `Work type must be one of: ${validWorkTypes.join(', ')}`,
        code: 'INVALID_WORK_TYPE'
      };
    }
  }

  return { success: true };
}

/**
 * Validates a phase update operation
 * @param {PhaseUpdate} operation - The phase update operation
 * @returns {ValidationResult} Validation result
 */
function validatePhaseUpdate(operation) {
  // For update and delete, ID is required
  if ((operation.type === 'update' || operation.type === 'delete') && !operation.data.id) {
    return {
      success: false,
      error: 'Phase ID is required for update and delete operations',
      code: 'MISSING_PHASE_ID'
    };
  }

  // For add, name is required
  if (operation.type === 'add' && !operation.data.name) {
    return {
      success: false,
      error: 'Phase name is required for add operations',
      code: 'MISSING_PHASE_NAME'
    };
  }

  // Validate execution type if provided
  if (operation.data.type) {
    const validTypes = ['sequential', 'parallel'];
    if (!validTypes.includes(operation.data.type)) {
      return {
        success: false,
        error: `Phase type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_PHASE_TYPE'
      };
    }
  }

  // Validate status if provided
  if (operation.data.status) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(operation.data.status)) {
      return {
        success: false,
        error: `Phase status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_PHASE_STATUS'
      };
    }
  }

  // Validate dependencies is an array if provided
  if (operation.data.dependencies && !Array.isArray(operation.data.dependencies)) {
    return {
      success: false,
      error: 'Phase dependencies must be an array',
      code: 'INVALID_DEPENDENCIES'
    };
  }

  return { success: true };
}

/**
 * Validates a task update operation
 * @param {TaskUpdate} operation - The task update operation
 * @returns {ValidationResult} Validation result
 */
function validateTaskUpdate(operation) {
  // For update and delete, ID is required
  if ((operation.type === 'update' || operation.type === 'delete') && !operation.data.id) {
    return {
      success: false,
      error: 'Task ID is required for update and delete operations',
      code: 'MISSING_TASK_ID'
    };
  }

  // phaseId is always required
  if (!operation.data.phaseId) {
    return {
      success: false,
      error: 'Phase ID is required for task operations',
      code: 'MISSING_PHASE_ID'
    };
  }

  // For add, description is required
  if (operation.type === 'add' && !operation.data.description) {
    return {
      success: false,
      error: 'Task description is required for add operations',
      code: 'MISSING_TASK_DESCRIPTION'
    };
  }

  // Validate status if provided
  if (operation.data.status) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(operation.data.status)) {
      return {
        success: false,
        error: `Task status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_TASK_STATUS'
      };
    }
  }

  // Validate dependencies is an array if provided
  if (operation.data.dependencies && !Array.isArray(operation.data.dependencies)) {
    return {
      success: false,
      error: 'Task dependencies must be an array',
      code: 'INVALID_DEPENDENCIES'
    };
  }

  return { success: true };
}

/**
 * Creates a metadata update operation
 * @param {string} planId - Plan ID
 * @param {Object} updates - Fields to update
 * @returns {MetadataUpdate} Metadata update operation
 */
function createMetadataUpdate(planId, updates) {
  return {
    type: 'update',
    target: 'metadata',
    data: updates,
    planId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a phase update operation
 * @param {string} planId - Plan ID
 * @param {'add'|'update'|'delete'} type - Operation type
 * @param {Object} data - Phase data
 * @returns {PhaseUpdate} Phase update operation
 */
function createPhaseUpdate(planId, type, data) {
  return {
    type,
    target: 'phase',
    data,
    planId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a task update operation
 * @param {string} planId - Plan ID
 * @param {'add'|'update'|'delete'} type - Operation type
 * @param {Object} data - Task data
 * @returns {TaskUpdate} Task update operation
 */
function createTaskUpdate(planId, type, data) {
  return {
    type,
    target: 'task',
    data,
    planId,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  validateUpdateOperation,
  validateMetadataUpdate,
  validatePhaseUpdate,
  validateTaskUpdate,
  createMetadataUpdate,
  createPhaseUpdate,
  createTaskUpdate
};
