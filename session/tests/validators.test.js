/**
 * Unit tests for validators
 * Covers: schema-validator.js, integrity-validator.js, update-validator.js
 */

const path = require('path');

// Modules under test
const {
  validateAgainstSchema,
  validateOrchestration,
  validatePhase,
  formatValidationErrors
} = require('../cli/validators/schema-validator');

const {
  validateTaskDependencies,
  validatePhaseReferences,
  detectCircularDependencies,
  detectCircularDependenciesAcrossPhases,
  validatePhaseDependencies,
  formatIntegrityReport
} = require('../cli/validators/integrity-validator');

const {
  canDeletePhase,
  canDeleteTask,
  validateUpdateDuringExecution,
  validateStatusTransition
} = require('../cli/validators/update-validator');

// Test fixtures
const createValidOrchestration = () => ({
  metadata: {
    planId: 'test-plan',
    name: 'Test Plan for Validation Testing',
    description: 'A test plan',
    workType: 'feature',
    planType: 'implementation',
    derivedFrom: ['req-1'],
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-01T00:00:00.000Z',
    version: '1.0.0',
    status: 'pending'
  },
  phases: [
    {
      id: 'phase-1-foundation',
      name: 'Foundation Phase',
      file: 'phases/phase-1-foundation.json',
      type: 'sequential',
      dependencies: [],
      status: 'pending',
      estimatedTokens: 5000,
      estimatedDuration: '1h'
    },
    {
      id: 'phase-2-implementation',
      name: 'Implementation Phase',
      file: 'phases/phase-2-implementation.json',
      type: 'sequential',
      dependencies: ['phase-1-foundation'],
      status: 'pending',
      estimatedTokens: 10000,
      estimatedDuration: '2h'
    }
  ],
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
    totalPhases: 2,
    currentPhases: [],
    lastUpdated: '2025-01-01T00:00:00.000Z',
    tokenUsage: {
      used: 0,
      remaining: 150000
    },
    totalTasks: 0,
    completedTasks: 0
  }
});

const createPhaseWithTasks = (phaseId) => ({
  phase_id: phaseId,
  phase_name: 'Test Phase',
  description: 'A test phase',
  dependencies: [],
  status: 'pending',
  created: '2025-01-01T00:00:00.000Z',
  modified: '2025-01-01T00:00:00.000Z',
  file: `phases/${phaseId}.json`,
  tasks: [
    {
      task_id: 'task-1',
      description: 'First task',
      details: 'Details',
      status: 'pending',
      dependencies: []
    },
    {
      task_id: 'task-2',
      description: 'Second task',
      details: 'Details',
      status: 'pending',
      dependencies: ['task-1']
    },
    {
      task_id: 'task-3',
      description: 'Third task',
      details: 'Details',
      status: 'pending',
      dependencies: ['task-2']
    }
  ]
});

const createExecutionState = () => ({
  currentPhase: null,
  phaseStatuses: {},
  taskStatuses: {},
  errors: [],
  startedAt: null,
  completedAt: null,
  lastUpdated: '2025-01-01T00:00:00.000Z'
});

