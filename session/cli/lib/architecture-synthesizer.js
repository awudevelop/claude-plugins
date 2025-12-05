/**
 * Architecture Synthesizer
 *
 * Combines gateway detection and behavior extraction to produce
 * an architecture assessment with plain text output.
 *
 * This is the main entry point for behavior-based architecture detection.
 */

const path = require('path');
const fs = require('fs').promises;
const GatewayDetector = require('./gateway-detector');
const BehaviorExtractor = require('./behavior-extractor');

class ArchitectureSynthesizer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.gatewayDetector = new GatewayDetector(projectRoot);
    this.behaviorExtractor = new BehaviorExtractor();
  }

  /**
   * Analyze project architecture
   * @param {Array} files - Array of file objects with content
   * @param {Object} options - Analysis options
   * @returns {Object} Architecture assessment
   */
  async analyze(files, options = {}) {
    const {
      maxGateways = 10,
      includeEvidence = true,
      outputFormat = 'text' // 'text' | 'json' | 'brief'
    } = options;

    // Step 1: Find gateway files
    const gateways = await this.gatewayDetector.detectGateways(files);
    const topGateways = gateways.slice(0, maxGateways);

    // Step 2: Get content for gateway files
    const gatewayFiles = this.getFilesWithContent(files, topGateways);

    // Step 3: Extract behaviors from gateway files
    const behaviors = await this.behaviorExtractor.extractFromFiles(gatewayFiles);

    // Step 4: Check for API spec files
    const apiSpec = await this.detectApiSpec(files);

    // Step 5: Synthesize architecture type
    const architecture = this.synthesizeArchitecture(behaviors, gateways, apiSpec);

    // Step 6: Format output
    const assessment = {
      architecture,
      gateways: topGateways,
      behaviors: behaviors.summary,
      apiSpec,
      evidence: includeEvidence ? behaviors.evidence.slice(0, 10) : []
    };

    if (outputFormat === 'text') {
      assessment.formatted = this.formatAsText(assessment);
    } else if (outputFormat === 'brief') {
      assessment.formatted = this.formatAsBrief(assessment);
    }

    return assessment;
  }

  /**
   * Get file objects with content for the gateway files
   */
  getFilesWithContent(allFiles, gateways) {
    const gatewayPaths = new Set(gateways.map(g => g.file));
    return allFiles.filter(f => {
      const filePath = f.relativePath || f.path;
      return gatewayPaths.has(filePath);
    });
  }

  /**
   * Detect and parse API spec files
   */
  async detectApiSpec(files) {
    // Look for JSON files that might be API specs
    const jsonFiles = files.filter(f => {
      const ext = path.extname(f.path || f.relativePath).toLowerCase();
      const name = path.basename(f.path || f.relativePath).toLowerCase();
      return ext === '.json' && (
        name.includes('swagger') ||
        name.includes('openapi') ||
        name.includes('api') ||
        name.includes('postman') ||
        name.includes('spec')
      );
    });

    // Also check for large JSON files that might be API specs
    const largeJsonFiles = files.filter(f => {
      const ext = path.extname(f.path || f.relativePath).toLowerCase();
      return ext === '.json' && f.size > 10000; // > 10KB
    });

    const candidates = [...new Set([...jsonFiles, ...largeJsonFiles])];

    for (const file of candidates) {
      if (!file.content) continue;

      try {
        const content = JSON.parse(file.content);
        const spec = this.behaviorExtractor.extractApiSpec(content);

        if (spec.type !== 'unknown' && spec.endpoints.length > 0) {
          return {
            file: file.relativePath || file.path,
            ...spec
          };
        }
      } catch (err) {
        // Not valid JSON or not a spec
      }
    }

    return null;
  }

  /**
   * Synthesize architecture type from signals
   */
  synthesizeArchitecture(behaviors, gateways, apiSpec) {
    const signals = behaviors.signals || {};
    const signalNames = Object.keys(signals);

    // Check for specific architecture patterns
    const hasTraditionalServer = signalNames.includes('traditional-server');
    const hasTraditionalBackend = signalNames.includes('traditional-backend');
    const hasBaasAuth = signalNames.includes('baas-or-external-auth');
    const hasBaasDb = signalNames.includes('baas-or-external-db');
    const hasGraphqlServer = signalNames.includes('graphql-server');
    const hasGraphqlApi = signalNames.includes('graphql-api');
    const hasOrm = signalNames.includes('has-orm-layer');
    const hasExternalApi = signalNames.includes('calls-external-api');
    const hasReactFrontend = signalNames.includes('react-frontend');

    let type = 'unknown';
    let confidence = 'low';
    let description = 'Could not determine architecture pattern';
    const evidence = [];

    // BaaS Frontend (like auth_hub_v2)
    if ((hasBaasAuth || hasBaasDb) && !hasTraditionalServer && !hasTraditionalBackend) {
      type = 'baas-frontend';
      confidence = (hasBaasAuth && hasBaasDb) ? 'high' : 'medium';
      description = 'Frontend app using Backend-as-a-Service';

      if (hasBaasAuth) evidence.push('External authentication detected');
      if (hasBaasDb) evidence.push('External database queries detected');
      if (apiSpec) evidence.push(`API spec found: ${apiSpec.totalEndpoints} endpoints`);
    }
    // GraphQL Fullstack
    else if (hasGraphqlServer) {
      type = 'graphql-fullstack';
      confidence = 'high';
      description = 'GraphQL-based backend';
      evidence.push('GraphQL server patterns detected');
    }
    // Traditional Fullstack
    else if (hasTraditionalServer && (hasOrm || hasTraditionalBackend)) {
      type = 'traditional-fullstack';
      confidence = 'high';
      description = 'Traditional server with database';
      evidence.push('HTTP server patterns detected');
      if (hasOrm) evidence.push('ORM usage detected');
    }
    // API Backend
    else if (hasTraditionalServer && !hasReactFrontend) {
      type = 'api-backend';
      confidence = 'medium';
      description = 'API-only backend service';
      evidence.push('HTTP server patterns detected');
    }
    // Frontend calling external APIs
    else if (hasReactFrontend && hasExternalApi && !hasTraditionalServer) {
      type = 'frontend-external-api';
      confidence = 'medium';
      description = 'Frontend app calling external APIs';
      evidence.push('HTTP client calls detected');
    }
    // GraphQL Client
    else if (hasGraphqlApi && !hasGraphqlServer) {
      type = 'graphql-client';
      confidence = 'medium';
      description = 'Frontend using GraphQL API';
      evidence.push('GraphQL client patterns detected');
    }
    // Just has external service clients
    else if (signalNames.includes('external-service')) {
      type = 'external-service-client';
      confidence = 'low';
      description = 'Uses external service clients';
      evidence.push('External service client creation detected');
    }

    // Add gateway info to evidence
    if (gateways.length > 0) {
      const gatewayTypes = [...new Set(gateways.slice(0, 3).map(g => g.type))];
      evidence.push(`Gateway files: ${gatewayTypes.join(', ')}`);
    }

    return {
      type,
      confidence,
      description,
      evidence,
      signalCount: signalNames.length,
      dominantSignal: behaviors.summary?.dominant || null
    };
  }

  /**
   * Format assessment as plain text (token-efficient)
   */
  formatAsText(assessment) {
    const { architecture, gateways, behaviors, apiSpec, evidence } = assessment;
    const lines = [];

    // Architecture summary (most important)
    lines.push(`Architecture: ${architecture.type} (${architecture.confidence} confidence)`);
    lines.push(architecture.description);
    lines.push('');

    // Evidence
    if (architecture.evidence.length > 0) {
      lines.push('Evidence:');
      for (const ev of architecture.evidence) {
        lines.push(`  - ${ev}`);
      }
      lines.push('');
    }

    // Gateway files (key entry points)
    if (gateways.length > 0) {
      lines.push('Key Files:');
      for (const gw of gateways.slice(0, 5)) {
        lines.push(`  ${gw.file} (${gw.type})`);
      }
      lines.push('');
    }

    // API Spec info
    if (apiSpec) {
      lines.push(`API Spec: ${apiSpec.file}`);
      lines.push(`  Type: ${apiSpec.type} | Endpoints: ${apiSpec.totalEndpoints}`);
      lines.push('');
    }

    // Behavior signals
    if (behaviors.total > 0) {
      lines.push(`Behavior Signals: ${behaviors.total} detected`);
      const topSignals = behaviors.byWeight.slice(0, 3);
      for (const sig of topSignals) {
        lines.push(`  - ${sig.signal} (weight: ${sig.weight})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format assessment as brief one-liner
   */
  formatAsBrief(assessment) {
    const { architecture, apiSpec } = assessment;
    let brief = `${architecture.type} (${architecture.confidence})`;

    if (apiSpec) {
      brief += ` | ${apiSpec.totalEndpoints} API endpoints`;
    }

    return brief;
  }

  /**
   * Quick architecture check (minimal analysis)
   * Use when you just need the type, not full analysis
   */
  async quickAnalysis(files) {
    // Just check top 3 gateways
    const gateways = await this.gatewayDetector.getTopGateways(files, 3);

    if (gateways.length === 0) {
      return {
        type: 'unknown',
        confidence: 'low',
        formatted: 'Architecture: unknown (no gateway files found)'
      };
    }

    const gatewayFiles = this.getFilesWithContent(files, gateways);
    const behaviors = await this.behaviorExtractor.extractFromFiles(gatewayFiles);
    const architecture = this.synthesizeArchitecture(behaviors, gateways, null);

    return {
      ...architecture,
      formatted: `Architecture: ${architecture.type} (${architecture.confidence})`
    };
  }
}

module.exports = ArchitectureSynthesizer;
