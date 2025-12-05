/**
 * Gateway Detector
 *
 * Finds "gateway" files - entry points to external services, data layers,
 * and architectural boundaries using heuristic scoring.
 *
 * No hardcoded library names - uses code patterns and naming conventions.
 */

const path = require('path');
const fs = require('fs').promises;

class GatewayDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;

    // Scoring weights for different signals
    this.weights = {
      // Naming patterns (soft signals)
      nameContext: 25,
      nameProvider: 25,
      nameService: 20,
      nameClient: 20,
      nameApi: 15,
      nameGateway: 20,
      nameStore: 15,
      nameData: 10,
      nameRepository: 15,

      // Code structure patterns (stronger signals)
      hasCreateContext: 30,
      hasProviderExport: 25,
      hasCreateClient: 30,
      hasInitialize: 20,

      // External connection indicators
      hasExternalUrl: 25,
      hasEnvConfig: 15,
      hasAuthMethods: 30,
      hasDataMethods: 25,

      // File characteristics
      isEntryPoint: 20,
      highImportCount: 10,
      exportsProvider: 20
    };

    // Minimum score to be considered a gateway
    this.gatewayThreshold = 50;
  }

  /**
   * Find gateway files in a project
   * @param {Array} files - Array of file metadata with content
   * @returns {Array} Scored gateway files
   */
  async detectGateways(files) {
    const gateways = [];

    for (const file of files) {
      // Skip non-JS/TS files
      if (!this.isAnalyzableFile(file)) continue;

      const score = await this.calculateGatewayScore(file);

      if (score.total >= this.gatewayThreshold) {
        gateways.push({
          file: file.relativePath || file.path,
          score: score.total,
          signals: score.signals,
          type: this.classifyGateway(score.signals),
          priority: this.calculatePriority(score)
        });
      }
    }

    // Sort by score descending
    return gateways.sort((a, b) => b.score - a.score);
  }

  /**
   * Check if file is analyzable (JS/TS)
   */
  isAnalyzableFile(file) {
    const ext = path.extname(file.path || file.relativePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
  }

  /**
   * Calculate gateway score for a file
   */
  async calculateGatewayScore(file) {
    const content = file.content || '';
    const fileName = path.basename(file.path || file.relativePath).toLowerCase();
    const filePath = (file.relativePath || file.path).toLowerCase();

    const signals = [];
    let total = 0;

    // === Name-based scoring ===
    if (/context/i.test(fileName)) {
      signals.push('name:context');
      total += this.weights.nameContext;
    }
    if (/provider/i.test(fileName)) {
      signals.push('name:provider');
      total += this.weights.nameProvider;
    }
    if (/service/i.test(fileName)) {
      signals.push('name:service');
      total += this.weights.nameService;
    }
    if (/client/i.test(fileName)) {
      signals.push('name:client');
      total += this.weights.nameClient;
    }
    if (/api/i.test(fileName)) {
      signals.push('name:api');
      total += this.weights.nameApi;
    }
    if (/gateway/i.test(fileName)) {
      signals.push('name:gateway');
      total += this.weights.nameGateway;
    }
    if (/store/i.test(fileName)) {
      signals.push('name:store');
      total += this.weights.nameStore;
    }
    if (/data/i.test(fileName)) {
      signals.push('name:data');
      total += this.weights.nameData;
    }
    if (/repository|repo/i.test(fileName)) {
      signals.push('name:repository');
      total += this.weights.nameRepository;
    }

    // === Code structure patterns ===
    if (/createContext\s*\(/i.test(content)) {
      signals.push('code:createContext');
      total += this.weights.hasCreateContext;
    }
    if (/export\s+(default\s+)?.*Provider/i.test(content)) {
      signals.push('code:providerExport');
      total += this.weights.hasProviderExport;
    }
    if (/createClient\s*\(/i.test(content)) {
      signals.push('code:createClient');
      total += this.weights.hasCreateClient;
    }
    if (/initialize(App|Client|Firebase|Auth)?\s*\(/i.test(content)) {
      signals.push('code:initialize');
      total += this.weights.hasInitialize;
    }

    // === External connection indicators ===
    if (/['"`](https?:\/\/[^'"`]+)['"`]/.test(content)) {
      signals.push('connection:externalUrl');
      total += this.weights.hasExternalUrl;
    }
    if (/process\.env\.|import\.meta\.env\./i.test(content)) {
      signals.push('connection:envConfig');
      total += this.weights.hasEnvConfig;
    }
    if (/\.(signIn|signUp|signOut|login|logout|authenticate)/i.test(content)) {
      signals.push('connection:authMethods');
      total += this.weights.hasAuthMethods;
    }
    if (/\.(select|insert|update|delete|query|find|create)\s*\(/i.test(content)) {
      signals.push('connection:dataMethods');
      total += this.weights.hasDataMethods;
    }

    // === File characteristics ===
    // Entry point detection (index files, main files)
    if (/^(index|main|app)\.(js|ts|jsx|tsx)$/i.test(fileName)) {
      signals.push('file:entryPoint');
      total += this.weights.isEntryPoint;
    }

    // High import count (files that aggregate multiple modules)
    const importCount = (content.match(/^import\s/gm) || []).length;
    if (importCount > 5) {
      signals.push('file:highImports');
      total += this.weights.highImportCount;
    }

    return { total, signals };
  }

  /**
   * Classify the type of gateway based on signals
   */
  classifyGateway(signals) {
    const signalSet = new Set(signals);

    if (signalSet.has('code:createContext') && signalSet.has('code:providerExport')) {
      return 'context-provider';
    }
    if (signalSet.has('connection:authMethods')) {
      return 'auth-gateway';
    }
    if (signalSet.has('code:createClient') || signalSet.has('connection:externalUrl')) {
      return 'external-service';
    }
    if (signalSet.has('connection:dataMethods')) {
      return 'data-layer';
    }
    if (signalSet.has('name:api') || signalSet.has('name:service')) {
      return 'api-service';
    }

    return 'general';
  }

  /**
   * Calculate priority for analysis order
   */
  calculatePriority(score) {
    // Context providers are highest priority (they're architectural keystones)
    if (score.signals.includes('code:createContext')) return 1;
    // Auth gateways next
    if (score.signals.includes('connection:authMethods')) return 2;
    // External clients
    if (score.signals.includes('code:createClient')) return 3;
    // Data layers
    if (score.signals.includes('connection:dataMethods')) return 4;
    // Everything else
    return 5;
  }

  /**
   * Get top N gateway files (most important ones)
   */
  async getTopGateways(files, limit = 5) {
    const gateways = await this.detectGateways(files);
    return gateways.slice(0, limit);
  }

  /**
   * Format gateway detection results as plain text
   */
  formatAsText(gateways) {
    if (gateways.length === 0) {
      return 'No gateway files detected.';
    }

    const lines = ['Gateway Files Detected:', ''];

    for (const gw of gateways) {
      const signalSummary = gw.signals
        .map(s => s.split(':')[1])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 4)
        .join(', ');

      lines.push(`${gw.file}`);
      lines.push(`  Type: ${gw.type} | Score: ${gw.score} | Signals: ${signalSummary}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = GatewayDetector;
