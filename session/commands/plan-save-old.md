You are executing the /session:save-plan command to create a conceptual plan from the current conversation.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- ✅ Correct: `/session:plan-execute`, `/session:plan-status`, `/session:plan-finalize`, `/session:plan-list`, `/session:save-plan`
- ❌ Wrong: `/plan-execute`, `/plan-status`, `/plan-show`, `/plan-list`, `/save-plan`
Use ONLY the exact command formats specified in this template.

## Arguments

Parsed from user input:
- `plan_name`: First argument (required) - the name of the plan
- `custom_instructions`: Everything after the plan name (optional) - custom guidance for plan extraction

**Syntax Options:**
```bash
# Basic - just plan name
/session:plan-save my-plan

# With custom instructions (freeform text after name)
/session:plan-save my-plan Focus on API design, ignore UI components

# With --prompt flag
/session:plan-save my-plan --prompt "Focus on backend, exclude frontend"

# Single reference file (backward compat)
/session:plan-save my-plan --reference schema.prisma

# Multiple references (array syntax)
/session:plan-save my-plan --reference [api.yaml, schema.sql, types.ts]

# Paths with spaces (use quotes)
/session:plan-save my-plan --reference ["docs/api spec.yaml", src/schema.prisma]

# Reference entire folder (ends with /)
/session:plan-save my-plan --reference [src/models/]

# Mixed: files + folders
/session:plan-save my-plan --reference [api.yaml, "my docs/", src/types/]

# Combined with other instructions
/session:plan-save my-plan --prompt "Backend only" --reference [schema.prisma, api.yaml]
```

**Custom Instruction Types:**
- **Focus areas**: "Focus on X" - prioritize specific topics
- **Exclusions**: "Exclude X" or "Ignore X" or "Do NOT include X" - skip certain areas
- **References**: `--reference [file1, file2, folder/]` - array of files/folders (max 10)
- **Scope**: "Only last N messages" or "From timestamp X" - limit conversation scope
- **Format**: "Minimal format" or "Detailed" - control output verbosity
- **Negative prompts**: "Do NOT..." - explicit things to avoid

ARGUMENTS: {name} {instructions}

## Workflow

### Step 0: Parse Custom Instructions

If `{instructions}` is not empty, parse it for:

1. **Reference files** - Parse `--reference` or `--ref` with array or single value:

   **Array syntax** (preferred for multiple):
   ```
   --reference [file1.json, file2.sql, folder/]
   --ref ["path with spaces/file.json", another.yaml]
   ```

   **Single file** (backward compatible):
   ```
   --reference schema.prisma
   --ref api.yaml
   ```

   **Parsing rules:**
   - If `[...]` found after `--reference`: extract contents, split by `,`
   - For each item: trim whitespace, remove surrounding quotes if present
   - If no brackets: treat as single file path
   - Store all paths in `{reference_paths}` array
   - **Max 10 references** (error if exceeded after folder expansion)

   **Quoted paths** (for spaces):
   ```
   --reference ["docs/api spec.yaml", "my folder/schema.sql"]
   ```
   - Quotes (single or double) preserve spaces in path
   - Remove quotes after parsing

   **Folder paths** (end with `/`):
   ```
   --reference [src/models/, docs/specs/]
   ```
   - Paths ending with `/` are marked as folders
   - Will be expanded in Step 0.5

2. **Focus areas** - Extract phrases like "Focus on X", "Prioritize X", "Only X":
   - Store as `{focus_areas}` list

3. **Exclusions** - Extract phrases like "Exclude X", "Ignore X", "Do NOT include X", "--exclude X":
   - Store as `{exclusions}` list

4. **Scope limits** - Look for "last N messages", "since <date>", "only recent":
   - Store as `{scope_limit}` for conversation filtering

5. **Format preferences** - Look for "minimal", "detailed", "brief", "comprehensive":
   - Store as `{format_preference}`

6. **Raw instructions** - Keep the full `{instructions}` text for subagent interpretation

