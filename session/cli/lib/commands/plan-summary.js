/**
 * Plan Summary Generator
 * Exports plans to readable markdown with goal, status, progress, phases, and confidence stats
 */

const planOps = require('./plan-ops');

/**
 * Load plan data with all phases and tasks
 * @param {string} planName - Name of the plan to load
 * @returns {Promise<object|null>} - Plan object with phases or null if not found
 */
async function loadPlanData(planName) {
  // Use getPlan with loadPhases=true to get complete plan data
  const plan = await planOps.getPlan(planName, true);
  return plan;
}

/**
 * Calculate progress percentage from task counts
 * @param {object} plan - Plan object with phases and tasks
 * @returns {number} - Progress percentage (0-100)
 */
function calculateProgress(plan) {
  let totalTasks = 0;
  let completedTasks = 0;

  // Handle both formats: phases array or progress object
  if (plan.phases && Array.isArray(plan.phases)) {
    for (const phase of plan.phases) {
      if (phase.tasks && Array.isArray(phase.tasks)) {
        totalTasks += phase.tasks.length;
        completedTasks += phase.tasks.filter(t =>
          t.status === 'completed' || t.status === 'skipped'
        ).length;
      }
    }
  }

  // Handle edge case of zero tasks
  if (totalTasks === 0) {
    return 0;
  }

  return Math.round((completedTasks / totalTasks) * 100);
}

/**
 * Calculate confidence breakdown from tasks
 * @param {object} plan - Plan object with phases and tasks
 * @returns {{high: number, medium: number, low: number}} - Confidence counts
 */
function calculateConfidenceStats(plan) {
  const stats = { high: 0, medium: 0, low: 0 };

  // Check if plan already has confidence summary (from orchestration)
  if (plan.confidence) {
    return {
      high: plan.confidence.high || 0,
      medium: plan.confidence.medium || 0,
      low: plan.confidence.low || 0
    };
  }

  // Otherwise calculate from tasks
  if (plan.phases && Array.isArray(plan.phases)) {
    for (const phase of plan.phases) {
      if (phase.tasks && Array.isArray(phase.tasks)) {
        for (const task of phase.tasks) {
          const level = task.confidence?.level || 'medium';
          if (stats[level] !== undefined) {
            stats[level]++;
          } else {
            stats.medium++; // Default to medium if unknown
          }
        }
      }
    }
  }

  return stats;
}

/**
 * Generate markdown header with goal and status
 * @param {object} plan - Plan object
 * @param {number} progress - Progress percentage
 * @param {{high: number, medium: number, low: number}} confidenceStats - Confidence counts
 * @returns {string} - Markdown header string
 */
function generateHeader(plan, progress, confidenceStats) {
  const planName = plan.plan_name || plan.metadata?.planId || 'Unknown';
  const goal = plan.goal || plan.metadata?.name || 'No goal specified';
  const status = plan.status || plan.metadata?.status || 'unknown';

  // Count total tasks
  let totalTasks = 0;
  let completedTasks = 0;
  if (plan.phases && Array.isArray(plan.phases)) {
    for (const phase of plan.phases) {
      if (phase.tasks && Array.isArray(phase.tasks)) {
        totalTasks += phase.tasks.length;
        completedTasks += phase.tasks.filter(t => t.status === 'completed').length;
      }
    }
  }

  const lines = [
    `# Plan: ${planName}`,
    '',
    `**Goal**: ${goal}`,
    `**Status**: ${status}`,
    `**Progress**: ${completedTasks}/${totalTasks} tasks (${progress}%)`,
    '',
    `**Confidence**: High: ${confidenceStats.high} | Medium: ${confidenceStats.medium} | Low: ${confidenceStats.low}`,
    ''
  ];

  return lines.join('\n');
}

/**
 * Generate phase breakdown with task checkmarks
 * @param {object} plan - Plan object with phases and tasks
 * @returns {string} - Markdown phases section
 */
function generatePhasesSection(plan) {
  const lines = ['## Phases', ''];

  if (!plan.phases || !Array.isArray(plan.phases)) {
    lines.push('_No phases defined_');
    return lines.join('\n');
  }

  for (const phase of plan.phases) {
    const phaseName = phase.phase_name || phase.name || 'Unnamed Phase';
    const phaseStatus = phase.status || 'pending';

    // Phase header
    lines.push(`### ${phaseName}`);
    lines.push(`Status: ${phaseStatus}`);
    lines.push('');

    if (phase.tasks && Array.isArray(phase.tasks)) {
      for (const task of phase.tasks) {
        // Map task status to checkbox (per req-4: completed, pending, failed/blocked)
        const indicator = task.status === 'completed' ? '[x]' :
                         (task.status === 'failed' || task.status === 'blocked') ? '[!]' :
                         '[ ]';
        const description = task.description || task.task_id || 'No description';
        const confidenceLevel = task.confidence?.level || '';
        const confidenceTag = confidenceLevel ? ` [${confidenceLevel}]` : '';

        lines.push(`- ${indicator} ${description}${confidenceTag}`);
      }
    } else {
      lines.push('_No tasks defined_');
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main function to generate complete plan summary
 * @param {string} planName - Name of the plan
 * @returns {Promise<{success: boolean, data?: string, error?: object}>} - Result with markdown or error
 */
async function generatePlanSummary(planName) {
  try {
    // Load plan data with all phases
    const plan = await loadPlanData(planName);

    if (!plan) {
      return {
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: `Plan '${planName}' not found`,
          suggestion: 'Use /session:plan-list to see available plans'
        }
      };
    }

    // Calculate progress and confidence
    const progress = calculateProgress(plan);
    const confidenceStats = calculateConfidenceStats(plan);

    // Generate sections
    const header = generateHeader(plan, progress, confidenceStats);
    const phases = generatePhasesSection(plan);

    // Combine sections
    const markdown = [
      header,
      '---',
      '',
      phases
    ].join('\n');

    return {
      success: true,
      data: {
        markdown,
        planName,
        progress,
        confidenceStats
      }
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Failed to generate plan summary',
        details: error
      }
    };
  }
}

module.exports = {
  generatePlanSummary,
  // Export helpers for testing
  loadPlanData,
  calculateProgress,
  calculateConfidenceStats,
  generateHeader,
  generatePhasesSection
};
