/**
 * Requirement Transformer
 *
 * Transforms conceptual requirements into executable implementation plans
 * with concrete tasks organized by phases (Database, API, UI, Testing, etc.)
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Transform requirements.json into orchestration.json + phases/
 *
 * @param {string} sessionPath - Absolute path to session directory
 * @param {string} planName - Plan name
 * @param {object} breakdownData - AI-generated task breakdown from breakdown-requirement.md
 * @returns {Promise<object>} - Transformation result
 */
async function transformRequirements(sessionPath, planName, breakdownData) {
  const planDir = path.join(sessionPath, 'plans', planName);
  const requirementsPath = path.join(planDir, 'requirements.json');

  // Load requirements.json
  const requirementsData = await fs.readFile(requirementsPath, 'utf8');
  const requirements = JSON.parse(requirementsData);

  // Validate input
  if (requirements.plan_type !== 'conceptual') {
    throw new Error(`Plan must be conceptual type, got: ${requirements.plan_type}`);
  }

  // Build orchestration + phases from AI breakdown
  const orchestration = buildOrchestration(requirements, breakdownData);
  const phases = buildPhases(requirements, breakdownData);

  // Save orchestration.json
  const orchestrationPath = path.join(planDir, 'orchestration.json');
  await fs.writeFile(
    orchestrationPath,
    JSON.stringify(orchestration, null, 2),
    'utf8'
  );

  // Save phase files
  const phasesDir = path.join(planDir, 'phases');
  await fs.mkdir(phasesDir, { recursive: true });

  for (const phase of phases) {
    const phaseFile = path.join(phasesDir, phase.file.split('/')[1]);
    await fs.writeFile(
      phaseFile,
      JSON.stringify(phase, null, 2),
      'utf8'
    );
  }

  // Create execution-state.json
  const executionState = buildExecutionState(orchestration);
  const executionStatePath = path.join(planDir, 'execution-state.json');
  await fs.writeFile(
    executionStatePath,
    JSON.stringify(executionState, null, 2),
    'utf8'
  );

  return {
    success: true,
    orchestration,
    phases,
    phaseCount: phases.length,
    taskCount: phases.reduce((sum, p) => sum + p.tasks.length, 0)
  };
}

/**
 * Build orchestration.json from requirements and AI breakdown
 */
function buildOrchestration(requirements, breakdown) {
  const now = new Date().toISOString();

  // Extract requirement IDs for traceability
  const derivedFrom = requirements.requirements.map(r => r.id);

  // Build phase registry
  const phases = breakdown.phases.map((phase, index) => ({
    id: `phase-${index + 1}-${slugify(phase.name)}`,
    name: phase.name,
    file: `phases/phase-${index + 1}-${slugify(phase.name)}.json`,
    type: phase.type || 'sequential',
    dependencies: phase.dependencies || [],
    status: 'pending',
    estimatedTokens: phase.estimatedTokens || 5000,
    estimatedDuration: phase.estimatedDuration || '1h'
  }));

  return {
    metadata: {
      planId: requirements.plan_name,
      name: breakdown.implementation_goal || requirements.goal,
      description: `Implementation plan derived from ${requirements.requirements.length} requirements`,
      workType: requirements.metadata?.work_type || 'feature',
      planType: 'implementation',
      derivedFrom,
      created: requirements.created_at,
      modified: now,
      version: '1.0.0',
      status: 'pending'
    },
    phases,
    execution: {
      strategy: 'sequential',
      maxParallelPhases: 1,
      tokenBudget: {
        total: 150000,
        perPhase: 30000,
        warningThreshold: 10000
      },
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 5000
      }
    },
    progress: {
      completedPhases: 0,
      totalPhases: phases.length,
      currentPhases: [],
      lastUpdated: now,
      tokenUsage: {
        used: 0,
        remaining: 150000
      },
      totalTasks: breakdown.phases.reduce((sum, p) => sum + p.tasks.length, 0),
      completedTasks: 0
    }
  };
}

/**
 * Build phase files from AI breakdown
 */
function buildPhases(requirements, breakdown) {
  const now = new Date().toISOString();

  return breakdown.phases.map((phaseData, phaseIndex) => {
    const phaseId = `phase-${phaseIndex + 1}-${slugify(phaseData.name)}`;

    return {
      phase_id: phaseId,
      phase_name: phaseData.name,
      description: phaseData.description || '',
      dependencies: phaseData.dependencies || [],
      status: 'pending',
      created: now,
      modified: now,
      file: `phases/phase-${phaseIndex + 1}-${slugify(phaseData.name)}.json`,
      tasks: phaseData.tasks.map((task, taskIndex) => ({
        task_id: `task-${phaseIndex + 1}-${taskIndex + 1}`,
        description: task.description,
        details: task.details || '',
        status: 'pending',
        from_requirement: task.from_requirement || null,
        estimated_tokens: task.estimated_tokens || 2000,
        dependencies: task.dependencies || [],
        validation: task.validation || null,
        result: null
      }))
    };
  });
}

/**
 * Build execution-state.json
 */
function buildExecutionState(orchestration) {
  return {
    currentPhase: null,
    phaseStatuses: orchestration.phases.reduce((acc, phase) => {
      acc[phase.id] = 'pending';
      return acc;
    }, {}),
    taskStatuses: {},
    errors: [],
    startedAt: null,
    completedAt: null,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Slugify string for file names
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate that AI breakdown matches expected structure
 */
function validateBreakdown(breakdown) {
  if (!breakdown.phases || !Array.isArray(breakdown.phases)) {
    throw new Error('Breakdown must have phases array');
  }

  for (const phase of breakdown.phases) {
    if (!phase.name) {
      throw new Error('Each phase must have a name');
    }
    if (!phase.tasks || !Array.isArray(phase.tasks)) {
      throw new Error(`Phase ${phase.name} must have tasks array`);
    }

    for (const task of phase.tasks) {
      if (!task.description) {
        throw new Error(`All tasks in ${phase.name} must have description`);
      }
    }
  }

  return true;
}

module.exports = {
  transformRequirements,
  validateBreakdown
};
