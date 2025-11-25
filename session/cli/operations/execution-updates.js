const path = require('path');
const fs = require('fs').promises;
const { readJsonFile, writeJsonFile, fileExists, copyDirectory, createBackup } = require('../utils/atomic-operations');
const { getExecutionState, canSafelyUpdate } = require('../utils/execution-analyzer');
const { executeUpdate } = require('./update-orchestrator');

/**
 * @typedef {Object} RollbackResult
 * @property {boolean} success - Whether rollback succeeded
 * @property {string} [message] - Success/error message
 * @property {Object} [data] - Result data including backup paths
 * @property {string} [error] - Error details
 * @property {Object} [resumeGuidance] - Guidance for resuming execution
 */

/**
 * @typedef {Object} SelectiveUpdateResult
 * @property {boolean} success - Whether update succeeded
 * @property {string} [message] - Success/error message
 * @property {Object} [data] - Result data
 * @property {Array<string>} [warnings] - Warning messages
 * @property {Array<Object>} [skippedOperations] - Operations that were skipped
 * @property {string} [error] - Error details
 */

/**
 * Performs a rollback-and-replan update on an executing plan
 * This mode:
 * 1. Backs up execution logs to .logs-backup/
 * 2. Resets all task statuses to pending
 * 3. Applies the requested updates
 * 4. Preserves execution metadata in orchestration.execution_history
 * 5. Provides resume guidance
 *
 * @param {string} planDir - Path to plan directory
 * @param {Array<Object>} updates - Array of update operations to apply
 * @param {Object} options - Options
 * @param {boolean} [options.dryRun=false] - Preview without executing
 * @param {boolean} [options.preserveCompleted=false] - Keep completed task results in history
 * @returns {Promise<RollbackResult>} Rollback result
 */
