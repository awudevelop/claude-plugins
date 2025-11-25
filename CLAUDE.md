# Claude Plugins Project

## 🚨 CRITICAL DIRECTORY BOUNDARIES - READ FIRST

### ❌ NEVER MODIFY THESE DIRECTORIES

**MARKETPLACE DIRECTORY - ABSOLUTELY FORBIDDEN:**
```
/Users/prajyot/.claude/plugins/marketplaces/automatewithus-plugins/
```

**Why:**
- This is the plugin marketplace installation directory
- Managed by the plugin system, NOT by development
- Any changes here will be OVERWRITTEN on plugin updates
- Development happens in the main repo, NOT marketplace

**If you need to modify plugin code:**
1. ✅ Make changes in `/Users/prajyot/Documents/Work/Matt/claude-plugins/`
2. ✅ Test and commit in main repo
3. ✅ Use the deployment/release process to update marketplace
4. ❌ NEVER directly edit files in `.claude/plugins/marketplaces/`

### ✅ SAFE TO MODIFY

**Main Development Directory:**
```
/Users/prajyot/Documents/Work/Matt/claude-plugins/
```

All development work happens here:
- `session/` - Session management plugin
- `devops/` - DevOps automation plugin
- `deployment/` - Deployment utilities

## 🔧 Required Environment Variables

### CLAUDE_PLUGIN_ROOT

**Purpose:** Points to the session plugin source directory for command execution.

**Value (Development):**
```bash
export CLAUDE_PLUGIN_ROOT="/Users/prajyot/Documents/Work/Matt/claude-plugins/session"
```

**Why it's needed:**
- Plugin command templates use `${CLAUDE_PLUGIN_ROOT}` to reference CLI scripts
- Ensures commands always run from SOURCE repo, never marketplace
- Prevents the "wrong repository" mistake

**Setup:**

Option 1 - Add to your shell profile (~/.zshrc or ~/.bashrc):
```bash
echo 'export CLAUDE_PLUGIN_ROOT="/Users/prajyot/Documents/Work/Matt/claude-plugins/session"' >> ~/.zshrc
source ~/.zshrc
```

Option 2 - Set per-session (temporary):
```bash
export CLAUDE_PLUGIN_ROOT="/Users/prajyot/Documents/Work/Matt/claude-plugins/session"
```

**Verify it's set:**
```bash
echo $CLAUDE_PLUGIN_ROOT
# Should output: /Users/prajyot/Documents/Work/Matt/claude-plugins/session
```

**For production/users:** This variable would point to the marketplace installation instead.

## Project Structure

```
claude-plugins/
├── session/           # Session management plugin
│   ├── cli/          # CLI commands and utilities
│   ├── commands/     # Slash command templates
│   ├── prompts/      # Prompt templates for agents
│   └── tests/        # Test suites
├── devops/           # DevOps automation plugin
├── deployment/       # Deployment configuration
└── .claude/          # Claude Code configuration
    ├── commands/     # Custom slash commands
    └── settings.json # Project settings
```

## Development Workflow

### Making Changes
1. Always work in `/Users/prajyot/Documents/Work/Matt/claude-plugins/`
2. Edit files in the appropriate plugin directory
3. Test changes thoroughly
4. Commit to git in main repo
5. Use version management for releases

### Version Updates

## 🚨 CRITICAL: NEVER UPDATE VERSIONS MANUALLY

**ALWAYS use the `/update-plugin-version` slash command to update plugin versions.**

```bash
/update-plugin-version {plugin} {version} "{changelog message}"
```

Example:
```bash
/update-plugin-version session 3.15.6 "fix: Handle skipped phases correctly in progress calculation"
```

**Why this is critical:**
- The command updates ALL version references in sync (plugin.json, README.md, CHANGELOG.md)
- It updates the plugin description with recent changelog entries
- It updates versionMetadata with commit hash and timestamp
- Manual updates WILL cause version mismatches and break the plugin system

**NEVER do this:**
- ❌ Manually edit version numbers in plugin.json
- ❌ Manually edit version numbers in README.md
- ❌ Manually add CHANGELOG entries without using the command
- ❌ Create "chore: Bump version" commits manually

**The /update-plugin-version command handles everything. Use it. Always.**

### Never Do This
- ❌ Edit files in `/Users/prajyot/.claude/plugins/marketplaces/`
- ❌ Make commits in marketplace repo
- ❌ Read from marketplace repo when looking for code
- ❌ Use marketplace paths in any tool calls

## Tech Stack

- **Runtime:** Node.js 24.x
- **Package Manager:** npm
- **Version Control:** Git
- **CLI Framework:** Custom (session-cli.js, devops-cli.js)
- **Testing:** Jest (for CLI tools)

## Important Files

- `VERSION_UPDATE_CHECKLIST.md` - Release process guide
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `session/CHANGELOG.md` - Session plugin changelog
- `session/README.md` - Session plugin documentation

## Code Conventions

- Use async/await for asynchronous operations
- Follow existing error handling patterns
- Validate inputs at CLI boundaries
- Write comprehensive commit messages
- Include test coverage for new features

## Testing

```bash
# Run session plugin tests
npm test

# Run specific test file
npm test -- tests/specific-test.js
```

## Git Workflow

- **Main branch:** `main`
- Commit format: Follow conventional commits
- Always include co-author attribution for Claude-generated code
- Use `/update-plugin-version` for version bumps (auto-commits)

## Remember

**The marketplace directory is READ-ONLY. Never make changes there. Ever.**
