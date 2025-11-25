const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Writes a file atomically using a temp file + rename strategy
 * @param {string} filePath - Target file path
 * @param {string|Buffer} content - Content to write
 * @param {Object} [options] - Write options (encoding, mode, etc.)
 * @returns {Promise<void>}
 */
async function writeFileAtomic(filePath, content, options = {}) {
  const tempDir = options.tempDir || path.dirname(filePath);
  const tempFile = path.join(tempDir, `.${path.basename(filePath)}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`);

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write to temp file
    await fs.writeFile(tempFile, content, options);

    // Atomic rename
    await fs.rename(tempFile, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw new Error(`Failed to write file atomically: ${error.message}`);
  }
}

/**
 * Reads multiple files in parallel
 * @param {Array<string>} filePaths - Array of file paths to read
 * @param {Object} [options] - Read options (encoding, etc.)
 * @returns {Promise<Object>} Object mapping file paths to their contents
 */
async function readMultipleFiles(filePaths, options = { encoding: 'utf8' }) {
  const results = {};
  const errors = {};

  const readPromises = filePaths.map(async (filePath) => {
    try {
      const content = await fs.readFile(filePath, options);
      results[filePath] = content;
    } catch (error) {
      errors[filePath] = error.message;
    }
  });

  await Promise.all(readPromises);

  // If any errors occurred, throw with details
  if (Object.keys(errors).length > 0) {
    const error = new Error('Failed to read some files');
    error.code = 'PARTIAL_READ_FAILURE';
    error.errors = errors;
    error.results = results;
    throw error;
  }

  return results;
}

/**
 * Writes multiple files atomically - all succeed or all fail
 * @param {Object} fileMap - Object mapping file paths to their contents
 * @param {Object} [options] - Write options
 * @returns {Promise<void>}
 */