async function rollbackAndReplan(planDir, updates, options = {}) {
  const dryRun = options.dryRun || false;
  const preserveCompleted = options.preserveCompleted !== false;

  const result = {
    success: false,
    data: {
      logsBackupPath: null,
      planBackupPath: null,
      tasksReset: 0,
      phasesReset: 0,
      updatesApplied: 0,
      executionHistoryPreserved: false
    },
    resumeGuidance: null
  };

  try {
    // Step 1: Verify plan exists and get current state
    const orchPath = path.join(planDir, 'orchestration.json');
    const statePath = path.join(planDir, 'execution-state.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan not found at: ${planDir}`
      };
    }

    const executionState = await getExecutionState(planDir);
    const orchestration = await readJsonFile(orchPath);

    // Check if plan has started
    if (!executionState.hasStarted) {
      return {
        success: false,
        error: 'Plan has not started execution. Use regular update instead of rollback-replan.',
        suggestion: 'Use executeUpdate() for plans that have not started'
      };
    }

    // Warn if there are in-progress tasks
    if (executionState.inProgressTasks.length > 0) {
      result.warnings = result.warnings || [];
      result.warnings.push(
        `Warning: ${executionState.inProgressTasks.length} task(s) are currently in-progress and will be reset: ${executionState.inProgressTasks.join(', ')}`
      );
    }

    if (dryRun) {
      return {
        success: true,
        message: 'Dry run completed - rollback-replan would proceed',
        data: {
          tasksToReset: executionState.completedTasks.length + executionState.inProgressTasks.length,
          phasesToReset: executionState.completedPhases.length,
          updatesToApply: updates.length
        },
        dryRun: true
      };
    }

    // Step 2: Create full plan backup before any changes
    result.data.planBackupPath = await createBackup(planDir);

    // Step 3: Backup execution logs to .logs-backup/
    const logsBackupPath = await backupExecutionLogs(planDir, executionState);
    result.data.logsBackupPath = logsBackupPath;

    // Step 4: Preserve execution history in orchestration
    const historyEntry = createExecutionHistoryEntry(executionState, orchestration);
    if (!orchestration.execution_history) {
      orchestration.execution_history = [];
    }
    orchestration.execution_history.push(historyEntry);
    result.data.executionHistoryPreserved = true;

    // Step 5: Reset all task statuses to pending
    const resetResult = await resetAllStatuses(planDir, orchestration, preserveCompleted);
    result.data.tasksReset = resetResult.tasksReset;
    result.data.phasesReset = resetResult.phasesReset;

    // Step 6: Apply updates
    if (updates && updates.length > 0) {
      const updateResult = await executeUpdate(planDir, updates, { stopOnError: true });

      if (!updateResult.success) {
        // Rollback to backup if updates fail
        return {
          success: false,
          error: `Updates failed after rollback: ${updateResult.error}`,
          data: result.data,
          suggestion: `Backup available at: ${result.data.planBackupPath}`
        };
      }

      result.data.updatesApplied = updateResult.completed.length;
    }

    // Step 7: Update orchestration with history
    orchestration.metadata.modified = new Date().toISOString();
    orchestration.metadata.status = 'pending';
    await writeJsonFile(orchPath, orchestration);

    // Step 8: Generate resume guidance
    result.resumeGuidance = generateResumeGuidance(planDir, executionState, updates);

    result.success = true;
    result.message = `Rollback-replan completed. ${result.data.tasksReset} tasks reset, ${result.data.updatesApplied} updates applied.`;

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Rollback-replan failed: ${error.message}`,
      data: result.data,
      suggestion: result.data.planBackupPath
        ? `Restore from backup: ${result.data.planBackupPath}`
        : 'No backup was created before failure'
    };
  }
}

/**
 * Backs up execution logs to .logs-backup/ directory
 * @param {string} planDir - Path to plan directory
 * @param {Object} executionState - Current execution state
 * @returns {Promise<string>} Path to backup directory
 */
async function backupExecutionLogs(planDir, executionState) {
  const timestamp = new Date().toISOString()
    .replace(/T/, '-')
    .replace(/\..+/, '')
    .replace(/:/g, '');

  const logsBackupDir = path.join(planDir, '.logs-backup', `logs-${timestamp}`);
  await fs.mkdir(logsBackupDir, { recursive: true });

  // Backup execution-state.json
  const statePath = path.join(planDir, 'execution-state.json');
  if (await fileExists(statePath)) {
    const stateBackupPath = path.join(logsBackupDir, 'execution-state.json');
    await fs.copyFile(statePath, stateBackupPath);
  }

  // Create a summary file
  const summary = {
    backupTime: new Date().toISOString(),
    completedTasks: executionState.completedTasks,
    inProgressTasks: executionState.inProgressTasks,
    failedTasks: executionState.failedTasks,
    completedPhases: executionState.completedPhases,
    currentPhase: executionState.currentPhase,
    startedAt: executionState.startedAt,
    taskStatuses: executionState.taskStatuses,
    phaseStatuses: executionState.phaseStatuses
  };

  await writeJsonFile(path.join(logsBackupDir, 'execution-summary.json'), summary);

  // Cleanup old log backups (keep last 5)
  await cleanupOldLogBackups(path.join(planDir, '.logs-backup'), 5);

  return logsBackupDir;
}

/**
 * Creates an execution history entry for preservation
 * @param {Object} executionState - Current execution state
 * @param {Object} orchestration - Current orchestration
 * @returns {Object} History entry
 */
function createExecutionHistoryEntry(executionState, orchestration) {
  return {
    timestamp: new Date().toISOString(),
    reason: 'rollback-replan',
    previousState: {
      completedTasks: executionState.completedTasks.length,
      inProgressTasks: executionState.inProgressTasks.length,
      completedPhases: executionState.completedPhases.length,
      currentPhase: executionState.currentPhase,
      startedAt: executionState.startedAt,
      progress: orchestration.progress ? { ...orchestration.progress } : null
    },
    taskResults: extractCompletedTaskResults(executionState)
  };
}

/**
 * Extracts results from completed tasks for history preservation
 * @param {Object} executionState - Execution state
 * @returns {Object} Map of task ID to result summary
 */
function extractCompletedTaskResults(executionState) {
  const results = {};

  for (const taskId of executionState.completedTasks) {
    results[taskId] = {
      status: 'completed',
      completedAt: executionState.lastUpdated
    };
  }

  for (const taskId of executionState.failedTasks) {
    results[taskId] = {
      status: 'failed',
      failedAt: executionState.lastUpdated
    };
  }

  return results;
}

/**
 * Resets all task and phase statuses to pending
 * @param {string} planDir - Path to plan directory
 * @param {Object} orchestration - Orchestration object
 * @param {boolean} preserveResults - Whether to preserve task results
 * @returns {Promise<Object>} Reset statistics
 */
async function resetAllStatuses(planDir, orchestration, preserveResults) {
  const stats = {
    tasksReset: 0,
    phasesReset: 0
  };

  // Reset execution-state.json
  const statePath = path.join(planDir, 'execution-state.json');
  const newState = {
    currentPhase: orchestration.phases[0]?.id || null,
    phaseStatuses: {},
    taskStatuses: {},
    errors: [],
    startedAt: null,
    completedAt: null,
    lastUpdated: new Date().toISOString()
  };

  // Initialize all phases as pending
  for (const phase of orchestration.phases) {
    newState.phaseStatuses[phase.id] = 'pending';
    stats.phasesReset++;
  }

  await writeJsonFile(statePath, newState);

  // Reset task statuses in phase files
  for (const phase of orchestration.phases) {
    const phaseFilePath = path.join(planDir, phase.file);

    if (await fileExists(phaseFilePath)) {
      const phaseFile = await readJsonFile(phaseFilePath);

      if (phaseFile.tasks && Array.isArray(phaseFile.tasks)) {
        for (const task of phaseFile.tasks) {
          // Reset status
          task.status = 'pending';

          // Optionally clear result
          if (!preserveResults) {
            task.result = null;
          }

          // Add to execution state
          newState.taskStatuses[task.task_id] = 'pending';
          stats.tasksReset++;
        }

        // Update phase file
        phaseFile.status = 'pending';
        phaseFile.modified = new Date().toISOString();
        await writeJsonFile(phaseFilePath, phaseFile);
      }
    }
  }

  // Write final execution state with all tasks
  await writeJsonFile(statePath, newState);

  // Reset orchestration progress
  orchestration.progress = {
    completedPhases: 0,
    totalPhases: orchestration.phases.length,
    completedTasks: 0,
    totalTasks: stats.tasksReset,
    currentPhases: [],
    lastUpdated: new Date().toISOString()
  };

  // Reset phase statuses in orchestration
  for (const phase of orchestration.phases) {
    phase.status = 'pending';
  }

  return stats;
}

/**
 * Generates guidance for resuming plan execution
 * @param {string} planDir - Path to plan directory
 * @param {Object} previousState - Previous execution state
 * @param {Array<Object>} updates - Updates that were applied
 * @returns {Object} Resume guidance
 */
function generateResumeGuidance(planDir, previousState, updates) {
  const guidance = {
    message: 'Plan has been reset and updated. Ready for fresh execution.',
    previousProgress: {
      completedTasks: previousState.completedTasks.length,
      completedPhases: previousState.completedPhases.length,
      currentPhase: previousState.currentPhase
    },
    nextSteps: [
      'Review the updated plan structure',
      'Start execution from the first phase',
      'Use /session:plan-execute to begin'
    ],
    updatesApplied: updates.length,
    warnings: []
  };

  // Add warnings about lost work
  if (previousState.completedTasks.length > 0) {
    guidance.warnings.push(
      `${previousState.completedTasks.length} previously completed task(s) have been reset to pending.`
    );
  }

  if (previousState.inProgressTasks.length > 0) {
    guidance.warnings.push(
      `${previousState.inProgressTasks.length} in-progress task(s) were interrupted and reset.`
    );
  }

  // Provide recovery information
  guidance.recovery = {
    logsLocation: path.join(planDir, '.logs-backup'),
    historyLocation: 'orchestration.json -> execution_history',
    message: 'Previous execution state has been preserved in logs and history.'
  };

  return guidance;
}

/**
 * Cleans up old log backups, keeping only the most recent
 * @param {string} logsBackupDir - Path to .logs-backup directory
 * @param {number} keepCount - Number of backups to keep
 */
async function cleanupOldLogBackups(logsBackupDir, keepCount = 5) {
  try {
    const exists = await fileExists(logsBackupDir);
    if (!exists) return;

    const entries = await fs.readdir(logsBackupDir, { withFileTypes: true });
    const backups = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('logs-')) {
        const backupPath = path.join(logsBackupDir, entry.name);
        const stats = await fs.stat(backupPath);
        backups.push({
          name: entry.name,
          path: backupPath,
          mtime: stats.mtime
        });
      }
    }

    // Sort by modification time (newest first)
    backups.sort((a, b) => b.mtime - a.mtime);

    // Remove old backups
    const toRemove = backups.slice(keepCount);
    for (const backup of toRemove) {
      await fs.rm(backup.path, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn(`Warning: Failed to cleanup old log backups: ${error.message}`);
  }
}

/**
 * Gets the execution history for a plan
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<Array<Object>>} Execution history entries
 */
async function getExecutionHistory(planDir) {
  const orchPath = path.join(planDir, 'orchestration.json');

  if (!await fileExists(orchPath)) {
    return [];
  }

  const orchestration = await readJsonFile(orchPath);
  return orchestration.execution_history || [];
}

/**
 * Lists available log backups for a plan
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<Array<Object>>} Available backups
 */
async function listLogBackups(planDir) {
  const logsBackupDir = path.join(planDir, '.logs-backup');

  if (!await fileExists(logsBackupDir)) {
    return [];
  }

  const entries = await fs.readdir(logsBackupDir, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('logs-')) {
      const backupPath = path.join(logsBackupDir, entry.name);
      const summaryPath = path.join(backupPath, 'execution-summary.json');

      let summary = null;
      if (await fileExists(summaryPath)) {
        summary = await readJsonFile(summaryPath);
      }

      const stats = await fs.stat(backupPath);
      backups.push({
        name: entry.name,
        path: backupPath,
        created: stats.mtime,
        summary
      });
    }
  }

  // Sort by creation time (newest first)
  backups.sort((a, b) => b.created - a.created);

  return backups;
}

/**
 * Performs a selective update on an executing plan
 * This mode only modifies pending/not-started tasks and phases.
 * It will NOT touch completed or in-progress work unless force flag is used.
 *
 * @param {string} planDir - Path to plan directory
 * @param {Array<Object>} updates - Array of update operations to apply
 * @param {Object} options - Options
 * @param {boolean} [options.dryRun=false] - Preview without executing
 * @param {boolean} [options.force=false] - Force updates even on completed items
 * @param {boolean} [options.skipBlocked=false] - Skip blocked operations instead of failing
 * @returns {Promise<SelectiveUpdateResult>} Update result
 */
async function selectiveUpdate(planDir, updates, options = {}) {
  const dryRun = options.dryRun || false;
  const force = options.force || false;
  const skipBlocked = options.skipBlocked || false;

  const result = {
    success: false,
    data: {
      appliedOperations: 0,
      skippedOperations: 0,
      blockedOperations: 0
    },
    warnings: [],
    skippedDetails: [],
    blockedDetails: []
  };

  try {
    // Step 1: Verify plan exists
    const orchPath = path.join(planDir, 'orchestration.json');

    if (!await fileExists(orchPath)) {
      return {
        success: false,
        error: `Plan not found at: ${planDir}`
      };
    }

    // Step 2: Get execution state and analyze impact
    const executionState = await getExecutionState(planDir);
    const impact = await canSafelyUpdate(planDir, updates);

    // Step 3: Add execution continuity disclaimer
    if (executionState.hasStarted) {
      result.warnings.push(
        '⚠️  DISCLAIMER: Selective updates during execution may affect plan continuity.',
        'Changes to pending tasks will be applied, but execution flow may need review.',
        'Consider using rollback-replan mode for significant structural changes.'
      );
    }

    // Step 4: Categorize operations
    const safeOperations = [];
    const blockedOperations = [];

    for (const operation of updates) {
      const opSafe = isOperationSafe(operation, executionState, force);

      if (opSafe.safe) {
        safeOperations.push(operation);
        if (opSafe.warning) {
          result.warnings.push(opSafe.warning);
        }
      } else {
        blockedOperations.push({
          operation,
          reason: opSafe.reason,
          affectedItem: opSafe.affectedItem
        });
      }
    }

    result.data.blockedOperations = blockedOperations.length;
    result.blockedDetails = blockedOperations;

    // Step 5: Handle blocked operations
    if (blockedOperations.length > 0 && !skipBlocked) {
      // Build detailed error message
      const blockedMessages = blockedOperations.map(b =>
        `  - ${b.operation.type} ${b.operation.target} '${b.affectedItem}': ${b.reason}`
      );

      return {
        success: false,
        error: `${blockedOperations.length} operation(s) blocked - would affect completed/in-progress work`,
        blockedOperations: blockedOperations,
        details: blockedMessages.join('\n'),
        suggestion: force
          ? 'Operations are blocked even with force flag due to in-progress work'
          : 'Use force: true to update completed items, or skipBlocked: true to skip them',
        safeOperationsAvailable: safeOperations.length
      };
    }

    // Step 6: Dry run check
    if (dryRun) {
      return {
        success: true,
        message: 'Dry run completed - selective update preview',
        dryRun: true,
        data: {
          operationsToApply: safeOperations.length,
          operationsBlocked: blockedOperations.length,
          operationsSkipped: skipBlocked ? blockedOperations.length : 0
        },
        warnings: result.warnings,
        safeOperations: safeOperations.map(op => ({
          type: op.type,
          target: op.target,
          id: op.data?.id || op.data?.phaseId || 'new'
        })),
        blockedOperations: blockedOperations.map(b => ({
          type: b.operation.type,
          target: b.operation.target,
          reason: b.reason
        }))
      };
    }

    // Step 7: Apply safe operations
    if (safeOperations.length === 0) {
      return {
        success: true,
        message: 'No operations to apply - all were blocked or skipped',
        data: result.data,
        warnings: result.warnings,
        skippedDetails: blockedOperations
      };
    }

    // Create backup before changes
    const backupPath = await createBackup(planDir);

    const updateResult = await executeUpdate(planDir, safeOperations, {
      stopOnError: true
    });

    if (!updateResult.success) {
      return {
        success: false,
        error: `Update failed: ${updateResult.error}`,
        backupPath,
        suggestion: `Restore from backup if needed: ${backupPath}`
      };
    }

    result.data.appliedOperations = updateResult.completed.length;
    result.data.skippedOperations = skipBlocked ? blockedOperations.length : 0;

    // Step 8: Update execution state if needed
    await syncExecutionStateAfterUpdate(planDir);

    result.success = true;
    result.message = buildSuccessMessage(result.data, blockedOperations, skipBlocked);
    result.backupPath = backupPath;

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Selective update failed: ${error.message}`,
      data: result.data
    };
  }
}

