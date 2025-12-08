const fs = require('fs').promises;
const path = require('path');

/**
 * Converts monolithic plan to orchestration.json + phase files structure
 */

/**
 * Generate a safe phase ID from phase name and index
 */
function generatePhaseId(phaseName, index) {
  const safeName = phaseName
    .toLowerCase()
    .replace(/^phase\s*\d+:\s*/i, '') // Remove "Phase 1:" prefix
    .replace(/[^a-z0-9]+/g, '-')      // Replace non-alphanumeric with dash
    .replace(/^-+|-+$/g, '')          // Trim dashes
    .substring(0, 30);                // Limit length

  return `phase-${index + 1}-${safeName}`;
}

/**
 * Estimate token count for a phase
 */
function estimatePhaseTokens(phase) {
  let tokens = 100; // Base overhead

  if (phase.description) {
    tokens += Math.ceil(phase.description.length / 4);
  }

  for (const task of phase.tasks) {
    tokens += 50; // Task overhead
    tokens += Math.ceil(task.description.length / 4);
    if (task.details) {
      tokens += Math.ceil(task.details.length / 4);
    }
  }

  return Math.ceil(tokens);
}

/**
 * Extract dependencies from task
 */
function extractTaskDependencies(task) {
  return task.dependencies || [];
}

/**
 * Derive phase status from task statuses
 */
function derivePhaseStatus(tasks) {
  if (!tasks || tasks.length === 0) return 'pending';

  const statuses = tasks.map(t => t.status);

  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.some(s => s === 'failed')) return 'failed';
  if (statuses.some(s => s === 'in_progress')) return 'in-progress';
  if (statuses.some(s => s === 'blocked')) return 'blocked';

  return 'pending';
}

/**
 * Derive overall plan status from phase statuses
 */
function derivePlanStatus(phases) {
  const statuses = phases.map(p => derivePhaseStatus(p.tasks));

  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.some(s => s === 'failed')) return 'failed';
  if (statuses.some(s => s === 'in-progress')) return 'in-progress';

  return 'pending';
}

/**
 * Extract phase dependencies (none by default, phases are sequential)
 */
function extractPhaseDependencies(phase, index, phases) {
  // Simple approach: each phase depends on previous phase
  // More sophisticated: analyze task dependencies across phases
  if (index === 0) return [];

  const prevPhaseId = generatePhaseId(phases[index - 1].phase_name, index - 1);
  return [prevPhaseId];
}

/**
 * Count total tasks across all phases
 */
function countTotalTasks(phases) {
  return phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
}

/**
 * Count completed tasks across all phases
 */
function countCompletedTasks(phases) {
  return phases.reduce((sum, phase) => {
    return sum + phase.tasks.filter(t => t.status === 'completed').length;
  }, 0);
}

/**
 * Main conversion function: monolithic plan → orchestration + phases
 */
