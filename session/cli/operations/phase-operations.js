const path = require('path');
const { readJsonFile, writeJsonFile, createBackup, fileExists } = require('../utils/atomic-operations');
const { generatePhaseId } = require('../utils/id-generator');
const { validateOrchestration } = require('../validators/schema-validator');
const { canDeletePhase } = require('../validators/update-validator');
const { validatePhaseDependencies } = require('../validators/integrity-validator');
const { updateOrchestrationProgress } = require('../utils/progress-calculator');

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [message] - Success/error message
 * @property {Object} [data] - Result data
 * @property {string} [error] - Error details
 * @property {string} [backupPath] - Path to backup if created
 */

/**
 * Adds a new phase to the plan
 * @param {string} planDir - Path to plan directory
 * @param {Object} phaseData - Phase data
 * @param {Object} options - Options
 * @param {number} [options.position] - Position to insert phase (default: end)
 * @returns {Promise<OperationResult>} Operation result
 */
async function addPhase(planDir, phaseData, options = {}) {
  let backupPath = null;

  try {
    // Validate plan directory exists
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

    // Generate phase ID if not provided
    if (!phaseData.id) {
      // Generate ID in format: phase-{number}-{slug}
      const nextNumber = orchestration.phases.length + 1;
      const slug = phaseData.name
        ? phaseData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : 'new-phase';
      phaseData.id = `phase-${nextNumber}-${slug}`;
    }

    // Validate phase ID is unique
    const existingPhase = orchestration.phases.find(p => p.id === phaseData.id);
    if (existingPhase) {
      return {
        success: false,
        error: `Phase ID '${phaseData.id}' already exists`
      };
    }

    // Build phase object
    const newPhase = {
      id: phaseData.id,
      name: phaseData.name || 'New Phase',
      file: phaseData.file || `phases/${phaseData.id}.json`,
      type: phaseData.type || 'sequential',
      dependencies: phaseData.dependencies || [],
      status: 'pending',
      estimatedTokens: phaseData.estimatedTokens || 5000,
      estimatedDuration: phaseData.estimatedDuration || '1h'
    };

    // Insert phase at position
    const position = options.position !== undefined ? options.position : orchestration.phases.length;
    orchestration.phases.splice(position, 0, newPhase);

    // Validate dependencies
    const depValidation = validatePhaseDependencies(orchestration);
    if (!depValidation.valid) {
      return {
        success: false,
        error: 'Invalid phase dependencies',
        details: depValidation.errors
      };
    }

    // Validate orchestration schema
    const schemaValidation = await validateOrchestration(orchestration);
    if (!schemaValidation.valid) {
      return {
        success: false,
        error: 'Orchestration schema validation failed',
        details: schemaValidation.errors.slice(0, 5)
      };
    }

    // Create phase file
    const phaseFilePath = path.join(planDir, newPhase.file);
    const phaseFileData = {
      phase_id: newPhase.id,
      phase_name: newPhase.name,
      description: phaseData.description || '',
      dependencies: newPhase.dependencies,
      status: 'pending',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      file: newPhase.file,
      tasks: phaseData.tasks || []
    };

    await writeJsonFile(phaseFilePath, phaseFileData);

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Phase '${newPhase.id}' added successfully`,
      data: {
        phaseId: newPhase.id,
        position
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to add phase: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Removes a phase from the plan
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID to remove
 * @param {Object} options - Options
 * @param {boolean} [options.force=false] - Force removal even if completed
 * @returns {Promise<OperationResult>} Operation result
 */
async function removePhase(planDir, phaseId, options = {}) {
  let backupPath = null;

  try {
    // Load orchestration and execution state
    const orchPath = path.join(planDir, 'orchestration.json');
    const statePath = path.join(planDir, 'execution-state.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    const orchestration = await readJsonFile(orchPath);
    const executionState = await fileExists(statePath)
      ? await readJsonFile(statePath)
      : { phaseStatuses: {}, taskStatuses: {} };

    // Validate can delete phase
    const safetyCheck = canDeletePhase(phaseId, orchestration, executionState, options);
    if (!safetyCheck.canProceed) {
      return {
        success: false,
        error: safetyCheck.reason,
        code: safetyCheck.code,
        requiresForce: safetyCheck.requiresForce
      };
    }

    // Create backup
    backupPath = await createBackup(planDir);

    // Find phase
    const phaseIndex = orchestration.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found`
      };
    }

    const phase = orchestration.phases[phaseIndex];

    // Remove phase from orchestration
    orchestration.phases.splice(phaseIndex, 1);

    // Remove from execution state
    if (executionState.phaseStatuses && executionState.phaseStatuses[phaseId]) {
      delete executionState.phaseStatuses[phaseId];
    }

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    // Update execution state
    if (await fileExists(statePath)) {
      executionState.lastUpdated = new Date().toISOString();
      await writeJsonFile(statePath, executionState);
    }

    return {
      success: true,
      message: `Phase '${phaseId}' removed successfully`,
      data: {
        phaseId,
        removedFile: phase.file
      },
      warnings: safetyCheck.warnings,
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to remove phase: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Updates phase metadata
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<OperationResult>} Operation result
 */
