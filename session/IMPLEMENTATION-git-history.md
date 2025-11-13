# Implementation Plan: Git History Capture (Maximum Compression)

**Date**: 2025-11-13
**Status**: Ready to Implement
**Priority**: Medium (Enhancement to v3.5.1)
**Estimated Time**: 3-3.5 hours

---

## Problem Statement

Session consolidation provides conversation context but lacks repository context. Claude needs to understand:
- What code changes were made recently
- Current git status (uncommitted work, branch state)
- Areas of active development (hotspots)
- Commit patterns and project evolution

## Solution: Automatic Git History Capture

Capture git history during session consolidation (inline analysis phase) in maximum compression JSON format.

**Key Benefits**:
- 70-75% token savings vs markdown (2-3KB vs 8-10KB)
- Full git context available to Claude
- Automatic capture at session boundaries
- Minimal performance impact (~60-90ms)
- Human-debuggable with optional decompression command

---

## Maximum Compression JSON Format

### Complete Structure

```json
{
  "s": "test-plugin",
  "t": "2025-11-13T15:30Z",
  "b": "feat/git-history",
  "h": "2fa67ed",
  "sm": {
    "n": 50,
    "r": "11-04→13",
    "d": 9,
    "f": 127,
    "ch": "+5234/-2891"
  },
  "uc": {
    "ah": 2,
    "bh": 0,
    "stg": [
      ["marketplace.json", "+2/-1"],
      ["cli/lib/git-historian.js", "+250/-0"],
      ["commands/start.md", "+15/-3"]
    ],
    "mod": [
      ["README.md", "+5/-2"],
      ["hooks/user-prompt-submit.js", "+3/-1"]
    ],
    "new": ["test/git-historian.test.js", "IMPLEMENTATION-v3.5.2.md"],
    "del": [],
    "con": [],
    "tot": "+275/-7"
  },
  "c": [
    ["2fa67ed", "11-13", "feat: AI auto-snapshots (v3.4.0)", "+464/-124", 6, ["marketplace.json", "CHANGELOG.md", "README.md", "commands/auto-snapshot.md", "commands/continue.md", "commands/start.md"]],
    ["b6181df", "11-13", "docs: Update threshold", "+14/-14", 4, ["marketplace.json", "CHANGELOG.md", "README.md", "commands/auto-snapshot.md"]],
    ["9cc5306", "11-13", "feat: Direct snapshot", "+55/-31", 1, ["commands/auto-snapshot.md"]],
    ["e6525c0", "11-12", "feat: Auto session autosave", "+234/-67", 8, ["hooks/user-prompt-submit.js", "commands/start.md", "cli/lib/conversation-logger.js"]]
  ],
  "hot": [
    ["session/", 40],
    [".claude-plugin/", 8],
    ["session/cli/", 15],
    ["session/commands/", 12]
  ]
}
```

### Field Definitions

**Top Level:**
- `s`: session name (string)
- `t`: timestamp (ISO 8601)
- `b`: current branch name (string)
- `h`: HEAD commit hash (short, 7 chars)

**Summary (`sm`):**
- `n`: number of commits captured (int)
- `r`: date range (string, format: "MM-DD→DD")
- `d`: days span (int)
- `f`: total unique files modified (int)
- `ch`: total changes across all commits (string, format: "+NNNN/-NNNN")

**Uncommitted Changes (`uc`):**
- `ah`: commits ahead of upstream (int)
- `bh`: commits behind upstream (int)
- `stg`: staged files (array of [path, changes])
- `mod`: modified unstaged files (array of [path, changes])
- `new`: new untracked files (array of paths)
- `del`: deleted files (array of paths)
- `con`: conflicted files (array of paths)
- `tot`: total uncommitted changes (string, format: "+NNN/-NN")

**Commits (`c`):**
Array of arrays, each commit: `[hash, date, message, changes, fileCount, files[]]`
- Position 0: commit hash (7 chars)
- Position 1: date (MM-DD format)
- Position 2: commit message (string)
- Position 3: changes (string, "+NNN/-NN")
- Position 4: file count (int)
- Position 5: file paths array (strings)

**Hotspots (`hot`):**
Array of arrays: `[directory, commitCount]`
- Sorted by commit count descending
- Shows areas of active development

### Token Efficiency

**For 50 commits:**
- Markdown format: ~6,500-9,500 tokens
- Standard JSON: ~4,500-6,000 tokens
- **Maximum compression: ~2,000-2,500 tokens** ✅
- **Savings: 70-75%**

**File size: 2-3KB**

---

## Implementation Steps

### Phase 1: Create Git Historian Utility (~1.5 hours)

