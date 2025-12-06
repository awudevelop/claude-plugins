/**
 * Requirement Transformer (v2.0)
 *
 * Transforms conceptual requirements into executable implementation plans
 * with concrete tasks organized by phases (Database, API, UI, Testing, etc.)
 *
 * v2.0 Features:
 * - Preserves lean specs, confidence scores, verification steps
 * - Integrates confidence-detector for tasks without confidence
 * - Integrates spec-validator for validation
 */

const fs = require('fs').promises;
const path = require('path');
const { ConfidenceDetector } = require('./confidence-detector');
const { SpecValidator } = require('./spec-validator');

/**
 * Transform requirements.json into orchestration.json + phases/
 *
 * @param {string} plansDir - Absolute path to plans directory (.claude/plans)
 * @param {string} planName - Plan name
 * @param {object} breakdownData - AI-generated task breakdown from breakdown-requirement.md
 * @returns {Promise<object>} - Transformation result
 */
async function transformRequirements(plansDir, planName, breakdownData, options = {}) {
  const planDir = path.join(plansDir, planName);
  const requirementsPath = path.join(planDir, 'requirements.json');

  // Load requirements.json
  const requirementsData = await fs.readFile(requirementsPath, 'utf8');
  const requirements = JSON.parse(requirementsData);

  // Validate input
  if (requirements.plan_type !== 'conceptual') {
    throw new Error(`Plan must be conceptual type, got: ${requirements.plan_type}`);
  }

  // v2.0: Enrich tasks with confidence if not already present
  const enrichedBreakdown = await enrichWithConfidence(breakdownData, options);

  // v2.0: Validate specs and collect warnings
  const validationResult = await validateAllSpecs(enrichedBreakdown);

  // Build orchestration + phases from AI breakdown
  const orchestration = buildOrchestration(requirements, enrichedBreakdown);
  const phases = buildPhases(requirements, enrichedBreakdown);

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
    taskCount: phases.reduce((sum, p) => sum + p.tasks.length, 0),
    validation: validationResult
  };
}

/**
 * Enrich tasks with confidence scores if not present
 * @param {object} breakdown - AI-generated breakdown
 * @param {object} options - Options including docs for context
 * @returns {Promise<object>} - Enriched breakdown
 */
async function enrichWithConfidence(breakdown, options = {}) {
  const detector = new ConfidenceDetector({
    projectRoot: options.projectRoot || process.cwd(),
    docs: options.docs || []
  });

  // Calculate confidence summary
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let totalScore = 0;
  const lowConfidenceTasks = [];

  // Process each phase and task
  const enrichedPhases = await Promise.all(breakdown.phases.map(async (phase) => {
    const enrichedTasks = await Promise.all(phase.tasks.map(async (task) => {
      // If task already has confidence, use it
      if (task.confidence && task.confidence.score !== undefined) {
        const { level, score } = task.confidence;
        totalScore += score;
        if (level === 'high' || score >= 70) highCount++;
        else if (level === 'medium' || score >= 40) mediumCount++;
        else {
          lowCount++;
          lowConfidenceTasks.push({
            task_id: task.id || task.task_id,
            score: score,
            risks: task.confidence.risks || []
          });
        }
        return task;
      }

      // Calculate confidence using detector
      const analysis = await detector.analyze(task);
      totalScore += analysis.score;

      if (analysis.level === 'high') highCount++;
      else if (analysis.level === 'medium') mediumCount++;
      else {
        lowCount++;
        lowConfidenceTasks.push({
          task_id: task.id || task.task_id,
          score: analysis.score,
          risks: analysis.risks
        });
      }

      // Return task with confidence added
      return {
        ...task,
        confidence: {
          level: analysis.level,
          score: analysis.score,
          factors: analysis.factors,
          risks: analysis.risks,
          mitigations: analysis.mitigations
        }
      };
    }));

    return {
      ...phase,
      tasks: enrichedTasks
    };
  }));

  const totalTasks = breakdown.phases.reduce((sum, p) => sum + p.tasks.length, 0);

  return {
    ...breakdown,
    phases: enrichedPhases,
    confidence_summary: breakdown.confidence_summary || {
      total_tasks: totalTasks,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      average_score: totalTasks > 0 ? Math.round(totalScore / totalTasks) : 0,
      low_confidence_tasks: lowConfidenceTasks
    }
  };
}

/**
 * Validate all specs in breakdown
 * @param {object} breakdown - Enriched breakdown
 * @returns {Promise<object>} - Validation result
 */
async function validateAllSpecs(breakdown) {
  const validator = new SpecValidator();

  // Collect all tasks
  const allTasks = breakdown.phases.flatMap(phase =>
    phase.tasks.map(task => ({
      id: task.id || task.task_id,
      type: task.type,
      file: task.file,
      spec: task.spec
    }))
  );

  // Validate all tasks
  const result = await validator.validateAll(allTasks);

  return {
    valid: result.valid,
    totalErrors: result.totalErrors,
    totalWarnings: result.totalWarnings,
    tasksWithErrors: result.results.filter(r => !r.valid).map(r => r.taskId),
    tasksWithWarnings: result.results.filter(r => r.warnings.length > 0).map(r => r.taskId)
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
    },
    // v2.0: Confidence summary from AI breakdown
    confidence: breakdown.confidence_summary || {
      total_tasks: breakdown.phases.reduce((sum, p) => sum + p.tasks.length, 0),
      high: 0,
      medium: 0,
      low: 0,
      average_score: 50,
      low_confidence_tasks: []
    },
    // v2.0: Traceability metadata
    traceability: breakdown.traceability || {},
    suggestion_usage: breakdown.suggestion_usage || {
      used_as_is: [],
      adapted: [],
      skipped_existing: [],
      conflicts_resolved: []
    },
    // v2.0: Assumptions and risks from AI analysis
    assumptions: breakdown.assumptions || [],
    risks: breakdown.risks || []
  };
}

/**
 * Build phase files from AI breakdown (v2.0 - preserves all fields)
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
      tasks: phaseData.tasks.map((task, taskIndex) => {
        const taskId = task.id || `task-${phaseIndex + 1}-${taskIndex + 1}`;

        return {
          // Core identification
          task_id: taskId,
          type: task.type || 'custom',
          file: task.file || null,
          description: task.description,
          details: task.details || '',
          status: 'pending',

          // Traceability (v2.0)
          from_requirement: task.from_requirement || null,
          from_suggestion: task.from_suggestion || null,

          // Confidence scoring (v2.0)
          confidence: task.confidence || {
            level: 'medium',
            score: 50,
            factors: {
              has_example: false,
              known_pattern: true,
              domain_expertise: true,
              docs_available: false,
              project_convention: false
            },
            risks: [],
            mitigations: []
          },

          // Lean spec (v2.0) - type-specific task specification
          spec: task.spec || null,

          // Verification (v2.0) - what to check before implementing
          verification: task.verification || null,

          // Implementation decision (v2.0) - how to handle suggestion
          implementation_decision: task.implementation_decision || null,

          // Review requirements (v2.0)
          review: task.review || null,

          // Execution metadata
          estimated_tokens: task.estimated_tokens || 2000,
          depends_on: task.depends_on || task.dependencies || [],
          validation: task.validation || null,
          result: null
        };
      })
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
