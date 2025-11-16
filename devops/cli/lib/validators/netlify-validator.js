/**
 * Netlify Validator
 * Netlify-specific validation functions using Netlify CLI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Validate Netlify API token using Netlify CLI
 * @param {string} token - Netlify API token
 * @returns {Promise<{valid: boolean, user?: string, email?: string, error?: string}>}
 */
async function validateToken(token) {
  if (!token) {
    return {
      valid: false,
      error: 'No token provided'
    };
  }

  try {
    // Use Netlify CLI to get user info (validates token)
    const output = execSync(`npx netlify-cli api getCurrentUser --auth "${token}" --json`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 15000 // 15 second timeout
    });

    const user = JSON.parse(output);

    return {
      valid: true,
      email: user.email,
      name: user.full_name || user.email,
      id: user.id,
      avatar_url: user.avatar_url
    };
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid')) {
      return {
        valid: false,
        error: 'Invalid Netlify API token',
        message: 'Get a valid token at: https://app.netlify.com/user/applications'
      };
    } else if (error.code === 'ETIMEDOUT') {
      return {
        valid: false,
        error: 'Token validation timed out',
        message: 'Check your internet connection'
      };
    } else {
      return {
        valid: false,
        error: 'Token validation failed',
        message: errorMessage
      };
    }
  }
}

/**
 * Validate project is Netlify-compatible
 * @param {string} projectPath - Path to project directory
 * @returns {{compatible: boolean, type: string, buildCommand: string|null, publishDir: string|null, warnings: string[], errors: string[]}}
 */
function validateProject(projectPath) {
  const checks = {
    compatible: true,
    type: 'unknown',
    buildCommand: null,
    publishDir: null,
    warnings: [],
    errors: []
  };

  // Check for Dockerfile (not supported by Netlify)
  if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
    checks.compatible = false;
    checks.errors.push('Docker-based projects are not supported by Netlify');
    checks.errors.push('Consider using AWS ECS when available');
    return checks;
  }

  // Check for kubernetes config (not supported)
  if (fs.existsSync(path.join(projectPath, 'k8s')) ||
      fs.existsSync(path.join(projectPath, 'kubernetes'))) {
    checks.compatible = false;
    checks.errors.push('Kubernetes deployments are not supported by Netlify');
    checks.errors.push('Consider using GCP/AWS when available');
    return checks;
  }

  // Detect project type from package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Next.js
      if (packageJson.dependencies?.next) {
        checks.type = 'nextjs';
        checks.buildCommand = 'npm run build';
        // Check for static export
        const nextConfigPath = path.join(projectPath, 'next.config.js');
        if (fs.existsSync(nextConfigPath)) {
          const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
          if (nextConfig.includes('output: \'export\'')) {
            checks.publishDir = 'out';
          } else {
            checks.publishDir = '.next';
            checks.warnings.push('Next.js server-side features require Netlify Functions');
          }
        } else {
          checks.publishDir = '.next';
        }
      }
      // Create React App
      else if (packageJson.dependencies?.['react-scripts']) {
        checks.type = 'create-react-app';
        checks.buildCommand = 'npm run build';
        checks.publishDir = 'build';
      }
      // Vue CLI
      else if (packageJson.dependencies?.['@vue/cli-service'] || packageJson.devDependencies?.['@vue/cli-service']) {
        checks.type = 'vue';
        checks.buildCommand = 'npm run build';
        checks.publishDir = 'dist';
      }
      // Gatsby
      else if (packageJson.dependencies?.gatsby) {
        checks.type = 'gatsby';
        checks.buildCommand = 'gatsby build';
        checks.publishDir = 'public';
      }
      // Nuxt
      else if (packageJson.dependencies?.nuxt) {
        checks.type = 'nuxt';
        checks.buildCommand = 'nuxt generate';
        checks.publishDir = 'dist';
      }
      // Svelte
      else if (packageJson.dependencies?.svelte) {
        checks.type = 'svelte';
        checks.buildCommand = 'npm run build';
        checks.publishDir = 'public';
      }
      // Vite
      else if (packageJson.devDependencies?.vite) {
        checks.type = 'vite';
        checks.buildCommand = 'npm run build';
        checks.publishDir = 'dist';
      }
      // Generic Node.js with build script
      else if (packageJson.scripts?.build) {
        checks.type = 'nodejs';
        checks.buildCommand = 'npm run build';
        checks.publishDir = 'dist'; // Guess
        checks.warnings.push('Could not auto-detect publish directory - assuming "dist"');
      }
    } catch (error) {
      checks.warnings.push('Could not parse package.json: ' + error.message);
    }
  }

  // Check for static site (no package.json)
  if (checks.type === 'unknown') {
    if (fs.existsSync(path.join(projectPath, 'index.html'))) {
      checks.type = 'static';
      checks.buildCommand = null; // No build needed
      checks.publishDir = '.'; // Root directory
    }
  }

  // Check for netlify.toml
  if (!fs.existsSync(path.join(projectPath, 'netlify.toml'))) {
    checks.warnings.push('No netlify.toml found - using auto-detected settings');
  }

  // If still unknown
  if (checks.type === 'unknown') {
    checks.warnings.push('Could not auto-detect project type');
    checks.warnings.push('You may need to manually configure build settings');
  }

  return checks;
}

/**
 * Validate site exists on Netlify using Netlify CLI
 * @param {string} siteId - Netlify site ID
 * @param {string} token - Netlify API token
 * @returns {Promise<{valid: boolean, site?: object, error?: string}>}
 */
async function validateSite(siteId, token) {
  if (!siteId) {
    return {
      valid: false,
      error: 'No site ID provided'
    };
  }

  if (!token) {
    return {
      valid: false,
      error: 'No API token provided'
    };
  }

  try {
    const output = execSync(
      `npx netlify-cli api getSite --auth "${token}" --data '{"site_id":"${siteId}"}' --json`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000
      }
    );

    const site = JSON.parse(output);

    return {
      valid: true,
      site: {
        id: site.id,
        name: site.name,
        url: site.url || site.ssl_url,
        customDomain: site.custom_domain,
        createdAt: site.created_at,
        state: site.state
      }
    };
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return {
        valid: false,
        error: 'Site not found',
        message: `Site ID "${siteId}" does not exist or you don't have access to it`
      };
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return {
        valid: false,
        error: 'Invalid API token',
        message: 'Token does not have access to this site'
      };
    } else {
      return {
        valid: false,
        error: 'Could not validate site',
        message: errorMessage
      };
    }
  }
}

/**
 * Check if Netlify CLI is available
 * @returns {boolean}
 */
function isNetlifyCLIAvailable() {
  try {
    execSync('npx netlify-cli --version', { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateToken,
  validateProject,
  validateSite,
  isNetlifyCLIAvailable
};