**File**: `session/cli/lib/git-historian.js` (new, ~300 lines)

#### Class Structure

```javascript
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
```

### Phase 2: Add CLI Command (~15 min)

**File**: `session/cli/session-cli.js`

Add to the switch statement:

```javascript
case 'capture-git':
  const GitHistorian = require('./lib/git-historian');
  const sessionDir = path.join(process.cwd(), '.claude', 'sessions', sessionName);

  const gh = new GitHistorian(sessionDir);

  if (!gh.hasGitRepo()) {
    console.log(JSON.stringify({
      success: false,
      reason: 'no-git',
      message: 'Not a git repository'
    }));
    process.exit(0);
  }

  const success = gh.writeSnapshot(sessionName);
  const outputPath = path.join(sessionDir, 'git-history.json');

  console.log(JSON.stringify({
    success,
    path: outputPath,
    size: success ? fs.statSync(outputPath).size : 0,
    message: success ? 'Git history captured' : 'Failed to capture git history'
  }));
  break;
```

### Phase 3: Integrate into start.md (~20 min)

**File**: `session/commands/start.md`

**Location**: After line 157 (in the "Check for Unconsolidated Logs" section)

Add this step BEFORE Claude analysis begins:

```markdown
### Step 3a: Capture Git History (if available)

Before analyzing conversation, capture git context for enhanced decision-making:

1. Check if git repository exists and capture history:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{name}"
   ```

2. This creates: `.claude/sessions/{name}/git-history.json`

3. Contents (compressed JSON, ~2-3KB):
   - Last 50 commits with metadata
   - Uncommitted changes (staged/unstaged/new)
   - Branch status (ahead/behind tracking)
   - Development hotspots (active directories)

4. Performance: ~60-90ms (acceptable at session boundary)

5. If no git repo, command returns success: false, continue without git context (no error)

6. Continue with Claude inline analysis...
```

### Phase 4: Integrate into continue.md (~20 min)

**File**: `session/commands/continue.md`

**Location**: After line 117 (in the "Check for Unconsolidated Logs" section)

Add the exact same step as in start.md (Step 3a).

### Phase 5: Optional Decompression Command (~30 min)

**File**: `session/commands/git-decompress.md` (new command)

```markdown
You are managing a session memory system. The user wants to decompress git history.

## Task: Decompress Git History

Parse the session name from the command arguments. The command format is: `/session:git-decompress [name]`

### Step 1: Read Compressed File

1. Read `.claude/sessions/{name}/git-history.json`
2. Parse JSON into object

### Step 2: Expand into Human-Readable Format

Create expanded markdown showing:

```markdown
# Git History: {session_name}
**Captured**: {timestamp}
**Branch**: {branch}
**HEAD**: {hash}

## Summary
- Commits analyzed: {n}
- Date range: {r}
- Days: {d}
- Total files: {f}
- Total changes: {ch}

## Uncommitted Changes
### Ahead/Behind
- Ahead of upstream: {ah} commits
- Behind upstream: {bh} commits

### Staged for Commit
- {file}: {changes}
- ...

### Modified (Unstaged)
- {file}: {changes}
- ...

### New Files (Untracked)
- {file}
- ...

### Total Uncommitted: {tot}

## Recent Commits

### {hash} - {date}
**Message**: {message}
**Changes**: {changes}
**Files** ({fileCount}):
- {file1}
- {file2}
- ...

## Development Hotspots
- {directory}: {count} commits
- ...
```

### Step 3: Display to User