/**
 * Checks if a single operation is safe to apply
 * @param {Object} operation - The operation to check
 * @param {Object} executionState - Current execution state
 * @param {boolean} force - Whether force flag is set
 * @returns {Object} Safety check result
 */
function isOperationSafe(operation, executionState, force) {
  const { type, target, data } = operation;

  // Adding new items is always safe
  if (type === 'add') {
    return {
      safe: true,
      warning: `Adding new ${target} to plan`
    };
  }

  // Metadata updates are always safe
  if (target === 'metadata') {
    return { safe: true };
  }

  // Check phase operations
  if (target === 'phase') {
    const phaseId = data.id;
    const phaseStatus = executionState.phaseStatuses[phaseId];

    // In-progress phases cannot be modified even with force
    if (phaseId === executionState.currentPhase && executionState.isExecuting) {
      return {
        safe: false,
        reason: 'Cannot modify phase while it is actively executing',
        affectedItem: phaseId
      };
    }

    // Completed phases require force flag
    if (phaseStatus === 'completed' && !force) {
      return {
        safe: false,
        reason: 'Phase is completed - use force flag to modify',
        affectedItem: phaseId
      };
    }

    // With force, completed phases can be modified (with warning)
    if (phaseStatus === 'completed' && force) {
      return {
        safe: true,
        warning: `⚠️  Modifying completed phase '${phaseId}' with force flag`
      };
    }

    return { safe: true };
  }

  // Check task operations
  if (target === 'task') {
    const taskId = data.id;
    const taskStatus = executionState.taskStatuses[taskId];

    // In-progress tasks cannot be modified even with force
    if (taskStatus === 'in_progress') {
      return {
        safe: false,
        reason: 'Cannot modify task while it is in progress',
        affectedItem: taskId
      };
    }

    // Completed tasks require force flag
    if (taskStatus === 'completed' && !force) {
      return {
        safe: false,
        reason: 'Task is completed - use force flag to modify',
        affectedItem: taskId
      };
    }

    // With force, completed tasks can be modified (with warning)
    if (taskStatus === 'completed' && force) {
      return {
        safe: true,
        warning: `⚠️  Modifying completed task '${taskId}' with force flag`
      };
    }

    return { safe: true };
  }

  // Unknown target - allow with warning
  return {
    safe: true,
    warning: `Unknown operation target: ${target}`
  };
}

