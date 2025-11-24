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
- `discussion_notes`: Overall analysis and key decisions
- `conversation_summary`: Summary of the conversation that led to these requirements
- `metadata`: Work type and complexity information

## Task

Break down the requirements into concrete, executable implementation tasks organized by logical phases.

### Guidelines

1. **Task Granularity**
   - Each task should be completable in 1-4 hours
   - Tasks must be specific and actionable (not vague)
   - Include concrete details: file names, function names, specific operations
   - Think: "What exact code changes need to happen?"

2. **Phase Organization**
   - Group related tasks into logical phases
   - Phases should have clear dependencies (Phase 1 before Phase 2)
   - Typical phases: Foundation → Core Logic → Integration → Testing → Documentation
   - Each phase should have 3-8 tasks (not too many, not too few)

3. **Requirement Coverage**
   - Every requirement must map to at least one task
   - Complex requirements may need multiple tasks across phases
   - Track which requirement each task fulfills

4. **Technical Specificity**
   - Reference actual files, functions, and code structures
   - Include implementation approach in task details
   - Consider error handling, validation, and edge cases
   - Think about the existing codebase architecture

5. **Dependencies and Order**
   - Tasks within a phase have a logical order
   - Foundation tasks come before integration tasks
   - Core functionality before advanced features

### Analysis Process

**Step 1: Understand the Goal**
- What is the end state we're trying to achieve?
- What are the core capabilities needed?

**Step 2: Identify Technical Components**
- What files/modules need to be created or modified?
- What are the key data structures?
- What are the main operations/functions?

**Step 3: Map Requirements to Implementation Areas**
- Which requirements affect data models?
- Which affect business logic?
- Which affect user interfaces?
- Which affect validation/safety?

**Step 4: Design Phase Structure**
Example phase progression:
1. **Foundation Phase**: Data structures, schemas, core utilities
2. **Core Operations Phase**: Main functionality implementation
3. **Integration Phase**: Connect components, add interfaces
4. **Safety & Validation Phase**: Error handling, validation, testing
5. **Documentation Phase**: User docs, code comments

**Step 5: Break Down Each Requirement**
For each requirement, ask:
- What files need to change?
- What functions need to be added/modified?
- What validation is needed?
- What testing is needed?
- Are there dependencies on other requirements?

**Step 6: Create Concrete Tasks**
Each task should answer:
- **What** exact change is being made?
- **Where** is it being made (file/function)?
- **How** should it be implemented (approach)?
- **Why** is it needed (requirement link)?

## Output Format

Return ONLY valid JSON (no markdown, no explanations):

```json
{
  "implementation_goal": "Clear 1-2 sentence summary of what will be built",
  "phases": [
    {
      "id": "phase-1",
      "name": "Foundation Setup",
      "description": "1-2 sentence description of this phase's purpose",
      "tasks": [
        {
          "id": "task-1-1",
          "description": "Concise task description (40-60 chars)",
          "details": "Specific implementation details: files to modify, functions to add, approach to take. Include concrete file paths and code structure guidance.",
          "from_requirement": "req-1",
          "estimated_time": "2h",
          "dependencies": []
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1", "task-2-3", "task-3-1"],
    "req-2": ["task-1-2", "task-2-1"]
  },
  "assumptions": [
    "Assumption about codebase, tech stack, or approach",
    "Another assumption that affects implementation"
  ],
  "risks": [
    "Potential risk or challenge in implementation",
    "Another risk to be aware of"
  ]
}
```

### Field Specifications

**implementation_goal**:
- Concise summary of the complete implementation
- Should match the original goal but be more specific
- Example: "Implement comprehensive plan update functionality with atomic multi-file operations, UUID-based IDs, execution safety, and hybrid natural language interface"

**phases**:
- **id**: "phase-{number}" format
- **name**: Short, descriptive phase name (2-5 words)
- **description**: What this phase accomplishes and why it comes in this order
- **tasks**: Array of task objects

**tasks**:
- **id**: "task-{phase_number}-{task_number}" format (e.g., "task-1-1", "task-2-3")
- **description**: Brief, action-oriented summary (under 60 chars)
- **details**: Comprehensive implementation guidance including:
  - Specific files to create/modify (absolute paths if known)
  - Functions/classes to add
  - Key data structures
  - Implementation approach
  - Important considerations (validation, error handling, etc.)
- **from_requirement**: Reference to requirement ID this task fulfills
- **estimated_time**: Realistic time estimate (e.g., "1h", "3h", "2-4h")
- **dependencies**: Array of task IDs that must complete first (empty array if none)

**traceability**:
- Maps each requirement ID to array of task IDs that implement it
- Ensures complete requirement coverage
- Example: `"req-1": ["task-1-1", "task-2-1", "task-3-2"]`

**assumptions**:
- Technical assumptions about the codebase
- Technology choices or constraints
- Existing infrastructure/patterns to follow
- Keep to 3-6 key assumptions

**risks**:
- Technical challenges or unknowns
- Potential blockers or complications
- Areas requiring extra attention
- Keep to 3-6 key risks

## Quality Checklist

Before returning, verify:

- [ ] Every requirement has at least one task
- [ ] All tasks have concrete, specific details
- [ ] Phase progression makes logical sense
- [ ] Task dependencies are correctly identified
- [ ] Estimated times are realistic
- [ ] No vague or unclear task descriptions
- [ ] Assumptions and risks are identified
- [ ] Traceability map is complete and accurate
- [ ] Implementation goal clearly summarizes the work

