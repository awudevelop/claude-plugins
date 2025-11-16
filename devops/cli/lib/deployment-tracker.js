/**
 * Deployment Tracker
 *
 * Tracks deployment history, status, and provides rollback capability
 * Uses ONLY Node.js built-in modules (zero dependencies)
 */

const fs = require('fs');
const path = require('path');

class DeploymentTracker {
  constructor(rootPath = process.cwd()) {
    this.rootPath = rootPath;
    this.deploymentsDir = path.join(rootPath, '.devops', 'deployments');
    this.deploymentsFile = path.join(rootPath, '.devops', 'deployments.json');
    this.currentDeploymentFile = path.join(rootPath, '.devops', 'current-deployment.json');

    this._ensureInitialized();
  }

  /**
   * Ensure directory exists (recursive)
   */
  _ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Read JSON file
   */
  _readJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write JSON file
   */
  _writeJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Ensure directories and files exist
   */
  _ensureInitialized() {
    this._ensureDir(this.deploymentsDir);

    if (!fs.existsSync(this.deploymentsFile)) {
      this._writeJson(this.deploymentsFile, {
        deployments: [],
        lastDeployment: null
      });
    }
  }

  /**
   * Record a new deployment
   */
  recordDeployment(deploymentData) {
    const deployment = {
      id: deploymentData.id || `dep_${Date.now()}`,
      version: deploymentData.version,
      environment: deploymentData.environment || 'production',
      platform: deploymentData.platform,
      status: deploymentData.status || 'deploying',
      timestamp: new Date().toISOString(),
      url: deploymentData.url,
      metadata: deploymentData.metadata || {},
      ...deploymentData
    };

    // Add to history
    const data = this._readJson(this.deploymentsFile);
    data.deployments.push(deployment);
    data.lastDeployment = deployment;
    this._writeJson(this.deploymentsFile, data);

    // Update current deployment
    this._writeJson(this.currentDeploymentFile, deployment);

    // Save detailed deployment info
    const deploymentFilePath = path.join(this.deploymentsDir, `${deployment.id}.json`);
    this._writeJson(deploymentFilePath, deployment);

    return deployment;
  }

  /**
   * Update deployment status
   */
  updateDeploymentStatus(deploymentId, status, metadata = {}) {
    const data = this._readJson(this.deploymentsFile);
    const deployment = data.deployments.find(d => d.id === deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = status;
    deployment.updatedAt = new Date().toISOString();
    deployment.metadata = { ...deployment.metadata, ...metadata };

    // Update in history
    this._writeJson(this.deploymentsFile, data);

    // Update detailed file
    const deploymentFilePath = path.join(this.deploymentsDir, `${deploymentId}.json`);
    this._writeJson(deploymentFilePath, deployment);

    // Update current if this is the latest
    if (data.lastDeployment?.id === deploymentId) {
      this._writeJson(this.currentDeploymentFile, deployment);
    }

    return deployment;
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId) {
    const deploymentFilePath = path.join(this.deploymentsDir, `${deploymentId}.json`);

    if (!fs.existsSync(deploymentFilePath)) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    return this._readJson(deploymentFilePath);
  }

  /**
   * Get current deployment
   */
  getCurrentDeployment() {
    if (!fs.existsSync(this.currentDeploymentFile)) {
      return null;
    }

    return this._readJson(this.currentDeploymentFile);
  }

  /**
   * List deployments
   */
  listDeployments(options = {}) {
    const data = this._readJson(this.deploymentsFile);
    let deployments = data.deployments;

    // Filter by environment
    if (options.environment) {
      deployments = deployments.filter(d => d.environment === options.environment);
    }

    // Filter by status
    if (options.status) {
      deployments = deployments.filter(d => d.status === options.status);
    }

    // Limit results
    if (options.limit) {
      deployments = deployments.slice(-options.limit);
    }

    return deployments;
  }

  /**
   * Get deployment history for rollback
   */
  getDeploymentHistory(environment = 'production', limit = 10) {
    const deployments = this.listDeployments({
      environment,
      limit
    });

    // Sort by timestamp (newest first)
    return deployments
      .filter(d => d.status === 'success' || d.status === 'healthy')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get rollback target
   */
  getRollbackTarget(environment = 'production') {
    const history = this.getDeploymentHistory(environment, 5);

    if (history.length < 2) {
      throw new Error('No previous deployment available for rollback');
    }

    // Return the second-most recent deployment (skip current)
    return history[1];
  }

  /**
   * Record rollback
   */
  recordRollback(fromDeploymentId, toDeploymentId, reason = '') {
    const rollback = {
      id: `rollback_${Date.now()}`,
      fromDeployment: fromDeploymentId,
      toDeployment: toDeploymentId,
      reason,
      timestamp: new Date().toISOString(),
      status: 'in_progress'
    };

    const rollbackFile = path.join(
      this.rootPath,
      '.devops',
      'rollback-history.json'
    );

    let rollbacks = [];
    if (fs.existsSync(rollbackFile)) {
      rollbacks = this._readJson(rollbackFile);
    }

    rollbacks.push(rollback);
    this._writeJson(rollbackFile, rollbacks);

    return rollback;
  }

  /**
   * Get deployment statistics
   */
  getStatistics(environment = null) {
    const deployments = environment ?
      this.listDeployments({ environment }) :
      this.listDeployments();

    const total = deployments.length;
    const successful = deployments.filter(d => d.status === 'success' || d.status === 'healthy').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    const inProgress = deployments.filter(d => d.status === 'deploying' || d.status === 'in_progress').length;

    const successRate = total > 0 ? (successful / total * 100).toFixed(2) : 0;

    return {
      total,
      successful,
      failed,
      inProgress,
      successRate: `${successRate}%`,
      lastDeployment: deployments[deployments.length - 1] || null
    };
  }
}

module.exports = DeploymentTracker;
