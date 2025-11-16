You are tasked with updating a plugin version. Run the intelligent version manager script to analyze changes, validate consistency, and update all version references across the project.

## Important Instructions

1. **Always validate first** - Check current version consistency before making changes
2. **Analyze git changes** - The script analyzes changes since the last version update using tracked commit baseline
3. **Update all files** - The script updates plugin.json (with versionMetadata), marketplace.json, package.json, and all README files automatically
4. **Track baseline** - Each update saves the current commit hash as a baseline for the next version bump
5. **CHANGELOG is manual** - You MUST remind the user to update CHANGELOG.md with the new version entry

## Key Features

### 📍 Baseline Commit Tracking
Each plugin.json now includes `versionMetadata` that tracks:
- **lastUpdateCommit** - Git commit hash when version was last bumped (used as baseline for next update)
- **lastUpdateDate** - ISO timestamp of the version update
- **lastBumpType** - Type of bump applied (major/minor/patch)

This allows the script to analyze exactly what changed since the last version update, providing:
- Accurate change summaries ("5 commits, 3 days ago")
- Better bump type detection (analyzes diffs from baseline, not just HEAD)
- Historical tracking of version progression

## Command Usage

The version manager script is located at `.claude/commands/lib/version-manager.js`

### Validation Only
To check if all versions are in sync without making changes:
```bash
node .claude/commands/lib/version-manager.js --validate
```

### Auto-detect and Update
To automatically detect the plugin, analyze changes, and update version:
```bash
node .claude/commands/lib/version-manager.js
```

### Force Specific Plugin
To update a specific plugin:
```bash
node .claude/commands/lib/version-manager.js --plugin=session
node .claude/commands/lib/version-manager.js --plugin=deployment
node .claude/commands/lib/version-manager.js --plugin=devops
```

### Override Bump Type
To force a specific version bump type:
```bash
node .claude/commands/lib/version-manager.js --force-patch
node .claude/commands/lib/version-manager.js --force-minor
node .claude/commands/lib/version-manager.js --force-major
```

### Combination Examples
```bash
# Validate session plugin specifically
node .claude/commands/lib/version-manager.js --plugin=session --validate

# Force minor version bump for devops plugin
node .claude/commands/lib/version-manager.js --plugin=devops --force-minor
```

## What the Script Does

### Validation Checks (Strict Mode)
- ✓ plugin.json version === marketplace.json version
- ✓ CLI package.json version matches (if exists)
- ✓ Description prefixes start with "vX.Y.Z - "
- ✓ Description version prefixes match actual version numbers
- ✓ README.md version headers match plugin.json
- ✓ Root README.md plugin sections have correct versions
- ✓ versionMetadata format validation (commit hash, date, bump type)

### Automatic Change Detection
The script analyzes git diffs **since the last version update** (using lastUpdateCommit baseline) to determine the appropriate version bump:

- **MAJOR (X.0.0)**: Breaking changes, removed features, incompatible API changes
  - Detected by: "BREAKING", "breaking change", removed exports/functions/classes

- **MINOR (X.Y.0)**: New features, new commands, new capabilities
  - Detected by: "feat:", "feature:", new exports/functions/classes, "new command"

- **PATCH (X.Y.Z)**: Bug fixes, documentation updates, refactoring
  - Default for: "fix:", docs changes, refactoring

### Files Updated Automatically
1. `{plugin}/plugin.json` - version, description prefix, **and versionMetadata**
2. `.claude-plugin/marketplace.json` - version and description prefix (evergreen)
3. `{plugin}/cli/package.json` - version (if file exists)
4. `{plugin}/README.md` - version header, badges, "What's New" sections
5. `README.md` (root) - plugin section version references

### versionMetadata Structure
Added to each plugin.json:
```json
{
  "version": "3.8.1",
  "description": "v3.8.1 - ...",
  "versionMetadata": {
    "lastUpdateCommit": "abc123...", // 40-char git commit hash
    "lastUpdateDate": "2025-11-16T10:30:00.000Z", // ISO 8601
    "lastBumpType": "patch" // major | minor | patch
  }
}
```

### Files You Must Update Manually
- `{plugin}/CHANGELOG.md` - Add new version entry with date and changes
- `VERSION_UPDATE_CHECKLIST.md` - Update current version tracking

## Workflow Steps

1. **Run validation first**
   ```bash
   node .claude/commands/lib/version-manager.js --validate
   ```
   If validation fails, the script will exit with detailed error messages showing what's out of sync.

2. **Run the update**
   ```bash
   node .claude/commands/lib/version-manager.js
   ```
   The script will:
   - Detect which plugin was modified (from git changes)
   - Load lastUpdateCommit baseline (if exists)
   - Show changes summary since last version ("5 commits, 3 days ago")
   - Analyze the type of changes from baseline (major/minor/patch)
   - Calculate the new version number
   - Save current commit as new baseline in versionMetadata
   - Update all JSON and Markdown files
   - Report all changes made

3. **Update CHANGELOG manually**
   Open `{plugin}/CHANGELOG.md` and add an entry like:
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### Fixed
   - Bug fix description

   ### Added
   - New feature description

   ### Changed
   - Improvement description
   ```

4. **Verify changes**
   ```bash
   git status
   git diff
   ```

5. **Commit the version bump**
   ```bash
   git add .
   git commit -m "chore: Bump {plugin} to vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z: Brief description"
   ```

## Error Handling

If validation fails, you'll see specific error messages like:
- `session: marketplace.json version (3.7.2) doesn't match plugin.json (3.8.0)`
- `devops: plugin.json description missing version prefix`
- `deployment: README.md version (1.0.0) doesn't match plugin.json (1.0.1)`

Fix these errors manually or use `--force` to skip validation (not recommended).

## Example Output

```
📋 Validating current version consistency...

✅ All version checks passed!

🎯 Updating plugin: session

📊 Changes since v3.8.0 (abc1234, 3 days ago):
   5 commits affecting session/

   session/hooks/session-start.js     | 12 ++++--------
   session/commands/continue.md        |  4 ++--
   2 files changed, 6 insertions(+), 10 deletions(-)

📈 Bump type: MINOR

🔄 Version: 3.8.0 → 3.9.0

📝 Changes made:

  ✓ session/plugin.json: 3.8.0 → 3.9.0 (baseline: def5678)
  ✓ .claude-plugin/marketplace.json: session 3.8.0 → 3.9.0
  ✓ session/README.md: Updated to v3.9.0
  ✓ README.md: Updated session to v3.9.0

✅ Version update complete!
📍 Baseline commit saved: def5678

⚠️  Next steps:
   1. Update CHANGELOG.md manually
   2. Review and commit changes
   3. Create git tag: git tag -a v3.9.0 -m "v3.9.0: description"
```

## Tips

- Always commit your work before running version updates
- Use `--validate` frequently to catch sync issues early
- Let the script auto-detect bump type unless you have a specific reason to override
- Remember: CHANGELOG updates are your responsibility
- The script uses strict validation - all versions must be in sync before bumping