**Example parsing:**
```
Input: "Focus on API, --reference [schema.prisma, "docs/api spec.yaml", src/models/]"

Parsed:
  focus_areas: ["API"]
  exclusions: []
  reference_paths: [
    {"path": "schema.prisma", "is_folder": false},
    {"path": "docs/api spec.yaml", "is_folder": false},
    {"path": "src/models/", "is_folder": true}
  ]
  raw_instructions: "Focus on API, --reference [schema.prisma, ...]"
```

**Single file example (backward compat):**
```
Input: "--reference schema.prisma"

Parsed:
  reference_paths: [{"path": "schema.prisma", "is_folder": false}]
```

If `{instructions}` is empty, all parsed values are null/empty (default behavior).

### Step 0.5: Intelligent Reference Analysis (If References Provided)

**CRITICAL: Reference files are SOURCE MATERIAL, not context dumps.**

If `{reference_paths}` is not empty:

#### Step 0.5a: Expand Folder References

First, expand any folder paths to individual files:

```
For EACH item in {reference_paths}:
  IF item.is_folder == true:
    1. Use Glob tool to find files:
       Pattern: {item.path}**/*.{json,yaml,yml,sql,prisma,graphql,gql,md,ts,js,tsx,jsx}

    2. For each file found:
       - Add to expanded_paths: {"path": file_path, "is_folder": false, "from_folder": item.path}

    3. Show expansion:
       📂 Expanding {item.path} → found {N} files
  ELSE:
    Add item directly to expanded_paths
```

**After expansion, validate count:**
```
IF expanded_paths.length > 10:
  ❌ Error: Too many references ({count} files). Maximum is 10.

  Files found:
  {list first 15 files}

  💡 Tip: Be more specific with folder path or use individual files.

  STOP (do not proceed)
```

**Example folder expansion:**
```
Input: --reference [api.yaml, src/models/]

Folder expansion:
  📂 Expanding src/models/ → found 3 files
     - src/models/user.prisma
     - src/models/product.prisma
     - src/models/types.ts

expanded_paths: [
  {"path": "api.yaml", "is_folder": false},
  {"path": "src/models/user.prisma", "is_folder": false, "from_folder": "src/models/"},
  {"path": "src/models/product.prisma", "is_folder": false, "from_folder": "src/models/"},
  {"path": "src/models/types.ts", "is_folder": false, "from_folder": "src/models/"}
]

Total: 4 files (within limit of 10) ✓
```

#### Step 0.5b: Analyze Each Reference File

For EACH path in expanded_paths:

1. **Read the file** using Read tool

2. **Detect file type** from extension AND content:
   - `.json` with `openapi`/`swagger` keys → OpenAPI specification
   - `.json` with `plan_name`/`requirements` keys → Existing plan
   - `.json` otherwise → Configuration/data schema
   - `.yaml`/`.yml` with `openapi` → OpenAPI specification
   - `.sql` → SQL DDL schema
   - `.prisma` → Prisma schema
   - `.graphql`/`.gql` → GraphQL schema
   - `.md` → Documentation/requirements doc
   - `.ts`/`.js`/`.tsx`/`.jsx` → Source code reference
   - `.png`/`.jpg`/`.svg` → Design mockup (if image analysis available)

3. **Spawn analysis subagent** for intelligent extraction:

   - subagent_type: "general-purpose"
   - model: "haiku"
   - prompt: |
     Read the prompt file: ${CLAUDE_PLUGIN_ROOT}/prompts/parse-reference.md

     Then analyze this reference file:

     **File path**: {reference_path}
     **File extension**: {extension}
     **File content**:
     ```
     {file_content}
     ```

     Return the structured JSON analysis as specified in the prompt.

4. **Store analysis** as `{reference_analyses}` array - structured data, NOT raw content

**What intelligent analysis produces:**

| File Type | Extracts | Plan Integration |
|-----------|----------|------------------|
| **OpenAPI/Swagger** | Endpoints, models, schemas | API phase tasks, DB models, validation rules |
| **Existing Plan** | Requirements, phases, decisions | Inherit relevant items, skip completed |
| **SQL Schema** | Tables, columns, relations | DB phase knows existing schema |
| **Prisma Schema** | Models, relations, enums | Type-safe models, CRUD patterns |
| **GraphQL Schema** | Types, queries, mutations | Resolver tasks, type definitions |
| **Design Mockup** | UI components, layouts, interactions | UI phase tasks, component list |
| **Documentation** | Requirements, decisions, context | Requirements to add, decisions to preserve |
| **Source Code** | Exports, patterns, interfaces | Patterns to follow, code to extend |

