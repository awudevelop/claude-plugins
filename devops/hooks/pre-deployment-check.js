#!/usr/bin/env node

/**
 * Pre-Deployment Safety Check Hook
 *
 * Runs before tool execution to validate deployment readiness.
 * Prevents deployments with missing credentials, uncommitted changes, etc.
 */

const fs = require('fs');
const path = require('path');

// Read event data from stdin
let inputData = '';
try {
  inputData = fs.readFileSync(0, 'utf8').trim();
} catch (error) {
  // Silent exit if no input
  process.exit(0);
}

// Parse event data
let eventData;
try {
  eventData = JSON.parse(inputData);
} catch (error) {
  // Invalid JSON, silent exit
  process.exit(0);
}

/**
 * Check if DevOps plugin is initialized
 */
function isDevOpsInitialized() {
  const configPath = path.join(process.cwd(), '.devops', 'config.json');
  return fs.existsSync(configPath);
}

/**
 * Check if deployment is in progress
 */
function isDeploymentCommand(eventData) {
  const toolName = eventData.toolName || '';
  const args = eventData.args || {};

  // Check if SlashCommand tool is being used with deployment commands
  if (toolName === 'SlashCommand') {
    const command = args.command || '';
    return command.startsWith('/devops:deploy') ||
           command.startsWith('/devops:infra') ||
           command.startsWith('/devops:rollback');
  }

  return false;
}

/**
 * Validate git repository status
 */
function checkGitStatus() {
  try {
    const { execSync } = require('child_process');

    // Check if git repo exists
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    } catch {
      return { valid: true, warning: 'Not a git repository' };
    }

    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });

    if (status.trim()) {
      return {
        valid: false,
        error: 'Uncommitted changes detected',
        message: 'Please commit or stash changes before deploying'
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: true, warning: 'Could not check git status' };
  }
}

/**
 * Check if credentials are configured
 */
function checkCredentials() {
  if (!isDevOpsInitialized()) {
    return { valid: true }; // Skip if not initialized
  }

  const configPath = path.join(process.cwd(), '.devops', 'config.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const secretsMode = config.secrets?.mode || 'manual';

    if (secretsMode === 'local') {
      const credentialsPath = path.join(process.cwd(), '.devops', 'credentials.enc');
      if (!fs.existsSync(credentialsPath)) {
        return {
          valid: false,
          error: 'No credentials configured',
          message: 'Run /devops:secrets set to configure credentials'
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: true, warning: 'Could not validate credentials' };
  }
}

/**
 * Main hook execution
 */
function main() {
  // Only run checks for deployment commands
  if (!isDeploymentCommand(eventData)) {
    // Not a deployment command, allow execution
    const output = {
      hookSpecificOutput: {}
    };
    console.log(JSON.stringify(output));
    process.exit(0);
    return;
  }

  // Check if DevOps is initialized
  if (!isDevOpsInitialized()) {
    // Not initialized, allow execution (init command will handle it)
    const output = {
      hookSpecificOutput: {}
    };
    console.log(JSON.stringify(output));
    process.exit(0);
    return;
  }

  // Run safety checks
  const checks = {
    git: checkGitStatus(),
    credentials: checkCredentials()
  };

  // Collect errors and warnings
  const errors = [];
  const warnings = [];

  for (const [checkName, result] of Object.entries(checks)) {
    if (!result.valid && result.error) {
      errors.push({
        check: checkName,
        error: result.error,
        message: result.message
      });
    }
    if (result.warning) {
      warnings.push({
        check: checkName,
        warning: result.warning
      });
    }
  }

  // If there are errors, block execution
  if (errors.length > 0) {
    const errorMessages = errors.map(e =>
      `❌ ${e.error}: ${e.message}`
    ).join('\n');

    const output = {
      hookSpecificOutput: {
        additionalContext: `⚠️  Pre-Deployment Check Failed\n\n${errorMessages}\n\n💡 Fix these issues before deploying`
      },
      blocked: true,
      blockMessage: 'Deployment blocked by safety checks'
    };
    console.log(JSON.stringify(output));
    process.exit(1);
    return;
  }

  // If there are warnings, show them but allow execution
  if (warnings.length > 0) {
    const warningMessages = warnings.map(w =>
      `⚠️  ${w.warning}`
    ).join('\n');

    const output = {
      hookSpecificOutput: {
        additionalContext: `⚠️  Pre-Deployment Warnings\n\n${warningMessages}\n\n✓ Proceeding with deployment`
      }
    };
    console.log(JSON.stringify(output));
    process.exit(0);
    return;
  }

  // All checks passed
  const output = {
    hookSpecificOutput: {
      additionalContext: '✓ Pre-deployment checks passed'
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Run main function
try {
  main();
} catch (error) {
  // Silent exit on any error to avoid blocking Claude Code
  process.exit(0);
}