/**
 * Syncs execution state after selective update
 * Ensures new tasks are tracked in execution state
 * @param {string} planDir - Path to plan directory
 */
async function syncExecutionStateAfterUpdate(planDir) {
  const statePath = path.join(planDir, 'execution-state.json');
  const orchPath = path.join(planDir, 'orchestration.json');

  if (!await fileExists(statePath) || !await fileExists(orchPath)) {
    return;
  }

  const executionState = await readJsonFile(statePath);
  const orchestration = await readJsonFile(orchPath);

  let modified = false;

  // Ensure all phases are tracked
  for (const phase of orchestration.phases) {
    if (!executionState.phaseStatuses[phase.id]) {
      executionState.phaseStatuses[phase.id] = 'pending';
      modified = true;
    }

    // Load phase file to check tasks
    const phaseFilePath = path.join(planDir, phase.file);
    if (await fileExists(phaseFilePath)) {
      const phaseFile = await readJsonFile(phaseFilePath);

      if (phaseFile.tasks && Array.isArray(phaseFile.tasks)) {
        for (const task of phaseFile.tasks) {
          if (!executionState.taskStatuses[task.task_id]) {
            executionState.taskStatuses[task.task_id] = 'pending';
            modified = true;
          }
        }
      }
    }
  }

  // Clean up removed phases/tasks from execution state
  const validPhaseIds = new Set(orchestration.phases.map(p => p.id));
  for (const phaseId of Object.keys(executionState.phaseStatuses)) {
    if (!validPhaseIds.has(phaseId)) {
      delete executionState.phaseStatuses[phaseId];
      modified = true;
    }
  }

  if (modified) {
    executionState.lastUpdated = new Date().toISOString();
    await writeJsonFile(statePath, executionState);
  }
}

/**
 * Builds a success message for selective update
 * @param {Object} data - Result data
 * @param {Array} blockedOperations - Blocked operations
 * @param {boolean} skipBlocked - Whether blocked ops were skipped
 * @returns {string} Success message
 */
function buildSuccessMessage(data, blockedOperations, skipBlocked) {
  const parts = [`Selective update completed: ${data.appliedOperations} operation(s) applied`];

  if (skipBlocked && blockedOperations.length > 0) {
    parts.push(`${blockedOperations.length} operation(s) skipped (would affect completed work)`);
  }

  return parts.join('. ');
}

module.exports = {
  rollbackAndReplan,
  selectiveUpdate,
  backupExecutionLogs,
  resetAllStatuses,
  getExecutionHistory,
  listLogBackups,
  generateResumeGuidance,
  createExecutionHistoryEntry,
  isOperationSafe,
  syncExecutionStateAfterUpdate
};