**Example: Swagger reference produces:**
```json
{
  "reference_type": "openapi",
  "api_endpoints": [
    {"method": "GET", "path": "/products", "summary": "List products"},
    {"method": "POST", "path": "/products", "summary": "Create product"}
  ],
  "data_models": [
    {"name": "Product", "fields": ["id", "name", "price"]}
  ],
  "plan_integration": {
    "requirements_to_add": [
      {"description": "Implement GET /products endpoint", "priority": "high"},
      {"description": "Implement POST /products endpoint", "priority": "high"}
    ],
    "suggestions_to_add": {
      "api_designs": [
        {"method": "GET", "path": "/products", "response": "Product[]"}
      ]
    }
  }
}
```

**Example: Existing plan reference produces:**
```json
{
  "reference_type": "existing_plan",
  "plan_name": "auth-system-v1",
  "requirements": [
    {"id": "req-1", "description": "User login", "relevance": "high"},
    {"id": "req-2", "description": "Password reset", "relevance": "low"}
  ],
  "plan_integration": {
    "requirements_to_add": [
      {"description": "User login", "source": "Inherited from auth-system-v1"}
    ],
    "decisions_to_inherit": [
      {"decision": "Use JWT tokens", "rationale": "Already implemented in v1"}
    ]
  }
}
```

### Step 1: Check for Active Session (Optional)

Plans are now global and don't require a session. However, if there's an active session, we can extract requirements from the conversation.

Check for active session:

```bash
[ -f .claude/sessions/.active-session ] && cat .claude/sessions/.active-session || echo "none"
```

- If result is "none": Skip Steps 2-3, create an empty plan with placeholder requirements (go to Step 4)
- If there's an active session: Continue to Step 2 to extract from conversation

### Step 2: Read Conversation Log (If Session Active)

**Only execute this step if there's an active session.**

Load the conversation log for the active session. The conversation log file is at:
`.claude/sessions/{session_name}/conversation-log.jsonl`

**Chunked Reading Strategy:**
1. Check if file exists
2. Count lines: `wc -l .claude/sessions/{session_name}/conversation-log.jsonl`
3. If <= 2000 lines: Read entire file
4. If > 2000 lines: Read in chunks of 2000 using Read tool's offset/limit parameters
5. Concatenate all chunks into full conversation log

If the file doesn't exist or is empty:
- Show warning: "⚠️ No conversation log found. Creating empty plan template."
- Continue to Step 4 with empty requirements

### Step 3: Detect Work Type (Optional - If Session Active)

Detect the work type from the conversation for metadata purposes:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js detect-work-type {session_name}
```

This returns a JSON object with:
```json
{
  "type": "feature|bug|spike|refactor|unknown",
  "confidence": 87,
  "scores": {...},
  "signals": {...}
}
```

Show the detection result:
```
🔍 Analyzing conversation...
✓ Detected work type: {TYPE} ({confidence}% confidence)
```

This is for metadata only - conceptual plans don't use templates.

### Step 4: Extract Requirements from Conversation

Use a subagent to analyze the conversation and extract requirements WITH implementation suggestions.

Invoke the Task tool with:
- subagent_type: "general-purpose"
- (no model specified - uses current conversation model for rich extraction)
- prompt: Build the prompt as follows:

```
Read the file at `${CLAUDE_PLUGIN_ROOT}/prompts/analyze-conversation.md`, replace placeholders with actual values, then execute those instructions.

[IF {instructions} is not empty, append:]

## Custom Instructions from User

The user provided specific guidance for this plan extraction:

**Raw Instructions:** {instructions}

**Parsed Directives:**
- Focus Areas: {focus_areas or "None specified"}
- Exclusions: {exclusions or "None specified"}
- Scope: {scope_limit or "Full conversation"}
- Format: {format_preference or "Standard"}

