# 🚀 Deployment Guide for AutomateWith.Us Claude Plugins

**How to deploy this plugin marketplace to GitHub and make it available to your team**

---

## Prerequisites

- GitHub account
- Git installed on your Mac
- Terminal access

---

## Step 1: Create GitHub Repository

### Option A: Via GitHub Website (Easiest)

1. Go to https://github.com/new
2. **Repository name:** `claude-plugins`
3. **Owner:** Select `automatewithus` organization (or create it first)
4. **Description:** "Production-ready Claude Code plugins for workflow automation"
5. **Visibility:** Public (recommended) or Private
6. **DO NOT** initialize with README, .gitignore, or license (we have these)
7. Click "Create repository"

### Option B: Via GitHub CLI

```bash
# If you have gh CLI installed
gh repo create automatewithus/claude-plugins --public --description "Production-ready Claude Code plugins for workflow automation"
```

---

## Step 2: Initialize Git and Push

Open Terminal and run these commands:

```bash
# Navigate to the plugin directory
cd ~/Desktop/automatewithus-claude-plugins

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Session Management plugin v2.1.0

- Add session auto-capture hooks with zero-latency tracking
- Add 8 session management commands
- Include comprehensive documentation
- Configure marketplace.json for plugin distribution"

# Add GitHub remote (replace with your actual repo URL)
git remote add origin https://github.com/automatewithus/claude-plugins.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Verify Deployment

1. Go to your GitHub repository: `https://github.com/automatewithus/claude-plugins`
2. Verify these files exist:
   - `.claude-plugin/marketplace.json` ✅
   - `session-management/plugin.json` ✅
   - `README.md` ✅
   - All hooks and commands ✅

---

## Step 4: Test Installation (Critical!)

Before sharing with your team, test it yourself:

### In Claude Code:

```bash
# Add your marketplace
/plugin marketplace add automatewithus/claude-plugins

# Verify it appears in the list
/plugin

# Install the session management plugin
/plugin install session-management

# Test a command
/session-status
```

### Expected Results:

✅ Marketplace adds successfully
✅ Plugin appears in `/plugin` list
✅ Installation completes without errors
✅ `/session-status` command works
✅ Hooks are active (check with a few interactions)

---

## Step 5: Share with Team

Once tested, share with your team:

### Via Slack/Email:

```
Hey team! 👋

We now have a Claude Code plugin marketplace for our standardized workflows.

**To install:**

1. In Claude Code, run:
   /plugin marketplace add automatewithus/claude-plugins

2. Then install the session management plugin:
   /plugin install session-management

This gives you automatic session snapshots and 8 new commands for managing your work sessions.

Questions? Check the docs: https://github.com/automatewithus/claude-plugins
```

### For Team Settings (Advanced):

If you want the plugin **automatically available** for the whole team, add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": [
    {
      "source": "github",
      "repo": "automatewithus/claude-plugins"
    }
  ],
  "enabledPlugins": [
    "session-management"
  ]
}
```

---

## Step 6: Maintenance & Updates

### Releasing Updates:

When you update plugins (new features, bug fixes):

```bash
# Make your changes
git add .
git commit -m "feat: Add new feature to session-management"

# Update version in marketplace.json and plugin.json
# Then push
git push
```

Users will need to reinstall to get updates:
```bash
/plugin uninstall session-management
/plugin install session-management
```

### Adding New Plugins:

1. Create new folder: `new-plugin-name/`
2. Add `plugin.json`, hooks, commands
3. Add entry to `.claude-plugin/marketplace.json`
4. Commit and push
5. Announce to team!

---

## Troubleshooting

### "Repository not found"

- Verify the repo is public, or team members have access
- Check the repo URL is correct
- Ensure `.claude-plugin/marketplace.json` exists at the root

### "Invalid marketplace format"

- Validate JSON syntax at https://jsonlint.com
- Check all required fields are present
- Verify plugin sources are correct paths

### Hooks not running

- Check `plugin.json` hook paths use `${CLAUDE_PLUGIN_ROOT}`
- Verify `.js` files are in the `hooks/` directory
- Ensure Node.js is installed on user's machine

### Commands not appearing

- Check `.md` files are in `commands/` directory
- Verify `commands` field in `plugin.json`
- Restart Claude Code after installation

---

## GitHub Repository Settings (Recommended)

### Add Topics (for discoverability):

Go to your GitHub repo → About → Settings → Add topics:
- `claude-code`
- `claude-plugins`
- `productivity`
- `automation`
- `workflow`
- `ai-tools`

### Enable Discussions:

Settings → Features → Check "Discussions"

This lets users ask questions and share tips!

### Add Repository Description:

"Production-ready Claude Code plugins for workflow automation and productivity. Built by AutomateWith.Us for non-technical founders and development teams."

---

## Security Considerations

### Plugin Permissions:

Plugins run with user permissions. They can:
- Read/write files in the project
- Execute shell commands
- Access environment variables

**Best Practices:**
- Only install plugins you trust
- Review code before installing (it's all visible!)
- Keep plugins updated
- Use version pinning for critical projects

### Private Plugins:

If you need private plugins:
1. Keep repo private
2. Team members need GitHub access
3. May need GitHub token for authentication
4. Same installation commands work

---

## Next Steps

Once deployed:

1. ✅ Test yourself thoroughly
2. ✅ Share with 1-2 team members for beta testing
3. ✅ Gather feedback and iterate
4. ✅ Announce to full team
5. ✅ Document any team-specific workflows
6. ✅ Plan future plugins

---

## Support

**Issues:** https://github.com/automatewithus/claude-plugins/issues
**Questions:** Create a GitHub Discussion
**Updates:** Watch the repo for new releases

---

**Deployed By:** [Your Name]
**Date:** [Today's Date]
**Status:** Ready for team deployment ✅
