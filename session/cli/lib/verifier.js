/**
 * Code verification utilities for plan execution
 *
 * Runs typecheck, lint, and tests on generated code.
 *
 * @module verifier
 * @category CLI
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Verification result for a single check
 * @typedef {Object} CheckResult
 * @property {string} check - Check name (typecheck, lint, test)
 * @property {boolean} passed - Whether check passed
 * @property {string} [output] - Command output
 * @property {string} [error] - Error message if failed
 * @property {Array<{file: string, line: number, message: string}>} [issues] - Parsed issues
 */

/**
 * Full verification result
 * @typedef {Object} VerificationResult
 * @property {boolean} passed - Whether all checks passed
 * @property {CheckResult} typecheck - TypeScript check result
 * @property {CheckResult} lint - ESLint result
 * @property {CheckResult} test - Test result
 * @property {number} duration - Total duration in ms
 */

/**
 * Code verifier for running quality checks
 *
 * @class
 * @category CLI
 * @example
 * const verifier = new Verifier('/project/root');
 * const result = await verifier.verify('src/auth/methods.ts');
 */
class Verifier {
  /**
   * Create a new Verifier
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options] - Verifier options
   * @param {boolean} [options.skipTypecheck=false] - Skip TypeScript check
   * @param {boolean} [options.skipLint=false] - Skip ESLint
   * @param {boolean} [options.skipTest=false] - Skip tests
   * @param {number} [options.timeout=30000] - Command timeout in ms
   */
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.skipTypecheck = options.skipTypecheck || false;
    this.skipLint = options.skipLint || false;
    this.skipTest = options.skipTest || false;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Run all verification checks on a file
   *
   * @param {string} filePath - File to verify
   * @param {Object} [options] - Verification options
   * @param {string} [options.testFile] - Associated test file
   * @returns {Promise<VerificationResult>} Verification result
   *
   * @example
   * const result = await verifier.verify('src/utils/helpers.ts', {
   *   testFile: 'src/utils/__tests__/helpers.test.ts'
   * });
   */
  async verify(filePath, options = {}) {
    const startTime = Date.now();
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const results = {
      passed: true,
      typecheck: { check: 'typecheck', passed: true },
      lint: { check: 'lint', passed: true },
      test: { check: 'test', passed: true },
      duration: 0
    };

    // Run typecheck
    if (!this.skipTypecheck && this.isTypeScriptFile(absolutePath)) {
      results.typecheck = await this.runTypecheck(absolutePath);
      if (!results.typecheck.passed) results.passed = false;
    }

    // Run lint
    if (!this.skipLint) {
      results.lint = await this.runLint(absolutePath);
      if (!results.lint.passed) results.passed = false;
    }

    // Run tests
    if (!this.skipTest && options.testFile) {
      results.test = await this.runTest(options.testFile);
      if (!results.test.passed) results.passed = false;
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Run TypeScript type checking
   *
   * @param {string} filePath - File to check
   * @returns {Promise<CheckResult>} Check result
   */
  async runTypecheck(filePath) {
    const result = {
      check: 'typecheck',
      passed: false,
      issues: []
    };

    try {
      // Check if tsconfig exists
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      try {
        await fs.access(tsconfigPath);
      } catch {
        result.passed = true;
        result.output = 'No tsconfig.json found, skipping typecheck';
        return result;
      }

      const { stdout, stderr } = await execAsync(
        `npx tsc --noEmit --pretty false "${filePath}"`,
        { cwd: this.projectRoot, timeout: this.timeout }
      );

      result.passed = true;
      result.output = stdout || 'No type errors';

    } catch (error) {
      result.passed = false;
      result.error = error.stderr || error.message;
      result.issues = this.parseTypeScriptErrors(error.stderr || error.stdout || '');
    }

    return result;
  }

  /**
   * Run ESLint
   *
   * @param {string} filePath - File to lint
   * @returns {Promise<CheckResult>} Check result
   */
  async runLint(filePath) {
    const result = {
      check: 'lint',
      passed: false,
      issues: []
    };

    try {
      // Check if ESLint config exists
      const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml', 'eslint.config.js'];
      let hasEslint = false;
      for (const config of eslintConfigs) {
        try {
          await fs.access(path.join(this.projectRoot, config));
          hasEslint = true;
          break;
        } catch {
          continue;
        }
      }

      if (!hasEslint) {
        result.passed = true;
        result.output = 'No ESLint config found, skipping lint';
        return result;
      }

      const { stdout } = await execAsync(
        `npx eslint --format json "${filePath}"`,
        { cwd: this.projectRoot, timeout: this.timeout }
      );

      const lintResult = JSON.parse(stdout);
      const fileResult = lintResult[0];

      if (!fileResult || fileResult.errorCount === 0) {
        result.passed = true;
        result.output = 'No lint errors';
      } else {
        result.passed = false;
        result.issues = fileResult.messages.map(m => ({
          file: filePath,
          line: m.line,
          message: `${m.ruleId}: ${m.message}`
        }));
      }

    } catch (error) {
      // ESLint exits with non-zero on lint errors
      try {
        const lintResult = JSON.parse(error.stdout);
        const fileResult = lintResult[0];
        if (fileResult) {
          result.passed = fileResult.errorCount === 0;
          result.issues = fileResult.messages
            .filter(m => m.severity === 2)
            .map(m => ({
              file: filePath,
              line: m.line,
              message: `${m.ruleId}: ${m.message}`
            }));
        }
      } catch {
        result.passed = false;
        result.error = error.message;
      }
    }

    return result;
  }

  /**
   * Run tests for a file
   *
   * @param {string} testFile - Test file to run
   * @returns {Promise<CheckResult>} Check result
   */
  async runTest(testFile) {
    const result = {
      check: 'test',
      passed: false
    };

    try {
      const absoluteTestPath = path.isAbsolute(testFile)
        ? testFile
        : path.join(this.projectRoot, testFile);

      // Check if test file exists
      try {
        await fs.access(absoluteTestPath);
      } catch {
        result.passed = true;
        result.output = 'Test file not found, skipping';
        return result;
      }

      // Detect test runner
      const pkgPath = path.join(this.projectRoot, 'package.json');
      let testCommand = 'npx jest';

      try {
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
        if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) {
          testCommand = 'npx vitest run';
        }
      } catch {
        // Use default jest
      }

      const { stdout } = await execAsync(
        `${testCommand} "${testFile}" --passWithNoTests`,
        { cwd: this.projectRoot, timeout: this.timeout }
      );

      result.passed = true;
      result.output = this.parseTestOutput(stdout);

    } catch (error) {
      result.passed = false;
      result.error = error.stderr || error.message;
      result.output = this.parseTestOutput(error.stdout || '');
    }

    return result;
  }

  /**
   * Quick verify - just typecheck
   *
   * @param {string} filePath - File to check
   * @returns {Promise<boolean>} Whether typecheck passed
   */
  async quickVerify(filePath) {
    if (!this.isTypeScriptFile(filePath)) return true;
    const result = await this.runTypecheck(filePath);
    return result.passed;
  }

  /**
   * Check if file is TypeScript
   * @private
   */
  isTypeScriptFile(filePath) {
    return /\.(ts|tsx)$/.test(filePath);
  }

  /**
   * Parse TypeScript error output
   * @private
   */
  parseTypeScriptErrors(output) {
    const issues = [];
    const errorRegex = /(.+)\((\d+),(\d+)\): error TS\d+: (.+)/g;
    let match;

    while ((match = errorRegex.exec(output)) !== null) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[4]
      });
    }

    return issues;
  }

  /**
   * Parse test output for summary
   * @private
   */
  parseTestOutput(output) {
    // Look for test count summary
    const passMatch = output.match(/(\d+) pass/i);
    const failMatch = output.match(/(\d+) fail/i);

    if (passMatch || failMatch) {
      const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
      const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
      return `${passed} passed, ${failed} failed`;
    }

    return output.slice(0, 200);
  }
}

/**
 * Create a verifier instance
 *
 * @param {string} projectRoot - Project root directory
 * @param {Object} [options] - Verifier options
 * @returns {Verifier} Verifier instance
 *
 * @example
 * const verifier = createVerifier('/path/to/project');
 * const result = await verifier.verify('src/index.ts');
 */
function createVerifier(projectRoot, options) {
  return new Verifier(projectRoot, options);
}

module.exports = {
  Verifier,
  createVerifier
};
