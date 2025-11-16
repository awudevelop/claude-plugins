/**
 * Platform Validator
 * Validates platform support and provides user-friendly error messages
 */

const SUPPORTED_PLATFORMS = ['netlify'];
const PLANNED_PLATFORMS = ['aws', 'gcp', 'azure', 'vercel'];

/**
 * Validate if a platform is supported
 * @param {string} platform - Platform name (e.g., 'netlify', 'aws')
 * @returns {{valid: boolean, platform: string, status: string, error?: string, availablePlatforms?: string[]}}
 */
function validatePlatform(platform) {
  if (!platform) {
    return {
      valid: false,
      platform: 'unknown',
      status: 'missing',
      error: 'No platform specified',
      availablePlatforms: SUPPORTED_PLATFORMS
    };
  }

  const normalizedPlatform = platform.toLowerCase();

  if (SUPPORTED_PLATFORMS.includes(normalizedPlatform)) {
    return {
      valid: true,
      platform: normalizedPlatform,
      status: 'supported'
    };
  }

  if (PLANNED_PLATFORMS.includes(normalizedPlatform)) {
    return {
      valid: false,
      platform: normalizedPlatform,
      status: 'planned',
      error: `${platform.toUpperCase()} support is in development`,
      availablePlatforms: SUPPORTED_PLATFORMS
    };
  }

  return {
    valid: false,
    platform: normalizedPlatform,
    status: 'unknown',
    error: `Unknown platform: ${platform}`,
    availablePlatforms: SUPPORTED_PLATFORMS
  };
}

/**
 * Get user-friendly error message for unsupported platform
 * @param {string} platform - Platform name
 * @returns {string} - Formatted error message
 */
function getUnsupportedPlatformMessage(platform) {
  const validation = validatePlatform(platform);

  if (validation.valid) {
    return null;
  }

  const platformName = platform ? platform.toUpperCase() : 'UNKNOWN';

  let message = `❌ Platform Not Supported: ${platformName}\n\n`;
  message += `This plugin currently supports Netlify only.\n`;

  if (validation.status === 'planned') {
    message += `${platformName} support is in development and will be added in a future release.\n\n`;
  }

  message += `Supported platforms:\n`;
  message += `  ✓ Netlify\n\n`;

  message += `Coming soon:\n`;
  PLANNED_PLATFORMS.forEach(p => {
    message += `  ⏳ ${p.toUpperCase()}\n`;
  });

  message += `\nTo switch to Netlify:\n`;
  message += `  1. Run: /devops:init\n`;
  message += `  2. Configure token: /devops:secrets set\n`;
  message += `  3. Deploy: /devops:deploy\n`;

  return message;
}

/**
 * Check if platform requires validation
 * @param {string} platform - Platform name
 * @returns {boolean}
 */
function requiresValidation(platform) {
  return !SUPPORTED_PLATFORMS.includes(platform.toLowerCase());
}

/**
 * Get list of supported platforms
 * @returns {string[]}
 */
function getSupportedPlatforms() {
  return [...SUPPORTED_PLATFORMS];
}

/**
 * Get list of planned platforms
 * @returns {string[]}
 */
function getPlannedPlatforms() {
  return [...PLANNED_PLATFORMS];
}

module.exports = {
  validatePlatform,
  getUnsupportedPlatformMessage,
  requiresValidation,
  getSupportedPlatforms,
  getPlannedPlatforms,
  SUPPORTED_PLATFORMS,
  PLANNED_PLATFORMS
};
