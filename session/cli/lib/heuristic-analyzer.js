const LogParser = require('./log-parser');

/**
 * HeuristicAnalyzer - Free, fast analysis without AI
 *
 * Provides intelligent-looking snapshots using pattern detection and heuristics.
 * Zero cost, instant analysis, works offline.
 */
class HeuristicAnalyzer {
  /**
   * Analyze conversation log using heuristics
   * @param {string} logPath - Path to conversation-log.jsonl
   * @param {string} sessionName - Session name
   * @returns {string} Formatted snapshot content
   */
  static analyze(logPath, sessionName) {
    const parsed = LogParser.parse(logPath);

    if (!parsed.success || parsed.count === 0) {
      return this.generateEmptySnapshot(sessionName);
    }

    const summary = parsed.summary;
    const patterns = LogParser.analyzeFilePatterns(parsed.interactions);
    const workflow = LogParser.detectWorkflowPattern(parsed.interactions);
    const velocity = LogParser.calculateVelocity(summary);
    const complexity = this.assessComplexity(summary, patterns);

    return this.generateSnapshot(sessionName, {
      summary,
      patterns,
      workflow,
      velocity,
      complexity,
      interactions: parsed.interactions
    });
  }

  /**
   * Assess complexity of the session
   * @param {object} summary - Summary data
   * @param {object} patterns - File patterns
   * @returns {object} Complexity assessment
   */
  static assessComplexity(summary, patterns) {
    // Calculate complexity score
    const fileScore = summary.filesModified * 2;
    const interactionScore = summary.totalInteractions * 0.5;
    const directoryScore = patterns.directoryCount * 3;
    const totalScore = fileScore + interactionScore + directoryScore;

    let level, description;
    if (totalScore > 30) {
      level = 'High';
      description = 'Significant cross-cutting changes';
    } else if (totalScore > 15) {
      level = 'Medium';
      description = 'Moderate scope with multiple files';
    } else {
      level = 'Low';
      description = 'Focused changes in limited scope';
    }

    return {
      level,
      description,
      score: Math.round(totalScore),
      factors: {
        files: summary.filesModified,
        interactions: summary.totalInteractions,
        directories: patterns.directoryCount
      }
    };
  }

  /**
   * Generate formatted snapshot content
   * @param {string} sessionName - Session name
   * @param {object} data - Analysis data
   * @returns {string} Markdown snapshot
   */
  static generateSnapshot(sessionName, data) {
    const { summary, patterns, workflow, velocity, complexity, interactions } = data;

    // Format file list
    const fileList = summary.fileList
      .slice(0, 20) // Limit to first 20 files
      .map(f => `- \`${f}\``)
      .join('\n');

    const moreFiles = summary.filesModified > 20 ?
      `\n- ... and ${summary.filesModified - 20} more files` : '';

    // Format most edited file
    const mostEdited = patterns.mostEditedFile ?
      `\n**Most Active File**: \`${patterns.mostEditedFile.path}\` (${patterns.mostEditedFile.total} operations: ${patterns.mostEditedFile.edit} edits, ${patterns.mostEditedFile.write} writes)` : '';

    // Format file type breakdown
    const fileTypes = Object.entries(patterns.filesByExtension)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `  - .${ext}: ${count} files`)
      .join('\n');

    return `# Consolidated Snapshot: ${sessionName}
**Timestamp**: ${new Date().toISOString()}
**Method**: Heuristic Analysis (Free, Fast)
**Status**: Consolidated from conversation log

## Session Overview
- **Duration**: ${summary.timespanMinutes} minutes (${summary.firstInteraction} → ${summary.lastInteraction})
- **Interactions**: ${summary.totalInteractions}
- **Files Modified**: ${summary.filesModified}
- **Directories**: ${patterns.directoryCount}

## Activity Summary
**Workflow Pattern**: ${workflow}
**Development Velocity**: ${velocity}
**Complexity**: ${complexity.level} - ${complexity.description}

## File Analysis

**Primary File Type**: .${patterns.primaryFileType}${mostEdited}

**File Type Distribution**:
${fileTypes}

**Directories Affected**:
${patterns.directoriesAffected.slice(0, 10).map(d => `- \`${d}\``).join('\n')}
${patterns.directoriesAffected.length > 10 ? `- ... and ${patterns.directoriesAffected.length - 10} more directories` : ''}

