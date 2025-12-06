/**
 * Unit tests for SpecValidator
 *
 * Tests task spec validation against type-specific schemas.
 * Validates required fields, type-specific rules, and recommendations.
 */

const path = require('path');

// Module under test
const {
  SpecValidator,
  REQUIRED_FIELDS,
  RECOMMENDED_FIELDS
} = require('../cli/lib/spec-validator');

// Test fixtures
const createFunctionTask = (overrides = {}) => ({
  type: 'create_function',
  file: 'src/utils/helper.ts',
  spec: {
    function: 'calculateTotal',
    does: 'Calculate the total price of items',
    params: ['items: Item[]', 'discount?: number'],
    returns: 'number',
    imports: ['Item from ../types']
  },
  ...overrides
});

const createClassTask = (overrides = {}) => ({
  type: 'create_class',
  file: 'src/services/auth.ts',
  spec: {
    class: 'AuthService',
    purpose: 'Handle user authentication and session management',
    methods: [
      { name: 'signIn', params: ['email: string', 'password: string'], returns: 'Promise<User>' }
    ],
    imports: ['User from ../types']
  },
  ...overrides
});

const createHookTask = (overrides = {}) => ({
  type: 'create_hook',
  file: 'src/hooks/useAuth.ts',
  spec: {
    hook: 'useAuth',
    behavior: ['Get current user from context', 'Return auth state and methods'],
    uses: ['useState', 'useContext'],
    returns: 'AuthState'
  },
  ...overrides
});

const createComponentTask = (overrides = {}) => ({
  type: 'create_component',
  file: 'src/components/LoginForm.tsx',
  spec: {
    component: 'LoginForm',
    renders: 'A form with email and password inputs and submit button',
    props: [
      { name: 'onSubmit', type: '(email: string, password: string) => void', required: true }
    ],
    hooks: ['useState', 'useAuth']
  },
  ...overrides
});

const createTableTask = (overrides = {}) => ({
  type: 'create_table',
  file: 'supabase/migrations/001_users.sql',
  spec: {
    table: 'users',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'email', type: 'text', unique: true },
      { name: 'created_at', type: 'timestamptz', default: 'now()' }
    ],
    indexes: [
      { name: 'idx_users_email', columns: ['email'] }
    ]
  },
  ...overrides
});

const createTestTask = (overrides = {}) => ({
  type: 'create_test',
  file: 'src/__tests__/auth.test.ts',
  spec: {
    describes: [
      {
        name: 'AuthService',
        tests: [
          { name: 'should sign in user', expects: 'user object returned' }
        ]
      }
    ]
  },
  ...overrides
});

