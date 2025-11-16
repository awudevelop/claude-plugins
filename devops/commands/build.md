# DevOps Plugin - Trigger CI/CD Build

You are triggering a CI/CD build pipeline.

## Task: Trigger CI/CD Build

The user wants to trigger a CI/CD build. This command works with GitHub Actions, Jenkins, and managed CI/CD platforms.

### Step 1: Verify Configuration

1. Check if `.devops/config.json` exists

2. **Validate platform is supported**:
   - Read config and get platform
   - If platform is NOT "netlify", show error:
   ```
   ❌ Platform Not Supported: {platform}

   This plugin currently supports Netlify only.

   To switch to Netlify: /devops:init

   Supported platforms: Netlify
   ```
   Then STOP.

3. Read CI/CD configuration:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get --key cicd
   ```

4. For Netlify, CI/CD is always "netlify" (managed builds).

### Step 2: Parse Build Arguments

Parse command arguments:
- `/devops:build` - Trigger default build (main branch)
- `/devops:build --branch dev` - Build specific branch
- `/devops:build --workflow deploy` - Trigger specific workflow
- `/devops:build --env staging` - Build for specific environment

### Step 3: Trigger Build

Trigger build via CLI based on platform:

**GitHub Actions**:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js build trigger \
  --platform github-actions \
  --branch "{branch}" \
  --workflow "{workflow}"
```

**Jenkins**:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js build trigger \
  --platform jenkins \
  --job "{job_name}" \
  --params "{parameters}"
```

**Netlify/Vercel** (managed):
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js build trigger \
  --platform netlify \
  --env "{environment}"
```

### Step 4: Display Build Information

Show build details:
```
✓ Build triggered successfully

Platform: {platform}
Branch: {branch}
Build ID: {build_id}
Status: {status}

🔗 Build URL: {build_url}
⏱️  Estimated time: {estimated_time}

💡 Monitor progress: /devops:build status --id {build_id}
```

### Step 5: Offer to Monitor Build

Ask: "Would you like to monitor the build progress?"
- If yes, run monitoring loop
- If no, done

If monitoring:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js build monitor --id {build_id}
```

Stream build status updates every 10 seconds:
```
🔄 Building... (30s elapsed)
📦 Running tests... (1m 15s elapsed)
✓ Build completed successfully! (2m 30s)

Artifacts:
- app.zip (15.2 MB)
- source-map.json (324 KB)

💡 Deploy now: /devops:deploy
```

### Step 6: Handle Build Failure

If build fails:
```
❌ Build failed

Error: {error_message}
Failed step: {failed_step}

📝 View full logs: /devops:logs --build {build_id}
🔗 Build URL: {build_url}
```

---

**Netlify Build System**:

Netlify provides fully managed builds:
- **Automatic builds** - Triggered on git push (if connected to repo)
- **Manual builds** - Can be triggered via this command
- **Deploy previews** - Automatic builds for pull requests
- **Build environment** - Ubuntu container with Node.js, Python, Ruby, Go, etc.

**How Netlify Builds Work**:
1. Detects project type (Next.js, React, Vue, static, etc.)
2. Installs dependencies (`npm install`, `yarn install`, etc.)
3. Runs build command (`npm run build`, `gatsby build`, etc.)
4. Optimizes assets (images, scripts, etc.)
5. Deploys to global CDN
6. Provides deploy preview URL

**Build Features**:
- ✓ Automatic dependency caching (faster builds)
- ✓ Build plugins (image optimization, form handling, etc.)
- ✓ Environment variables (injected at build time)
- ✓ Build hooks (trigger builds via webhook)
- ✓ Parallel builds (multiple environments)

**Note**: With Netlify, builds are typically triggered automatically when you deploy.
This command is useful for:
- Triggering manual builds without deploying
- Rebuilding with same code (e.g., if env vars changed)
- Building specific branch for preview

**IMPORTANT**:
- Netlify builds run in the cloud (not locally)
- Build logs available via `/devops:logs`
- Builds are free up to 300 minutes/month (Pro: 25,000 min/month)
- Successful builds are automatically deployed