**How to Apply:**
1. PRIORITIZE topics in focus areas when extracting requirements
2. EXCLUDE or minimize topics in exclusions list
3. If scope limit specified, focus on that portion of conversation
4. Treat "Do NOT..." phrases as hard constraints - never include those items
5. All other instructions should guide your analysis naturally

These user instructions take precedence over default extraction behavior.

[IF {reference_analyses} is not empty, append:]

## Reference File Analysis (STRUCTURED - NOT RAW CONTENT)

The following reference files were analyzed and structured for plan integration.
**INTEGRATE these intelligently - don't just acknowledge them.**

{FOR EACH analysis IN reference_analyses:}

### Reference: {analysis.file_path}
**Type**: {analysis.reference_type} ({analysis.detected_as})

**Extracted Data:**
```json
{analysis.analysis}
```

**Plan Integration Instructions:**

{IF analysis.reference_type == "openapi":}
- ADD each API endpoint as a requirement or task suggestion
- ADD each data model to database phase considerations
- USE the exact paths/methods in API phase tasks

{IF analysis.reference_type == "existing_plan":}
- EVALUATE each requirement: is it relevant to current conversation?
- INHERIT requirements marked "high" relevance
- SKIP requirements marked "low" or "none" relevance
- PRESERVE architectural decisions unless conversation overrides them

{IF analysis.reference_type == "sql_schema":}
- Database phase should REFERENCE existing tables, not recreate
- ADD migrations only for NEW fields/tables needed
- DERIVE entity relationships from foreign keys

{IF analysis.reference_type == "prisma_schema":}
- USE existing Prisma models in implementation
- ADD new models/fields via Prisma migrations
- LEVERAGE auto-generated types

{IF analysis.reference_type == "graphql_schema":}
- ADD resolver implementations as API phase tasks
- MATCH types to database models
- USE schema for type definitions

{IF analysis.reference_type == "design_mockup":}
- ADD each UI element as a frontend requirement
- CREATE component tasks from layout analysis
- PRESERVE interaction patterns in UX requirements

{IF analysis.reference_type == "documentation":}
- ADD extracted requirements to plan
- PRESERVE documented decisions
- USE context notes for background

{IF analysis.reference_type == "source_code":}
- FOLLOW patterns found in reference code
- EXTEND existing classes/functions where applicable
- MAINTAIN consistency with existing style

**Items to Add to Plan:**
- Requirements: {analysis.plan_integration.requirements_to_add}
- Suggestions: {analysis.plan_integration.suggestions_to_add}
- Decisions: {analysis.plan_integration.decisions_to_inherit}

{END FOR EACH}

**CRITICAL**: Reference analyses are STRUCTURED DATA extracted for a reason.
- DO NOT ignore them
- DO NOT just mention them in notes
- ACTUALLY INTEGRATE them into requirements and suggestions
- The reference IS the specification - use it!
```

The subagent will return extracted requirements with suggestions:
```json
{
  "goal": "High-level objective",
  "requirements": [
    {
      "id": "req-1",
      "description": "What the user wants",
      "notes": "Additional context",
      "open_questions": ["Question 1", "Question 2"],
      "priority": "high|medium|low",
      "conversation_context": "Relevant conversation excerpts",
      "suggestions": {
        "api_designs": [{"method": "...", "signature": "...", "example": "..."}],
        "code_snippets": [{"language": "...", "code": "...", "purpose": "..."}],
        "file_structures": [{"name": "...", "tree": "...", "notes": "..."}],
        "ui_components": [{"name": "...", "props": "...", "example_usage": "..."}],
        "implementation_patterns": [{"pattern": "...", "when_to_use": "...", "example": "..."}]
      }
    }
  ],
  "technical_decisions": [
    {"decision": "...", "rationale": "...", "alternatives_rejected": ["..."]}
  ],
  "user_decisions": [
    {"question": "...", "answer": "...", "implications": "..."}
  ],
  "discussion_notes": "Free-form notes from planning discussion",
  "conversation_summary": "Comprehensive summary (no length limit)"
}
```

**IMPORTANT:**
- Extract REQUIREMENTS (what user wants) AND SUGGESTIONS (how it could be implemented)
- Suggestions are implementation-ready artifacts from conversation analysis
- During finalization, suggestions will be VERIFIED against codebase before use
- No artificial limits on discussion points or summary length

### Step 4: Build Requirements Plan

Create the requirements.json structure:

```json
{
  "plan_name": "{plan_name}",
  "plan_type": "conceptual",
  "goal": "{extracted_goal_or_placeholder}",
  "requirements": [...extracted_requirements_or_empty],
  "discussion_notes": "{discussion_notes_or_empty}",
  "conversation_summary": "{conversation_summary_or_empty}",
  "created_at": "{ISO_8601_timestamp}",
  "metadata": {
    "work_type": "{detected_work_type_or_unknown}",
    "estimated_complexity": "simple|moderate|complex",
    "source_session": "{session_name_if_available_else_null}",
    "custom_instructions": "{instructions_or_null}",
    "focus_areas": "{focus_areas_or_null}",
    "exclusions": "{exclusions_or_null}",
    "references": [
      {
        "path": "{reference_path}",
        "type": "{reference_type}",
        "items_integrated": "{count of requirements/suggestions added}"
      }
    ]
  }
}
```

**Note:** The `session_name` field is no longer required. Plans are global and can be created with or without session context.

### Step 6: Show Requirements Preview

Display a preview of the requirements to the user:

```
📋 Requirements Preview: {plan_name}

