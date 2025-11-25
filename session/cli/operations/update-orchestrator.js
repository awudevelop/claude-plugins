const { createBackup, restoreFromBackup } = require('../utils/atomic-operations');
const { validateUpdateOperation } = require('../models/update-operations');
const { updatePlanMetadata } = require('./metadata-operations');
const { addPhase, removePhase, updatePhaseMetadata, reorderPhases } = require('./phase-operations');
const { addTask, removeTask, updateTask, moveTask, reorderTasks } = require('./task-operations');
const { logOperation, logBatchStart, logBatchComplete } = require('../utils/update-logger');

/**
 * @typedef {Object} ExecutionReport
 * @property {boolean} success - Whether all operations succeeded
 * @property {Array<Object>} completed - Successfully completed operations
 * @property {Array<Object>} failed - Failed operations
 * @property {string} [backupPath] - Path to backup created before execution
 * @property {string} [error] - Overall error message if execution failed
 * @property {Object} [rollback] - Rollback information if needed
 */

/**
 * Executes multiple update operations in a coordinated, atomic manner
 * @param {string} planDir - Path to plan directory
 * @param {Array<Object>} operations - Array of update operations to execute
 * @param {Object} options - Execution options
 * @param {boolean} [options.dryRun=false] - Validate without executing
 * @param {boolean} [options.stopOnError=true] - Stop execution on first error
 * @returns {Promise<ExecutionReport>} Execution report
 */
async function executeUpdate(planDir, operations, options = {}) {
  const dryRun = options.dryRun || false;
  const stopOnError = options.stopOnError !== undefined ? options.stopOnError : true;
  const enableLogging = options.enableLogging !== false; // Default to enabled
  const startTime = Date.now();

  const report = {
    success: false,
    completed: [],
    failed: [],
    backupPath: null,
    validationErrors: []
  };

  let batchId = null;

  try {
    // Log batch start (unless dry run)
    if (enableLogging && !dryRun) {
      batchId = await logBatchStart(planDir, operations, {
        mode: stopOnError ? 'rollback' : 'selective'
      });
    }

    // Step 1: Validate all operations
    console.log(`Validating ${operations.length} operations...`);

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const validation = validateUpdateOperation(operation);

      if (!validation.success) {
        report.validationErrors.push({
          index: i,
          operation,
          error: validation.error,
          code: validation.code
        });
      }
    }

    if (report.validationErrors.length > 0) {
      report.error = `${report.validationErrors.length} operation(s) failed validation`;
      return report;
    }

    if (dryRun) {
      report.success = true;
      report.message = 'Dry run completed - all operations valid';
      return report;
    }

    // Step 2: Create single backup before any changes
    console.log('Creating backup...');
    report.backupPath = await createBackup(planDir);

    // Step 3: Sort operations by execution order (metadata -> phases -> tasks)
    const sortedOps = sortOperationsByPriority(operations);

    // Step 4: Execute operations in order
    console.log(`Executing ${sortedOps.length} operations...`);

    for (let i = 0; i < sortedOps.length; i++) {
      const operation = sortedOps[i];

      try {
        const result = await executeOperation(planDir, operation);

        if (result.success) {
          report.completed.push({
            index: i,
            operation,
            result
          });

          // Log successful operation
          if (enableLogging) {
            await logOperation(planDir, operation, {
              before: result.before,
              after: result.after,
              success: true,
              metadata: { batchId, operationIndex: i }
            });
          }
        } else {
          report.failed.push({
            index: i,
            operation,
            error: result.error,
            result
          });

          // Log failed operation
          if (enableLogging) {
            await logOperation(planDir, operation, {
              success: false,
              error: result.error,
              metadata: { batchId, operationIndex: i }
            });
          }

          if (stopOnError) {
            throw new Error(`Operation ${i} failed: ${result.error}`);
          }
        }
      } catch (error) {
        report.failed.push({
          index: i,
          operation,
          error: error.message
        });

        // Log exception
        if (enableLogging) {
          await logOperation(planDir, operation, {
            success: false,
            error: error.message,
            metadata: { batchId, operationIndex: i, exception: true }
          });
        }

        if (stopOnError) {
          throw error;
        }
      }
    }

    // Check if any operations failed
    if (report.failed.length > 0) {
      if (stopOnError) {
        // Rollback on failure
        console.log('Rolling back changes...');
        await restoreFromBackup(report.backupPath);
        report.rollback = {
          performed: true,
          backupRestored: report.backupPath
        };
        report.error = `${report.failed.length} operation(s) failed - changes rolled back`;
      } else {
        report.error = `${report.failed.length} operation(s) failed - partial update completed`;
        report.success = true; // Partial success
      }
    } else {
      report.success = true;
      report.message = `All ${report.completed.length} operations completed successfully`;
    }

    // Log batch completion
    if (enableLogging && batchId) {
      await logBatchComplete(planDir, batchId, report, {
        duration: Date.now() - startTime
      });
    }

    return report;
  } catch (error) {
    // Rollback on unexpected error
    if (report.backupPath && stopOnError) {
      try {
        console.log('Rolling back due to error...');
        await restoreFromBackup(report.backupPath);
        report.rollback = {
          performed: true,
          backupRestored: report.backupPath
        };
      } catch (rollbackError) {
        report.rollback = {
          performed: false,
          error: rollbackError.message
        };
      }
    }

    report.error = `Execution failed: ${error.message}`;

    // Log batch failure
    if (enableLogging && batchId) {
      await logBatchComplete(planDir, batchId, report, {
        duration: Date.now() - startTime
      });
    }

    return report;
  }
}

