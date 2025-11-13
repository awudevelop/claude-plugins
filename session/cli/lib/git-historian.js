const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Git Historian - Captures git history in maximum compression format
 *
 * Captures last 50 commits + uncommitted changes into ultra-compact JSON
 * for minimal token usage while providing full repository context.
 */
class GitHistorian {
  constructor(sessionDir) {
    this.sessionDir = sessionDir;
    this.repoRoot = this.findGitRoot();
  }

  /**
   * Find git repository root
   * @returns {string|null} Path to repo root or null if not a git repo
   */
  findGitRoot() {
    try {
      const root = execSync('git rev-parse --show-toplevel', {
        cwd: this.sessionDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return root;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if current directory is in a git repository
   * @returns {boolean}
   */
  hasGitRepo() {
    return this.repoRoot !== null;
  }

  /**
   * Capture uncommitted changes
   * @returns {object} Uncommitted changes object
   */
  captureUncommitted() {
    if (!this.hasGitRepo()) return null;

    try {
      // Get branch tracking info (ahead/behind)
      let ahead = 0, behind = 0;
      try {
        const tracking = execSync('git rev-list --left-right --count HEAD...@{upstream}', {
          cwd: this.repoRoot,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim().split('\t');
        ahead = parseInt(tracking[0]) || 0;
        behind = parseInt(tracking[1]) || 0;
      } catch (e) {
        // No upstream or not tracking, ignore
      }

      // Get staged files
      const staged = [];
      try {
        const stagedOutput = execSync('git diff --cached --numstat', {
          cwd: this.repoRoot,
          encoding: 'utf8'
        }).trim();
        if (stagedOutput) {
          stagedOutput.split('\n').forEach(line => {
            const parts = line.split('\t');
            if (parts.length === 3) {
              const add = parts[0] === '-' ? '?' : parts[0];
              const del = parts[1] === '-' ? '?' : parts[1];
              staged.push([parts[2], `+${add}/-${del}`]);
            }
          });
        }
      } catch (e) { /* ignore */ }

      // Get modified unstaged files
      const modified = [];
      try {
        const modOutput = execSync('git diff --numstat', {
          cwd: this.repoRoot,
          encoding: 'utf8'
        }).trim();
        if (modOutput) {
          modOutput.split('\n').forEach(line => {
            const parts = line.split('\t');
            if (parts.length === 3) {
              const add = parts[0] === '-' ? '?' : parts[0];
              const del = parts[1] === '-' ? '?' : parts[1];
              modified.push([parts[2], `+${add}/-${del}`]);
            }
          });
        }
      } catch (e) { /* ignore */ }

      // Get untracked files (filter noise)
      const newFiles = [];
      try {
        const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
          cwd: this.repoRoot,
          encoding: 'utf8'
        }).trim();
        if (untrackedOutput) {
          untrackedOutput.split('\n').forEach(file => {
            // Filter out common noise
            if (!file.match(/node_modules|\.log$|\.tmp$|dist\/|build\//)) {
              newFiles.push(file);
            }
          });
        }
      } catch (e) { /* ignore */ }

      // Get deleted files
      const deleted = [];
      try {
        const delOutput = execSync('git ls-files --deleted', {
          cwd: this.repoRoot,
          encoding: 'utf8'
        }).trim();
        if (delOutput) {
          deleted.push(...delOutput.split('\n').filter(f => f));
        }
      } catch (e) { /* ignore */ }

      // Get conflicted files
      const conflicts = [];
      try {
        const conflictOutput = execSync('git diff --name-only --diff-filter=U', {
          cwd: this.repoRoot,
          encoding: 'utf8'
        }).trim();
        if (conflictOutput) {
          conflicts.push(...conflictOutput.split('\n').filter(f => f));
        }
      } catch (e) { /* ignore */ }

      // Calculate total changes
      let totalAdd = 0, totalDel = 0;
      [...staged, ...modified].forEach(([_, changes]) => {
        const match = changes.match(/\+(\d+|\?)\/-(\d+|\?)/);
        if (match && match[1] !== '?' && match[2] !== '?') {
          totalAdd += parseInt(match[1]);
          totalDel += parseInt(match[2]);
        }
      });

      return {
        ah: ahead,
        bh: behind,
        stg: staged,
        mod: modified,
        new: newFiles,
        del: deleted,
        con: conflicts,
        tot: `+${totalAdd}/-${totalDel}`
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Capture commit history
   * @param {number} count - Number of commits to capture (default 50)
   * @returns {array} Array of commit arrays
   */
  captureCommits(count = 50) {
    if (!this.hasGitRepo()) return [];

    try {
      // Get commits with file stats
      const logOutput = execSync(`git log -${count} --pretty=format:'%h|%ad|%s' --date=short --numstat --no-merges`, {
        cwd: this.repoRoot,
        encoding: 'utf8'
      }).trim();

      const commits = [];
      let currentCommit = null;
      let files = [];
      let totalAdd = 0, totalDel = 0;

      logOutput.split('\n').forEach(line => {
        if (line.includes('|')) {
          // Commit line
          if (currentCommit) {
            commits.push([
              currentCommit.hash,
              currentCommit.date.substring(5), // MM-DD only
              currentCommit.message,
              `+${totalAdd}/-${totalDel}`,
              files.length,
              files
            ]);
          }

          const parts = line.split('|');
          currentCommit = {
            hash: parts[0],
            date: parts[1],
            message: parts[2]
          };
          files = [];
          totalAdd = 0;
          totalDel = 0;
        } else if (line.trim() && currentCommit) {
          // File stat line
          const parts = line.trim().split('\t');
          if (parts.length === 3) {
            const add = parts[0] === '-' ? 0 : parseInt(parts[0]);
            const del = parts[1] === '-' ? 0 : parseInt(parts[1]);
            totalAdd += add;
            totalDel += del;
            files.push(parts[2]);
          }
        }
      });

      // Push last commit
      if (currentCommit) {
        commits.push([
          currentCommit.hash,
          currentCommit.date.substring(5),
          currentCommit.message,
          `+${totalAdd}/-${totalDel}`,
          files.length,
          files
        ]);
      }

      return commits;
    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate hotspots (directories with most commits)
   * @param {array} commits - Commits array
   * @returns {array} Array of [directory, count] sorted by count
   */
  calculateHotspots(commits) {
    const dirCounts = {};

    commits.forEach(commit => {
      const files = commit[5]; // Position 5 is files array
      files.forEach(file => {
        const dir = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : './';
        dirCounts[dir] = (dirCounts[dir] || 0) + 1;
      });
    });

    return Object.entries(dirCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 hotspots
  }

  /**
   * Build complete compressed snapshot
   * @param {string} sessionName - Session name
   * @returns {object} Complete compressed git snapshot
   */
  buildCompressedSnapshot(sessionName) {
    if (!this.hasGitRepo()) return null;

    try {
      // Get current branch and HEAD
      const branch = execSync('git branch --show-current', {
        cwd: this.repoRoot,
        encoding: 'utf8'
      }).trim();

      const head = execSync('git rev-parse --short HEAD', {
        cwd: this.repoRoot,
        encoding: 'utf8'
      }).trim();

      // Capture data
      const commits = this.captureCommits(50);
      const uncommitted = this.captureUncommitted();
      const hotspots = this.calculateHotspots(commits);

      // Calculate summary
      const dateRange = commits.length > 0
        ? `${commits[commits.length - 1][1]}→${commits[0][1].split('-')[1]}`
        : 'N/A';

      const uniqueFiles = new Set();
      let totalAdd = 0, totalDel = 0;
      commits.forEach(commit => {
        commit[5].forEach(f => uniqueFiles.add(f));
        const match = commit[3].match(/\+(\d+)\/-(\d+)/);
        if (match) {
          totalAdd += parseInt(match[1]);
          totalDel += parseInt(match[2]);
        }
      });

      const firstDate = commits.length > 0 ? commits[commits.length - 1][1] : '';
      const lastDate = commits.length > 0 ? commits[0][1] : '';
      const daysDiff = firstDate && lastDate ? this.daysBetween(firstDate, lastDate) : 0;

      return {
        s: sessionName,
        t: new Date().toISOString(),
        b: branch,
        h: head,
        sm: {
          n: commits.length,
          r: dateRange,
          d: daysDiff,
          f: uniqueFiles.size,
          ch: `+${totalAdd}/-${totalDel}`
        },
        uc: uncommitted,
        c: commits,
        hot: hotspots
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate days between two dates
   * @param {string} date1 - MM-DD format
   * @param {string} date2 - MM-DD format
   * @returns {number} Days between
   */
  daysBetween(date1, date2) {
    const year = new Date().getFullYear();
    const d1 = new Date(`${year}-${date1}`);
    const d2 = new Date(`${year}-${date2}`);
    return Math.abs(Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
  }

  /**
   * Write snapshot to file
   * @param {string} sessionName - Session name
   * @returns {boolean} Success
   */
  writeSnapshot(sessionName) {
    try {
      const snapshot = this.buildCompressedSnapshot(sessionName);
      if (!snapshot) return false;

      const outputPath = path.join(this.sessionDir, 'git-history.json');
      fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = GitHistorian;
