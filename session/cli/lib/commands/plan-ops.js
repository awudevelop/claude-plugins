const fs = require('fs').promises;
const path = require('path');

// Get working directory from environment or use current
const workingDir = process.env.CLAUDE_WORKING_DIR || process.cwd();

/**
 * Centralized error handler for CLI operations
 */
function handleCliError(error, context = {}) {
  const errorMap = {
    INVALID_SESSION: {
      message: `Session '${context.session}' not found`,
      suggestion: 'Use /session list to see available sessions'
    },
    INVALID_PLAN_NAME: {
      message: 'Invalid plan name format',
      suggestion: 'Use lowercase letters, numbers, and hyphens only (1-50 chars)'
    },
    PLAN_EXISTS: {
      message: `Plan '${context.plan}' already exists`,
      suggestion: 'Use a different name or delete the existing plan first'
    },
    PLAN_NOT_FOUND: {
      message: `Plan '${context.plan}' not found`,
      suggestion: 'Use list-plans command to see available plans'
    },
    VALIDATION_ERROR: {
      message: 'Plan validation failed',
      suggestion: 'Check the error details and fix the issues'
    },
    TASK_NOT_FOUND: {
      message: `Task '${context.taskId}' not found`,
      suggestion: 'Check task ID format (should be task-xxx)'
    },
    INVALID_STATUS: {
      message: `Invalid status '${context.status}'`,
      suggestion: 'Use: pending, in_progress, completed, or blocked'
    },
    FILE_WRITE_ERROR: {
      message: 'Failed to write plan file',
      suggestion: 'Check file permissions and disk space'
    },
    FILE_READ_ERROR: {
      message: 'Failed to read plan file',
      suggestion: 'Plan file may be corrupted or missing'
    },
    PARSE_ERROR: {
      message: 'Failed to parse plan file',
      suggestion: 'Plan file contains invalid JSON'
    }
  };

  const errorInfo = errorMap[error.code] || {
    message: error.message || 'Unknown error occurred',
    suggestion: 'Check the error details'
  };

  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: errorInfo.message,
      suggestion: errorInfo.suggestion,
      details: error.details || context
    }
  };
}

/**
 * Validates plan name format
 */
function validatePlanName(planName) {
  const pattern = /^[a-z0-9-]+$/;
  const reserved = ['index', 'schema', 'template'];

  if (!planName || planName.length < 1 || planName.length > 50) {
    return { valid: false, error: 'Plan name must be 1-50 characters' };
  }

  if (!pattern.test(planName)) {
    return { valid: false, error: 'Plan name must use only lowercase letters, numbers, and hyphens' };
  }

  if (reserved.includes(planName)) {
    return { valid: false, error: `'${planName}' is a reserved name` };
  }

  return { valid: true };
}

/**
 * Validates plan data against schema (manual validation without external deps)
 */
