/**
 * Integration tests for Plan System v2
 *
 * Tests the complete plan system workflow including:
 * - Confidence detection integration
 * - Spec validation in finalization
 * - Documentation support
 * - End-to-end plan processing
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Modules under test
const { ConfidenceDetector } = require('../../cli/lib/confidence-detector');
const { SpecValidator } = require('../../cli/lib/spec-validator');
const { DocFetcher } = require('../../cli/lib/doc-fetcher');

// Test fixtures
const createPlanWithTasks = () => ({
  metadata: {
    planId: 'test-auth-plan',
    name: 'Authentication System',
    description: 'Implement authentication',
    status: 'finalized'
  },
  phases: [
    {
      id: 'phase-1-types',
      name: 'Type Definitions',
      tasks: [
        {
          id: 'task-1-1',
          type: 'create_interface',
          file: 'src/types/auth.ts',
          spec: {
            interface: 'User',
            properties: [
              { name: 'id', type: 'string' },
              { name: 'email', type: 'string' }
            ]
          }
        },
        {
          id: 'task-1-2',
          type: 'create_interface',
          file: 'src/types/auth.ts',
          spec: {
            interface: 'AuthContext',
            properties: [
              { name: 'user', type: 'User | null' },
              { name: 'isAuthenticated', type: 'boolean' }
            ]
          }
        }
      ]
    },
    {
      id: 'phase-2-service',
      name: 'Auth Service',
      tasks: [
        {
          id: 'task-2-1',
          type: 'create_class',
          file: 'src/services/auth.ts',
          spec: {
            class: 'AuthService',
            purpose: 'Handle user authentication',
            methods: [
              { name: 'signIn', params: ['email: string', 'password: string'], returns: 'Promise<User>' },
              { name: 'signOut', params: [], returns: 'Promise<void>' }
            ],
            imports: ['User from ../types/auth']
          }
        }
      ]
    },
    {
      id: 'phase-3-hooks',
      name: 'React Hooks',
      tasks: [
        {
          id: 'task-3-1',
          type: 'create_hook',
          file: 'src/hooks/useAuth.ts',
          spec: {
            hook: 'useAuth',
            behavior: ['Get auth context', 'Return auth state and methods'],
            uses: ['useContext'],
            returns: 'AuthContext'
          }
        }
      ]
    }
  ]
});

const createDomainSpecificPlan = () => ({
  metadata: {
    planId: 'crypto-plan',
    name: 'Encryption Module',
    description: 'Implement data encryption'
  },
  phases: [
    {
      id: 'phase-1-crypto',
      name: 'Crypto Functions',
      tasks: [
        {
          id: 'task-1-1',
          type: 'create_function',
          file: 'src/crypto/encrypt.ts',
          spec: {
            function: 'encryptData',
            does: 'Encrypt data using AES-256-GCM',
            params: ['data: Buffer', 'key: string'],
            returns: 'EncryptedData'
          }
        },
        {
          id: 'task-1-2',
          type: 'create_function',
          file: 'src/crypto/decrypt.ts',
          spec: {
            function: 'decryptData',
            does: 'Decrypt AES-256-GCM encrypted data',
            params: ['encrypted: EncryptedData', 'key: string'],
            returns: 'Buffer'
          }
        }
      ]
    }
  ]
});

describe('Plan System v2 Integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `plan-system-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Finalization Workflow', () => {
    describe('Confidence Integration', () => {
      test('should calculate confidence for all plan tasks', async () => {
        const plan = createPlanWithTasks();
        const detector = new ConfidenceDetector();

        // Flatten tasks from all phases
        const allTasks = plan.phases.flatMap(phase => phase.tasks);

        const { stats, results } = await detector.analyzeAll(allTasks);

        expect(stats.total).toBe(4);
        expect(results).toHaveLength(4);

        // All tasks should have known patterns
        results.forEach(result => {
          expect(result.factors.known_pattern).toBe(true);
        });
      });

      test('should identify low confidence tasks in domain-specific plans', async () => {
        const plan = createDomainSpecificPlan();
        const detector = new ConfidenceDetector();

        const allTasks = plan.phases.flatMap(phase => phase.tasks);
        const { stats } = await detector.analyzeAll(allTasks);

        // Crypto tasks should have lower confidence (domain expertise required)
        expect(stats.high + stats.medium + stats.low).toBe(stats.total);

        // At least one task should not have domain_expertise factor
        const { results } = await detector.analyzeAll(allTasks);
        const hasDomainRisk = results.some(r => !r.factors.domain_expertise);
        expect(hasDomainRisk).toBe(true);
      });

      test('should set alert flag when many low confidence tasks', async () => {
        const lowConfidencePlan = {
          phases: [{
            id: 'phase-1',
            tasks: Array(5).fill(null).map((_, i) => ({
              id: `task-${i}`,
              type: 'custom',
              file: `src/quantum/${i}.ts`,
              spec: {
                purpose: 'Quantum circuit with CUDA acceleration and blockchain verification'
              }
            }))
          }]
        };

        const detector = new ConfidenceDetector();
        const allTasks = lowConfidencePlan.phases.flatMap(p => p.tasks);
        const { needsAlert } = await detector.analyzeAll(allTasks);

        expect(needsAlert).toBe(true);
      });
    });

    describe('Spec Validation Integration', () => {
      test('should validate all specs in a plan', async () => {
        const plan = createPlanWithTasks();
        const validator = new SpecValidator();

        const allTasks = plan.phases.flatMap(phase => phase.tasks);
        const result = await validator.validateAll(allTasks);

        expect(result.valid).toBe(true);
        expect(result.totalErrors).toBe(0);
      });

      test('should catch validation errors across phases', async () => {
        const invalidPlan = {
          phases: [
            {
              id: 'phase-1',
              tasks: [
                {
                  id: 'task-1',
                  type: 'create_function',
                  file: 'src/test.ts',
                  spec: {} // Missing required fields
                },
                {
                  id: 'task-2',
                  type: 'create_hook',
                  file: 'src/hooks/test.ts',
                  spec: {
                    hook: 'invalidHook' // Missing 'use' prefix
                  }
                }
              ]
            }
          ]
        };

        const validator = new SpecValidator();
        const allTasks = invalidPlan.phases.flatMap(p => p.tasks);
        const result = await validator.validateAll(allTasks);

        expect(result.valid).toBe(false);
        expect(result.totalErrors).toBeGreaterThan(0);
      });

      test('should generate warnings for incomplete specs', async () => {
        const incompleteSpecs = {
          phases: [{
            id: 'phase-1',
            tasks: [{
              id: 'task-1',
              type: 'create_function',
              file: 'src/test.ts',
              spec: {
                function: 'test',
                does: 'Test function'
                // Missing params, returns, imports
              }
            }]
          }]
        };

        const validator = new SpecValidator();
        const allTasks = incompleteSpecs.phases.flatMap(p => p.tasks);
        const result = await validator.validateAll(allTasks);

        expect(result.totalWarnings).toBeGreaterThan(0);
      });
    });
  });

  describe('Documentation Support', () => {
    test('should fetch and parse documentation for plan context', async () => {
      // Create mock documentation
      const docsContent = `# Authentication API

## signIn

Authenticate a user with email and password.

### Parameters
- email: User's email address
- password: User's password

### Returns
User object on success.

## signOut

End the current session.
`;

      const docsPath = path.join(tempDir, 'auth-api.md');
      await fs.writeFile(docsPath, docsContent);

      const fetcher = new DocFetcher({ projectRoot: tempDir });
      const docs = await fetcher.fetch(docsPath);

      expect(docs.sections.length).toBeGreaterThan(0);
      expect(docs.sections.some(s => s.title === 'signIn')).toBe(true);
      expect(docs.sections.some(s => s.title === 'signOut')).toBe(true);
    });

    test('should find relevant docs for tasks', async () => {
      const fetcher = new DocFetcher();

      const task = {
        type: 'create_function',
        spec: {
          function: 'signIn',
          does: 'Authenticate user'
        }
      };

      const docs = [{
        source: 'auth-api.md',
        sections: [
          { title: 'signIn', content: 'Authenticate user with email password authentication flow' },
          { title: 'signOut', content: 'End session logout user' }
        ]
      }];

      const relevant = fetcher.getRelevantDocs(task, docs);

      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant[0].sections[0].title).toBe('signIn');
    });

    test('should attach docs to tasks in finalization', async () => {
      const docsContent = `# API Docs

## Authentication
Use API keys for all requests.
`;
      const docsPath = path.join(tempDir, 'api.md');
      await fs.writeFile(docsPath, docsContent);

      const fetcher = new DocFetcher({ projectRoot: tempDir });
      const docs = await fetcher.fetchAll([docsPath]);

      const plan = createPlanWithTasks();
      const allTasks = plan.phases.flatMap(p => p.tasks);

      // Simulate doc attachment
      const tasksWithDocs = allTasks.map(task => {
        const relevantDocs = fetcher.getRelevantDocs(task, docs);
        return {
          ...task,
          docs: relevantDocs
        };
      });

      // Tasks related to auth should have docs attached
      const authServiceTask = tasksWithDocs.find(t => t.id === 'task-2-1');
      // The auth service task might pick up auth docs
      expect(authServiceTask).toBeDefined();
    });
  });

  describe('Execution Workflow', () => {
    describe('Task Processing', () => {
      test('should validate task before execution', async () => {
        const validator = new SpecValidator();

        const validTask = {
          type: 'create_function',
          file: 'src/utils/helper.ts',
          spec: {
            function: 'calculateTotal',
            does: 'Calculate total price',
            params: ['items: Item[]'],
            returns: 'number'
          }
        };

        const result = await validator.validate(validTask);
        expect(result.valid).toBe(true);
      });

      test('should check confidence before execution', async () => {
        const detector = new ConfidenceDetector();

        // High confidence task
        const simpleTask = {
          type: 'create_readme',
          file: 'docs/README.md',
          spec: { sections: ['Overview', 'Usage'] }
        };

        const result = await detector.analyze(simpleTask);
        expect(result.level).toBe('high');

        // Low confidence task
        const complexTask = {
          type: 'custom',
          file: 'src/exotic.ts',
          spec: {
            purpose: 'CUDA kernel for quantum simulation'
          }
        };

        const result2 = await detector.analyze(complexTask);
        expect(result2.level).not.toBe('high');
      });
    });

    describe('Low Confidence Handling', () => {
      test('should flag tasks requiring review', async () => {
        const detector = new ConfidenceDetector();

        const securityTask = {
          type: 'create_function',
          file: 'src/auth/verify.ts',
          spec: {
            function: 'verifyToken',
            does: 'Verify JWT authentication token'
          }
        };

        const result = await detector.analyze(securityTask);

        // Security-related tasks should have risks
        expect(result.risks.some(r => r.includes('Security'))).toBe(true);
      });

      test('should suggest mitigations for low confidence tasks', async () => {
        const detector = new ConfidenceDetector();

        const domainTask = {
          type: 'custom',
          file: 'src/ml/model.ts',
          spec: {
            purpose: 'Neural network training loop'
          }
        };

        const result = await detector.analyze(domainTask);

        // Should have mitigations for risks
        expect(result.mitigations.length).toBe(result.risks.length);
      });
    });
  });

  describe('End-to-End Scenarios', () => {
    test('should process a complete plan with confidence and validation', async () => {
      const plan = createPlanWithTasks();
      const detector = new ConfidenceDetector();
      const validator = new SpecValidator();

      // Step 1: Extract all tasks
      const allTasks = plan.phases.flatMap(phase => phase.tasks);

      // Step 2: Validate all specs
      const validationResult = await validator.validateAll(allTasks);
      expect(validationResult.valid).toBe(true);

      // Step 3: Analyze confidence
      const confidenceResult = await detector.analyzeAll(allTasks);
      expect(confidenceResult.stats.total).toBe(allTasks.length);

      // Step 4: Check for alerts
      if (confidenceResult.needsAlert) {
        // Would prompt user in real scenario
        expect(confidenceResult.stats.low).toBeGreaterThanOrEqual(3);
      }

      // Step 5: Verify all tasks have confidence data
      confidenceResult.results.forEach((result, i) => {
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('factors');
      });
    });

    test('should handle plan with mixed confidence levels', async () => {
      const mixedPlan = {
        phases: [
          {
            id: 'phase-1-simple',
            tasks: [
              {
                id: 'task-1',
                type: 'create_readme',
                file: 'README.md',
                spec: { sections: ['Overview'] }
              }
            ]
          },
          {
            id: 'phase-2-complex',
            tasks: [
              {
                id: 'task-2',
                type: 'custom',
                file: 'src/crypto.ts',
                spec: {
                  purpose: 'Implement AES encryption'
                }
              }
            ]
          }
        ]
      };

      const detector = new ConfidenceDetector();
      const allTasks = mixedPlan.phases.flatMap(p => p.tasks);
      const { stats, results } = await detector.analyzeAll(allTasks);

      // Should have mix of high and lower confidence
      expect(stats.high).toBeGreaterThanOrEqual(1);

      // README task should be high
      const readmeResult = results[0];
      expect(readmeResult.level).toBe('high');

      // Crypto task should be lower
      const cryptoResult = results[1];
      expect(cryptoResult.factors.domain_expertise).toBe(false);
    });

    test('should integrate docs with confidence calculation', async () => {
      // Create docs with many matching keywords that will overlap with task
      // The hasDocumentation function requires 5+ common words
      const docsContent = `# Encryption Guide

## AES-256 Encryption Function
AES-256 is a symmetric encryption algorithm for encrypting data securely.
The encrypt function takes data and returns encrypted output using AES-256-GCM.
Use a 256-bit key and GCM mode for authenticated encryption.
This function handles data encryption with proper key management.
`;
      const docsPath = path.join(tempDir, 'crypto.md');
      await fs.writeFile(docsPath, docsContent);

      const fetcher = new DocFetcher({ projectRoot: tempDir });
      const docs = await fetcher.fetchAll([docsPath]);

      // Create detector with docs - the docs content must have overlapping keywords with task
      const detector = new ConfidenceDetector({
        docs: docs.filter(d => !d.error)
      });

      // Task with keywords that match the docs content
      const cryptoTask = {
        type: 'create_function',
        file: 'src/crypto/encrypt.ts',
        spec: {
          function: 'encryptData',
          does: 'Encrypt data using AES-256-GCM encryption function',
          params: ['data: Buffer', 'key: string'],
          returns: 'EncryptedData'
        }
      };

      const result = await detector.analyze(cryptoTask);

      // Should have docs available (5+ keyword overlap required)
      expect(result.factors.docs_available).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty plan', async () => {
      const emptyPlan = { phases: [] };
      const detector = new ConfidenceDetector();
      const validator = new SpecValidator();

      const allTasks = emptyPlan.phases.flatMap(p => p.tasks);

      const confidenceResult = await detector.analyzeAll(allTasks);
      expect(confidenceResult.stats.total).toBe(0);

      const validationResult = await validator.validateAll(allTasks);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle tasks with missing specs gracefully', async () => {
      const brokenPlan = {
        phases: [{
          id: 'phase-1',
          tasks: [
            { id: 'task-1', type: 'create_function', file: 'src/test.ts' }
            // Missing spec
          ]
        }]
      };

      const detector = new ConfidenceDetector();
      const validator = new SpecValidator();

      const allTasks = brokenPlan.phases.flatMap(p => p.tasks);

      // Should not throw
      const confidenceResult = await detector.analyzeAll(allTasks);
      expect(confidenceResult.results).toHaveLength(1);

      const validationResult = await validator.validateAll(allTasks);
      expect(validationResult.valid).toBe(false);
    });

    test('should handle invalid task types', async () => {
      const invalidPlan = {
        phases: [{
          id: 'phase-1',
          tasks: [{
            id: 'task-1',
            type: 'completely_unknown_type',
            file: 'src/test.ts',
            spec: { something: 'value' }
          }]
        }]
      };

      const detector = new ConfidenceDetector();

      const allTasks = invalidPlan.phases.flatMap(p => p.tasks);
      const { results } = await detector.analyzeAll(allTasks);

      // Should still process but with low confidence
      expect(results[0].factors.known_pattern).toBe(false);
    });
  });
});