/**
 * Sorts operations by execution priority
 * Order: metadata -> phases -> tasks
 * @param {Array<Object>} operations - Operations to sort
 * @returns {Array<Object>} Sorted operations
 */
function sortOperationsByPriority(operations) {
  const priority = {
    metadata: 1,
    phase: 2,
    task: 3
  };

  return [...operations].sort((a, b) => {
    const aPriority = priority[a.target] || 999;
    const bPriority = priority[b.target] || 999;
    return aPriority - bPriority;
  });
}

/**
 * Executes a single update operation
 * @param {string} planDir - Path to plan directory
 * @param {Object} operation - Operation to execute
 * @returns {Promise<Object>} Operation result
 */
async function executeOperation(planDir, operation) {
  const { type, target, data } = operation;

  try {
    switch (target) {
      case 'metadata':
        return await executeMetadataOperation(planDir, type, data);

      case 'phase':
        return await executePhaseOperation(planDir, type, data);

      case 'task':
        return await executeTaskOperation(planDir, type, data);

      default:
        return {
          success: false,
          error: `Unknown operation target: ${target}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Executes a metadata operation
 * @param {string} planDir - Path to plan directory
 * @param {string} type - Operation type
 * @param {Object} data - Operation data
 * @returns {Promise<Object>} Operation result
 */
async function executeMetadataOperation(planDir, type, data) {
  if (type !== 'update') {
    return {
      success: false,
      error: 'Only update operations are supported for metadata'
    };
  }

  return await updatePlanMetadata(planDir, data);
}

/**
 * Executes a phase operation
 * @param {string} planDir - Path to plan directory
 * @param {string} type - Operation type (add, update, delete)
 * @param {Object} data - Operation data
 * @returns {Promise<Object>} Operation result
 */
async function executePhaseOperation(planDir, type, data) {
  switch (type) {
    case 'add':
      return await addPhase(planDir, data, { position: data.insertAtIndex });

    case 'update':
      return await updatePhaseMetadata(planDir, data.id, data);

    case 'delete':
      return await removePhase(planDir, data.id, { force: data.force });

    default:
      return {
        success: false,
        error: `Unknown phase operation type: ${type}`
      };
  }
}

/**
 * Executes a task operation
 * @param {string} planDir - Path to plan directory
 * @param {string} type - Operation type (add, update, delete)
 * @param {Object} data - Operation data
 * @returns {Promise<Object>} Operation result
 */
async function executeTaskOperation(planDir, type, data) {
  switch (type) {
    case 'add':
      return await addTask(planDir, data.phaseId, data, { position: data.insertAtIndex });

    case 'update':
      return await updateTask(planDir, data.phaseId, data.id, data);

    case 'delete':
      return await removeTask(planDir, data.phaseId, data.id, { force: data.force });

    default:
      return {
        success: false,
        error: `Unknown task operation type: ${type}`
      };
  }
}

/**
 * Creates a batch of update operations
 * @param {string} planId - Plan ID
 * @param {Array<Object>} updates - Array of update specifications
 * @returns {Array<Object>} Formatted operations
 */
function createUpdateBatch(planId, updates) {
  return updates.map(update => ({
    type: update.type,
    target: update.target,
    data: update.data,
    planId,
    timestamp: new Date().toISOString()
  }));
}

module.exports = {
  executeUpdate,
  sortOperationsByPriority,
  executeOperation,
  createUpdateBatch
};