describe('Schema Validator', () => {
  describe('validateAgainstSchema', () => {
    test('should validate object type', () => {
      const schema = { type: 'object' };
      const result = validateAgainstSchema({}, schema);
      expect(result.valid).toBe(true);
    });

    test('should reject wrong type', () => {
      const schema = { type: 'object' };
      const result = validateAgainstSchema('string', schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
    });

    test('should validate required fields', () => {
      const schema = {
        type: 'object',
        required: ['name', 'id'],
        properties: {
          name: { type: 'string' },
          id: { type: 'string' }
        }
      };

      const result = validateAgainstSchema({ name: 'Test' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(result.errors[0].field).toBe('id');
    });

    test('should validate string constraints', () => {
      const schema = {
        type: 'string',
        minLength: 5,
        maxLength: 10
      };

      expect(validateAgainstSchema('abc', schema).valid).toBe(false);
      expect(validateAgainstSchema('valid', schema).valid).toBe(true);
      expect(validateAgainstSchema('toolongstring', schema).valid).toBe(false);
    });

    test('should validate enum values', () => {
      const schema = {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed']
      };

      expect(validateAgainstSchema('pending', schema).valid).toBe(true);
      expect(validateAgainstSchema('invalid', schema).valid).toBe(false);
    });

    test('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };

      expect(validateAgainstSchema(['a', 'b', 'c'], schema).valid).toBe(true);
      expect(validateAgainstSchema(['a', 1, 'c'], schema).valid).toBe(false);
    });

    test('should validate array length constraints', () => {
      const schema = {
        type: 'array',
        minItems: 1,
        maxItems: 3
      };

      expect(validateAgainstSchema([], schema).valid).toBe(false);
      expect(validateAgainstSchema(['a', 'b'], schema).valid).toBe(true);
      expect(validateAgainstSchema(['a', 'b', 'c', 'd'], schema).valid).toBe(false);
    });

    test('should validate number constraints', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      expect(validateAgainstSchema(-1, schema).valid).toBe(false);
      expect(validateAgainstSchema(50, schema).valid).toBe(true);
      expect(validateAgainstSchema(101, schema).valid).toBe(false);
    });

    test('should validate integer type', () => {
      const schema = { type: 'integer' };

      expect(validateAgainstSchema(5, schema).valid).toBe(true);
      expect(validateAgainstSchema(5.5, schema).valid).toBe(false);
    });

    test('should validate nested properties', () => {
      const schema = {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 3 }
            }
          }
        }
      };

      const validData = { metadata: { name: 'Valid Name' } };
      const invalidData = { metadata: { name: 'AB' } };

      expect(validateAgainstSchema(validData, schema).valid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).valid).toBe(false);
    });

    test('should validate pattern matching', () => {
      const schema = {
        type: 'string',
        pattern: '^phase-[0-9]+-[a-z-]+$'
      };

      expect(validateAgainstSchema('phase-1-foundation', schema).valid).toBe(true);
      expect(validateAgainstSchema('invalid-format', schema).valid).toBe(false);
    });
  });

  describe('validateOrchestration', () => {
    test('should validate a correct orchestration', async () => {
      const orchestration = createValidOrchestration();
      const result = await validateOrchestration(orchestration);
      expect(result.valid).toBe(true);
    });

    test('should reject orchestration missing required fields', async () => {
      const invalidOrchestration = {
        metadata: { planId: 'test' }
        // Missing phases, execution, progress
      };
      const result = await validateOrchestration(invalidOrchestration);
      expect(result.valid).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    test('should format no errors', () => {
      const result = formatValidationErrors([]);
      expect(result).toBe('No errors');
    });

    test('should format multiple errors', () => {
      const errors = [
        { field: 'name', message: 'Required field is missing', code: 'REQUIRED_FIELD_MISSING' },
        { field: 'status', message: 'Invalid value', code: 'INVALID_ENUM_VALUE' }
      ];
      const result = formatValidationErrors(errors);
      expect(result).toContain('Validation errors:');
      expect(result).toContain('[name]');
      expect(result).toContain('[status]');
    });
  });
});

