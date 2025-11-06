const ConfigManager = require('../config-manager');

async function init(args) {
  const configManager = new ConfigManager();

  // Parse arguments
  const options = parseArgs(args);

  // Check if config already exists
  if (configManager.exists()) {
    throw new Error(
      'Configuration already exists at .claude/deployment.config.json. ' +
      'Use /deploy:config to modify it.'
    );
  }

  // Create default config
  const config = {
    mainBranch: options.mainBranch || 'main',
    buildCommand: options.buildCommand || 'npm run build',
    environments: {
      dev: {
        branch: 'deploy_dev',
        sourceBranch: 'main',
        requireTests: true,
        requireApproval: false
      },
      uat: {
        branch: 'deploy_uat',
        sourceEnvironment: 'dev',
        requireTests: true,
        requireApproval: false
      },
      prod: {
        branch: 'deploy_prod',
        sourceEnvironment: 'uat',
        requireTests: true,
        requireApproval: false
      }
    },
    safeguards: {
      checkUncommittedFiles: true,
      requireCleanBuild: true,
      checkBranch: true
    }
  };

  // Write config
  const result = configManager.write(config);

  return {
    success: true,
    message: 'Deployment configuration initialized',
    path: result.path,
    config: config
  };
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--main-branch' && args[i + 1]) {
      options.mainBranch = args[i + 1];
      i++;
    } else if (args[i] === '--build-command' && args[i + 1]) {
      options.buildCommand = args[i + 1];
      i++;
    }
  }

  return options;
}

module.exports = init;
