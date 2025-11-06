const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = '.claude/deployment.config.json') {
    this.configPath = path.resolve(process.cwd(), configPath);
  }

  exists() {
    return fs.existsSync(this.configPath);
  }

  read() {
    if (!this.exists()) {
      throw new Error('Configuration not found. Run /deploy:init first.');
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  write(config) {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.validate(config);

    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf8'
      );
      return { success: true, path: this.configPath };
    } catch (error) {
      throw new Error(`Failed to write config: ${error.message}`);
    }
  }

  validate(config) {
    // Validate required fields
    if (!config.mainBranch) {
      throw new Error('Missing required field: mainBranch');
    }
    if (!config.buildCommand) {
      throw new Error('Missing required field: buildCommand');
    }
    if (!config.environments || Object.keys(config.environments).length === 0) {
      throw new Error('Missing required field: environments');
    }

    // Validate each environment
    for (const [envName, envConfig] of Object.entries(config.environments)) {
      if (!envConfig.branch) {
        throw new Error(`Environment "${envName}" missing required field: branch`);
      }
    }

    return true;
  }

  getEnvironment(envName) {
    const config = this.read();
    if (!config.environments[envName]) {
      const available = Object.keys(config.environments).join(', ');
      throw new Error(
        `Unknown environment "${envName}". Available: ${available}`
      );
    }
    return config.environments[envName];
  }
}

module.exports = ConfigManager;