describe('Integrity Validator', () => {
  describe('validateTaskDependencies', () => {
    test('should validate valid task dependencies', () => {
      const phase = createPhaseWithTasks('phase-1');
      const result = validateTaskDependencies(phase);
      expect(result.valid).toBe(true);
    });

    test('should detect missing task dependencies', () => {
      const phase = {
        tasks: [
          { task_id: 'task-1', dependencies: [] },
          { task_id: 'task-2', dependencies: ['non-existent-task'] }
        ]
      };
      const result = validateTaskDependencies(phase);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_TASK_DEPENDENCY');
    });

    test('should handle empty phase', () => {
      const result = validateTaskDependencies({});
      expect(result.valid).toBe(true);
    });

    test('should validate cross-phase dependencies', () => {
      const currentPhase = {
        tasks: [
          { task_id: 'task-a', dependencies: ['task-from-other-phase'] }
        ]
      };
      const otherPhases = [
        {
          tasks: [
            { task_id: 'task-from-other-phase', dependencies: [] }
          ]
        }
      ];
      const result = validateTaskDependencies(currentPhase, otherPhases);
      expect(result.valid).toBe(true);
    });
  });

  describe('detectCircularDependencies', () => {
    test('should pass with no circular dependencies', () => {
      const tasks = [
        { task_id: 'task-1', dependencies: [] },
        { task_id: 'task-2', dependencies: ['task-1'] },
        { task_id: 'task-3', dependencies: ['task-2'] }
      ];
      const result = detectCircularDependencies(tasks);
      expect(result.valid).toBe(true);
    });

    test('should detect simple circular dependency', () => {
      const tasks = [
        { task_id: 'task-1', dependencies: ['task-2'] },
        { task_id: 'task-2', dependencies: ['task-1'] }
      ];
      const result = detectCircularDependencies(tasks);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('CIRCULAR_DEPENDENCY');
    });

    test('should detect complex circular dependency', () => {
      const tasks = [
        { task_id: 'task-1', dependencies: ['task-3'] },
        { task_id: 'task-2', dependencies: ['task-1'] },
        { task_id: 'task-3', dependencies: ['task-2'] }
      ];
      const result = detectCircularDependencies(tasks);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('CIRCULAR_DEPENDENCY');
    });

    test('should detect self-referential dependency', () => {
      const tasks = [
        { task_id: 'task-1', dependencies: ['task-1'] }
      ];
      const result = detectCircularDependencies(tasks);
      expect(result.valid).toBe(false);
    });

    test('should handle empty array', () => {
      const result = detectCircularDependencies([]);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePhaseDependencies', () => {
    test('should validate correct phase dependencies', () => {
      const orchestration = createValidOrchestration();
      const result = validatePhaseDependencies(orchestration);
      expect(result.valid).toBe(true);
    });

    test('should detect missing phase dependency', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', dependencies: ['non-existent-phase'] }
        ]
      };
      const result = validatePhaseDependencies(orchestration);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_PHASE_DEPENDENCY');
    });

    test('should detect circular phase dependencies', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', dependencies: ['phase-2'] },
          { id: 'phase-2', dependencies: ['phase-1'] }
        ]
      };
      const result = validatePhaseDependencies(orchestration);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('CIRCULAR_PHASE_DEPENDENCY');
    });
  });

  describe('validatePhaseReferences', () => {
    test('should validate matching phases', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', name: 'Foundation', file: 'phases/phase-1.json' }
        ]
      };
      const phaseFiles = [
        { phase_id: 'phase-1', phase_name: 'Foundation' }
      ];
      const result = validatePhaseReferences(orchestration, phaseFiles);
      expect(result.valid).toBe(true);
    });

    test('should detect missing phase file', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', name: 'Foundation', file: 'phases/phase-1.json' }
        ]
      };
      const phaseFiles = [];
      const result = validatePhaseReferences(orchestration, phaseFiles);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_PHASE_FILE');
    });

    test('should warn about orphaned phase files', () => {
      const orchestration = {
        phases: []
      };
      const phaseFiles = [
        { phase_id: 'phase-1', phase_name: 'Orphan' }
      ];
      const result = validatePhaseReferences(orchestration, phaseFiles);
      expect(result.valid).toBe(true); // Not an error, just a warning
      expect(result.warnings[0].code).toBe('ORPHANED_PHASE_FILE');
    });

    test('should warn about name mismatches', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', name: 'Foundation', file: 'phases/phase-1.json' }
        ]
      };
      const phaseFiles = [
        { phase_id: 'phase-1', phase_name: 'Different Name' }
      ];
      const result = validatePhaseReferences(orchestration, phaseFiles);
      expect(result.valid).toBe(true); // Not an error, just a warning
      expect(result.warnings[0].code).toBe('PHASE_NAME_MISMATCH');
    });
  });

  describe('formatIntegrityReport', () => {
    test('should format valid report', () => {
      const report = { valid: true, errors: [], warnings: [] };
      const result = formatIntegrityReport(report);
      expect(result).toContain('All integrity checks passed');
    });

    test('should format invalid report with errors', () => {
      const report = {
        valid: false,
        errors: [{ code: 'TEST_ERROR', message: 'Test error' }],
        warnings: []
      };
      const result = formatIntegrityReport(report);
      expect(result).toContain('Integrity validation failed');
      expect(result).toContain('[TEST_ERROR]');
    });
  });
});

