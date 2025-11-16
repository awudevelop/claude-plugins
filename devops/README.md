# DevOps Plugin for Claude Code

Automated deployment plugin for Netlify with built-in secrets management, deployment tracking, and rollback capability.

> **Note**: Currently supports **Netlify only**. AWS, GCP, Azure, and Vercel support is in development and will be added in future releases.

## Features

### Currently Available (v1.0 - Netlify Support)

- ✅ **Netlify Deployments**: Full automation for Netlify deployments
  - Site creation and management
  - Automated builds and deploys
  - Real-time build logs
  - Instant rollbacks (zero downtime)
  - Deploy tracking and history

- ✅ **Secrets Management**: Secure local storage for API tokens
  - AES-256 encryption
  - Token validation
  - Secure credential handling

- ✅ **Safety Features**:
  - Pre-deployment validation
  - Project compatibility checks
  - Deployment tracking
  - Rollback capability

- ✅ **Zero-Token CLI**: All cloud operations run in Node.js (not Claude) for maximum efficiency

### Coming Soon

- ⏳ **AWS Support** (In Development) - ECS, Lambda, CloudFormation
- ⏳ **GCP Support** (Planned) - Cloud Run, App Engine, Cloud Functions
- ⏳ **Azure Support** (Planned) - App Service, Azure Functions
- ⏳ **Vercel Support** (Planned) - Similar to Netlify
- ⏳ **CI/CD Integration** (Planned) - GitHub Actions, Jenkins
- ⏳ **Infrastructure as Code** (Planned) - For AWS/GCP/Azure

## Current Limitations

**Platform Support:**
- ✅ Netlify - Fully supported
- ❌ AWS, GCP, Azure, Vercel - Not yet available (will block with clear error message)

**Netlify Features:**
- ✅ Deployment, rollback, status, logs
- ⏳ Environment variables sync (manual via Netlify UI)
- ⏳ Custom domains (manual via Netlify UI)
- ⏳ Advanced features (Functions, Forms, Identity)

**Supported Project Types:**
- ✅ Static sites (HTML/CSS/JS)
- ✅ React, Vue, Angular SPAs
- ✅ Next.js (static export or server-side)
- ✅ Gatsby, Hugo, Jekyll, Eleventy
- ✅ Netlify Functions
- ❌ Docker-based applications (use AWS when available)
- ❌ Kubernetes (use GCP/AWS when available)

## Installation

This plugin is part of the AutomateWith.Us marketplace.

```bash
# Install via Claude Code plugin marketplace
claude-code plugin install automatewithus/devops
```

## Quick Start (Netlify)

### Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **Netlify API Token**: Get your token at [app.netlify.com/user/applications](https://app.netlify.com/user/applications)
3. **Compatible Project**: Static site, SPA, Next.js, Gatsby, etc.

### Setup Steps

#### 1. Initialize DevOps Configuration

```bash
/devops:init
```

This will:
- Auto-select Netlify as platform
- Create `.devops/` directory
- Generate Netlify configuration
- Initialize deployment tracking

**Output:**
```
✓ Netlify deployment configured successfully!
📁 Configuration: .devops/config.json
🎯 Platform: Netlify

Next steps:
1. Configure your Netlify API token: /devops:secrets set
2. Deploy your application: /devops:deploy
```

#### 2. Configure Netlify API Token

```bash
/devops:secrets set
```

Set `NETLIFY_API_TOKEN` - the plugin will validate it automatically.

**Output:**
```
✓ Token valid! Connected to: your-email@example.com
✓ Token encrypted and stored
```

#### 3. Deploy Your Application

```bash
/devops:deploy
```

The plugin will:
- Auto-detect your project type (Next.js, React, etc.)
- Upload files to Netlify
- Trigger build
- Provide live URL

**Output:**
```
✓ Deployment successful!
🌐 Live URL: https://your-app-abc123.netlify.app
```

That's it! Your site is live on Netlify.

## Commands

### Setup & Configuration

#### `/devops:init`
Initialize DevOps configuration for your project (Netlify only).

**Interactive Setup:**
- Confirms Netlify setup
- Auto-selects Netlify as platform
- Configures secrets storage mode

**Example:**
```
> /devops:init

📦 DevOps Plugin - Netlify Setup

This plugin currently supports Netlify deployments only.

Ready to set up Netlify deployment? [Yes]

✓ Netlify deployment configured successfully!
📁 Configuration: .devops/config.json
🎯 Platform: Netlify
```

#### `/devops:config`
View or modify DevOps configuration.

