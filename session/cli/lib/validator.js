const fs = require('fs').promises;
const path = require('path');

/**
 * Project Map Validator
 * Validates project context maps for:
 * - File completeness
 * - Broken references
 * - Schema compliance
 * - Data integrity
 */

class MapValidator {
  constructor(projectRoot, mapsDir) {
    this.projectRoot = projectRoot;
    this.mapsDir = mapsDir;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate all maps in the maps directory
   */
  async validateAll() {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        fileCompleteness: null,
        brokenReferences: null,
        schemaCompliance: null,
        dataIntegrity: null
      }
    };

    console.log('Validating project maps...\n');

    // Check 1: File completeness
    results.checks.fileCompleteness = await this.validateFileCompleteness();

    // Check 2: Broken references
    results.checks.brokenReferences = await this.validateReferences();

    // Check 3: Schema compliance
    results.checks.schemaCompliance = await this.validateSchemaCompliance();

    // Check 4: Data integrity
    results.checks.dataIntegrity = await this.validateDataIntegrity();

    // Aggregate results
    results.errors = this.errors;
    results.warnings = this.warnings;
    results.valid = this.errors.length === 0;

    return results;
  }

  /**
   * Check 1: Validate file completeness
   * Ensures all required map files exist
   */
  async validateFileCompleteness() {
    const requiredFiles = [
      'summary.json',
      'tree.json',
      'metadata.json',
      'content-summaries.json',
      'dependencies-forward.json',
      'dependencies-reverse.json'
    ];

    const optionalFiles = [
      'modules.json',
      'module-dependencies.json',
      'frontend-components.json',
      'backend-layers.json',
      'database-schema.json'
    ];

    const result = {
      passed: true,
      missingRequired: [],
      missingOptional: []
    };

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(this.mapsDir, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        result.missingRequired.push(file);
        this.errors.push(`Missing required file: ${file}`);
        result.passed = false;
      }
    }

    // Check optional files (warnings only)
    for (const file of optionalFiles) {
      const filePath = path.join(this.mapsDir, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        result.missingOptional.push(file);
        this.warnings.push(`Missing optional file: ${file}`);
      }
    }

    console.log(`✓ File completeness check`);
    console.log(`  Required: ${requiredFiles.length - result.missingRequired.length}/${requiredFiles.length}`);
    console.log(`  Optional: ${optionalFiles.length - result.missingOptional.length}/${optionalFiles.length}\n`);

    return result;
  }

  /**
   * Check 2: Validate references
   * Ensures file references are not broken
   */
  async validateReferences() {
    const result = {
      passed: true,
      brokenReferences: [],
      totalReferences: 0
    };

    try {
      // Load dependency maps
      const forwardDeps = await this.loadMap('dependencies-forward.json');
      const metadata = await this.loadMap('metadata.json');

      // Get list of all valid files
      const validFiles = new Set();
      if (metadata.files) {
        for (const file of metadata.files) {
          validFiles.add(file.path);
        }
      }

      // Check forward dependencies
      if (forwardDeps.dependencies) {
        for (const [file, deps] of Object.entries(forwardDeps.dependencies)) {
          if (!validFiles.has(file)) {
            result.brokenReferences.push({
              type: 'missing-source',
              file,
              message: `Source file ${file} not found in metadata`
            });
          }

          if (deps.imports) {
            for (const imp of deps.imports) {
              result.totalReferences++;

              // Check if imported file exists (for internal imports)
              if (imp.type === 'internal' && imp.source) {
                if (!validFiles.has(imp.source)) {
                  result.brokenReferences.push({
                    type: 'broken-import',
                    file,
                    target: imp.source,
                    message: `Import '${imp.source}' not found`
                  });
                }
              }
            }
          }
        }
      }

      if (result.brokenReferences.length > 0) {
        result.passed = false;
        for (const ref of result.brokenReferences.slice(0, 10)) { // Show first 10
          this.errors.push(`Broken reference in ${ref.file}: ${ref.message}`);
        }
        if (result.brokenReferences.length > 10) {
          this.warnings.push(`... and ${result.brokenReferences.length - 10} more broken references`);
        }
      }

      console.log(`✓ Reference validation`);
      console.log(`  Total references: ${result.totalReferences}`);
      console.log(`  Broken: ${result.brokenReferences.length}\n`);

    } catch (error) {
      result.passed = false;
      this.errors.push(`Reference validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check 3: Validate schema compliance
   * Ensures maps follow expected schema
   */
  async validateSchemaCompliance() {
    const result = {
      passed: true,
      violations: []
    };

    try {
      // Validate summary.json schema
      const summary = await this.loadMap('summary.json');

      if (!summary.metadata) {
        result.violations.push('summary.json: missing metadata field');
      }

      if (!summary.stats) {
        result.violations.push('summary.json: missing stats field');
      }

      if (summary.metadata && !summary.metadata.projectPath) {
        result.violations.push('summary.json: metadata missing projectPath');
      }

      // Validate metadata.json schema
      const metadata = await this.loadMap('metadata.json');

      if (!Array.isArray(metadata.files)) {
        result.violations.push('metadata.json: files must be an array');
      }

      // Validate each file entry
      if (metadata.files) {
        for (let i = 0; i < Math.min(metadata.files.length, 10); i++) {
          const file = metadata.files[i];
          if (!file.path) {
            result.violations.push(`metadata.json: file ${i} missing path`);
          }
          if (!file.type) {
            result.violations.push(`metadata.json: file ${i} missing type`);
          }
        }
      }

      // Validate dependencies-forward.json schema
      const forwardDeps = await this.loadMap('dependencies-forward.json');

      if (!forwardDeps.dependencies) {
        result.violations.push('dependencies-forward.json: missing dependencies field');
      }

      if (result.violations.length > 0) {
        result.passed = false;
        for (const violation of result.violations) {
          this.errors.push(`Schema violation: ${violation}`);
        }
      }

      console.log(`✓ Schema compliance`);
      console.log(`  Violations: ${result.violations.length}\n`);

    } catch (error) {
      result.passed = false;
      this.errors.push(`Schema validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check 4: Validate data integrity
   * Ensures data is consistent across maps
   */
  async validateDataIntegrity() {
    const result = {
      passed: true,
      inconsistencies: []
    };

    try {
      // Load maps
      const summary = await this.loadMap('summary.json');
      const metadata = await this.loadMap('metadata.json');
      const forwardDeps = await this.loadMap('dependencies-forward.json');
      const reverseDeps = await this.loadMap('dependencies-reverse.json');

      // Check 1: File count consistency
      const summaryFileCount = summary.stats?.totalFiles || 0;
      const metadataFileCount = metadata.files?.length || 0;

      if (summaryFileCount !== metadataFileCount) {
        result.inconsistencies.push({
          type: 'file-count-mismatch',
          message: `Summary reports ${summaryFileCount} files, but metadata has ${metadataFileCount}`
        });
      }

      // Check 2: Forward/reverse dependency consistency
      if (forwardDeps.dependencies && reverseDeps.dependencies) {
        // For each forward dependency, there should be a corresponding reverse dependency
        let forwardCount = 0;
        let reverseCount = 0;

        for (const [file, deps] of Object.entries(forwardDeps.dependencies)) {
          if (deps.imports) {
            forwardCount += deps.imports.length;
          }
        }

        for (const [file, deps] of Object.entries(reverseDeps.dependencies)) {
          if (deps.importedBy) {
            reverseCount += deps.importedBy.length;
          }
        }

        // Counts should be roughly equal (accounting for external deps)
        const diff = Math.abs(forwardCount - reverseCount);
        const tolerance = Math.max(forwardCount, reverseCount) * 0.3; // 30% tolerance

        if (diff > tolerance) {
          result.inconsistencies.push({
            type: 'dependency-count-mismatch',
            message: `Forward deps: ${forwardCount}, Reverse deps: ${reverseCount}`
          });
        }
      }

      // Check 3: Staleness info consistency
      if (summary.staleness) {
        if (!summary.staleness.gitHash) {
          result.inconsistencies.push({
            type: 'missing-staleness-data',
            message: 'Staleness info missing git hash'
          });
        }

        if (!summary.staleness.lastRefresh) {
          result.inconsistencies.push({
            type: 'missing-staleness-data',
            message: 'Staleness info missing lastRefresh timestamp'
          });
        }
      } else {
        this.warnings.push('Summary missing staleness information');
      }

      if (result.inconsistencies.length > 0) {
        result.passed = false;
        for (const inconsistency of result.inconsistencies) {
          this.errors.push(`Data inconsistency: ${inconsistency.message}`);
        }
      }

      console.log(`✓ Data integrity`);
      console.log(`  Inconsistencies: ${result.inconsistencies.length}\n`);

    } catch (error) {
      result.passed = false;
      this.errors.push(`Data integrity check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Load and parse a map file
   */
  async loadMap(filename) {
    const filePath = path.join(this.mapsDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);

    // Handle compressed format
    if (parsed.compressed && parsed.data) {
      // If data is a string, parse it; otherwise return as-is
      if (typeof parsed.data === 'string') {
        return JSON.parse(parsed.data);
      }
      return parsed.data;
    }

    return parsed;
  }

  /**
   * Generate validation report
   */
  generateReport(results) {
    const report = [];

    report.push('========================================');
    report.push('  Project Map Validation Report');
    report.push('========================================\n');

    // Overall status
    if (results.valid) {
      report.push('✓ VALIDATION PASSED\n');
    } else {
      report.push('✗ VALIDATION FAILED\n');
    }

    // Summary
    report.push('Summary:');
    report.push(`  Errors: ${results.errors.length}`);
    report.push(`  Warnings: ${results.warnings.length}\n`);

    // Errors
    if (results.errors.length > 0) {
      report.push('Errors:');
      for (const error of results.errors) {
        report.push(`  ✗ ${error}`);
      }
      report.push('');
    }

    // Warnings
    if (results.warnings.length > 0) {
      report.push('Warnings:');
      for (const warning of results.warnings) {
        report.push(`  ⚠ ${warning}`);
      }
      report.push('');
    }

    // Detailed checks
    report.push('Detailed Checks:');
    report.push(`  File Completeness: ${results.checks.fileCompleteness?.passed ? '✓' : '✗'}`);
    report.push(`  Reference Validation: ${results.checks.brokenReferences?.passed ? '✓' : '✗'}`);
    report.push(`  Schema Compliance: ${results.checks.schemaCompliance?.passed ? '✓' : '✗'}`);
    report.push(`  Data Integrity: ${results.checks.dataIntegrity?.passed ? '✓' : '✗'}`);

    report.push('\n========================================\n');

    return report.join('\n');
  }
}

module.exports = MapValidator;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node validator.js <project-root> <maps-dir>');
    console.log('Example: node validator.js /path/to/project ~/.claude/project-maps/abc123');
    process.exit(1);
  }

  const projectRoot = args[0];
  const mapsDir = args[1];

  const validator = new MapValidator(projectRoot, mapsDir);

  validator.validateAll()
    .then(results => {
      const report = validator.generateReport(results);
      console.log(report);

      process.exit(results.valid ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation error:', error.message);
      process.exit(1);
    });
}
