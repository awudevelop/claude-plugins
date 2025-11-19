Session: {session_name}

**Absolute Paths** (use these exact paths):
- Session path: {session_path}
- Plugin root: {plugin_root}
- Working directory: {working_directory}

Goal: Consolidate conversation log into auto-snapshot (if log exists)

Steps:
1. Check if file exists: {session_path}/conversation-log.jsonl
   (Use the Read tool to attempt reading this absolute path)
2. If file does NOT exist:
   - Return JSON: { "skipped": true, "reason": "No conversation log found" }
   - STOP (do not proceed)

3. If file exists:
   - Read the conversation log file
   - Parse JSONL format (each line = JSON entry)
   - Extract entries (COMPACT FORMAT v3.8.9+):
     - Interaction entries (have "p" key = user prompt text)
     - Response entries (have "r" key = Claude's response text)
     - Timestamps: "ts" field = Unix timestamp in seconds (convert to date if needed)
     - File status codes: 1=Modified, 2=Added, 3=Deleted, 4=Renamed
     - Modified files: "f" = [[path, status_code], ...] array format

4. Analyze the conversation:
   - Write 2-3 paragraph summary of what happened
   - Identify 2-4 key decisions with rationale
   - List completed tasks/todos
   - Document files modified with context (what changed and why)
   - Assess current state (what's done, what's next, blockers)

5. Create consolidated snapshot with this exact format (use heredoc):

cat <<'SNAPSHOT_EOF' | node {plugin_root}/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
# Consolidated Snapshot: {session_name}
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
SNAPSHOT_EOF

6. Delete conversation log (with error checking):
   set -e  # Exit on any error
   rm {session_path}/conversation-log.jsonl

   # Verify deletion
   if [ -f {session_path}/conversation-log.jsonl ]; then
     echo '{"success": false, "error": "Failed to delete conversation log", "step_failed": 6}'
     exit 1
   fi

7. Update state file (with correct JSON syntax):
   TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
   node {plugin_root}/cli/session-cli.js update-state "{session_name}" "{\"interactions_since_snapshot\": 0, \"interactions_since_context_update\": 0, \"last_snapshot_timestamp\": \"$TIMESTAMP\"}"

   if [ $? -ne 0 ]; then
     echo '{"success": false, "error": "Failed to update state file", "step_failed": 7}'
     exit 1
   fi

8. Verify all steps completed successfully:
   # Check snapshot exists (use Glob tool to find auto_*.md files in session path)
   # If using bash: if [ ! -f {session_path}/auto_*.md ]; then

   # Check log deleted
   if [ -f {session_path}/conversation-log.jsonl ]; then
     echo '{"success": false, "error": "Log file still exists", "step_failed": 6}'
     exit 1
   fi

   # Verify state reset
   STATE=$(node {plugin_root}/cli/session-cli.js get-state "{session_name}")
   if ! echo "$STATE" | grep -q '"interactions_since_snapshot":0'; then
     echo '{"success": false, "error": "State counters not reset", "step_failed": 7}'
     exit 1
   fi

Return Format:
JSON with these exact fields (ONLY after all verifications pass):
{
  "success": true,
  "snapshot_created": "[filename]",
  "timestamp": "[ISO timestamp]",
  "interaction_count": [number],
  "summary_preview": "[first 100 chars of summary]",
  "log_deleted": true,
  "state_reset": true
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
- Use set -e to halt on errors
- Verify ALL steps before returning success
- Return ONLY JSON, no additional commentary