**Commands:**
- `/devops:config` - View all configuration
- `/devops:config get platform` - Get specific value
- `/devops:config set {key} {value}` - Set value
- `/devops:config validate` - Validate configuration
- `/devops:config export` - Export configuration
- `/devops:config import config.json` - Import configuration

**Example:**
```
> /devops:config

⚙️  DevOps Configuration

Platform: netlify
Environment: production
Secrets Mode: local
Build Command: npm run build
Publish Directory: dist
```

#### `/devops:secrets`
Manage secrets and credentials.

**Commands:**
- `/devops:secrets set` - Set a secret
- `/devops:secrets get SECRET_NAME` - Get secret (masked)
- `/devops:secrets list` - List all secrets
- `/devops:secrets delete SECRET_NAME` - Delete secret
- `/devops:secrets validate` - Validate all secrets
- `/devops:secrets rotate SECRET_NAME` - Rotate secret
- `/devops:secrets sync` - Sync with external provider

**Example:**
```
> /devops:secrets set

Secret name: DATABASE_PASSWORD
Secret value: ••••••••

✓ Secret set successfully
Storage: AWS Secrets Manager
Encrypted: ✓
```

### Deployment

#### `/devops:deploy`
Deploy your application to the cloud.

**Usage:**
- `/devops:deploy` - Deploy to production
- `/devops:deploy staging` - Deploy to staging
- `/devops:deploy dev` - Deploy to development

**Example:**
```
> /devops:deploy

🚀 Deploying to AWS...
📦 Packaging application...
⬆️  Uploading to AWS...
🔄 Deploying version 1.2.3...
✓ Deployment successful!

🌐 URL: https://app.example.com
📊 Status: /devops:status
```

**Features:**
- Pre-deployment validation
- Automated packaging
- Health checks
- Deployment tracking
- Rollback on failure (configurable)

#### `/devops:rollback`
Rollback to a previous deployment.

**Usage:**
- `/devops:rollback` - Rollback to previous version
- `/devops:rollback v1.2.1` - Rollback to specific version
- `/devops:rollback dep_abc123` - Rollback to specific deployment

**Example:**
```
> /devops:rollback

📋 Recent Deployments

Current: v1.2.3 (deployed 2h ago)
Available:
  1. v1.2.2 (deployed 1d ago) - Stable
  2. v1.2.1 (deployed 3d ago) - Stable

⚠️  Rollback Impact Analysis
Changes to revert: 3 features, 2 fixes
Database migrations: 2 to revert
Estimated downtime: ~30 seconds

Type 'ROLLBACK' to confirm:
```

### Infrastructure

#### `/devops:infra`
Manage cloud infrastructure.

**Commands:**
- `/devops:infra setup` - Initial infrastructure setup
- `/devops:infra status` - Check infrastructure status
- `/devops:infra update` - Update infrastructure
- `/devops:infra plan` - Preview infrastructure changes
- `/devops:infra destroy` - Destroy infrastructure (⚠️ dangerous)

**Example:**
```
> /devops:infra setup

Infrastructure type: full-stack
Platform: AWS

Resources to create:
- VPC with 4 subnets
- 2 ECS instances
- Application Load Balancer
- RDS PostgreSQL database

Estimated cost: $125/month

Proceed? Yes

🏗️  Creating infrastructure...
✓ Infrastructure created successfully!
```

### CI/CD

#### `/devops:build`
Trigger CI/CD builds.

**Usage:**
- `/devops:build` - Build default branch
- `/devops:build --branch dev` - Build specific branch
- `/devops:build --workflow deploy` - Trigger specific workflow
- `/devops:build --env staging` - Build for environment

**Example:**
```
> /devops:build

✓ Build triggered successfully

Platform: GitHub Actions
Branch: main
Build ID: run-12345
Status: running

🔗 Build URL: https://github.com/org/repo/actions/runs/12345

Monitor progress? Yes

🔄 Building... (30s elapsed)
📦 Running tests... (1m 15s elapsed)
✓ Build completed successfully! (2m 30s)
```

### Monitoring

#### `/devops:status`
Check deployment and infrastructure status.

**Usage:**
- `/devops:status` - Overall status
- `/devops:status deployment` - Deployment status only
- `/devops:status build` - Build status only
- `/devops:status infra` - Infrastructure status only

**Example:**
```
> /devops:status

📊 DevOps Status Overview

🚀 Deployment
  Status: Healthy
  Version: 1.2.3
  URL: https://app.example.com

🔨 Last Build
  Status: Success
  Branch: main
  Duration: 2m 30s

🏗️  Infrastructure
  Status: Healthy
  Resources: 5 active
  Health: 98/100
  Cost (MTD): $87.50

📈 Metrics (Last 24h)
  Requests: 125,430
  Errors: 12 (0.01%)
  Avg Response: 125ms
```