describe('SpecValidator', () => {
  describe('Constants', () => {
    test('REQUIRED_FIELDS should define required fields for common types', () => {
      expect(REQUIRED_FIELDS.create_function).toContain('function');
      expect(REQUIRED_FIELDS.create_function).toContain('does');
      expect(REQUIRED_FIELDS.create_class).toContain('class');
      expect(REQUIRED_FIELDS.create_class).toContain('purpose');
      expect(REQUIRED_FIELDS.create_hook).toContain('hook');
      expect(REQUIRED_FIELDS.create_hook).toContain('behavior');
      expect(REQUIRED_FIELDS.create_component).toContain('component');
      expect(REQUIRED_FIELDS.create_component).toContain('renders');
      expect(REQUIRED_FIELDS.create_table).toContain('table');
      expect(REQUIRED_FIELDS.create_table).toContain('columns');
    });

    test('RECOMMENDED_FIELDS should define optional but helpful fields', () => {
      expect(RECOMMENDED_FIELDS.create_function).toContain('params');
      expect(RECOMMENDED_FIELDS.create_function).toContain('returns');
      expect(RECOMMENDED_FIELDS.create_function).toContain('imports');
      expect(RECOMMENDED_FIELDS.create_class).toContain('methods');
      expect(RECOMMENDED_FIELDS.create_class).toContain('imports');
    });
  });

  describe('Constructor', () => {
    test('should create instance with default schemas directory', () => {
      const validator = new SpecValidator();
      expect(validator.schemasDir).toContain('schemas/task-specs');
    });

    test('should accept custom schemas directory', () => {
      const validator = new SpecValidator('/custom/schemas');
      expect(validator.schemasDir).toBe('/custom/schemas');
    });
  });

  describe('validate - Basic validation', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate a correct function task', async () => {
      const task = createFunctionTask();
      const result = await validator.validate(task);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject task without type', async () => {
      const task = { file: 'src/test.ts', spec: {} };
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'type')).toBe(true);
    });

    test('should reject task without file', async () => {
      const task = { type: 'create_function', spec: {} };
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'file')).toBe(true);
    });

    test('should reject task without spec', async () => {
      const task = { type: 'create_function', file: 'src/test.ts' };
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spec')).toBe(true);
    });
  });

  describe('validate - create_function', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should require function name', async () => {
      const task = createFunctionTask({
        spec: { does: 'Something' }
      });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spec.function')).toBe(true);
    });

    test('should require does field', async () => {
      const task = createFunctionTask({
        spec: { function: 'test' }
      });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spec.does')).toBe(true);
    });

    test('should warn about non-camelCase function names', async () => {
      const task = createFunctionTask({
        spec: { function: 'PascalCase', does: 'Something' }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.field === 'spec.function')).toBe(true);
    });

    test('should warn when async function does not return Promise', async () => {
      const task = createFunctionTask({
        spec: {
          function: 'fetchData',
          does: 'Fetch data',
          async: true,
          returns: 'Data'  // Missing Promise<>
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.field === 'spec.returns')).toBe(true);
    });

    test('should warn about untyped parameters', async () => {
      const task = createFunctionTask({
        spec: {
          function: 'test',
          does: 'Something',
          params: ['untypedParam']  // Missing type annotation
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.message.includes('type annotation'))).toBe(true);
    });

    test('should warn about missing recommended fields', async () => {
      const task = createFunctionTask({
        spec: {
          function: 'test',
          does: 'Something'
          // Missing params, returns, imports
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validate - create_hook', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should require hook name starting with "use"', async () => {
      const task = createHookTask({
        spec: {
          hook: 'auth',  // Missing 'use' prefix
          behavior: ['Do something']
        }
      });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('must start with "use"'))).toBe(true);
    });

    test('should validate correct hook name', async () => {
      const task = createHookTask();
      const result = await validator.validate(task);

      expect(result.errors.filter(e => e.field === 'spec.hook')).toHaveLength(0);
    });

    test('should require behavior as array', async () => {
      const task = createHookTask({
        spec: {
          hook: 'useAuth',
          behavior: 'Not an array'  // Should be array
        }
      });
      const result = await validator.validate(task);

      expect(result.errors.some(e => e.message.includes('must be an array'))).toBe(true);
    });
  });

  describe('validate - create_component', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate correct component task', async () => {
      const task = createComponentTask();
      const result = await validator.validate(task);

      expect(result.valid).toBe(true);
    });

    test('should warn about non-PascalCase component names', async () => {
      const task = createComponentTask({
        spec: {
          component: 'loginForm',  // Should be PascalCase
          renders: 'A form'
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.message.includes('PascalCase'))).toBe(true);
    });

    test('should warn about props without types', async () => {
      const task = createComponentTask({
        spec: {
          component: 'LoginForm',
          renders: 'A form',
          props: [
            { name: 'onSubmit' }  // Missing type
          ]
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.message.includes('type'))).toBe(true);
    });
  });

  describe('validate - create_table', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate correct table task', async () => {
      const task = createTableTask();
      const result = await validator.validate(task);

      expect(result.valid).toBe(true);
    });

    test('should warn about non-snake_case table names', async () => {
      const task = createTableTask({
        spec: {
          table: 'UserAccounts',  // Should be snake_case
          columns: [{ name: 'id', type: 'uuid', pk: true }]
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.message.includes('snake_case'))).toBe(true);
    });

    test('should require type for each column', async () => {
      const task = createTableTask({
        spec: {
          table: 'users',
          columns: [
            { name: 'id' }  // Missing type
          ]
        }
      });
      const result = await validator.validate(task);

      expect(result.errors.some(e => e.message.includes('must have a type'))).toBe(true);
    });

    test('should warn about missing primary key', async () => {
      const task = createTableTask({
        spec: {
          table: 'users',
          columns: [
            { name: 'email', type: 'text' }  // No pk: true
          ]
        }
      });
      const result = await validator.validate(task);

      expect(result.warnings.some(w => w.message.includes('primary key'))).toBe(true);
    });
  });

  describe('validate - create_test', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate correct test task', async () => {
      const task = createTestTask();
      const result = await validator.validate(task);

      expect(result.valid).toBe(true);
    });

    test('should require tests in describe blocks', async () => {
      const task = createTestTask({
        spec: {
          describes: [
            { name: 'AuthService', tests: [] }  // Empty tests array
          ]
        }
      });
      const result = await validator.validate(task);

      expect(result.errors.some(e => e.message.includes('has no tests'))).toBe(true);
    });
  });

  describe('validate - class', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate correct class task', async () => {
      const task = createClassTask();
      const result = await validator.validate(task);

      expect(result.valid).toBe(true);
    });

    test('should require class name', async () => {
      const task = createClassTask({
        spec: { purpose: 'Something' }
      });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spec.class')).toBe(true);
    });

    test('should require purpose', async () => {
      const task = createClassTask({
        spec: { class: 'AuthService' }
      });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spec.purpose')).toBe(true);
    });
  });

  describe('validateAll', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should validate multiple tasks', async () => {
      const tasks = [
        createFunctionTask(),
        createClassTask(),
        createComponentTask()
      ];
      const result = await validator.validateAll(tasks);

      expect(result.valid).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.totalErrors).toBe(0);
    });

    test('should aggregate errors from multiple tasks', async () => {
      const tasks = [
        createFunctionTask({ spec: {} }),  // Missing required fields
        createHookTask({ spec: { hook: 'invalid' } })  // Invalid hook name
      ];
      const result = await validator.validateAll(tasks);

      expect(result.valid).toBe(false);
      expect(result.totalErrors).toBeGreaterThan(0);
    });

    test('should aggregate warnings from multiple tasks', async () => {
      const tasks = [
        createFunctionTask({ spec: { function: 'test', does: 'Test' } }),
        createComponentTask({ spec: { component: 'test', renders: 'Test' } })
      ];
      const result = await validator.validateAll(tasks);

      expect(result.totalWarnings).toBeGreaterThan(0);
    });

    test('should include taskId in results', async () => {
      const tasks = [
        { ...createFunctionTask(), id: 'task-1' },
        { ...createClassTask(), id: 'task-2' }
      ];
      const result = await validator.validateAll(tasks);

      expect(result.results[0].taskId).toBe('task-1');
      expect(result.results[1].taskId).toBe('task-2');
    });
  });

  describe('_getSuggestion', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should provide suggestions for common fields', () => {
      expect(validator._getSuggestion('create_function', 'function')).toContain('function name');
      expect(validator._getSuggestion('create_function', 'does')).toContain('description');
      expect(validator._getSuggestion('create_class', 'class')).toContain('class name');
      expect(validator._getSuggestion('create_hook', 'hook')).toContain('use');
      expect(validator._getSuggestion('create_component', 'component')).toContain('component name');
      expect(validator._getSuggestion('create_table', 'table')).toContain('table name');
      expect(validator._getSuggestion('create_table', 'columns')).toContain('column');
    });

    test('should provide default suggestion for unknown fields', () => {
      expect(validator._getSuggestion('create_function', 'unknown')).toContain('unknown');
    });
  });

  describe('Edge Cases', () => {
    let validator;

    beforeEach(() => {
      validator = new SpecValidator();
    });

    test('should handle unknown task type', async () => {
      const task = {
        type: 'unknown_type',
        file: 'src/test.ts',
        spec: { something: 'value' }
      };
      const result = await validator.validate(task);

      // Should not crash, but may have warnings
      expect(result).toHaveProperty('valid');
    });

    test('should handle empty spec object', async () => {
      const task = createFunctionTask({ spec: {} });
      const result = await validator.validate(task);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle spec with false/0 values', async () => {
      const task = {
        type: 'create_function',
        file: 'src/test.ts',
        spec: {
          function: 'test',
          does: 'Test',
          async: false,  // Falsy but valid
          maxRetries: 0   // Falsy but valid
        }
      };
      const result = await validator.validate(task);

      // async: false should not trigger "missing field" error
      expect(result.errors.filter(e => e.field === 'spec.async')).toHaveLength(0);
    });

    test('should handle params as non-array', async () => {
      const task = createFunctionTask({
        spec: {
          function: 'test',
          does: 'Test',
          params: 'not an array'
        }
      });
      const result = await validator.validate(task);

      // Should not crash
      expect(result).toHaveProperty('valid');
    });

    test('should handle columns as non-array', async () => {
      const task = createTableTask({
        spec: {
          table: 'users',
          columns: 'not an array'
        }
      });
      const result = await validator.validate(task);

      // Should not crash
      expect(result).toHaveProperty('valid');
    });

    test('should handle describes with missing tests field', async () => {
      const task = createTestTask({
        spec: {
          describes: [
            { name: 'TestSuite' }  // Missing tests field
          ]
        }
      });
      const result = await validator.validate(task);

      expect(result.errors.some(e => e.message.includes('no tests'))).toBe(true);
    });
  });
});
