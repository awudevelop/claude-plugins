You are transforming conceptual plan requirements into executable implementation tasks with SKETCH FORMAT and CONFIDENCE SCORING.

## Key Changes in v3.0

1. **Sketch Format**: Tasks use pseudo-code sketches instead of structured JSON specs
2. **Confidence Scoring**: Each task is scored for implementation confidence
3. **Universal Format**: One sketch format works for all task types (functions, classes, tables, etc.)
4. **Project-Maps Integration**: Use codebase knowledge for informed decisions

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

### Step 1: SEARCH for Existing Implementation (MANDATORY)

Before creating any task from a suggestion, you MUST analyze the codebase using these commands:

**1. Search for similar function signatures:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps search signature "<function-name-pattern>"
```

**2. Search for files in the target directory:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps search file "<directory>/*.js"
```

**3. Get module exports to understand return type conventions:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps query exports <project-name>
```

**What to look for in results:**
- **Return type patterns**: Do existing functions return `{success, data}` objects or raw values?
- **Parameter conventions**: Are parameters typed? What naming patterns are used?
- **Error handling**: How do existing functions handle errors?
- **Async patterns**: Are similar functions async? Do they use try/catch?

**You MUST include findings in your sketch:**
- Add return type that matches similar functions
- Add `// Pattern: path/to/similar-file.js:existingFunction` comment

**If project-maps is unavailable**, use Grep/Read tools to analyze existing code patterns before generating sketches.

### Step 2: EVALUATE the Suggestion

Compare suggestion against codebase findings:
- Does a similar function already exist? (Check project-maps results)
- Is the suggested signature compatible with existing patterns?
- Does the code snippet follow codebase conventions (return types, error handling)?

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

## Task Structure (v3.0 - Sketch Format)

```json
{
  "id": "task-1-1",
  "type": "create_function",
  "file": "src/auth/permissions.ts",
  "description": "Implement can() permission checking method",
  "from_requirement": "req-1",
  "from_suggestion": {
    "type": "api_designs",
    "index": 0,
    "summary": "authHub.can(permission, context?) -> Promise<boolean>"
  },
  "confidence": {
    "level": "high",
    "score": 85,
    "factors": {
      "has_example": true,
      "known_pattern": true,
      "domain_expertise": true,
      "docs_available": false,
      "project_convention": true
    },
    "risks": [],
    "mitigations": []
  },
  "sketch": "export async function can(permission: string, context?: { tenantId?: string, productId?: string }): Promise<boolean>\n  // Get context from parameter or contextStore\n  // Call check_user_permissions RPC with permission and context\n  // Return boolean result\n  // Throws: AuthError on RPC failure\n  // Pattern: src/api/users.ts:getUser",
  "verification": {
    "search_patterns": ["check.*permission", "hasPermission", "canAccess"],
    "search_locations": ["src/", "lib/", "hooks/"],
    "existing_found": null
  },
  "implementation_decision": {
    "decision": "use_suggestion",
    "rationale": "No existing implementation found. Suggestion is based on analysis of check_user_permissions RPC."
  },
  "depends_on": []
}
```

## Universal Sketch Format (v3.0)

**IMPORTANT:** Instead of type-specific JSON specs, use a universal `sketch` field containing pseudo-code.

The sketch is a **pseudo-code representation** that shows:
- Signatures with types (params, returns)
- Structure (methods, properties, columns)
- Behavior (inline comments)

### Why Sketch?
- **Universal**: One format works for functions, classes, interfaces, hooks, tables, etc.
- **Naturally complete**: You can't write a signature without params/returns
- **Clear to implementor**: Shows exactly what to write
- **Prevents incomplete specs**: No more `"methods": ["name1", "name2"]` without definitions

### Sketch Examples

**Function:**
```
export async function validateToken(token: string, options?: ValidateOptions): Promise<TokenPayload | null>
  // Decode JWT token
  // Verify signature against secret
  // Check expiration
  // Return payload or null if invalid
  // Throws: InvalidSignatureError, ExpiredTokenError
```

**Class:**
```
export class MapDiffer {
  constructor(config: DiffConfig)
    // Initialize with diff configuration

  compareMetadata(oldMap: object, newMap: object): DiffResult
    // Compare metadata sections
    // Return { added, removed, changed }

  async compareDependencies(oldDeps: Deps, newDeps: Deps): Promise<DepDiff>
    // Compare dependency lists
    // Handle version comparisons

  static fromSnapshot(path: string): MapDiffer
    // Factory method
}
```

**Interface:**
```
export interface DiffResult {
  added: string[]
  removed: string[]
  changed: ChangedItem[]
  metadata?: DiffMetadata
}
```

