# Deployment CLI Tool

Fast, zero-token CLI tool for the Claude Code deployment plugin.

## Overview

This CLI tool handles configuration management, git validation, and pre-deployment checks for the deployment plugin. It's designed to work seamlessly with Claude Code's slash commands and hooks system.

## Features

- ⚡ Fast execution (< 10ms for config operations)
- 📦 Zero external dependencies (Node.js built-ins only)
- 🎯 JSON output for easy parsing
- ✅ Comprehensive error handling
- 🧪 Full unit test coverage

## Commands

### init
Initialize deployment configuration with default settings.

```bash
node deploy-cli.js init [options]

Options:
  --main-branch <branch>      Main branch name (default: main)
  --build-command <command>   Build command (default: npm run build)
```

**Example:**
```bash
node deploy-cli.js init --main-branch main --build-command "npm run build"
```

### config
Get or view deployment configuration.

```bash
node deploy-cli.js config [options]

Options:
  --get <key>   Get specific config value (supports nested keys: environments.dev)
```

**Examples:**
```bash
# Get entire config
node deploy-cli.js config

# Get specific value
node deploy-cli.js config --get environments.dev
node deploy-cli.js config --get mainBranch
```

### validate
Validate pre-deployment conditions.

```bash
node deploy-cli.js validate [options]

Options:
  --check-git           Check for uncommitted files
  --check-build         Check build status
  --env <environment>   Validate specific environment
```

**Example:**
```bash
node deploy-cli.js validate --check-git --env dev
```

**Output:**
```json
{
  "success": true,
  "checks": [
    { "check": "config_exists", "status": "pass" },
    { "check": "uncommitted_files", "status": "pass" }
  ],
  "errors": [],
  "warnings": [],
  "summary": {
    "total": 2,
    "passed": 2,
    "failed": 0,
    "warnings": 0
  }
}
```

### check-git
Get current git status and branch information.

```bash
node deploy-cli.js check-git
```

**Output:**
```json
{
  "success": true,
  "git": {
    "currentBranch": "main",
    "isClean": false,
    "uncommittedFiles": 2,
    "files": [
      { "status": "M ", "file": "index.js" },
      { "status": "??", "file": "new-file.js" }
    ]
  }
}
```

## Configuration File

The CLI creates and manages `.claude/deployment.config.json`:

```json
{
  "mainBranch": "main",
  "buildCommand": "npm run build",
  "environments": {
    "dev": {
      "branch": "deploy_dev",
      "sourceBranch": "main",
      "requireTests": true,
      "requireApproval": false
    },
    "uat": {
      "branch": "deploy_uat",
      "sourceEnvironment": "dev",
      "requireTests": true,
      "requireApproval": false
    },
    "prod": {
      "branch": "deploy_prod",
      "sourceEnvironment": "uat",
      "requireTests": true,
      "requireApproval": false
    }
  },
  "safeguards": {
    "checkUncommittedFiles": true,
    "requireCleanBuild": true,
    "checkBranch": true
  }
}
```

## Testing

Run unit tests:

```bash
npm test
```

All tests use Node.js built-in test runner (no external dependencies).

## Architecture

```
deployment/cli/
├── deploy-cli.js               # Main entry point with command routing
├── package.json                # Package configuration
├── lib/
│   ├── config-manager.js       # Config CRUD operations
│   ├── git-helper.js           # Git status checks
│   └── commands/               # Command handlers
│       ├── init.js             # Initialize config
│       ├── validate.js         # Pre-deployment validation
│       ├── config.js           # Get/set config values
│       └── check-git.js        # Git status check
└── tests/
    ├── config-manager.test.js  # ConfigManager tests
    └── git-helper.test.js      # GitHelper tests
```

## Performance Targets

- Config read: < 5ms ✅
- Config write: < 10ms ✅
- Git status check: < 50ms ✅
- Full validation: < 100ms ✅

## Integration

### With Slash Commands

Commands call the CLI via bash:

```javascript
const result = execSync('node deployment/cli/deploy-cli.js validate --check-git --env prod');
const validation = JSON.parse(result);
```

### With Hooks

Hooks use the CLI for validation:

```javascript
const validation = execSync('node cli/deploy-cli.js validate --check-git');
const result = JSON.parse(validation);
if (!result.success) {
  // Block execution
}
```

## Error Handling

All commands return JSON with consistent error format:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

Exit codes:
- `0`: Success
- `1`: Error

## License

MIT
