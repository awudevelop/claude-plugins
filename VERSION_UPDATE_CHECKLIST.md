# Version Update Checklist

**Purpose**: This file serves as a reference for updating version numbers across all documentation before deployment.

**Usage**: Before releasing a new version, use this checklist to ensure all files are updated consistently.

---

## 🎯 Current Version Tracking

**Latest Release**: `v3.7.1`
**Last Updated**: 2025-11-14
**Next Version**: `[TO BE DETERMINED]`

---

## 📋 Files Requiring Version Updates

### 1. Core Plugin Manifest

#### `session/plugin.json`
- **Line**: 3
- **Field**: `"version"`
- **Format**: `"X.Y.Z"` (e.g., `"3.7.1"`)
- **Also Update**: Line 4 - `"description"` field (include version number in description)
- **Example**: `"v3.7.1 - Brief description of what's new"`

---

### 2. Marketplace Configuration

#### `.claude-plugin/marketplace.json`
- **Line**: 17
- **Field**: `"version"` under `plugins[0]` (session plugin)
- **Format**: `"X.Y.Z"`
- **Line**: 18
- **Field**: `"description"` under `plugins[0]`
- **Format**: `"vX.Y.Z - Brief description"`
- **Note**: Keep synchronized with `session/plugin.json`

---

### 3. CLI Package

#### `session/cli/package.json`
- **Line**: 3
- **Field**: `"version"`
- **Format**: `"X.Y.Z"` (independent versioning, but update for compatibility)
- **Line**: 4
- **Field**: `"description"` - Mention compatibility with session plugin version
- **Example**: `"...with git history capture (v3.7.1 compatible)"`

---

### 4. Documentation Files

#### `README.md` (Root Marketplace README)

**Location 1 - Plugin Section Title**
- **Line**: ~51
- **Pattern**: `### Session Management (vX.Y.Z)`
- **Format**: `### Session Management (v3.7.1)`

**Location 2 - Plugin Description**
- **Line**: ~53
- **Update**: Main feature description to reflect latest capabilities

**Location 3 - Latest Features Section**
- **Line**: ~57
- **Pattern**: `**Latest Features (vX.Y.Z):**`
- **Update**: Bullet points with new features for this version

**Location 4 - Footer**
- **Line**: ~192
- **Pattern**: `**Latest Plugin:** Session Management vX.Y.Z`
- **Format**: `**Latest Plugin:** Session Management v3.7.1`

---

#### `session/README.md` (Session Plugin README)

**Location 1 - Header**
- **Line**: 3
- **Pattern**: `**Version X.Y.Z** - Brief description`
- **Format**: `**Version 3.7.1** - Subagent Reliability Hotfix (60%→95%)`

**Location 2 - Badge**
- **Line**: 8
- **Pattern**: `[![Version](https://img.shields.io/badge/version-X.Y.Z-blue.svg)]`
- **Format**: Update version in badge URL

**Location 3 - What's New Section**
- **Line**: ~12
- **Pattern**: `## 🚀 What's New in vX.Y.Z (Latest Update)`
- **Update**: Add new section for this version, keep previous versions below

**Location 4 - Footer**
- **Line**: ~882 (bottom of file)
- **Pattern**: `**Version**: X.Y.Z | **License**: MIT | **Status**: Production Ready 🚀`
- **Format**: `**Version**: 3.7.1 | **License**: MIT | **Status**: Production Ready 🚀`

---

### 5. Changelog

#### `session/CHANGELOG.md`

**Location**: Top of changelog (after header)
- **Line**: ~10
- **Pattern**: `## [X.Y.Z] - YYYY-MM-DD`
- **Action**: Add new version entry at the top with:
  - Version number
  - Release date
  - ### Fixed / ### Added / ### Changed sections
  - Detailed description of changes
  - Breaking changes (if any)
  - Migration notes (if needed)

**Format Example**:
```markdown
## [3.7.1] - 2025-11-14

### 🔧 Hotfix: Subagent Reliability

Brief summary of release.

### Fixed
- Item 1 with impact description
- Item 2 with impact description

### Changed
- Item 1
```

---

## 🔍 Version Validation Checklist

Before finalizing deployment, verify:

### Pre-Deployment Checks

- [ ] **Consistency Check**: All version numbers match across all files
- [ ] **CHANGELOG Updated**: New version entry added at the top
- [ ] **README Updated**: Both root and session READMEs reflect new version
- [ ] **Description Accuracy**: Version descriptions match actual changes
- [ ] **Badge Updated**: Version badge in session/README.md updated
- [ ] **Marketplace JSON**: Version and description synchronized with plugin.json
- [ ] **CLI Compatibility**: CLI package.json mentions compatibility with new version
- [ ] **Breaking Changes Documented**: If any, clearly noted in CHANGELOG
- [ ] **Migration Notes**: If needed, added to CHANGELOG and README

### Quick Validation Commands

Run these commands to verify version consistency:

