const fs = require('fs').promises;
const path = require('path');
const planConverter = require('../plan-converter');
const progressService = require('../../services/progress-service');

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
 * Centralized error handler for CLI operations
 */
function handleCliError(error, context = {}) {
  const errorMap = {
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
 * Creates a new plan file (orchestration.json + phase files)
 * @param {string} planName - Plan name
 * @param {Object} planData - Plan data (monolithic format)
 * @returns {Promise<CreateResult>}
 */
async function createPlan(planName, planData) {
  try {
    // Validate plan name
    const nameValidation = validatePlanName(planName);
    if (!nameValidation.valid) {
      throw { code: 'INVALID_PLAN_NAME', message: nameValidation.error };
    }

    // Ensure plans directory exists
    const plansDir = getPlansDirectory();
    await fs.mkdir(plansDir, { recursive: true });

    // Check if plan already exists (as directory)
    const planDir = path.join(plansDir, planName);
    try {
      await fs.access(planDir);
      throw { code: 'PLAN_EXISTS' };
    } catch (error) {
      if (error.code === 'PLAN_EXISTS') throw error;
      // Directory doesn't exist, which is what we want
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

    // Convert monolithic plan to orchestration + phase files
    const { orchestration, phaseFiles } = planConverter.splitPlanIntoPhases(planData);

    // Create plan directory structure
    await fs.mkdir(planDir, { recursive: true });
    await fs.mkdir(path.join(planDir, 'phases'), { recursive: true });

    // Write orchestration.json
    try {
      await fs.writeFile(
        path.join(planDir, 'orchestration.json'),
        JSON.stringify(orchestration, null, 2)
      );
    } catch (error) {
      throw { code: 'FILE_WRITE_ERROR', original: error };
    }

    // Write phase files
    for (let i = 0; i < phaseFiles.length; i++) {
      const phaseFile = phaseFiles[i];
      const phaseFilePath = path.join(planDir, orchestration.phases[i].file);

      try {
        await fs.writeFile(phaseFilePath, JSON.stringify(phaseFile, null, 2));
      } catch (error) {
        throw { code: 'FILE_WRITE_ERROR', original: error };
      }
    }

    // Create empty execution-state.json
    const executionState = {
      planId: planName,
      startTime: null,
      lastUpdate: new Date().toISOString(),
      tokenUsage: {
        used: 0,
        remaining: orchestration.execution.tokenBudget.total,
        byPhase: {}
      },
      phaseStates: {},
      globalProgress: {
        percentage: 0,
        phasesCompleted: 0,
        phasesTotal: orchestration.phases.length,
        tasksCompleted: 0,
        tasksTotal: orchestration.progress.totalTasks
      },
      executionLog: []
    };

    await fs.writeFile(
      path.join(planDir, 'execution-state.json'),
      JSON.stringify(executionState, null, 2)
    );

    return {
      success: true,
      data: {
        plan_name: planName,
        path: planDir,
        orchestration_file: path.join(planDir, 'orchestration.json'),
        phase_count: phaseFiles.length,
        total_tasks: orchestration.progress.totalTasks
      },
      message: `Plan '${planName}' created successfully with ${phaseFiles.length} phases`
    };

  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Retrieves a plan file (orchestration.json format)
 * @param {string} planName - Plan name
 * @param {boolean} loadPhases - Whether to load all phase files (default: false)
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
async function getPlan(planName, loadPhases = false) {
  try {
    const plansDir = getPlansDirectory();
    const planDir = path.join(plansDir, planName);

    // Check if plan directory exists
    try {
      const stats = await fs.stat(planDir);
      if (!stats.isDirectory()) {
        return null;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    // Read orchestration.json
    const orchestrationPath = path.join(planDir, 'orchestration.json');
    let orchestration;
    try {
      const content = await fs.readFile(orchestrationPath, 'utf-8');
      orchestration = JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Try requirements.json (conceptual format)
        const requirementsPath = path.join(planDir, 'requirements.json');
        try {
          const reqContent = await fs.readFile(requirementsPath, 'utf-8');
          const requirements = JSON.parse(reqContent);

          // Return conceptual plan with metadata indicating it needs finalization
          return {
            ...requirements,
            _format: 'conceptual',
            _planDir: planDir,
            _needsFinalization: true
          };
        } catch (reqError) {
          if (reqError.code === 'ENOENT') {
            return null; // Neither file exists
          }
          if (reqError instanceof SyntaxError) {
            throw { code: 'PARSE_ERROR' };
          }
          throw { code: 'FILE_READ_ERROR', original: reqError };
        }
      }
      if (error instanceof SyntaxError) {
        throw { code: 'PARSE_ERROR' };
      }
      throw { code: 'FILE_READ_ERROR', original: error };
    }

    // Optionally load all phase files
    if (loadPhases) {
      const phaseFiles = [];
      for (const phaseMeta of orchestration.phases) {
        const phaseFilePath = path.join(planDir, phaseMeta.file);
        try {
          const phaseContent = await fs.readFile(phaseFilePath, 'utf-8');
          phaseFiles.push(JSON.parse(phaseContent));
        } catch (error) {
          console.warn(`Warning: Could not load phase file ${phaseMeta.file}`);
          phaseFiles.push(null);
        }
      }

      // Return merged plan (for backward compatibility)
      return planConverter.mergePhasesIntoPlan(orchestration, phaseFiles.filter(p => p !== null));
    }

    // Return orchestration with helper to load phases on demand
    return {
      ...orchestration,
      _format: 'orchestration',
      _planDir: planDir,
      _loadPhase: async (phaseId) => {
        const phaseMeta = orchestration.phases.find(p => p.id === phaseId);
        if (!phaseMeta) {
          throw new Error(`Phase not found: ${phaseId}`);
        }
        const phaseFilePath = path.join(planDir, phaseMeta.file);
        const content = await fs.readFile(phaseFilePath, 'utf-8');
        return JSON.parse(content);
      }
    };
  } catch (error) {
    const result = handleCliError(error, { plan: planName });
    return null;
  }
}

/**
 * Updates an existing plan
 * @param {string} planName - Plan name
 * @param {Object} updates - Partial or complete plan data to update
 * @returns {Promise<UpdateResult>}
 */
async function updatePlan(planName, updates) {
  try {
    const plansDir = getPlansDirectory();
    const planPath = path.join(plansDir, `plan_${planName}.json`);

    // Get existing plan
    const existingPlan = await getPlan(planName);
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
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Deletes a plan file
 * @param {string} planName - Plan name
 * @returns {Promise<DeleteResult>}
 */
async function deletePlan(planName) {
  try {
    const plansDir = getPlansDirectory();
    const planPath = path.join(plansDir, `plan_${planName}.json`);

    // Check if plan exists
    const plan = await getPlan(planName);
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
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Lists all global plans
 * @returns {Promise<Array<string>>} - Plan names
 */
async function listPlans() {
  try {
    const plansDir = getPlansDirectory();

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

    // Read plans directory - now looking for subdirectories
    const entries = await fs.readdir(plansDir, { withFileTypes: true });
    const planDirs = entries.filter(entry => entry.isDirectory());

    // Validate each directory has orchestration.json OR requirements.json
    const planNames = [];
    for (const dir of planDirs) {
      const orchestrationPath = path.join(plansDir, dir.name, 'orchestration.json');
      const requirementsPath = path.join(plansDir, dir.name, 'requirements.json');
      try {
        await fs.access(orchestrationPath);
        planNames.push(dir.name);
      } catch {
        // Try requirements.json (conceptual format)
        try {
          await fs.access(requirementsPath);
          planNames.push(dir.name);
        } catch {
          // Skip directories without either file
        }
      }
    }

    return {
      success: true,
      data: {
        plans: planNames,
        count: planNames.length
      },
      message: `Found ${planNames.length} plan(s)`
    };

  } catch (error) {
    return handleCliError(error, {});
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
 * Uses progress-service to ensure execution-state.json (source of truth) is updated
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending|in_progress|completed|blocked|failed)
 * @param {Object} options - Optional { result: string } to store task result
 * @returns {Promise<UpdateResult>}
 */
async function updateTaskStatus(planName, taskId, status, options = {}) {
  try {
    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'failed'];
    if (!validStatuses.includes(status)) {
      throw { code: 'INVALID_STATUS' };
    }

    // Get old status before update
    const oldStatus = await progressService.getTaskStatus(planName, taskId);

    // Use progress service to update (this updates execution-state.json AND syncs files)
    const result = await progressService.setTaskStatus(planName, taskId, status, {
      result: options.result,
      syncFiles: true
    });

    // Get updated progress for response
    const progress = await progressService.getProgress(planName);

    return {
      success: true,
      data: {
        task_id: taskId,
        old_status: oldStatus,
        new_status: status,
        phase_id: result.phaseId,
        progress: {
          total_tasks: progress.totalTasks,
          completed: progress.completedTasks,
          percent_complete: progress.percentComplete
        }
      },
      message: 'Task status updated successfully'
    };

  } catch (error) {
    // Handle specific errors from progress service
    if (error.message?.includes('not found')) {
      if (error.message.includes('Task')) {
        return handleCliError({ code: 'TASK_NOT_FOUND' }, { plan: planName, taskId, status });
      }
      return handleCliError({ code: 'PLAN_NOT_FOUND' }, { plan: planName, taskId, status });
    }
    if (error.message?.includes('Invalid status')) {
      return handleCliError({ code: 'INVALID_STATUS' }, { plan: planName, taskId, status });
    }
    return handleCliError(error, { plan: planName, taskId, status });
  }
}

/**
 * Finalizes a conceptual plan to make it implementation-ready
 * @param {string} planName - Plan name
 * @returns {Promise<FinalizeResult>}
 */
async function finalizePlan(planName) {
  try {
    // Get orchestration
    const plansDir = getPlansDirectory();
    const planDir = path.join(plansDir, planName);
    const orchestrationPath = path.join(planDir, 'orchestration.json');

    let orchestration;
    try {
      const content = await fs.readFile(orchestrationPath, 'utf-8');
      orchestration = JSON.parse(content);
    } catch (error) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Check if already finalized
    if (orchestration.metadata.planType === 'implementation') {
      return {
        success: true,
        alreadyFinalized: true,
        message: `Plan '${planName}' is already finalized`
      };
    }

    // Update plan type to implementation
    orchestration.metadata.planType = 'implementation';
    orchestration.metadata.modified = new Date().toISOString();

    // Save updated orchestration
    await fs.writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2));

    return {
      success: true,
      alreadyFinalized: false,
      data: {
        plan_name: planName,
        old_type: 'conceptual',
        new_type: 'implementation',
        phases: orchestration.phases.length,
        total_tasks: orchestration.progress.totalTasks
      },
      message: `Plan '${planName}' finalized and ready for implementation`
    };

  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Gets plan execution status
 * Uses progress-service (execution-state.json) as source of truth
 * @param {string} planName - Plan name
 * @returns {Promise<StatusResult>}
 */
async function getPlanStatus(planName) {
  try {
    // Use progress service to get accurate status from execution-state.json
    const progress = await progressService.getProgress(planName);

    // Also load plan metadata
    const plan = await getPlan(planName, false);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    return {
      success: true,
      data: {
        plan_name: planName,
        work_type: progress.workType || plan.work_type,
        goal: progress.goal || plan.goal,
        created_at: plan.created_at || plan.metadata?.created,
        updated_at: progress.lastUpdated || plan.updated_at || plan.metadata?.modified,
        progress: {
          total_tasks: progress.totalTasks,
          completed: progress.completedTasks,
          in_progress: progress.inProgressTasks,
          pending: progress.pendingTasks,
          blocked: progress.blockedTasks,
          percent_complete: progress.percentComplete
        },
        current_phase: progress.currentPhase?.name || progress.currentTask?.phase_id || null,
        current_task: progress.currentTask ? {
          task_id: progress.currentTask.task_id,
          description: progress.currentTask.description,
          status: progress.currentTask.status
        } : null
      },
      message: 'Plan status retrieved successfully'
    };

  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Exports plan to different format
 * @param {string} planName - Plan name
 * @param {string} format - Export format (json|markdown|csv)
 * @returns {Promise<string>} - Formatted output
 */
async function exportPlan(planName, format = 'json') {
  try {
    const plan = await getPlan(planName);
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
    return handleCliError(error, { plan: planName, format });
  }
}

/**
 * Checks if plan exists
 * @param {string} planName - Plan name
 * @returns {Promise<boolean>}
 */
async function planExists(planName) {
  const plan = await getPlan(planName);
  return {
    success: true,
    data: {
      exists: plan !== null
    },
    message: plan ? 'Plan exists' : 'Plan does not exist'
  };
}

/**
 * Save requirements.json (conceptual plan)
 * @param {string} planName - Plan name
 * @param {object} requirementsData - Requirements data
 * @returns {Promise<Result>}
 */
async function saveRequirements(planName, requirementsData) {
  try {
    const plansDir = getPlansDirectory();
    const planDir = path.join(plansDir, planName);

    // Create plan directory
    await fs.mkdir(planDir, { recursive: true });

    // Save requirements.json
    const requirementsPath = path.join(planDir, 'requirements.json');
    await fs.writeFile(requirementsPath, JSON.stringify(requirementsData, null, 2), 'utf8');

    return {
      success: true,
      data: {
        plan_name: planName,
        format: 'conceptual',
        requirements_count: requirementsData.requirements.length,
        path: requirementsPath
      },
      message: `Requirements saved for plan '${planName}'`
    };
  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Validate requirements against schema
 * @param {object} requirementsData - Requirements data to validate
 * @returns {Promise<Result>}
 */
async function validateRequirements(requirementsData) {
  const errors = [];

  // Required fields
  if (!requirementsData.plan_name) errors.push('Missing plan_name');
  if (requirementsData.plan_type !== 'conceptual') errors.push('plan_type must be "conceptual"');
  if (!requirementsData.goal) errors.push('Missing goal');
  if (!Array.isArray(requirementsData.requirements) || requirementsData.requirements.length === 0) {
    errors.push('requirements must be a non-empty array');
  }

  // Validate each requirement
  if (Array.isArray(requirementsData.requirements)) {
    requirementsData.requirements.forEach((req, index) => {
      if (!req.id || !req.id.match(/^req-\d+$/)) {
        errors.push(`Requirement ${index + 1}: id must match pattern "req-N"`);
      }
      if (!req.description) {
        errors.push(`Requirement ${index + 1}: Missing description`);
      }
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      message: 'Requirements validation failed'
    };
  }

  return {
    success: true,
    message: 'Requirements validation passed'
  };
}

/**
 * Load requirements.json
 * @param {string} planName - Plan name
 * @returns {Promise<Result>}
 */
async function loadRequirements(planName) {
  try {
    const plansDir = getPlansDirectory();
    const requirementsPath = path.join(plansDir, planName, 'requirements.json');

    const content = await fs.readFile(requirementsPath, 'utf8');
    const requirements = JSON.parse(content);

    return {
      success: true,
      data: requirements,
      message: 'Requirements loaded successfully'
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return handleCliError({ code: 'PLAN_NOT_FOUND' }, { plan: planName });
    }
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Get plan format (conceptual or implementation)
 * @param {string} planName - Plan name
 * @returns {Promise<Result>}
 */
async function getPlanFormat(planName) {
  try {
    const plansDir = getPlansDirectory();
    const planDir = path.join(plansDir, planName);

    // Check if requirements.json exists
    const requirementsPath = path.join(planDir, 'requirements.json');
    const orchestrationPath = path.join(planDir, 'orchestration.json');

    const hasRequirements = await fs.access(requirementsPath).then(() => true).catch(() => false);
    const hasOrchestration = await fs.access(orchestrationPath).then(() => true).catch(() => false);

    // If has orchestration.json, it's implementation format
    // If only requirements.json, it's conceptual format
    let format;
    if (hasOrchestration) {
      format = 'implementation';
    } else if (hasRequirements) {
      format = 'conceptual';
    } else {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    return {
      success: true,
      data: {
        format,
        has_requirements: hasRequirements,
        has_orchestration: hasOrchestration
      },
      message: `Plan is in ${format} format`
    };
  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Transform requirements into implementation plan
 * @param {string} planName - Plan name
 * @param {object} breakdownData - AI-generated task breakdown
 * @returns {Promise<Result>}
 */
async function transformPlan(planName, breakdownData) {
  try {
    const plansDir = getPlansDirectory();
    const requirementTransformer = require('../requirement-transformer');

    // Transform using the transformer module
    const result = await requirementTransformer.transformRequirements(
      plansDir,
      planName,
      breakdownData
    );

    return {
      success: true,
      data: {
        plan_name: planName,
        format: 'implementation',
        phases: result.phaseCount,
        tasks: result.taskCount
      },
      message: `Plan '${planName}' transformed to implementation format`
    };
  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

module.exports = {
  createPlan,
  getPlan,
  updatePlan,
  deletePlan,
  listPlans,
  validatePlan,
  updateTaskStatus,
  finalizePlan,
  getPlanStatus,
  exportPlan,
  planExists,
  // New requirements-based workflow functions
  saveRequirements,
  validateRequirements,
  loadRequirements,
  getPlanFormat,
  transformPlan
};
