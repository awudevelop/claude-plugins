Session: {session_name}

**Absolute Paths** (use these exact paths):
- Session path: {session_path}
- Plugin root: ${CLAUDE_PLUGIN_ROOT}
- Working directory: {working_directory}

Goal: Refresh git history context for session

Steps:
1. Run git history capture CLI:
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js capture-git "{session_name}"

2. The CLI will:
   - Get last 50 commits (git log)
   - Get uncommitted changes (git status, git diff)
   - Calculate file hotspots (frequently changed files)
   - Compress to ~2-3KB JSON
   - Write to: {session_path}/git-history.json

3. If no git repository:
   - CLI returns: { success: false }
   - This is OK, just return the result

Return Format:
JSON with these exact fields:
{
  "success": true,
  "commits_analyzed": [number],
  "uncommitted_changes": [number],
  "file_hotspots_count": [number],
  "latest_commit_hash": "[hash]",
  "latest_commit_date": "[date]"
}

If no git repo or error:
{
  "success": false,
  "reason": "[why]"
}

IMPORTANT:
- Let CLI handle all git operations
- Do NOT run git commands manually
- Return ONLY JSON, no additional commentary