Goal: {goal}
Work Type: {type} ({confidence}% confidence)
[IF custom instructions provided:]
📝 Custom Instructions Applied: {brief summary of focus/exclusions}
[IF references analyzed:]
📎 References Integrated:
   • {reference_1.path} ({reference_1.type}) → {N} requirements, {M} suggestions
   • {reference_2.path} ({reference_2.type}) → {N} requirements, {M} suggestions

Requirements Captured:
  1. {req-1-description}
     Notes: {req-1-notes}
     Open Questions: {req-1-questions}

  2. {req-2-description}
     Notes: {req-2-notes}

  [Show first 3-4 requirements, summarize rest if more]

💡 This is a conceptual plan. Use /session:plan-finalize to transform requirements into executable tasks.

Options:
  1. ✓ Save this plan (recommended)
  2. Cancel
```

### Step 7: Get User Choice

Use the AskUserQuestion tool to get the user's choice.

Handle the response:
- **Option 1 (Save)**: Continue to Step 8
- **Option 2 (Cancel)**: Show "Plan creation cancelled" and STOP

### Step 8: Validate Requirements

Validate the requirements against requirements-schema.json:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js validate-requirements '{requirements_json}'
```

If validation fails, show the errors and STOP:
```
❌ Validation errors found:
  1. {error_1}
  2. {error_2}

Cannot save invalid plan. Please review.
```

If validation succeeds, continue.

### Step 9: Save Requirements File

Create the requirements.json file using the global plans directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js save-requirements {plan_name} '{requirements_json}'
```

This creates:
- `.claude/plans/{plan_name}/requirements.json`

Also create a conversation context markdown file for reference (if conversation was analyzed):
- Path: `.claude/plans/{plan_name}/conversation-context.md`
- Content: Include conversation summary, key decisions, requirements discussion, etc.
- If no session context, skip this file or create with placeholder noting manual plan creation

### Step 10: Display Success

Show success message with next steps:

```
✓ Global plan saved: {plan_name}

📋 Plan Details:
   • Type: Conceptual (requirements captured)
   • Work type: {type} (detected with {confidence}% confidence)
   • Requirements: {requirement_count}
   • Location: .claude/plans/{plan_name}/requirements.json
   • Scope: Global (accessible from any session)

📝 Next Steps:

   1. Review requirements:
      /session:plan-status {plan_name}

   2. List all plans:
      /session:plan-list

   3. Transform into executable plan:
      /session:plan-finalize {plan_name}

      This will use AI to break down requirements into concrete tasks
      organized by implementation phases (Database, API, UI, etc.)

   4. After finalization, execute:
      /session:plan-execute {plan_name}

