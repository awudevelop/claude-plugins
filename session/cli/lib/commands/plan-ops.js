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
 * Calculate relative time string for plans
 * @param {string} dateStr - Date string (ISO format)
 * @returns {string} Relative time (e.g., "2h ago", "3d ago")
 */
function planRelativeTime(dateStr) {
  if (!dateStr) return 'unknown';

  const parsed = new Date(dateStr);
  const now = Date.now();
  const then = parsed.getTime();
  if (isNaN(then)) return 'unknown';

  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${diffWeeks}w ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Format progress bar
 * @param {number} percent - Percentage complete (0-100)
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function formatProgressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

/**
 * Load plan metadata for display
 * @param {string} plansDir - Plans directory path
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} Plan metadata
 */
async function loadPlanMetadata(plansDir, planName) {
  const planDir = path.join(plansDir, planName);
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  const requirementsPath = path.join(planDir, 'requirements.json');
  const executionStatePath = path.join(planDir, 'execution-state.json');

  let metadata = {
    name: planName,
    format: 'unknown',
    goal: '',
    workType: '',
    created: null,
    updated: null,
    progress: null,
    status: 'unknown'
  };

  // Try orchestration.json first (implementation format)
  try {
    const content = await fs.readFile(orchestrationPath, 'utf-8');
    const orch = JSON.parse(content);
    metadata.format = 'implementation';
    metadata.goal = orch.goal || orch.metadata?.goal || '';
    metadata.workType = orch.work_type || orch.metadata?.workType || '';
    metadata.created = orch.metadata?.created || orch.created_at;
    metadata.updated = orch.metadata?.modified || orch.updated_at;
    metadata.totalTasks = orch.progress?.totalTasks || 0;
    metadata.totalPhases = orch.phases?.length || 0;

    // Try to load execution state for accurate progress
    try {
      const stateContent = await fs.readFile(executionStatePath, 'utf-8');
      const state = JSON.parse(stateContent);
      metadata.progress = state.globalProgress || null;
      metadata.status = state.globalProgress?.percentage === 100 ? 'completed' :
                       state.globalProgress?.tasksCompleted > 0 ? 'in_progress' : 'pending';
      metadata.updated = state.lastUpdate || metadata.updated;
    } catch {
      // No execution state, use orchestration data
      metadata.progress = orch.progress ? {
        percentage: 0,
        tasksCompleted: 0,
        tasksTotal: orch.progress.totalTasks
      } : null;
      metadata.status = 'pending';
    }
  } catch {
    // Try requirements.json (conceptual format)
    try {
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const req = JSON.parse(content);
      metadata.format = 'conceptual';
      metadata.goal = req.goal || '';
      metadata.workType = req.work_type || '';
      metadata.created = req.created_at;
      metadata.updated = req.updated_at || req.created_at;
      metadata.requirementsCount = req.requirements?.length || 0;
      metadata.status = 'draft';
    } catch {
      // Neither file found
      return null;
    }
  }

  return metadata;
}

/**
 * Format plan list for display (pre-formatted markdown)
 * @param {Array} plans - Array of plan metadata objects
 * @returns {string} Formatted markdown output
 */
function formatPlanList(plans) {
  if (plans.length === 0) {
    return `📋 **No plans found**

You haven't created any plans yet.

**Get started:**
1. Have a conversation about what you want to build
2. Run \`/session:save-plan {name}\` to capture requirements
3. Run \`/session:plan-finalize {name}\` to create executable tasks
4. Run \`/session:plan-execute {name}\` to start implementation

💡 Plans are global and accessible from any session.`;
  }

  const conceptual = plans.filter(p => p.format === 'conceptual');
  const implementation = plans.filter(p => p.format === 'implementation');

  let out = `📋 **Global Plans (${plans.length} total)**\n\n`;

  // Conceptual plans
  if (conceptual.length > 0) {
    out += `**Conceptual Plans** (Requirements Only):\n`;
    conceptual.forEach((p, i) => {
      const goal = p.goal.length > 60 ? p.goal.substring(0, 57) + '...' : p.goal;
      out += `\n  ${i + 1}. **${p.name}** 📝\n`;
      out += `     ├─ Goal: ${goal}\n`;
      out += `     ├─ Requirements: ${p.requirementsCount || 0}\n`;
      out += `     ├─ Created: ${planRelativeTime(p.created)}\n`;
      out += `     └─ Next: \`/session:plan-finalize ${p.name}\`\n`;
    });
    out += '\n';
  }

  // Implementation plans
  if (implementation.length > 0) {
    out += `**Implementation Plans** (Executable):\n`;
    implementation.forEach((p, i) => {
      const goal = p.goal.length > 60 ? p.goal.substring(0, 57) + '...' : p.goal;
      const idx = conceptual.length + i + 1;
      const typeLabel = p.workType ? ` (${p.workType})` : '';

      // Status badge
      let statusBadge = '';
      if (p.status === 'completed') statusBadge = ' ✅';
      else if (p.status === 'in_progress') statusBadge = ' 🔄';
      else statusBadge = ' ○';

      out += `\n  ${idx}. **${p.name}**${typeLabel}${statusBadge}\n`;
      out += `     ├─ Goal: ${goal}\n`;

      if (p.progress) {
        const pct = p.progress.percentage || 0;
        const completed = p.progress.tasksCompleted || 0;
        const total = p.progress.tasksTotal || p.totalTasks || 0;
        out += `     ├─ Progress: ${formatProgressBar(pct)} ${pct}% (${completed}/${total} tasks)\n`;
      } else {
        out += `     ├─ Tasks: ${p.totalTasks || 0} | Phases: ${p.totalPhases || 0}\n`;
      }

      out += `     └─ Updated: ${planRelativeTime(p.updated)}\n`;
    });
    out += '\n';
  }

  out += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  out += `💡 \`/session:plan-status {name}\` - Show detailed status\n`;
  out += `💡 \`/session:plan-execute {name}\` - Start/continue execution`;

  return out;
}

/**
 * Lists all global plans
 * @param {Array} args - Command arguments (supports --formatted)
 * @returns {Promise<Object>} - Plan list result
 */
async function listPlans(args = []) {
  try {
    const formatted = args.includes && args.includes('--formatted');
    const plansDir = getPlansDirectory();

    // Check if plans directory exists
    try {
      await fs.access(plansDir);
    } catch {
      // No plans directory yet
      if (formatted) {
        return { formatted: formatPlanList([]) };
      }
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

    // Load metadata for each plan
    const planMetadata = [];
    for (const dir of planDirs) {
      const metadata = await loadPlanMetadata(plansDir, dir.name);
      if (metadata) {
        planMetadata.push(metadata);
      }
    }

    // Sort by last updated (most recent first)
    planMetadata.sort((a, b) => {
      const dateA = new Date(a.updated || 0);
      const dateB = new Date(b.updated || 0);
      return dateB - dateA;
    });

    // Return pre-formatted output if requested
    if (formatted) {
      return { formatted: formatPlanList(planMetadata) };
    }

    // Return JSON for programmatic use
    return {
      success: true,
      data: {
        plans: planMetadata.map(p => p.name),
        count: planMetadata.length,
        metadata: planMetadata  // Include full metadata
      },
      message: `Found ${planMetadata.length} plan(s)`
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
 * Format plan status for display (pre-formatted markdown)
 * @param {Object} data - Plan status data
 * @returns {string} Formatted markdown output
 */
function formatPlanStatus(data) {
  const d = data;
  const goal = d.goal?.length > 80 ? d.goal.substring(0, 77) + '...' : (d.goal || 'No goal set');

  // Status badge
  let statusBadge = '';
  switch (d.status) {
    case 'completed': statusBadge = '✅ COMPLETED'; break;
    case 'in_progress': statusBadge = '🔄 IN PROGRESS'; break;
    case 'failed': statusBadge = '❌ FAILED'; break;
    default: statusBadge = '○ PENDING';
  }

  let out = `📋 **Plan: ${d.plan_name}**\n\n`;
  out += `**Goal:** ${goal}\n`;
  out += `**Status:** ${statusBadge}\n`;
  if (d.work_type) out += `**Type:** ${d.work_type}\n`;
  out += '\n';

  // Progress section
  const prog = d.progress;
  const pct = prog.percent_complete || 0;
  out += `**Progress:** ${formatProgressBar(pct)} ${pct}% (${prog.completed}/${prog.total_tasks} tasks)\n`;
  out += `├─ Completed: ${prog.completed}\n`;
  out += `├─ In Progress: ${prog.in_progress}\n`;
  out += `├─ Pending: ${prog.pending}\n`;
  if (prog.blocked > 0) out += `├─ Blocked: ${prog.blocked} ⚠️\n`;
  if (prog.skipped > 0) out += `├─ Skipped: ${prog.skipped}\n`;
  out += '\n';

  // Phases section
  const phases = d.phases;
  out += `**Phases:** ${phases.completed}/${phases.total} completed\n`;
  if (phases.in_progress > 0) out += `├─ In Progress: ${phases.in_progress}\n`;
  if (phases.skipped > 0) out += `├─ Skipped: ${phases.skipped}\n`;
  out += '\n';

  // Current task
  if (d.current_task) {
    out += `**Current Task:** ${d.current_task.task_id}\n`;
    out += `└─ ${d.current_task.description}\n\n`;
  } else if (d.current_phase) {
    out += `**Current Phase:** ${d.current_phase}\n\n`;
  }

  // Timestamps
  out += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (d.created_at) out += `Created: ${planRelativeTime(d.created_at)}\n`;
  if (d.updated_at) out += `Updated: ${planRelativeTime(d.updated_at)}\n`;
  if (d.completed_at) out += `Completed: ${planRelativeTime(d.completed_at)}\n`;

  out += '\n';
  out += `💡 \`/session:plan-execute ${d.plan_name}\` - Continue execution\n`;
  out += `💡 \`/session:plan-list\` - View all plans`;

  return out;
}

/**
 * Gets plan execution status
 * Uses progress-service (execution-state.json) as source of truth
 * Properly handles skipped phases/tasks in progress reporting
 * @param {Array|string} args - Command args or plan name for backwards compatibility
 * @returns {Promise<StatusResult>}
 */
async function getPlanStatus(args) {
  try {
    // Handle both array args and direct planName for backwards compatibility
    let planName;
    let formatted = false;

    if (Array.isArray(args)) {
      planName = args.find(arg => !arg.startsWith('--'));
      formatted = args.includes('--formatted');
    } else {
      planName = args;
    }

    if (!planName) {
      throw { code: 'INVALID_ARGUMENTS', message: 'Plan name required' };
    }

    // Use progress service to get accurate status from execution-state.json
    const progress = await progressService.getProgress(planName);

    // Also load plan metadata
    const plan = await getPlan(planName, false);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    const statusData = {
      plan_name: planName,
      status: progress.status,
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
        skipped: progress.skippedTasks,
        percent_complete: progress.percentComplete,
        actual_work_percent: progress.actualWorkPercent
      },
      phases: {
        total: progress.totalPhases,
        completed: progress.completedPhases,
        skipped: progress.skippedPhases,
        in_progress: progress.inProgressPhases
      },
      current_phase: progress.currentPhase?.name || progress.currentTask?.phase_id || null,
      current_task: progress.currentTask ? {
        task_id: progress.currentTask.task_id,
        description: progress.currentTask.description,
        status: progress.currentTask.status
      } : null,
      completed_at: progress.completedAt || null,
      skip_reason: progress.skipReason || null,
      summary: progress.summary || null
    };

    // Return pre-formatted output if requested
    if (formatted) {
      return { formatted: formatPlanStatus(statusData) };
    }

    return {
      success: true,
      data: statusData,
      message: 'Plan status retrieved successfully'
    };

  } catch (error) {
    const planName = Array.isArray(args) ? args.find(a => !a.startsWith('--')) : args;
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

      // Validate suggestions if present (optional but structured)
      if (req.suggestions) {
        const validSuggestionTypes = [
          'api_designs', 'code_snippets', 'file_structures',
          'ui_components', 'implementation_patterns'
        ];

        for (const key of Object.keys(req.suggestions)) {
          if (!validSuggestionTypes.includes(key)) {
            // Allow unknown types but log warning (don't fail validation)
            console.warn(`Requirement ${index + 1}: Unknown suggestion type '${key}' (allowed but not standard)`);
          }
          if (req.suggestions[key] && !Array.isArray(req.suggestions[key])) {
            errors.push(`Requirement ${index + 1}: suggestions.${key} must be an array`);
          }
        }
      }
    });
  }

  // Validate technical_decisions if present (optional)
  if (requirementsData.technical_decisions) {
    if (!Array.isArray(requirementsData.technical_decisions)) {
      errors.push('technical_decisions must be an array');
    }
  }

  // Validate user_decisions if present (optional)
  if (requirementsData.user_decisions) {
    if (!Array.isArray(requirementsData.user_decisions)) {
      errors.push('user_decisions must be an array');
    }
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

/**
 * Get the next pending task for execution
 * @param {string} planName - Plan name
 * @returns {Promise<Object|null>} Next task or null if none pending
 */
async function getNextTask(planName) {
  try {
    const plan = await getPlan(planName, true);
    if (!plan || !plan.phases) {
      return null;
    }

    // Find first pending task respecting phase order and dependencies
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.status === 'pending') {
          // Check if dependencies are met
          const depsCompleted = !task.depends_on?.length ||
            task.depends_on.every(depId => {
              // Find the dependency task and check its status
              for (const p of plan.phases) {
                const dep = p.tasks.find(t => t.task_id === depId);
                if (dep && dep.status === 'completed') return true;
              }
              return false;
            });

          if (depsCompleted) {
            return {
              success: true,
              data: {
                task_id: task.task_id,
                description: task.description,
                details: task.details,
                phase_name: phase.phase_name,
                phase_id: phase.id,
                type: task.type,
                file: task.file,
                spec: task.spec,
                confidence: task.confidence,
                depends_on: task.depends_on,
                docs: task.docs,
                review: task.review
              }
            };
          }
        }
      }
    }

    return {
      success: true,
      data: null,
      message: 'No pending tasks available'
    };

  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Get confidence statistics for a plan
 * @param {string} planName - Plan name
 * @returns {Promise<Object>} Confidence statistics
 */
async function getConfidenceStats(planName) {
  try {
    const plan = await getPlan(planName, true);
    if (!plan || !plan.phases) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    const stats = {
      total: 0,
      high: 0,     // 70+
      medium: 0,   // 40-69
      low: 0,      // <40
      unknown: 0,  // No confidence data
      lowConfidenceTasks: []
    };

    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        stats.total++;

        if (!task.confidence) {
          stats.unknown++;
          continue;
        }

        const score = task.confidence.score || 50;
        if (score >= 70) {
          stats.high++;
        } else if (score >= 40) {
          stats.medium++;
        } else {
          stats.low++;
          stats.lowConfidenceTasks.push({
            task_id: task.task_id,
            description: task.description,
            score: score,
            level: task.confidence.level,
            risks: task.confidence.risks,
            mitigations: task.confidence.mitigations
          });
        }
      }
    }

    return {
      success: true,
      data: stats,
      message: `Plan has ${stats.high} high, ${stats.medium} medium, ${stats.low} low confidence tasks`
    };

  } catch (error) {
    return handleCliError(error, { plan: planName });
  }
}

/**
 * Get task context for code generation
 * Loads reference files, patterns, and relevant project context
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task context
 */
async function getTaskContext(planName, taskId) {
  try {
    const plan = await getPlan(planName, true);
    if (!plan || !plan.phases) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Find the task
    let task = null;
    let phaseName = null;
    for (const phase of plan.phases) {
      const found = phase.tasks.find(t => t.task_id === taskId);
      if (found) {
        task = found;
        phaseName = phase.phase_name;
        break;
      }
    }

    if (!task) {
      throw { code: 'TASK_NOT_FOUND' };
    }

    const context = {
      task,
      phase_name: phaseName,
      reference_files: [],
      docs: task.docs || [],
      patterns: task.spec?.patterns || []
    };

    // Load reference files content if patterns specified
    if (task.spec?.patterns?.length) {
      for (const pattern of task.spec.patterns) {
        try {
          const filePath = path.isAbsolute(pattern)
            ? pattern
            : path.join(workingDir, pattern);
          const content = await fs.readFile(filePath, 'utf8');
          context.reference_files.push({
            path: pattern,
            content: content.slice(0, 5000) // Limit size
          });
        } catch {
          // File not found, skip
        }
      }
    }

    return {
      success: true,
      data: context,
      message: 'Task context loaded'
    };

  } catch (error) {
    return handleCliError(error, { plan: planName, taskId });
  }
}

/**
 * Mark multiple tasks as completed or skipped in batch
 * @param {string} planName - Plan name
 * @param {Array<{task_id: string, status: string, result?: string}>} updates - Task updates
 * @returns {Promise<Object>} Batch update result
 */
async function batchUpdateTasks(planName, updates) {
  try {
    const results = [];
    for (const update of updates) {
      const result = await updateTaskStatus(planName, update.task_id, update.status, {
        result: update.result
      });
      results.push({
        task_id: update.task_id,
        success: result.success,
        error: result.error?.message
      });
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount === results.length,
      data: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results
      },
      message: `Updated ${successCount}/${results.length} tasks`
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
  transformPlan,
  // New execution workflow functions (Phase 4)
  getNextTask,
  getConfidenceStats,
  getTaskContext,
  batchUpdateTasks
};
