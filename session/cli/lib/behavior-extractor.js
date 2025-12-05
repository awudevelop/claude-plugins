/**
 * Behavior Extractor
 *
 * Extracts behavior facts from code files by matching against patterns.
 * Uses behavior-patterns.json for pattern definitions.
 *
 * No hardcoded library names - uses stable code patterns.
 */

const path = require('path');
const fs = require('fs').promises;

class BehaviorExtractor {
  constructor() {
    this.patterns = null;
    this.patternsLoaded = false;
  }

  /**
   * Load patterns from behavior-patterns.json
   */
  async loadPatterns() {
    if (this.patternsLoaded) return;

    const patternsPath = path.join(__dirname, 'behavior-patterns.json');
    try {
      const content = await fs.readFile(patternsPath, 'utf-8');
      this.patterns = JSON.parse(content);
      this.patternsLoaded = true;
    } catch (err) {
      console.error('Failed to load behavior patterns:', err.message);
      this.patterns = { behaviors: {}, architectureTypes: {} };
      this.patternsLoaded = true;
    }
  }

  /**
   * Extract behaviors from a single file
   * @param {Object} file - File object with content
   * @returns {Object} Extracted behaviors
   */
  async extractFromFile(file) {
    await this.loadPatterns();

    const content = file.content || '';
    const filePath = file.relativePath || file.path;
    const detectedBehaviors = [];
    const evidence = [];

    // Test each behavior pattern
    for (const [behaviorId, behavior] of Object.entries(this.patterns.behaviors)) {
      const matches = this.matchBehavior(content, behavior.patterns);

      if (matches.length > 0) {
        detectedBehaviors.push({
          id: behaviorId,
          description: behavior.description,
          signal: behavior.architectureSignal,
          weight: behavior.weight,
          matchCount: matches.length,
          sampleMatches: matches.slice(0, 3) // Keep top 3 examples
        });

        // Add to evidence
        evidence.push({
          behavior: behaviorId,
          file: filePath,
          examples: matches.slice(0, 2).map(m => m.match)
        });
      }
    }

    return {
      file: filePath,
      behaviors: detectedBehaviors,
      evidence,
      signals: [...new Set(detectedBehaviors.map(b => b.signal))],
      totalWeight: detectedBehaviors.reduce((sum, b) => sum + b.weight, 0)
    };
  }

  /**
   * Extract behaviors from multiple files
   * @param {Array} files - Array of file objects with content
   * @returns {Object} Aggregated behaviors
   */
  async extractFromFiles(files) {
    await this.loadPatterns();

    const fileResults = [];
    const allSignals = new Map(); // signal -> {count, weight, files}
    const allEvidence = [];

    for (const file of files) {
      const result = await this.extractFromFile(file);
      fileResults.push(result);

      // Aggregate signals
      for (const behavior of result.behaviors) {
        const existing = allSignals.get(behavior.signal) || {
          count: 0,
          weight: 0,
          files: [],
          behaviors: []
        };
        existing.count++;
        existing.weight += behavior.weight;
        existing.files.push(result.file);
        existing.behaviors.push(behavior.id);
        allSignals.set(behavior.signal, existing);
      }

      allEvidence.push(...result.evidence);
    }

    return {
      files: fileResults,
      signals: Object.fromEntries(allSignals),
      evidence: allEvidence,
      summary: this.summarizeSignals(allSignals)
    };
  }

