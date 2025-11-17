# Changelog

All notable changes to the DevOps Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-17

### Fixed
- Fixed deployment tracking bug where deployments were not persisted to history unless `--track` flag was explicitly passed
- All deployments now automatically recorded in deployment tracker for proper history and rollback capability

### Added
- Comprehensive IMPLEMENTATION.md documentation covering Wave 1-3 implementation status and testing results

## [1.0.0] - 2025-11-16

### Added
- Initial release with Netlify-only support
- Netlify deployment automation via official CLI wrapper
- AES-256 encrypted secrets management with local storage
- Hybrid token authentication (env vars + encrypted storage)
- Automatic Netlify token validation
- Platform validation blocking unsupported platforms
- Project type auto-detection (Next.js, React, Vue, etc.)
- Instant rollback capability
- Deployment tracking and history
- Zero-token CLI operations for efficiency
- Comprehensive error handling with actionable fixes
- 9 command files: init, deploy, build, infra, status, logs, rollback, config, secrets
- Foundation layer (Wave 1): CLI router, config manager, secrets manager, deployment tracker, platform validator
- Platform layer (Wave 2): Netlify manager, validator, and error handler
- Commands layer (Wave 3): Full command suite implementation

### Notes
- AWS, GCP, Azure, and Vercel support planned for future releases
- Netlify CLI required (installed via npx automatically)
- Supports static sites, SPAs, SSGs, and Netlify Functions
