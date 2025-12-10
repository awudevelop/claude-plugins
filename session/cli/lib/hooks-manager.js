#!/usr/bin/env node

/**
 * Hooks Manager
 *
 * Utility library for managing hooks in .claude/settings.json
 * Provides safe read/write operations with atomic writes and backups
 *
 * IMPORTANT: Why Manual Hook Setup Instead of Plugin Hooks?
 * =========================================================
 * Claude Code's plugin hook system has known bugs where certain hooks
 * (UserPromptSubmit, SessionStart, Notification) execute but their OUTPUT
 * is silently discarded and never passed to the agent context.
 *
 * Affected Issues:
 * - #12151: Plugin hook output not captured (UserPromptSubmit, SessionStart)
 * - #9708: Notification hooks not executing
 * - #10225: UserPromptSubmit plugin hooks never execute
 *
 * Workaround: We use /session:setup to write hooks directly to
 * .claude/settings.json with absolute paths. This bypasses the plugin
 * hook system and uses the manual hook approach which works correctly.
 *
 * TEMPORARY: Once these issues are fixed in Claude Code, we can:
 * 1. Re-add hooks to plugin.json
 * 2. Remove the setup requirement
 * 3. Let the plugin system handle hook registration
 *
 * Track progress: https://github.com/anthropics/claude-code/issues/12151
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

      // Replace paths with absolute paths (${CLAUDE_PLUGIN_ROOT} doesn't expand properly)
      const processedHooks = this.processPluginHooks(hooks, pluginRoot);

      return processedHooks;
    } catch (error) {
      throw new Error(`Failed to read plugin hooks: ${error.message}`);
    }
  }

  /**
   * Process plugin hooks to use absolute paths
   *
   * NOTE: ${CLAUDE_PLUGIN_ROOT} variable expansion doesn't work reliably in Claude Code,
   * so we resolve to absolute paths during setup. This requires Claude Code restart after setup.
   */
  processPluginHooks(hooks, pluginRoot) {
    const processed = {};

    for (const [hookType, entries] of Object.entries(hooks)) {
      // Skip non-array entries (like _comment field)
      if (!Array.isArray(entries)) {
        continue;
      }
      processed[hookType] = entries.map(entry => {
        return {
          ...entry,
          hooks: entry.hooks.map(hook => {
            if (hook.type === 'command' && hook.command) {
              // Replace ${CLAUDE_PLUGIN_ROOT} with absolute path
              let command = hook.command;
              if (command.includes('${CLAUDE_PLUGIN_ROOT}')) {
                command = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
              }
              return {
                ...hook,
                command: command
              };
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
    // Deep clone to avoid mutating original settings
    const merged = JSON.parse(JSON.stringify(existingSettings));

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
   * Extract the hook script filename from a command string
   * e.g., "node /path/to/hooks/user-prompt-submit.js" -> "user-prompt-submit.js"
   *
   * This enables duplicate detection regardless of installation path
   * (marketplace vs dev repo vs different machines)
   */
  extractHookScriptName(command) {
    if (!command || typeof command !== 'string') {
      return null;
    }

    // Handle commands like "node /path/to/script.js" or "node ${VAR}/script.js"
    // Extract the last path component (the script filename)
    const match = command.match(/(?:^|\s|\/|\\)([^\/\\]+\.js)(?:\s|$)/);
    if (match) {
      return match[1];
    }

    // Fallback: try to get basename from the command
    const parts = command.split(/[\s\/\\]+/).filter(p => p.endsWith('.js'));
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }

  /**
   * Check if two hook entries are equal (to avoid duplicates)
   *
   * IMPORTANT: Compares hook script NAMES, not full paths.
   * This prevents duplicate hooks when the same plugin is set up from
   * different locations (e.g., marketplace vs dev repo).
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
    // Compare by script NAME, not full path (fixes duplicate detection bug)
    for (const hook1 of entry1.hooks) {
      const scriptName1 = this.extractHookScriptName(hook1.command);

      const found = entry2.hooks.some(hook2 => {
        const scriptName2 = this.extractHookScriptName(hook2.command);

        // Compare type and script name (not full command path)
        return hook1.type === hook2.type &&
               scriptName1 && scriptName2 &&
               scriptName1 === scriptName2;
      });

      if (!found) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deduplicate hooks in settings by script name
   * Keeps the FIRST occurrence (or the one matching preferredPath if specified)
   *
   * Use this to clean up settings that have duplicate hooks from different paths
   */
  deduplicateHooks(settings, preferredPath = null) {
    if (!settings.hooks) {
      return settings;
    }

    const cleaned = { ...settings, hooks: {} };

    for (const [hookType, entries] of Object.entries(settings.hooks)) {
      const seenScripts = new Map(); // scriptName+matcher -> entry
      const deduped = [];

      for (const entry of entries) {
        // Build a key from matcher + script names
        const scriptNames = entry.hooks
          .map(h => this.extractHookScriptName(h.command))
          .filter(Boolean)
          .sort()
          .join(',');

        const key = `${entry.matcher || ''}:${scriptNames}`;

        if (!seenScripts.has(key)) {
          // First occurrence - add it
          seenScripts.set(key, entry);
          deduped.push(entry);
        } else if (preferredPath) {
          // Check if this entry uses the preferred path
          const usesPreferredPath = entry.hooks.some(h =>
            h.command && h.command.includes(preferredPath)
          );

          if (usesPreferredPath) {
            // Replace the existing entry with the preferred one
            const existingIdx = deduped.findIndex(e => {
              const eScriptNames = e.hooks
                .map(h => this.extractHookScriptName(h.command))
                .filter(Boolean)
                .sort()
                .join(',');
              return `${e.matcher || ''}:${eScriptNames}` === key;
            });

            if (existingIdx >= 0) {
              deduped[existingIdx] = entry;
            }
          }
          // Otherwise skip this duplicate
        }
        // else: duplicate without preferred path - skip
      }

      if (deduped.length > 0) {
        cleaned.hooks[hookType] = deduped;
      }
    }

    return cleaned;
  }

  /**
   * Remove plugin hooks from settings
   * Removes entries that contain commands matching plugin paths (variable or absolute)
   */
  removePluginHooks(existingSettings, pluginRoot) {
    // Deep clone to avoid mutating original settings
    const cleaned = JSON.parse(JSON.stringify(existingSettings));

    if (!cleaned.hooks) {
      return cleaned;
    }

    const pluginHookPattern = '${CLAUDE_PLUGIN_ROOT}/hooks/';
    const absoluteHookPattern = path.join(pluginRoot, 'hooks') + path.sep;

    for (const [hookType, entries] of Object.entries(cleaned.hooks)) {
      // Filter out entries that contain plugin hook commands
      const filtered = entries.filter(entry => {
        // Check if any hook in this entry is a plugin hook
        const hasPluginHook = entry.hooks.some(hook =>
          hook.command && (
            hook.command.includes(pluginHookPattern) ||
            hook.command.includes(absoluteHookPattern)
          )
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
    const absoluteHookPattern = path.join(pluginRoot, 'hooks') + path.sep;

    for (const [hookType, entries] of Object.entries(settings.hooks)) {
      for (const entry of entries) {
        for (const hook of entry.hooks) {
          if (hook.command && (
            hook.command.includes(pluginHookPattern) ||
            hook.command.includes(absoluteHookPattern)
          )) {
            let fullPath;

            // Extract the script path based on format
            if (hook.command.includes(pluginHookPattern)) {
              const scriptPath = hook.command
                .replace('node ${CLAUDE_PLUGIN_ROOT}/', '')
                .split(' ')[0];
              fullPath = path.join(pluginRoot, scriptPath);
            } else {
              // Absolute path - extract the file path after 'node '
              const match = hook.command.match(/node\s+(.+?)(?:\s|$)/);
              if (match) {
                fullPath = match[1];
              }
            }

            // Check if file exists
            if (fullPath && !fs.existsSync(fullPath)) {
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
      const absoluteHookPattern = path.join(pluginRoot, 'hooks') + path.sep;

      for (const [hookType, entries] of Object.entries(settings.hooks || {})) {
        const pluginEntries = entries.filter(entry =>
          entry.hooks.some(hook =>
            hook.command && (
              hook.command.includes(pluginHookPattern) ||
              hook.command.includes(absoluteHookPattern)
            )
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

  /**
   * Get session plugin permissions (read-only, safe permissions)
   * These eliminate permission prompts during session operations
   */
  getSessionPermissions() {
    return [
      // Session file access (read-only for session files)
      'Read(.claude/sessions/**)',

      // Git read-only commands for history refresh
      'Bash(git log --oneline:*)',
      'Bash(git status --porcelain:*)',
      'Bash(git diff --stat:*)',
      'Bash(git branch -vv:*)',
      'Bash(git rev-parse --abbrev-ref:*)'
    ];
  }

  /**
   * Merge session permissions into existing settings
   * Preserves all existing permissions, only adds missing ones
   */
  mergePermissions(existingSettings, sessionPermissions) {
    // Deep clone to avoid mutating original settings
    const merged = JSON.parse(JSON.stringify(existingSettings));

    // Initialize permissions structure if doesn't exist
    if (!merged.permissions) {
      merged.permissions = {};
    }

    if (!merged.permissions.allow) {
      merged.permissions.allow = [];
    }

    // Merge session permissions, avoiding duplicates
    for (const perm of sessionPermissions) {
      if (!merged.permissions.allow.includes(perm)) {
        merged.permissions.allow.push(perm);
      }
    }

    return merged;
  }

  /**
   * Check if session permissions are already configured
   * Returns true only if ALL session permissions are present
   */
  hasSessionPermissions(settings) {
    const sessionPerms = this.getSessionPermissions();

    if (!settings.permissions || !settings.permissions.allow) {
      return false;
    }

    // Check if all session permissions are present
    return sessionPerms.every(perm =>
      settings.permissions.allow.includes(perm)
    );
  }

  /**
   * Count how many session permissions are configured
   */
  countSessionPermissions(settings) {
    const sessionPerms = this.getSessionPermissions();

    if (!settings.permissions || !settings.permissions.allow) {
      return 0;
    }

    return sessionPerms.filter(perm =>
      settings.permissions.allow.includes(perm)
    ).length;
  }
}

module.exports = HooksManager;
