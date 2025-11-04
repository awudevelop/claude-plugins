/**
 * Validate command - Validate index integrity
 */

const IndexManager = require('../index-manager');

/**
 * Validate index
 * @param {Array} args - Command arguments
 * @returns {Object} Validation result
 */
async function validateCommand(args) {
  const shouldFix = args.includes('--fix');
  const indexManager = new IndexManager();

  // Read with validation to ensure index exists
  indexManager.read({ skipValidation: true });

  const validation = indexManager.validate();

  if (!validation.valid && shouldFix) {
    const fixResult = indexManager.fix();
    return {
      ...validation,
      fixed: true,
      fixedCount: fixResult.fixed,
      fixDetails: fixResult.issues
    };
  }

  return validation;
}

module.exports = validateCommand;
