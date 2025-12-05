/**
 * Intent Router
 * Maps natural language questions to appropriate project map queries
 */

const path = require('path');
const MapLoader = require('./map-loader');

// Load intent patterns
const intentPatterns = require('./intent-patterns.json');

class IntentRouter {
  constructor(projectPath) {
    this.projectPath = projectPath || process.cwd();
    this.loader = new MapLoader(this.projectPath);
    this.patterns = intentPatterns;
  }

  /**
   * Normalize text for matching
   */
  normalize(text) {
    return text.toLowerCase().trim();
  }

  /**
   * Check if text contains any of the keywords
   */
  matchesKeywords(text, keywords) {
    const normalized = this.normalize(text);
    return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
  }

  /**
   * Check if text matches any of the regex patterns
   */
  matchesPatterns(text, patterns) {
    const normalized = this.normalize(text);
    return patterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(normalized);
      } catch {
        return false;
      }
    });
  }

  /**
   * Expand synonyms in the question
   */
  expandSynonyms(text) {
    let expanded = this.normalize(text);
    const synonyms = this.patterns.synonyms || {};

    for (const [canonical, alternatives] of Object.entries(synonyms)) {
      for (const alt of alternatives) {
        // Replace synonym with canonical term
        const regex = new RegExp(`\\b${alt}\\b`, 'gi');
        expanded = expanded.replace(regex, canonical);
      }
    }

    return expanded;
  }

  /**
   * Calculate match score for an intent
   */
  scoreIntent(question, intent) {
    const expanded = this.expandSynonyms(question);
    let score = 0;

    // Check keywords (each match adds 1 point)
    const keywords = intent.keywords || [];
    for (const keyword of keywords) {
      if (expanded.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Check patterns (each match adds 2 points - more specific)
    const patterns = intent.patterns || [];
    for (const pattern of patterns) {
      try {
        if (new RegExp(pattern, 'i').test(expanded)) {
          score += 2;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return score;
  }

  /**
   * Classify a natural language question into one or more intents
   * @param {string} question - Natural language question
   * @returns {Object} Classification result with matched intents and queries
   */
  classifyIntent(question) {
    if (!question || typeof question !== 'string') {
      return {
        success: false,
        error: 'Question must be a non-empty string',
        intents: [],
        queries: []
      };
    }

    const intents = this.patterns.intents || {};
    const scores = [];

    // Score each intent
    for (const [intentName, intent] of Object.entries(intents)) {
      const score = this.scoreIntent(question, intent);
      if (score > 0) {
        scores.push({
          intent: intentName,
          score,
          description: intent.description,
          queries: intent.queries
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // If no matches, use fallback
    if (scores.length === 0) {
      const fallback = this.patterns.fallback || { queries: ['summary'] };
      return {
        success: true,
        matched: false,
        message: fallback.message || 'No specific intent matched, showing summary.',
        intents: [{ intent: 'fallback', score: 0, queries: fallback.queries }],
        queries: fallback.queries,
        confidence: 'low'
      };
    }

    // Get top matches (within 50% of best score)
    const topScore = scores[0].score;
    const topMatches = scores.filter(s => s.score >= topScore * 0.5);

    // Collect unique queries from top matches
    const querySet = new Set();
    for (const match of topMatches) {
      for (const query of match.queries) {
        querySet.add(query);
      }
    }

    // Determine confidence
    let confidence = 'low';
    if (topScore >= 4) confidence = 'high';
    else if (topScore >= 2) confidence = 'medium';

    return {
      success: true,
      matched: true,
      intents: topMatches,
      queries: Array.from(querySet),
      primaryIntent: scores[0].intent,
      confidence
    };
  }

  /**
   * Execute queries for a classified intent
   * @param {string} question - Natural language question
   * @returns {Object} Combined query results
   */
  async executeIntent(question) {
    // First classify the intent
    const classification = this.classifyIntent(question);

    if (!classification.success) {
      return classification;
    }

    // Check if maps exist
    const exists = await this.loader.exists();
    if (!exists) {
      return {
        success: false,
        error: 'No maps found for this project',
        suggestion: 'Run: /session:project-maps-generate to create maps first'
      };
    }

    // Execute each query
    const results = {};
    const errors = [];

    for (const queryName of classification.queries) {
      try {
        const result = await this.executeQuery(queryName);
        results[queryName] = result;
      } catch (error) {
        errors.push({ query: queryName, error: error.message });
      }
    }

    return {
      success: true,
      question,
      classification: {
        primaryIntent: classification.primaryIntent,
        confidence: classification.confidence,
        matchedIntents: classification.intents.map(i => i.intent)
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Execute a single query type
   */
  async executeQuery(queryType) {
    // Map query types to their handlers
    const queryHandlers = {
      'summary': async () => await this.loader.load('quick-queries'),
      'entry-points': async () => {
        const qq = await this.loader.load('quick-queries');
        return { primary: qq.entryPoint, all: qq.allEntryPoints };
      },
      'framework': async () => {
        const qq = await this.loader.load('quick-queries');
        return qq.framework;
      },
      'tests': async () => {
        const qq = await this.loader.load('quick-queries');
        return { framework: qq.testingFramework, location: qq.testLocation };
      },
      'largest': async () => {
        const qq = await this.loader.load('quick-queries');
        return qq.largestFiles;
      },
      'recent': async () => {
        const qq = await this.loader.load('quick-queries');
        return qq.recentlyModified || qq.recentFiles;
      },
      'structure': async () => {
        const qq = await this.loader.load('quick-queries');
        return qq.topLevelStructure;
      },
      'languages': async () => {
        const qq = await this.loader.load('quick-queries');
        return qq.primaryLanguages;
      },
      'backend-layers': async () => {
        const map = await this.loader.load('backend-layers');

        // Prefer behavior-based analysis if available (more accurate for BaaS, serverless)
        const behaviorAnalysis = map.behaviorAnalysis;

        return {
          // Traditional folder-based detection
          architecture: map.architecture,
          layers: Object.keys(map.layers || {}).map(layer => ({
            name: layer,
            files: (map.layers[layer] || []).length
          })),
          statistics: map.statistics,

          // Behavior-based analysis (if available)
          behaviorAnalysis: behaviorAnalysis ? {
            type: behaviorAnalysis.architecture?.type,
            confidence: behaviorAnalysis.architecture?.confidence,
            description: behaviorAnalysis.architecture?.description,
            evidence: behaviorAnalysis.architecture?.evidence,
            gateways: behaviorAnalysis.gateways,
            apiSpec: behaviorAnalysis.apiSpec,
            formatted: behaviorAnalysis.formatted
          } : null
        };
      },
      'modules': async () => {
        const map = await this.loader.load('modules');
        return {
          totalModules: map.summary?.totalModules || 0,
          modules: Object.keys(map.modules || {}).map(name => ({
            name,
            fileCount: map.modules[name]?.stats?.fileCount || 0
          }))
        };
      },
      'module-deps': async () => {
        const map = await this.loader.load('module-dependencies');
        return { summary: map.summary, dependencies: map.dependencies };
      },
      'components': async () => {
        const map = await this.loader.load('frontend-components');
        return {
          framework: map.framework,
          statistics: map.statistics,
          components: Object.keys(map.components || {}).slice(0, 20).map(path => ({
            name: map.components[path]?.name,
            path,
            layer: map.components[path]?.layer
          }))
        };
      },
      'component-meta': async () => {
        const map = await this.loader.load('component-metadata');
        return {
          framework: map.framework,
          coverage: map.coverage,
          metadata: Object.keys(map.metadata || {}).slice(0, 15).map(path => ({
            name: map.metadata[path]?.name,
            hooks: map.metadata[path]?.hooks || [],
            state: map.metadata[path]?.state || []
          }))
        };
      },
      'database': async () => {
        const map = await this.loader.load('database-schema');
        return {
          detection: map.detection?.summary,
          tables: map.tables || [],
          statistics: map.statistics
        };
      },
      'table-mapping': async () => {
        const map = await this.loader.load('table-module-mapping');
        return {
          tablesToModules: map.tablesToModules || {},
          modulesToTables: map.modulesToTables || {},
          statistics: map.statistics
        };
      },
      'dependencies': async () => {
        const forward = await this.loader.load('dependencies-forward');
        const reverse = await this.loader.load('dependencies-reverse');
        return {
          forward: { totalFiles: Object.keys(forward.dependencies || {}).length },
          reverse: { totalFiles: Object.keys(reverse.dependencies || {}).length }
        };
      },
      'relationships': async () => {
        const map = await this.loader.load('relationships');
        return {
          totalRelationships: Object.keys(map.relationships || {}).length
        };
      },
      'issues': async () => {
        const map = await this.loader.load('issues');
        const summary = map.sum || map.summary || {};
        return {
          summary: {
            brokenImports: summary.brokenImports || 0,
            circularDependencies: summary.circularDependencies || 0,
            unusedFiles: summary.unusedFiles || 0,
            totalIssues: summary.totalIssues || 0
          }
        };
      },
      'data-flow': async () => {
        const map = await this.loader.load('data-flow');
        return {
          architecture: map.architecture,
          statistics: map.statistics
        };
      }
    };

    const handler = queryHandlers[queryType];
    if (!handler) {
      throw new Error(`Unknown query type: ${queryType}`);
    }

    return await handler();
  }

  /**
   * Get available intents for help text
   */
  getAvailableIntents() {
    const intents = this.patterns.intents || {};
    return Object.entries(intents).map(([name, intent]) => ({
      name,
      description: intent.description,
      examples: intent.keywords.slice(0, 3)
    }));
  }
}

module.exports = IntentRouter;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node intent-router.js <question>');
    console.log('Examples:');
    console.log('  node intent-router.js "what framework is this project using?"');
    console.log('  node intent-router.js "what would break if I change auth.js?"');
    console.log('  node intent-router.js "where are the tests?"');
    process.exit(1);
  }

  const question = args.join(' ');
  const router = new IntentRouter(process.cwd());

  (async () => {
    try {
      const result = await router.executeIntent(question);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
