#!/usr/bin/env node

/**
 * Setup Hooks Command
 *
 * Manages session plugin hooks in .claude/settings.json
 *
 * Operations:
 * - install: Add session hooks to settings.json
 * - remove: Remove session hooks from settings.json
 * - status: Show current hook configuration
 * - cleanup: Force cleanup of orphaned hooks
 */

const HooksManager = require('../hooks-manager');
const path = require('path');

/**
 * Parse command arguments
 */
function parseArgs(args) {
  const parsed = {
    projectRoot: process.cwd(),
    pluginRoot: process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '../../..'),
    remove: args.includes('--remove'),
    status: args.includes('--status'),
    forceCleanup: args.includes('--force-cleanup'),
    dryRun: args.includes('--dry-run')
  };

  // Check for custom project root
  const projectRootIndex = args.indexOf('--project-root');
  if (projectRootIndex !== -1 && args[projectRootIndex + 1]) {
    parsed.projectRoot = args[projectRootIndex + 1];
  }

  // Check for custom plugin root
  const pluginRootIndex = args.indexOf('--plugin-root');
  if (pluginRootIndex !== -1 && args[pluginRootIndex + 1]) {
    parsed.pluginRoot = args[pluginRootIndex + 1];
  }

  return parsed;
}

/**
 * Setup hooks command handler
 */
function setupHooks(args) {
  const {
    projectRoot,
    pluginRoot,
    remove,
    status,
    forceCleanup,
    dryRun
  } = parseArgs(args);

  const manager = new HooksManager(projectRoot);

  try {
    // Status operation
    if (status) {
      return showStatus(manager, pluginRoot);
    }

    // Cleanup operation
    if (forceCleanup) {
      return cleanupOrphanedHooks(manager, pluginRoot, dryRun);
    }

    // Remove operation
    if (remove) {
      return removeHooks(manager, pluginRoot, dryRun);
    }

    // Default: Install operation
    return installHooks(manager, pluginRoot, dryRun);

  } catch (error) {
    return {
      success: false,
      error: error.message,
      action: 'error'
    };
  }
}

/**
 * Install hooks to settings.json
 */
function installHooks(manager, pluginRoot, dryRun) {
  try {
    // Read current settings
    const settings = manager.readSettings();

    // Get plugin hooks
    const pluginHooks = manager.getPluginHooks(pluginRoot);

    // Check if already configured
    const status = manager.getHookStatus(pluginRoot);
    if (status.pluginHooksConfigured &&
        status.configuredHookTypes === status.totalHookTypes &&
        !status.hasOrphans) {
      return {
        success: true,
        action: 'already_configured',
        message: 'Session plugin hooks are already configured',
        configuredHooks: status.configuredHooks,
        hookTypes: Object.keys(status.configuredHooks)
      };
    }

    // Merge hooks
    const merged = manager.mergeHooks(settings, pluginHooks);

    if (dryRun) {
      return {
        success: true,
        action: 'dry_run',
        message: 'Dry run - no changes made',
        wouldAdd: pluginHooks,
        currentSettings: settings,
        mergedSettings: merged
      };
    }

    // Create backup
    const backupPath = manager.createBackup();

    // Write merged settings
    manager.writeSettings(merged);

    return {
      success: true,
      action: 'installed',
      message: 'Session plugin hooks installed successfully',
      hooksAdded: pluginHooks,
      hookTypes: Object.keys(pluginHooks),
      backupPath: backupPath,
      settingsPath: manager.settingsPath
    };

  } catch (error) {
    return {
      success: false,
      action: 'install_failed',
      error: error.message
    };
  }
}

/**
 * Remove hooks from settings.json
 */
function removeHooks(manager, pluginRoot, dryRun) {
  try {
    // Read current settings
    const settings = manager.readSettings();

    // Check if hooks are configured
    const status = manager.getHookStatus(pluginRoot);
    if (!status.pluginHooksConfigured) {
      return {
        success: true,
        action: 'not_configured',
        message: 'No session plugin hooks found in settings.json'
      };
    }

    // Remove plugin hooks
    const cleaned = manager.removePluginHooks(settings, pluginRoot);

    if (dryRun) {
      return {
        success: true,
        action: 'dry_run',
        message: 'Dry run - no changes made',
        wouldRemove: status.configuredHooks,
        currentSettings: settings,
        cleanedSettings: cleaned
      };
    }

    // Create backup
    const backupPath = manager.createBackup();

    // Write cleaned settings
    manager.writeSettings(cleaned);

    return {
      success: true,
      action: 'removed',
      message: 'Session plugin hooks removed successfully',
      hooksRemoved: status.configuredHooks,
      hookTypes: Object.keys(status.configuredHooks),
      backupPath: backupPath,
      settingsPath: manager.settingsPath
    };

  } catch (error) {
    return {
      success: false,
      action: 'remove_failed',
      error: error.message
    };
  }
}

/**
 * Show current hook status
 */
function showStatus(manager, pluginRoot) {
  try {
    const status = manager.getHookStatus(pluginRoot);

    if (status.error) {
      return {
        success: false,
        action: 'status',
        error: status.error,
        settingsExists: status.settingsExists
      };
    }

    return {
      success: true,
      action: 'status',
      settingsExists: status.settingsExists,
      pluginHooksConfigured: status.pluginHooksConfigured,
      configuredHooks: status.configuredHooks,
      orphanedHooks: status.orphanedHooks,
      hasOrphans: status.hasOrphans,
      totalHookTypes: status.totalHookTypes,
      configuredHookTypes: status.configuredHookTypes,
      settingsPath: manager.settingsPath
    };

  } catch (error) {
    return {
      success: false,
      action: 'status_failed',
      error: error.message
    };
  }
}

/**
 * Cleanup orphaned hooks
 */
function cleanupOrphanedHooks(manager, pluginRoot, dryRun) {
  try {
    // Read current settings
    const settings = manager.readSettings();

    // Detect orphaned hooks
    const orphaned = manager.detectOrphanedHooks(settings, pluginRoot);

    if (orphaned.length === 0) {
      return {
        success: true,
        action: 'no_orphans',
        message: 'No orphaned hooks found'
      };
    }

    if (dryRun) {
      return {
        success: true,
        action: 'dry_run',
        message: 'Dry run - no changes made',
        orphanedHooks: orphaned
      };
    }

    // Remove orphaned hooks (same as remove operation)
    const cleaned = manager.removePluginHooks(settings, pluginRoot);

    // Create backup
    const backupPath = manager.createBackup();

    // Write cleaned settings
    manager.writeSettings(cleaned);

    return {
      success: true,
      action: 'cleaned',
      message: 'Orphaned hooks cleaned up successfully',
      orphanedHooks: orphaned,
      removedCount: orphaned.length,
      backupPath: backupPath,
      settingsPath: manager.settingsPath
    };

  } catch (error) {
    return {
      success: false,
      action: 'cleanup_failed',
      error: error.message
    };
  }
}

module.exports = setupHooks;
