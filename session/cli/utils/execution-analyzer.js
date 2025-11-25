const path = require('path');
const { readJsonFile, fileExists } = require('./atomic-operations');

/**
 * @typedef {Object} ExecutionState
 * @property {boolean} isExecuting - Whether the plan is currently being executed
 * @property {boolean} hasStarted - Whether execution has started at all
 * @property {Array<string>} inProgressTasks - Task IDs currently in progress
 * @property {Array<string>} completedTasks - Task IDs that are completed
 * @property {Array<string>} pendingTasks - Task IDs that are pending
 * @property {Array<string>} failedTasks - Task IDs that have failed
 * @property {string|null} currentPhase - Current phase ID (in progress or next pending)
 * @property {Array<string>} completedPhases - Phase IDs that are completed
 * @property {Array<string>} pendingPhases - Phase IDs that are pending
 * @property {Object} phaseStatuses - Map of phase ID to status
 * @property {Object} taskStatuses - Map of task ID to status
 * @property {string|null} startedAt - When execution started
 * @property {string|null} lastUpdated - When execution state was last updated
 */

/**
 * @typedef {Object} UpdateImpact
 * @property {boolean} safe - Whether the update is safe to perform
 * @property {boolean} affectsCompletedWork - Whether update affects completed tasks/phases
 * @property {boolean} affectsInProgressWork - Whether update affects in-progress tasks
 * @property {Array<Object>} blockedOperations - Operations that cannot be performed safely
 * @property {Array<Object>} safeOperations - Operations that can be performed safely
 * @property {Array<string>} warnings - Warning messages
 * @property {string} recommendation - Recommended action (proceed, selective, rollback)
 */

/**
 * Gets the current execution state of a plan
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<ExecutionState>} Execution state information
 */
async function getExecutionState(planDir) {
  const state = {
    isExecuting: false,
    hasStarted: false,
    inProgressTasks: [],
    completedTasks: [],
    pendingTasks: [],
    failedTasks: [],
    currentPhase: null,
    completedPhases: [],
    pendingPhases: [],
    phaseStatuses: {},
    taskStatuses: {},
    startedAt: null,
    lastUpdated: null
  };

  try {
    // Read execution-state.json if it exists
    const executionStatePath = path.join(planDir, 'execution-state.json');
    const hasExecutionState = await fileExists(executionStatePath);

    if (hasExecutionState) {
      const executionData = await readJsonFile(executionStatePath);

      state.currentPhase = executionData.currentPhase || null;
      state.phaseStatuses = executionData.phaseStatuses || {};
      state.taskStatuses = executionData.taskStatuses || {};
      state.startedAt = executionData.startedAt || null;
      state.lastUpdated = executionData.lastUpdated || null;

      // Categorize tasks by status
      for (const [taskId, status] of Object.entries(state.taskStatuses)) {
        switch (status) {
          case 'completed':
            state.completedTasks.push(taskId);
            break;
          case 'in_progress':
            state.inProgressTasks.push(taskId);
            break;
          case 'failed':
            state.failedTasks.push(taskId);
            break;
          case 'pending':
          default:
            state.pendingTasks.push(taskId);
            break;
        }
      }

      // Categorize phases by status
      for (const [phaseId, status] of Object.entries(state.phaseStatuses)) {
        switch (status) {
          case 'completed':
            state.completedPhases.push(phaseId);
            break;
          case 'pending':
          default:
            state.pendingPhases.push(phaseId);
            break;
        }
      }

      // Determine if execution has started
      state.hasStarted = state.completedTasks.length > 0 ||
                         state.inProgressTasks.length > 0 ||
                         state.failedTasks.length > 0 ||
                         state.startedAt !== null;

      // Determine if currently executing (has in-progress tasks)
      state.isExecuting = state.inProgressTasks.length > 0;
    }

    // Also read orchestration.json to get full phase list
    const orchestrationPath = path.join(planDir, 'orchestration.json');
    const hasOrchestration = await fileExists(orchestrationPath);

    if (hasOrchestration) {
      const orchestration = await readJsonFile(orchestrationPath);

      // Ensure all phases are tracked
      if (orchestration.phases && Array.isArray(orchestration.phases)) {
        for (const phase of orchestration.phases) {
          if (!state.phaseStatuses[phase.id]) {
            state.phaseStatuses[phase.id] = 'pending';
            state.pendingPhases.push(phase.id);
          }
        }
      }

      // Load all phase files to get complete task list
      await loadAllTasks(planDir, orchestration, state);
    }

    return state;
  } catch (error) {
    // If we can't read state, return default (not executing)
    const err = new Error(`Failed to get execution state: ${error.message}`);
    err.code = 'EXECUTION_STATE_ERROR';
    err.originalError = error;
    throw err;
  }
}

