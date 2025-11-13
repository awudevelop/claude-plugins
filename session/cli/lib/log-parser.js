const fs = require('fs');

/**
 * LogParser - Parses JSONL conversation logs for analysis
 *
 * Converts raw interaction logs into structured data for analysis backends.
 */
class LogParser {
  /**
   * Parse JSONL log file
   * @param {string} logPath - Path to conversation-log.jsonl
   * @returns {object} Parsed log data
   */
  static parse(logPath) {
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      const interactions = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      return {
        success: true,
        interactions: interactions,
        count: interactions.length,
        summary: this.generateSummary(interactions)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        interactions: [],
        count: 0
      };
    }
  }

  /**
   * Generate summary from interactions
   * @param {Array} interactions - Array of interaction objects
   * @returns {object} Summary data
   */
  static generateSummary(interactions) {
    if (interactions.length === 0) {
      return {
        totalInteractions: 0,
        timespan: 0,
        filesModified: 0,
        fileList: [],
        firstInteraction: null,
        lastInteraction: null
      };
    }

    const first = interactions[0];
    const last = interactions[interactions.length - 1];

    // Collect all unique files
    const filesSet = new Set();
    const fileDetails = [];

    interactions.forEach(interaction => {
      if (interaction.modified_files && Array.isArray(interaction.modified_files)) {
        interaction.modified_files.forEach(file => {
          if (file && file.path) {
            filesSet.add(file.path);
            fileDetails.push({
              path: file.path,
              operation: file.operation,
              timestamp: file.timestamp,
              interaction: interaction.num
            });
          }
        });
      }
    });

    // Calculate timespan
    let timespan = 0;
    if (first.timestamp && last.timestamp) {
      const start = new Date(first.timestamp);
      const end = new Date(last.timestamp);
      timespan = end - start;
    }

    return {
      totalInteractions: interactions.length,
      timespan: timespan,
      timespanMinutes: Math.round(timespan / 1000 / 60),
      filesModified: filesSet.size,
      fileList: Array.from(filesSet),
      fileDetails: fileDetails,
      firstInteraction: first.timestamp,
      lastInteraction: last.timestamp,
      avgInteractionInterval: interactions.length > 1 ? timespan / (interactions.length - 1) : 0
    };
  }

  /**
   * Extract file modification patterns
   * @param {Array} interactions - Array of interaction objects
   * @returns {object} File patterns analysis
   */
  static analyzeFilePatterns(interactions) {
    const fileOps = {};
    const filesByExt = {};
    const directoriesAffected = new Set();

    interactions.forEach(interaction => {
      if (interaction.modified_files && Array.isArray(interaction.modified_files)) {
        interaction.modified_files.forEach(file => {
          if (!file || !file.path) return;

          // Track operations per file
          if (!fileOps[file.path]) {
            fileOps[file.path] = { edit: 0, write: 0, total: 0 };
          }
          if (file.operation === 'edit') {
            fileOps[file.path].edit++;
          } else if (file.operation === 'write') {
            fileOps[file.path].write++;
          }
          fileOps[file.path].total++;

          // Track by extension
          const ext = file.path.split('.').pop() || 'no-ext';
          filesByExt[ext] = (filesByExt[ext] || 0) + 1;

          // Track directories
          const dir = file.path.substring(0, file.path.lastIndexOf('/'));
          if (dir) {
            directoriesAffected.add(dir);
          }
        });
      }
    });

    // Find most edited file
    let mostEditedFile = null;
    let maxEdits = 0;
    Object.entries(fileOps).forEach(([path, ops]) => {
      if (ops.total > maxEdits) {
        maxEdits = ops.total;
        mostEditedFile = { path, ...ops };
      }
    });

    // Find primary file type
    let primaryFileType = null;
    let maxCount = 0;
    Object.entries(filesByExt).forEach(([ext, count]) => {
      if (count > maxCount) {
        maxCount = count;
        primaryFileType = ext;
      }
    });

    return {
      fileOperations: fileOps,
      filesByExtension: filesByExt,
      directoriesAffected: Array.from(directoriesAffected),
      mostEditedFile: mostEditedFile,
      primaryFileType: primaryFileType,
      directoryCount: directoriesAffected.size
    };
  }

  /**
   * Detect workflow patterns
   * @param {Array} interactions - Array of interaction objects
   * @returns {string} Detected workflow type
   */
  static detectWorkflowPattern(interactions) {
    const patterns = this.analyzeFilePatterns(interactions);

    // Check for test files
    const hasTests = patterns.fileOperations &&
      Object.keys(patterns.fileOperations).some(path =>
        path.includes('test') || path.includes('spec')
      );

    // Check for documentation
    const hasDocs = patterns.filesByExtension &&
      (patterns.filesByExtension['md'] > 0 || patterns.filesByExtension['txt'] > 0);

    // Check for config files
    const hasConfig = patterns.filesByExtension &&
      (patterns.filesByExtension['json'] > 0 ||
       patterns.filesByExtension['yml'] > 0 ||
       patterns.filesByExtension['yaml'] > 0);

    // Determine workflow
    if (hasTests && hasDocs) {
      return 'Test-Driven Development with Documentation';
    } else if (hasTests) {
      return 'Test-Driven Development';
    } else if (hasDocs && !hasConfig) {
      return 'Documentation Updates';
    } else if (hasConfig) {
      return 'Configuration and Setup';
    } else if (patterns.directoryCount === 1) {
      return 'Focused Feature Development';
    } else if (patterns.directoryCount > 3) {
      return 'Cross-Cutting Refactoring';
    } else {
      return 'General Development';
    }
  }

  /**
   * Calculate development velocity
   * @param {object} summary - Summary from generateSummary()
   * @returns {string} Velocity description
   */
  static calculateVelocity(summary) {
    if (summary.totalInteractions === 0) {
      return 'No activity';
    }

    const avgInterval = summary.avgInteractionInterval / 1000; // Convert to seconds

    if (avgInterval < 60) {
      return 'High intensity (rapid iteration)';
    } else if (avgInterval < 300) {
      return 'Moderate pace';
    } else {
      return 'Exploratory/planning phase';
    }
  }
}

module.exports = LogParser;
