const path = require('path');
const { readJsonFile, writeJsonFile, createBackup, fileExists } = require('../utils/atomic-operations');
const { validateOrchestration } = require('../validators/schema-validator');

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [message] - Success/error message
 * @property {Object} [data] - Result data
 * @property {string} [error] - Error details
 * @property {string} [backupPath] - Path to backup if created
 */

/**
 * Updates plan metadata in orchestration.json
 * @param {string} planDir - Path to plan directory
 * @param {Object} updates - Metadata fields to update
 * @returns {Promise<OperationResult>} Operation result
 */
async function updatePlanMetadata(planDir, updates) {
  let backupPath = null;

  try {
    const orchPath = path.join(planDir, 'orchestration.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    // Create backup
    backupPath = await createBackup(planDir);

    // Load orchestration
    const orchestration = await readJsonFile(orchPath);

    // Update allowed metadata fields
    const allowedFields = [
      'name',
      'description',
      'workType',
      'planType',
      'derivedFrom',
      'status',
      'version'
    ];

    const updatedFields = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        orchestration.metadata[key] = value;
        updatedFields.push(key);
      }
    }

    if (updatedFields.length === 0) {
      return {
        success: false,
        error: 'No valid metadata fields provided to update',
        allowedFields
      };
    }

    // Always update modified timestamp
    orchestration.metadata.modified = new Date().toISOString();

    // Validate orchestration after update
    const validation = await validateOrchestration(orchestration);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Metadata update would violate schema constraints',
        details: validation.errors.slice(0, 5)
      };
    }

    // Write updated orchestration
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: 'Plan metadata updated successfully',
      data: {
        updatedFields,
        metadata: orchestration.metadata
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update metadata: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Updates execution configuration in orchestration.json
 * @param {string} planDir - Path to plan directory
 * @param {Object} updates - Execution configuration updates
 * @returns {Promise<OperationResult>} Operation result
 */
async function updateExecutionConfig(planDir, updates) {
  let backupPath = null;

  try {
    const orchPath = path.join(planDir, 'orchestration.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    // Create backup
    backupPath = await createBackup(planDir);

    // Load orchestration
    const orchestration = await readJsonFile(orchPath);

    // Update execution configuration
    const allowedFields = ['strategy', 'maxParallelPhases'];
    const updatedFields = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        orchestration.execution[key] = value;
        updatedFields.push(key);
      }
    }

    // Update nested fields
    if (updates.tokenBudget) {
      orchestration.execution.tokenBudget = {
        ...orchestration.execution.tokenBudget,
        ...updates.tokenBudget
      };
      updatedFields.push('tokenBudget');
    }

    if (updates.retryPolicy) {
      orchestration.execution.retryPolicy = {
        ...orchestration.execution.retryPolicy,
        ...updates.retryPolicy
      };
      updatedFields.push('retryPolicy');
    }

    if (updatedFields.length === 0) {
      return {
        success: false,
        error: 'No valid execution configuration fields provided'
      };
    }

    // Always update modified timestamp
    orchestration.metadata.modified = new Date().toISOString();

    // Validate orchestration after update
    const validation = await validateOrchestration(orchestration);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Execution config update would violate schema constraints',
        details: validation.errors.slice(0, 5)
      };
    }

    // Write updated orchestration
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: 'Execution configuration updated successfully',
      data: {
        updatedFields,
        execution: orchestration.execution
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update execution config: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Gets current plan metadata
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<OperationResult>} Operation result with metadata
 */
async function getPlanMetadata(planDir) {
  try {
    const orchPath = path.join(planDir, 'orchestration.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    const orchestration = await readJsonFile(orchPath);

    return {
      success: true,
      data: {
        metadata: orchestration.metadata,
        execution: orchestration.execution,
        progress: orchestration.progress
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get metadata: ${error.message}`
    };
  }
}

/**
 * Updates multiple orchestration fields atomically
 * @param {string} planDir - Path to plan directory
 * @param {Object} updates - Updates object with metadata, execution, etc.
 * @returns {Promise<OperationResult>} Operation result
 */
async function updateOrchestration(planDir, updates) {
  let backupPath = null;

  try {
    const orchPath = path.join(planDir, 'orchestration.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    // Create backup
    backupPath = await createBackup(planDir);

    // Load orchestration
    const orchestration = await readJsonFile(orchPath);
    const updatedSections = [];

    // Update metadata if provided
    if (updates.metadata) {
      const allowedMetadataFields = ['name', 'description', 'workType', 'planType', 'derivedFrom', 'status', 'version'];
      for (const [key, value] of Object.entries(updates.metadata)) {
        if (allowedMetadataFields.includes(key)) {
          orchestration.metadata[key] = value;
        }
      }
      updatedSections.push('metadata');
    }

    // Update execution if provided
    if (updates.execution) {
      orchestration.execution = {
        ...orchestration.execution,
        ...updates.execution
      };
      updatedSections.push('execution');
    }

    // Update progress if provided (usually done by progress calculator)
    if (updates.progress) {
      orchestration.progress = {
        ...orchestration.progress,
        ...updates.progress
      };
      updatedSections.push('progress');
    }

    if (updatedSections.length === 0) {
      return {
        success: false,
        error: 'No valid updates provided'
      };
    }

    // Always update modified timestamp
    orchestration.metadata.modified = new Date().toISOString();

    // Validate orchestration after update
    const validation = await validateOrchestration(orchestration);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Orchestration update would violate schema constraints',
        details: validation.errors.slice(0, 5)
      };
    }

    // Write updated orchestration
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: 'Orchestration updated successfully',
      data: {
        updatedSections
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update orchestration: ${error.message}`,
      backupPath
    };
  }
}

module.exports = {
  updatePlanMetadata,
  updateExecutionConfig,
  getPlanMetadata,
  updateOrchestration
};
