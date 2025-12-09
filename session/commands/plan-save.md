You are executing the /session:plan-save command to create a conceptual plan from the current session.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix.
- Correct: `/session:plan-save`, `/session:plan-status`, `/session:plan-finalize`
- Wrong: `/plan-save`, `/plan-status`, `/save-plan`

## Arguments

- `plan_name`: Required - the name of the plan (lowercase, hyphens, 1-50 chars)
- `--reference <file>`: Optional - reference file to include (can use multiple times)

ARGUMENTS: {name}

---

## Architecture: Hybrid Context Approach

This command uses THREE data sources for comprehensive requirement extraction:

1. **session.md** - Original goal + key milestones (handles multi-invocation sessions)
2. **Latest snapshot (auto_*.md)** - Historical context from previous invocations
3. **Your current context** - This conversation (already in your memory)

This hybrid approach ensures you capture:
- Historical decisions from past sessions
- Recent discussions from current session
- The evolution of requirements over time

---

## Step 1: Validate Session and Load Context

### 1a. Check Active Session

```bash
cat .claude/sessions/.active-session 2>/dev/null || echo "NO_SESSION"
```

If "NO_SESSION": Show error and suggest `/session:start` first. STOP.

Store the session name as `{session_name}`.

### 1b. Read Session Goal

Read the session file to get the baseline goal:

```
.claude/sessions/{session_name}/session.md
```

Extract:
- **Goal**: The text after `## Goal` header
- **Key Milestones**: Any `[x]` completed items under `## Key Milestones`
- **Files Involved**: List under `## Files Involved`

### 1c. Read Latest Snapshot (Historical Context)

Find the most recent snapshot:

```bash
ls -t .claude/sessions/{session_name}/auto_*.md 2>/dev/null | head -1
```

If found, read it and extract:
- **Topics Discussed**: From `## Topics Discussed` section
- **Decisions Made**: From `## Decisions Made` section
- **Tasks Completed**: From `## Tasks Completed` section
- **Current Status**: From `## Current Status` section

If no snapshot exists, that's OK - proceed with session.md + current context only.

---

## Step 2: Analyze and Merge (YOUR PRIMARY JOB)

Now synthesize requirements from all three sources:

### From session.md:
- The original goal (may have evolved)
- Key milestones achieved