describe('Update Validator', () => {
  describe('canDeletePhase', () => {
    test('should allow deleting pending phase without dependents', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', dependencies: [] },
          { id: 'phase-2', dependencies: [] }
        ]
      };
      const executionState = createExecutionState();

      const result = canDeletePhase('phase-1', orchestration, executionState);
      expect(result.canProceed).toBe(true);
    });

    test('should reject deleting phase not found', () => {
      const orchestration = { phases: [] };
      const executionState = createExecutionState();

      const result = canDeletePhase('non-existent', orchestration, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('PHASE_NOT_FOUND');
    });

    test('should reject deleting in-progress phase', () => {
      const orchestration = {
        phases: [{ id: 'phase-1', dependencies: [] }]
      };
      const executionState = {
        ...createExecutionState(),
        phaseStatuses: { 'phase-1': 'in_progress' }
      };

      const result = canDeletePhase('phase-1', orchestration, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('PHASE_IN_PROGRESS');
    });

    test('should reject deleting completed phase without force', () => {
      const orchestration = {
        phases: [{ id: 'phase-1', dependencies: [] }]
      };
      const executionState = {
        ...createExecutionState(),
        phaseStatuses: { 'phase-1': 'completed' }
      };

      const result = canDeletePhase('phase-1', orchestration, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('PHASE_COMPLETED');
      expect(result.requiresForce).toBe(true);
    });

    test('should allow deleting completed phase with force', () => {
      const orchestration = {
        phases: [{ id: 'phase-1', dependencies: [] }]
      };
      const executionState = {
        ...createExecutionState(),
        phaseStatuses: { 'phase-1': 'completed' }
      };

      const result = canDeletePhase('phase-1', orchestration, executionState, { force: true });
      expect(result.canProceed).toBe(true);
      expect(result.warnings).toContain("Deleting completed phase 'phase-1' - all progress will be lost");
    });

    test('should reject deleting phase with dependents', () => {
      const orchestration = {
        phases: [
          { id: 'phase-1', dependencies: [] },
          { id: 'phase-2', dependencies: ['phase-1'] }
        ]
      };
      const executionState = createExecutionState();

      const result = canDeletePhase('phase-1', orchestration, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('HAS_DEPENDENT_PHASES');
    });
  });

  describe('canDeleteTask', () => {
    test('should allow deleting pending task without dependents', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = createExecutionState();

      // task-3 has no dependents
      const result = canDeleteTask('task-3', 'phase-1', phase, executionState);
      expect(result.canProceed).toBe(true);
    });

    test('should reject deleting task not found', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = createExecutionState();

      const result = canDeleteTask('non-existent', 'phase-1', phase, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('TASK_NOT_FOUND');
    });

    test('should reject deleting in-progress task', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = {
        ...createExecutionState(),
        taskStatuses: { 'task-1': 'in_progress' }
      };

      const result = canDeleteTask('task-1', 'phase-1', phase, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('TASK_IN_PROGRESS');
    });

    test('should reject deleting completed task without force', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = {
        ...createExecutionState(),
        taskStatuses: { 'task-3': 'completed' }
      };

      const result = canDeleteTask('task-3', 'phase-1', phase, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('TASK_COMPLETED');
      expect(result.requiresForce).toBe(true);
    });

    test('should allow deleting completed task with force', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = {
        ...createExecutionState(),
        taskStatuses: { 'task-3': 'completed' }
      };

      const result = canDeleteTask('task-3', 'phase-1', phase, executionState, { force: true });
      expect(result.canProceed).toBe(true);
    });

    test('should reject deleting task with dependents', () => {
      const phase = createPhaseWithTasks('phase-1');
      const executionState = createExecutionState();

      // task-1 has task-2 depending on it
      const result = canDeleteTask('task-1', 'phase-1', phase, executionState);
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('HAS_DEPENDENT_TASKS');
    });
  });

  describe('validateUpdateDuringExecution', () => {
    test('should allow all updates when not executing', () => {
      const orchestration = createValidOrchestration();
      const executionState = createExecutionState();
      const operations = [
        { type: 'update', target: 'metadata', data: {} },
        { type: 'delete', target: 'phase', data: { id: 'phase-1' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.allowed).toHaveLength(2);
      expect(result.blocked).toHaveLength(0);
    });

    test('should allow metadata updates during execution', () => {
      const orchestration = createValidOrchestration();
      const executionState = {
        ...createExecutionState(),
        startedAt: '2025-01-01T00:00:00.000Z',
        currentPhase: 'phase-1'
      };
      const operations = [
        { type: 'update', target: 'metadata', data: { name: 'New Name' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.allowed).toHaveLength(1);
      expect(result.blocked).toHaveLength(0);
    });

    test('should block deleting current phase during execution', () => {
      const orchestration = createValidOrchestration();
      const executionState = {
        ...createExecutionState(),
        startedAt: '2025-01-01T00:00:00.000Z',
        currentPhase: 'phase-1'
      };
      const operations = [
        { type: 'delete', target: 'phase', data: { id: 'phase-1' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.blocked).toHaveLength(1);
      expect(result.blocked[0].code).toBe('DELETE_CURRENT_PHASE');
    });

    test('should block deleting in-progress task during execution', () => {
      const orchestration = createValidOrchestration();
      const executionState = {
        ...createExecutionState(),
        startedAt: '2025-01-01T00:00:00.000Z',
        currentPhase: 'phase-1',
        taskStatuses: { 'task-1': 'in_progress' }
      };
      const operations = [
        { type: 'delete', target: 'task', data: { id: 'task-1' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.blocked).toHaveLength(1);
      expect(result.blocked[0].code).toBe('DELETE_IN_PROGRESS_TASK');
    });

    test('should allow adding phases during execution', () => {
      const orchestration = createValidOrchestration();
      const executionState = {
        ...createExecutionState(),
        startedAt: '2025-01-01T00:00:00.000Z',
        currentPhase: 'phase-1'
      };
      const operations = [
        { type: 'add', target: 'phase', data: { name: 'New Phase' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.allowed).toHaveLength(1);
      expect(result.blocked).toHaveLength(0);
    });

    test('should warn when updating completed phases', () => {
      const orchestration = createValidOrchestration();
      const executionState = {
        ...createExecutionState(),
        startedAt: '2025-01-01T00:00:00.000Z',
        currentPhase: 'phase-2',
        phaseStatuses: { 'phase-1': 'completed' }
      };
      const operations = [
        { type: 'update', target: 'phase', data: { id: 'phase-1', name: 'New Name' } }
      ];

      const result = validateUpdateDuringExecution(orchestration, executionState, operations);
      expect(result.allowed).toHaveLength(1);
      expect(result.warnings.some(w => w.includes('completed phase'))).toBe(true);
    });
  });

  describe('validateStatusTransition', () => {
    test('should allow valid task transitions', () => {
      expect(validateStatusTransition('pending', 'in_progress', 'task').canProceed).toBe(true);
      expect(validateStatusTransition('pending', 'completed', 'task').canProceed).toBe(true);
      expect(validateStatusTransition('in_progress', 'completed', 'task').canProceed).toBe(true);
      expect(validateStatusTransition('in_progress', 'failed', 'task').canProceed).toBe(true);
      expect(validateStatusTransition('failed', 'in_progress', 'task').canProceed).toBe(true);
    });

    test('should reject invalid task transitions', () => {
      // Cannot go back from completed
      expect(validateStatusTransition('completed', 'pending', 'task').canProceed).toBe(false);
      expect(validateStatusTransition('completed', 'in_progress', 'task').canProceed).toBe(false);
    });

    test('should allow initial status when no current status', () => {
      expect(validateStatusTransition(null, 'pending', 'task').canProceed).toBe(true);
      expect(validateStatusTransition(undefined, 'in_progress', 'task').canProceed).toBe(true);
    });

    test('should validate phase transitions', () => {
      expect(validateStatusTransition('pending', 'in_progress', 'phase').canProceed).toBe(true);
      expect(validateStatusTransition('completed', 'pending', 'phase').canProceed).toBe(false);
    });

    test('should reject invalid entity type', () => {
      const result = validateStatusTransition('pending', 'completed', 'unknown');
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('INVALID_ENTITY_TYPE');
    });

    test('should reject unknown current status', () => {
      const result = validateStatusTransition('unknown_status', 'pending', 'task');
      expect(result.canProceed).toBe(false);
      expect(result.code).toBe('INVALID_CURRENT_STATUS');
    });
  });
});

describe('Edge Cases', () => {
  test('should handle null/undefined inputs gracefully', () => {
    expect(validateTaskDependencies(null).valid).toBe(true);
    expect(validateTaskDependencies(undefined).valid).toBe(true);
    expect(detectCircularDependencies(null).valid).toBe(true);
    expect(validatePhaseDependencies(null).valid).toBe(true);
  });

  test('should handle empty arrays', () => {
    expect(detectCircularDependencies([]).valid).toBe(true);
    expect(validatePhaseDependencies({ phases: [] }).valid).toBe(true);
  });

  test('should handle tasks with no dependencies field', () => {
    const phase = {
      tasks: [
        { task_id: 'task-1' },
        { task_id: 'task-2' }
      ]
    };
    const result = validateTaskDependencies(phase);
    expect(result.valid).toBe(true);
  });

  test('should handle complex dependency graphs', () => {
    const tasks = [
      { task_id: 'a', dependencies: [] },
      { task_id: 'b', dependencies: ['a'] },
      { task_id: 'c', dependencies: ['a'] },
      { task_id: 'd', dependencies: ['b', 'c'] },
      { task_id: 'e', dependencies: ['d'] },
      { task_id: 'f', dependencies: ['d', 'a'] }
    ];
    const result = detectCircularDependencies(tasks);
    expect(result.valid).toBe(true);
  });
});
