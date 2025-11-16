/**
 * Netlify Platform Manager
 *
 * Handles Netlify deployments via Netlify CLI (npx)
 * Uses official Netlify CLI for all operations - no custom API implementation needed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const SecretsManager = require('../secrets-manager');

class NetlifyManager {
  constructor(config) {
    this.config = config;
    this.siteId = config.siteId;

    // Hybrid approach: Check env var first, then fall back to SecretsManager
    this.apiToken = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

    if (!this.apiToken) {
      // Try loading from SecretsManager
      try {
        const secretsManager = new SecretsManager();
        const secret = secretsManager.getSecret('NETLIFY_API_TOKEN', false);
        this.apiToken = secret.value;
      } catch (error) {
        // Secret not found in SecretsManager either
        throw new Error(
          'NETLIFY_API_TOKEN not found.\n\n' +
          'Set via environment variable:\n' +
          '  export NETLIFY_API_TOKEN=your_token\n\n' +
          'Or store encrypted via CLI:\n' +
          '  node devops-cli.js secrets set --name NETLIFY_API_TOKEN --value your_token\n\n' +
          'Get your token at: https://app.netlify.com/user/applications'
        );
      }
    }
  }

  /**
   * Execute Netlify CLI command
   * @param {string} command - Netlify CLI command (e.g., 'deploy', 'status')
   * @param {object} options - Command options
   * @returns {object} - Parsed result
   */
  _executeNetlifyCLI(command, options = {}) {
    const args = [command];

    // Add auth token
    args.push('--auth', this.apiToken);

    // Add site ID if available
    if (this.siteId && !options.skipSiteId) {
      args.push('--site', this.siteId);
    }

    // Add JSON output for parsing
    if (!options.skipJson) {
      args.push('--json');
    }

    // Add custom args
    if (options.args) {
      args.push(...options.args);
    }

    try {
      const cmd = `npx netlify-cli ${args.join(' ')}`;

      const output = execSync(cmd, {
        encoding: 'utf8',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, NETLIFY_AUTH_TOKEN: this.apiToken },
        stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe']
      });

      // Parse JSON output if available
      if (!options.skipJson && output.trim()) {
        try {
          return JSON.parse(output);
        } catch (e) {
          // If not JSON, return raw output
          return { output: output.trim() };
        }
      }

      return { output: output.trim() };
    } catch (error) {
      // Parse error output
      const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message;

      throw new Error(`Netlify CLI error: ${errorOutput}`);
    }
  }

  /**
   * Create a new Netlify site
   * @param {string} siteName - Site name
   * @returns {object} - Site details
   */
  async createSite(siteName) {
    try {
      const result = this._executeNetlifyCLI('sites:create', {
        args: ['--name', siteName],
        skipSiteId: true
      });

      return {
        success: true,
        siteId: result.id,
        siteName: result.name,
        url: result.ssl_url || result.url,
        adminUrl: result.admin_url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deploy application to Netlify
   * @param {object} deploymentConfig - Deployment configuration
   * @returns {object} - Deployment result
   */
  async deploy(deploymentConfig) {
    const {
      publishDir = this.config.publishDir || 'dist',
      message = 'Deployed via DevOps plugin',
      prod = true,
      draft = false
    } = deploymentConfig;

    // Verify publish directory exists
    if (!fs.existsSync(publishDir)) {
      return {
        success: false,
        error: `Publish directory not found: ${publishDir}`,
        fixes: [
          'Verify build completed successfully',
          'Check publish directory setting',
          'Common directories: build, dist, public, out, .next'
        ]
      };
    }

    try {
      const args = [
        '--dir', publishDir,
        '--message', message
      ];

      if (prod) {
        args.push('--prod');
      }

      if (draft) {
        args.push('--draft');
      }

      const result = this._executeNetlifyCLI('deploy', { args });

      return {
        success: true,
        platform: 'netlify',
        deploymentId: result.deploy_id,
        status: result.state || 'building',
        url: result.url || result.deploy_ssl_url,
        logs_url: result.logs,
        admin_url: result.admin_url,
        metadata: {
          siteId: this.siteId,
          publishDir,
          message
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fixes: [
          'Check build completed successfully',
          'Verify NETLIFY_API_TOKEN is valid',
          'Ensure site exists or create new one',
          'Check Netlify status: https://www.netlifystatus.com'
        ]
      };
    }
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID (optional)
   * @returns {object} - Deployment status
   */
  async getStatus(deploymentId = null) {
    try {
      // Get site info
      const result = this._executeNetlifyCLI('status');

      // Get deploy list to find specific deployment
      let currentDeploy = null;
      if (deploymentId) {
        const deploys = this._executeNetlifyCLI('api', {
          args: ['listSiteDeploys', `--data`, JSON.stringify({ site_id: this.siteId })]
        });
        currentDeploy = deploys.find(d => d.id === deploymentId);
      }

      return {
        success: true,
        site: {
          id: result.site?.id || this.siteId,
          name: result.site?.name,
          url: result.site?.url,
          admin_url: result.site?.admin_url
        },
        deployment: currentDeploy ? {
          id: currentDeploy.id,
          state: currentDeploy.state,
          created_at: currentDeploy.created_at,
          published_at: currentDeploy.published_at,
          deploy_url: currentDeploy.deploy_ssl_url,
          branch: currentDeploy.branch,
          commit_ref: currentDeploy.commit_ref
        } : null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get application/build logs
   * @param {object} options - Log options
   * @returns {object} - Logs
   */
  async getLogs(options = {}) {
    // Netlify CLI doesn't have a direct logs command for builds
    // We need to fetch via API or show deploy URL
    try {
      // For now, return the deploy list which includes build info
      const result = this._executeNetlifyCLI('api', {
        args: ['listSiteDeploys', '--data', JSON.stringify({ site_id: this.siteId })]
      });

      const deploys = Array.isArray(result) ? result : [];
      const latestDeploy = deploys[0];

      if (!latestDeploy) {
        return {
          success: false,
          error: 'No deployments found'
        };
      }

      return {
        success: true,
        logs: [
          {
            timestamp: latestDeploy.created_at,
            message: `Build ${latestDeploy.state}`,
            level: 'info'
          },
          {
            timestamp: latestDeploy.published_at,
            message: `Published at ${latestDeploy.deploy_ssl_url}`,
            level: 'info'
          }
        ],
        logs_url: `https://app.netlify.com/sites/${this.siteId}/deploys/${latestDeploy.id}`,
        source: 'Netlify Deploy',
        note: 'For detailed build logs, visit the logs URL'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rollback deployment (restore previous deployment)
   * @param {string} targetDeploymentId - Target deployment ID to restore
   * @returns {object} - Rollback result
   */
  async rollback(targetDeploymentId) {
    try {
      // Netlify rollback = restore a previous deploy
      const result = this._executeNetlifyCLI('api', {
        args: [
          'restoreSiteDeploy',
          '--data',
          JSON.stringify({
            site_id: this.siteId,
            deploy_id: targetDeploymentId
          })
        ]
      });

      return {
        success: true,
        message: 'Rollback completed - previous deployment activated',
        deploymentId: result.id,
        url: result.ssl_url || result.url,
        note: 'Netlify rollback is instant (atomic traffic swap)'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fixes: [
          'Verify deployment ID exists',
          'Check site permissions',
          'View deployments: /devops:status'
        ]
      };
    }
  }

  /**
   * Trigger a new build
   * @param {string} branch - Branch to build (optional)
   * @returns {object} - Build result
   */
  async triggerBuild(branch = 'main') {
    try {
      // Trigger a build hook or redeploy
      const result = this._executeNetlifyCLI('api', {
        args: [
          'createSiteBuild',
          '--data',
          JSON.stringify({
            site_id: this.siteId
          })
        ]
      });

      return {
        success: true,
        buildId: result.id,
        status: result.state,
        branch: branch,
        message: 'Build triggered successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List deployments
   * @param {number} limit - Number of deployments to list
   * @returns {object} - List of deployments
   */
  async listDeployments(limit = 10) {
    try {
      const result = this._executeNetlifyCLI('api', {
        args: ['listSiteDeploys', '--data', JSON.stringify({ site_id: this.siteId })]
      });

      const deploys = Array.isArray(result) ? result.slice(0, limit) : [];

      return {
        success: true,
        deployments: deploys.map(deploy => ({
          id: deploy.id,
          state: deploy.state,
          url: deploy.deploy_ssl_url || deploy.url,
          created_at: deploy.created_at,
          published_at: deploy.published_at,
          branch: deploy.branch,
          commit_ref: deploy.commit_ref,
          context: deploy.context
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Netlify CLI is available
   * @returns {boolean}
   */
  static isNetlifyCLIAvailable() {
    try {
      execSync('npx netlify-cli --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = NetlifyManager;
