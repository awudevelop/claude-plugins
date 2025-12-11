Session: {session_name}

**Absolute Paths** (use these exact paths):
- Session path: {session_path}
- Plugin root: ${CLAUDE_PLUGIN_ROOT}
- Working directory: {working_directory}

Goal: Consolidate conversation log into auto-snapshot (if log exists)

Steps:
1. Check if file exists: {session_path}/conversation-log.jsonl
   (Use the Read tool to attempt reading this absolute path)
2. If file does NOT exist:
   - Return JSON: { "skipped": true, "reason": "No conversation log found" }
   - STOP (do not proceed)

3. If file exists - Read in chunks to handle large files:

   **Step 3a: Count total lines**
   - Use Bash: wc -l {session_path}/conversation-log.jsonl
   - Extract line count from output

   **Step 3b: Read file in chunks if large**
   - If line count <= 2000: Read entire file normally
   - If line count > 2000: Read in chunks of 2000 lines
     - Chunk 1: Read with offset=0, limit=2000
     - Chunk 2: Read with offset=2000, limit=2000
     - Chunk 3: Read with offset=4000, limit=2000
     - Continue until all lines processed

   **Step 3c: Parse JSONL format (each line = JSON entry)**
   - Extract entries from all chunks (COMPACT FORMAT v3.8.9+):
     - Interaction entries (have "p" key = user prompt text)
     - Response entries (have "r" key = Claude's response text)
     - Timestamps: "ts" field = Unix timestamp in seconds (convert to date if needed)
     - File status codes: 1=Modified, 2=Added, 3=Deleted, 4=Renamed
     - Modified files: "f" = [[path, status_code], ...] array format

   **Step 3d: Aggregate across chunks**
   - Combine all topics from all chunks
   - Combine all suggestions from all chunks
   - Combine all decisions from all chunks
   - Combine all tasks from all chunks
   - Combine all file modifications from all chunks

4. ⚠️ CRITICAL INSTRUCTION - Analyze the ENTIRE conversation from beginning to end:

   **Anti-Recency Bias**: Do NOT focus only on recent messages. Topics from the start
   of the conversation are EQUALLY important as topics from the end. You MUST ensure
   comprehensive coverage of the complete timeline.

   - Extract ALL distinct topics discussed (enumerate each one, not just recent)
   - Extract ALL suggestions and recommendations given with rationale
   - Identify ALL key decisions made with rationale (no limit on count)
   - List ALL completed tasks/todos
   - Document ALL files modified with context (what changed and why)
   - Assess current state (progress, next steps, blockers)

   **Coverage Requirements**:
   - List topics in CHRONOLOGICAL order as they appeared
   - Do NOT skip topics that were discussed briefly
   - Do NOT merge related topics - list separately
   - Do NOT summarize - enumerate explicitly

5. Create consolidated snapshot with this exact format (use heredoc):

cat <<'SNAPSHOT_EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js write-snapshot "{session_name}" --stdin --type auto
# Consolidated Snapshot: {session_name}
**Timestamp**: [current ISO timestamp]
**Method**: Claude Inline Analysis (Free)
**Status**: Consolidated from conversation log
**Format Version**: 2.0

## Topics Discussed

1. **[Category]**: [Brief description of what was discussed]
2. **[Category]**: [Brief description of what was discussed]
3. **[Category]**: [Brief description of what was discussed]
[Continue for ALL topics in chronological order]

Examples of categories: Bug Fix, Feature, Architecture, Performance, Security,
Testing, Documentation, Configuration, Deployment, Question, Investigation

## Suggestions & Recommendations

1. **[Category]**: [Specific suggestion] - [Rationale for the suggestion]
2. **[Category]**: [Specific suggestion] - [Rationale for the suggestion]
3. **[Category]**: [Specific suggestion] - [Rationale for the suggestion]
[Continue for ALL suggestions given during conversation]

Format: Category (Architecture/Security/Performance/etc.) + Suggestion + Why

## Decisions Made

1. **[Decision]**: [Rationale and context for why this was decided]
2. **[Decision]**: [Rationale and context for why this was decided]
3. **[Decision]**: [Rationale and context for why this was decided]
[Continue for ALL decisions - no limit on count]

## Tasks Completed

1. [Action completed in past tense]
2. [Action completed in past tense]
3. [Action completed in past tense]
[Continue for ALL tasks completed during conversation]

## Files Modified

1. `[file_path]`: [What changed and why - be specific]
2. `[file_path]`: [What changed and why - be specific]
3. `[file_path]`: [What changed and why - be specific]
[Continue for ALL files modified]

## Current Status

- **Progress**: [1-2 sentences describing where things stand - what's been accomplished]
- **Next Steps**: [What should be done next - be specific]
- **Blockers**: [Any blocking issues preventing progress, or write "None"]

Do NOT use paragraphs. Use this exact 3-bullet structure.

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
   node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js update-state "{session_name}" "{\"interactions_since_snapshot\": 0, \"interactions_since_context_update\": 0, \"last_snapshot_timestamp\": \"$TIMESTAMP\"}"

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
  "log_deleted": true,
  "state_reset": true,
  "summary": {
    "topics": ["Topic 1 title", "Topic 2 title", ...],
    "decisions": ["Decision 1 title", "Decision 2 title", ...],
    "tasks": ["Task 1 description", "Task 2 description", ...],
    "status": {
      "progress": "[Progress text from Current Status section]",
      "nextSteps": "[Next Steps text from Current Status section]",
      "blockers": "[Blockers text from Current Status section]"
    }
  }
}

**IMPORTANT**: The `summary` field allows the main agent to display results without
re-reading the snapshot file. Extract TITLES ONLY (not full descriptions):
- topics: Just the **[Category]** part (e.g., "FE-First Architecture", "Market Research")
- decisions: Just the **[Decision]** part (e.g., "Use RBAC Model", "Composition Approach")
- tasks: Full task line (they're already short)
- status: Copy exact text from the 3 bullet points

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
