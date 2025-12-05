const path = require('path');
const fs = require('fs').promises;
const ArchitectureSynthesizer = require('./architecture-synthesizer');

/**
 * Architecture Pattern Detector for Backend Systems
 * Identifies architectural patterns and layer organization
 *
 * Detects:
 * - MVC (Model-View-Controller)
 * - Layered Architecture (presentation, business, data)
 * - Clean Architecture (domain, application, infrastructure)
 * - Microservices
 * - Hexagonal/Ports & Adapters
 *
 * Task 6-1: Detect backend architecture pattern
 */

class ArchitectureDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;

    // Architectural layer patterns
    this.layerPatterns = {
      // MVC layers
      models: /\/(models?|entities?)\//i,
      views: /\/(views?|templates?)\//i,
      controllers: /\/(controllers?)\//i,

      // Layered architecture
      presentation: /\/(presentation|ui|frontend|client)\//i,
      business: /\/(business|domain|core)\//i,
      data: /\/(data|persistence|repository|repositories)\//i,

      // Clean architecture
      domain: /\/(domain|entities?)\//i,
      application: /\/(application|use-?cases?|services?)\//i,
      infrastructure: /\/(infrastructure|adapters?|external)\//i,

      // Common layers
      routes: /\/(routes?|routing|router)\//i,
      middleware: /\/(middleware?|middlewares?)\//i,
      services: /\/(services?|service-layer)\//i,
      repositories: /\/(repositories?|repos?|data-access)\//i,
      api: /\/(api|rest|graphql)\//i,
      database: /\/(database|db|models?|schemas?)\//i,
      utils: /\/(utils?|utilities?|helpers?)\//i,
      config: /\/(config|configuration|settings)\//i
    };

    // File naming patterns for layer detection
    this.fileNamePatterns = {
      controller: /controller\.(js|ts)$/i,
      model: /model\.(js|ts)$/i,
      service: /service\.(js|ts)$/i,
      repository: /repository\.(js|ts)$/i,
      route: /route[s]?\.(js|ts)$/i,
      middleware: /middleware\.(js|ts)$/i,
      schema: /schema\.(js|ts)$/i,
      entity: /entity\.(js|ts)$/i,
      dto: /dto\.(js|ts)$/i,
      mapper: /mapper\.(js|ts)$/i
    };
  }

  /**
   * Detect architecture pattern from scanned files (folder-based)
   * @param {Array} scannedFiles - Array of file metadata
   * @returns {Object} Architecture detection results
   */
  detectArchitecture(scannedFiles) {
    const layerCounts = this.countLayers(scannedFiles);
    const patterns = this.identifyPatterns(layerCounts, scannedFiles);
    const primaryPattern = this.determinePrimaryPattern(patterns);

    return {
      primaryPattern,
      detectedPatterns: patterns,
      layerCounts,
      confidence: this.calculateConfidence(patterns, layerCounts),
      layers: this.extractLayers(scannedFiles)
    };
  }

  /**
   * Detect architecture using behavior analysis (code pattern based)
   * This is more accurate than folder-based detection for BaaS, serverless, etc.
   *
   * @param {Array} filesWithContent - Array of file metadata WITH content loaded
   * @param {Object} options - Analysis options
   * @returns {Object} Architecture assessment with plain text output
   */
  async detectArchitectureWithBehaviors(filesWithContent, options = {}) {
    const synthesizer = new ArchitectureSynthesizer(this.projectRoot);

    try {
      const assessment = await synthesizer.analyze(filesWithContent, {
        outputFormat: 'text',
        includeEvidence: true,
        ...options
      });

      // Convert to standard format compatible with existing code
      return {
        primaryPattern: {
          name: this.formatArchitectureType(assessment.architecture.type),
          type: assessment.architecture.type,
          confidence: assessment.architecture.confidence
        },
        detectedPatterns: [{
          name: this.formatArchitectureType(assessment.architecture.type),
          type: assessment.architecture.type,
          confidence: assessment.architecture.confidence,
          evidence: assessment.architecture.evidence
        }],
        confidence: assessment.architecture.confidence,
        behaviorBased: true,
        gateways: assessment.gateways,
        signals: assessment.behaviors,
        apiSpec: assessment.apiSpec,
        formatted: assessment.formatted,
        // Keep layer info for compatibility
        layerCounts: {},
        layers: {}
      };
    } catch (err) {
      console.error('Behavior analysis failed, falling back to folder-based:', err.message);
      // Fall back to folder-based detection
      return this.detectArchitecture(filesWithContent);
    }
  }

  /**
   * Quick behavior-based detection (minimal file reading)
   * Use when you just need architecture type, not full analysis
   */
  async quickBehaviorDetection(filesWithContent) {
    const synthesizer = new ArchitectureSynthesizer(this.projectRoot);

    try {
      const result = await synthesizer.quickAnalysis(filesWithContent);
      return {
        primaryPattern: {
          name: this.formatArchitectureType(result.type),
          type: result.type,
          confidence: result.confidence
        },
        confidence: result.confidence,
        formatted: result.formatted,
        behaviorBased: true
      };
    } catch (err) {
      return {
        primaryPattern: { name: 'Unknown', type: 'unknown', confidence: 'low' },
        confidence: 'low',
        formatted: 'Architecture: unknown (analysis failed)',
        behaviorBased: false
      };
    }
  }

  /**
   * Format architecture type to human-readable name
   */
  formatArchitectureType(type) {
    const names = {
      'baas-frontend': 'BaaS Frontend',
      'baas-partial': 'Partial BaaS',
      'traditional-fullstack': 'Traditional Fullstack',
      'api-backend': 'API Backend',
      'frontend-only': 'Frontend Only',
      'frontend-external-api': 'Frontend + External API',
      'graphql-fullstack': 'GraphQL Fullstack',
      'graphql-client': 'GraphQL Client',
      'external-service-client': 'External Service Client',
      'unknown': 'Unknown'
    };
    return names[type] || type;
  }

  /**
   * Count files in each architectural layer
   */
  countLayers(scannedFiles) {
    const counts = {};

    // Initialize all layer counts
    for (const layer of Object.keys(this.layerPatterns)) {
      counts[layer] = 0;
    }

    // Count files matching each layer pattern
    for (const file of scannedFiles) {
      const relativePath = file.relativePath || file.path;

      for (const [layer, pattern] of Object.entries(this.layerPatterns)) {
        if (pattern.test(relativePath)) {
          counts[layer]++;
        }
      }

      // Also check file names
      const fileName = path.basename(file.path || file.relativePath);
      for (const [type, pattern] of Object.entries(this.fileNamePatterns)) {
        if (pattern.test(fileName)) {
          counts[type] = (counts[type] || 0) + 1;
        }
      }
    }

    return counts;
  }

  /**
   * Identify architectural patterns present
   */
  identifyPatterns(layerCounts, scannedFiles) {
    const patterns = [];

    // MVC pattern detection
    if (layerCounts.models >= 2 && layerCounts.views >= 2 && layerCounts.controllers >= 2) {
      patterns.push({
        name: 'MVC',
        type: 'mvc',
        confidence: this.calculateMVCConfidence(layerCounts),
        layers: ['models', 'views', 'controllers']
      });
    }

    // Layered architecture detection
    if (layerCounts.presentation >= 2 || layerCounts.business >= 2 || layerCounts.data >= 2) {
      patterns.push({
        name: 'Layered',
        type: 'layered',
        confidence: this.calculateLayeredConfidence(layerCounts),
        layers: ['presentation', 'business', 'data']
      });
    }

    // Clean architecture detection
    if (layerCounts.domain >= 2 && (layerCounts.application >= 2 || layerCounts.infrastructure >= 2)) {
      patterns.push({
        name: 'Clean Architecture',
        type: 'clean',
        confidence: this.calculateCleanConfidence(layerCounts),
        layers: ['domain', 'application', 'infrastructure']
      });
    }

    // Service-oriented detection
    if (layerCounts.services >= 3 && layerCounts.routes >= 2) {
      patterns.push({
        name: 'Service-Oriented',
        type: 'service-oriented',
        confidence: this.calculateServiceConfidence(layerCounts),
        layers: ['routes', 'services', 'repositories']
      });
    }

    // Microservices detection
    const serviceCount = this.countServiceDirectories(scannedFiles);
    if (serviceCount >= 3) {
      patterns.push({
        name: 'Microservices',
        type: 'microservices',
        confidence: serviceCount >= 5 ? 'high' : 'medium',
        services: serviceCount,
        layers: ['services']
      });
    }

    // API-centric detection
    if (layerCounts.api >= 3 && (layerCounts.routes >= 2 || layerCounts.controllers >= 2)) {
      patterns.push({
        name: 'API-Centric',
        type: 'api-centric',
        confidence: this.calculateAPIConfidence(layerCounts),
        layers: ['api', 'routes', 'controllers']
      });
    }

    return patterns;
  }

  /**
   * Determine primary architectural pattern
   */
  determinePrimaryPattern(patterns) {
    if (patterns.length === 0) {
      return {
        name: 'Unknown',
        type: 'unknown',
        confidence: 'low'
      };
    }

    // Sort by confidence and return highest
    const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    patterns.sort((a, b) => {
      const confA = confidenceOrder[a.confidence] || 0;
      const confB = confidenceOrder[b.confidence] || 0;
      return confB - confA;
    });

    return patterns[0];
  }

  /**
   * Calculate confidence scores for patterns
   */
  calculateMVCConfidence(layerCounts) {
    const score = layerCounts.models + layerCounts.views + layerCounts.controllers;
    if (score >= 20) return 'high';
    if (score >= 10) return 'medium';
    return 'low';
  }

  calculateLayeredConfidence(layerCounts) {
    const score = layerCounts.presentation + layerCounts.business + layerCounts.data;
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  calculateCleanConfidence(layerCounts) {
    const score = layerCounts.domain + layerCounts.application + layerCounts.infrastructure;
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  calculateServiceConfidence(layerCounts) {
    const score = layerCounts.services + layerCounts.routes;
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  calculateAPIConfidence(layerCounts) {
    const score = layerCounts.api + layerCounts.routes + layerCounts.controllers;
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall confidence in architecture detection
   */
  calculateConfidence(patterns, layerCounts) {
    if (patterns.length === 0) return 'low';

    const highConfidence = patterns.filter(p => p.confidence === 'high').length;
    if (highConfidence > 0) return 'high';

    const mediumConfidence = patterns.filter(p => p.confidence === 'medium').length;
    if (mediumConfidence > 0) return 'medium';

    return 'low';
  }

  /**
   * Count distinct service directories (for microservices detection)
   */
  countServiceDirectories(scannedFiles) {
    const serviceDirs = new Set();

    for (const file of scannedFiles) {
      const relativePath = file.relativePath || file.path;
      const parts = relativePath.split(path.sep);

      // Look for services/ or microservices/ directories
      const serviceIdx = parts.findIndex(p => /^(services?|microservices?)$/i.test(p));
      if (serviceIdx !== -1 && serviceIdx + 1 < parts.length) {
        serviceDirs.add(parts[serviceIdx + 1]);
      }
    }

    return serviceDirs.size;
  }

  /**
   * Extract and categorize files into architectural layers
   * Task 6-2: Map backend files to architectural layers
   */
  extractLayers(scannedFiles) {
    const layers = {
      routes: [],
      controllers: [],
      services: [],
      models: [],
      repositories: [],
      middleware: [],
      schemas: [],
      entities: [],
      dto: [],
      mappers: [],
      api: [],
      utils: [],
      config: [],
      other: []
    };

    for (const file of scannedFiles) {
      const relativePath = file.relativePath || file.path;
      const fileName = path.basename(file.path || file.relativePath);
      const layer = this.categorizeFileToLayer(relativePath, fileName);

      if (layers[layer]) {
        layers[layer].push({
          path: relativePath,
          name: fileName,
          size: file.size,
          type: file.type,
          role: file.role
        });
      } else {
        layers.other.push({
          path: relativePath,
          name: fileName,
          size: file.size,
          type: file.type,
          role: file.role
        });
      }
    }

    // Remove empty layers
    for (const [layer, files] of Object.entries(layers)) {
      if (files.length === 0) {
        delete layers[layer];
      }
    }

    return layers;
  }

  /**
   * Categorize a file into an architectural layer
   */
  categorizeFileToLayer(relativePath, fileName) {
    // Check file name patterns first (more specific)
    if (this.fileNamePatterns.controller.test(fileName)) return 'controllers';
    if (this.fileNamePatterns.model.test(fileName)) return 'models';
    if (this.fileNamePatterns.service.test(fileName)) return 'services';
    if (this.fileNamePatterns.repository.test(fileName)) return 'repositories';
    if (this.fileNamePatterns.route.test(fileName)) return 'routes';
    if (this.fileNamePatterns.middleware.test(fileName)) return 'middleware';
    if (this.fileNamePatterns.schema.test(fileName)) return 'schemas';
    if (this.fileNamePatterns.entity.test(fileName)) return 'entities';
    if (this.fileNamePatterns.dto.test(fileName)) return 'dto';
    if (this.fileNamePatterns.mapper.test(fileName)) return 'mappers';

    // Check directory patterns
    if (this.layerPatterns.routes.test(relativePath)) return 'routes';
    if (this.layerPatterns.controllers.test(relativePath)) return 'controllers';
    if (this.layerPatterns.services.test(relativePath)) return 'services';
    if (this.layerPatterns.models.test(relativePath)) return 'models';
    if (this.layerPatterns.repositories.test(relativePath)) return 'repositories';
    if (this.layerPatterns.middleware.test(relativePath)) return 'middleware';
    if (this.layerPatterns.api.test(relativePath)) return 'api';
    if (this.layerPatterns.database.test(relativePath)) return 'models';
    if (this.layerPatterns.utils.test(relativePath)) return 'utils';
    if (this.layerPatterns.config.test(relativePath)) return 'config';

    return 'other';
  }

  /**
   * Detect architectural rule violations
   * Task 6-4: Detect layer violations, upward dependencies, circular issues
   *
   * @param {Object} architecture - Architecture detection results
   * @param {Object} dependencyData - Forward dependency map
   * @param {Array} scannedFiles - All scanned files
   * @returns {Array} List of violations
   */
  detectViolations(architecture, dependencyData, scannedFiles) {
    const violations = [];

    // Define proper layer hierarchy (lower layers should not depend on higher layers)
    const layerHierarchy = {
      'mvc': {
        'views': 0,
        'controllers': 1,
        'models': 2
      },
      'layered': {
        'presentation': 0,
        'business': 1,
        'data': 2
      },
      'clean': {
        'infrastructure': 0,
        'application': 1,
        'domain': 2
      },
      'service-oriented': {
        'routes': 0,
        'controllers': 1,
        'services': 2,
        'repositories': 3,
        'models': 4
      }
    };

    const patternType = architecture.primaryPattern.type;
    const hierarchy = layerHierarchy[patternType];

    if (!hierarchy) {
      // No hierarchy defined for this pattern
      return violations;
    }

    // Check each file's dependencies
    for (const [filePath, data] of Object.entries(dependencyData)) {
      const sourceFile = scannedFiles.find(f =>
        (f.relativePath === filePath || f.path === filePath)
      );

      if (!sourceFile) continue;

      const sourceLayer = this.categorizeFileToLayer(
        sourceFile.relativePath || sourceFile.path,
        path.basename(sourceFile.path || sourceFile.relativePath)
      );

      const sourceLevel = hierarchy[sourceLayer];
      if (sourceLevel === undefined) continue;

      // Check each import
      for (const imp of data.imports || []) {
        if (imp.type !== 'internal') continue;

        const targetFile = scannedFiles.find(f =>
          f.relativePath === imp.source ||
          f.path === imp.source ||
          f.relativePath === imp.source + '.js' ||
          f.relativePath === imp.source + '.ts'
        );

        if (!targetFile) continue;

        const targetLayer = this.categorizeFileToLayer(
          targetFile.relativePath || targetFile.path,
          path.basename(targetFile.path || targetFile.relativePath)
        );

        const targetLevel = hierarchy[targetLayer];
        if (targetLevel === undefined) continue;

        // Upward dependency violation (lower layer depends on higher layer)
        if (sourceLevel > targetLevel) {
          violations.push({
            type: 'upward-dependency',
            severity: 'error',
            file: filePath,
            sourceLayer,
            targetLayer,
            targetFile: imp.source,
            message: `${sourceLayer} should not depend on ${targetLayer} (violates ${patternType} hierarchy)`
          });
        }
      }
    }

    return violations;
  }

  /**
   * Parse route file to extract API endpoints
   * Task 6-5: Extract API endpoints and HTTP methods
   *
   * @param {string} filePath - Path to route file
   * @param {string} content - File content
   * @returns {Array} List of endpoints
   */
  async parseRouteFile(filePath, content) {
    const endpoints = [];

    // Express.js patterns
    // app.get('/path', handler)
    // router.post('/path', middleware, handler)
    const expressRegex = /(?:app|router)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = expressRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];

      endpoints.push({
        method,
        path,
        file: filePath,
        handler: this.extractHandlerName(content, match.index)
      });
    }

    // Fastify patterns
    // fastify.get('/path', handler)
    const fastifyRegex = /fastify\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = fastifyRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];

      endpoints.push({
        method,
        path,
        file: filePath,
        framework: 'fastify',
        handler: this.extractHandlerName(content, match.index)
      });
    }

    // Koa patterns
    // router.get('/path', handler)
    const koaRegex = /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = koaRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];

      endpoints.push({
        method,
        path,
        file: filePath,
        framework: 'koa',
        handler: this.extractHandlerName(content, match.index)
      });
    }

    // Flask patterns (Python)
    // @app.route('/path', methods=['GET', 'POST'])
    const flaskRegex = /@app\.route\s*\(\s*['"`]([^'"`]+)['"`](?:.*?methods\s*=\s*\[([^\]]+)\])?/g;
    while ((match = flaskRegex.exec(content)) !== null) {
      const path = match[1];
      const methods = match[2] ?
        match[2].split(',').map(m => m.trim().replace(/['"]/g, '')) :
        ['GET'];

      for (const method of methods) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          file: filePath,
          framework: 'flask'
        });
      }
    }

    // FastAPI patterns (Python)
    // @app.get('/path')
    const fastAPIRegex = /@app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = fastAPIRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];

      endpoints.push({
        method,
        path,
        file: filePath,
        framework: 'fastapi'
      });
    }

    return endpoints;
  }

  /**
   * Extract handler name from route definition
   */
  extractHandlerName(content, matchIndex) {
    // Look for the handler name after the route path
    const afterMatch = content.substring(matchIndex);
    const handlerMatch = afterMatch.match(/,\s*(\w+)/);
    return handlerMatch ? handlerMatch[1] : 'unknown';
  }

  /**
   * Build data flow map (route -> controller -> service -> model)
   * Task 6-3: Build data flow map
   *
   * @param {Object} layers - Categorized layers
   * @param {Object} dependencyData - Forward dependency map
   * @returns {Array} Data flow chains
   */
  buildDataFlowMap(layers, dependencyData) {
    const flows = [];

    // Start from routes
    const routes = layers.routes || [];

    for (const route of routes) {
      const flow = this.traceDataFlow(route.path, dependencyData, layers, []);

      if (flow.length > 1) {
        flows.push({
          entryPoint: route.path,
          chain: flow,
          layers: this.extractLayersFromFlow(flow),
          depth: flow.length
        });
      }
    }

    return flows;
  }

  /**
   * Recursively trace data flow through layers
   */
  traceDataFlow(filePath, dependencyData, layers, visited) {
    if (visited.includes(filePath)) {
      return []; // Prevent circular references
    }

    visited.push(filePath);
    const flow = [{ file: filePath, layer: this.getLayerForFile(filePath, layers) }];

    const dependencies = dependencyData[filePath];
    if (!dependencies || !dependencies.imports) {
      return flow;
    }

    // Find the most significant dependency (controller -> service -> model pattern)
    const significantImport = this.findSignificantImport(dependencies.imports, layers);

    if (significantImport) {
      const subFlow = this.traceDataFlow(significantImport.source, dependencyData, layers, visited);
      flow.push(...subFlow);
    }

    return flow;
  }

  /**
   * Find the most significant import (following architectural pattern)
   */
  findSignificantImport(imports, layers) {
    const layerPriority = ['controllers', 'services', 'repositories', 'models'];

    for (const layer of layerPriority) {
      const layerFiles = layers[layer] || [];
      const layerPaths = layerFiles.map(f => f.path);

      for (const imp of imports) {
        if (imp.type === 'internal' && layerPaths.includes(imp.source)) {
          return imp;
        }
      }
    }

    return null;
  }

  /**
   * Get layer classification for a file
   */
  getLayerForFile(filePath, layers) {
    for (const [layer, files] of Object.entries(layers)) {
      if (files.some(f => f.path === filePath)) {
        return layer;
      }
    }
    return 'unknown';
  }

  /**
   * Extract layer names from flow chain
   */
  extractLayersFromFlow(flow) {
    return [...new Set(flow.map(f => f.layer))];
  }
}

module.exports = ArchitectureDetector;