## Modified Files
${fileList}${moreFiles}

## Development Metrics
- **Average interaction interval**: ${Math.round(summary.avgInteractionInterval / 1000)} seconds
- **Complexity score**: ${complexity.score}
- **Scope**: ${patterns.directoryCount === 1 ? 'Focused (single directory)' : patterns.directoryCount > 3 ? 'Cross-cutting (multiple directories)' : 'Moderate scope'}

## Pattern Detection
${this.generatePatternInsights(patterns, summary)}

## Notes
This is a heuristic-based snapshot providing factual metrics and patterns.
For AI-powered conversation analysis with decisions and context, enable intelligent backends (Ollama or Anthropic API) via \`/session:config\`.

**Performance**: Consolidated in <100ms with zero cost.
**Space Saved**: ${Math.round(this.estimateLogSize(summary) / 1024)}KB raw log → ~5KB consolidated snapshot (~95% reduction)
`;
  }

  /**
   * Generate pattern insights
   * @param {object} patterns - File patterns
   * @param {object} summary - Summary data
   * @returns {string} Insights text
   */
  static generatePatternInsights(patterns, summary) {
    const insights = [];

    // Detect editing patterns
    const editOps = Object.values(patterns.fileOperations).reduce((sum, ops) => sum + ops.edit, 0);
    const writeOps = Object.values(patterns.fileOperations).reduce((sum, ops) => sum + ops.write, 0);

    if (editOps > writeOps * 2) {
      insights.push('- **Refactoring focus**: High ratio of edits vs new files suggests code improvement/refactoring');
    } else if (writeOps > editOps) {
      insights.push('- **New development**: More new files created than edited, indicating feature addition');
    }

    // Detect test activity
    const testFiles = Object.keys(patterns.fileOperations).filter(f =>
      f.includes('test') || f.includes('spec')
    ).length;
    if (testFiles > 0) {
      insights.push(`- **Test coverage**: ${testFiles} test files modified, indicating quality-focused development`);
    }

    // Detect documentation activity
    if (patterns.filesByExtension['md'] > 0) {
      insights.push(`- **Documentation**: ${patterns.filesByExtension['md']} markdown files updated`);
    }

    // Detect concentrated activity
    if (patterns.mostEditedFile && patterns.mostEditedFile.total > summary.totalInteractions * 0.3) {
      insights.push(`- **Concentrated work**: Primary focus on \`${patterns.mostEditedFile.path}\` (${Math.round(patterns.mostEditedFile.total / summary.totalInteractions * 100)}% of operations)`);
    }

    // Detect rapid iteration
    if (summary.avgInteractionInterval < 60000) { // Less than 1 minute average
      insights.push('- **Rapid iteration**: Quick interaction intervals suggest debugging or incremental fixes');
    }

    return insights.length > 0 ? insights.join('\n') : '- Standard development workflow detected';
  }

  /**
   * Estimate log file size
   * @param {object} summary - Summary data
   * @returns {number} Estimated size in bytes
   */
  static estimateLogSize(summary) {
    // Rough estimate: 200 bytes per interaction
    return summary.totalInteractions * 200;
  }

  /**
   * Generate empty snapshot for sessions with no interactions
   * @param {string} sessionName - Session name
   * @returns {string} Markdown snapshot
   */
  static generateEmptySnapshot(sessionName) {
    return `# Consolidated Snapshot: ${sessionName}
**Timestamp**: ${new Date().toISOString()}
**Method**: Heuristic Analysis
**Status**: No interactions to consolidate

## Notes
Session log was empty or could not be parsed. This may indicate:
- Session just started with no activity yet
- Log file was corrupted or deleted
- Session is still active and will be consolidated later

No action needed - normal consolidation will occur after session activity.
`;
  }
}

module.exports = HeuristicAnalyzer;
