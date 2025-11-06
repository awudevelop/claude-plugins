const ConfigManager = require('../config-manager');

async function config(args) {
  const configManager = new ConfigManager();
  const options = parseArgs(args);

  if (!configManager.exists()) {
    throw new Error('Configuration not found. Run /deploy:init first.');
  }

  // Get entire config
  if (!options.get && !options.set) {
    const config = configManager.read();
    return {
      success: true,
      config: config
    };
  }

  // Get specific value
  if (options.get) {
    const config = configManager.read();
    const value = getNestedValue(config, options.get);
    return {
      success: true,
      key: options.get,
      value: value
    };
  }

  // Set value (future enhancement)
  if (options.set) {
    throw new Error('Setting config values not yet implemented. Edit .claude/deployment.config.json manually.');
  }
}

function getNestedValue(obj, path) {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === undefined || value === null) {
      return undefined;
    }
    value = value[key];
  }

  return value;
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--get' && args[i + 1]) {
      options.get = args[i + 1];
      i++;
    } else if (args[i] === '--set' && args[i + 1]) {
      options.set = args[i + 1];
      i++;
    }
  }

  return options;
}

module.exports = config;