  /**
   * Match behavior patterns against content
   */
  matchBehavior(content, patterns) {
    const matches = [];

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'gm');
        let match;
        while ((match = regex.exec(content)) !== null) {
          // Get line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

          matches.push({
            pattern: pattern,
            match: match[0].substring(0, 60), // Truncate long matches
            line: lineNumber
          });
        }
      } catch (err) {
        // Invalid regex pattern, skip
        console.error(`Invalid pattern: ${pattern}`, err.message);
      }
    }

    return matches;
  }

  /**
   * Summarize signals for quick overview
   */
  summarizeSignals(signalsMap) {
    const summary = {
      total: signalsMap.size,
      byWeight: [],
      dominant: null
    };

    // Convert to array and sort by weight
    const signals = Array.from(signalsMap.entries())
      .map(([signal, data]) => ({
        signal,
        ...data
      }))
      .sort((a, b) => b.weight - a.weight);

    summary.byWeight = signals;

    if (signals.length > 0) {
      summary.dominant = signals[0].signal;
    }

    return summary;
  }

  /**
   * Format extraction results as plain text
   */
  formatAsText(results) {
    const lines = [];

    // Summary
    lines.push('Behavior Analysis:');
    lines.push('');

    if (results.summary.total === 0) {
      lines.push('No specific behaviors detected.');
      return lines.join('\n');
    }

    // Detected signals
    lines.push(`Detected ${results.summary.total} behavior signals:`);
    for (const sig of results.summary.byWeight.slice(0, 5)) {
      const behaviors = [...new Set(sig.behaviors)].join(', ');
      lines.push(`  - ${sig.signal} (weight: ${sig.weight})`);
      lines.push(`    Behaviors: ${behaviors}`);
    }
    lines.push('');

    // Key evidence
    if (results.evidence.length > 0) {
      lines.push('Key Evidence:');
      const topEvidence = results.evidence.slice(0, 5);
      for (const ev of topEvidence) {
        const example = ev.examples[0] || '';
        lines.push(`  ${ev.file}: ${ev.behavior}`);
        if (example) {
          lines.push(`    → ${example.substring(0, 50)}...`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract API spec structure from JSON content
   * Works on any format with endpoint-like structure
   */
  extractApiSpec(jsonContent) {
    const endpoints = [];

    // Try OpenAPI/Swagger
    if (jsonContent.openapi || jsonContent.swagger) {
      return this.extractOpenApiEndpoints(jsonContent);
    }

    // Try Postman
    if (jsonContent.info?.schema?.includes('postman') ||
        (jsonContent.item && Array.isArray(jsonContent.item))) {
      return this.extractPostmanEndpoints(jsonContent);
    }

    // Try generic detection
    if (this.hasEndpointStructure(jsonContent)) {
      return this.extractGenericEndpoints(jsonContent);
    }

    return { type: 'unknown', endpoints: [] };
  }

  /**
   * Check if JSON has endpoint-like structure
   */
  hasEndpointStructure(content) {
    const json = JSON.stringify(content);
    const hasHttpMethods = /"(get|post|put|delete|patch)":/i.test(json);
    const hasUrlPatterns = /"(path|url|endpoint|route)":/i.test(json);
    return hasHttpMethods || hasUrlPatterns || content.paths;
  }

  /**
   * Extract endpoints from OpenAPI spec
   */
  extractOpenApiEndpoints(spec) {
    const endpoints = [];
    const paths = spec.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const method of Object.keys(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
          endpoints.push({
            method: method.toUpperCase(),
            path,
            summary: methods[method].summary || '',
            tags: methods[method].tags || []
          });
        }
      }
    }

    return {
      type: 'openapi',
      version: spec.openapi || spec.swagger,
      endpoints,
      totalEndpoints: endpoints.length
    };
  }

  /**
   * Extract endpoints from Postman collection
   */
  extractPostmanEndpoints(collection, endpoints = []) {
    const items = collection.item || [];

    for (const item of items) {
      if (item.request) {
        endpoints.push({
          method: item.request.method || 'GET',
          path: this.extractPostmanUrl(item.request.url),
          name: item.name || ''
        });
      }
      if (item.item) {
        // Recurse into folders
        this.extractPostmanEndpoints({ item: item.item }, endpoints);
      }
    }

    return {
      type: 'postman',
      name: collection.info?.name || 'Unknown',
      endpoints,
      totalEndpoints: endpoints.length
    };
  }

  /**
   * Extract URL from Postman URL object
   */
  extractPostmanUrl(url) {
    if (typeof url === 'string') return url;
    if (url?.raw) return url.raw;
    if (url?.path) {
      return '/' + (Array.isArray(url.path) ? url.path.join('/') : url.path);
    }
    return '/unknown';
  }

  /**
   * Extract endpoints from generic JSON structure
   */
  extractGenericEndpoints(content) {
    const endpoints = [];

    // Recursive search for endpoint-like objects
    const search = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;

      // Check if this object looks like an endpoint
      if (this.isEndpointLike(obj)) {
        endpoints.push(this.normalizeEndpoint(obj));
        return;
      }

      // Recurse
      for (const [key, value] of Object.entries(obj)) {
        search(value, `${path}/${key}`);
      }
    };

    search(content);

    return {
      type: 'generic',
      endpoints,
      totalEndpoints: endpoints.length
    };
  }

  /**
   * Check if object looks like an endpoint definition
   */
  isEndpointLike(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    const hasMethod = keys.some(k =>
      ['get', 'post', 'put', 'delete', 'patch', 'method'].includes(k)
    );
    const hasPath = keys.some(k =>
      ['path', 'url', 'endpoint', 'route', 'uri'].includes(k)
    );
    return hasMethod || hasPath;
  }

  /**
   * Normalize endpoint object to standard format
   */
  normalizeEndpoint(obj) {
    const methodKeys = ['method', 'type', 'verb'];
    const pathKeys = ['path', 'url', 'endpoint', 'route', 'uri'];

    let method = 'GET';
    let path = '/';

    for (const key of methodKeys) {
      if (obj[key]) {
        method = String(obj[key]).toUpperCase();
        break;
      }
    }

    for (const key of pathKeys) {
      if (obj[key]) {
        path = String(obj[key]);
        break;
      }
    }

    return { method, path };
  }
}

module.exports = BehaviorExtractor;