### From latest snapshot:
- Decisions already made (preserve these)
- Tasks already completed (context for what's done)
- Topics discussed (scope of work)

### From your current context (THIS conversation):
- Recent discussions and decisions
- New requirements identified
- Clarifications and refinements
- Any changes to the original goal
- **CRITICAL: Implementation artifacts you designed** (see below)

---

## Step 2.5: Extract Implementation Suggestions (CRITICAL)

**This is the most important step.** During planning conversations, you likely:
- Designed API signatures and function interfaces
- Wrote code snippets or pseudo-code
- Discussed file structures and module organization
- Analyzed existing codebase patterns

**YOU MUST capture these as `suggestions` on each requirement.**

For EACH requirement, extract any implementation artifacts discussed:

| Artifact Type | What to Capture | Example |
|--------------|-----------------|---------|
| `api_designs` | Function/method signatures, RPC calls, endpoints | `getTables(schema): Promise<Table[]>` |
| `code_snippets` | Actual code or pseudo-code shown | SQL queries, regex patterns, algorithm logic |
| `file_structures` | Directory layouts, module organization | `cli/lib/connectors/supabase.js` |
| `implementation_patterns` | Patterns referenced from existing code | "Follow pattern in db-detector.js:detectMigrationDirs" |

**How to find suggestions in your context:**
1. Look for code blocks (```) you showed during discussion
2. Look for function signatures you proposed
3. Look for "like this" or "similar to" references
4. Look for SQL queries, regex patterns, algorithms discussed
5. Look for file paths you mentioned creating

**If you discussed implementation details but don't capture them as suggestions, the plan-finalize agent will have to RE-DISCOVER everything from scratch, wasting tokens.**

---

**YOUR TASK:** Merge these into a coherent set of requirements:

1. **Goal**: Use session.md goal as baseline, refine if current conversation evolved it
2. **Requirements**:
   - Tasks NOT yet completed → become requirements
   - New items from current discussion → add as requirements
   - Already completed tasks → note in metadata, not requirements
3. **Decisions**: Preserve all decisions from snapshot + add new ones from current context
4. **Discussion Notes**: Key context that helps understand requirements

---

## Step 3: Handle Reference Files (If Provided)

If user provided `--reference` files:

1. Read each file using the Read tool
2. Identify file type (OpenAPI, SQL, Prisma, etc.) from extension/content
3. Extract relevant items:
   - API specs → endpoints become requirements
   - SQL schemas → tables inform data requirements
   - Existing plans → inherit relevant requirements
4. Merge extracted items into your requirements list

Keep reference handling simple - no subagents needed. You can understand these files directly.

---

## Step 4: Build Requirements JSON

Format your analysis into this exact structure:

```json
{
  "plan_name": "{plan_name}",
  "plan_type": "conceptual",
  "goal": "The refined goal statement",
  "requirements": [
    {
      "id": "req-1",
      "description": "What needs to be done",
      "priority": "high|medium|low",
      "notes": "Additional context",
      "source": "session|snapshot|current|reference",
      "suggestions": {
        "api_designs": [
          {
            "name": "functionName",
            "signature": "async functionName(param: Type): Promise<ReturnType>",
            "purpose": "What it does",
            "example": "const result = await functionName(input)"
          }
        ],
        "code_snippets": [
          {
            "language": "javascript|sql|regex|etc",
            "code": "actual code or pseudo-code",
            "purpose": "what this code does",
            "context": "where/how to use it"
          }
        ],
        "file_structures": [
          {
            "path": "cli/lib/new-module.js",
            "type": "new|modify",
            "purpose": "what this file does"
          }
        ],
        "implementation_patterns": [
          {
            "reference": "existing-file.js:existingFunction",
            "pattern": "what pattern to follow",
            "adaptation": "how to adapt it"
          }
        ]
      }
    }
  ],
  "technical_decisions": [
    {
      "decision": "What was decided",
      "rationale": "Why this decision was made"
    }
  ],
  "user_decisions": [
    {
      "question": "What was asked",
      "answer": "User's response"
    }
  ],
  "discussion_notes": "Key context and background",
  "conversation_summary": "Brief summary of how we got here",
  "metadata": {
    "source_session": "{session_name}",
    "snapshot_used": "{snapshot_filename or null}",
    "created_at": "{ISO timestamp}"
  }
}
```

**Requirements ID Pattern**: Must be `req-1`, `req-2`, etc.

**Suggestions Field Rules:**
- `suggestions` object is REQUIRED on each requirement
- If no implementation details were discussed for a requirement, use empty arrays: `"api_designs": [], "code_snippets": [], ...`
- If you discussed ANY code, SQL, regex, function signatures, or patterns - CAPTURE THEM
- The finalize step will use these suggestions as the BASE for implementation specs
- Missing suggestions = wasted tokens during finalize (agent must rediscover from scratch)

---

## Step 5: Preview, Validate, and Save

### 5a. Show Preview

Display to user:
```
📋 Plan Preview: {plan_name}

Goal: {goal}

Requirements ({count}):
  1. [HIGH] {req-1-description}
     └─ Suggestions: {api_count} APIs, {code_count} snippets, {pattern_count} patterns
  2. [MED]  {req-2-description}
     └─ Suggestions: {api_count} APIs, {code_count} snippets, {pattern_count} patterns
  ...

Decisions ({count}):
  - {decision-1}
  - {decision-2}

Implementation Artifacts Captured:
  - API designs: {total_api_designs}
  - Code snippets: {total_code_snippets}
  - File structures: {total_file_structures}
  - Patterns: {total_patterns}

Sources:
  - Session: {session_name}
  - Snapshot: {snapshot_filename}
  - Current conversation: Yes

⚠️  If "Implementation Artifacts" shows all zeros but you discussed code/APIs,
    go back and add suggestions to requirements before saving!

Save this plan?
```

### 5b. Validate and Save

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js validate-requirements '{json}'
```

If validation fails, show errors and fix the JSON.

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js save-requirements {plan_name} '{json}'
```

### 5c. Success Message

```
Plan saved: {plan_name}

Location: .claude/plans/{plan_name}/requirements.json

Next steps:
  /session:plan-status {plan_name}    - View plan details
  /session:plan-finalize {plan_name}  - Convert to executable tasks
```

---

## Error Handling

- **No active session**: Suggest `/session:start {name}` first
- **No session.md**: Session might be corrupted, suggest rebuild
- **No snapshot**: OK, proceed with session.md + current context only
- **Validation fails**: Show specific errors, fix JSON, retry save

---

## Key Principles

1. **You have the context** - Don't spawn subagents to analyze what you already know
2. **Files supplement memory** - session.md and snapshots fill gaps from previous invocations
3. **Requirements = future work** - Completed tasks are context, not requirements
4. **Keep it simple** - No complex parsing, just semantic understanding
5. **Preserve decisions** - Historical decisions shouldn't be lost
6. **CAPTURE SUGGESTIONS** - Any code, SQL, regex, API signatures discussed MUST be in suggestions
7. **Suggestions save tokens** - What you capture here, finalize doesn't need to rediscover

---

## Token Efficiency

This approach uses ~3,000-5,000 tokens vs ~15,000-25,000 for the old approach:
- session.md: ~500 tokens
- Latest snapshot: ~2,000 tokens
- Current context: Already loaded (free)
- No subagent overhead
- No conversation-log.jsonl parsing

---

## Example: Good vs Bad Requirement

### ❌ BAD - No suggestions (forces rediscovery)

```json
{
  "id": "req-4",
  "description": "Create supabase.js connector using pg library to query information_schema",
  "priority": "high",
  "notes": "Use direct PostgreSQL connection",
  "source": "current",
  "suggestions": {
    "api_designs": [],
    "code_snippets": [],
    "file_structures": [],
    "implementation_patterns": []
  }
}
```

### ✅ GOOD - Captures implementation artifacts

```json
{
  "id": "req-4",
  "description": "Create supabase.js connector using pg library to query information_schema",
  "priority": "high",
  "notes": "Use direct PostgreSQL connection",
  "source": "current",
  "suggestions": {
    "api_designs": [
      {
        "name": "SupabaseConnector.getTables",
        "signature": "async getTables(schema = 'public'): Promise<TableInfo[]>",
        "purpose": "Query information_schema.tables for table list",
        "example": "const tables = await connector.getTables('public')"
      },
      {
        "name": "SupabaseConnector.getRLSPolicies",
        "signature": "async getRLSPolicies(tableName: string): Promise<Policy[]>",
        "purpose": "Query pg_policies for RLS policies",
        "example": "const policies = await connector.getRLSPolicies('users')"
      }
    ],
    "code_snippets": [
      {
        "language": "sql",
        "code": "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'",
        "purpose": "Query to get all user tables",
        "context": "Used in getTables() method"
      },
      {
        "language": "sql",
        "code": "SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr FROM pg_policy WHERE polrelid = $1::regclass",
        "purpose": "Query RLS policies for a table",
        "context": "Used in getRLSPolicies() method"
      }
    ],
    "file_structures": [
      {
        "path": "cli/lib/connectors/supabase-connector.js",
        "type": "new",
        "purpose": "PostgreSQL connector for Supabase introspection"
      }
    ],
    "implementation_patterns": [
      {
        "reference": "cli/lib/db-detector.js:detectMigrationDirs",
        "pattern": "Detection method pattern",
        "adaptation": "Use similar pattern for table detection"
      }
    ]
  }
}
```

**The GOOD example saves 5,000-10,000 tokens during plan-finalize because the agent doesn't need to rediscover SQL queries, method signatures, and patterns.**
