const GitHelper = require('../git-helper');

async function checkGit(args) {
  const gitHelper = new GitHelper();

  try {
    const status = gitHelper.getStatus();
    const currentBranch = gitHelper.getCurrentBranch();
    const isClean = gitHelper.isCleanWorkingDirectory();

    return {
      success: true,
      git: {
        currentBranch: currentBranch,
        isClean: isClean,
        uncommittedFiles: status.length,
        files: status
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      git: null
    };
  }
}

module.exports = checkGit;
