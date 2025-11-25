/**
 * Progress Service - Single Source of Truth for Plan Progress
 *
 * This module provides unified read/write access for task and phase status.
 * The SOURCE OF TRUTH is execution-state.json (taskStatuses, phaseStatuses).
 *
 * All status queries and updates should go through this module.
 * orchestration.json and phase files are synced for backward compatibility.
 */

const path = require('path');
const fs = require('fs').promises;

// Get working directory from environment or use current
const workingDir = process.env.CLAUDE_WORKING_DIR || process.cwd();

/**
 * Get global plans directory path
 * @returns {string} - Path to global plans directory
 */
function getPlansDirectory() {
  return path.join(workingDir, '.claude/plans');
}

/**
 * Get plan directory path
 * @param {string} planName - Plan name
 * @returns {string} - Path to plan directory
 */
function getPlanDir(planName) {
  return path.join(getPlansDirectory(), planName);
}

/**
 * Read JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object|null>} - Parsed JSON or null
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Write JSON file atomically
 * @param {string} filePath - Path to JSON file
 * @param {Object} data - Data to write
 */
async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// EXECUTION STATE (Source of Truth)
// ============================================================================

/**
 * Get execution state for a plan
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} - Execution state
 */
async function getExecutionState(planName) {
  const planDir = getPlanDir(planName);
  const statePath = path.join(planDir, 'execution-state.json');

  let state = await readJsonFile(statePath);

  if (!state) {
    // Return default state if file doesn't exist
    state = {
      currentPhase: null,
      phaseStatuses: {},
      taskStatuses: {},
      startedAt: null,
      lastUpdated: null,
      errors: []
    };
  }

  // Ensure required fields exist (handle old schema migration)
  if (!state.phaseStatuses) state.phaseStatuses = state.phaseStates || {};
  if (!state.taskStatuses) state.taskStatuses = {};

  return state;
}

/**
 * Save execution state for a plan
 * @param {string} planName - Plan name
 * @param {Object} state - Execution state to save
 */
async function saveExecutionState(planName, state) {
  const planDir = getPlanDir(planName);
  const statePath = path.join(planDir, 'execution-state.json');

  state.lastUpdated = new Date().toISOString();
  await writeJsonFile(statePath, state);
}

// ============================================================================
// TASK STATUS OPERATIONS
// ============================================================================

/**
 * Get status of a specific task
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @returns {Promise<string>} - Task status
 */
async function getTaskStatus(planName, taskId) {
  const state = await getExecutionState(planName);
  return state.taskStatuses[taskId] || 'pending';
}

/**
 * Set status of a specific task (MAIN WRITE FUNCTION)
 * This is the ONLY function that should update task status.
 * It updates execution-state.json and syncs to phase files + orchestration.json
 *
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending|in_progress|completed|failed|blocked)
 * @param {Object} options - Options { result: string, syncFiles: boolean }
 * @returns {Promise<Object>} - Update result
 */
async function setTaskStatus(planName, taskId, status, options = {}) {
  const { result = null, syncFiles = true } = options;
  const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'blocked'];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const planDir = getPlanDir(planName);

  // 1. Get current execution state
  const state = await getExecutionState(planName);
  const oldStatus = state.taskStatuses[taskId] || 'pending';

  // 2. Update task status in execution state
  state.taskStatuses[taskId] = status;

  // 3. Find which phase contains this task and update phase status
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  const orchestration = await readJsonFile(orchestrationPath);

  if (!orchestration) {
    throw new Error(`Plan '${planName}' not found`);
  }

  let targetPhaseId = null;
  let phaseData = null;
  let phaseFilePath = null;

  // Find the task in phase files
  for (const phaseMeta of orchestration.phases) {
    phaseFilePath = path.join(planDir, phaseMeta.file);
    phaseData = await readJsonFile(phaseFilePath);

    if (phaseData && phaseData.tasks) {
      const task = phaseData.tasks.find(t => t.task_id === taskId);
      if (task) {
        targetPhaseId = phaseMeta.id;

        // Update task in phase file if syncFiles enabled
        if (syncFiles) {
          task.status = status;
          if (result) {
            task.result = result;
          }
          await writeJsonFile(phaseFilePath, phaseData);
        }
        break;
      }
    }
  }

  if (!targetPhaseId) {
    throw new Error(`Task '${taskId}' not found in any phase`);
  }

  // 4. Derive and update phase status
  const newPhaseStatus = derivePhaseStatus(phaseData.tasks, state.taskStatuses);
  state.phaseStatuses[targetPhaseId] = newPhaseStatus;

  // 5. Update current phase if needed
  if (status === 'in_progress' && !state.currentPhase) {
    state.currentPhase = targetPhaseId;
  }

  // 6. Set startedAt if this is first non-pending status
  if (!state.startedAt && status !== 'pending') {
    state.startedAt = new Date().toISOString();
  }

  // 7. Save execution state (SOURCE OF TRUTH)
  await saveExecutionState(planName, state);

  // 8. Sync to orchestration.json for backward compatibility
  if (syncFiles) {
    await syncOrchestrationProgress(planName, orchestration, state);
  }

  return {
    success: true,
    taskId,
    oldStatus,
    newStatus: status,
    phaseId: targetPhaseId,
    phaseStatus: newPhaseStatus
  };
}