```bash
# Check all version occurrences
grep -rn "\"version\":" session/plugin.json .claude-plugin/marketplace.json session/cli/package.json

# Check README headers
grep -n "Version 3\." session/README.md
grep -n "Session Management (v3\." README.md

# Check CHANGELOG latest entry
head -20 session/CHANGELOG.md

# Verify no old version references in descriptions
grep -rn "v3\.7\.0" README.md session/README.md .claude-plugin/marketplace.json
```

---

## 📝 Version Update Workflow

### Step 1: Determine Next Version

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (X.Y.0): New features, backward compatible
- **PATCH** (X.Y.Z): Bug fixes, backward compatible

**Current**: v3.7.1
**Next**: `[Decide based on changes]`

### Step 2: Update Core Files First

1. `session/plugin.json` - version and description
2. `.claude-plugin/marketplace.json` - version and description
3. `session/cli/package.json` - version (if CLI changed)

### Step 3: Update Documentation

4. `session/CHANGELOG.md` - Add new version entry at top
5. `session/README.md` - Update header, "What's New" section, footer
6. `README.md` - Update plugin title, features, footer

### Step 4: Validation

7. Run validation commands (see above)
8. Search for old version references
9. Verify descriptions are accurate
10. Check that all "Latest Features" reflect new version

### Step 5: Git Operations

```bash
# Stage all version updates
git add session/plugin.json .claude-plugin/marketplace.json session/cli/package.json
git add session/CHANGELOG.md session/README.md README.md

# Commit with conventional format
git commit -m "chore: Bump version to vX.Y.Z across all files"

# Tag the release
git tag -a vX.Y.Z -m "vX.Y.Z: Brief description"

# Push changes and tags
git push origin main
git push origin vX.Y.Z
```

---

## 🎯 Quick Reference Table

| File | Primary Location | Secondary Locations | Update Type |
|------|-----------------|-------------------|-------------|
| `session/plugin.json` | Line 3 (version) | Line 4 (description) | REQUIRED |
| `.claude-plugin/marketplace.json` | Line 17 (version) | Line 18 (description) | REQUIRED |
| `session/cli/package.json` | Line 3 (version) | Line 4 (description) | OPTIONAL |
| `session/CHANGELOG.md` | Top of file | New entry | REQUIRED |
| `session/README.md` | Line 3, Line 8, Line 12, Line 882 | Multiple sections | REQUIRED |
| `README.md` | Line 51, Line 57, Line 192 | Feature descriptions | REQUIRED |

---

## 🚨 Common Mistakes to Avoid

1. **Forgetting marketplace.json**: This is what users see in the plugin marketplace
2. **Inconsistent descriptions**: Ensure version descriptions match across all files
3. **Missing CHANGELOG entry**: Always document what changed
4. **Old version in footer**: Easy to miss the footer version in READMEs
5. **Badge not updated**: Version badge in session/README.md needs manual update
6. **Stale "Latest Features"**: Should reflect the new version, not previous
7. **Breaking changes not highlighted**: If present, must be clearly documented

---

## 📊 Version History Quick View

| Version | Release Date | Type | Key Changes |
|---------|--------------|------|-------------|
| v3.7.1 | 2025-11-14 | PATCH | Subagent reliability hotfix (60%→95%) |
| v3.7.0 | 2025-11-14 | MINOR | Parallel subagent architecture (72% token reduction) |
| v3.6.4 | 2025-11-13 | PATCH | Stop hook reliability improvements |
| v3.6.3 | 2025-11-13 | PATCH | Hybrid cleanup system, SessionEnd hook |
| v3.6.2 | 2025-11-13 | PATCH | Self-contained conversation logs |
| v3.6.1 | 2025-11-13 | PATCH | Full conversation capture fix |
| v3.6.0 | 2025-11-13 | MINOR | Automatic git history capture |
| v3.5.1 | 2025-11-13 | PATCH | Claude inline analysis default |
| v3.5.0 | 2025-11-13 | MINOR | Zero-blocking auto-snapshots |
| v3.0.0 | 2025-11-03 | MAJOR | CLI tool, plan mode support, 60-80% token reduction |

---

## 🔗 Related Files

- **Deployment Guide**: `IMPLEMENTATION_PLAN_TOKEN_OPTIMIZATION.md` (Phase 6)
- **Testing**: `docs/TESTING_GUIDE.md`
- **CLI Docs**: `session/cli/README.md`

---

## 📝 Notes for Claude

When asked to update versions:

1. **Read this file first** to understand all locations
2. **Ask for the next version number** if not specified
3. **Update all files in order** (Step 2 → Step 3)
4. **Run validation commands** to verify consistency
5. **Check for old version references** using grep
6. **Create a summary** of all changes made
7. **Remind user** about git tagging and pushing

**Search Pattern for Old Versions**:
```bash
# Replace X.Y.Z with old version
grep -rn "vX.Y.Z" --include="*.md" --include="*.json" .
```

---

**Last Updated**: 2025-11-14
**Maintained By**: AutomateWith.Us Team
**Version**: 1.0.0
