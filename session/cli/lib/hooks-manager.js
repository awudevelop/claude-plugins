#!/usr/bin/env node

/**
 * Hooks Manager
 *
 * Utility library for managing hooks in .claude/settings.json
 * Provides safe read/write operations with atomic writes and backups
 */

const fs = require('fs');
const path = require('path');

class HooksManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.settingsPath = path.join(projectRoot, '.claude', 'settings.json');
    this.backupPath = this.settingsPath + '.backup';
  }

  /**
   * Read settings.json from project root
   * Creates default structure if file doesn't exist
   */
  readSettings() {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        // Create default settings if doesn't exist
        const defaultSettings = {
          hooks: {},
          disableAllHooks: false
        };

        // Ensure .claude directory exists
        const claudeDir = path.dirname(this.settingsPath);
        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true });
        }

        return defaultSettings;
      }

      const content = fs.readFileSync(this.settingsPath, 'utf8');
      const settings = JSON.parse(content);

      // Ensure hooks object exists
      if (!settings.hooks) {
        settings.hooks = {};
      }

      return settings;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Malformed JSON in ${this.settingsPath}: ${error.message}`);
      }
      throw new Error(`Failed to read settings: ${error.message}`);
    }
  }

  /**
   * Write settings.json with atomic operation and backup
   */
  writeSettings(settings) {
    try {
      // Validate JSON structure before writing
      this.validateSettings(settings);

      // Create backup if settings file exists
      if (fs.existsSync(this.settingsPath)) {
        this.createBackup();
      }

      // Ensure .claude directory exists
      const claudeDir = path.dirname(this.settingsPath);
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      // Write to temp file first (atomic operation)
      const tempPath = this.settingsPath + '.tmp';
      const content = JSON.stringify(settings, null, 2);
      fs.writeFileSync(tempPath, content, 'utf8');

      // Rename temp to actual (atomic on most systems)
      fs.renameSync(tempPath, this.settingsPath);

      return true;
    } catch (error) {
      throw new Error(`Failed to write settings: ${error.message}`);
    }
  }

  /**
   * Create backup of current settings.json
   */
  createBackup() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        fs.copyFileSync(this.settingsPath, this.backupPath);
        return this.backupPath;
      }
      return null;
    } catch (error) {
      // Non-fatal, continue without backup
      console.warn(`Warning: Could not create backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate settings JSON structure
   */
  validateSettings(settings) {
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Settings must be an object');
    }

    if (settings.hooks && typeof settings.hooks !== 'object') {
      throw new Error('hooks must be an object');
    }

    // Validate hooks structure
    if (settings.hooks) {
      for (const [hookType, hookEntries] of Object.entries(settings.hooks)) {
        if (!Array.isArray(hookEntries)) {
          throw new Error(`Hook type "${hookType}" must be an array`);
        }

        for (const entry of hookEntries) {
          if (typeof entry !== 'object' || !entry.hooks || !Array.isArray(entry.hooks)) {
            throw new Error(`Invalid hook entry structure in "${hookType}"`);
          }
        }
      }
    }

    return true;
  }

  /**
   * Get hooks configuration from plugin's hooks.json
   */
  getPluginHooks(pluginRoot) {
    try {
      const hooksJsonPath = path.join(pluginRoot, 'hooks', 'hooks.json');

      if (!fs.existsSync(hooksJsonPath)) {
        throw new Error(`hooks.json not found at ${hooksJsonPath}`);
      }

      const content = fs.readFileSync(hooksJsonPath, 'utf8');
      const hooks = JSON.parse(content);

      // Replace paths with ${CLAUDE_PLUGIN_ROOT} variable
      const processedHooks = this.processPluginHooks(hooks);

      return processedHooks;
    } catch (error) {
      throw new Error(`Failed to read plugin hooks: ${error.message}`);
    }
  }

  /**
   * Process plugin hooks to use ${CLAUDE_PLUGIN_ROOT} variable
   */
  processPluginHooks(hooks) {
    const processed = {};

    for (const [hookType, entries] of Object.entries(hooks)) {
      processed[hookType] = entries.map(entry => {
        return {
          ...entry,
          hooks: entry.hooks.map(hook => {
            // Command should already use ${CLAUDE_PLUGIN_ROOT}, verify/ensure it
            if (hook.type === 'command' && hook.command) {
              // If it doesn't use the variable, add it (though it should from hooks.json)
              if (!hook.command.includes('${CLAUDE_PLUGIN_ROOT}')) {
                // This is a fallback, hooks.json should already have it
                console.warn('Hook command missing ${CLAUDE_PLUGIN_ROOT}, adding it');
              }
            }
            return hook;
          })
        };
      });
    }

    return processed;
  }

  /**
   * Merge plugin hooks into existing settings
   * Avoids duplicates by checking command paths
   */
  mergeHooks(existingSettings, pluginHooks) {
    const merged = { ...existingSettings };

    if (!merged.hooks) {
      merged.hooks = {};
    }

    for (const [hookType, newEntries] of Object.entries(pluginHooks)) {
      if (!merged.hooks[hookType]) {
        // Hook type doesn't exist, add all entries
        merged.hooks[hookType] = newEntries;
      } else {
        // Hook type exists, merge carefully
        const existingEntries = merged.hooks[hookType];

        for (const newEntry of newEntries) {
          // Check if this entry already exists
          const isDuplicate = existingEntries.some(existing =>
            this.areEntriesEqual(existing, newEntry)
          );

          if (!isDuplicate) {
            existingEntries.push(newEntry);
          }
        }
      }
    }

    return merged;
  }

  /**
   * Check if two hook entries are equal (to avoid duplicates)
   */
  areEntriesEqual(entry1, entry2) {
    // Compare matcher
    if (entry1.matcher !== entry2.matcher) {
      return false;
    }

    // Compare hooks array
    if (entry1.hooks.length !== entry2.hooks.length) {
      return false;
    }

    // Check if all hooks in entry1 exist in entry2
    for (const hook1 of entry1.hooks) {
      const found = entry2.hooks.some(hook2 =>
        hook1.type === hook2.type && hook1.command === hook2.command
      );
      if (!found) {
        return false;
      }
    }

    return true;
  }

  /**
   * Remove plugin hooks from settings
   * Removes entries that contain commands with ${CLAUDE_PLUGIN_ROOT}/hooks/
   */
  removePluginHooks(existingSettings, pluginRoot) {
    const cleaned = { ...existingSettings };

    if (!cleaned.hooks) {
      return cleaned;
    }

    const pluginHookPattern = '${CLAUDE_PLUGIN_ROOT}/hooks/';

    for (const [hookType, entries] of Object.entries(cleaned.hooks)) {
      // Filter out entries that contain plugin hook commands
      const filtered = entries.filter(entry => {
        // Check if any hook in this entry is a plugin hook
        const hasPluginHook = entry.hooks.some(hook =>
          hook.command && hook.command.includes(pluginHookPattern)
        );

        // Keep entries that DON'T have plugin hooks
        return !hasPluginHook;
      });

      if (filtered.length === 0) {
        // Remove the hook type entirely if no entries left
        delete cleaned.hooks[hookType];
      } else {
        cleaned.hooks[hookType] = filtered;
      }
    }

    return cleaned;
  }

  /**
   * Detect orphaned plugin hooks (pointing to non-existent files)
   */
  detectOrphanedHooks(settings, pluginRoot) {
    const orphaned = [];

    if (!settings.hooks) {
      return orphaned;
    }

    const pluginHookPattern = '${CLAUDE_PLUGIN_ROOT}/hooks/';

    for (const [hookType, entries] of Object.entries(settings.hooks)) {
      for (const entry of entries) {
        for (const hook of entry.hooks) {
          if (hook.command && hook.command.includes(pluginHookPattern)) {
            // Extract the script path
            const scriptPath = hook.command
              .replace('node ${CLAUDE_PLUGIN_ROOT}/', '')
              .split(' ')[0]; // Get just the file path, ignore arguments

            const fullPath = path.join(pluginRoot, scriptPath);

            // Check if file exists
            if (!fs.existsSync(fullPath)) {
              orphaned.push({
                hookType,
                matcher: entry.matcher,
                command: hook.command,
                expectedPath: fullPath
              });
            }
          }
        }
      }
    }

    return orphaned;
  }

  /**
   * Get status of plugin hooks in settings
   */
  getHookStatus(pluginRoot) {
    try {
      const settings = this.readSettings();
      const pluginHooks = this.getPluginHooks(pluginRoot);
      const orphaned = this.detectOrphanedHooks(settings, pluginRoot);

      // Check which plugin hooks are configured
      const configured = {};
      const pluginHookPattern = '${CLAUDE_PLUGIN_ROOT}/hooks/';

      for (const [hookType, entries] of Object.entries(settings.hooks || {})) {
        const pluginEntries = entries.filter(entry =>
          entry.hooks.some(hook =>
            hook.command && hook.command.includes(pluginHookPattern)
          )
        );

        if (pluginEntries.length > 0) {
          configured[hookType] = pluginEntries;
        }
      }

      return {
        settingsExists: fs.existsSync(this.settingsPath),
        pluginHooksConfigured: Object.keys(configured).length > 0,
        configuredHooks: configured,
        orphanedHooks: orphaned,
        hasOrphans: orphaned.length > 0,
        totalHookTypes: Object.keys(pluginHooks).length,
        configuredHookTypes: Object.keys(configured).length
      };
    } catch (error) {
      return {
        error: error.message,
        settingsExists: fs.existsSync(this.settingsPath)
      };
    }
  }
}

module.exports = HooksManager;
