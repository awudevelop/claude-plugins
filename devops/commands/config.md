# DevOps Plugin - Configuration Management

You are managing DevOps configuration settings.

## Task: Manage Configuration

The user wants to view or modify DevOps configuration.

### Step 1: Check for Configuration

1. Check if `.devops/config.json` exists
2. If not and command is not `set`:
   ```
   ❌ DevOps not initialized
   💡 Run /devops:init to create configuration
   ```
   Then STOP.

### Step 2: Parse Config Command

Parse subcommand:
- `/devops:config` - Show current configuration
- `/devops:config get {key}` - Get specific config value
- `/devops:config set {key} {value}` - Set config value
- `/devops:config list` - List all configuration keys
- `/devops:config validate` - Validate configuration
- `/devops:config export` - Export configuration
- `/devops:config import {file}` - Import configuration

### Step 3: Show Configuration

**For `/devops:config`** (default):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get --all
```

Display:
```
⚙️  DevOps Configuration

Platform: {platform}
Environment: {environment}
Region: {region}

Deployment:
  Strategy: {strategy}
  Auto-deploy: {auto_deploy}
  Rollback-on-failure: {rollback_enabled}

CI/CD:
  Platform: {cicd_platform}
  Auto-build: {auto_build}
  Branch: {default_branch}

Secrets:
  Mode: {secrets_mode}
  Provider: {secrets_provider}
  Encrypted: {is_encrypted}

Infrastructure:
  Type: {infra_type}
  Auto-scale: {auto_scale}
  Min instances: {min_instances}
  Max instances: {max_instances}

Monitoring:
  Enabled: {monitoring_enabled}
  Alerts: {alerts_enabled}
  Log retention: {log_retention} days

Configuration file: .devops/config.json
Last updated: {last_updated}

💡 Modify: /devops:config set {key} {value}
💡 Validate: /devops:config validate
```

### Step 4: Get Specific Config Value

**For `/devops:config get {key}`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get --key "{key}"
```

Display:
```
{key}: {value}
```

Example:
```
$ /devops:config get platform
platform: aws
```

### Step 5: Set Config Value

**For `/devops:config set {key} {value}`**:

1. Validate key exists:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config validate-key --key "{key}"
   ```

2. If invalid key:
   ```
   ❌ Invalid configuration key: {key}

   Valid keys:
   - platform (aws, gcp, azure, netlify, vercel)
   - environment (dev, staging, production)
   - region (cloud-specific regions)
   - cicd_platform (github-actions, jenkins, netlify, vercel)
   - secrets_mode (local, aws, gcp, azure, manual)
   - auto_deploy (true, false)
   - auto_scale (true, false)
   ```
   Then STOP.

3. Set value:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config set \
     --key "{key}" \
     --value "{value}"
   ```

4. Show confirmation:
   ```
   ✓ Configuration updated

   {key}: {old_value} → {new_value}

   💡 Validate: /devops:config validate
   ```

### Step 6: Validate Configuration

**For `/devops:config validate`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config validate
```

Display validation results:
```
🔍 Validating configuration...

Platform Configuration:
  ✓ Platform: aws (valid)
  ✓ Region: us-east-1 (valid)
  ✓ Credentials: configured

CI/CD Configuration:
  ✓ Platform: github-actions (valid)
  ⚠️  Auto-build: disabled (recommended: true)
  ✓ Branch: main (exists)

Secrets Configuration:
  ✓ Mode: aws (valid)
  ✓ Provider: AWS Secrets Manager (accessible)
  ✓ Encryption: enabled

Infrastructure Configuration:
  ✓ Type: full-stack (valid)
  ✓ Auto-scale: enabled
  ⚠️  Max instances: 10 (high cost warning)
  ✓ Min instances: 2 (valid)

Overall: Valid with 2 warnings

💡 Fix warnings or continue with current config
```

### Step 7: Export Configuration

**For `/devops:config export`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config export \
  --output ".devops/config-export-{timestamp}.json"
```

Show:
```
✓ Configuration exported

File: .devops/config-export-{timestamp}.json
Size: {size} KB

Exported settings:
- Platform configuration
- CI/CD settings
- Infrastructure config
- Monitoring settings

⚠️  Note: Secrets are NOT exported (security)

💡 Import to another project: /devops:config import {file}
```

### Step 8: Import Configuration

**For `/devops:config import {file}`**:

1. Validate import file exists
2. Show preview:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config preview-import \
     --file "{file}"
   ```

3. Display changes:
   ```
   📥 Configuration Import Preview

   File: {file}
   Settings to import: {count}

   Changes:
   - platform: {current} → {new}
   - region: {current} → {new}
   - cicd_platform: {current} → {new}

   New settings:
   + monitoring_enabled: true
   + log_retention: 30

   ⚠️  This will overwrite current configuration
   ```

4. Ask: "Import this configuration?"
   - If no, STOP
   - If yes, import

5. Import:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config import \
     --file "{file}" \
     --backup
   ```

6. Show result:
   ```
   ✓ Configuration imported

   Backup saved: .devops/config-backup-{timestamp}.json
   Active config: .devops/config.json

   💡 Validate: /devops:config validate
   💡 Restore backup if needed: /devops:config import {backup_file}
   ```

### Step 9: List All Keys

**For `/devops:config list`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config list-keys
```

Display:
```
⚙️  Available Configuration Keys

Platform:
  - platform (aws, gcp, azure, netlify, vercel)
  - region (cloud-specific)
  - environment (dev, staging, production)

Deployment:
  - deployment_strategy (rolling, blue-green, canary)
  - auto_deploy (true, false)
  - rollback_on_failure (true, false)
  - health_check_enabled (true, false)

CI/CD:
  - cicd_platform (github-actions, jenkins, netlify, vercel)
  - auto_build (true, false)
  - default_branch (branch name)
  - build_timeout (seconds)

Secrets:
  - secrets_mode (local, aws, gcp, azure, manual)
  - secrets_provider (provider name)
  - encryption_enabled (true, false)

Infrastructure:
  - infra_type (compute, serverless, static, full-stack)
  - auto_scale (true, false)
  - min_instances (number)
  - max_instances (number)
  - instance_type (instance size)

Monitoring:
  - monitoring_enabled (true, false)
  - alerts_enabled (true, false)
  - log_retention (days)
  - metrics_retention (days)

💡 Get value: /devops:config get {key}
💡 Set value: /devops:config set {key} {value}
```

---

**Configuration Schema**:

The `.devops/config.json` file structure:
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
    "default_branch": "main",
    "build_timeout": 600
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
    "max_instances": 10,
    "instance_type": "t3.medium"
  },
  "monitoring": {
    "enabled": true,
    "alerts_enabled": true,
    "log_retention": 30,
    "metrics_retention": 90
  }
}
```

**IMPORTANT**:
- Configuration changes take effect immediately
- Always validate after making changes
- Backup created automatically on import
- Secrets are never stored in config.json
- Platform-specific settings validated against cloud APIs
