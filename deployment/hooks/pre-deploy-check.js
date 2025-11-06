#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * PreToolUse Hook: Pre-deployment Safety Checks
 *
 * Validates deployment operations before execution:
 * - Detects deployment-related commands
 * - Checks for uncommitted files
 * - Validates current branch
 * - Blocks execution if unsafe
 */

async function main() {
  try {
    // Read input from stdin
    const input = fs.readFileSync(0, 'utf8').trim();

    if (!input) {
      process.exit(0); // No input, exit silently
    }

    const eventData = JSON.parse(input);

    // Extract tool input
    const toolInput = eventData.tool_input || {};
    const cwd = eventData.cwd || process.cwd();

    // Change to correct directory
    process.chdir(cwd);

    // Check if this is a deployment-related command
    if (!isDeploymentCommand(toolInput)) {
      process.exit(0); // Not a deployment, allow execution
    }

    // Run safety checks
    const issues = await runSafetyChecks(toolInput);

    if (issues.length === 0) {
      process.exit(0); // All checks passed, allow execution
    }

    // Checks failed - block execution
    const output = {
      hookSpecificOutput: {
        blockExecution: true,
        additionalContext: formatIssues(issues, toolInput)
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);

  } catch (error) {
    // Silent failure - never block Claude Code
    // Log error to stderr for debugging (optional)
    process.exit(0);
  }
}

/**
 * Detect if command is deployment-related
 */
function isDeploymentCommand(toolInput) {
  const command = toolInput.command || '';
  const description = toolInput.description || '';

  // Check for deployment-related keywords
  const deploymentKeywords = [
    'deploy_dev',
    'deploy_uat',
    'deploy_prod',
    '/deploy',
    'deployment'
  ];

  const commandLower = command.toLowerCase();
  const descriptionLower = description.toLowerCase();

  // Check if command or description contains deployment keywords
  for (const keyword of deploymentKeywords) {
    if (commandLower.includes(keyword) || descriptionLower.includes(keyword)) {
      return true;
    }
  }

  // Check for git operations on deployment branches
  if (command.includes('git merge') || command.includes('git push')) {
    // Check if targeting a deployment branch
    const deployBranchPattern = /deploy_(dev|uat|prod)/;
    if (deployBranchPattern.test(command)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract environment from command if present
 */
function extractEnvironment(toolInput) {
  const command = toolInput.command || '';
  const description = toolInput.description || '';

  const envPattern = /(dev|uat|prod)/i;

  // Try to find environment in command
  const commandMatch = command.match(envPattern);
  if (commandMatch) {
    return commandMatch[1].toLowerCase();
  }

  // Try to find in description
  const descMatch = description.match(envPattern);
  if (descMatch) {
    return descMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Run all safety checks
 * Returns array of issues found
 */
async function runSafetyChecks(toolInput) {
  const issues = [];

  // Load configuration
  const configPath = path.join(process.cwd(), '.claude/deployment.config.json');

  if (!fs.existsSync(configPath)) {
    // No config = not a configured deployment project
    // Don't block, user might be doing manual git operations
    return [];
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    // Malformed config - warn but don't block
    return [{
      type: 'warning',
      message: 'Deployment config malformed',
      fix: 'Check .claude/deployment.config.json syntax'
    }];
  }

  // Extract environment from command
  const environment = extractEnvironment(toolInput);

  // Check 1: Uncommitted files
  if (config.safeguards?.checkUncommittedFiles) {
    const uncommitted = checkUncommittedFiles();
    if (uncommitted.count > 0) {
      issues.push({
        type: 'error',
        message: `${uncommitted.count} uncommitted file(s) detected`,
        details: uncommitted.files.slice(0, 5), // Show first 5 files
        fix: 'Commit or stash changes: git add . && git commit -m "..."',
        count: uncommitted.count
      });
    }
  }

  // Check 2: Branch validation
  if (config.safeguards?.checkBranch && environment) {
    const branchIssue = checkBranchValidity(config, environment);
    if (branchIssue) {
      issues.push(branchIssue);
    }
  }

  // Check 3: Environment exists
  if (environment && !config.environments[environment]) {
    issues.push({
      type: 'error',
      message: `Unknown environment: ${environment}`,
      fix: `Valid environments: ${Object.keys(config.environments).join(', ')}`
    });
  }

  return issues;
}

/**
 * Check for uncommitted files
 */
function checkUncommittedFiles() {
  try {
    const output = execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (!output) {
      return { count: 0, files: [] };
    }

    const files = output.split('\n').map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      return { status, file };
    });

    return { count: files.length, files };

  } catch (error) {
    // Not a git repo or git command failed
    return { count: 0, files: [] };
  }
}

/**
 * Check if on correct branch for deployment
 */
function checkBranchValidity(config, environment) {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const envConfig = config.environments[environment];
    if (!envConfig) {
      return null; // Environment doesn't exist
    }

    // Determine expected source branch
    let expectedBranch;
    if (envConfig.sourceBranch) {
      expectedBranch = envConfig.sourceBranch;
    } else if (envConfig.sourceEnvironment) {
      const sourceEnv = config.environments[envConfig.sourceEnvironment];
      expectedBranch = sourceEnv?.branch;
    }

    if (!expectedBranch) {
      return null; // Can't determine expected branch
    }

    if (currentBranch !== expectedBranch) {
      return {
        type: 'warning',
        message: `On branch "${currentBranch}", expected "${expectedBranch}"`,
        fix: `Switch to correct branch: git checkout ${expectedBranch}`
      };
    }

    return null; // Branch is correct

  } catch (error) {
    return null; // Git command failed, don't block
  }
}

/**
 * Format issues into user-friendly message
 */
function formatIssues(issues, toolInput) {
  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  let message = '🚫 Deployment blocked by safety checks:\n\n';

  // Show errors
  if (errors.length > 0) {
    message += '**Errors** (must fix):\n';
    for (const error of errors) {
      message += `\n❌ ${error.message}\n`;

      if (error.details && error.details.length > 0) {
        message += '   Files:\n';
        for (const detail of error.details) {
          message += `   - ${detail.file} (${detail.status})\n`;
        }
        if (error.count && error.details.length < error.count) {
          message += `   ... and ${error.count - error.details.length} more\n`;
        }
      }

      if (error.fix) {
        message += `   💡 Fix: ${error.fix}\n`;
      }
    }
  }

  // Show warnings
  if (warnings.length > 0) {
    message += '\n**Warnings** (recommended to fix):\n';
    for (const warning of warnings) {
      message += `\n⚠️ ${warning.message}\n`;
      if (warning.fix) {
        message += `   💡 Suggestion: ${warning.fix}\n`;
      }
    }
  }

  message += '\n---\n\n';
  message += 'Fix the issues above before deploying.\n';
  message += 'Once fixed, retry the deployment command.\n';

  return message;
}

main();
