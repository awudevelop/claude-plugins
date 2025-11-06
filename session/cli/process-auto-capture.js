#!/usr/bin/env node
// Process Auto-Capture: Updates session.md with captured file changes
// Called when snapshot markers are created

const fs = require('fs');
const path = require('path');

/**
 * Process auto-captured files and update session.md
 * @param {string} sessionName - Name of the session
 * @returns {object} Result with success status and stats
 */
function processAutoCapture(sessionName) {
  const sessionsDir = '.claude/sessions';
  const sessionDir = path.join(sessionsDir, sessionName);

  // Check session exists
  if (!fs.existsSync(sessionDir)) {
    return {
      success: false,
      error: 'Session directory not found'
    };
  }

  const stateFile = path.join(sessionDir, '.auto-capture-state');
  const sessionMdFile = path.join(sessionDir, 'session.md');

  // Check if there's any captured state
  if (!fs.existsSync(stateFile)) {
    return {
      success: true,
      filesAdded: 0,
      message: 'No capture state file found'
    };
  }

  // Read captured state
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (err) {
    return {
      success: false,
      error: 'Failed to parse capture state'
    };
  }

  // Check if there are any files to process
  if (!state.modified_files || state.modified_files.length === 0) {
    return {
      success: true,
      filesAdded: 0,
      message: 'No modified files to process'
    };
  }

  // Read session.md
  if (!fs.existsSync(sessionMdFile)) {
    return {
      success: false,
      error: 'session.md not found'
    };
  }

  let sessionContent = fs.readFileSync(sessionMdFile, 'utf8');

  // Find or create "Files Involved" section
  const filesInvolvedRegex = /## Files Involved\s*\n([\s\S]*?)(?=\n##|$)/;
  const match = sessionContent.match(filesInvolvedRegex);

  let existingFiles = [];
  if (match) {
    // Parse existing files
    const filesList = match[1].trim();
    existingFiles = filesList
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => {
        const pathMatch = line.match(/`([^`]+)`/);
        return pathMatch ? pathMatch[1] : null;
      })
      .filter(Boolean);
  }

  // Add new files (avoid duplicates)
  let newFilesAdded = 0;
  const filesToAdd = [];

  for (const fileEntry of state.modified_files) {
    const relativePath = fileEntry.path.startsWith(process.cwd())
      ? path.relative(process.cwd(), fileEntry.path)
      : fileEntry.path;

    if (!existingFiles.includes(relativePath) && !existingFiles.includes(fileEntry.path)) {
      filesToAdd.push(relativePath);
      newFilesAdded++;
    }
  }

  // If no new files, nothing to do
  if (newFilesAdded === 0) {
    return {
      success: true,
      filesAdded: 0,
      message: 'All files already tracked in session.md'
    };
  }

  // Build updated Files Involved section
  let updatedFilesList = '';

  // Add existing files
  if (match) {
    const existingFileLines = match[1].trim().split('\n').filter(line => line.trim());
    updatedFilesList = existingFileLines.join('\n') + '\n';
  }

  // Add new files
  for (const filePath of filesToAdd) {
    updatedFilesList += `- \`${filePath}\`\n`;
  }

  // Update session.md
  if (match) {
    // Replace existing section
    const newSection = `## Files Involved\n${updatedFilesList}`;
    sessionContent = sessionContent.replace(filesInvolvedRegex, newSection);
  } else {
    // Add new section after Key Milestones
    const milestonesRegex = /(## Key Milestones[\s\S]*?)(\n##|$)/;
    const milestonesMatch = sessionContent.match(milestonesRegex);

    if (milestonesMatch) {
      const newSection = `\n\n## Files Involved\n${updatedFilesList}`;
      sessionContent = sessionContent.replace(
        milestonesRegex,
        milestonesMatch[1] + newSection + milestonesMatch[2]
      );
    } else {
      // Append at the end
      sessionContent += `\n\n## Files Involved\n${updatedFilesList}`;
    }
  }

  // Write updated session.md
  try {
    fs.writeFileSync(sessionMdFile, sessionContent, 'utf8');
  } catch (err) {
    return {
      success: false,
      error: 'Failed to write session.md'
    };
  }

  // Clear processed files from state (keep count for thresholds)
  state.modified_files = [];
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  return {
    success: true,
    filesAdded: newFilesAdded,
    message: `Added ${newFilesAdded} file(s) to session.md`
  };
}

// CLI execution
if (require.main === module) {
  const sessionName = process.argv[2];

  if (!sessionName) {
    console.error(JSON.stringify({
      success: false,
      error: 'Session name required'
    }, null, 2));
    process.exit(1);
  }

  const result = processAutoCapture(sessionName);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

module.exports = { processAutoCapture };
