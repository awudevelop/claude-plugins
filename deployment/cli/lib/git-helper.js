const { execSync } = require('child_process');

class GitHelper {
  constructor() {
    this.encoding = 'utf8';
  }

  exec(command) {
    try {
      return execSync(command, {
        encoding: this.encoding,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  getStatus() {
    try {
      const output = this.exec('git status --porcelain');
      if (!output) {
        return [];
      }

      return output.split('\n').map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return { status, file };
      });
    } catch (error) {
      return [];
    }
  }

  hasUncommittedChanges() {
    const status = this.getStatus();
    return status.length > 0;
  }

  getCurrentBranch() {
    try {
      return this.exec('git rev-parse --abbrev-ref HEAD');
    } catch (error) {
      throw new Error('Not in a git repository');
    }
  }

  branchExists(branchName) {
    try {
      this.exec(`git rev-parse --verify ${branchName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  isCleanWorkingDirectory() {
    try {
      const output = this.exec('git status --porcelain');
      return output === '';
    } catch (error) {
      return false;
    }
  }

  getUncommittedCount() {
    const status = this.getStatus();
    return status.length;
  }
}

module.exports = GitHelper;