async function validatePlanData(planData) {
  const errors = [];

  // Required fields
  const requiredFields = ['plan_name', 'work_type', 'goal', 'phases', 'created_at', 'version'];
  for (const field of requiredFields) {
    if (!planData[field]) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }

  // Validate plan_name format
  if (planData.plan_name && !/^[a-z0-9-]+$/.test(planData.plan_name)) {
    errors.push({ field: 'plan_name', message: 'Must contain only lowercase letters, numbers, and hyphens' });
  }

  // Validate work_type
  const validTypes = ['feature', 'bug', 'spike', 'refactor', 'other'];
  if (planData.work_type && !validTypes.includes(planData.work_type)) {
    errors.push({ field: 'work_type', message: `Must be one of: ${validTypes.join(', ')}` });
  }

  // Validate goal length
  if (planData.goal && (planData.goal.length < 10 || planData.goal.length > 500)) {
    errors.push({ field: 'goal', message: 'Must be 10-500 characters' });
  }

  // Validate phases
  if (planData.phases) {
    if (!Array.isArray(planData.phases)) {
      errors.push({ field: 'phases', message: 'Must be an array' });
    } else if (planData.phases.length < 1) {
      errors.push({ field: 'phases', message: 'Must have at least 1 phase' });
    } else {
      // Validate each phase
      planData.phases.forEach((phase, idx) => {
        if (!phase.phase_name) {
          errors.push({ field: `phases[${idx}].phase_name`, message: 'Phase name required' });
        }
        if (!Array.isArray(phase.tasks)) {
          errors.push({ field: `phases[${idx}].tasks`, message: 'Tasks must be an array' });
        } else if (phase.tasks.length < 1) {
          errors.push({ field: `phases[${idx}].tasks`, message: 'Phase must have at least 1 task' });
        } else {
          // Validate each task
          phase.tasks.forEach((task, taskIdx) => {
            if (!task.task_id) {
              errors.push({ field: `phases[${idx}].tasks[${taskIdx}].task_id`, message: 'Task ID required' });
            } else if (!/^task-[a-z0-9-]+$/.test(task.task_id)) {
              errors.push({ field: `phases[${idx}].tasks[${taskIdx}].task_id`, message: 'Must match pattern: task-xxx' });
            }
            if (!task.description) {
              errors.push({ field: `phases[${idx}].tasks[${taskIdx}].description`, message: 'Description required' });
            }
            if (!task.status) {
              errors.push({ field: `phases[${idx}].tasks[${taskIdx}].status`, message: 'Status required' });
            } else if (!['pending', 'in_progress', 'completed', 'blocked'].includes(task.status)) {
              errors.push({ field: `phases[${idx}].tasks[${taskIdx}].status`, message: 'Invalid status' });
            }
          });
        }
      });
    }
  }

  // Validate version format
  if (planData.version && !/^\d+\.\d+\.\d+$/.test(planData.version)) {
    errors.push({ field: 'version', message: 'Must be in format: X.Y.Z' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates progress from phases
 */
function calculateProgress(phases) {
  let totalTasks = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let blocked = 0;

  for (const phase of phases) {
    for (const task of phase.tasks) {
      totalTasks++;
      switch (task.status) {
        case 'completed':
          completed++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'pending':
          pending++;
          break;
        case 'blocked':
          blocked++;
          break;
      }
    }
  }

  return {
    total_tasks: totalTasks,
    completed,
    in_progress: inProgress,
    pending,
    blocked
  };
}

/**
 * Creates a new plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {Object} planData - Plan data
 * @returns {Promise<CreateResult>}
 */
async function createPlan(sessionName, planName, planData) {
  try {
    // Validate session exists
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    try {
      await fs.access(sessionPath);
    } catch {
      throw { code: 'INVALID_SESSION' };
    }

    // Validate plan name
    const nameValidation = validatePlanName(planName);
    if (!nameValidation.valid) {
      throw { code: 'INVALID_PLAN_NAME', message: nameValidation.error };
    }

    // Ensure plans directory exists
    const plansDir = path.join(sessionPath, 'plans');
    await fs.mkdir(plansDir, { recursive: true });

    // Check if plan already exists
    const planPath = path.join(plansDir, `plan_${planName}.json`);
    try {
      await fs.access(planPath);
      throw { code: 'PLAN_EXISTS' };
    } catch (error) {
      if (error.code === 'PLAN_EXISTS') throw error;
      // File doesn't exist, which is what we want
    }

    // Validate plan data
    const dataValidation = await validatePlanData(planData);
    if (!dataValidation.valid) {
      throw {
        code: 'VALIDATION_ERROR',
        details: dataValidation.errors
      };
    }

    // Ensure progress is calculated
    if (!planData.progress) {
      planData.progress = calculateProgress(planData.phases);
    }

    // Ensure timestamps
    if (!planData.created_at) {
      planData.created_at = new Date().toISOString();
    }
    planData.updated_at = new Date().toISOString();

    // Create plan file
    try {
      await fs.writeFile(planPath, JSON.stringify(planData, null, 2));
    } catch (error) {
      throw { code: 'FILE_WRITE_ERROR', original: error };
    }

    return {
      success: true,
      data: {
        plan_name: planName,
        path: planPath
      },
      message: `Plan '${planName}' created successfully`
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName });
  }
}

/**
 * Retrieves a plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
async function getPlan(sessionName, planName) {
  try {
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    const planPath = path.join(sessionPath, 'plans', `plan_${planName}.json`);

    try {
      const content = await fs.readFile(planPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      if (error instanceof SyntaxError) {
        throw { code: 'PARSE_ERROR' };
      }
      throw { code: 'FILE_READ_ERROR', original: error };
    }
  } catch (error) {
    const result = handleCliError(error, { session: sessionName, plan: planName });
    return null;
  }
}

/**
 * Updates an existing plan
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {Object} updates - Partial or complete plan data to update
 * @returns {Promise<UpdateResult>}
 */
async function updatePlan(sessionName, planName, updates) {
  try {
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    const planPath = path.join(sessionPath, 'plans', `plan_${planName}.json`);

    // Get existing plan
    const existingPlan = await getPlan(sessionName, planName);
    if (!existingPlan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Merge updates
    const updatedPlan = { ...existingPlan, ...updates };
    updatedPlan.updated_at = new Date().toISOString();

    // Recalculate progress if phases changed
    if (updates.phases) {
      updatedPlan.progress = calculateProgress(updatedPlan.phases);
    }

    // Validate updated plan
    const validation = await validatePlanData(updatedPlan);
    if (!validation.valid) {
      throw {
        code: 'VALIDATION_ERROR',
        details: validation.errors
      };
    }

    // Write updated plan
    try {
      await fs.writeFile(planPath, JSON.stringify(updatedPlan, null, 2));
    } catch (error) {
      throw { code: 'FILE_WRITE_ERROR', original: error };
    }

    return {
      success: true,
      data: updatedPlan,
      message: `Plan '${planName}' updated successfully`
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName });
  }
}

/**
 * Deletes a plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<DeleteResult>}
 */
async function deletePlan(sessionName, planName) {
  try {
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    const planPath = path.join(sessionPath, 'plans', `plan_${planName}.json`);

    // Check if plan exists
    const plan = await getPlan(sessionName, planName);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Delete plan file
    try {
      await fs.unlink(planPath);
    } catch (error) {
      throw { code: 'FILE_WRITE_ERROR', original: error };
    }

    return {
      success: true,
      message: `Plan '${planName}' deleted successfully`
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName });
  }
}

/**
 * Lists all plans for a session
 * @param {string} sessionName - Session name
 * @returns {Promise<Array<string>>} - Plan names
 */
async function listPlans(sessionName) {
  try {
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    const plansDir = path.join(sessionPath, 'plans');

    // Check if plans directory exists
    try {
      await fs.access(plansDir);
    } catch {
      // No plans directory yet
      return {
        success: true,
        data: {
          plans: [],
          count: 0
        },
        message: 'No plans found'
      };
    }

    // Read plans directory
    const files = await fs.readdir(plansDir);
    const planNames = files
      .filter(f => f.startsWith('plan_') && f.endsWith('.json'))
      .map(f => f.replace('plan_', '').replace('.json', ''));

    return {
      success: true,
      data: {
        plans: planNames,
        count: planNames.length
      },
      message: `Found ${planNames.length} plan(s)`
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName });
  }
}

/**
 * Validates a plan against schema
 * @param {Object} planData - Plan data
 * @returns {ValidationResult}
 */
async function validatePlan(planData) {
  const validation = await validatePlanData(planData);

  if (validation.valid) {
    return {
      success: true,
      valid: true,
      message: 'Plan is valid'
    };
  } else {
    return {
      success: false,
      valid: false,
      errors: validation.errors,
      message: 'Plan validation failed'
    };
  }
}

/**
 * Updates task status in a plan
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending|in_progress|completed|blocked)
 * @returns {Promise<UpdateResult>}
 */
async function updateTaskStatus(sessionName, planName, taskId, status) {
  try {
    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (!validStatuses.includes(status)) {
      throw { code: 'INVALID_STATUS' };
    }

    // Get plan
    const plan = await getPlan(sessionName, planName);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Find task
    let taskFound = false;
    let oldStatus = null;

    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.task_id === taskId) {
          taskFound = true;
          oldStatus = task.status;
          task.status = status;
          break;
        }
      }
      if (taskFound) break;
    }

    if (!taskFound) {
      throw { code: 'TASK_NOT_FOUND' };
    }

    // Update progress counts
    plan.progress = calculateProgress(plan.phases);
    plan.updated_at = new Date().toISOString();

    // Save plan
    const updateResult = await updatePlan(sessionName, planName, plan);
    if (!updateResult.success) {
      throw { code: 'FILE_WRITE_ERROR' };
    }

    return {
      success: true,
      data: {
        task_id: taskId,
        old_status: oldStatus,
        new_status: status,
        progress: plan.progress
      },
      message: 'Task status updated successfully'
    };

  } catch (error) {
    return handleCliError(error, {
      session: sessionName,
      plan: planName,
      taskId,
      status
    });
  }
}