/**
 * Get all task statuses for a plan
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} - Map of taskId -> status
 */
async function getAllTaskStatuses(planName) {
  const state = await getExecutionState(planName);
  return state.taskStatuses;
}

// ============================================================================
// PHASE STATUS OPERATIONS
// ============================================================================

/**
 * Get status of a specific phase
 * @param {string} planName - Plan name
 * @param {string} phaseId - Phase ID
 * @returns {Promise<string>} - Phase status
 */
async function getPhaseStatus(planName, phaseId) {
  const state = await getExecutionState(planName);
  return state.phaseStatuses[phaseId] || 'pending';
}

/**
 * Set status of a specific phase
 * @param {string} planName - Plan name
 * @param {string} phaseId - Phase ID
 * @param {string} status - New status
 */
async function setPhaseStatus(planName, phaseId, status) {
  const state = await getExecutionState(planName);
  state.phaseStatuses[phaseId] = status;
  await saveExecutionState(planName, state);
}

/**
 * Get all phase statuses for a plan
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} - Map of phaseId -> status
 */
async function getAllPhaseStatuses(planName) {
  const state = await getExecutionState(planName);
  return state.phaseStatuses;
}

// ============================================================================
// PROGRESS CALCULATION (Derived from execution state)
// ============================================================================

/**
 * Derive phase status from task statuses
 * @param {Array} tasks - Tasks in the phase
 * @param {Object} taskStatuses - Map of taskId -> status from execution state
 * @returns {string} - Derived phase status
 */
function derivePhaseStatus(tasks, taskStatuses = {}) {
  if (!tasks || tasks.length === 0) {
    return 'pending';
  }

  let completed = 0;
  let inProgress = 0;
  let failed = 0;
  let blocked = 0;

  for (const task of tasks) {
    // Use execution state status if available, otherwise fall back to task.status
    const status = taskStatuses[task.task_id] || task.status || 'pending';

    switch (status) {
      case 'completed':
        completed++;
        break;
      case 'in_progress':
        inProgress++;
        break;
      case 'failed':
        failed++;
        break;
      case 'blocked':
        blocked++;
        break;
    }
  }

  // Derive phase status
  if (completed === tasks.length) {
    return 'completed';
  } else if (failed > 0) {
    return 'failed';
  } else if (inProgress > 0) {
    return 'in_progress';
  } else if (blocked > 0 && blocked === tasks.length - completed) {
    return 'blocked';
  } else if (completed > 0) {
    return 'in_progress';
  }

  return 'pending';
}

/**
 * Derive overall plan status from phase statuses
 * @param {Object} phaseStatuses - Map of phaseId -> status
 * @returns {string} - Derived plan status
 */
function derivePlanStatus(phaseStatuses) {
  const statuses = Object.values(phaseStatuses);

  if (statuses.length === 0) {
    return 'pending';
  }

  const completed = statuses.filter(s => s === 'completed').length;
  const failed = statuses.filter(s => s === 'failed').length;
  const inProgress = statuses.filter(s => s === 'in_progress').length;

  if (completed === statuses.length) {
    return 'completed';
  } else if (failed > 0) {
    return 'failed';
  } else if (inProgress > 0 || completed > 0) {
    return 'in_progress';
  }

  return 'pending';
}

/**
 * Get complete progress for a plan (THE MAIN PROGRESS QUERY FUNCTION)
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} - Complete progress information
 */
