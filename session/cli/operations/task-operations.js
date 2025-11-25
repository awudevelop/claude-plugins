const path = require('path');
const { readJsonFile, writeJsonFile, createBackup, fileExists } = require('../utils/atomic-operations');
const { generateTaskId } = require('../utils/id-generator');
const { validatePhase } = require('../validators/schema-validator');
const { canDeleteTask } = require('../validators/update-validator');
const { validateTaskDependencies } = require('../validators/integrity-validator');

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [message] - Success/error message
 * @property {Object} [data] - Result data
 * @property {string} [error] - Error details
 * @property {string} [backupPath] - Path to backup if created
 */

/**
 * Adds a new task to a phase
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID to add task to
 * @param {Object} taskData - Task data
 * @param {Object} options - Options
 * @param {number} [options.position] - Position to insert task (default: end)
 * @returns {Promise<OperationResult>} Operation result
 */
async function addTask(planDir, phaseId, taskData, options = {}) {
  let backupPath = null;

  try {
    // Find phase file
    const orchPath = path.join(planDir, 'orchestration.json');
    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan directory not found: ${planDir}`
      };
    }

    // Create backup
    backupPath = await createBackup(planDir);

    const orchestration = await readJsonFile(orchPath);
    const phase = orchestration.phases.find(p => p.id === phaseId);

    if (!phase) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found`
      };
    }

    // Load phase file
    const phaseFilePath = path.join(planDir, phase.file);
    if (!await fileExists(phaseFilePath)) {
      return {
        success: false,
        error: `Phase file not found: ${phase.file}`
      };
    }

    const phaseFile = await readJsonFile(phaseFilePath);

    // Generate task ID if not provided
    if (!taskData.task_id) {
      taskData.task_id = generateTaskId();
    }

    // Validate task ID is unique
    const existingTask = phaseFile.tasks.find(t => t.task_id === taskData.task_id);
    if (existingTask) {
      return {
        success: false,
        error: `Task ID '${taskData.task_id}' already exists in phase`
      };
    }

    // Build task object
    const newTask = {
      task_id: taskData.task_id,
      description: taskData.description || 'New task',
      details: taskData.details || '',
      status: taskData.status || 'pending',
      from_requirement: taskData.from_requirement || null,
      estimated_tokens: taskData.estimated_tokens || 1000,
      dependencies: taskData.dependencies || [],
      validation: taskData.validation || null,
      result: taskData.result || null
    };

    // Insert task at position
    const position = options.position !== undefined ? options.position : phaseFile.tasks.length;
    phaseFile.tasks.splice(position, 0, newTask);

    // Validate task dependencies
    const depValidation = validateTaskDependencies(phaseFile);
    if (!depValidation.valid) {
      return {
        success: false,
        error: 'Invalid task dependencies',
        details: depValidation.errors
      };
    }

    // Update phase file
    phaseFile.modified = new Date().toISOString();
    await writeJsonFile(phaseFilePath, phaseFile);

    // Update orchestration modified timestamp
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Task '${newTask.task_id}' added to phase '${phaseId}'`,
      data: {
        taskId: newTask.task_id,
        phaseId,
        position
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to add task: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Removes a task from a phase
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID containing the task
 * @param {string} taskId - Task ID to remove
 * @param {Object} options - Options
 * @param {boolean} [options.force=false] - Force removal even if completed
 * @returns {Promise<OperationResult>} Operation result
 */
async function removeTask(planDir, phaseId, taskId, options = {}) {
  let backupPath = null;

  try {
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

    const phase = orchestration.phases.find(p => p.id === phaseId);
    if (!phase) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found`
      };
    }

    // Load phase file
    const phaseFilePath = path.join(planDir, phase.file);
    if (!await fileExists(phaseFilePath)) {
      return {
        success: false,
        error: `Phase file not found: ${phase.file}`
      };
    }

    const phaseFile = await readJsonFile(phaseFilePath);

    // Validate can delete task
    const safetyCheck = canDeleteTask(taskId, phaseId, phaseFile, executionState, options);
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

    // Find and remove task
    const taskIndex = phaseFile.tasks.findIndex(t => t.task_id === taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: `Task '${taskId}' not found in phase '${phaseId}'`
      };
    }

    phaseFile.tasks.splice(taskIndex, 1);

    // Remove from execution state
    if (executionState.taskStatuses && executionState.taskStatuses[taskId]) {
      delete executionState.taskStatuses[taskId];
    }

    // Update phase file
    phaseFile.modified = new Date().toISOString();
    await writeJsonFile(phaseFilePath, phaseFile);

    // Update execution state
    if (await fileExists(statePath)) {
      executionState.lastUpdated = new Date().toISOString();
      await writeJsonFile(statePath, executionState);
    }

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Task '${taskId}' removed from phase '${phaseId}'`,
      data: {
        taskId,
        phaseId
      },
      warnings: safetyCheck.warnings,
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to remove task: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Updates a task's properties
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID containing the task
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<OperationResult>} Operation result
 */
async function updateTask(planDir, phaseId, taskId, updates) {
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

    const orchestration = await readJsonFile(orchPath);
    const phase = orchestration.phases.find(p => p.id === phaseId);

    if (!phase) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found`
      };
    }

    // Load phase file
    const phaseFilePath = path.join(planDir, phase.file);
    if (!await fileExists(phaseFilePath)) {
      return {
        success: false,
        error: `Phase file not found: ${phase.file}`
      };
    }

    const phaseFile = await readJsonFile(phaseFilePath);

    // Find task
    const task = phaseFile.tasks.find(t => t.task_id === taskId);
    if (!task) {
      return {
        success: false,
        error: `Task '${taskId}' not found in phase '${phaseId}'`
      };
    }

    // Update allowed fields
    const allowedFields = ['description', 'details', 'status', 'from_requirement', 'estimated_tokens', 'dependencies', 'validation', 'result'];
    const updatedFields = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        task[key] = value;
        updatedFields.push(key);
      }
    }

    // Validate dependencies if updated
    if (updates.dependencies) {
      const depValidation = validateTaskDependencies(phaseFile);
      if (!depValidation.valid) {
        return {
          success: false,
          error: 'Invalid task dependencies after update',
          details: depValidation.errors
        };
      }
    }

    // Update phase file
    phaseFile.modified = new Date().toISOString();
    await writeJsonFile(phaseFilePath, phaseFile);

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Task '${taskId}' updated successfully`,
      data: {
        taskId,
        phaseId,
        updatedFields
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update task: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Moves a task to a different phase
 * @param {string} planDir - Path to plan directory
 * @param {string} taskId - Task ID to move
 * @param {string} sourcePhaseId - Source phase ID
 * @param {string} targetPhaseId - Target phase ID
 * @param {Object} options - Options
 * @param {number} [options.position] - Position in target phase (default: end)
 * @returns {Promise<OperationResult>} Operation result
 */
async function moveTask(planDir, taskId, sourcePhaseId, targetPhaseId, options = {}) {
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

    const orchestration = await readJsonFile(orchPath);

    const sourcePhase = orchestration.phases.find(p => p.id === sourcePhaseId);
    const targetPhase = orchestration.phases.find(p => p.id === targetPhaseId);

    if (!sourcePhase) {
      return {
        success: false,
        error: `Source phase '${sourcePhaseId}' not found`
      };
    }

    if (!targetPhase) {
      return {
        success: false,
        error: `Target phase '${targetPhaseId}' not found`
      };
    }

    // Load phase files
    const sourceFilePath = path.join(planDir, sourcePhase.file);
    const targetFilePath = path.join(planDir, targetPhase.file);

    const sourceFile = await readJsonFile(sourceFilePath);
    const targetFile = sourcePhaseId === targetPhaseId
      ? sourceFile
      : await readJsonFile(targetFilePath);

    // Find and remove task from source
    const taskIndex = sourceFile.tasks.findIndex(t => t.task_id === taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: `Task '${taskId}' not found in source phase '${sourcePhaseId}'`
      };
    }

    const task = sourceFile.tasks[taskIndex];
    sourceFile.tasks.splice(taskIndex, 1);

    // Add task to target
    const position = options.position !== undefined ? options.position : targetFile.tasks.length;
    targetFile.tasks.splice(position, 0, task);

    // Update phase files
    sourceFile.modified = new Date().toISOString();
    await writeJsonFile(sourceFilePath, sourceFile);

    if (sourcePhaseId !== targetPhaseId) {
      targetFile.modified = new Date().toISOString();
      await writeJsonFile(targetFilePath, targetFile);
    }

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Task '${taskId}' moved from '${sourcePhaseId}' to '${targetPhaseId}'`,
      data: {
        taskId,
        sourcePhaseId,
        targetPhaseId,
        position
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to move task: ${error.message}`,
      backupPath
    };
  }
}

/**
 * Reorders tasks within a phase
 * @param {string} planDir - Path to plan directory
 * @param {string} phaseId - Phase ID
 * @param {Array<string>} newOrder - Array of task IDs in new order
 * @returns {Promise<OperationResult>} Operation result
 */
async function reorderTasks(planDir, phaseId, newOrder) {
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

    const orchestration = await readJsonFile(orchPath);
    const phase = orchestration.phases.find(p => p.id === phaseId);

    if (!phase) {
      return {
        success: false,
        error: `Phase '${phaseId}' not found`
      };
    }

    // Load phase file
    const phaseFilePath = path.join(planDir, phase.file);
    const phaseFile = await readJsonFile(phaseFilePath);

    // Validate all task IDs exist
    const existingIds = new Set(phaseFile.tasks.map(t => t.task_id));
    const newOrderSet = new Set(newOrder);

    if (existingIds.size !== newOrderSet.size) {
      return {
        success: false,
        error: 'New order must contain all existing task IDs'
      };
    }

    for (const id of newOrder) {
      if (!existingIds.has(id)) {
        return {
          success: false,
          error: `Task ID '${id}' not found in phase`
        };
      }
    }

    // Reorder tasks
    const taskMap = new Map(phaseFile.tasks.map(t => [t.task_id, t]));
    phaseFile.tasks = newOrder.map(id => taskMap.get(id));

    // Update phase file
    phaseFile.modified = new Date().toISOString();
    await writeJsonFile(phaseFilePath, phaseFile);

    // Update orchestration
    orchestration.metadata.modified = new Date().toISOString();
    await writeJsonFile(orchPath, orchestration);

    return {
      success: true,
      message: `Tasks in phase '${phaseId}' reordered successfully`,
      data: {
        phaseId,
        newOrder
      },
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to reorder tasks: ${error.message}`,
      backupPath
    };
  }
}

module.exports = {
  addTask,
  removeTask,
  updateTask,
  moveTask,
  reorderTasks
};
