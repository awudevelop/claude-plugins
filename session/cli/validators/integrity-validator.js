/**
 * @typedef {Object} IntegrityError
 * @property {string} type - Error type: 'error' or 'warning'
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {Object} [details] - Additional error details
 */

/**
 * @typedef {Object} IntegrityReport
 * @property {boolean} valid - Whether all checks passed
 * @property {Array<IntegrityError>} errors - List of errors
 * @property {Array<IntegrityError>} warnings - List of warnings
 */

/**
 * Validates task dependencies within a phase
 * @param {Object} phase - Phase object with tasks
 * @param {Array<Object>} allPhases - All phases for cross-phase validation
 * @returns {IntegrityReport} Validation report
 */
function validateTaskDependencies(phase, allPhases = []) {
  const errors = [];
  const warnings = [];

  if (!phase || !phase.tasks || !Array.isArray(phase.tasks)) {
    return {
      valid: true,
      errors,
      warnings
    };
  }

  // Build a map of all task IDs across all phases
  const allTaskIds = new Set();

  // Add tasks from current phase
  phase.tasks.forEach(task => {
    if (task.task_id) {
      allTaskIds.add(task.task_id);
    }
  });

  // Add tasks from other phases if provided
  allPhases.forEach(otherPhase => {
    if (otherPhase && otherPhase.tasks && Array.isArray(otherPhase.tasks)) {
      otherPhase.tasks.forEach(task => {
        if (task.task_id) {
          allTaskIds.add(task.task_id);
        }
      });
    }
  });

  // Check each task's dependencies
  phase.tasks.forEach(task => {
    if (!task.dependencies || !Array.isArray(task.dependencies)) {
      return;
    }

    task.dependencies.forEach(depId => {
      if (!allTaskIds.has(depId)) {
        errors.push({
          type: 'error',
          code: 'MISSING_TASK_DEPENDENCY',
          message: `Task '${task.task_id}' depends on non-existent task '${depId}'`,
          details: {
            taskId: task.task_id,
            missingDependency: depId
          }
        });
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates that orchestration phases match phase files
 * @param {Object} orchestration - Orchestration object
 * @param {Array<Object>} phaseFiles - Array of loaded phase objects
 * @returns {IntegrityReport} Validation report
 */
function validatePhaseReferences(orchestration, phaseFiles) {
  const errors = [];
  const warnings = [];

  if (!orchestration || !orchestration.phases || !Array.isArray(orchestration.phases)) {
    errors.push({
      type: 'error',
      code: 'INVALID_ORCHESTRATION',
      message: 'Orchestration is missing or has invalid phases array'
    });
    return { valid: false, errors, warnings };
  }

  // Create maps for comparison
  const orchPhaseIds = new Set();
  const orchPhaseFiles = new Map(); // id -> file path

  orchestration.phases.forEach(phase => {
    if (phase.id) {
      orchPhaseIds.add(phase.id);
      if (phase.file) {
        orchPhaseFiles.set(phase.id, phase.file);
      }
    }
  });

  const phaseFileIds = new Set();
  const phaseFileMap = new Map(); // id -> phase object

  phaseFiles.forEach(phase => {
    if (phase.phase_id) {
      phaseFileIds.add(phase.phase_id);
      phaseFileMap.set(phase.phase_id, phase);
    }
  });

  // Check for phases in orchestration missing from phase files
  orchPhaseIds.forEach(phaseId => {
    if (!phaseFileIds.has(phaseId)) {
      errors.push({
        type: 'error',
        code: 'MISSING_PHASE_FILE',
        message: `Phase '${phaseId}' referenced in orchestration but phase file not found`,
        details: {
          phaseId,
          expectedFile: orchPhaseFiles.get(phaseId)
        }
      });
    }
  });

  // Check for phase files not in orchestration
  phaseFileIds.forEach(phaseId => {
    if (!orchPhaseIds.has(phaseId)) {
      warnings.push({
        type: 'warning',
        code: 'ORPHANED_PHASE_FILE',
        message: `Phase file '${phaseId}' exists but not referenced in orchestration`,
        details: { phaseId }
      });
    }
  });

  // Validate phase names match
  orchPhaseIds.forEach(phaseId => {
    if (phaseFileIds.has(phaseId)) {
      const orchPhase = orchestration.phases.find(p => p.id === phaseId);
      const filePhase = phaseFileMap.get(phaseId);

      if (orchPhase && filePhase) {
        if (orchPhase.name !== filePhase.phase_name) {
          warnings.push({
            type: 'warning',
            code: 'PHASE_NAME_MISMATCH',
            message: `Phase '${phaseId}' has different names in orchestration and phase file`,
            details: {
              phaseId,
              orchestrationName: orchPhase.name,
              fileName: filePhase.phase_name
            }
          });
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Detects circular dependencies in tasks
 * @param {Array<Object>} tasks - Array of task objects
 * @returns {IntegrityReport} Validation report
 */
function detectCircularDependencies(tasks) {
  const errors = [];
  const warnings = [];

  if (!tasks || !Array.isArray(tasks)) {
    return { valid: true, errors, warnings };
  }

  // Build dependency graph
  const graph = new Map();
  tasks.forEach(task => {
    if (task.task_id) {
      graph.set(task.task_id, task.dependencies || []);
    }
  });

  // Check for cycles using DFS
  const visited = new Set();
  const recursionStack = new Set();
  const pathMap = new Map(); // Track paths for error reporting

  function hasCycle(taskId, path = []) {
    if (recursionStack.has(taskId)) {
      // Found a cycle - extract the cycle from the path
      const cycleStartIndex = path.indexOf(taskId);
      const cycle = [...path.slice(cycleStartIndex), taskId];

      errors.push({
        type: 'error',
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        details: {
          cycle,
          startTask: taskId
        }
      });
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    recursionStack.add(taskId);
    const newPath = [...path, taskId];

    const dependencies = graph.get(taskId) || [];
    for (const depId of dependencies) {
      if (hasCycle(depId, newPath)) {
        return true;
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  // Check all tasks
  for (const taskId of graph.keys()) {
    if (!visited.has(taskId)) {
      hasCycle(taskId);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Detects circular dependencies across all phases
 * @param {Array<Object>} phases - Array of phase objects
 * @returns {IntegrityReport} Validation report
 */
function detectCircularDependenciesAcrossPhases(phases) {
  const errors = [];
  const warnings = [];

  if (!phases || !Array.isArray(phases)) {
    return { valid: true, errors, warnings };
  }

  // Collect all tasks from all phases
  const allTasks = [];
  phases.forEach(phase => {
    if (phase.tasks && Array.isArray(phase.tasks)) {
      allTasks.push(...phase.tasks);
    }
  });

  return detectCircularDependencies(allTasks);
}

/**
 * Validates phase dependencies
 * @param {Object} orchestration - Orchestration object
 * @returns {IntegrityReport} Validation report
 */
function validatePhaseDependencies(orchestration) {
  const errors = [];
  const warnings = [];

  if (!orchestration || !orchestration.phases || !Array.isArray(orchestration.phases)) {
    return { valid: true, errors, warnings };
  }

  const phaseIds = new Set(
    orchestration.phases.map(p => p.id).filter(Boolean)
  );

  // Check each phase's dependencies
  orchestration.phases.forEach(phase => {
    if (!phase.dependencies || !Array.isArray(phase.dependencies)) {
      return;
    }

    phase.dependencies.forEach(depId => {
      if (!phaseIds.has(depId)) {
        errors.push({
          type: 'error',
          code: 'MISSING_PHASE_DEPENDENCY',
          message: `Phase '${phase.id}' depends on non-existent phase '${depId}'`,
          details: {
            phaseId: phase.id,
            missingDependency: depId
          }
        });
      }
    });
  });

  // Check for circular phase dependencies
  const graph = new Map();
  orchestration.phases.forEach(phase => {
    if (phase.id) {
      graph.set(phase.id, phase.dependencies || []);
    }
  });

  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(phaseId, path = []) {
    if (recursionStack.has(phaseId)) {
      const cycleStartIndex = path.indexOf(phaseId);
      const cycle = [...path.slice(cycleStartIndex), phaseId];

      errors.push({
        type: 'error',
        code: 'CIRCULAR_PHASE_DEPENDENCY',
        message: `Circular phase dependency detected: ${cycle.join(' -> ')}`,
        details: {
          cycle,
          startPhase: phaseId
        }
      });
      return true;
    }

    if (visited.has(phaseId)) {
      return false;
    }

    visited.add(phaseId);
    recursionStack.add(phaseId);

    const dependencies = graph.get(phaseId) || [];
    for (const depId of dependencies) {
      if (hasCycle(depId, [...path, phaseId])) {
        return true;
      }
    }

    recursionStack.delete(phaseId);
    return false;
  }

  for (const phaseId of graph.keys()) {
    if (!visited.has(phaseId)) {
      hasCycle(phaseId);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Formats an integrity report as a human-readable string
 * @param {IntegrityReport} report - Integrity report
 * @returns {string} Formatted report
 */
function formatIntegrityReport(report) {
  const lines = [];

  if (report.valid) {
    lines.push('✅ All integrity checks passed');
  } else {
    lines.push('❌ Integrity validation failed');
  }

  if (report.errors && report.errors.length > 0) {
    lines.push(`\nErrors (${report.errors.length}):`);
    report.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. [${error.code}] ${error.message}`);
      if (error.details) {
        lines.push(`     Details: ${JSON.stringify(error.details)}`);
      }
    });
  }

  if (report.warnings && report.warnings.length > 0) {
    lines.push(`\nWarnings (${report.warnings.length}):`);
    report.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. [${warning.code}] ${warning.message}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  validateTaskDependencies,
  validatePhaseReferences,
  detectCircularDependencies,
  detectCircularDependenciesAcrossPhases,
  validatePhaseDependencies,
  formatIntegrityReport
};
