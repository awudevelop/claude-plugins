const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ConfigManager = require('../lib/config-manager');

describe('ConfigManager', () => {
  const testConfigPath = '.claude/test-deployment.config.json';
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager(testConfigPath);
    // Clean up any existing test config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test config after each test
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it('should check if config exists', () => {
    assert.strictEqual(configManager.exists(), false);
  });

  it('should write and read config', () => {
    const testConfig = {
      mainBranch: 'main',
      buildCommand: 'npm run build',
      environments: {
        dev: {
          branch: 'deploy_dev',
          sourceBranch: 'main'
        }
      }
    };

    configManager.write(testConfig);
    assert.strictEqual(configManager.exists(), true);

    const readConfig = configManager.read();
    assert.deepStrictEqual(readConfig, testConfig);
  });

  it('should validate config structure', () => {
    const invalidConfig = {
      mainBranch: 'main'
      // Missing required fields
    };

    assert.throws(() => {
      configManager.validate(invalidConfig);
    }, /Missing required field/);
  });

  it('should get specific environment', () => {
    const testConfig = {
      mainBranch: 'main',
      buildCommand: 'npm run build',
      environments: {
        dev: {
          branch: 'deploy_dev',
          sourceBranch: 'main'
        },
        prod: {
          branch: 'deploy_prod',
          sourceEnvironment: 'dev'
        }
      }
    };

    configManager.write(testConfig);
    const devEnv = configManager.getEnvironment('dev');
    assert.strictEqual(devEnv.branch, 'deploy_dev');
    assert.strictEqual(devEnv.sourceBranch, 'main');
  });

  it('should throw error for unknown environment', () => {
    const testConfig = {
      mainBranch: 'main',
      buildCommand: 'npm run build',
      environments: {
        dev: {
          branch: 'deploy_dev',
          sourceBranch: 'main'
        }
      }
    };

    configManager.write(testConfig);
    assert.throws(() => {
      configManager.getEnvironment('nonexistent');
    }, /Unknown environment/);
  });

  it('should throw error when reading non-existent config', () => {
    assert.throws(() => {
      configManager.read();
    }, /Configuration not found/);
  });

  it('should validate environment branch field', () => {
    const invalidConfig = {
      mainBranch: 'main',
      buildCommand: 'npm run build',
      environments: {
        dev: {
          // Missing branch field
          sourceBranch: 'main'
        }
      }
    };

    assert.throws(() => {
      configManager.validate(invalidConfig);
    }, /missing required field: branch/);
  });
});
