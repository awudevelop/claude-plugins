# Deployment Plugin for Claude Code

Safe deployment automation with CICD integration. Manages branch-based deployments to dev/uat/prod environments with safety checks and build validation.

## Overview

This plugin enables safe, automated deployments through Netlify's auto-deploy system by managing git branch merges and enforcing safety checks. It provides:

- **Slash Commands**: Interactive deployment workflows
- **CLI Tool**: Fast, zero-token operations
- **Safety Hooks**: Automatic pre-deployment validation
- **Environment Progression**: Enforced dev → uat → prod flow

## Quick Start

### 1. Initialize Configuration

```bash
/deploy:init
```

This will:
- Ask for your main branch (main/master/develop)
- Ask for your build command (npm run build, etc.)
- Create `.claude/deployment.config.json`
- Optionally create deployment branches

### 2. Deploy to an Environment

```bash
/deploy dev   # Deploy to development
/deploy uat   # Deploy to UAT
/deploy prod  # Deploy to production
```

## Architecture

```
deployment/
├── plugin.json                 # Plugin manifest
├── commands/
│   ├── init.md                 # /deploy:init command
│   └── deploy.md               # /deploy [env] command
├── hooks/
│   └── pre-deploy-check.js     # Safety validation hook
└── cli/
    ├── deploy-cli.js           # CLI entry point
    ├── lib/
    │   ├── config-manager.js   # Config CRUD
    │   ├── git-helper.js       # Git operations
    │   └── commands/           # Command handlers
    └── tests/                  # Unit tests
```

## Features

### Slash Commands

#### `/deploy:init`
Initialize deployment configuration with interactive prompts:
- Select main branch
- Configure build command
- Create default environments (dev/uat/prod)
- Optionally create deployment branches

#### `/deploy [env]`
Deploy to an environment with full safety checks:
- Pre-deployment validation
- Build verification
- Branch progression enforcement
- Automatic merge and push
- Clear progress feedback

### CLI Tool

Fast Node.js CLI for configuration and validation:

```bash
# Initialize config
node cli/deploy-cli.js init --main-branch main --build-command "npm run build"

# Get config
node cli/deploy-cli.js config

# Validate deployment
node cli/deploy-cli.js validate --check-git --env dev

# Check git status
node cli/deploy-cli.js check-git
```

**Performance**: < 10ms for config operations, < 100ms for full validation

### Safety Hooks

PreToolUse hook that automatically:
- Detects deployment commands
- Checks for uncommitted files
- Validates correct branch
- Blocks unsafe operations
- Provides actionable error messages

**Performance**: < 100ms execution time

## Configuration

### Default Configuration

Created by `/deploy:init` at `.claude/deployment.config.json`:

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

### Customization

Edit `.claude/deployment.config.json` to:
- Add more environments
- Change branch names
- Modify build commands
- Toggle safety features

## Deployment Flow

### Environment Progression

```
Feature Branch → main (PR merge)
                  ↓
             deploy_dev (dev environment)
                  ↓
             deploy_uat (UAT environment)
                  ↓
             deploy_prod (production)
```

### Typical Workflow

1. **Develop**: Make changes on feature branch
2. **Merge**: PR merge to main branch
3. **Deploy to Dev**: `/deploy dev`
   - Merges main → deploy_dev
   - Triggers Netlify dev deployment
4. **Test**: Verify in dev environment
5. **Deploy to UAT**: `/deploy uat`
   - Merges deploy_dev → deploy_uat
   - Triggers Netlify UAT deployment
6. **Approve**: Stakeholder approval
7. **Deploy to Prod**: `/deploy prod`
   - Merges deploy_uat → deploy_prod
   - Triggers Netlify prod deployment

## Safety Features

### Pre-Deployment Checks

Before each deployment:
- ✅ Configuration exists
- ✅ No uncommitted files
- ✅ On correct source branch
- ✅ Build succeeds
- ✅ Environment is valid

### Error Handling

Clear, actionable error messages:

```
🚫 Deployment blocked by safety checks:

**Errors** (must fix):

❌ 2 uncommitted file(s) detected
   Files:
   - src/index.js (M )
   - package.json (M )
   💡 Fix: Commit or stash changes: git add . && git commit -m "..."

---

Fix the issues above before deploying.
Once fixed, retry the deployment command.
```

### Safeguards

- No force deployments
- Environment progression enforced
- Build validation required
- Branch validation enforced
- Uncommitted files blocked

## CICD Integration

This plugin integrates with **Netlify's auto-deploy system**:

1. Configure Netlify to auto-deploy on branch commits
2. Set up three sites in Netlify:
   - **Dev site**: Auto-deploy on `deploy_dev` branch
   - **UAT site**: Auto-deploy on `deploy_uat` branch
   - **Prod site**: Auto-deploy on `deploy_prod` branch
3. Plugin manages branch merges, Netlify handles builds

### Netlify Setup

For each environment:
1. Create a new site in Netlify
2. Connect to your repository
3. Set build settings:
   - Branch: `deploy_dev` (or deploy_uat/deploy_prod)
   - Build command: From your config (e.g., `npm run build`)
   - Publish directory: Your build output
4. Enable auto-deploy on push

## Testing

### Manual Testing

```bash
# Test CLI
cd deployment/cli
npm test

# Test hook
cat test-hook-input.json | node hooks/pre-deploy-check.js

# Test commands
/deploy:init
/deploy dev
```

### Unit Tests

CLI has comprehensive unit tests:
- ConfigManager: 7 tests
- GitHelper: 7 tests
- Total: 14/14 passing

```bash
cd deployment/cli
npm test
```

## Troubleshooting

### Common Issues

**Issue**: "Deployment configuration not found"
**Fix**: Run `/deploy:init` first

**Issue**: "Uncommitted files detected"
**Fix**: Commit or stash changes before deploying

**Issue**: "Build failed"
**Fix**: Review build errors, fix issues, retry

**Issue**: "Merge conflicts"
**Fix**: Resolve conflicts manually, then retry deployment

### Debug Mode

Check hook execution:
```bash
# Test hook with your scenario
cat test-input.json | node hooks/pre-deploy-check.js
```

View configuration:
```bash
node cli/deploy-cli.js config
```

## Performance

- CLI config read: < 5ms ✅
- CLI config write: < 10ms ✅
- Git status check: < 50ms ✅
- Full validation: < 100ms ✅
- Hook execution: < 100ms ✅

## Limitations

- Requires Netlify CICD setup (or similar auto-deploy)
- Branch-based deployment only
- Single project per repository
- No rollback support (Phase 2 feature)

## Roadmap

### Phase 2 Features
- `/deploy:status` - Check deployment status
- `/deploy:logs` - View deployment logs
- `/deploy:rollback` - Rollback deployment
- `/deploy:history` - Deployment history
- Custom CICD provider support
- Multi-project support
- Slack/Discord notifications

## License

MIT

## Author

AutomateWith.Us

## Support

For issues or feature requests, please contact the plugin author or submit an issue in the marketplace.
