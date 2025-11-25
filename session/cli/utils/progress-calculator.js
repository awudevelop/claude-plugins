/**
 * @typedef {Object} PhaseProgress
 * @property {number} totalTasks - Total number of tasks in phase
 * @property {number} completedTasks - Number of completed tasks
 * @property {number} inProgressTasks - Number of in-progress tasks
 * @property {number} pendingTasks - Number of pending tasks
 * @property {number} failedTasks - Number of failed tasks
 * @property {number} percentage - Completion percentage (0-100)
 * @property {string} status - Overall phase status
 */

/**
 * @typedef {Object} PlanProgress
 * @property {number} totalPhases - Total number of phases
 * @property {number} completedPhases - Number of completed phases
 * @property {number} totalTasks - Total number of tasks across all phases
 * @property {number} completedTasks - Number of completed tasks
 * @property {number} percentage - Overall completion percentage (0-100)
 * @property {Array<string>} currentPhases - Currently in-progress phases
 */

/**
 * Recalculates progress for a single phase
 * @param {Object} phase - Phase object with tasks
 * @param {Object} executionState - Execution state with task statuses
 * @returns {PhaseProgress} Phase progress information
 */
function recalculatePhaseProgress(phase, executionState) {
  const progress = {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    failedTasks: 0,
    percentage: 0,
    status: 'pending'
  };

  // Handle empty phase
  if (!phase || !phase.tasks || !Array.isArray(phase.tasks) || phase.tasks.length === 0) {
    progress.status = 'completed'; // Empty phases are considered complete
    progress.percentage = 100;
    return progress;
  }

  progress.totalTasks = phase.tasks.length;

  // Count tasks by status
  phase.tasks.forEach(task => {
    const taskStatus = executionState.taskStatuses?.[task.task_id] || 'pending';

    switch (taskStatus) {
      case 'completed':
        progress.completedTasks++;
        break;
      case 'in_progress':
        progress.inProgressTasks++;
        break;
      case 'failed':
        progress.failedTasks++;
        break;
      case 'pending':
      default:
        progress.pendingTasks++;
        break;
    }
  });

  // Calculate percentage
  if (progress.totalTasks > 0) {
    progress.percentage = Math.round((progress.completedTasks / progress.totalTasks) * 100);
  }

  // Determine overall phase status
  if (progress.completedTasks === progress.totalTasks) {
    progress.status = 'completed';
  } else if (progress.inProgressTasks > 0) {
    progress.status = 'in_progress';
  } else if (progress.failedTasks > 0 && progress.inProgressTasks === 0 && progress.pendingTasks === 0) {
    progress.status = 'failed';
  } else {
    progress.status = 'pending';
  }

  return progress;
}

/**
 * Recalculates progress for the entire plan
 * @param {Object} orchestration - Orchestration object
 * @param {Array<Object>} phases - Array of loaded phase objects
 * @param {Object} executionState - Execution state
 * @returns {PlanProgress} Plan progress information
 */
function recalculatePlanProgress(orchestration, phases, executionState) {
  const progress = {
    totalPhases: 0,
    completedPhases: 0,
    totalTasks: 0,
    completedTasks: 0,
    percentage: 0,
    currentPhases: []
  };

  if (!orchestration || !orchestration.phases || !Array.isArray(orchestration.phases)) {
    return progress;
  }

  progress.totalPhases = orchestration.phases.length;

  // Create a map of phase files by phase_id
  const phaseMap = new Map();
  if (phases && Array.isArray(phases)) {
    phases.forEach(phase => {
      if (phase.phase_id) {
        phaseMap.set(phase.phase_id, phase);
      }
    });
  }

  // Calculate progress for each phase
  orchestration.phases.forEach(orchPhase => {
    const phaseFile = phaseMap.get(orchPhase.id);

    if (!phaseFile) {
      // Phase file not found - count as pending
      return;
    }

    const phaseProgress = recalculatePhaseProgress(phaseFile, executionState);

    // Update totals
    progress.totalTasks += phaseProgress.totalTasks;
    progress.completedTasks += phaseProgress.completedTasks;

    // Count completed phases
    if (phaseProgress.status === 'completed') {
      progress.completedPhases++;
    }

    // Track currently in-progress phases
    if (phaseProgress.status === 'in_progress') {
      progress.currentPhases.push(orchPhase.id);
    }
  });

  // Calculate overall percentage
  if (progress.totalTasks > 0) {
    progress.percentage = Math.round((progress.completedTasks / progress.totalTasks) * 100);
  } else if (progress.completedPhases === progress.totalPhases) {
    // All phases complete (even if no tasks)
    progress.percentage = 100;
  }

  return progress;
}