/**
 * Gets plan execution status
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<StatusResult>}
 */
async function getPlanStatus(sessionName, planName) {
  try {
    const plan = await getPlan(sessionName, planName);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    const progress = plan.progress || calculateProgress(plan.phases);
    const percentComplete = progress.total_tasks > 0
      ? Math.round((progress.completed / progress.total_tasks) * 100)
      : 0;

    // Find current task (first in_progress task, or first pending if none in progress)
    let currentTask = null;
    let currentPhase = null;

    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.status === 'in_progress') {
          currentTask = task;
          currentPhase = phase;
          break;
        }
      }
      if (currentTask) break;
    }

    if (!currentTask) {
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          if (task.status === 'pending') {
            currentTask = task;
            currentPhase = phase;
            break;
          }
        }
        if (currentTask) break;
      }
    }

    return {
      success: true,
      data: {
        plan_name: plan.plan_name,
        work_type: plan.work_type,
        goal: plan.goal,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        progress: {
          total_tasks: progress.total_tasks,
          completed: progress.completed,
          in_progress: progress.in_progress,
          pending: progress.pending,
          blocked: progress.blocked || 0,
          percent_complete: percentComplete
        },
        current_phase: currentPhase ? currentPhase.phase_name : null,
        current_task: currentTask ? {
          task_id: currentTask.task_id,
          description: currentTask.description,
          status: currentTask.status
        } : null
      },
      message: 'Plan status retrieved successfully'
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName });
  }
}

