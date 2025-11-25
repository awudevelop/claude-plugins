const { validateTaskDependencies } = require('./integrity-validator');

/**
 * @typedef {Object} SafetyCheckResult
 * @property {boolean} canProceed - Whether the operation can proceed
 * @property {string} [reason] - Reason if operation cannot proceed
 * @property {string} [code] - Error code
 * @property {boolean} [requiresForce] - Whether force flag would allow this operation
 * @property {Array<string>} [warnings] - Warning messages
 */

/**
 * Checks if a phase can be safely deleted
 * @param {string} phaseId - Phase ID to delete
 * @param {Object} orchestration - Orchestration object
 * @param {Object} executionState - Execution state
 * @param {Object} options - Options
 * @param {boolean} [options.force=false] - Force deletion even if completed
 * @returns {SafetyCheckResult} Safety check result
 */
function canDeletePhase(phaseId, orchestration, executionState, options = {}) {
  const force = options.force || false;
  const warnings = [];

  // Find the phase in orchestration
  const phase = orchestration.phases.find(p => p.id === phaseId);
  if (!phase) {
    return {
      canProceed: false,
      reason: `Phase '${phaseId}' not found in orchestration`,
      code: 'PHASE_NOT_FOUND'
    };
  }

  // Check phase status
  const phaseStatus = executionState.phaseStatuses?.[phaseId];

  // Cannot delete in-progress phases
  if (phaseStatus === 'in_progress') {
    return {
      canProceed: false,
      reason: `Phase '${phaseId}' is currently in progress and cannot be deleted`,
      code: 'PHASE_IN_PROGRESS',
      requiresForce: false
    };
  }

  // Check if phase is completed
  if (phaseStatus === 'completed' && !force) {
    return {
      canProceed: false,
      reason: `Phase '${phaseId}' is completed. Use --force to delete completed work`,
      code: 'PHASE_COMPLETED',
      requiresForce: true
    };
  }

  // Check for dependent phases
  const dependentPhases = orchestration.phases.filter(p =>
    p.dependencies && p.dependencies.includes(phaseId)
  );

  if (dependentPhases.length > 0) {
    const dependentIds = dependentPhases.map(p => p.id).join(', ');
    return {
      canProceed: false,
      reason: `Phase '${phaseId}' has dependent phases: ${dependentIds}. Remove dependencies first`,
      code: 'HAS_DEPENDENT_PHASES',
      requiresForce: false
    };
  }

  // Warn about data loss if force is used
  if (force && phaseStatus === 'completed') {
    warnings.push(`Deleting completed phase '${phaseId}' - all progress will be lost`);
  }

  return {
    canProceed: true,
    warnings
  };
}

/**
 * Checks if a task can be safely deleted
 * @param {string} taskId - Task ID to delete
 * @param {string} phaseId - Parent phase ID
 * @param {Object} phase - Phase object containing the task
 * @param {Object} executionState - Execution state
 * @param {Object} options - Options
 * @param {boolean} [options.force=false] - Force deletion even if completed
 * @returns {SafetyCheckResult} Safety check result
 */
function canDeleteTask(taskId, phaseId, phase, executionState, options = {}) {
  const force = options.force || false;
  const warnings = [];

  // Find the task
  const task = phase.tasks.find(t => t.task_id === taskId);
  if (!task) {
    return {
      canProceed: false,
      reason: `Task '${taskId}' not found in phase '${phaseId}'`,
      code: 'TASK_NOT_FOUND'
    };
  }

  // Check task status
  const taskStatus = executionState.taskStatuses?.[taskId];

  // Cannot delete in-progress tasks
  if (taskStatus === 'in_progress') {
    return {
      canProceed: false,
      reason: `Task '${taskId}' is currently in progress and cannot be deleted`,
      code: 'TASK_IN_PROGRESS',
      requiresForce: false
    };
  }

  // Check if task is completed
  if (taskStatus === 'completed' && !force) {
    return {
      canProceed: false,
      reason: `Task '${taskId}' is completed. Use --force to delete completed work`,
      code: 'TASK_COMPLETED',
      requiresForce: true
    };
  }

  // Check for dependent tasks
  const dependentTasks = phase.tasks.filter(t =>
    t.dependencies && t.dependencies.includes(taskId)
  );

  if (dependentTasks.length > 0) {
    const dependentIds = dependentTasks.map(t => t.task_id).join(', ');
    return {
      canProceed: false,
      reason: `Task '${taskId}' has dependent tasks: ${dependentIds}. Remove dependencies first`,
      code: 'HAS_DEPENDENT_TASKS',
      requiresForce: false
    };
  }

  // Warn about data loss if force is used
  if (force && taskStatus === 'completed') {
    warnings.push(`Deleting completed task '${taskId}' - all progress will be lost`);
  }

  return {
    canProceed: true,
    warnings
  };
}

/**
 * Validates update operations during active execution
 * @param {Object} orchestration - Orchestration object
 * @param {Object} executionState - Execution state
 * @param {Array<Object>} updateOperations - Array of update operations
 * @returns {Object} Validation result with allowed and blocked operations
 */
