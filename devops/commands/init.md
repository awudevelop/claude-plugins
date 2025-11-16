# DevOps Plugin - Initialize Configuration

You are initializing DevOps configuration for a project.

## Task: Initialize DevOps Configuration

The user wants to set up DevOps automation for their project. Guide them through configuration setup.

### Step 1: Check for Existing Configuration

1. Check if `.devops/config.json` exists in the project root
2. If it exists:
   - Ask user: "DevOps configuration already exists. Do you want to overwrite it?"
   - If no, STOP
   - If yes, continue

### Step 2: Platform Information

**IMPORTANT**: This plugin currently supports **Netlify deployments only**.
AWS, GCP, Azure, and Vercel support is in development and will be added in future releases.

Show this message to the user:
```
📦 DevOps Plugin - Netlify Setup

This plugin currently supports Netlify deployments only.
Other platforms (AWS, GCP, Azure, Vercel) are in development.

Prerequisites:
✓ Netlify account (https://netlify.com)
✓ Netlify API token (https://app.netlify.com/user/applications)
✓ Compatible project (static sites, Next.js, React, Vue, etc.)
```

Use the AskUserQuestion tool to ask:

**Question 1**: "Ready to set up Netlify deployment?"
- Description: "Netlify provides automated builds and deployments for modern web projects"
- Options:
  - "Yes, set up Netlify"
  - "No, I'll wait for other platforms"
- Header: "Setup"
- Multi-select: false

If user selects "No, I'll wait for other platforms":
- Show: "Run /devops:init when you're ready to set up Netlify deployment. We'll notify you when AWS, GCP, Azure, and Vercel support is available."
- STOP

If user selects "Yes, set up Netlify":

**Question 2**: "How should secrets be managed?"
- Description: "Your Netlify API token will be stored securely"
- Options:
  - "Local encrypted storage (recommended - AES-256 encryption)"
  - "Manual (I'll provide via environment variables)"
- Header: "Secrets"
- Multi-select: false

**Auto-set values** (no user input needed):
- Platform: "netlify"
- CI/CD: "netlify" (Netlify provides managed builds)

### Step 3: Create Configuration

Use the CLI to create configuration with auto-set Netlify platform:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js init \
  --platform "netlify" \
  --cicd "netlify" \
  --secrets "{secrets_mode}"
```

The CLI will:
- Create `.devops/` directory
- Generate `config.json` with Netlify-specific settings
- Create `.devops/credentials.enc` (if local secrets mode)
- Generate `netlify-config.json` template
- Initialize deployment tracking

### Step 4: Display Success and Next Steps

Show:
```
✓ Netlify deployment configured successfully!

📁 Configuration: .devops/config.json
🎯 Platform: Netlify
🔧 CI/CD: Netlify (managed builds)
🔐 Secrets: {secrets_mode}

Next steps:
1. Configure your Netlify API token: /devops:secrets set
2. Deploy your application: /devops:deploy

💡 Useful commands:
  - View configuration: /devops:config
  - Check deployment status: /devops:status
  - View logs: /devops:logs
  - Rollback deployment: /devops:rollback
```

### Step 5: Offer to Configure Credentials

Ask: "Would you like to configure credentials now?"
- If yes, automatically run `/devops:secrets set`
- If no, done

---

**IMPORTANT**:
- Never commit `.devops/credentials.enc` to git (add to .gitignore)
- All CLI operations are zero-token (no Claude involvement)
- Configuration is stored locally in `.devops/` directory
