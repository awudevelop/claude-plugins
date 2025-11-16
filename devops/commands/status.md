# DevOps Plugin - Deployment Status

You are checking deployment and infrastructure status.

## Task: Check Deployment Status

The user wants to check the status of deployments, builds, or infrastructure.

### Step 1: Verify Configuration

1. Check if `.devops/config.json` exists
2. If not, show:
   ```
   ❌ DevOps not initialized
   💡 Run /devops:init to get started
   ```
   Then STOP.

3. **Validate platform is supported**:
   - Read config and get platform
   - If platform is NOT "netlify", show error:
   ```
   ❌ Platform Not Supported: {platform}

   This plugin currently supports Netlify only.

   To switch to Netlify:
   1. Reconfigure: /devops:init
   2. Or update manually: /devops:config set platform netlify

   Supported platforms: Netlify
   ```
   Then STOP.

### Step 2: Parse Status Command

Parse arguments:
- `/devops:status` - Show overall status
- `/devops:status deployment` - Show deployment status only
- `/devops:status build` - Show build status only
- `/devops:status infra` - Show infrastructure status only

### Step 3: Get Overall Status

**For `/devops:status`** (no args):

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js status --all --json
```

Display comprehensive status:
```
📊 DevOps Status Overview

Platform: {platform}
Environment: {environment}
Last updated: {timestamp}

🚀 Deployment
  Status: {deployment_status}
  Version: {current_version}
  Deployed: {deployment_time}
  URL: {deployment_url}

🔨 Last Build
  Status: {build_status}
  Branch: {branch}
  Commit: {commit_hash}
  Duration: {build_duration}

🏗️  Infrastructure
  Status: {infra_status}
  Resources: {resource_count} active
  Health: {health_score}/100
  Cost (MTD): ${cost}

📈 Metrics (Last 24h)
  Requests: {request_count}
  Errors: {error_count} ({error_rate}%)
  Avg Response: {avg_response_time}ms

💡 Quick actions:
  - Deploy: /devops:deploy
  - View logs: /devops:logs
  - Rollback: /devops:rollback
```

### Step 4: Get Deployment Status

**For `/devops:status deployment`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js status deployment --json
```

Display:
```
🚀 Deployment Status

Current Deployment:
  ID: {deployment_id}
  Version: {version}
  Environment: {environment}
  Status: {status}
  Deployed: {timestamp}
  URL: {url}

Health Checks:
  Endpoint: {endpoint}
  Status: {health_status}
  Last check: {last_check}
  Uptime: {uptime}%

Recent Deployments:
1. v{version1} - {time1} - {status1}
2. v{version2} - {time2} - {status2}
3. v{version3} - {time3} - {status3}

📝 Full history: .devops/deployments.json
```

### Step 5: Get Build Status

**For `/devops:status build`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js status build --json
```

Display:
```
🔨 Build Status

Latest Build:
  ID: {build_id}
  Status: {status}
  Branch: {branch}
  Commit: {commit}
  Triggered: {timestamp}
  Duration: {duration}

Build History (last 5):
1. #{build1} - {status1} - {branch1} - {time1}
2. #{build2} - {status2} - {branch2} - {time2}
3. #{build3} - {status3} - {branch3} - {time3}
4. #{build4} - {status4} - {branch4} - {time4}
5. #{build5} - {status5} - {branch5} - {time5}

Success rate (last 30 builds): {success_rate}%

🔗 CI/CD Dashboard: {dashboard_url}
```

### Step 6: Get Infrastructure Status

**For `/devops:status infra`**:

**Note**: Netlify is a managed platform - infrastructure is handled automatically.

Show:
```
🏗️  Netlify Infrastructure (Managed)

Platform: Netlify
Status: Fully Managed

Netlify handles all infrastructure automatically:
  ✓ Global CDN - Automatic edge distribution
  ✓ SSL/TLS - Auto-provisioned and renewed
  ✓ DNS - Managed DNS available
  ✓ Build servers - Automatic scaling
  ✓ Serverless functions - Auto-deployed

Site Information:
  Site ID: {site_id}
  Site Name: {site_name}
  URL: {site_url}
  Custom Domain: {custom_domain or "Not configured"}

Build Configuration:
  Build command: {build_command}
  Publish directory: {publish_dir}
  Node version: {node_version}

💡 Netlify manages infrastructure for you
💡 No manual infrastructure setup needed
💡 View Netlify dashboard: https://app.netlify.com/sites/{site_name}
```

### Step 7: Handle Errors

If status check fails:
```
❌ Failed to retrieve status

Error: {error_message}

Troubleshooting:
- Check credentials: /devops:secrets validate
- Verify connectivity: ping {platform_endpoint}
- View logs: /devops:logs --recent
```

---

**Auto-Refresh Option**:

If user wants real-time monitoring, offer:
"Would you like to monitor status in real-time?"
- If yes, run monitoring loop (refresh every 10s)
- If no, show static status

**IMPORTANT**:
- All status data fetched via zero-token CLI
- Status cached for 30 seconds to reduce API calls
- Metrics aggregated from platform APIs
