const { createMetadataUpdate, createPhaseUpdate, createTaskUpdate } = require('../models/update-operations');

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing succeeded
 * @property {Array<Object>} operations - Parsed update operations
 * @property {Array<string>} warnings - Parsing warnings
 * @property {string} [error] - Error message if parsing failed
 * @property {Object} [parsed] - Raw parsed data for debugging
 */

/**
 * @typedef {Object} PlanContext
 * @property {string} planId - Plan ID
 * @property {Array<Object>} phases - Array of phase objects with id, name
 * @property {Object} tasksByPhase - Map of phaseId to array of tasks
 * @property {Object} metadata - Plan metadata
 */

/**
 * Operation type patterns
 */
const OPERATION_PATTERNS = {
  add: [
    /\b(add|create|insert|new|include)\b/i,
    /\badd(?:ing)?\s+(?:a\s+)?(?:new\s+)?/i
  ],
  delete: [
    /\b(delete|remove|drop|eliminate|get rid of)\b/i,
    /\bremov(?:e|ing)\b/i
  ],
  update: [
    /\b(update|change|modify|edit|rename|set|alter)\b/i,
    /\bchang(?:e|ing)\b/i
  ],
  reorder: [
    /\b(reorder|move|rearrange|shift|swap)\b/i,
    /\bmov(?:e|ing)\b/i
  ]
};

/**
 * Target type patterns
 */
const TARGET_PATTERNS = {
  phase: [
    /\bphase\b/i,
    /\bstage\b/i,
    /\bstep\b/i
  ],
  task: [
    /\btask\b/i,
    /\bitem\b/i,
    /\btodo\b/i,
    /\bwork item\b/i
  ],
  metadata: [
    /\bplan\s+(name|title|description|status)\b/i,
    /\b(rename|retitle)\s+(?:the\s+)?plan\b/i,
    /\bplan\s+metadata\b/i
  ]
};

/**
 * Force flag patterns
 */
const FORCE_PATTERNS = [
  /\b(force|forced|forcefully)\b/i,
  /\beven if completed\b/i,
  /\boverride\b/i,
  /\banyway\b/i,
  /--force\b/i,
  /-f\b/
];

/**
 * Parses a natural language update request into structured operations
 * @param {string} nlInput - Natural language input describing the update
 * @param {PlanContext} planContext - Context about the plan being updated
 * @returns {ParseResult} Parse result with operations
 */
