You are managing a deployment system. The user wants to deploy to an environment.

## Task: Deploy Application

Parse the environment from arguments: $ARGUMENTS
Expected format: /deploy [environment]
Valid environments: dev, uat, prod

### Step 1: Parse and Validate Environment

Extract the environment name from $ARGUMENTS.

If no environment provided, show error and STOP:
```
❌ Error: No environment specified

Usage: /deploy [environment]

Available environments:
  • dev   - Development environment (deploy_dev branch)
  • uat   - User Acceptance Testing (deploy_uat branch)
  • prod  - Production environment (deploy_prod branch)

Example: /deploy dev
```

### Step 2: Load Configuration

Run CLI to get configuration:

```bash
node deployment/cli/deploy-cli.js config
```

If configuration not found (error in output), show error and STOP:
```
❌ Error: Deployment not configured

💡 Run /deploy:init to set up deployment
```

Parse the JSON output and extract:
- mainBranch
- buildCommand
- environments.{env} configuration

If the requested environment doesn't exist in config, show available environments and STOP:
```
❌ Error: Unknown environment "{env}"

Available environments: {list from config}

💡 Edit .claude/deployment.config.json to add custom environments
```

### Step 3: Run Pre-Deployment Validation

Run CLI validation for the target environment:

```bash
node deployment/cli/deploy-cli.js validate --check-git --env {environment}
```

Parse the JSON output.

If `success: false`, show all errors and STOP:
```
🚫 Deployment blocked by safety checks:

{for each error:}
❌ {error.message}
   💡 Fix: {error.fix}

Please resolve these issues before deploying.
```

If warnings exist (success: true but warnings present), show warnings but continue:
```
⚠️ Warnings detected:
{for each warning:}
  • {warning.message}
    💡 {warning.fix}

Continuing with deployment...
```

### Step 4: Determine Source Branch

Based on environment configuration:
- If environment has `sourceBranch`: Use that branch
- If environment has `sourceEnvironment`: Use that environment's deployment branch

Example:
- dev: source is "main" (sourceBranch)
- uat: source is "deploy_dev" (from sourceEnvironment: "dev")
- prod: source is "deploy_uat" (from sourceEnvironment: "uat")

Store the source branch and deployment branch for later steps.

### Step 5: Run Build Validation

Show progress:
```
🔨 Running build validation...
   Command: {buildCommand}
```

Execute the build command:

```bash
{buildCommand}
```

Monitor the output.

**If build succeeds:**
```
✓ Build completed successfully
```
Proceed to Step 6.

**If build fails:**

Show the build errors:
```
❌ Build failed with errors:

{build_error_output}

What would you like to do?
```

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Build failed. How should we proceed?",
    "header": "Action",
    "multiSelect": false,
    "options": [
      {"label": "Show me the errors, I'll fix them", "description": "Stop deployment, let me fix manually"},
      {"label": "Try to auto-fix", "description": "Let Claude attempt to fix the errors"},
      {"label": "Cancel deployment", "description": "Stop the deployment process"}
    ]
  }]
}
```

- If "Show me" or "Cancel": STOP with guidance
- If "Try to auto-fix": Attempt to fix, then re-run build
  - If second build fails: STOP and ask user to fix manually

### Step 6: Checkout and Update Source Branch

Ensure we're on the correct source branch and it's up-to-date:

```bash
git fetch origin && git checkout {source_branch} && git pull origin {source_branch}
```

Verify the branch is clean and up-to-date.

### Step 7: Merge to Deployment Branch

Get the deployment branch from config: `environments.{env}.branch`

```bash
git checkout {deployment_branch} && git pull origin {deployment_branch} && git merge {source_branch} --no-ff -m "Deploy {source_branch} to {environment} environment"
```

**If merge conflicts occur:**

```
❌ Merge conflict detected

Conflicting files:
{list files from git status}

You need to resolve these conflicts manually:
1. The merge is in progress with conflicts
2. Resolve conflicts in the files listed above
3. Run: git add . && git commit
4. Then retry: /deploy {environment}

Aborting deployment.
```

Run: `git merge --abort`
STOP execution.

**If merge succeeds:**
```
✓ Merged {source_branch} → {deployment_branch}
```

### Step 8: Push to Trigger Deployment

Push the deployment branch to trigger Netlify auto-deploy:

```bash
git push origin {deployment_branch}
```

If push fails, show error:
```
❌ Push failed

{error output}

💡 Check your remote connection and permissions
```

STOP execution.

### Step 9: Display Success Message

Show deployment confirmation:

```
✓ Deployment initiated successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Environment: {environment}
📦 Branch: {deployment_branch}
🔗 Source: {source_branch}

📊 Netlify will now build and deploy automatically
   Check your Netlify dashboard for deployment status

💡 Next steps:
   {if dev}  → After testing, deploy to UAT: /deploy uat
   {if uat}  → After approval, deploy to prod: /deploy prod
   {if prod} → Monitor production for any issues

🔍 To check status: Visit your Netlify dashboard
```

---

**IMPORTANT:**
- Always validate before executing
- Show clear progress updates
- Handle errors gracefully with recovery options
- Enforce environment progression (dev → uat → prod)
- Never skip safety checks
