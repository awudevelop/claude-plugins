Session: {session_name}

Goal: Consolidate conversation log into auto-snapshot (if log exists)

Steps:
1. Check if file exists: .claude/sessions/{session_name}/conversation-log.jsonl
2. If file does NOT exist:
   - Return JSON: { "skipped": true, "reason": "No conversation log found" }
   - STOP (do not proceed)

3. If file exists:
   - Read the conversation log file
   - Parse JSONL format (each line = JSON entry)
   - Extract:
     - type: "interaction" entries (user prompts from user_prompt field)
     - type: "assistant_response" entries (Claude responses from response_text field)

4. Analyze the conversation:
   - Write 2-3 paragraph summary of what happened
   - Identify 2-4 key decisions with rationale
   - List completed tasks/todos
   - Document files modified with context (what changed and why)
   - Assess current state (what's done, what's next, blockers)

5. Create consolidated snapshot with this exact format (use heredoc):

cat <<'SNAPSHOT_EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
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
   rm .claude/sessions/{session_name}/conversation-log.jsonl

   # Verify deletion
   if [ -f .claude/sessions/{session_name}/conversation-log.jsonl ]; then
     echo '{"success": false, "error": "Failed to delete conversation log", "step_failed": 6}'
     exit 1
   fi

7. Update state file (with correct JSON syntax):
   TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-state "{session_name}" "{\"interactions_since_snapshot\": 0, \"interactions_since_context_update\": 0, \"last_snapshot_timestamp\": \"$TIMESTAMP\"}"

   if [ $? -ne 0 ]; then
     echo '{"success": false, "error": "Failed to update state file", "step_failed": 7}'
     exit 1
   fi

8. Verify all steps completed successfully:
   # Check snapshot exists
   if [ ! -f .claude/sessions/{session_name}/auto_*.md ]; then
     echo '{"success": false, "error": "Snapshot file not found", "step_failed": 5}'
     exit 1
   fi

   # Check log deleted
   if [ -f .claude/sessions/{session_name}/conversation-log.jsonl ]; then
     echo '{"success": false, "error": "Log file still exists", "step_failed": 6}'
     exit 1
   fi

   # Verify state reset
   STATE=$(node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js get-state "{session_name}")
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