function parseUpdateRequest(nlInput, planContext) {
  const result = {
    success: false,
    operations: [],
    warnings: [],
    parsed: {
      operationType: null,
      targetType: null,
      targetId: null,
      targetMatch: null,
      changes: {},
      flags: {}
    }
  };

  if (!nlInput || typeof nlInput !== 'string') {
    result.error = 'Input must be a non-empty string';
    return result;
  }

  if (!planContext || !planContext.planId) {
    result.error = 'Plan context with planId is required';
    return result;
  }

  const input = nlInput.trim();

  try {
    // Step 1: Detect force flag
    result.parsed.flags.force = detectForceFlag(input);

    // Step 2: Detect operation type
    result.parsed.operationType = detectOperationType(input);
    if (!result.parsed.operationType) {
      result.error = 'Could not determine operation type. Use words like: add, remove, update, change, modify, delete';
      return result;
    }

    // Step 3: Detect target type
    result.parsed.targetType = detectTargetType(input);
    if (!result.parsed.targetType) {
      result.error = 'Could not determine target type. Specify: phase, task, or plan metadata';
      return result;
    }

    // Step 4: Resolve target (find matching phase/task)
    const targetResolution = resolveTarget(input, result.parsed.targetType, planContext);
    result.parsed.targetId = targetResolution.id;
    result.parsed.targetMatch = targetResolution.match;

    if (targetResolution.warning) {
      result.warnings.push(targetResolution.warning);
    }

    if (targetResolution.ambiguous) {
      result.warnings.push(`Multiple matches found. Using: ${targetResolution.match}`);
    }

    // Step 5: Extract changes/updates
    result.parsed.changes = extractChanges(input, result.parsed.targetType, result.parsed.operationType);

    // Step 6: Build operations
    const operations = buildOperations(result.parsed, planContext);
    result.operations = operations;

    // Validate we have operations
    if (operations.length === 0) {
      result.error = 'Could not generate any valid operations from the input';
      return result;
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = `Parse error: ${error.message}`;
    return result;
  }
}

/**
 * Detects if the force flag is present in the input
 * @param {string} input - Natural language input
 * @returns {boolean} True if force flag detected
 */
function detectForceFlag(input) {
  return FORCE_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Detects the operation type from the input
 * @param {string} input - Natural language input
 * @returns {string|null} Operation type or null
 */
function detectOperationType(input) {
  for (const [type, patterns] of Object.entries(OPERATION_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(input))) {
      return type;
    }
  }
  return null;
}

/**
 * Detects the target type from the input
 * @param {string} input - Natural language input
 * @returns {string|null} Target type or null
 */
function detectTargetType(input) {
  // Check metadata first (more specific)
  if (TARGET_PATTERNS.metadata.some(pattern => pattern.test(input))) {
    return 'metadata';
  }

  // Check for task first - "add task to phase" should be task, not phase
  // Task patterns with context clues take priority
  const taskPriority = /\b(add|create|remove|delete|update|modify)\s+(?:a\s+)?(?:new\s+)?task\b/i;
  if (taskPriority.test(input) || TARGET_PATTERNS.task.some(pattern => pattern.test(input))) {
    // But not if it's "to phase X" without a task reference
    const hasTaskRef = TARGET_PATTERNS.task.some(pattern => pattern.test(input));
    const hasPhaseRef = TARGET_PATTERNS.phase.some(pattern => pattern.test(input));

    // If both are mentioned, determine primary target based on context
    if (hasTaskRef && hasPhaseRef) {
      // "add task to phase" = task operation
      // "add phase with tasks" = phase operation
      if (/\btask\b.*\bto\s+(?:the\s+)?phase\b/i.test(input)) {
        return 'task';
      }
      if (/\bphase\b.*\bwith\s+(?:the\s+)?tasks?\b/i.test(input)) {
        return 'phase';
      }
      // Default: if "task" appears before "phase", it's a task operation
      const taskPos = input.toLowerCase().indexOf('task');
      const phasePos = input.toLowerCase().indexOf('phase');
      return taskPos < phasePos ? 'task' : 'phase';
    }

    if (hasTaskRef) return 'task';
  }

  // Check for phase
  if (TARGET_PATTERNS.phase.some(pattern => pattern.test(input))) {
    return 'phase';
  }

  return null;
}

/**
 * Resolves the target to a specific ID
 * @param {string} input - Natural language input
 * @param {string} targetType - Type of target (phase/task)
 * @param {PlanContext} planContext - Plan context
 * @returns {Object} Resolution result with id, match, warning, ambiguous
 */
function resolveTarget(input, targetType, planContext) {
  const resolution = {
    id: null,
    match: null,
    warning: null,
    ambiguous: false
  };

  // For add operations, we don't need to resolve an existing target
  if (detectOperationType(input) === 'add') {
    // Try to extract target phase for task additions
    if (targetType === 'task') {
      const phaseMatch = findPhaseReference(input, planContext);
      if (phaseMatch) {
        resolution.id = phaseMatch.id;
        resolution.match = phaseMatch.name;
      } else {
        resolution.warning = 'No target phase specified for new task';
      }
    }
    return resolution;
  }

  // Extract ID if explicitly mentioned
  const explicitId = extractExplicitId(input, targetType);
  if (explicitId) {
    resolution.id = explicitId;
    resolution.match = explicitId;
    return resolution;
  }

  // Try to match by name/description
  if (targetType === 'phase') {
    const matches = findPhaseByDescription(input, planContext);
    if (matches.length === 1) {
      resolution.id = matches[0].id;
      resolution.match = matches[0].name;
    } else if (matches.length > 1) {
      resolution.id = matches[0].id;
      resolution.match = matches[0].name;
      resolution.ambiguous = true;
    } else {
      resolution.warning = 'Could not identify which phase to update';
    }
  } else if (targetType === 'task') {
    const matches = findTaskByDescription(input, planContext);
    if (matches.length === 1) {
      resolution.id = matches[0].task_id;
      resolution.match = matches[0].description;
      resolution.phaseId = matches[0].phaseId;
    } else if (matches.length > 1) {
      resolution.id = matches[0].task_id;
      resolution.match = matches[0].description;
      resolution.phaseId = matches[0].phaseId;
      resolution.ambiguous = true;
    } else {
      resolution.warning = 'Could not identify which task to update';
    }
  }

  return resolution;
}

/**
 * Extracts an explicit ID from the input
 * @param {string} input - Natural language input
 * @param {string} targetType - Target type
 * @returns {string|null} Extracted ID or null
 */
function extractExplicitId(input, targetType) {
  // Match patterns like "phase-1", "task-2-3", "phase-1-foundation"
  const patterns = {
    phase: /\bphase[-_](\d+[-\w]*)\b/i,
    task: /\btask[-_](\d+[-\d]*[-\w]*)\b/i
  };

  const pattern = patterns[targetType];
  if (pattern) {
    const match = input.match(pattern);
    if (match) {
      return `${targetType}-${match[1]}`;
    }
  }

  // Also try to match quoted IDs
  const quotedMatch = input.match(/["']([^"']+)["']/);
  if (quotedMatch && quotedMatch[1].startsWith(targetType)) {
    return quotedMatch[1];
  }

  return null;
}

/**
 * Finds a phase reference in the input
 * @param {string} input - Natural language input
 * @param {PlanContext} planContext - Plan context
 * @returns {Object|null} Phase match or null
 */
function findPhaseReference(input, planContext) {
  if (!planContext.phases) return null;

  // Try explicit ID first
  const explicitId = extractExplicitId(input, 'phase');
  if (explicitId) {
    const phase = planContext.phases.find(p => p.id === explicitId);
    if (phase) return phase;
  }

  // Try matching "to phase X" or "in phase X"
  const toPhaseMatch = input.match(/(?:to|in|into)\s+(?:the\s+)?(?:phase\s+)?["']?([^"'\n,]+)["']?/i);
  if (toPhaseMatch) {
    const searchTerm = toPhaseMatch[1].toLowerCase().trim();
    const matches = planContext.phases.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.id.toLowerCase().includes(searchTerm)
    );
    if (matches.length > 0) return matches[0];
  }

  return null;
}

