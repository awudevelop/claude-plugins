/**
 * Code generation orchestrator for plan execution
 *
 * Coordinates loading task specs, reference files, and project context
 * to generate implementation code from lean specifications.
 *
 * @module code-generator
 * @category CLI
 */

const fs = require('fs').promises;
const path = require('path');
const { FileWriter } = require('./file-writer');
const { Verifier } = require('./verifier');
const { verifyDocumentation, formatIssues } = require('./doc-verifier');

/**
 * Task specification from finalized plan
 * @typedef {Object} TaskSpec
 * @property {string} id - Task ID
 * @property {string} type - Task type (create_function, create_class, etc.)
 * @property {string} file - Target file path
 * @property {Object} spec - Type-specific specification
 * @property {Object} [confidence] - Confidence assessment
 * @property {Array} [docs] - External documentation references
 * @property {Object} [review] - Review requirements
 */

/**
 * Generated code output
 * @typedef {Object} GeneratedOutput
 * @property {Object} main_file - Main file info
 * @property {string} main_file.path - File path
 * @property {string} main_file.content - File content
 * @property {Array} [auxiliary_files] - Additional generated files
 * @property {string[]} [notes] - Generation notes
 * @property {Array} [uncertainties] - Uncertain parts
 */

/**
 * Task execution result
 * @typedef {Object} TaskExecutionResult
 * @property {string} task_id - Task ID
 * @property {'completed'|'failed'|'skipped'} status - Execution status
 * @property {string[]} files_created - Files created
 * @property {string[]} files_modified - Files modified
 * @property {Object} verification - Verification results
 * @property {string[]} warnings - Any warnings
 * @property {number} duration_ms - Execution time
 * @property {string} [error] - Error if failed
 */

/**
 * Code generator for plan execution
 *
 * @class
 * @category CLI
 * @example
 * const generator = new CodeGenerator(projectRoot, { dryRun: false });
 * const result = await generator.executeTask(taskSpec);
 */
class CodeGenerator {
  /**
   * Create a new CodeGenerator
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options] - Generator options
   * @param {boolean} [options.dryRun=false] - Don't write files
   * @param {boolean} [options.skipVerify=false] - Skip verification
   * @param {boolean} [options.skipDocVerify=false] - Skip doc verification
   * @param {Object} [options.projectMaps] - Pre-loaded project maps
   */
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.dryRun = options.dryRun || false;
    this.skipVerify = options.skipVerify || false;
    this.skipDocVerify = options.skipDocVerify || false;
    this.projectMaps = options.projectMaps || null;

