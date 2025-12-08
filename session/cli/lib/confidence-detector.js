/**
 * Confidence Detector
 *
 * Calculates confidence levels for tasks based on multiple factors:
 * - Has example in codebase (30 points)
 * - Known pattern type (25 points)
 * - No domain expertise required (20 points)
 * - Documentation available (15 points)
 * - Matches project conventions (10 points)
 *
 * Levels:
 * - high: 70-100
 * - medium: 40-69
 * - low: 0-39
 */

const MapLoader = require('./map-loader');

/**
 * Weights for confidence factors
 */
const WEIGHTS = {
  has_example: 30,          // Most important - can copy pattern
  known_pattern: 25,        // Standard task type
  domain_expertise: 20,     // No special expertise needed
  docs_available: 15,       // Can reference documentation
  project_convention: 10    // Follows project structure
};

/**
 * Known patterns that are well-understood
 */
const KNOWN_PATTERNS = [
  'create_class', 'create_function', 'create_interface',
  'create_hook', 'create_component', 'create_context',
  'create_table', 'create_migration', 'create_rpc',
  'create_config', 'create_package_json', 'create_barrel',
  'create_test', 'add_dependency', 'create_cli_command',
  'create_readme', 'modify_markdown', 'create_directory'
];

/**
 * Domain keywords that indicate specialized expertise needed
 */
const DOMAIN_KEYWORDS = [
  // Crypto/Security
  'encrypt', 'decrypt', 'hash', 'cipher', 'crypto', 'jwt', 'oauth',
  'hmac', 'rsa', 'aes', 'certificate', 'ssl', 'tls',
  // Low-level
  'cuda', 'gpu', 'simd', 'assembly', 'kernel', 'driver', 'syscall',
  'memory', 'pointer', 'buffer', 'overflow', 'alloc',
  // Domain-specific
  'quantum', 'blockchain', 'ml', 'neural', 'trading', 'medical',
  'physics', 'chemistry', 'bioinformatics', 'genomics',
  // Infrastructure
  'kubernetes', 'k8s', 'terraform', 'ansible', 'nginx', 'haproxy',
  'docker', 'container', 'orchestration', 'mesh', 'istio',
  // Legacy/Exotic
  'mainframe', 'cobol', 'fortran', 'legacy', 'soap', 'xml-rpc'
];

/**
 * High confidence task types (prose/markdown)
 */
const HIGH_CONFIDENCE_TYPES = [
  'create_readme', 'modify_markdown', 'create_directory'
];