/**
 * Finds phases matching a description
 * @param {string} input - Natural language input
 * @param {PlanContext} planContext - Plan context
 * @returns {Array<Object>} Matching phases
 */
function findPhaseByDescription(input, planContext) {
  if (!planContext.phases) return [];

  const inputLower = input.toLowerCase();
  const matches = [];

  for (const phase of planContext.phases) {
    // Check if phase name or ID appears in input
    if (inputLower.includes(phase.name.toLowerCase()) ||
        inputLower.includes(phase.id.toLowerCase())) {
      matches.push(phase);
    }
  }

  // If no exact matches, try fuzzy matching
  if (matches.length === 0) {
    const words = inputLower.split(/\s+/);
    for (const phase of planContext.phases) {
      const phaseName = phase.name.toLowerCase();
      const matchingWords = words.filter(w => w.length > 3 && phaseName.includes(w));
      if (matchingWords.length >= 2) {
        matches.push(phase);
      }
    }
  }

  return matches;
}

/**
 * Finds tasks matching a description
 * @param {string} input - Natural language input
 * @param {PlanContext} planContext - Plan context
 * @returns {Array<Object>} Matching tasks with phaseId
 */
function findTaskByDescription(input, planContext) {
  if (!planContext.tasksByPhase) return [];

  const inputLower = input.toLowerCase();
  const matches = [];

  for (const [phaseId, tasks] of Object.entries(planContext.tasksByPhase)) {
    for (const task of tasks) {
      // Check if task ID or description appears in input
      if (inputLower.includes(task.task_id.toLowerCase()) ||
          inputLower.includes(task.description.toLowerCase())) {
        matches.push({ ...task, phaseId });
      }
    }
  }

  // Fuzzy matching if no exact matches
  if (matches.length === 0) {
    const words = inputLower.split(/\s+/).filter(w => w.length > 3);
    for (const [phaseId, tasks] of Object.entries(planContext.tasksByPhase)) {
      for (const task of tasks) {
        const taskDesc = task.description.toLowerCase();
        const matchingWords = words.filter(w => taskDesc.includes(w));
        if (matchingWords.length >= 2) {
          matches.push({ ...task, phaseId });
        }
      }
    }
  }

  return matches;
}

