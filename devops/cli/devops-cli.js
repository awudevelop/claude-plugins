#!/usr/bin/env node

/**
 * DevOps CLI Tool
 *
 * Zero-dependency CLI for DevOps operations
 * Uses ONLY Node.js built-in modules
 */

const fs = require('fs');
const path = require('path');
const ConfigManager = require('./lib/config-manager');
const DeploymentTracker = require('./lib/deployment-tracker');
const SecretsManager = require('./lib/secrets-manager');
const { validatePlatform, getUnsupportedPlatformMessage } = require('./lib/validators/platform-validator');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  return { command, subcommand, options, args };
}

/**
 * Output JSON response
 */
function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output error and exit
 */
function outputError(message, details = {}) {
  const error = {
    success: false,
    error: message,
    ...details
  };
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
DevOps CLI - Zero-dependency DevOps automation (Netlify only)

Usage: node devops-cli.js <command> [options]

Commands:
  init                           Initialize DevOps configuration
  config get [--key <key>]      Get configuration
  config set --key <k> --value <v>  Set configuration
  config validate                Validate configuration
  deploy [--env <env>]          Deploy application
  status [--all]                Get deployment status
  validate-deployment           Validate deployment readiness
  deployments list [--limit <n>] List deployments
  secrets set --name <n> --value <v>  Set secret
  secrets get --name <n> [--masked]   Get secret
  secrets list                  List secrets
  --version                     Show version
  --help                        Show this help

Platform Support:
  ✓ Netlify (current)
  ⏳ AWS, GCP, Azure, Vercel (coming soon)

Examples:
  node devops-cli.js init
  node devops-cli.js config get --key platform
  node devops-cli.js deploy --env production
  node devops-cli.js status --all
  node devops-cli.js secrets set --name NETLIFY_AUTH_TOKEN --value <token>
`);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

function handleInit(options) {
  try {
    // Validate platform - force Netlify only
    const requestedPlatform = options.platform || 'netlify';
    const platformValidation = validatePlatform(requestedPlatform);

    if (!platformValidation.valid) {
      const errorMessage = getUnsupportedPlatformMessage(requestedPlatform);
      outputError(errorMessage, {
        platform: requestedPlatform,
        supportedPlatforms: platformValidation.availablePlatforms
      });
      return;
    }

    const configManager = new ConfigManager();

    // Create .devops directory
    const devopsDir = path.join(process.cwd(), '.devops');
    if (!fs.existsSync(devopsDir)) {
      fs.mkdirSync(devopsDir, { recursive: true });
    }

    // Create initial configuration - force Netlify
    const config = {
      version: '1.0',
      platform: 'netlify',
      environment: 'production',
      region: 'us-east-1',
      deployment: {
        strategy: 'rolling',
        auto_deploy: false,
        rollback_on_failure: true,
        health_check_enabled: true
      },
      cicd: {
        platform: options.cicd || 'github-actions',
        auto_build: true,
        default_branch: 'main',
        build_timeout: 600
      },
      secrets: {
        mode: options.secrets || 'local',
        provider: options.secrets === 'aws' ? 'AWS Secrets Manager' :
                 options.secrets === 'gcp' ? 'GCP Secret Manager' :
                 options.secrets === 'azure' ? 'Azure Key Vault' : 'Local',
        encryption_enabled: true
      },
      infrastructure: {
        type: 'full-stack',
        auto_scale: true,
        min_instances: 2,
        max_instances: 10
      },
      monitoring: {
        enabled: true,
        alerts_enabled: true,
        log_retention: 30,
        metrics_retention: 90
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    configManager.saveConfig(config);

    // Copy platform-specific template if available
    const templateSrc = path.join(__dirname, '..', 'templates', `${options.platform}-config.template.json`);
    if (fs.existsSync(templateSrc)) {
      const templateDest = path.join(devopsDir, `${options.platform}-config.json`);
      fs.copyFileSync(templateSrc, templateDest);
    }

    // Create other directories
    const dirs = ['deployments', 'backups', 'logs'];
    dirs.forEach(dir => {
      const dirPath = path.join(devopsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    // Initialize deployment history
    const deploymentsFile = path.join(devopsDir, 'deployments.json');
    fs.writeFileSync(deploymentsFile, JSON.stringify({
      deployments: [],
      lastDeployment: null
    }, null, 2));

    outputJson({
      success: true,
      message: 'DevOps configuration initialized',
      configPath: path.join(devopsDir, 'config.json'),
      platform: 'netlify'
    });
  } catch (error) {
    outputError('Failed to initialize DevOps configuration', { details: error.message });
  }
}

function handleConfigGet(options) {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    if (options.all) {
      outputJson(config);
    } else if (options.key) {
      const value = configManager.getValue(options.key);
      outputJson({ [options.key]: value });
    } else {
      outputJson(config);
    }
  } catch (error) {
    outputError(error.message);
  }
}

function handleConfigSet(options) {
  try {
    const configManager = new ConfigManager();
    configManager.setValue(options.key, options.value);

    outputJson({
      success: true,
      message: 'Configuration updated',
      key: options.key,
      value: options.value
    });
  } catch (error) {
    outputError(error.message);
  }
}

function handleConfigValidate() {
  try {
    const configManager = new ConfigManager();
    const result = configManager.validate();

    outputJson({
      success: result.valid,
      validations: result,
      overall: result.valid ? 'Valid' : 'Invalid'
    });
  } catch (error) {
    outputError(error.message);
  }
}

function handleDeploy(options) {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    // Validate platform
    const platform = options.platform || config.platform;
    const platformValidation = validatePlatform(platform);

    if (!platformValidation.valid) {
      const errorMessage = getUnsupportedPlatformMessage(platform);
      outputError(errorMessage, {
        platform: platform,
        supportedPlatforms: platformValidation.availablePlatforms
      });
      return;
    }

    const tracker = new DeploymentTracker();
    const environment = options.env || 'production';

    // Simulate deployment (actual implementation would call platform-specific manager)
    const deployment = {
      id: `dep_${Date.now()}`,
      version: '1.0.0',
      environment,
      platform,
      status: 'deploying',
      timestamp: new Date().toISOString()
    };

    if (options.track) {
      tracker.recordDeployment(deployment);
    }

    outputJson({
      success: true,
      deployment,
      message: 'Deployment started (simulated)'
    });
  } catch (error) {
    outputError(error.message);
  }
}

function handleStatus(options) {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    // Validate platform
    const platformValidation = validatePlatform(config.platform);

    if (!platformValidation.valid) {
      const errorMessage = getUnsupportedPlatformMessage(config.platform);
      outputError(errorMessage, {
        platform: config.platform,
        supportedPlatforms: platformValidation.availablePlatforms
      });
      return;
    }

    const tracker = new DeploymentTracker();

    const currentDeployment = tracker.getCurrentDeployment();
    const stats = tracker.getStatistics();

    outputJson({
      success: true,
      platform: config.platform,
      environment: config.environment,
      currentDeployment,
      statistics: stats
    });
  } catch (error) {
    outputError(error.message);
  }
}

function handleDeploymentsList(options) {
  try {
    const tracker = new DeploymentTracker();
    const limit = parseInt(options.limit) || 5;
    const deployments = tracker.listDeployments({ limit });

    outputJson({
      success: true,
      deployments,
      total: deployments.length
    });
  } catch (error) {
    outputError(error.message);
  }
}

function handleValidateDeployment() {
  // Placeholder validation
  outputJson({
    success: true,
    message: 'Validation passed (placeholder)',
    checks: {
      credentials: true,
      git: true,
      platform: true
    }
  });
}

function handleSecretsSet(options) {
  if (!options.name || !options.value) {
    outputError('Missing required options: --name and --value');
  }

  try {
    const secretsManager = new SecretsManager();
    const result = secretsManager.setSecret(options.name, options.value, {
      source: 'cli',
      setAt: new Date().toISOString()
    });

    outputJson({
      success: true,
      message: `Secret '${options.name}' stored securely`,
      name: options.name,
      encrypted: result.encrypted,
      storage: result.storage
    });
  } catch (error) {
    outputError('Failed to set secret', { details: error.message });
  }
}

function handleSecretsGet(options) {
  if (!options.name) {
    outputError('Missing required option: --name');
  }

  try {
    const secretsManager = new SecretsManager();
    const masked = options.masked !== undefined ? options.masked : true; // Default to masked
    const secret = secretsManager.getSecret(options.name, masked);

    outputJson({
      success: true,
      ...secret
    });
  } catch (error) {
    outputError(`Secret '${options.name}' not found`, { details: error.message });
  }
}

function handleSecretsList() {
  try {
    const secretsManager = new SecretsManager();
    const secrets = secretsManager.listSecrets();

    outputJson({
      success: true,
      secrets,
      count: secrets.length
    });
  } catch (error) {
    outputError('Failed to list secrets', { details: error.message });
  }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

function main() {
  const { command, subcommand, options, args } = parseArgs();

  // Handle no command
  if (!command || command === '--help') {
    showHelp();
    return;
  }

  // Handle version
  if (command === '--version') {
    console.log('1.0.0');
    return;
  }

  // Route commands
  try {
    switch (command) {
      case 'init':
        handleInit(options);
        break;

      case 'config':
        if (subcommand === 'get') {
          handleConfigGet(options);
        } else if (subcommand === 'set') {
          handleConfigSet(options);
        } else if (subcommand === 'validate') {
          handleConfigValidate();
        } else {
          handleConfigGet({ all: true });
        }
        break;

      case 'deploy':
        handleDeploy(options);
        break;

      case 'status':
        handleStatus(options);
        break;

      case 'validate-deployment':
        handleValidateDeployment();
        break;

      case 'deployments':
        if (subcommand === 'list') {
          handleDeploymentsList(options);
        } else {
          outputError('Unknown deployments subcommand');
        }
        break;

      case 'secrets':
        if (subcommand === 'set') {
          handleSecretsSet(options);
        } else if (subcommand === 'get') {
          handleSecretsGet(options);
        } else if (subcommand === 'list') {
          handleSecretsList();
        } else {
          outputError('Unknown secrets subcommand');
        }
        break;

      default:
        outputError(`Unknown command: ${command}`);
    }
  } catch (error) {
    outputError('Command failed', { details: error.message });
  }
}

// Run main
if (require.main === module) {
  main();
}

module.exports = { parseArgs, outputJson, outputError };