class ConfidenceDetector {
  /**
   * @param {Object} options
   * @param {string} options.projectRoot - Project root directory
   * @param {Object} options.docs - Available documentation
   */
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.docs = options.docs || [];
    this.mapLoader = null;
    this._mapsLoaded = false;
    this._maps = {};
  }

  /**
   * Initialize project maps (lazy loading)
   */
  async initMaps() {
    if (this._mapsLoaded) return;

    try {
      this.mapLoader = new MapLoader(this.projectRoot);
      this._maps = {
        tree: await this.mapLoader.load('tree').catch(() => null),
        signatures: await this.mapLoader.load('function-signatures').catch(() => null),
        types: await this.mapLoader.load('types-map').catch(() => null),
        modules: await this.mapLoader.load('modules').catch(() => null)
      };
      this._mapsLoaded = true;
    } catch (err) {
      // Maps not available - continue without them
      this._mapsLoaded = true;
    }
  }

  /**
   * Analyze task and return confidence assessment
   * @param {Object} task - Task object with type, file, spec, docs
   * @returns {Promise<Object>} Confidence assessment
   */
  async analyze(task) {
    await this.initMaps();

    // High confidence types get automatic high score
    if (HIGH_CONFIDENCE_TYPES.includes(task.type)) {
      return this._buildHighConfidenceResult(task);
    }

    const factors = {
      has_example: await this.hasExample(task),
      known_pattern: this.isKnownPattern(task),
      domain_expertise: !this.requiresDomainExpertise(task),
      docs_available: this.hasDocumentation(task),
      project_convention: await this.matchesProjectConvention(task)
    };

    const score = this.calculateScore(factors);
    const level = this.scoreToLevel(score);
    const risks = this.identifyRisks(task, factors);
    const mitigations = this.suggestMitigations(risks);

    return {
      level,
      score,
      factors,
      risks,
      mitigations
    };
  }

  /**
   * Build high confidence result for markdown/prose tasks
   */
  _buildHighConfidenceResult(task) {
    return {
      level: 'high',
      score: 85,
      factors: {
        has_example: true,  // Markdown is a known format
        known_pattern: true,
        domain_expertise: true,
        docs_available: false,
        project_convention: true
      },
      risks: [],
      mitigations: []
    };
  }

  /**
   * Check if similar code exists in project
   * @param {Object} task
   * @returns {Promise<boolean>}
   */
  async hasExample(task) {
    if (!this._maps.signatures && !this._maps.types) {
      return false;
    }

    const spec = task.spec || {};

    // Search strategies based on task type
    switch (task.type) {
      case 'create_class':
        return this._searchForClass(spec.class);

      case 'create_function':
        return this._searchForFunction(spec.function);

      case 'create_hook':
        return this._searchForHook(spec.hook);

      case 'create_component':
        return this._searchForComponent(spec.component);

      case 'create_interface':
        return this._searchForType(spec.interface);

      case 'create_table':
      case 'create_migration':
      case 'create_rpc':
        // Database-related - check if similar patterns exist
        return this._searchForDatabasePattern(task.type);

      default:
        // Check file location pattern
        return this._searchForFilePattern(task.file);
    }
  }

  /**
   * Search for similar class in signatures
   */
  async _searchForClass(className) {
    if (!className || !this._maps.signatures) return false;

    const signatures = this._maps.signatures;
    if (!signatures.classes) return false;

    // Look for classes with similar names or purposes
    const classNames = Object.keys(signatures.classes || {});
    return classNames.some(name =>
      name.toLowerCase().includes(className.toLowerCase()) ||
      className.toLowerCase().includes(name.toLowerCase())
    );
  }

  /**
   * Search for similar function in signatures
   */
  async _searchForFunction(functionName) {
    if (!functionName || !this._maps.signatures) return false;

    const signatures = this._maps.signatures;
    if (!signatures.functions) return false;

    // Check if any function has similar name pattern
    return signatures.functions.some(fn => {
      const fnName = fn.name || '';
      return fnName.toLowerCase().includes(functionName.toLowerCase()) ||
             functionName.toLowerCase().includes(fnName.toLowerCase());
    });
  }

  /**
   * Search for similar hook
   */
  async _searchForHook(hookName) {
    if (!hookName || !this._maps.signatures) return false;

    const signatures = this._maps.signatures;
    const hooks = signatures.hooks || signatures.functions?.filter(f =>
      f.name && f.name.startsWith('use')
    );

    if (!hooks || hooks.length === 0) return false;

    return hooks.some(hook => {
      const name = hook.name || hook;
      return name.toLowerCase().includes(hookName.toLowerCase().replace('use', ''));
    });
  }

  /**
   * Search for similar component
   */
  async _searchForComponent(componentName) {
    if (!componentName || !this._maps.signatures) return false;

    const signatures = this._maps.signatures;
    const components = signatures.components || signatures.exports?.filter(e =>
      e.type === 'component' || e.name?.[0] === e.name?.[0]?.toUpperCase()
    );

    if (!components || components.length === 0) return false;

    return components.some(comp => {
      const name = comp.name || comp;
      return name.toLowerCase().includes(componentName.toLowerCase());
    });
  }

  /**
   * Search for similar type/interface
   */
  async _searchForType(typeName) {
    if (!typeName || !this._maps.types) return false;

    const types = this._maps.types;
    const typeNames = Object.keys(types.interfaces || {})
      .concat(Object.keys(types.types || {}));

    return typeNames.some(name =>
      name.toLowerCase().includes(typeName.toLowerCase())
    );
  }

  /**
   * Search for database-related patterns
   */
  async _searchForDatabasePattern(taskType) {
    // If we have any database-related files, there are patterns to follow
    if (!this._maps.tree) return false;

    const tree = this._maps.tree;
    const files = tree.files || [];

    const dbPatterns = [
      'migration', 'supabase', 'schema', 'database',
      '.sql', 'prisma', 'drizzle', 'knex'
    ];

    return files.some(file => {
      // Handle both object format {name, path} and string format
      const fileName = typeof file === 'string' ? file : (file.name || '');
      return dbPatterns.some(pattern => fileName.toLowerCase().includes(pattern));
    });
  }

  /**
   * Search for similar file location pattern
   */
  async _searchForFilePattern(filePath) {
    if (!filePath || !this._maps.tree) return false;

    const tree = this._maps.tree;
    const files = tree.files || [];

    // Get the directory from the file path
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Check if similar directory structure exists
    return files.some(file => {
      // Handle both object format {name, path} and string format
      const fileName = typeof file === 'string' ? file : (file.name || '');
      return fileName.startsWith(dir);
    });
  }

  /**
   * Check if task type follows known patterns
   * @param {Object} task
   * @returns {boolean}
   */
  isKnownPattern(task) {
    return KNOWN_PATTERNS.includes(task.type);
  }

  /**
   * Check if task requires domain expertise
   * @param {Object} task
   * @returns {boolean}
   */
  requiresDomainExpertise(task) {
    const taskText = JSON.stringify(task).toLowerCase();
    return DOMAIN_KEYWORDS.some(kw => taskText.includes(kw));
  }

  /**
   * Check if documentation is available for this task
   * @param {Object} task
   * @returns {boolean}
   */
  hasDocumentation(task) {
    // Check task-level docs
    if (task.docs && task.docs.length > 0) {
      return true;
    }

    // Check global docs passed to detector
    if (this.docs && this.docs.length > 0) {
      // Check if any doc is relevant to this task
      const taskText = JSON.stringify(task).toLowerCase();
      return this.docs.some(doc => {
        const docText = JSON.stringify(doc).toLowerCase();
        // Simple keyword overlap check
        const taskWords = taskText.match(/\w+/g) || [];
        const docWords = docText.match(/\w+/g) || [];
        const overlap = taskWords.filter(w => docWords.includes(w));
        return overlap.length > 5; // At least 5 common words
      });
    }

    return false;
  }

  /**
   * Check if task matches project conventions
   * @param {Object} task
   * @returns {Promise<boolean>}
   */
  async matchesProjectConvention(task) {
    if (!this._maps.tree) return false;

    const tree = this._maps.tree;

    // Check if target directory exists in project
    if (task.file) {
      const dir = task.file.substring(0, task.file.lastIndexOf('/'));
      const directories = tree.directories || [];
      const files = tree.files || [];

      // Check if directory exists or similar files exist
      // Handle both object format {name, path} and string format
      return directories.includes(dir) ||
             files.some(f => {
               const fileName = typeof f === 'string' ? f : (f.name || '');
               return fileName.startsWith(dir + '/');
             });
    }

    return false;
  }

  /**
   * Calculate confidence score from factors
   * @param {Object} factors
   * @returns {number}
   */
  calculateScore(factors) {
    let score = 0;

    for (const [factor, value] of Object.entries(factors)) {
      if (value && WEIGHTS[factor]) {
        score += WEIGHTS[factor];
      }
    }

    return score;
  }

  /**
   * Convert score to level
   * @param {number} score
   * @returns {string}
   */
  scoreToLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Identify risks for the task
   * @param {Object} task
   * @param {Object} factors
   * @returns {string[]}
   */
  identifyRisks(task, factors) {
    const risks = [];

    if (!factors.has_example) {
      risks.push('No similar code in project to reference');
    }

    if (!factors.known_pattern) {
      risks.push('Non-standard task type - may require custom handling');
    }

    if (!factors.domain_expertise) {
      risks.push('May require domain expertise not available');
    }

    if (!factors.project_convention) {
      risks.push('File location may not match project conventions');
    }

    if (task.type === 'custom') {
      risks.push('Custom task type - implementation details unclear');
    }

    // Check for specific risky patterns
    const taskText = JSON.stringify(task).toLowerCase();

    if (taskText.includes('security') || taskText.includes('auth')) {
      risks.push('Security-sensitive code - extra review recommended');
    }

    if (taskText.includes('payment') || taskText.includes('billing')) {
      risks.push('Payment-related code - thorough testing required');
    }

    return risks;
  }

  /**
   * Suggest mitigations for identified risks
   * @param {string[]} risks
   * @returns {string[]}
   */
  suggestMitigations(risks) {
    const mitigationMap = {
      'No similar code': 'Provide example file with --reference',
      'Non-standard task': 'Use detailed spec with explicit implementation steps',
      'domain expertise': 'Add documentation URL with --docs',
      'project conventions': 'Verify file location with maintainer',
      'Custom task': 'Provide skeleton code or detailed steps in spec',
      'Security-sensitive': 'Add security review step before merge',
      'Payment-related': 'Include integration tests with sandbox environment'
    };

    return risks.map(risk => {
      const key = Object.keys(mitigationMap).find(k =>
        risk.toLowerCase().includes(k.toLowerCase())
      );
      return key ? mitigationMap[key] : 'Review task manually before execution';
    });
  }

  /**
   * Analyze multiple tasks and return aggregate statistics
   * @param {Object[]} tasks
   * @returns {Promise<Object>}
   */
  async analyzeAll(tasks) {
    const results = await Promise.all(
      tasks.map(task => this.analyze(task))
    );

    const stats = {
      total: tasks.length,
      high: 0,
      medium: 0,
      low: 0,
      lowConfidenceTasks: [],
      averageScore: 0,
      totalRisks: 0
    };

    let scoreSum = 0;

    results.forEach((result, index) => {
      scoreSum += result.score;
      stats.totalRisks += result.risks.length;

      switch (result.level) {
        case 'high':
          stats.high++;
          break;
        case 'medium':
          stats.medium++;
          break;
        case 'low':
          stats.low++;
          stats.lowConfidenceTasks.push({
            task: tasks[index],
            confidence: result
          });
          break;
      }
    });

    stats.averageScore = Math.round(scoreSum / tasks.length);
    stats.highPercent = Math.round((stats.high / stats.total) * 100);
    stats.mediumPercent = Math.round((stats.medium / stats.total) * 100);
    stats.lowPercent = Math.round((stats.low / stats.total) * 100);

    return {
      stats,
      results, // Individual results for each task
      needsAlert: stats.low >= 3 // Alert if 3+ low-confidence tasks
    };
  }
}

module.exports = { ConfidenceDetector, WEIGHTS, KNOWN_PATTERNS, DOMAIN_KEYWORDS };