async function writeMultipleFilesAtomic(fileMap, options = {}) {
  const tempFiles = [];
  const filePaths = Object.keys(fileMap);

  try {
    // Step 1: Create temp files for all writes
    for (const filePath of filePaths) {
      const tempDir = options.tempDir || path.dirname(filePath);
      const tempFile = path.join(tempDir, `.${path.basename(filePath)}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write to temp file
      await fs.writeFile(tempFile, fileMap[filePath], options);

      tempFiles.push({ tempFile, targetFile: filePath });
    }

    // Step 2: Atomically rename all temp files (all or nothing)
    for (const { tempFile, targetFile } of tempFiles) {
      await fs.rename(tempFile, targetFile);
    }
  } catch (error) {
    // Rollback: Clean up all temp files
    for (const { tempFile } of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    const err = new Error(`Failed to write multiple files atomically: ${error.message}`);
    err.code = 'ATOMIC_WRITE_FAILURE';
    err.originalError = error;
    throw err;
  }
}

/**
 * Safely reads a JSON file with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object>} Parsed JSON object
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const err = new Error(`File not found: ${filePath}`);
      err.code = 'FILE_NOT_FOUND';
      throw err;
    }

    if (error instanceof SyntaxError) {
      const err = new Error(`Invalid JSON in file: ${filePath}`);
      err.code = 'INVALID_JSON';
      err.originalError = error;
      throw err;
    }

    throw error;
  }
}

/**
 * Safely writes a JSON file atomically
 * @param {string} filePath - Path to JSON file
 * @param {Object} data - Data to write
 * @param {Object} [options] - Write options
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, data, options = {}) {
  const indent = options.indent !== undefined ? options.indent : 2;
  const content = JSON.stringify(data, null, indent);
  await writeFileAtomic(filePath, content, { encoding: 'utf8' });
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely copies a file
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 * @returns {Promise<void>}
 */
async function copyFile(source, destination) {
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  } catch (error) {
    throw new Error(`Failed to copy file from ${source} to ${destination}: ${error.message}`);
  }
}

/**
 * Recursively copies a directory
 * @param {string} source - Source directory
 * @param {string} destination - Destination directory
 * @returns {Promise<void>}
 */
async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Creates a backup of a plan directory
 * @param {string} planDir - Path to the plan directory
 * @returns {Promise<string>} Path to the created backup
 */
async function createBackup(planDir) {
  try {
    // Check if plan directory exists
    const exists = await fileExists(planDir);
    if (!exists) {
      throw new Error(`Plan directory does not exist: ${planDir}`);
    }

    // Create backup directory if it doesn't exist
    const backupBaseDir = path.join(planDir, '.backups');
    await fs.mkdir(backupBaseDir, { recursive: true });

    // Generate timestamp for backup name
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '-')
      .replace(/\..+/, '')
      .replace(/:/g, '');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(backupBaseDir, backupName);

    // Copy entire plan directory to backup (excluding .backups)
    await fs.mkdir(backupPath, { recursive: true });

    const entries = await fs.readdir(planDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip .backups directory itself
      if (entry.name === '.backups') {
        continue;
      }

      const sourcePath = path.join(planDir, entry.name);
      const destPath = path.join(backupPath, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    }

    // Auto-cleanup: keep only last 5 backups
    await cleanupOldBackups(backupBaseDir, 5);

    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Restores a plan from a backup
 * @param {string} backupPath - Path to the backup directory
 * @returns {Promise<string>} Path to the restored plan directory
 */
async function restoreFromBackup(backupPath) {
  try {
    // Check if backup exists
    const exists = await fileExists(backupPath);
    if (!exists) {
      throw new Error(`Backup does not exist: ${backupPath}`);
    }

    // Determine target directory (parent of .backups)
    const backupDir = path.dirname(backupPath);
    const planDir = path.dirname(backupDir);

    // Create a temporary backup of current state before restore
    let currentBackup = null;
    try {
      const currentExists = await fileExists(planDir);
      if (currentExists) {
        currentBackup = await createBackup(planDir);
      }
    } catch (error) {
      // If we can't backup current state, continue anyway
      console.warn('Warning: Could not backup current state before restore');
    }

    try {
      // Remove current plan files (except .backups)
      const entries = await fs.readdir(planDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.backups') {
          continue;
        }

        const entryPath = path.join(planDir, entry.name);
        await fs.rm(entryPath, { recursive: true, force: true });
      }

      // Copy backup contents to plan directory
      const backupEntries = await fs.readdir(backupPath, { withFileTypes: true });
      for (const entry of backupEntries) {
        const sourcePath = path.join(backupPath, entry.name);
        const destPath = path.join(planDir, entry.name);

        if (entry.isDirectory()) {
          await copyDirectory(sourcePath, destPath);
        } else {
          await copyFile(sourcePath, destPath);
        }
      }

      return planDir;
    } catch (error) {
      // If restore failed and we have a current backup, try to restore it
      if (currentBackup) {
        try {
          await restoreFromBackup(currentBackup);
        } catch (rollbackError) {
          throw new Error(`Failed to restore and rollback failed: ${error.message} (Rollback: ${rollbackError.message})`);
        }
      }

      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to restore from backup: ${error.message}`);
  }
}

/**
 * Cleans up old backups, keeping only the specified number of most recent backups
 * @param {string} backupDir - Path to the .backups directory
 * @param {number} keepCount - Number of backups to keep
 * @returns {Promise<void>}
 */
async function cleanupOldBackups(backupDir, keepCount = 5) {
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });

    // Filter for backup directories and get their stats
    const backups = [];
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('backup-')) {
        const backupPath = path.join(backupDir, entry.name);
        const stats = await fs.stat(backupPath);
        backups.push({
          name: entry.name,
          path: backupPath,
          mtime: stats.mtime
        });
      }
    }

    // Sort by modification time (newest first)
    backups.sort((a, b) => b.mtime - a.mtime);

    // Remove old backups beyond keepCount
    const toRemove = backups.slice(keepCount);
    for (const backup of toRemove) {
      await fs.rm(backup.path, { recursive: true, force: true });
    }
  } catch (error) {
    // Don't throw on cleanup errors, just log
    console.warn(`Warning: Failed to cleanup old backups: ${error.message}`);
  }
}

module.exports = {
  writeFileAtomic,
  readMultipleFiles,
  writeMultipleFilesAtomic,
  readJsonFile,
  writeJsonFile,
  fileExists,
  copyFile,
  copyDirectory,
  createBackup,
  restoreFromBackup,
  cleanupOldBackups
};
