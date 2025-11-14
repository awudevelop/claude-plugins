Session: {session_name}

Goal: Extract session goal from session.md

Steps:
1. Read file: .claude/sessions/{session_name}/session.md

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
  "fallback_goal": "Session {session_name}"
}

IMPORTANT:
- Return ONLY the goal text, not entire file
- Preserve original formatting within goal
- Return ONLY JSON, no additional commentary
