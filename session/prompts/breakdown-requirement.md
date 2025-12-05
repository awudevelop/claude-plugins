You are transforming conceptual plan requirements into executable implementation tasks.

## Input

You receive a requirements JSON object containing:
- `plan_name`: Name of the plan
- `plan_type`: Should be "conceptual"
- `goal`: High-level goal statement
- `requirements`: Array of requirement objects with:
  - `id`: Unique identifier (e.g., "req-1")
  - `description`: What needs to be accomplished
  - `notes`: Additional context and details
  - `priority`: high/medium/low
  - `open_questions`: Array of unresolved questions
  - `conversation_context`: Why this requirement exists
  - `suggestions`: **Implementation-ready artifacts (CRITICAL - see below)**
- `technical_decisions`: Decisions made during planning
- `user_decisions`: Explicit user choices from Q&A
- `discussion_notes`: Overall analysis and key decisions
- `conversation_summary`: Summary of the conversation
- `metadata`: Work type and complexity information

---

## CRITICAL: Using Suggestions

**Suggestions are NOT abstract ideas. They are implementation-ready designs informed by codebase analysis.**

During the planning conversation, Claude likely:
- Read actual codebase files
- Analyzed existing patterns and RPC functions
- Designed implementations that FIT the codebase
- Produced code snippets, API signatures, and structures

**You MUST follow this verification-first process for each suggestion:**

### Step 1: SEARCH for Existing Implementation

Before creating any task from a suggestion, check if similar functionality already exists:

```
VERIFICATION REQUIRED:
- Search for: [function/method names from suggestion]
- Search patterns: [regex patterns to find similar code]
- Search locations: [likely directories]
- Use project-maps if available
```

### Step 2: EVALUATE the Suggestion

Compare suggestion against codebase:
- Does a similar function already exist?
- Is the suggested signature compatible with existing patterns?
- Does the code snippet follow codebase conventions?

### Step 3: DECIDE Implementation Approach

| Scenario | Decision | Action |
|----------|----------|--------|
| Exact match exists | `skip` | Note as already implemented |
| Similar exists, compatible | `extend` | Extend/wrap existing implementation |
| Similar exists, incompatible | `resolve_conflict` | Document conflict, propose resolution |
| Not exists, suggestion valid | `use_suggestion` | **Use suggestion code/API as-is** |
| Not exists, needs adaptation | `adapt` | Adapt suggestion to match patterns |

### Step 4: Create Task with Verification Step

Every task derived from a suggestion MUST include:
1. A verification step (what to search before implementing)
2. Reference to the source suggestion
3. The implementation decision
4. Rationale for the decision

---

## Task Structure (Updated)

```json
{
  "id": "task-1-1",
  "description": "Implement can() permission checking method",
  "details": "...",
  "from_requirement": "req-1",
  "from_suggestion": {
    "type": "api_designs",
    "index": 0,
    "summary": "authHub.can(permission, context?) -> Promise<boolean>"
  },
  "verification": {
    "search_patterns": ["check.*permission", "hasPermission", "canAccess"],
    "search_locations": ["src/", "lib/", "hooks/"],
    "existing_found": null
  },
  "implementation_decision": {
    "decision": "use_suggestion",
    "rationale": "No existing implementation found. Suggestion is based on analysis of check_user_permissions RPC."
  },
  "estimated_time": "2h",
  "dependencies": []
}
```

---

## Guidelines

### 1. Task Granularity
- Each task should be completable in 1-4 hours
- Tasks must be specific and actionable (not vague)
- Include concrete details: file names, function names, specific operations

### 2. Phase Organization
- Group related tasks into logical phases
- Phases should have clear dependencies
- No limit on number of phases or tasks - be as detailed as needed

### 3. Suggestion Handling (CRITICAL)
- **DO NOT ignore suggestions** - they represent significant analysis work
- **DO NOT reinvent** what suggestions already provide
- **DO verify** suggestions against codebase before blindly using
- **DO use suggestion code** when verification confirms it's valid
- **DO adapt** suggestions only when codebase patterns differ

### 4. Technical Specificity
- Reference actual files, functions, and code structures
- When suggestion provides code, include it in task details
- When suggestion provides API signature, use it as the target

### 5. Dependencies and Order
- Tasks within a phase have a logical order
- Foundation tasks come before integration tasks
- Verification tasks can run in parallel

---

## Analysis Process

**Step 1: Catalog All Suggestions**
Before breaking down requirements, inventory all suggestions:
- List all api_designs across requirements
- List all code_snippets across requirements
- List all file_structures across requirements
- Note which suggestions relate to each other

**Step 2: Group by Implementation Area**
- Which suggestions affect the same files/modules?
- Which can be implemented together?
- Which have dependencies on each other?

**Step 3: Create Verification Tasks**
For each unique suggestion, create a verification step:
- What to search for in codebase
- What patterns indicate existing implementation
- How to determine if suggestion is valid

**Step 4: Create Implementation Tasks**
For each requirement + suggestion combination:
- Reference the specific suggestion being implemented
- Include the verification outcome expectation
- Provide implementation details (using suggestion code when valid)

**Step 5: Handle User Decisions**
Check `user_decisions` array for explicit choices:
- These override any conflicting suggestions
- Include user decision rationale in task details

---

## Output Format

Return ONLY valid JSON (no markdown, no explanations):

