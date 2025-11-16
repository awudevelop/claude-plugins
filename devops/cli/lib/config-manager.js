/**
 * Configuration Manager
 *
 * Handles DevOps configuration loading, validation, and management
 * Uses ONLY Node.js built-in modules (zero dependencies)
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(rootPath = process.cwd()) {
    this.rootPath = rootPath;
    this.configDir = path.join(rootPath, '.devops');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  /**
   * Ensure directory exists (recursive)
   */
  _ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Read JSON file
   */
  _readJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write JSON file
   */
  _writeJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Check if DevOps is initialized
   */
  isInitialized() {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get configuration
   */
  getConfig() {
    if (!this.isInitialized()) {
      throw new Error('DevOps not initialized. Run /devops:init first');
    }
    return this._readJson(this.configPath);
  }

  /**
   * Save configuration
   */
  saveConfig(config) {
    this._ensureDir(this.configDir);
    config.updated = new Date().toISOString();
    this._writeJson(this.configPath, config);
  }

  /**
   * Get specific config value
   */
  getValue(key) {
    const config = this.getConfig();
    return key.split('.').reduce((obj, k) => obj?.[k], config);
  }

  /**
   * Set specific config value
   */
  setValue(key, value) {
    const config = this.getConfig();
    const keys = key.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    this.saveConfig(config);
  }

  /**
   * Validate configuration
   */
  validate() {
    const config = this.getConfig();
    const errors = [];
    const warnings = [];

    // Validate platform
    const validPlatforms = ['aws', 'gcp', 'azure', 'netlify', 'vercel'];
    if (!validPlatforms.includes(config.platform)) {
      errors.push(`Invalid platform: ${config.platform}`);
    }

    // Validate environment
    if (!config.environment) {
      errors.push('Environment not configured');
    }

    // Validate deployment config
    if (!config.deployment) {
      errors.push('Deployment configuration missing');
    }

    // Validate CI/CD config
    if (!config.cicd) {
      warnings.push('CI/CD configuration missing');
    }

    // Validate secrets config
    if (!config.secrets) {
      errors.push('Secrets configuration missing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Export configuration
   */
  exportConfig(outputPath) {
    const config = this.getConfig();
    this._writeJson(outputPath, config);
    return outputPath;
  }

  /**
   * Import configuration
   */
  importConfig(inputPath, backup = true) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Import file not found: ${inputPath}`);
    }

    // Create backup if requested
    if (backup && this.isInitialized()) {
      const backupDir = path.join(this.configDir, 'backups');
      this._ensureDir(backupDir);
      const backupPath = path.join(backupDir, `config-backup-${Date.now()}.json`);

      const currentConfig = fs.readFileSync(this.configPath);
      fs.writeFileSync(backupPath, currentConfig);
    }

    // Import new configuration
    const newConfig = this._readJson(inputPath);
    this.saveConfig(newConfig);
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig() {
    const config = this.getConfig();
    const platformConfigPath = path.join(
      this.configDir,
      `${config.platform}-config.json`
    );

    if (fs.existsSync(platformConfigPath)) {
      return this._readJson(platformConfigPath);
    }

    return null;
  }
}

module.exports = ConfigManager;