    this.fileWriter = new FileWriter(projectRoot, { dryRun: this.dryRun });
    this.verifier = new Verifier(projectRoot);
  }

  /**
   * Execute a single task
   *
   * @param {TaskSpec} task - Task specification
   * @param {Object} [context] - Additional context
   * @param {Object} [context.referenceFiles] - Reference file contents
   * @param {Object} [context.docs] - External documentation
   * @returns {Promise<TaskExecutionResult>} Execution result
   *
   * @example
   * const result = await generator.executeTask({
   *   id: 'task-1-1',
   *   type: 'create_function',
   *   file: 'src/auth/methods.ts',
   *   spec: { function: 'signIn', ... }
   * });
   */
  async executeTask(task, context = {}) {
    const startTime = Date.now();
    const result = {
      task_id: task.id,
      status: 'completed',
      files_created: [],
      files_modified: [],
      verification: {},
      warnings: [],
      duration_ms: 0
    };

    try {
      // Load context for code generation
      const genContext = await this.loadContext(task, context);

      // Generate code (this would normally call an AI model)
      // For now, we prepare the prompt and return a placeholder
      const generated = await this.generateCode(task, genContext);

      // Write files
      if (!this.dryRun && generated.main_file) {
        const writeResult = await this.fileWriter.writeGenerated(generated);

        result.files_created = writeResult.results
          .filter(r => r.created)
          .map(r => r.path);
        result.files_modified = writeResult.results
          .filter(r => r.modified)
          .map(r => r.path);

        if (!writeResult.success) {
          result.status = 'failed';
          result.error = writeResult.errors.join('; ');
        }
      }

      // Verify generated code
      if (!this.skipVerify && generated.main_file && !this.dryRun) {
        const verifyResult = await this.verifier.verify(generated.main_file.path, {
          testFile: generated.auxiliary_files?.find(f => f.path.includes('test'))?.path
        });

        result.verification = {
          typecheck: verifyResult.typecheck.passed ? 'passed' : 'failed',
          lint: verifyResult.lint.passed ? 'passed' : 'failed',
          test: verifyResult.test.passed ? 'passed' : 'skipped'
        };

        if (!verifyResult.passed) {
          result.warnings.push('Verification checks failed');
          // Add specific issues
          if (verifyResult.typecheck.issues?.length) {
            result.warnings.push(...verifyResult.typecheck.issues.map(i =>
              `TypeScript: ${i.message} (${i.file}:${i.line})`
            ));
          }
        }
      }

      // Verify documentation
      if (!this.skipDocVerify && generated.main_file && !this.dryRun) {
        const docResult = verifyDocumentation(
          generated.main_file.path,
          generated.main_file.content
        );

        result.verification.documentation = {
          valid: docResult.valid,
          errors: docResult.errorCount,
          warnings: docResult.warningCount
        };

        if (!docResult.valid) {
          result.warnings.push('Documentation verification failed');
        }
        if (docResult.warningCount > 0) {
          result.warnings.push(`${docResult.warningCount} documentation warnings`);
        }
      }

      // Add generation notes
      if (generated.notes?.length) {
        result.notes = generated.notes;
      }

      // Add uncertainties as warnings
      if (generated.uncertainties?.length) {
        result.warnings.push(...generated.uncertainties.map(u =>
          `Uncertainty at ${u.location}: ${u.issue}`
        ));
      }

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  /**
   * Load context for code generation
   *
   * @param {TaskSpec} task - Task specification
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Generation context
   */
  async loadContext(task, context) {
    const genContext = {
      task,
      referenceFiles: {},
      projectPatterns: {},
      docs: []
    };

    // Load reference files from spec.patterns
    if (task.spec?.patterns?.length) {
      for (const pattern of task.spec.patterns) {
        try {
          const filePath = path.isAbsolute(pattern)
            ? pattern
            : path.join(this.projectRoot, pattern);
          const content = await fs.readFile(filePath, 'utf8');
          genContext.referenceFiles[pattern] = content;
        } catch (error) {
          // Reference file not found, skip
        }
      }
    }

    // Merge provided reference files
    if (context.referenceFiles) {
      Object.assign(genContext.referenceFiles, context.referenceFiles);
    }

    // Load project patterns from project-maps
    if (this.projectMaps) {
      genContext.projectPatterns = await this.loadProjectPatterns(task);
    }

    // Load documentation
    if (task.docs?.length) {
      genContext.docs = task.docs;
    }
    if (context.docs) {
      genContext.docs = [...genContext.docs, ...context.docs];
    }

    return genContext;
  }

  /**
   * Load relevant project patterns from project-maps
   *
   * @param {TaskSpec} task - Task specification
   * @returns {Promise<Object>} Project patterns
   */
  async loadProjectPatterns(task) {
    const patterns = {
      similarFunctions: [],
      importPatterns: [],
      existingTypes: []
    };

    if (!this.projectMaps) return patterns;

    // Find similar functions from signatures
    if (this.projectMaps.signatures) {
      const taskName = task.spec?.function || task.spec?.class || task.spec?.hook;
      if (taskName) {
        // Simple search - find functions with similar names or in same directory
        const targetDir = path.dirname(task.file);
        patterns.similarFunctions = Object.entries(this.projectMaps.signatures)
          .filter(([file, _]) => file.includes(targetDir))
          .slice(0, 3)
          .map(([file, sigs]) => ({ file, signatures: sigs }));
      }
    }

    // Get import patterns from dependencies
    if (this.projectMaps.dependencies) {
      const targetDir = path.dirname(task.file);
      patterns.importPatterns = Object.entries(this.projectMaps.dependencies)
        .filter(([file, _]) => file.includes(targetDir))
        .slice(0, 3)
        .map(([file, deps]) => ({ file, imports: deps }));
    }

    // Get existing types
    if (this.projectMaps.types) {
      patterns.existingTypes = Object.keys(this.projectMaps.types).slice(0, 20);
    }

    return patterns;
  }

  /**
   * Generate code from task spec (placeholder for AI integration)
   *
   * This method builds the prompt that would be sent to an AI model.
   * In actual use, this would call the model and return generated code.
   *
   * @param {TaskSpec} task - Task specification
   * @param {Object} context - Generation context
   * @returns {Promise<GeneratedOutput>} Generated code
   */
  async generateCode(task, context) {
    // Build generation prompt
    const prompt = this.buildGenerationPrompt(task, context);

    // For now, return a placeholder indicating what needs to be generated
    // In production, this would call an AI model
    return {
      main_file: {
        path: task.file,
        content: `// TODO: Generate code for ${task.type}\n// Task: ${task.id}\n// Spec: ${JSON.stringify(task.spec, null, 2)}`
      },
      auxiliary_files: [],
      notes: [
        'Code generation requires AI model integration',
        'Prompt built successfully'
      ],
      uncertainties: [],
      _prompt: prompt // Include prompt for debugging
    };
  }

  /**
   * Build the code generation prompt
   *
   * @param {TaskSpec} task - Task specification
   * @param {Object} context - Generation context
   * @returns {string} Generation prompt
   */
  buildGenerationPrompt(task, context) {
    let prompt = '# Code Generation Task\n\n';

    // Task specification
    prompt += '## Task Specification\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify({
      type: task.type,
      file: task.file,
      spec: task.spec
    }, null, 2);
    prompt += '\n```\n\n';

    // Reference files
    if (Object.keys(context.referenceFiles).length > 0) {
      prompt += '## Reference Files\n\n';
      for (const [file, content] of Object.entries(context.referenceFiles)) {
        prompt += `### ${file}\n\n`;
        prompt += '```typescript\n';
        prompt += content.slice(0, 2000); // Limit size
        if (content.length > 2000) prompt += '\n// ... (truncated)';
        prompt += '\n```\n\n';
      }
    }

    // Project patterns
    if (context.projectPatterns?.similarFunctions?.length > 0) {
      prompt += '## Similar Functions in Project\n\n';
      for (const { file, signatures } of context.projectPatterns.similarFunctions) {
        prompt += `### ${file}\n`;
        prompt += '```\n';
        prompt += JSON.stringify(signatures, null, 2).slice(0, 1000);
        prompt += '\n```\n\n';
      }
    }

    // Documentation
    if (context.docs?.length > 0) {
      prompt += '## External Documentation\n\n';
      for (const doc of context.docs) {
        if (doc.purpose) prompt += `### ${doc.purpose}\n`;
        if (doc.section) prompt += doc.section + '\n\n';
      }
    }

    // Instructions
    prompt += '## Instructions\n\n';
    prompt += '1. Generate complete, working code that implements the spec exactly\n';
    prompt += '2. Follow patterns from reference files\n';
    prompt += '3. Include JSDoc with @param, @returns, @example, @category\n';
    prompt += '4. Return JSON with main_file, auxiliary_files, notes, uncertainties\n';

    return prompt;
  }

  /**
   * Get summary of execution
   *
   * @returns {Object} Execution summary
   */
  getSummary() {
    return this.fileWriter.getSummary();
  }
}

/**
 * Create a code generator instance
 *
 * @param {string} projectRoot - Project root directory
 * @param {Object} [options] - Generator options
 * @returns {CodeGenerator} Generator instance
 *
 * @example
 * const generator = createCodeGenerator('/path/to/project', { dryRun: true });
 */
function createCodeGenerator(projectRoot, options) {
  return new CodeGenerator(projectRoot, options);
}

module.exports = {
  CodeGenerator,
  createCodeGenerator
};