#### `/devops:logs`
View deployment, build, or application logs.

**Usage:**
- `/devops:logs` - Recent application logs
- `/devops:logs --lines 500` - Show last N lines
- `/devops:logs --build build_123` - Build logs
- `/devops:logs --deployment dep_456` - Deployment logs
- `/devops:logs --follow` - Stream logs in real-time
- `/devops:logs --error` - Show only errors
- `/devops:logs --since 1h` - Logs from last hour

**Example:**
```
> /devops:logs --error

❌ Error Logs (last 100 errors)

2024-01-15 10:30:15 [ERROR] Database connection lost
  at DatabaseManager.connect (db.js:45)

2024-01-15 11:45:22 [ERROR] API timeout
  Error: Request timeout after 30s

Total errors: 12
Most common: Database timeout (8 occurrences)
```

## Configuration

### Configuration File Structure

`.devops/config.json`:
```json
{
  "version": "1.0",
  "platform": "aws",
  "environment": "production",
  "region": "us-east-1",
  "deployment": {
    "strategy": "rolling",
    "auto_deploy": false,
    "rollback_on_failure": true,
    "health_check_enabled": true
  },
  "cicd": {
    "platform": "github-actions",
    "auto_build": true,
    "default_branch": "main"
  },
  "secrets": {
    "mode": "aws",
    "provider": "AWS Secrets Manager",
    "encryption_enabled": true
  },
  "infrastructure": {
    "type": "full-stack",
    "auto_scale": true,
    "min_instances": 2,
    "max_instances": 10
  }
}
```

### Platform-Specific Configuration

Each platform has its own configuration template in `.devops/`:

- `aws-config.json` - AWS-specific settings
- `gcp-config.json` - GCP-specific settings
- `azure-config.json` - Azure-specific settings
- `netlify-config.json` - Netlify settings
- `vercel-config.json` - Vercel settings

### Environment Variables

Required environment variables by platform:

**AWS:**
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

**GCP:**
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GCP_PROJECT_ID=your-project-id
```

**Azure:**
```bash
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

**Netlify:**
```bash
NETLIFY_API_TOKEN=your-api-token
```

**Vercel:**
```bash
VERCEL_API_TOKEN=your-api-token
```

**GitHub Actions:**
```bash
GITHUB_TOKEN=your-github-token
```

**Jenkins:**
```bash
JENKINS_URL=https://jenkins.example.com
JENKINS_USERNAME=your-username
JENKINS_API_TOKEN=your-api-token
```

**Secrets Master Key (for local storage):**
```bash
DEVOPS_MASTER_KEY=your-secret-master-key
```

## Secrets Management

### Local Encrypted Storage

For development environments:

```bash
/devops:secrets set
```

Secrets are encrypted using AES-256 and stored in `.devops/credentials.enc`.

**Security:**
- AES-256 encryption
- Master key from environment variable
- Automatic backups
- Never committed to git (in `.gitignore`)

### External Providers

For production environments:

**AWS Secrets Manager:**
```json
{
  "secrets": {
    "mode": "aws",
    "provider": "AWS Secrets Manager"
  }
}
```

**GCP Secret Manager:**
```json
{
  "secrets": {
    "mode": "gcp",
    "provider": "GCP Secret Manager"
  }
}
```

**Azure Key Vault:**
```json
{
  "secrets": {
    "mode": "azure",
    "provider": "Azure Key Vault"
  }
}
```

## Deployment Strategies

### Rolling Deployment (Default)

Gradual replacement of instances:
- Zero downtime
- Automatic rollback on failure
- Health checks between updates

### Blue-Green Deployment

Two identical environments:
- Instant traffic swap
- Easy rollback
- Higher cost (2x resources)

### Canary Deployment

Gradual traffic shift:
- 10% → 50% → 100%
- Risk mitigation
- Performance monitoring

## Safety Features

### Pre-Deployment Validation

Automatic checks before deployment:
- ✓ Credentials configured
- ✓ Git repository clean
- ✓ Platform connectivity
- ✓ Build artifacts exist
- ✓ Previous deployment status

### Automatic Rollback

Configurable automatic rollback on:
- Failed health checks
- Deployment errors
- Application crashes

### Deployment Tracking

Complete audit trail:
- All deployments recorded
- Deployment metadata saved
- Rollback history tracked
- Cost tracking

## Architecture

### Zero-Token CLI Operations