💡 Plans are now global and accessible from any session. No need to be in a specific session to work with plans.
```

---

## Error Handling

At each step, handle errors gracefully:

- **File not found**: Show clear message with suggestion on how to proceed
- **Validation failed**: Show specific validation errors
- **Detection low confidence**: Accept it (work type is just metadata)
- **Parse errors**: Show error details and abort
- **CLI command failures**: Check exit codes and show appropriate error messages

Always provide actionable next steps when errors occur.

---

## Key Principles

**Planning Phase = Requirements Capture**

- Users discuss WHAT they want (requirements), not HOW to implement (tasks)
- Keep it lightweight and exploratory
- Allow for open questions and uncertainty
- No forced structure - just capture what was discussed

**Examples of Good Requirements:**
- "Restrict products based on user permissions"
- "Track who created each product"
- "Add audit logging for product changes"
- "Improve product search performance"

**Examples of Bad (Too Detailed for Planning):**
- "Add restriction_level column to public.new_product table" ← This is a task!
- "Create POST /api/products validation" ← This is a task!
- "Add checkbox in product form component" ← This is a task!

The transformation from requirements → tasks happens in /session:plan-finalize.

---

## Notes

- The ${CLAUDE_PLUGIN_ROOT} environment variable should point to the session plugin source directory
- Plans are now global - stored in `.claude/plans/` regardless of active session
- The {session_name} variable is optional - used only if there's an active session for conversation context
- All CLI commands should use absolute paths
- Error messages should be user-friendly and actionable
- The workflow is designed to be interruptible - user can cancel at any point
- Conceptual plans use requirements.json format (not orchestration.json)
- Plans can be created with or without session context (conversation analysis is optional)
- Custom instructions (`{instructions}`) allow users to guide plan extraction with focus areas, exclusions, references, and negative prompts
- Custom instructions are preserved in plan metadata for reference during finalization

## Intelligent Reference Handling (v3.20.0 / v3.21.0)

**References are SOURCE MATERIAL, not context dumps.**

### Syntax (v3.21.0)

```bash
# Single file (backward compatible)
--reference schema.prisma

# Multiple files (array syntax)
--reference [api.yaml, schema.sql, types.ts]

# Paths with spaces (quoted)
--reference ["docs/api spec.yaml", src/schema.prisma]

# Folder reference (expands to all relevant files)
--reference [src/models/]

# Mixed files and folders
--reference [api.yaml, "my docs/", src/types/]
```

**Rules:**
- Max 10 references (after folder expansion)
- Folders (paths ending with `/`) auto-expand to `*.{json,yaml,sql,prisma,graphql,md,ts,js}`
- Quoted paths preserve spaces

### How It Works

1. **Parse** `--reference [...]` array syntax
2. **Expand** folder paths → individual files
3. **Validate** total count ≤ 10
4. **Detect** file type (OpenAPI, SQL, Prisma, existing plan, etc.)
5. **Analyze** via subagent → structured extraction
6. **Integrate** into plan as requirements/suggestions

### Supported Reference Types

| Type | Extracts | Plan Integration |
|------|----------|------------------|
| **OpenAPI/Swagger** | Endpoints, models | API requirements, DB suggestions |
| **Existing Plan** | Requirements, phases | Inherit relevant, skip completed |
| **SQL Schema** | Tables, columns, FKs | DB phase knows existing tables |
| **Prisma Schema** | Models, relations | Type-safe implementation |
| **GraphQL Schema** | Types, queries | Resolver tasks |
| **Design Mockup** | UI components | Frontend requirements |
| **Documentation** | Requirements, decisions | Context preservation |
| **Source Code** | Patterns, interfaces | Code to follow/extend |

### Examples

```bash
# API spec → endpoints become requirements
/session:plan-save api-impl --reference [docs/openapi.yaml]

# Previous plan → inherit relevant items
/session:plan-save v2 --reference [.claude/plans/v1/requirements.json]

# Full stack with multiple references
/session:plan-save full-stack --reference [schema.prisma, api.yaml, "designs/mockup.png"]

# Reference entire folder of models
/session:plan-save data-layer --reference [src/models/]

# Combined: specific files + folder
/session:plan-save feature --reference [api.yaml, src/types/, "docs/spec.md"]
```