## Example

**Input:**
```json
{
  "plan_name": "add-user-roles",
  "plan_type": "conceptual",
  "goal": "Add role-based access control to user management system",
  "requirements": [
    {
      "id": "req-1",
      "description": "Database schema for user roles",
      "notes": "Need roles table and user_roles junction table",
      "priority": "high",
      "open_questions": ["Should roles be hierarchical?"],
      "conversation_context": "User wants admin, editor, viewer roles"
    },
    {
      "id": "req-2",
      "description": "Role checking middleware",
      "notes": "Protect routes based on user roles",
      "priority": "high",
      "open_questions": [],
      "conversation_context": "Need to prevent unauthorized access"
    }
  ],
  "discussion_notes": "Simple RBAC with three roles. No hierarchy needed for v1.",
  "conversation_summary": "User needs basic role-based access control with admin, editor, and viewer roles to restrict feature access.",
  "metadata": {
    "work_type": "feature",
    "estimated_complexity": "medium"
  }
}
```

**Output:**
```json
{
  "implementation_goal": "Implement role-based access control system with three roles (admin, editor, viewer), database schema, middleware, and route protection",
  "phases": [
    {
      "id": "phase-1",
      "name": "Database Schema",
      "description": "Create database tables and relationships for role management",
      "tasks": [
        {
          "id": "task-1-1",
          "description": "Create roles table migration",
          "details": "Add migration file: migrations/YYYYMMDD_create_roles_table.js. Create 'roles' table with columns: id (PK), name (varchar 50, unique), description (text), created_at. Seed with three roles: admin, editor, viewer. Use existing migration pattern from users table.",
          "from_requirement": "req-1",
          "estimated_time": "1h",
          "dependencies": []
        },
        {
          "id": "task-1-2",
          "description": "Create user_roles junction table migration",
          "details": "Add migration file: migrations/YYYYMMDD_create_user_roles_table.js. Create 'user_roles' table with: user_id (FK to users.id), role_id (FK to roles.id), assigned_at. Add composite unique index on (user_id, role_id). Include CASCADE delete constraints.",
          "from_requirement": "req-1",
          "estimated_time": "1h",
          "dependencies": ["task-1-1"]
        }
      ]
    },
    {
      "id": "phase-2",
      "name": "Role Management Logic",
      "description": "Implement role checking and assignment functionality",
      "tasks": [
        {
          "id": "task-2-1",
          "description": "Add role checking functions",
          "details": "Create lib/roles.js with functions: hasRole(userId, roleName), getRoles(userId), assignRole(userId, roleName), removeRole(userId, roleName). Use existing DB connection pattern. Add error handling for invalid users/roles.",
          "from_requirement": "req-2",
          "estimated_time": "2h",
          "dependencies": ["task-1-2"]
        },
        {
          "id": "task-2-2",
          "description": "Create role middleware",
          "details": "Create middleware/requireRole.js that exports requireRole(roleName) function. Middleware should: 1) Get user from req.user (assumes auth middleware ran), 2) Call hasRole() to check, 3) Return 403 if unauthorized, 4) Call next() if authorized. Add detailed error messages.",
          "from_requirement": "req-2",
          "estimated_time": "1.5h",
          "dependencies": ["task-2-1"]
        }
      ]
    },
    {
      "id": "phase-3",
      "name": "Integration & Testing",
      "description": "Apply role protection to routes and verify functionality",
      "tasks": [
        {
          "id": "task-3-1",
          "description": "Protect admin routes with role middleware",
          "details": "Update routes/admin.js to use requireRole('admin') middleware on all admin routes. Apply to: DELETE /users/:id, POST /users/:id/ban, GET /admin/dashboard. Follow existing middleware pattern in codebase.",
          "from_requirement": "req-2",
          "estimated_time": "1h",
          "dependencies": ["task-2-2"]
        },
        {
          "id": "task-3-2",
          "description": "Add role management unit tests",
          "details": "Create tests/lib/roles.test.js. Test: hasRole() returns correct boolean, getRoles() returns user's roles, assignRole() creates junction record, removeRole() deletes junction record, error cases (invalid user/role). Use existing test patterns with Jest.",
          "from_requirement": "req-1",
          "estimated_time": "2h",
          "dependencies": ["task-2-1"]
        }
      ]
    }
  ],
  "traceability": {
    "req-1": ["task-1-1", "task-1-2", "task-3-2"],
    "req-2": ["task-2-1", "task-2-2", "task-3-1"]
  },
  "assumptions": [
    "Database is PostgreSQL (based on existing migration patterns)",
    "Authentication middleware already exists and sets req.user",
    "Using existing migration runner (no new migration tooling needed)",
    "Jest is already set up for testing",
    "Users can have multiple roles (junction table approach)"
  ],
  "risks": [
    "Migration conflicts if other migrations are pending",
    "Performance impact if hasRole() is called frequently (may need caching)",
    "No role hierarchy means admins must also be assigned editor/viewer roles for those permissions"
  ]
}
```

---

## Begin Breakdown

Analyze the requirements below and return the structured implementation breakdown:

[REQUIREMENTS JSON INSERTED HERE]