/**
 * Loads all tasks from phase files into the execution state
 * @param {string} planDir - Path to plan directory
 * @param {Object} orchestration - Orchestration data
 * @param {Object} state - Execution state to populate
 */
async function loadAllTasks(planDir, orchestration, state) {
  if (!orchestration.phases || !Array.isArray(orchestration.phases)) {
    return;
  }

  for (const phase of orchestration.phases) {
    const phasePath = path.join(planDir, phase.file);
    const hasPhase = await fileExists(phasePath);

    if (hasPhase) {
      try {
        const phaseData = await readJsonFile(phasePath);

        if (phaseData.tasks && Array.isArray(phaseData.tasks)) {
          for (const task of phaseData.tasks) {
            // Add task to pending if not already tracked
            if (!state.taskStatuses[task.task_id]) {
              state.taskStatuses[task.task_id] = 'pending';
              state.pendingTasks.push(task.task_id);
            }
          }
        }
      } catch (error) {
        // Skip phases that can't be read
        console.warn(`Warning: Could not read phase file ${phase.file}: ${error.message}`);
      }
    }
  }
}

/**
 * Analyzes whether update operations can be safely applied to a plan
 * @param {string} planDir - Path to plan directory
 * @param {Array<Object>} operations - Array of update operations to analyze
 * @returns {Promise<UpdateImpact>} Impact analysis
 */
async function canSafelyUpdate(planDir, operations) {
  const impact = {
    safe: true,
    affectsCompletedWork: false,
    affectsInProgressWork: false,
    blockedOperations: [],
    safeOperations: [],
    warnings: [],
    recommendation: 'proceed'
  };

  try {
    // Get current execution state
    const state = await getExecutionState(planDir);

    // If plan hasn't started, all updates are safe
    if (!state.hasStarted) {
      impact.safeOperations = operations;
      impact.recommendation = 'proceed';
      return impact;
    }

    // Analyze each operation
    for (const operation of operations) {
      const opImpact = analyzeOperationImpact(operation, state);

      if (opImpact.blocked) {
        impact.blockedOperations.push({
          operation,
          reason: opImpact.reason,
          affectedItems: opImpact.affectedItems
        });

        if (opImpact.affectsCompleted) {
          impact.affectsCompletedWork = true;
        }
        if (opImpact.affectsInProgress) {
          impact.affectsInProgressWork = true;
        }
      } else {
        impact.safeOperations.push(operation);
        if (opImpact.warning) {
          impact.warnings.push(opImpact.warning);
        }
      }
    }

    // Determine overall safety and recommendation
    if (impact.blockedOperations.length > 0) {
      impact.safe = false;

      if (impact.affectsInProgressWork) {
        impact.recommendation = 'rollback';
        impact.warnings.push('Some operations affect in-progress tasks. Recommend rollback-replan mode.');
      } else if (impact.affectsCompletedWork) {
        impact.recommendation = 'selective';
        impact.warnings.push('Some operations affect completed work. Use force flag or selective update mode.');
      }
    } else if (impact.warnings.length > 0) {
      impact.recommendation = 'proceed_with_caution';
    }

    return impact;
  } catch (error) {
    impact.safe = false;
    impact.recommendation = 'error';
    impact.warnings.push(`Failed to analyze impact: ${error.message}`);
    return impact;
  }
}

/**
 * Analyzes the impact of a single operation
 * @param {Object} operation - Update operation
 * @param {ExecutionState} state - Current execution state
 * @returns {Object} Operation impact analysis
 */
function analyzeOperationImpact(operation, state) {
  const result = {
    blocked: false,
    reason: null,
    affectedItems: [],
    affectsCompleted: false,
    affectsInProgress: false,
    warning: null
  };

  const { type, target, data } = operation;

  switch (target) {
    case 'phase':
      return analyzePhaseOperationImpact(type, data, state);

    case 'task':
      return analyzeTaskOperationImpact(type, data, state);

    case 'metadata':
      // Metadata updates are generally safe
      result.warning = 'Metadata changes will apply immediately';
      return result;

    default:
      return result;
  }
}

/**
 * Analyzes phase operation impact
 * @param {string} type - Operation type
 * @param {Object} data - Operation data
 * @param {ExecutionState} state - Execution state
 * @returns {Object} Impact analysis
 */