Show the expanded markdown to the user for easy reading.
```

This command is optional and only needed for debugging or human inspection.

---

## Integration Points Summary

### Execution Flow

```
Session Start/Continue
├─ 1. Validate session
├─ 2. Read session files
├─ 3. Check for conversation log
│   ├─ 3a. [NEW] Capture git history (60-90ms)
│   ├─ 3b. Read conversation log
│   ├─ 3c. Parse interactions
│   ├─ 3d. Analyze with Claude inline (1-3s)
│   ├─ 3e. Create consolidated snapshot
│   └─ 3f. Delete conversation log
├─ 4. Activate session
└─ 5. Display session summary
```

**Git capture happens BEFORE Claude analysis so git context is available for analysis.**

---

## Testing Checklist

### Functional Tests

- [ ] **Test 1: Normal git repo**
  - Start/continue session in project with git
  - Verify git-history.json created
  - Verify file size ~2-3KB
  - Verify all fields populated correctly

- [ ] **Test 2: No git repo**
  - Start/continue session in non-git directory
  - Verify command returns success: false
  - Verify no error thrown (silent skip)
  - Verify session continues normally

- [ ] **Test 3: Large repo**
  - Test with repo having 1000+ commits
  - Verify only 50 commits captured
  - Verify performance under 90ms

- [ ] **Test 4: Uncommitted changes**
  - Create staged files
  - Create unstaged modifications
  - Create untracked files
  - Verify all captured in `uc` section

- [ ] **Test 5: Branch tracking**
  - Create branch ahead of origin
  - Create branch behind origin
  - Verify `ah` and `bh` values correct

- [ ] **Test 6: Merge conflicts**
  - Create merge conflict
  - Verify conflicts appear in `con` array

- [ ] **Test 7: Hotspots calculation**
  - Verify hotspots show most active directories
  - Verify sorted by commit count

### Performance Tests

- [ ] **Performance: 50 commits in <90ms**
  - Measure actual execution time
  - Target: 60-90ms total

- [ ] **File size: 2-3KB for 50 commits**
  - Verify compressed format is efficient
  - Compare to markdown (should be 70-75% smaller)

### Claude Integration Tests

- [ ] **Claude can read compressed format**
  - Ask Claude to summarize git history
  - Ask Claude about recent commits
  - Ask Claude about uncommitted work
  - Verify accurate responses

- [ ] **Decompression command works**
  - Run `/session:git-decompress {name}`
  - Verify human-readable output
  - Verify all data preserved

---

## Performance Target

**Total overhead: 60-90ms**
- Git commands: 50-70ms
- JSON building: 5-10ms
- File write: 5-10ms

**Within 1-3s consolidation budget** (3-5% overhead)

---

## Token Efficiency

**Example file (50 commits):**
- Size on disk: 2-3KB
- Token count: ~2,000-2,500 tokens
- Markdown equivalent: ~8,000-10,000 tokens
- **Savings: 70-75%** ✅

---

## File Locations

```
.claude/sessions/{name}/
├── session.md
├── context.md
├── git-history.json          ← NEW: Compressed git context
├── conversation-log.jsonl    (temp, deleted after consolidation)
├── auto_*.md                 (snapshots)
└── manual_*.md               (snapshots)
```

---

## Example Output

**File**: `.claude/sessions/test-plugin/git-history.json`

```json
{
  "s": "test-plugin",
  "t": "2025-11-13T15:30:00.000Z",
  "b": "feat/git-history",
  "h": "2fa67ed",
  "sm": {
    "n": 50,
    "r": "11-04→13",
    "d": 9,
    "f": 127,
    "ch": "+5234/-2891"
  },
  "uc": {
    "ah": 2,
    "bh": 0,
    "stg": [["marketplace.json", "+2/-1"]],
    "mod": [["README.md", "+5/-2"]],
    "new": ["test.js"],
    "del": [],
    "con": [],
    "tot": "+7/-3"
  },
  "c": [
    ["2fa67ed", "11-13", "feat: AI auto-snapshots", "+464/-124", 6, ["marketplace.json", "CHANGELOG.md", "README.md", "commands/auto-snapshot.md", "commands/continue.md", "commands/start.md"]],
    ["b6181df", "11-13", "docs: Update threshold", "+14/-14", 4, ["marketplace.json", "CHANGELOG.md", "README.md", "commands/auto-snapshot.md"]]
  ],
  "hot": [["session/", 40], [".claude-plugin/", 8]]
}
```

---

## Implementation Estimate

- **Phase 1** (git-historian.js): 1.5 hours
- **Phase 2** (CLI command): 15 minutes
- **Phase 3** (start.md integration): 20 minutes
- **Phase 4** (continue.md integration): 20 minutes
- **Phase 5** (decompression command): 30 minutes (optional)
- **Phase 6** (testing): 30 minutes

**Total: 3-3.5 hours**

---

## Next Steps

1. Continue session or start new one
2. Implement git-historian.js following the structure above
3. Add CLI command to session-cli.js
4. Update start.md and continue.md with git capture step
5. Test thoroughly with all test cases
6. Optionally add decompression command
7. Commit as enhancement to v3.5.1

---

## Questions for Implementation

1. Should we capture more than 50 commits? (configurable?)
2. Should we filter certain file types from history? (e.g., package-lock.json)
3. Should we add git statistics to session summary display?
4. Should we create a command to manually refresh git history?

---

## Success Criteria

✅ Git history captured automatically at session boundaries
✅ Compressed JSON format uses 70-75% fewer tokens
✅ Performance overhead under 90ms
✅ Claude can read and use git context effectively
✅ Silent skip when no git repo (no errors)
✅ File size ~2-3KB for 50 commits
✅ Human-debuggable with decompression command
