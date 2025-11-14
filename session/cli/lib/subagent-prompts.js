/**
 * Subagent prompt templates for session operations
 * Used by commands that invoke Task tool
 *
 * @module subagent-prompts
 */

/**
 * Consolidate conversation log subagent prompt
 * Reads conversation-log.jsonl, analyzes, creates snapshot, deletes log
 *
 * @param {string} sessionName - Session name
 * @param {string} pluginRoot - CLAUDE_PLUGIN_ROOT path
 * @returns {string} Prompt for Task tool
 */
function getConsolidationPrompt(sessionName, pluginRoot) {
  return `Session: ${sessionName}

Goal: Consolidate conversation log into auto-snapshot (if log exists)

Steps:
1. Check if file exists: .claude/sessions/${sessionName}/conversation-log.jsonl
2. If file does NOT exist:
   - Return JSON: { "skipped": true, "reason": "No conversation log found" }
   - STOP (do not proceed)

3. If file exists:
   - Read the conversation log file
   - Parse JSONL format (each line = JSON entry)
   - Extract:
     - type: "interaction" entries (user prompts)
     - type: "assistant_response" entries (Claude responses with response_text field)

4. Analyze the conversation:
   - Write 2-3 paragraph summary of what happened
   - Identify 2-4 key decisions with rationale
   - List completed tasks/todos
   - Document files modified with context (what changed and why)
   - Assess current state (what's done, what's next, blockers)

5. Create consolidated snapshot:
   Use this exact format:

   # Consolidated Snapshot: ${sessionName}
   **Timestamp**: [current ISO timestamp]
   **Method**: Claude Inline Analysis (Free)
   **Status**: Consolidated from conversation log

   ## Conversation Summary
   [2-3 paragraphs]

   ## Key Decisions
   - [Decision 1 with rationale]
   - [Decision 2 with rationale]

   ## Completed Tasks
   - [Task 1]
   - [Task 2]

   ## Files Modified
   - [file_path]: [what changed and why]

   ## Current State
   [Where things stand, what's next, blockers]

   ## Notes
   Consolidated via Claude inline analysis at session boundary.

6. Write snapshot via CLI:
   echo "[snapshot content from step 5]" | node ${pluginRoot}/cli/session-cli.js write-snapshot "${sessionName}" --stdin --type auto

7. Delete conversation log:
   rm .claude/sessions/${sessionName}/conversation-log.jsonl

8. Update state file:
   node ${pluginRoot}/cli/session-cli.js update-state "${sessionName}" --reset-counters --set-last-snapshot "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

Return Format:
JSON with these exact fields:
{
  "success": true,
  "snapshot_created": "[filename]",
  "timestamp": "[ISO timestamp]",
  "interaction_count": [number],
  "summary_preview": "[first 100 chars of summary]"
}

If any error occurs:
{
  "success": false,
  "error": "[error description]",
  "step_failed": "[which step number]"
}

IMPORTANT:
- Use exact CLI commands shown above
- Do NOT read transcript files (log is self-contained)
- Return ONLY JSON, no additional commentary
`;
}

/**
 * Git history refresh subagent prompt
 * Captures latest git commits, changes, and repository state
 *
 * @param {string} sessionName - Session name
 * @param {string} pluginRoot - CLAUDE_PLUGIN_ROOT path
 * @returns {string} Prompt for Task tool
 */
function getGitRefreshPrompt(sessionName, pluginRoot) {
  return `Session: ${sessionName}

Goal: Refresh git history context for session

Steps:
1. Run git history capture CLI:
   node ${pluginRoot}/cli/session-cli.js capture-git "${sessionName}"

2. The CLI will:
   - Get last 50 commits (git log)
   - Get uncommitted changes (git status, git diff)
   - Calculate file hotspots (frequently changed files)
   - Compress to ~2-3KB JSON
   - Write to: .claude/sessions/${sessionName}/git-history.json

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
`;
}

/**
 * Goal extraction subagent prompt
 * Reads session.md and extracts just the goal
 *
 * @param {string} sessionName - Session name
 * @returns {string} Prompt for Task tool
 */
function getGoalExtractionPrompt(sessionName) {
  return `Session: ${sessionName}

Goal: Extract session goal from session.md

Steps:
1. Read file: .claude/sessions/${sessionName}/session.md

2. Find the "## Goal" section header

3. Extract all text after "## Goal" until:
   - Next "##" header, OR
   - End of file

4. Clean the extracted text:
   - Trim whitespace
   - Remove leading/trailing newlines
   - Keep formatting (bullets, line breaks within goal)

Return Format:
JSON with these exact fields:
{
  "success": true,
  "goal": "[extracted goal text]"
}

If file not found or goal section missing:
{
  "success": false,
  "error": "[description]",
  "fallback_goal": "Session ${sessionName}"
}

IMPORTANT:
- Return ONLY the goal text, not entire file
- Preserve original formatting within goal
- Return ONLY JSON, no additional commentary
`;
}

module.exports = {
  getConsolidationPrompt,
  getGitRefreshPrompt,
  getGoalExtractionPrompt
};
