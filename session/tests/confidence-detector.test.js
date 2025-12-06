/**
 * Unit tests for ConfidenceDetector
 *
 * Tests confidence level calculation for tasks based on:
 * - Example availability in codebase
 * - Known pattern types
 * - Domain expertise requirements
 * - Documentation availability
 * - Project convention matching
 */

const path = require('path');

// Module under test
const {
  ConfidenceDetector,
  WEIGHTS,
  KNOWN_PATTERNS,
  DOMAIN_KEYWORDS
} = require('../cli/lib/confidence-detector');

// Test fixtures
const createTask = (overrides = {}) => ({
  type: 'create_function',
  file: 'src/utils/helper.ts',
  spec: {
    function: 'calculateTotal',
    does: 'Calculate the total price',
    params: ['items: Item[]'],
    returns: 'number'
  },
  docs: [],
  ...overrides
});

const createMarkdownTask = (overrides = {}) => ({
  type: 'create_readme',
  file: 'docs/README.md',
  spec: {
    sections: ['Introduction', 'Installation', 'Usage']
  },
  ...overrides
});

const createDomainSpecificTask = (overrides = {}) => ({
  type: 'create_function',
  file: 'src/crypto/encrypt.ts',
  spec: {
    function: 'encryptData',
    does: 'Encrypt data using AES-256',
    params: ['data: Buffer', 'key: string'],
    returns: 'Buffer'
  },
  ...overrides
});

