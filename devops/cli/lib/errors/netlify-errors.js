/**
 * Netlify Error Messages
 * User-friendly error messages for Netlify-specific errors
 */

/**
 * Error code to user-friendly message mapping
 */
const errorMap = {
  // Authentication errors
  'unauthorized': {
    title: 'Invalid Netlify Token',
    message: 'Your NETLIFY_API_TOKEN is invalid or expired',
    fixes: [
      'Get a new token: https://app.netlify.com/user/applications',
      'Set token: /devops:secrets set',
      'Verify token: /devops:secrets validate'
    ]
  },

  'token_expired': {
    title: 'Token Expired',
    message: 'Your Netlify API token has expired',
    fixes: [
      'Generate new token: https://app.netlify.com/user/applications',
      'Update token: /devops:secrets set'
    ]
  },

  // Build errors
  'build_failed': {
    title: 'Build Failed',
    message: 'Your build script exited with an error',
    fixes: [
      'Check build logs: /devops:logs --build {buildId}',
      'Test build locally: npm run build',
      'Verify all dependencies are in package.json',
      'Check Node.js version compatibility'
    ]
  },

  'build_timeout': {
    title: 'Build Timeout',
    message: 'Build exceeded 15-minute limit',
    fixes: [
      'Optimize build process',
      'Enable dependency caching (automatic in Netlify)',
      'Remove unnecessary build steps',
      'Split large build operations'
    ]
  },

  'dependency_install_failed': {
    title: 'Dependency Installation Failed',
    message: 'npm/yarn install failed during build',
    fixes: [
      'Check package.json for errors',
      'Verify all dependencies are available',
      'Test npm install locally',
      'Commit package-lock.json or yarn.lock'
    ]
  },

  'out_of_memory': {
    title: 'Out of Memory',
    message: 'Build process exceeded memory limit',
    fixes: [
      'Reduce build concurrency',
      'Optimize large dependencies',
      'Split builds into smaller chunks',
      'Contact Netlify support for memory increase'
    ]
  },

  // Deploy errors
  'deploy_failed': {
    title: 'Deployment Failed',
    message: 'Files could not be deployed to Netlify',
    fixes: [
      'Check internet connection',
      'Verify publish directory exists',
      'Ensure files are not too large (>100MB)',
      'Check Netlify status: https://www.netlifystatus.com'
    ]
  },

  'publish_dir_not_found': {
    title: 'Publish Directory Not Found',
    message: 'The specified publish directory does not exist',
    fixes: [
      'Verify build completed successfully',
      'Check publish directory setting in netlify.toml',
      'Common directories: build, dist, public, out, .next'
    ]
  },

  // Site errors
  'site_not_found': {
    title: 'Site Not Found',
    message: 'The specified Netlify site does not exist',
    fixes: [
      'Verify site ID in .devops/config.json',
      'Create new site: /devops:init (reconfigure)',
      'Check site exists: https://app.netlify.com/sites'
    ]
  },

  'site_limit_reached': {
    title: 'Site Limit Reached',
    message: 'You have reached your Netlify site limit',
    fixes: [
      'Delete unused sites from Netlify dashboard',
      'Upgrade Netlify plan',
      'Use existing site instead of creating new one'
    ]
  },

  // Rate limiting
  'rate_limit': {
    title: 'API Rate Limit Exceeded',
    message: 'Too many API requests to Netlify',
    fixes: [
      'Wait 1-2 minutes and try again',
      'Reduce deployment frequency',
      'Contact Netlify support for limit increase'
    ]
  },

  // Network errors
  'network_error': {
    title: 'Network Error',
    message: 'Could not connect to Netlify API',
    fixes: [
      'Check your internet connection',
      'Verify firewall settings',
      'Check Netlify status: https://www.netlifystatus.com',
      'Try again in a few moments'
    ]
  },

  // Generic error
  'unknown_error': {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred',
    fixes: [
      'Check logs: /devops:logs',
      'Verify configuration: /devops:config',
      'Try again',
      'Contact support if issue persists'
    ]
  }
};

/**
 * Format error message for display
 * @param {string} errorCode - Error code from errorMap
 * @param {object} context - Additional context (buildId, deployUrl, etc.)
 * @returns {string} - Formatted error message
 */
function formatError(errorCode, context = {}) {
  const error = errorMap[errorCode] || errorMap['unknown_error'];

  let output = `\n❌ ${error.title}\n\n`;
  output += `${error.message}\n\n`;

  output += `💡 How to fix:\n`;
  error.fixes.forEach((fix, i) => {
    // Replace placeholders
    let fixText = fix;
    if (context.buildId) {
      fixText = fixText.replace('{buildId}', context.buildId);
    }
    if (context.deployId) {
      fixText = fixText.replace('{deployId}', context.deployId);
    }
    output += `  ${i + 1}. ${fixText}\n`;
  });

  if (context.buildId) {
    output += `\n📝 Build log: /devops:logs --build ${context.buildId}`;
  }

  if (context.deployUrl) {
    output += `\n🔗 Netlify dashboard: ${context.deployUrl}`;
  }

  if (context.details) {
    output += `\n\nDetails: ${context.details}`;
  }

  return output;
}

/**
 * Parse Netlify API error and return appropriate error code
 * @param {object} error - Axios error object
 * @returns {string} - Error code from errorMap
 */
function parseNetlifyError(error) {
  if (!error.response) {
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return 'network_error';
    }
    return 'unknown_error';
  }

  const status = error.response.status;
  const message = error.response.data?.message || '';

  // Authentication errors
  if (status === 401) {
    return 'unauthorized';
  }

  // Not found
  if (status === 404) {
    return 'site_not_found';
  }

  // Rate limiting
  if (status === 429) {
    return 'rate_limit';
  }

  // Build/deploy errors (usually 422 or 400)
  if (status === 422 || status === 400) {
    if (message.includes('build') && message.includes('timeout')) {
      return 'build_timeout';
    }
    if (message.includes('build') && message.includes('fail')) {
      return 'build_failed';
    }
    if (message.includes('publish') || message.includes('directory')) {
      return 'publish_dir_not_found';
    }
    if (message.includes('memory')) {
      return 'out_of_memory';
    }
    if (message.includes('install') || message.includes('dependency')) {
      return 'dependency_install_failed';
    }
  }

  // Site limit (usually 403)
  if (status === 403 && message.includes('limit')) {
    return 'site_limit_reached';
  }

  return 'unknown_error';
}

/**
 * Format Netlify API error for user
 * @param {object} error - Axios error object
 * @param {object} context - Additional context
 * @returns {string} - Formatted error message
 */
function formatNetlifyError(error, context = {}) {
  const errorCode = parseNetlifyError(error);

  // Add error details to context
  if (error.response?.data?.message) {
    context.details = error.response.data.message;
  }

  return formatError(errorCode, context);
}

module.exports = {
  errorMap,
  formatError,
  parseNetlifyError,
  formatNetlifyError
};