All cloud operations run in Node.js CLI (not Claude):
- Platform API calls
- Configuration management
- Secrets encryption
- Deployment tracking
- Log retrieval

**Benefits:**
- Minimal token usage
- Faster operations
- Better security
- Full audit trail

### Plugin Structure

```
devops/
├── plugin.json              # Plugin manifest
├── commands/                # 9 command definitions
│   ├── init.md
│   ├── deploy.md
│   ├── build.md
│   ├── infra.md
│   ├── status.md
│   ├── logs.md
│   ├── rollback.md
│   ├── config.md
│   └── secrets.md
├── cli/                     # Node.js CLI tool
│   ├── devops-cli.js       # Main CLI
│   ├── package.json
│   └── lib/
│       ├── platforms/      # Platform managers
│       │   ├── aws-manager.js
│       │   ├── gcp-manager.js
│       │   ├── azure-manager.js
│       │   ├── netlify-manager.js
│       │   └── vercel-manager.js
│       ├── cicd/           # CI/CD integrations
│       │   ├── github-actions.js
│       │   └── jenkins-manager.js
│       ├── config-manager.js
│       ├── deployment-tracker.js
│       └── secrets-manager.js
├── hooks/                   # Lifecycle hooks
│   ├── hooks.json
│   └── pre-deployment-check.js
├── templates/               # Platform config templates
│   ├── aws-config.template.json
│   ├── gcp-config.template.json
│   ├── azure-config.template.json
│   ├── netlify-config.template.json
│   └── vercel-config.template.json
└── README.md
```

## Examples

### Example 1: Deploy to AWS

```bash
# Initialize
/devops:init
Platform: AWS
CI/CD: GitHub Actions
Secrets: AWS Secrets Manager

# Configure secrets
/devops:secrets set
Name: DATABASE_PASSWORD
Value: ••••••••

# Set up infrastructure
/devops:infra setup
Type: full-stack

# Deploy
/devops:deploy
✓ Deployed to https://app.example.com
```

### Example 2: Deploy to Netlify

```bash
# Initialize
/devops:init
Platform: Netlify
CI/CD: Netlify (managed)
Secrets: Local

# Deploy
/devops:deploy
✓ Deployed to https://app.netlify.app
```

### Example 3: Rollback Deployment

```bash
# Check current status
/devops:status

# View deployment history
/devops:rollback
Shows: v1.2.3 (current), v1.2.2, v1.2.1

# Rollback to previous
/devops:rollback v1.2.2
✓ Rolled back to v1.2.2
```

## Troubleshooting

### Deployment Fails

```bash
# Check logs
/devops:logs --error

# Validate configuration
/devops:config validate

# Check credentials
/devops:secrets validate

# Check platform connectivity
/devops:status infra
```

### Build Fails

```bash
# View build logs
/devops:logs --build {build_id}

# Trigger new build
/devops:build --branch main
```

### Credentials Issues

```bash
# Validate all secrets
/devops:secrets validate

# Re-set credentials
/devops:secrets set AWS_ACCESS_KEY_ID
```

## Best Practices

1. **Use External Secrets in Production**: AWS Secrets Manager, GCP Secret Manager, or Azure Key Vault
2. **Enable Auto-Rollback**: Automatically rollback on deployment failures
3. **Monitor Deployments**: Use `/devops:status` regularly
4. **Test in Staging First**: Always deploy to staging before production
5. **Keep Deployment History**: Don't delete old deployments (rollback capability)
6. **Rotate Secrets Regularly**: Use `/devops:secrets rotate` every 90 days
7. **Version Your Infrastructure**: Use infrastructure templates in git
8. **Enable Health Checks**: Catch deployment issues early
9. **Track Costs**: Monitor infrastructure costs via `/devops:status infra`
10. **Backup Configurations**: Export configs before major changes

## Security

- ✓ All secrets encrypted at rest (AES-256)
- ✓ Never log secret values
- ✓ Automatic secret rotation support
- ✓ Pre-deployment security checks
- ✓ Audit trail for all operations
- ✓ `.devops/credentials.enc` in `.gitignore`
- ✓ Secure deletion with backups
- ✓ External secret provider support

## License

MIT

## Support

- GitHub Issues: https://github.com/automatewithus/claude-plugins/issues
- Email: team@automatewith.us

## Changelog

### v1.0.0 (2024-01-15)

Initial release:
- Multi-cloud support (AWS, GCP, Azure, Netlify, Vercel)
- CI/CD integration (GitHub Actions, Jenkins)
- Secrets management (local + external)
- Infrastructure management
- Deployment tracking and rollback
- Safety hooks and validation
- Comprehensive logging
