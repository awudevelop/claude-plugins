const { describe, it } = require('node:test');
const assert = require('node:assert');
const GitHelper = require('../lib/git-helper');

describe('GitHelper', () => {
  const gitHelper = new GitHelper();

  it('should get current branch', () => {
    const branch = gitHelper.getCurrentBranch();
    assert.ok(branch.length > 0, 'Branch name should not be empty');
    assert.strictEqual(typeof branch, 'string');
  });

  it('should check if working directory is clean or not', () => {
    const isClean = gitHelper.isCleanWorkingDirectory();
    assert.strictEqual(typeof isClean, 'boolean');
  });

  it('should get git status', () => {
    const status = gitHelper.getStatus();
    assert.ok(Array.isArray(status), 'Status should be an array');
  });

  it('should check for uncommitted changes', () => {
    const hasChanges = gitHelper.hasUncommittedChanges();
    assert.strictEqual(typeof hasChanges, 'boolean');
  });

  it('should count uncommitted files', () => {
    const count = gitHelper.getUncommittedCount();
    assert.strictEqual(typeof count, 'number');
    assert.ok(count >= 0, 'Count should be non-negative');
  });

  it('should check if branch exists', () => {
    const currentBranch = gitHelper.getCurrentBranch();
    assert.strictEqual(gitHelper.branchExists(currentBranch), true);
    assert.strictEqual(gitHelper.branchExists('nonexistent-branch-xyz'), false);
  });

  it('should parse git status correctly', () => {
    const status = gitHelper.getStatus();
    status.forEach(item => {
      assert.ok(item.status, 'Each item should have status');
      assert.ok(item.file, 'Each item should have file');
    });
  });
});