**React Hook:**
```
export function useAuth(config?: AuthConfig): AuthState
  // State: user, loading, error

  // Effect: Subscribe to auth changes on mount
  //   - onAuthStateChanged callback
  //   - Cleanup: unsubscribe

  // login(email: string, password: string): Promise<void>
  //   - Sign in with credentials

  // logout(): Promise<void>
  //   - Sign out user

  // Returns: { user, loading, error, login, logout }
```

**Database Table:**
```
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(role_id, resource, action)
);

CREATE INDEX idx_permissions_role ON permissions(role_id);
```

**File Modification:**
```
// File: src/auth/index.ts
// Action: Add exports

+ export { validateToken } from './validate-token'
+ export { refreshToken } from './refresh-token'
+ export type { TokenPayload, ValidateOptions } from './types'
```

---

## Confidence Scoring

For each task, calculate a confidence score based on these factors:

### Scoring Weights
- **has_example** (+30): Similar code exists in project
- **known_pattern** (+25): Task follows a standard pattern type
- **domain_expertise** (+20): No special expertise needed (crypto, GPU, etc.)
- **docs_available** (+15): Documentation is provided or available
- **project_convention** (+10): File location matches project structure

### Confidence Levels
- **high** (70-100): Safe to execute automatically
- **medium** (40-69): May need minor adjustments
- **low** (0-39): Requires review, may need human intervention

### IMPORTANT: Markdown/Prose Files Are HIGH Confidence

Files like `.md`, prompts, and command templates are NOT low confidence:
- Markdown is a native format for Claude
- Section-based editing is a known pattern
- No domain expertise required

**Markdown task confidence**: 30 + 25 + 20 + 10 = 85 (HIGH)

Use `review.recommended: true` instead of low confidence for prose files.

### Domain Keywords That Lower Confidence

If task contains these keywords, mark `domain_expertise: false`:
- Crypto: encrypt, decrypt, hash, cipher, jwt, oauth
- Low-level: cuda, gpu, simd, assembly, kernel, driver
- Domain: quantum, blockchain, ml, neural, trading, medical
- Infra: kubernetes, terraform, ansible, nginx

### For LOW Confidence Tasks

Include detailed information:
```json
{
  "confidence": {
    "level": "low",
    "score": 25,
    "factors": {
      "has_example": false,
      "known_pattern": false,
      "domain_expertise": false,
      "docs_available": false,
      "project_convention": true
    },
    "risks": [
      "CUDA kernel programming requires specialized expertise",
      "No similar GPU code in project to reference"
    ],
    "mitigations": [
      "Add NVIDIA CUDA documentation with --docs",
      "Provide example kernel implementation"
    ]
  },
  "review": {
    "required": true,
    "reason": "GPU programming expertise required",
    "focus_areas": ["Memory management", "Kernel launch parameters"]
  }
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

## Output Format (v3.0)

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
          "type": "create_function",
          "file": "src/auth/permissions.ts",
          "description": "Concise task description (40-60 chars)",
          "from_requirement": "req-1",
          "from_suggestion": {
            "type": "api_designs|code_snippets|file_structures|ui_components|implementation_patterns",
            "index": 0,
            "summary": "Brief description of the suggestion"
          },
          "confidence": {
            "level": "high|medium|low",
            "score": 85,
            "factors": {
              "has_example": true,
              "known_pattern": true,
              "domain_expertise": true,
              "docs_available": false,
              "project_convention": true
            },
            "risks": [],
            "mitigations": []
          },
          "sketch": "export async function can(permission: string): Promise<boolean>\n  // Check user permission via Supabase RPC\n  // Return true/false",
          "verification": {
            "search_patterns": ["pattern1", "pattern2"],
            "search_locations": ["src/", "lib/"],
            "existing_found": null
          },
          "implementation_decision": {
            "decision": "use_suggestion|adapt|extend|skip|resolve_conflict",
            "rationale": "Why this decision was made"
          },
          "depends_on": []
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1", "task-2-1"],
    "req-2": ["task-1-2", "task-2-2"]
  },
  "suggestion_usage": {
    "used_as_is": ["req-1.suggestions.api_designs[0]"],
    "adapted": ["req-1.suggestions.file_structures[0]"],
    "skipped_existing": [],
    "conflicts_resolved": []
  },
  "confidence_summary": {
    "total_tasks": 15,
    "high": 10,
    "medium": 4,
    "low": 1,
    "average_score": 72,
    "low_confidence_tasks": [
      {
        "task_id": "task-3-2",
        "score": 25,
        "risks": ["Domain expertise required"]
      }
    ]
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