/**
 * Exports plan to different format
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {string} format - Export format (json|markdown|csv)
 * @returns {Promise<string>} - Formatted output
 */
async function exportPlan(sessionName, planName, format = 'json') {
  try {
    const plan = await getPlan(sessionName, planName);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    if (format === 'json') {
      return {
        success: true,
        data: JSON.stringify(plan, null, 2),
        message: 'Plan exported as JSON'
      };
    } else if (format === 'markdown') {
      // Simple markdown export
      let md = `# Plan: ${plan.plan_name}\n\n`;
      md += `**Work Type**: ${plan.work_type}\n`;
      md += `**Goal**: ${plan.goal}\n`;
      md += `**Created**: ${plan.created_at}\n\n`;

      for (const phase of plan.phases) {
        md += `## ${phase.phase_name}\n\n`;
        if (phase.description) {
          md += `${phase.description}\n\n`;
        }
        for (const task of phase.tasks) {
          const status = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '⋯' : '○';
          md += `- [${status}] **${task.task_id}**: ${task.description}\n`;
          if (task.details) {
            md += `  - ${task.details}\n`;
          }
        }
        md += '\n';
      }

      return {
        success: true,
        data: md,
        message: 'Plan exported as Markdown'
      };
    } else {
      throw { code: 'INVALID_FORMAT', message: `Format '${format}' not supported` };
    }

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName, format });
  }
}

/**
 * Checks if plan exists
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<boolean>}
 */
async function planExists(sessionName, planName) {
  const plan = await getPlan(sessionName, planName);
  return {
    success: true,
    data: {
      exists: plan !== null
    },
    message: plan ? 'Plan exists' : 'Plan does not exist'
  };
}

module.exports = {
  createPlan,
  getPlan,
  updatePlan,
  deletePlan,
  listPlans,
  validatePlan,
  updateTaskStatus,
  getPlanStatus,
  exportPlan,
  planExists
};