/**
 * Extracts changes/updates from the input
 * @param {string} input - Natural language input
 * @param {string} targetType - Target type
 * @param {string} operationType - Operation type
 * @returns {Object} Extracted changes
 */
function extractChanges(input, targetType, operationType) {
  const changes = {};

  // For add operations, extract description
  if (operationType === 'add') {
    const descMatch = input.match(/(?:called|named|titled|description|with\s+(?:the\s+)?(?:name|title|description))\s*["']?([^"'\n]+)["']?/i);
    if (descMatch) {
      if (targetType === 'task') {
        changes.description = descMatch[1].trim();
      } else if (targetType === 'phase') {
        changes.name = descMatch[1].trim();
      }
    } else {
      // Try to extract from "add X task/phase" pattern
      const simpleMatch = input.match(/(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?["']?([^"'\n]+?)["']?\s+(?:task|phase)/i);
      if (simpleMatch) {
        const extracted = simpleMatch[1].trim();
        if (targetType === 'task') {
          changes.description = extracted;
        } else if (targetType === 'phase') {
          changes.name = extracted;
        }
      }
    }

    // Extract details if provided
    const detailsMatch = input.match(/(?:with\s+details?|details?:)\s*["']?([^"'\n]+)["']?/i);
    if (detailsMatch) {
      changes.details = detailsMatch[1].trim();
    }
  }

  // For update operations, extract field changes
  if (operationType === 'update') {
    // Name/description changes - multiple patterns
    const renamePatterns = [
      /(?:rename|retitle)\s+(?:the\s+)?(?:\w+\s+)?(?:to|as)\s+["']([^"'\n]+)["']/i,
      /(?:change|update)\s+(?:the\s+)?(?:name|title)\s+(?:to|as)\s+["']([^"'\n]+)["']/i,
      /(?:rename|retitle)\s+(?:to|as)\s+["']([^"'\n]+)["']/i,
      /\bto\s+["']([^"'\n]+)["']\s*$/i
    ];

    for (const pattern of renamePatterns) {
      const renameMatch = input.match(pattern);
      if (renameMatch) {
        if (targetType === 'task') {
          changes.description = renameMatch[1].trim();
        } else {
          changes.name = renameMatch[1].trim();
        }
        break;
      }
    }

    // Status changes
    const statusMatch = input.match(/(?:set\s+)?status\s+(?:to\s+)?["']?(pending|in_progress|completed|failed)["']?/i);
    if (statusMatch) {
      changes.status = statusMatch[1].toLowerCase();
    }

    // Mark as complete
    if (/mark(?:ed)?\s+(?:as\s+)?complete[d]?/i.test(input)) {
      changes.status = 'completed';
    }

    // Change description/details
    const descMatch = input.match(/(?:change|update|set)\s+(?:the\s+)?description\s+(?:to\s+)?["']([^"'\n]+)["']/i);
    if (descMatch) {
      if (targetType === 'task') {
        changes.description = descMatch[1].trim();
      } else {
        changes.description = descMatch[1].trim();
      }
    }
  }

  return changes;
}

/**
 * Builds update operations from parsed data
 * @param {Object} parsed - Parsed data
 * @param {PlanContext} planContext - Plan context
 * @returns {Array<Object>} Update operations
 */
function buildOperations(parsed, planContext) {
  const operations = [];
  const { operationType, targetType, targetId, changes, flags } = parsed;

  // Map reorder to update for now
  const type = operationType === 'reorder' ? 'update' : operationType;

  if (targetType === 'metadata') {
    if (type === 'update' && Object.keys(changes).length > 0) {
      operations.push(createMetadataUpdate(planContext.planId, changes));
    }
  } else if (targetType === 'phase') {
    const data = {
      ...changes,
      force: flags.force
    };

    if (type !== 'add' && targetId) {
      data.id = targetId;
    }

    operations.push(createPhaseUpdate(planContext.planId, type, data));
  } else if (targetType === 'task') {
    const data = {
      ...changes,
      force: flags.force
    };

    if (type !== 'add' && targetId) {
      data.id = targetId;
    }

    // Add phaseId
    if (parsed.targetMatch && parsed.targetMatch.phaseId) {
      data.phaseId = parsed.targetMatch.phaseId;
    } else if (targetId && planContext.tasksByPhase) {
      // Find the phase containing this task
      for (const [phaseId, tasks] of Object.entries(planContext.tasksByPhase)) {
        if (tasks.some(t => t.task_id === targetId)) {
          data.phaseId = phaseId;
          break;
        }
      }
    }

    // For add operations, use resolved phase if available
    if (type === 'add' && !data.phaseId && parsed.targetId) {
      data.phaseId = parsed.targetId;
    }

    operations.push(createTaskUpdate(planContext.planId, type, data));
  }

  return operations;
}

/**
 * Parses multiple update requests (one per line or semicolon-separated)
 * @param {string} nlInput - Natural language input with multiple requests
 * @param {PlanContext} planContext - Plan context
 * @returns {ParseResult} Combined parse result
 */
function parseMultipleRequests(nlInput, planContext) {
  // Split by newlines or semicolons
  const requests = nlInput
    .split(/[;\n]/)
    .map(r => r.trim())
    .filter(r => r.length > 0);

  const result = {
    success: true,
    operations: [],
    warnings: []
  };

  for (const request of requests) {
    const parsed = parseUpdateRequest(request, planContext);

    if (parsed.success) {
      result.operations.push(...parsed.operations);
      result.warnings.push(...parsed.warnings);
    } else {
      result.warnings.push(`Failed to parse: "${request}" - ${parsed.error}`);
    }
  }

  if (result.operations.length === 0) {
    result.success = false;
    result.error = 'No valid operations could be parsed';
  }

  return result;
}

/**
 * Generates a natural language description of an operation
 * @param {Object} operation - Update operation
 * @returns {string} Human-readable description
 */
function describeOperation(operation) {
  const { type, target, data } = operation;

  const typeVerbs = {
    add: 'Add',
    update: 'Update',
    delete: 'Delete'
  };

  const verb = typeVerbs[type] || type;

  if (target === 'metadata') {
    const fields = Object.keys(data).filter(k => k !== 'force');
    return `${verb} plan ${fields.join(', ')}`;
  }

  if (target === 'phase') {
    const name = data.name || data.id || 'phase';
    return `${verb} phase "${name}"`;
  }

  if (target === 'task') {
    const desc = data.description || data.id || 'task';
    return `${verb} task "${desc}" in phase ${data.phaseId || 'unknown'}`;
  }

  return `${verb} ${target}`;
}

module.exports = {
  parseUpdateRequest,
  parseMultipleRequests,
  describeOperation,
  detectOperationType,
  detectTargetType,
  detectForceFlag,
  resolveTarget,
  extractChanges,
  findPhaseByDescription,
  findTaskByDescription
};