function splitPlanIntoPhases(planData) {
  const planId = planData.plan_name;
  const timestamp = new Date().toISOString();

  // Create orchestration metadata
  const orchestration = {
    metadata: {
      planId: planId,
      name: planData.goal || planId,
      description: planData.conversation_summary || '',
      workType: planData.work_type || 'other',
      planType: planData.plan_type || 'conceptual', // Default to conceptual
      created: planData.created_at || timestamp,
      modified: planData.updated_at || timestamp,
      version: planData.version || '1.0.0',
      status: derivePlanStatus(planData.phases)
    },

    phases: planData.phases.map((phase, idx) => {
      const phaseId = generatePhaseId(phase.phase_name, idx);
      const estimatedTokens = estimatePhaseTokens(phase);

      return {
        id: phaseId,
        name: phase.phase_name,
        file: `phases/${phaseId}.json`,
        type: 'sequential', // Default to sequential, can be optimized later
        dependencies: extractPhaseDependencies(phase, idx, planData.phases),
        status: derivePhaseStatus(phase.tasks),
        estimatedTokens: estimatedTokens,
        estimatedDuration: phase.estimated_duration || `${Math.ceil(estimatedTokens / 100)}m`
      };
    }),

    execution: {
      strategy: 'sequential', // Start with sequential, upgrade to parallel later
      maxParallelPhases: 1,
      tokenBudget: {
        total: 15000,
        perPhase: 5000,
        warningThreshold: 12000
      },
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 5000
      }
    },

    progress: {
      completedPhases: planData.phases.filter(p =>
        derivePhaseStatus(p.tasks) === 'completed'
      ).length,
      totalPhases: planData.phases.length,
      currentPhases: planData.phases
        .map((p, idx) => ({
          id: generatePhaseId(p.phase_name, idx),
          status: derivePhaseStatus(p.tasks)
        }))
        .filter(p => p.status === 'in-progress')
        .map(p => p.id),
      lastUpdated: timestamp,
      tokenUsage: {
        used: planData.progress?.token_usage || 0,
        remaining: 15000 - (planData.progress?.token_usage || 0)
      },
      totalTasks: countTotalTasks(planData.phases),
      completedTasks: countCompletedTasks(planData.phases)
    }
  };

  // Create phase files
  const phaseFiles = planData.phases.map((phase, idx) => {
    const phaseId = generatePhaseId(phase.phase_name, idx);

    return {
      phase: {
        id: phaseId,
        name: phase.phase_name,
        description: phase.description || '',
        type: 'implementation', // Default type
        priority: 'medium'
      },

      configuration: {
        agent: {
          model: 'claude-3-sonnet',
          temperature: 0.3,
          maxTokens: 4000
        },
        tools: ['file-editor', 'terminal'],
        environment: {},
        workingDirectory: process.cwd()
      },

      tasks: phase.tasks.map(task => ({
        task_id: task.task_id,
        name: task.description.substring(0, 100), // First 100 chars as name
        description: task.description,
        details: task.details || '',
        type: task.type || 'code',
        status: task.status,
        dependencies: extractTaskDependencies(task),
        estimatedEffort: task.estimated_effort || '1h',
        estimatedTokens: task.estimated_tokens || Math.ceil(task.description.length / 4),
        technical_notes: task.technical_notes || [],
        output: task.output || {
          files: [],
          logs: [],
          artifacts: {}
        }
      })),

      context: phase.context || [],

      metrics: {
        estimatedDuration: phase.estimated_duration || '1h',
        estimatedTokens: estimatePhaseTokens(phase),
        actualTokens: 0,
        successRate: 0
      }
    };
  });

  return { orchestration, phaseFiles };
}

/**
 * Reconstruct monolithic plan from orchestration + phase files
 * (For backward compatibility or export)
 */
function mergePhasesIntoPlan(orchestration, phaseFiles) {
  const plan = {
    plan_name: orchestration.metadata.planId,
    work_type: orchestration.metadata.workType,
    goal: orchestration.metadata.name,
    conversation_summary: orchestration.metadata.description,
    created_at: orchestration.metadata.created,
    updated_at: orchestration.metadata.modified,
    version: orchestration.metadata.version,
    // v2.0 fix: Include status from orchestration metadata
    status: orchestration.metadata.status,
    // v2.0 fix: Include full metadata for fallback access
    metadata: orchestration.metadata,
    // v2.0 fix: Include confidence summary from orchestration
    confidence: orchestration.confidence,

    phases: phaseFiles.map((phaseFile, idx) => {
      const phaseMeta = orchestration.phases[idx];

      return {
        phase_name: phaseFile.phase_name,  // Use top-level phase_name
        description: phaseFile.description,  // Use top-level description
        // v2.0 fix: Use orchestration phase status (more up-to-date than phase file)
        status: phaseMeta?.status || phaseFile.status || 'pending',
        tasks: phaseFile.tasks.map(task => ({
          // Core task fields
          task_id: task.task_id,
          description: task.description,
          details: task.details,
          status: task.status,
          dependencies: task.dependencies || task.depends_on,
          estimated_effort: task.estimatedEffort || task.estimated_tokens,
          technical_notes: task.technical_notes,
          // v2.0 fields - CRITICAL: preserve all lean spec fields
          type: task.type,
          file: task.file,
          spec: task.spec,
          confidence: task.confidence,
          from_requirement: task.from_requirement,
          from_suggestion: task.from_suggestion,
          verification: task.verification,
          implementation_decision: task.implementation_decision,
          review: task.review,
          result: task.result
        })),
        context: phaseFile.context
      };
    }),

    progress: {
      total_tasks: orchestration.progress.totalTasks,
      completed: orchestration.progress.completedTasks,
      in_progress: orchestration.progress.currentPhases.length,
      pending: orchestration.progress.totalTasks - orchestration.progress.completedTasks,
      blocked: 0
    }
  };

  return plan;
}

module.exports = {
  splitPlanIntoPhases,
  mergePhasesIntoPlan,
  generatePhaseId,
  estimatePhaseTokens,
  derivePhaseStatus,
  derivePlanStatus
};