/**
 * Updates orchestration file with recalculated progress
 * @param {Object} orchestration - Orchestration object to update
 * @param {Array<Object>} phases - Array of loaded phase objects
 * @param {Object} executionState - Execution state
 * @returns {Object} Updated orchestration object
 */
function updateOrchestrationProgress(orchestration, phases, executionState) {
  const planProgress = recalculatePlanProgress(orchestration, phases, executionState);

  // Update orchestration.progress
  if (!orchestration.progress) {
    orchestration.progress = {};
  }

  orchestration.progress.completedPhases = planProgress.completedPhases;
  orchestration.progress.totalPhases = planProgress.totalPhases;
  orchestration.progress.completedTasks = planProgress.completedTasks;
  orchestration.progress.totalTasks = planProgress.totalTasks;
  orchestration.progress.currentPhases = planProgress.currentPhases;
  orchestration.progress.lastUpdated = new Date().toISOString();

  // Calculate percentage if not already set
  if (orchestration.progress.totalTasks > 0) {
    orchestration.progress.percentage = Math.round(
      (orchestration.progress.completedTasks / orchestration.progress.totalTasks) * 100
    );
  }

  return orchestration;
}

/**
 * Updates phase status in orchestration based on phase progress
 * @param {Object} orchestration - Orchestration object
 * @param {string} phaseId - Phase ID
 * @param {Object} phase - Phase object
 * @param {Object} executionState - Execution state
 * @returns {Object} Updated orchestration object
 */
function updatePhaseStatusInOrchestration(orchestration, phaseId, phase, executionState) {
  const phaseProgress = recalculatePhaseProgress(phase, executionState);

  // Find and update the phase in orchestration
  const orchPhase = orchestration.phases.find(p => p.id === phaseId);
  if (orchPhase) {
    orchPhase.status = phaseProgress.status;
  }

  // Update execution state
  if (executionState.phaseStatuses) {
    executionState.phaseStatuses[phaseId] = phaseProgress.status;
  }

  return orchestration;
}

/**
 * Gets a summary of task statuses for a phase
 * @param {Object} phase - Phase object
 * @param {Object} executionState - Execution state
 * @returns {Object} Task status summary
 */
function getTaskStatusSummary(phase, executionState) {
  const summary = {
    completed: [],
    in_progress: [],
    pending: [],
    failed: []
  };

  if (!phase || !phase.tasks || !Array.isArray(phase.tasks)) {
    return summary;
  }

  phase.tasks.forEach(task => {
    const taskStatus = executionState.taskStatuses?.[task.task_id] || 'pending';
    const taskInfo = {
      id: task.task_id,
      description: task.description
    };

    if (summary[taskStatus]) {
      summary[taskStatus].push(taskInfo);
    } else {
      summary.pending.push(taskInfo);
    }
  });

  return summary;
}

/**
 * Calculates estimated time remaining based on task progress
 * @param {Object} orchestration - Orchestration object
 * @param {Array<Object>} phases - Array of loaded phase objects
 * @param {Object} executionState - Execution state
 * @returns {Object} Time estimates
 */
function calculateTimeEstimates(orchestration, phases, executionState) {
  const planProgress = recalculatePlanProgress(orchestration, phases, executionState);

  const estimates = {
    totalEstimatedTokens: 0,
    completedTokens: 0,
    remainingTokens: 0,
    completionPercentage: planProgress.percentage
  };

  // Calculate token estimates from phases
  if (orchestration && orchestration.phases) {
    orchestration.phases.forEach(phase => {
      const phaseStatus = executionState.phaseStatuses?.[phase.id] || 'pending';
      const estimatedTokens = phase.estimatedTokens || 0;

      estimates.totalEstimatedTokens += estimatedTokens;

      if (phaseStatus === 'completed') {
        estimates.completedTokens += estimatedTokens;
      }
    });
  }

  estimates.remainingTokens = estimates.totalEstimatedTokens - estimates.completedTokens;

  return estimates;
}

module.exports = {
  recalculatePhaseProgress,
  recalculatePlanProgress,
  updateOrchestrationProgress,
  updatePhaseStatusInOrchestration,
  getTaskStatusSummary,
  calculateTimeEstimates
};