function analyzePhaseOperationImpact(type, data, state) {
  const result = {
    blocked: false,
    reason: null,
    affectedItems: [],
    affectsCompleted: false,
    affectsInProgress: false,
    warning: null
  };

  const phaseId = data.id;
  const phaseStatus = state.phaseStatuses[phaseId];

  switch (type) {
    case 'delete':
      if (phaseStatus === 'completed') {
        result.blocked = true;
        result.reason = `Cannot delete completed phase '${phaseId}' without force flag`;
        result.affectedItems.push(phaseId);
        result.affectsCompleted = true;
      } else if (phaseId === state.currentPhase) {
        result.blocked = true;
        result.reason = `Cannot delete current phase '${phaseId}' while in progress`;
        result.affectedItems.push(phaseId);
        result.affectsInProgress = true;
      }
      break;

    case 'update':
      if (phaseStatus === 'completed' && !data.force) {
        result.blocked = true;
        result.reason = `Cannot modify completed phase '${phaseId}' without force flag`;
        result.affectedItems.push(phaseId);
        result.affectsCompleted = true;
      } else if (phaseId === state.currentPhase) {
        result.warning = `Modifying current phase '${phaseId}' - changes will apply to ongoing execution`;
      }
      break;

    case 'add':
      // Adding phases is generally safe
      result.warning = 'New phase will be added to execution queue';
      break;
  }

  return result;
}

/**
 * Analyzes task operation impact
 * @param {string} type - Operation type
 * @param {Object} data - Operation data
 * @param {ExecutionState} state - Execution state
 * @returns {Object} Impact analysis
 */
function analyzeTaskOperationImpact(type, data, state) {
  const result = {
    blocked: false,
    reason: null,
    affectedItems: [],
    affectsCompleted: false,
    affectsInProgress: false,
    warning: null
  };

  const taskId = data.id;
  const taskStatus = state.taskStatuses[taskId];

  switch (type) {
    case 'delete':
      if (taskStatus === 'completed') {
        result.blocked = true;
        result.reason = `Cannot delete completed task '${taskId}' without force flag`;
        result.affectedItems.push(taskId);
        result.affectsCompleted = true;
      } else if (taskStatus === 'in_progress') {
        result.blocked = true;
        result.reason = `Cannot delete task '${taskId}' while in progress`;
        result.affectedItems.push(taskId);
        result.affectsInProgress = true;
      }
      break;

    case 'update':
      if (taskStatus === 'completed' && !data.force) {
        result.blocked = true;
        result.reason = `Cannot modify completed task '${taskId}' without force flag`;
        result.affectedItems.push(taskId);
        result.affectsCompleted = true;
      } else if (taskStatus === 'in_progress') {
        result.warning = `Modifying in-progress task '${taskId}' - changes may affect ongoing work`;
        result.affectsInProgress = true;
      }
      break;

    case 'add':
      // Adding tasks is generally safe
      result.warning = 'New task will be added to execution queue';
      break;
  }

  return result;
}

/**
 * Checks if a plan is currently in an executing state
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<boolean>} True if plan is executing
 */
async function isExecuting(planDir) {
  try {
    const state = await getExecutionState(planDir);
    return state.isExecuting;
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a plan has been started (any work completed)
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<boolean>} True if plan has started
 */
async function hasStarted(planDir) {
  try {
    const state = await getExecutionState(planDir);
    return state.hasStarted;
  } catch (error) {
    return false;
  }
}

/**
 * Gets a summary of execution progress
 * @param {string} planDir - Path to plan directory
 * @returns {Promise<Object>} Progress summary
 */
async function getProgressSummary(planDir) {
  const state = await getExecutionState(planDir);

  const totalTasks = state.completedTasks.length +
                     state.inProgressTasks.length +
                     state.pendingTasks.length +
                     state.failedTasks.length;

  const totalPhases = state.completedPhases.length + state.pendingPhases.length;

  return {
    totalTasks,
    completedTasks: state.completedTasks.length,
    inProgressTasks: state.inProgressTasks.length,
    pendingTasks: state.pendingTasks.length,
    failedTasks: state.failedTasks.length,
    taskPercentage: totalTasks > 0 ? Math.round((state.completedTasks.length / totalTasks) * 100) : 0,
    totalPhases,
    completedPhases: state.completedPhases.length,
    phasePercentage: totalPhases > 0 ? Math.round((state.completedPhases.length / totalPhases) * 100) : 0,
    currentPhase: state.currentPhase,
    isExecuting: state.isExecuting,
    hasStarted: state.hasStarted
  };
}

module.exports = {
  getExecutionState,
  canSafelyUpdate,
  isExecuting,
  hasStarted,
  getProgressSummary,
  analyzeOperationImpact,
  analyzePhaseOperationImpact,
  analyzeTaskOperationImpact
};
