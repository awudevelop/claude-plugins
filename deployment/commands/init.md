You are managing a deployment configuration system. The user wants to initialize deployment settings for their project.

## Task: Initialize Deployment Configuration

This command sets up deployment configuration for the project. This is a one-time setup.

### Step 1: Check for Existing Configuration

Run the CLI to check if configuration already exists:

```bash
node deployment/cli/deploy-cli.js config 2>&1
```

If the output contains "Configuration not found", proceed to Step 2.

If configuration exists, show this error and STOP:
```
❌ Error: Deployment configuration already exists
📁 Location: .claude/deployment.config.json

💡 To view current config: Run node deployment/cli/deploy-cli.js config
💡 To modify: Edit .claude/deployment.config.json directly
```

### Step 2: Gather Configuration Details

Ask the user the following questions using AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "What is your main development branch?",
      "header": "Main Branch",
      "multiSelect": false,
      "options": [
        {"label": "main", "description": "Default branch named 'main'"},
        {"label": "master", "description": "Legacy default branch 'master'"},
        {"label": "develop", "description": "Use 'develop' as main branch"}
      ]
    },
    {
      "question": "What command should run to build your project?",
      "header": "Build Command",
      "multiSelect": false,
      "options": [
        {"label": "npm run build", "description": "Node.js project with npm"},
        {"label": "yarn build", "description": "Node.js project with yarn"},
        {"label": "pnpm build", "description": "Node.js project with pnpm"},
        {"label": "make build", "description": "Project with Makefile"}
      ]
    }
  ]
}
```

Store the user's answers for Step 3.

### Step 3: Create Configuration

Use the CLI to initialize the configuration with user's choices:

```bash
node deployment/cli/deploy-cli.js init --main-branch {user_main_branch} --build-command "{user_build_command}"
```

**Expected output**: JSON with success: true

If the command fails, show error and STOP:
```
❌ Error: Failed to initialize configuration
{error_message}

💡 Check that .claude/ directory is writable
```

### Step 4: Verify Configuration Created

Read the created configuration to verify:

```bash
node deployment/cli/deploy-cli.js config
```

Parse the JSON output and extract the environments.

### Step 5: Display Configuration Summary

Show the user what was configured:

```
✓ Deployment configuration initialized
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Location: .claude/deployment.config.json

📋 Configuration:
   Main Branch: {main_branch}
   Build Command: {build_command}

🌍 Environments configured:
   • dev (deploy_dev) ← {main_branch}
   • uat (deploy_uat) ← deploy_dev
   • prod (deploy_prod) ← deploy_uat

🔒 Safety Features:
   ✓ Uncommitted files check
   ✓ Branch validation
   ✓ Clean build requirement

💡 Next Steps:
   1. Review config: Edit .claude/deployment.config.json if needed
   2. Create deployment branches (see below)
   3. Deploy to dev: /deploy dev
```

### Step 6: Offer to Create Deployment Branches

Ask the user:

```
The following deployment branches need to exist in your repository:
  - deploy_dev
  - deploy_uat
  - deploy_prod

Would you like me to create these branches now?
```

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Create deployment branches?",
    "header": "Setup",
    "multiSelect": false,
    "options": [
      {"label": "Yes", "description": "Create all deployment branches from main"},
      {"label": "No", "description": "I'll create them manually later"}
    ]
  }]
}
```

If user selects "Yes":
```bash
git checkout {main_branch} && git pull origin {main_branch} && git checkout -b deploy_dev && git push -u origin deploy_dev && git checkout -b deploy_uat && git push -u origin deploy_uat && git checkout -b deploy_prod && git push -u origin deploy_prod && git checkout {main_branch}
```

Show success message:
```
✓ Deployment branches created successfully
  • deploy_dev
  • deploy_uat
  • deploy_prod

All branches have been pushed to origin.
You're ready to deploy!
```

If user selects "No":
```
💡 Remember to create these branches manually:
   git checkout {main_branch}
   git checkout -b deploy_dev && git push -u origin deploy_dev
   git checkout -b deploy_uat && git push -u origin deploy_uat
   git checkout -b deploy_prod && git push -u origin deploy_prod
```

---

**IMPORTANT:**
- Use CLI for all config operations (plan mode support)
- Validate user input before proceeding
- Provide clear next steps
- Make it interactive and user-friendly
