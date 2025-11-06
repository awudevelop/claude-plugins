const ConfigManager = require('../config-manager');
const GitHelper = require('../git-helper');

async function validate(args) {
  const configManager = new ConfigManager();
  const gitHelper = new GitHelper();
  const options = parseArgs(args);

  const results = {
    success: true,
    checks: [],
    errors: [],
    warnings: []
  };

  // Check 1: Config exists
  if (!configManager.exists()) {
    results.errors.push({
      check: 'config_exists',
      message: 'Deployment configuration not found',
      fix: 'Run /deploy:init to create configuration'
    });
    results.success = false;
  } else {
    results.checks.push({ check: 'config_exists', status: 'pass' });
  }

  // Check 2: Git status (if enabled)
  if (options.checkGit && configManager.exists()) {
    const config = configManager.read();

    if (config.safeguards?.checkUncommittedFiles) {
      if (gitHelper.hasUncommittedChanges()) {
        const count = gitHelper.getUncommittedCount();
        results.errors.push({
          check: 'uncommitted_files',
          message: `${count} uncommitted file(s) detected`,
          fix: 'Commit or stash changes: git add . && git commit -m "..."'
        });
        results.success = false;
      } else {
        results.checks.push({ check: 'uncommitted_files', status: 'pass' });
      }
    }
  }

  // Check 3: Branch validation (if env specified)
  if (options.env && configManager.exists()) {
    try {
      const envConfig = configManager.getEnvironment(options.env);
      const currentBranch = gitHelper.getCurrentBranch();

      // Determine expected branch based on environment source
      let expectedBranch;
      if (envConfig.sourceBranch) {
        expectedBranch = envConfig.sourceBranch;
      } else if (envConfig.sourceEnvironment) {
        const sourceEnv = configManager.getEnvironment(envConfig.sourceEnvironment);
        expectedBranch = sourceEnv.branch;
      }

      if (expectedBranch && currentBranch !== expectedBranch) {
        results.warnings.push({
          check: 'branch_validation',
          message: `Current branch "${currentBranch}" does not match expected "${expectedBranch}"`,
          fix: `Switch to correct branch: git checkout ${expectedBranch}`
        });
      } else if (expectedBranch) {
        results.checks.push({ check: 'branch_validation', status: 'pass' });
      }
    } catch (error) {
      results.errors.push({
        check: 'environment_validation',
        message: error.message
      });
      results.success = false;
    }
  }

  // Summary
  results.summary = {
    total: results.checks.length + results.errors.length + results.warnings.length,
    passed: results.checks.length,
    failed: results.errors.length,
    warnings: results.warnings.length
  };

  return results;
}

function parseArgs(args) {
  const options = {
    checkGit: false,
    checkBuild: false,
    env: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check-git') {
      options.checkGit = true;
    } else if (args[i] === '--check-build') {
      options.checkBuild = true;
    } else if (args[i] === '--env' && args[i + 1]) {
      options.env = args[i + 1];
      i++;
    }
  }

  return options;
}

module.exports = validate;