async function getProgress(planName) {
  const planDir = getPlanDir(planName);
  const state = await getExecutionState(planName);

  // Load orchestration for phase/task structure
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  const orchestration = await readJsonFile(orchestrationPath);

  if (!orchestration) {
    throw new Error(`Plan '${planName}' not found`);
  }

  // Initialize counters
  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let pendingTasks = 0;
  let failedTasks = 0;
  let blockedTasks = 0;

  let totalPhases = orchestration.phases.length;
  let completedPhases = 0;
  let inProgressPhases = 0;

  const phases = [];
  let currentPhase = null;
  let currentTask = null;

  // Process each phase
  for (const phaseMeta of orchestration.phases) {
    const phaseFilePath = path.join(planDir, phaseMeta.file);
    const phaseData = await readJsonFile(phaseFilePath);

    if (!phaseData) continue;

    // Get phase status from execution state
    const phaseStatus = state.phaseStatuses[phaseMeta.id] ||
                        derivePhaseStatus(phaseData.tasks, state.taskStatuses);

    // Count phase status
    if (phaseStatus === 'completed') {
      completedPhases++;
    } else if (phaseStatus === 'in_progress') {
      inProgressPhases++;
      if (!currentPhase) {
        currentPhase = {
          id: phaseMeta.id,
          name: phaseData.phase_name || phaseMeta.name,
          status: phaseStatus
        };
      }
    }

    // Process tasks
    const phaseTasks = [];
    for (const task of (phaseData.tasks || [])) {
      totalTasks++;

      // Get task status from execution state (SOURCE OF TRUTH)
      const taskStatus = state.taskStatuses[task.task_id] || 'pending';

      switch (taskStatus) {
        case 'completed':
          completedTasks++;
          break;
        case 'in_progress':
          inProgressTasks++;
          if (!currentTask) {
            currentTask = {
              task_id: task.task_id,
              description: task.description,
              status: taskStatus,
              phase_id: phaseMeta.id
            };
          }
          break;
        case 'failed':
          failedTasks++;
          break;
        case 'blocked':
          blockedTasks++;
          break;
        default:
          pendingTasks++;
          // Track first pending task if no current task
          if (!currentTask && !currentPhase) {
            currentTask = {
              task_id: task.task_id,
              description: task.description,
              status: taskStatus,
              phase_id: phaseMeta.id
            };
          }
          break;
      }

      phaseTasks.push({
        task_id: task.task_id,
        description: task.description,
        status: taskStatus,
        details: task.details,
        result: task.result
      });
    }

    phases.push({
      id: phaseMeta.id,
      name: phaseData.phase_name || phaseMeta.name,
      status: phaseStatus,
      tasks: phaseTasks,
      taskCount: phaseTasks.length,
      completedCount: phaseTasks.filter(t => t.status === 'completed').length
    });
  }

  // Calculate percentages
  const percentComplete = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  const phasePercentComplete = totalPhases > 0
    ? Math.round((completedPhases / totalPhases) * 100)
    : 0;

  return {
    planName,
    goal: orchestration.metadata?.name || '',
    workType: orchestration.metadata?.workType || 'feature',
    status: derivePlanStatus(state.phaseStatuses),

    // Task progress
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    failedTasks,
    blockedTasks,
    percentComplete,

    // Phase progress
    totalPhases,
    completedPhases,
    inProgressPhases,
    phasePercentComplete,

    // Current work
    currentPhase,
    currentTask,

    // Detailed phase info
    phases,

    // Timestamps
    startedAt: state.startedAt,
    lastUpdated: state.lastUpdated
  };
}

// ============================================================================
// SYNC FUNCTIONS (Keep orchestration.json in sync for backward compatibility)
// ============================================================================

/**
 * Sync orchestration.json progress from execution state
 * @param {string} planName - Plan name
 * @param {Object} orchestration - Orchestration data (optional, will load if not provided)
 * @param {Object} state - Execution state (optional, will load if not provided)
 */
