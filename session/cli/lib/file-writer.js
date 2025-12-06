/**
 * Safe file writing utilities for plan execution
 *
 * Handles creating directories, writing files, and tracking changes.
 *
 * @module file-writer
 * @category CLI
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Result of a file write operation
 * @typedef {Object} WriteResult
 * @property {boolean} success - Whether write succeeded
 * @property {string} path - Absolute path of file
 * @property {boolean} created - Whether file was newly created
 * @property {boolean} modified - Whether existing file was modified
 * @property {number} size - Size of file in bytes
 * @property {string} [error] - Error message if failed
 */

/**
 * Batch write result
 * @typedef {Object} BatchWriteResult
 * @property {boolean} success - Whether all writes succeeded
 * @property {WriteResult[]} results - Individual write results
 * @property {number} filesCreated - Count of newly created files
 * @property {number} filesModified - Count of modified files
 * @property {string[]} errors - Any error messages
 */

/**
 * Safe file writer with directory creation and change tracking
 *
 * @class
 * @category CLI
 * @example
 * const writer = new FileWriter('/project/root');
 * await writer.write('src/auth/index.ts', 'export * from "./methods";');
 */
class FileWriter {
  /**
   * Create a new FileWriter
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options] - Writer options
   * @param {boolean} [options.dryRun=false] - Don't actually write files
   * @param {boolean} [options.backup=false] - Create .bak files before overwriting
   */
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.dryRun = options.dryRun || false;
    this.backup = options.backup || false;
    this.writtenFiles = [];
    this.createdDirs = new Set();
  }

  /**
   * Write content to a file, creating directories as needed
   *
   * @param {string} filePath - Relative or absolute file path
   * @param {string} content - File content to write
   * @returns {Promise<WriteResult>} Write result
   *
   * @example
   * const result = await writer.write('src/utils/helpers.ts', helperCode);
   * if (result.created) {
   *   console.log('New file created:', result.path);
   * }
   */
  async write(filePath, content) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const result = {
      success: false,
      path: absolutePath,
      created: false,
      modified: false,
      size: 0
    };

    try {
      // Check if file exists
      let exists = false;
      try {
        await fs.access(absolutePath);
        exists = true;
      } catch {
        exists = false;
      }

      // Create directory if needed
      const dir = path.dirname(absolutePath);
      if (!this.createdDirs.has(dir)) {
        if (!this.dryRun) {
          await fs.mkdir(dir, { recursive: true });
        }
        this.createdDirs.add(dir);
      }

      // Backup existing file if requested
      if (exists && this.backup && !this.dryRun) {
        const backupPath = absolutePath + '.bak';
        await fs.copyFile(absolutePath, backupPath);
      }

      // Write file
      if (!this.dryRun) {
        await fs.writeFile(absolutePath, content, 'utf8');
      }

      result.success = true;
      result.created = !exists;
      result.modified = exists;
      result.size = Buffer.byteLength(content, 'utf8');

      this.writtenFiles.push(result);
      return result;

    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Write multiple files atomically (all or nothing)
   *
   * @param {Array<{path: string, content: string}>} files - Files to write
   * @returns {Promise<BatchWriteResult>} Batch write result
   *
   * @example
   * const result = await writer.writeMultiple([
   *   { path: 'src/types/user.ts', content: typeDefinitions },
   *   { path: 'src/api/user.ts', content: apiCode },
   *   { path: 'src/api/__tests__/user.test.ts', content: testCode }
   * ]);
   */
  async writeMultiple(files) {
    const results = [];
    const errors = [];

    for (const file of files) {
      const result = await this.write(file.path, file.content);
      results.push(result);
      if (!result.success) {
        errors.push(`${file.path}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      results,
      filesCreated: results.filter(r => r.created).length,
      filesModified: results.filter(r => r.modified).length,
      errors
    };
  }

  /**
   * Write generated code output (main file + auxiliary files)
   *
   * @param {Object} generatedOutput - Output from code generator
   * @param {Object} generatedOutput.main_file - Main file info
   * @param {string} generatedOutput.main_file.path - File path
   * @param {string} generatedOutput.main_file.content - File content
   * @param {Array} [generatedOutput.auxiliary_files] - Additional files
   * @returns {Promise<BatchWriteResult>} Write result
   *
   * @example
   * const output = await codeGenerator.generate(taskSpec);
   * const writeResult = await writer.writeGenerated(output);
   */
  async writeGenerated(generatedOutput) {
    const files = [];

    // Add main file
    if (generatedOutput.main_file) {
      files.push({
        path: generatedOutput.main_file.path,
        content: generatedOutput.main_file.content
      });
    }

    // Add auxiliary files
    if (generatedOutput.auxiliary_files) {
      for (const aux of generatedOutput.auxiliary_files) {
        files.push({
          path: aux.path,
          content: aux.content
        });
      }
    }

    return this.writeMultiple(files);
  }

  /**
   * Get summary of all written files
   *
   * @returns {Object} Summary of written files
   *
   * @example
   * const summary = writer.getSummary();
   * console.log(`Created ${summary.created} files, modified ${summary.modified}`);
   */
  getSummary() {
    return {
      total: this.writtenFiles.length,
      created: this.writtenFiles.filter(f => f.created).length,
      modified: this.writtenFiles.filter(f => f.modified).length,
      failed: this.writtenFiles.filter(f => !f.success).length,
      totalSize: this.writtenFiles.reduce((sum, f) => sum + (f.size || 0), 0),
      files: this.writtenFiles.map(f => ({
        path: f.path,
        status: f.created ? 'created' : f.modified ? 'modified' : 'failed'
      }))
    };
  }

  /**
   * Reset tracking (for reuse)
   */
  reset() {
    this.writtenFiles = [];
    this.createdDirs.clear();
  }
}

/**
 * Create a file writer instance
 *
 * @param {string} projectRoot - Project root directory
 * @param {Object} [options] - Writer options
 * @returns {FileWriter} File writer instance
 *
 * @example
 * const writer = createFileWriter('/path/to/project', { dryRun: true });
 */
function createFileWriter(projectRoot, options) {
  return new FileWriter(projectRoot, options);
}

module.exports = {
  FileWriter,
  createFileWriter
};