function validateUpdateDuringExecution(orchestration, executionState, updateOperations) {
  const allowed = [];
  const blocked = [];
  const warnings = [];

  // Check if execution is active
  const isActive = executionState.startedAt && !executionState.completedAt;
  const currentPhase = executionState.currentPhase;

  if (!isActive) {
    // Not executing, all operations allowed (subject to individual validation)
    return {
      allowed: updateOperations,
      blocked: [],
      warnings: ['Plan is not currently executing - all updates allowed']
    };
  }

  updateOperations.forEach(operation => {
    const { type, target, data } = operation;

    // Check operation type and target
    if (target === 'metadata') {
      // Metadata updates are generally safe during execution
      allowed.push(operation);
      return;
    }

    if (target === 'phase') {
      // Phase operations during execution
      if (type === 'delete') {
        // Cannot delete current or completed phases during execution
        const phaseId = data.id;
        const phaseStatus = executionState.phaseStatuses?.[phaseId];

        if (phaseId === currentPhase) {
          blocked.push({
            operation,
            reason: `Cannot delete current phase '${phaseId}' during execution`,
            code: 'DELETE_CURRENT_PHASE'
          });
          return;
        }

        if (phaseStatus === 'completed') {
          blocked.push({
            operation,
            reason: `Cannot delete completed phase '${phaseId}' during execution without --force`,
            code: 'DELETE_COMPLETED_PHASE_DURING_EXECUTION'
          });
          return;
        }

        if (phaseStatus === 'in_progress') {
          blocked.push({
            operation,
            reason: `Cannot delete in-progress phase '${phaseId}'`,
            code: 'DELETE_IN_PROGRESS_PHASE'
          });
          return;
        }

        // Can delete pending phases
        allowed.push(operation);
        warnings.push(`Deleting pending phase '${phaseId}' during execution - future work will be affected`);
        return;
      }

      if (type === 'update') {
        // Updates to completed phases should be warned about
        const phaseId = data.id;
        const phaseStatus = executionState.phaseStatuses?.[phaseId];

        if (phaseStatus === 'completed') {
          warnings.push(`Updating completed phase '${phaseId}' - may cause inconsistencies`);
        }

        allowed.push(operation);
        return;
      }

      // Add operations are generally safe
      allowed.push(operation);
      return;
    }

    if (target === 'task') {
      // Task operations during execution
      if (type === 'delete') {
        const taskId = data.id;
        const taskStatus = executionState.taskStatuses?.[taskId];

        if (taskStatus === 'in_progress') {
          blocked.push({
            operation,
            reason: `Cannot delete in-progress task '${taskId}'`,
            code: 'DELETE_IN_PROGRESS_TASK'
          });
          return;
        }

        if (taskStatus === 'completed') {
          blocked.push({
            operation,
            reason: `Cannot delete completed task '${taskId}' during execution without --force`,
            code: 'DELETE_COMPLETED_TASK_DURING_EXECUTION'
          });
          return;
        }

        // Can delete pending tasks
        allowed.push(operation);
        warnings.push(`Deleting pending task '${taskId}' during execution`);
        return;
      }

      // Other task operations
      if (type === 'update') {
        const taskId = data.id;
        const taskStatus = executionState.taskStatuses?.[taskId];

        if (taskStatus === 'completed') {
          warnings.push(`Updating completed task '${taskId}' - may cause inconsistencies`);
        }
      }

      allowed.push(operation);
      return;
    }

    // Unknown target/type - allow but warn
    allowed.push(operation);
    warnings.push(`Unknown operation type '${type}' on target '${target}' - allowing but use caution`);
  });

  return {
    allowed,
    blocked,
    warnings,
    isExecuting: isActive,
    currentPhase
  };
}

/**
 * Validates if a status transition is valid
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - New status to transition to
 * @param {string} entityType - Type of entity ('phase' or 'task')
 * @returns {SafetyCheckResult} Validation result
 */
function validateStatusTransition(currentStatus, newStatus, entityType = 'task') {
  const validTransitions = {
    task: {
      pending: ['in_progress', 'completed'],
      in_progress: ['completed', 'failed'],
      completed: [],
      failed: ['in_progress']
    },
    phase: {
      pending: ['in_progress', 'completed'],
      in_progress: ['completed', 'failed'],
      completed: [],
      failed: ['in_progress']
    }
  };

  const transitions = validTransitions[entityType];
  if (!transitions) {
    return {
      canProceed: false,
      reason: `Unknown entity type '${entityType}'`,
      code: 'INVALID_ENTITY_TYPE'
    };
  }

  if (!currentStatus) {
    // No current status, allow any initial status
    return { canProceed: true };
  }

  const allowedTransitions = transitions[currentStatus];
  if (!allowedTransitions) {
    return {
      canProceed: false,
      reason: `Unknown current status '${currentStatus}' for ${entityType}`,
      code: 'INVALID_CURRENT_STATUS'
    };
  }

  if (!allowedTransitions.includes(newStatus)) {
    return {
      canProceed: false,
      reason: `Invalid status transition for ${entityType}: ${currentStatus} -> ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`,
      code: 'INVALID_STATUS_TRANSITION'
    };
  }

  return { canProceed: true };
}

module.exports = {
  canDeletePhase,
  canDeleteTask,
  validateUpdateDuringExecution,
  validateStatusTransition
};
