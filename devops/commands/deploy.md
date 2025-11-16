# DevOps Plugin - Deploy Application

You are deploying an application to a cloud platform.

## Task: Deploy Application

The user wants to deploy their application. This command handles fully automated deployments with pre-flight checks.

### Step 1: Verify Configuration

1. Check if `.devops/config.json` exists
2. If not, show error:
   ```
   ❌ DevOps not initialized
   💡 Run /devops:init first to set up configuration
   ```
   Then STOP.

3. Read configuration using CLI:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get
   ```

4. **Validate platform is supported**:
   - Get platform from config: `config.platform`
   - If platform is NOT "netlify", show error:
   ```
   ❌ Platform Not Supported: {platform}

   This plugin currently supports Netlify deployments only.
   AWS, GCP, Azure, and Vercel support is in development.

   To switch to Netlify:
   1. Reconfigure: /devops:init
   2. Or manually update: /devops:config set platform netlify
   3. Configure token: /devops:secrets set
   4. Deploy: /devops:deploy

   Current platform: {platform}
   Supported platforms: Netlify
   ```
   Then STOP.

### Step 2: Pre-Deployment Checks

Run pre-deployment validation:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js validate-deployment
```

This checks:
- Credentials are configured
- Platform connectivity
- Git repository is clean (or has tracked changes)
- Build artifacts exist (if needed)
- Previous deployment status

If validation fails, show error message from CLI and STOP.

### Step 3: Determine Deployment Target

Parse command arguments for target environment:
- `/devops:deploy` - Deploy to default (production)
- `/devops:deploy staging` - Deploy to staging
- `/devops:deploy dev` - Deploy to development

### Step 4: Confirm Deployment (if production)

If deploying to production, ask for confirmation:
```
⚠️  Production Deployment
Platform: {platform}
Environment: production
Current version: {current_version}
New version: {new_version}

Proceed with deployment?
```
Options: Yes, No

If No, STOP.

### Step 5: Execute Deployment

Run deployment via CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js deploy \
  --env "{environment}" \
  --platform "{platform}" \
  --track
```

The CLI will:
1. Package application (if needed)
2. Upload to cloud platform
3. Execute deployment
4. Monitor deployment status
5. Save deployment record to `.devops/deployments.json`

Show real-time output from CLI.

### Step 6: Monitor Deployment

The CLI streams deployment progress. Display updates:
```
🚀 Deploying to {platform}...
📦 Packaging application...
⬆️  Uploading to {platform}...
🔄 Deploying version {version}...
✓ Deployment successful!

🌐 URL: {deployment_url}
📊 Status: /devops:status
📝 Logs: /devops:logs
```

### Step 7: Post-Deployment Verification

Run post-deployment checks:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js verify-deployment --id {deployment_id}
```

If verification fails:
```
⚠️  Deployment succeeded but verification failed
🔄 Use /devops:rollback to revert
📝 Use /devops:logs to investigate
```

### Step 8: Save Deployment Record

Deployment record is automatically saved by CLI to:
- `.devops/deployments.json` (deployment history)
- `.devops/current-deployment.json` (current state)

---

**Netlify Deployment Details**:

The deployment process for Netlify:
1. **Automatic project detection** - Detects Next.js, React, Vue, static sites, etc.
2. **File upload** - Uploads build files to Netlify
3. **Build execution** - Netlify runs your build command (e.g., `npm run build`)
4. **Live deployment** - Site is published to your Netlify URL
5. **Instant rollback** - Previous versions remain available for instant rollback

**Supported Project Types**:
- Static sites (HTML/CSS/JS)
- Single Page Applications (React, Vue, Angular, Svelte)
- Static Site Generators (Next.js, Gatsby, Hugo, Jekyll, Eleventy)
- Serverless Functions (Netlify Functions)

**Not Supported** (use different platform when available):
- Docker containers (use AWS ECS when available)
- Kubernetes (use GCP/AWS when available)
- Custom infrastructure (use AWS/GCP/Azure when available)

**IMPORTANT**:
- All deployment operations are fully automated
- Rollback is available via `/devops:rollback`
- Deployment history is tracked locally
- Netlify provides managed builds (no separate CI/CD needed)