describe('ConfidenceDetector', () => {
  describe('Constants', () => {
    test('WEIGHTS should have correct values', () => {
      expect(WEIGHTS.has_example).toBe(30);
      expect(WEIGHTS.known_pattern).toBe(25);
      expect(WEIGHTS.domain_expertise).toBe(20);
      expect(WEIGHTS.docs_available).toBe(15);
      expect(WEIGHTS.project_convention).toBe(10);
    });

    test('KNOWN_PATTERNS should include common task types', () => {
      expect(KNOWN_PATTERNS).toContain('create_function');
      expect(KNOWN_PATTERNS).toContain('create_class');
      expect(KNOWN_PATTERNS).toContain('create_component');
      expect(KNOWN_PATTERNS).toContain('create_hook');
      expect(KNOWN_PATTERNS).toContain('create_table');
    });

    test('DOMAIN_KEYWORDS should include specialized terms', () => {
      expect(DOMAIN_KEYWORDS).toContain('encrypt');
      expect(DOMAIN_KEYWORDS).toContain('cuda');
      expect(DOMAIN_KEYWORDS).toContain('kubernetes');
      expect(DOMAIN_KEYWORDS).toContain('blockchain');
    });
  });

  describe('Constructor', () => {
    test('should create instance with default options', () => {
      const detector = new ConfidenceDetector();
      expect(detector.projectRoot).toBe(process.cwd());
      expect(detector.docs).toEqual([]);
    });

    test('should accept custom options', () => {
      const detector = new ConfidenceDetector({
        projectRoot: '/custom/path',
        docs: [{ url: 'http://example.com/docs' }]
      });
      expect(detector.projectRoot).toBe('/custom/path');
      expect(detector.docs).toHaveLength(1);
    });
  });

  describe('isKnownPattern', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return true for known patterns', () => {
      expect(detector.isKnownPattern({ type: 'create_function' })).toBe(true);
      expect(detector.isKnownPattern({ type: 'create_class' })).toBe(true);
      expect(detector.isKnownPattern({ type: 'create_component' })).toBe(true);
      expect(detector.isKnownPattern({ type: 'create_hook' })).toBe(true);
      expect(detector.isKnownPattern({ type: 'create_table' })).toBe(true);
      expect(detector.isKnownPattern({ type: 'create_readme' })).toBe(true);
    });

    test('should return false for unknown patterns', () => {
      expect(detector.isKnownPattern({ type: 'custom' })).toBe(false);
      expect(detector.isKnownPattern({ type: 'unknown_type' })).toBe(false);
    });
  });

  describe('requiresDomainExpertise', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return true for crypto-related tasks', () => {
      const task = createDomainSpecificTask();
      expect(detector.requiresDomainExpertise(task)).toBe(true);
    });

    test('should return true for GPU-related tasks', () => {
      const task = createTask({
        spec: {
          function: 'runCudaKernel',
          does: 'Run a CUDA kernel on GPU'
        }
      });
      expect(detector.requiresDomainExpertise(task)).toBe(true);
    });

    test('should return true for kubernetes-related tasks', () => {
      const task = createTask({
        spec: {
          function: 'deployToK8s',
          does: 'Deploy to Kubernetes cluster'
        }
      });
      expect(detector.requiresDomainExpertise(task)).toBe(true);
    });

    test('should return false for standard tasks', () => {
      const task = createTask();
      expect(detector.requiresDomainExpertise(task)).toBe(false);
    });

    test('should return false for markdown tasks', () => {
      const task = createMarkdownTask();
      expect(detector.requiresDomainExpertise(task)).toBe(false);
    });
  });

  describe('hasDocumentation', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return true when task has docs', () => {
      const task = createTask({
        docs: [{ url: 'http://example.com/docs', section: 'API' }]
      });
      expect(detector.hasDocumentation(task)).toBe(true);
    });

    test('should return false when task has no docs', () => {
      const task = createTask({ docs: [] });
      expect(detector.hasDocumentation(task)).toBe(false);
    });

    test('should check global docs when task has no docs', () => {
      // The hasDocumentation function requires at least 5 common words
      // between task and docs, so we include many matching keywords
      detector = new ConfidenceDetector({
        docs: [{
          sections: [{
            content: 'calculateTotal function helper utils calculate total price items number return value'
          }]
        }]
      });
      const task = createTask({ docs: [] });
      expect(detector.hasDocumentation(task)).toBe(true);
    });
  });

  describe('calculateScore', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return 0 when all factors are false', () => {
      const factors = {
        has_example: false,
        known_pattern: false,
        domain_expertise: false,
        docs_available: false,
        project_convention: false
      };
      expect(detector.calculateScore(factors)).toBe(0);
    });

    test('should return 100 when all factors are true', () => {
      const factors = {
        has_example: true,
        known_pattern: true,
        domain_expertise: true,
        docs_available: true,
        project_convention: true
      };
      expect(detector.calculateScore(factors)).toBe(100);
    });

    test('should calculate partial scores correctly', () => {
      const factors = {
        has_example: true,  // 30
        known_pattern: true,  // 25
        domain_expertise: false,
        docs_available: false,
        project_convention: false
      };
      expect(detector.calculateScore(factors)).toBe(55);
    });
  });

  describe('scoreToLevel', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return "high" for scores >= 70', () => {
      expect(detector.scoreToLevel(70)).toBe('high');
      expect(detector.scoreToLevel(85)).toBe('high');
      expect(detector.scoreToLevel(100)).toBe('high');
    });

    test('should return "medium" for scores 40-69', () => {
      expect(detector.scoreToLevel(40)).toBe('medium');
      expect(detector.scoreToLevel(55)).toBe('medium');
      expect(detector.scoreToLevel(69)).toBe('medium');
    });

    test('should return "low" for scores < 40', () => {
      expect(detector.scoreToLevel(0)).toBe('low');
      expect(detector.scoreToLevel(25)).toBe('low');
      expect(detector.scoreToLevel(39)).toBe('low');
    });
  });

  describe('identifyRisks', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should identify missing example risk', () => {
      const factors = { has_example: false };
      const risks = detector.identifyRisks(createTask(), factors);
      expect(risks).toContain('No similar code in project to reference');
    });

    test('should identify unknown pattern risk', () => {
      const factors = { known_pattern: false };
      const risks = detector.identifyRisks(createTask(), factors);
      expect(risks).toContain('Non-standard task type - may require custom handling');
    });

    test('should identify domain expertise risk', () => {
      const factors = { domain_expertise: false };
      const risks = detector.identifyRisks(createTask(), factors);
      expect(risks).toContain('May require domain expertise not available');
    });

    test('should identify project convention risk', () => {
      const factors = { project_convention: false };
      const risks = detector.identifyRisks(createTask(), factors);
      expect(risks).toContain('File location may not match project conventions');
    });

    test('should identify custom task risk', () => {
      const factors = {};
      const customTask = createTask({ type: 'custom' });
      const risks = detector.identifyRisks(customTask, factors);
      expect(risks).toContain('Custom task type - implementation details unclear');
    });

    test('should identify security risk', () => {
      const task = createTask({
        spec: { function: 'authenticateUser', does: 'Handle user authentication' }
      });
      const risks = detector.identifyRisks(task, {});
      expect(risks.some(r => r.includes('Security-sensitive'))).toBe(true);
    });

    test('should identify payment risk', () => {
      const task = createTask({
        spec: { function: 'processPayment', does: 'Process billing and payment' }
      });
      const risks = detector.identifyRisks(task, {});
      expect(risks.some(r => r.includes('Payment-related'))).toBe(true);
    });
  });

  describe('suggestMitigations', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should suggest mitigation for missing example', () => {
      const risks = ['No similar code in project to reference'];
      const mitigations = detector.suggestMitigations(risks);
      expect(mitigations[0]).toContain('--reference');
    });

    test('should suggest mitigation for domain expertise', () => {
      const risks = ['May require domain expertise not available'];
      const mitigations = detector.suggestMitigations(risks);
      expect(mitigations[0]).toContain('--docs');
    });

    test('should provide default mitigation for unknown risks', () => {
      const risks = ['Some unknown risk'];
      const mitigations = detector.suggestMitigations(risks);
      expect(mitigations[0]).toContain('Review task manually');
    });
  });

  describe('analyze', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should return high confidence for markdown tasks', async () => {
      const task = createMarkdownTask();
      const result = await detector.analyze(task);

      expect(result.level).toBe('high');
      expect(result.score).toBe(85);
      expect(result.factors.known_pattern).toBe(true);
      expect(result.risks).toHaveLength(0);
    });

    test('should return high confidence for directory creation', async () => {
      const task = {
        type: 'create_directory',
        file: 'src/new-module',
        spec: { paths: ['src/new-module'] }
      };
      const result = await detector.analyze(task);

      expect(result.level).toBe('high');
      expect(result.score).toBe(85);
    });

    test('should return lower confidence for domain-specific tasks', async () => {
      const task = createDomainSpecificTask();
      const result = await detector.analyze(task);

      // Should not have domain_expertise factor (crypto task)
      expect(result.factors.domain_expertise).toBe(false);
      // Score should be reduced
      expect(result.score).toBeLessThan(100);
    });

    test('should include all required fields in result', async () => {
      const task = createTask();
      const result = await detector.analyze(task);

      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('mitigations');
    });

    test('should handle task with documentation', async () => {
      const task = createTask({
        docs: [{ url: 'http://example.com/api', section: 'calculateTotal' }]
      });
      const result = await detector.analyze(task);

      expect(result.factors.docs_available).toBe(true);
    });
  });

  describe('analyzeAll', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should analyze multiple tasks', async () => {
      const tasks = [
        createTask(),
        createMarkdownTask(),
        createDomainSpecificTask()
      ];
      const { stats, results } = await detector.analyzeAll(tasks);

      expect(stats.total).toBe(3);
      expect(results).toHaveLength(3);
    });

    test('should calculate aggregate statistics', async () => {
      const tasks = [
        createMarkdownTask(),  // High confidence
        createMarkdownTask(),  // High confidence
        createTask()           // Variable
      ];
      const { stats } = await detector.analyzeAll(tasks);

      expect(stats.total).toBe(3);
      expect(stats.high).toBeGreaterThanOrEqual(2);
      expect(stats.highPercent).toBeGreaterThanOrEqual(66);
    });

    test('should track low confidence tasks', async () => {
      // Create tasks that will have low confidence (domain-specific with no docs/examples)
      const lowConfidenceTask = {
        type: 'custom',
        file: 'src/quantum/simulator.ts',
        spec: {
          purpose: 'Quantum circuit simulator with CUDA acceleration'
        }
      };
      const tasks = [lowConfidenceTask];
      const { stats } = await detector.analyzeAll(tasks);

      expect(stats.low).toBeGreaterThanOrEqual(1);
      expect(stats.lowConfidenceTasks.length).toBeGreaterThanOrEqual(1);
    });

    test('should set needsAlert when many low confidence tasks', async () => {
      const lowConfidenceTasks = Array(4).fill(null).map(() => ({
        type: 'custom',
        file: 'src/exotic/feature.ts',
        spec: { purpose: 'Complex CUDA quantum blockchain neural network' }
      }));

      const { needsAlert } = await detector.analyzeAll(lowConfidenceTasks);
      expect(needsAlert).toBe(true);
    });

    test('should calculate average score', async () => {
      const tasks = [
        createMarkdownTask(),  // Score: 85
        createMarkdownTask()   // Score: 85
      ];
      const { stats } = await detector.analyzeAll(tasks);

      expect(stats.averageScore).toBe(85);
    });

    test('should count total risks', async () => {
      const tasks = [
        createTask(),
        createDomainSpecificTask()
      ];
      const { stats } = await detector.analyzeAll(tasks);

      expect(stats.totalRisks).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    let detector;

    beforeEach(() => {
      detector = new ConfidenceDetector();
    });

    test('should handle task with empty spec', async () => {
      const task = { type: 'create_function', file: 'src/test.ts', spec: {} };
      const result = await detector.analyze(task);
      expect(result).toHaveProperty('level');
    });

    test('should handle task without spec', async () => {
      const task = { type: 'create_function', file: 'src/test.ts' };
      const result = await detector.analyze(task);
      expect(result).toHaveProperty('level');
    });

    test('should handle unknown task type', async () => {
      const task = { type: 'unknown_type', file: 'src/test.ts', spec: {} };
      const result = await detector.analyze(task);
      expect(result.factors.known_pattern).toBe(false);
    });

    test('should handle empty docs array', async () => {
      const task = createTask({ docs: [] });
      const result = await detector.analyze(task);
      expect(result.factors.docs_available).toBe(false);
    });

    test('should handle task with null values', async () => {
      const task = {
        type: 'create_function',
        file: null,
        spec: { function: null }
      };
      // Should not throw
      const result = await detector.analyze(task);
      expect(result).toHaveProperty('level');
    });
  });
});