async function syncOrchestrationProgress(planName, orchestration = null, state = null) {
  const planDir = getPlanDir(planName);
  const orchestrationPath = path.join(planDir, 'orchestration.json');

  if (!orchestration) {
    orchestration = await readJsonFile(orchestrationPath);
  }
  if (!state) {
    state = await getExecutionState(planName);
  }

  if (!orchestration) return;

  // Update phase statuses in orchestration
  for (const phaseMeta of orchestration.phases) {
    const phaseStatus = state.phaseStatuses[phaseMeta.id];
    if (phaseStatus) {
      phaseMeta.status = phaseStatus;
    }
  }

  // Recalculate progress
  const taskStatuses = state.taskStatuses;
  let totalTasks = 0;
  let completedTasks = 0;

  for (const phaseMeta of orchestration.phases) {
    const phaseFilePath = path.join(planDir, phaseMeta.file);
    const phaseData = await readJsonFile(phaseFilePath);

    if (phaseData && phaseData.tasks) {
      for (const task of phaseData.tasks) {
        totalTasks++;
        if (taskStatuses[task.task_id] === 'completed') {
          completedTasks++;
        }
      }
    }
  }

  // Update orchestration progress
  if (!orchestration.progress) {
    orchestration.progress = {};
  }

  orchestration.progress.totalTasks = totalTasks;
  orchestration.progress.completedTasks = completedTasks;
  orchestration.progress.completedPhases = orchestration.phases.filter(p => p.status === 'completed').length;
  orchestration.progress.totalPhases = orchestration.phases.length;
  orchestration.progress.lastUpdated = new Date().toISOString();

  // Update metadata
  if (orchestration.metadata) {
    orchestration.metadata.modified = new Date().toISOString();
    orchestration.metadata.status = derivePlanStatus(state.phaseStatuses);
  }

  // Save updated orchestration
  await writeJsonFile(orchestrationPath, orchestration);
}

/**
 * Reset all statuses to pending
 * @param {string} planName - Plan name
 * @param {Object} options - Options { preserveHistory: boolean }
 */
async function resetAllStatuses(planName, options = {}) {
  const { preserveHistory = true } = options;
  const planDir = getPlanDir(planName);

  const state = await getExecutionState(planName);

  // Optionally preserve history
  if (preserveHistory && state.startedAt) {
    if (!state.executionHistory) {
      state.executionHistory = [];
    }
    state.executionHistory.push({
      startedAt: state.startedAt,
      endedAt: new Date().toISOString(),
      phaseStatuses: { ...state.phaseStatuses },
      taskStatuses: { ...state.taskStatuses }
    });
  }

  // Reset all statuses to pending
  for (const key of Object.keys(state.taskStatuses)) {
    state.taskStatuses[key] = 'pending';
  }
  for (const key of Object.keys(state.phaseStatuses)) {
    state.phaseStatuses[key] = 'pending';
  }

  state.currentPhase = null;
  state.startedAt = null;
  state.errors = [];

  await saveExecutionState(planName, state);

  // Sync to files
  await syncOrchestrationProgress(planName, null, state);

  // Reset phase file task statuses
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  const orchestration = await readJsonFile(orchestrationPath);

  if (orchestration && orchestration.phases) {
    for (const phaseMeta of orchestration.phases) {
      const phaseFilePath = path.join(planDir, phaseMeta.file);
      const phaseData = await readJsonFile(phaseFilePath);

      if (phaseData && phaseData.tasks) {
        for (const task of phaseData.tasks) {
          task.status = 'pending';
          task.result = null;
        }
        phaseData.status = 'pending';
        await writeJsonFile(phaseFilePath, phaseData);
      }
    }
  }

  return { success: true, message: 'All statuses reset to pending' };
}

/**
 * Initialize execution state for a new plan
 * @param {string} planName - Plan name
 * @param {Object} orchestration - Orchestration data
 */
async function initializeExecutionState(planName, orchestration) {
  const state = {
    currentPhase: null,
    phaseStatuses: {},
    taskStatuses: {},
    startedAt: null,
    lastUpdated: new Date().toISOString(),
    errors: []
  };

  // Initialize phase statuses
  if (orchestration.phases) {
    for (const phase of orchestration.phases) {
      state.phaseStatuses[phase.id] = 'pending';
    }
  }

  await saveExecutionState(planName, state);
  return state;
}

module.exports = {
  // Execution state
  getExecutionState,
  saveExecutionState,
  initializeExecutionState,

  // Task status
  getTaskStatus,
  setTaskStatus,
  getAllTaskStatuses,

  // Phase status
  getPhaseStatus,
  setPhaseStatus,
  getAllPhaseStatuses,

  // Progress calculation
  getProgress,
  derivePhaseStatus,
  derivePlanStatus,

  // Sync
  syncOrchestrationProgress,
  resetAllStatuses,

  // Helpers
  getPlanDir,
  getPlansDirectory
};