async function updatePhaseMetadata(planDir, phaseId, updates) {
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

    // Find phase in orchestration
    const phase = orchestration.phases.find(p => p.id === phaseId);
    if (!phase) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found in orchestration`
      };
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'type', 'dependencies', 'estimatedTokens', 'estimatedDuration'];
    const updatedFields = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) || key === 'status') {
        phase[key] = value;
        updatedFields.push(key);
      }
    }

    // Load and update phase file if it exists
    const phaseFilePath = path.join(planDir, phase.file);
    if (await fileExists(phaseFilePath)) {
      const phaseFile = await readJsonFile(phaseFilePath);

      if (updates.name) phaseFile.phase_name = updates.name;
      if (updates.description !== undefined) phaseFile.description = updates.description;
      if (updates.dependencies) phaseFile.dependencies = updates.dependencies;
      if (updates.status) phaseFile.status = updates.status;

      phaseFile.modified = new Date().toISOString();
      await writeJsonFile(phaseFilePath, phaseFile);
    }

    // Validate dependencies if updated
    if (updates.dependencies) {
      const depValidation = validatePhaseDependencies(orchestration);
      if (!depValidation.valid) {
        return {
          success: false,
          error: 'Invalid phase dependencies after update',
          details: depValidation.errors
        };
      }
    }

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Phase '${phaseId}' updated successfully`,
      data: {
        phaseId,
        updatedFields
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update phase: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Reorders phases in the plan
 * @param {string} planDir - Path to plan directory
 * @param {Array<string>} newOrder - Array of phase IDs in new order
 * @returns {Promise<OperationResult>} Operation result
 */
async function reorderPhases(planDir, newOrder) {
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

    // Validate all phase IDs exist
    const existingIds = new Set(orchestration.phases.map(p => p.id));
    const newOrderSet = new Set(newOrder);

    if (existingIds.size !== newOrderSet.size) {
      return {
        success: false,
        error: 'New order must contain all existing phase IDs'
      };
    }

    for (const id of newOrder) {
      if (!existingIds.has(id)) {
        return {
          success: false,
          error: `Phase ID '${id}' not found in orchestration`
        };
      }
    }

    // Reorder phases
    const phaseMap = new Map(orchestration.phases.map(p => [p.id, p]));
    orchestration.phases = newOrder.map(id => phaseMap.get(id));

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: 'Phases reordered successfully',
      data: {
        newOrder
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to reorder phases: ${error.message}`,
      backupPath
    };
  }
}

module.exports = {
  addPhase,
  removePhase,
  updatePhaseMetadata,
  reorderPhases
};