```json
{
  "implementation_goal": "Clear 1-2 sentence summary of what will be built",
  "phases": [
    {
      "id": "phase-1",
      "name": "Foundation Setup",
      "description": "Phase purpose and why it comes first",
      "tasks": [
        {
          "id": "task-1-1",
          "description": "Concise task description (40-60 chars)",
          "details": "Comprehensive implementation details including:\n- Files to create/modify\n- Functions/classes to add\n- Code from suggestion (if applicable)\n- Verification steps",
          "from_requirement": "req-1",
          "from_suggestion": {
            "type": "api_designs|code_snippets|file_structures|ui_components|implementation_patterns",
            "index": 0,
            "summary": "Brief description of the suggestion"
          },
          "verification": {
            "search_patterns": ["pattern1", "pattern2"],
            "search_locations": ["src/", "lib/"],
            "existing_found": null
          },
          "implementation_decision": {
            "decision": "use_suggestion|adapt|extend|skip|resolve_conflict",
            "rationale": "Why this decision was made"
          },
          "estimated_time": "2h",
          "dependencies": []
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1", "task-2-1"],
    "req-2": ["task-1-2", "task-2-2"]
  },
  "suggestion_usage": {
    "used_as_is": ["req-1.suggestions.api_designs[0]", "req-2.suggestions.code_snippets[0]"],
    "adapted": ["req-1.suggestions.file_structures[0]"],
    "skipped_existing": [],
    "conflicts_resolved": []
  },
  "assumptions": [
    "Assumption about codebase or approach"
  ],
  "risks": [
    "Potential challenge in implementation"
  ]
}
```

---

## Example with Suggestions

**Input:**
```json
{
  "plan_name": "auth-sdk",
  "goal": "Create authentication SDK with permission checking",
  "requirements": [
    {
      "id": "req-1",
      "description": "Permission checking method",
      "suggestions": {
        "api_designs": [
          {
            "method": "authHub.can",
            "signature": "can(permission: string, context?: { tenantId?, productId? }): Promise<boolean>",
            "example": "const canEdit = await authHub.can('sys:manage-user-role')",
            "source_context": "Based on existing check_user_permissions RPC"
          }
        ],
        "code_snippets": [
          {
            "language": "typescript",
            "code": "async can(permission: string, context?: Context): Promise<boolean> {\n  const ctx = context || this.contextStore.getContext();\n  const result = await this.supabase.rpc('check_user_permissions', {\n    p_permission: permission,\n    p_tenant_id: ctx.tenantId,\n    p_product_id: ctx.productId\n  });\n  return result.data ?? false;\n}",
            "purpose": "Permission check implementation using Supabase RPC",
            "source_context": "Designed based on existing RPC function signature"
          }
        ]
      }
    }
  ],
  "user_decisions": [
    {
      "question": "Should context persist to localStorage?",
      "answer": "yes",
      "implications": "ContextStore needs localStorage read/write"
    }
  ]
}
```

**Output:**
```json
{
  "implementation_goal": "Create authentication SDK with can() permission checking using existing Supabase RPC",
  "phases": [
    {
      "id": "phase-1",
      "name": "Permission Checking",
      "description": "Implement core permission checking functionality",
      "tasks": [
        {
          "id": "task-1-1",
          "description": "Implement can() permission checking method",
          "details": "VERIFICATION STEP:\n1. Search for existing permission checking in codebase\n   - Patterns: 'check.*permission', 'hasPermission', 'canAccess'\n   - Locations: src/, lib/, hooks/\n   - Check if check_user_permissions RPC exists in Supabase\n\nIMPLEMENTATION (if no existing found):\nUse suggestion code as-is - it was designed based on existing RPC:\n\n```typescript\nasync can(permission: string, context?: Context): Promise<boolean> {\n  const ctx = context || this.contextStore.getContext();\n  const result = await this.supabase.rpc('check_user_permissions', {\n    p_permission: permission,\n    p_tenant_id: ctx.tenantId,\n    p_product_id: ctx.productId\n  });\n  return result.data ?? false;\n}\n```\n\nFile: src/permissions/check.ts\nExport from main index.ts\n\nNote: User confirmed context should use localStorage (see user_decisions)",
          "from_requirement": "req-1",
          "from_suggestion": {
            "type": "code_snippets",
            "index": 0,
            "summary": "can() method using check_user_permissions RPC"
          },
          "verification": {
            "search_patterns": ["check.*permission", "hasPermission", "canAccess", "check_user_permissions"],
            "search_locations": ["src/", "lib/", "hooks/", "supabase/functions/"],
            "existing_found": null
          },
          "implementation_decision": {
            "decision": "use_suggestion",
            "rationale": "Suggestion is based on analysis of existing check_user_permissions RPC. Code is implementation-ready and follows codebase patterns."
          },
          "estimated_time": "1h",
          "dependencies": []
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1"]
  },
  "suggestion_usage": {
    "used_as_is": ["req-1.suggestions.code_snippets[0]"],
    "adapted": [],
    "skipped_existing": [],
    "conflicts_resolved": []
  },
  "assumptions": [
    "check_user_permissions RPC exists in Supabase with expected signature",
    "ContextStore class will be implemented separately for context management"
  ],
  "risks": [
    "RPC function signature may have changed since conversation analysis",
    "Need to verify Supabase client initialization pattern"
  ]
}
```

---

## Quality Checklist

Before returning, verify:

- [ ] Every requirement has at least one task
- [ ] All suggestions have been evaluated (not ignored)
- [ ] Tasks with suggestions include verification steps
- [ ] `from_suggestion` references are accurate
- [ ] `implementation_decision` is specified for each suggestion-based task
- [ ] `suggestion_usage` summary is complete
- [ ] User decisions from `user_decisions` are reflected in tasks
- [ ] Phase progression makes logical sense
- [ ] No vague or unclear task descriptions

---

## Begin Breakdown

Analyze the requirements below and return the structured implementation breakdown:

[REQUIREMENTS JSON INSERTED HERE]
