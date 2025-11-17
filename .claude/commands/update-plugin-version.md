You are tasked with updating a plugin version using an intelligent version manager.

## Configuration-Driven Approach

**Config file:** `.claude/commands/lib/version-update-config.json`

This JSON config contains:
- `s`: Script path
- `w`: Workflow steps (validate → update → manual CHANGELOG → commit)
- `f`: Files to update with rules
- `sd`: Static descriptions for marketplace.json (by plugin name)
- `np`: Negative prompts (critical warnings)
- `x`: Exclusions (what NOT to do)

## Execution Steps

1. **Read and parse** the config JSON file
2. **Execute workflow** (`w` array) in order:
   - Step 1: Validate (critical)
   - Step 2: Run update (auto-detects plugin from git diff)
   - Step 3: Manual update of CHANGELOG.md (YOU MUST DO THIS)
   - Step 4: Commit changes

3. **For marketplace.json updates:**
   - Use `sd[plugin_name]` for the static description
   - Only update version and description prefix: `"vX.Y.Z - {sd[plugin_name]}"`
   - Rule `x`: "NO_COPY_FROM_PLUGIN" - never copy description from plugin.json

4. **Check negative prompts** (`np`) before acting:
   - NO copy desc plugin→market
   - NO run uncommitted
   - NO skip val
   - NO forget CHANGELOG

## Commands

```bash
# Validate first (always)
node .claude/commands/lib/version-manager.js --validate

# Run update (auto-detects plugin and bump type)
node .claude/commands/lib/version-manager.js

# Optional: Force specific plugin or bump type
node .claude/commands/lib/version-manager.js --plugin=session --force-patch
```

## Critical Rules

- Script auto-updates: plugin.json, marketplace.json, package.json, READMEs
- YOU manually update: CHANGELOG.md (required - script cannot do this)
- marketplace.json description is STATIC - use config's `sd` values
- Commit your work before running (script uses git diff for auto-detection)
