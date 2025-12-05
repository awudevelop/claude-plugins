You are analyzing a conversation to extract structured planning information WITH implementation-ready suggestions.

## Input

You receive a conversation log (JSONL format). Each entry contains:
- `ts`: Unix timestamp (seconds)
- `p`: User prompt (if present)
- `r`: Assistant response (if present)
- `tl`: Tool names used (if present)

## Task

Extract comprehensive planning information. **There are NO artificial limits** on the number of items extracted. Capture EVERYTHING relevant.

### 1. Goal
- **Primary goal**: Main objective (1-2 sentences)
- **Success criteria**: How to measure completion (array of criteria)

### 2. Requirements (with Suggestions)

For EACH distinct requirement identified, extract:
- **id**: Unique identifier (req-1, req-2, etc.)
- **description**: What the user wants
- **notes**: Additional context
- **priority**: high/medium/low
- **open_questions**: Unresolved questions
- **conversation_context**: Why this requirement exists
- **suggestions**: Implementation-ready artifacts (see Section 7)

### 3. Technical Decisions
ALL technology, architecture, or approach decisions made:
```json
{
  "decision": "What was decided",
  "rationale": "Why this decision",
  "alternatives_rejected": ["Other options considered and why rejected"]
}
```

### 4. User Decisions (Q&A Resolution)
Explicit answers/choices made by the user during conversation:
```json
{
  "question": "What was asked",
  "answer": "User's explicit answer (preserve exact wording)",
  "implications": "What this means for implementation"
}
```

### 5. Discussion Points (NO LIMIT)
ALL significant topics discussed in chronological order:
```json
{
  "topic": "Topic name",
  "summary": "What was discussed",
  "outcome": "Conclusion or decision reached"
}
```
**Extract ALL topics. Do NOT limit to 5 or any number.**

### 6. Conversation Summary (NO LENGTH LIMIT)
Comprehensive summary covering:
- What was discussed (all major topics)
- Key decisions made
- Implementation approach agreed upon
- Outstanding questions or concerns

**Length should match conversation complexity. A 10k token conversation needs a thorough summary.**

### 7. Suggestions (CRITICAL - Per Requirement)

For each requirement, extract implementation-ready artifacts from the conversation. These are NOT abstract ideas - they are designs informed by codebase analysis during the conversation.

**7.1 API Designs**
Method signatures, endpoints, or interface definitions:
```json
{
  "method": "authHub.can",
  "signature": "can(permission: string, context?: { tenantId?, productId? }): Promise<boolean>",
  "example": "const canEdit = await authHub.can('sys:manage-user-role')",
  "notes": "Uses stored context if not overridden",
  "source_context": "Designed based on existing check_user_permissions RPC"
}
```

**7.2 Code Snippets**
Actual code examples, class definitions, or implementations:
```json
{
  "language": "typescript",
  "code": "class ContextStore {\n  private tenantId: string | null = null;\n  ...\n}",
  "purpose": "Manages tenant/product context with localStorage persistence",
  "source_context": "User wanted context to persist across page refreshes"
}
```

**7.3 File Structures**
Package structures, folder hierarchies, or file organizations:
```json
{
  "name": "@auth-hub/client",
  "tree": "@auth-hub/client/\n├── src/\n│   ├── auth/\n│   ├── permissions/\n│   └── types/\n├── cli/\n└── sql/",
  "notes": "Core SDK package with auth, permissions, context management"
}
```

**7.4 UI Components**
React/Vue/frontend component suggestions:
```json
{
  "name": "PermissionGate",
  "description": "Conditional rendering based on user permissions",
  "props": "permission: string, fallback?: ReactNode, children: ReactNode",
  "example_usage": "<PermissionGate permission='edit'><Button /></PermissionGate>"
}
```

**7.5 Implementation Patterns**
Patterns, conventions, or approaches to follow:
```json
{
  "pattern": "Event emission on context change",
  "when_to_use": "When tenant or product context changes",
  "example": "authHub.onContextChange((newCtx, oldCtx) => { ... })"
}
```

## Output Format

Return ONLY valid JSON (no markdown, no explanations):

```json
{
  "goal": {
    "primary": "string",
    "success_criteria": ["criterion1", "criterion2"]
  },
  "requirements": [
    {
      "id": "req-1",
      "description": "string",
      "notes": "string",
      "priority": "high|medium|low",
      "open_questions": ["question1"],
      "conversation_context": "string",
      "suggestions": {
        "api_designs": [],
        "code_snippets": [],
        "file_structures": [],
        "ui_components": [],
        "implementation_patterns": []
      }
    }
  ],
  "technical_decisions": [
    {
      "decision": "string",
      "rationale": "string",
      "alternatives_rejected": ["alt1", "alt2"]
    }
  ],
  "user_decisions": [
    {
      "question": "string",
      "answer": "string",
      "implications": "string"
    }
  ],
  "discussion_points": [
    {
      "topic": "string",
      "summary": "string",
      "outcome": "string"
    }
  ],
  "conversation_summary": "comprehensive multi-paragraph string"
}
```

## Guidelines

1. **Be comprehensive**: Extract ALL relevant information, no limits
2. **Preserve specifics**: Keep exact method signatures, code snippets, file paths
3. **Be accurate**: Only include what was actually discussed
4. **Handle gaps**: Use empty arrays if no data for a section
5. **Link suggestions to requirements**: Each requirement's suggestions should be relevant to that requirement
6. **Preserve user decisions verbatim**: User's explicit answers are critical

## Why Suggestions Matter

During the conversation, Claude likely:
- Read actual codebase files
- Analyzed existing patterns
- Designed implementations that FIT the codebase

These suggestions are NOT abstract ideas - they are informed designs. During plan-finalize:
1. Each suggestion will be VERIFIED against the codebase
2. If similar exists -> reference existing implementation
3. If valid and new -> USE the suggestion as-is
4. If needs adaptation -> adapt to fit codebase patterns

**Do NOT discard implementation details. They represent significant analysis work.**

## Example

**Input conversation:**
```
User: I want to implement OAuth with Google
Assistant: Great! I've analyzed your codebase. You already have passport configured.
Here's the implementation:

const googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  callbackURL: '/auth/google/callback'
}, async (token, profile, done) => {
  const user = await findOrCreateUser(profile);
  return done(null, user);
});

User: Yes, and store tokens in Redis for speed
Assistant: Your existing Redis client at lib/redis.js can be extended:

async function storeToken(userId, token, ttl = 3600) {
  await redis.setex(`token:${userId}`, ttl, token);
}
```

**Output:**
```json
{
  "goal": {
    "primary": "Implement OAuth2 authentication with Google provider",
    "success_criteria": [
      "Users can log in with Google",
      "Tokens stored in Redis with TTL"
    ]
  },
  "requirements": [
    {
      "id": "req-1",
      "description": "Google OAuth login flow",
      "notes": "Use existing passport configuration",
      "priority": "high",
      "open_questions": [],
      "conversation_context": "User wants Google login, codebase already has passport",
      "suggestions": {
        "api_designs": [],
        "code_snippets": [
          {
            "language": "javascript",
            "code": "const googleStrategy = new GoogleStrategy({\n  clientID: process.env.GOOGLE_CLIENT_ID,\n  callbackURL: '/auth/google/callback'\n}, async (token, profile, done) => {\n  const user = await findOrCreateUser(profile);\n  return done(null, user);\n});",
            "purpose": "Google OAuth strategy implementation",
            "source_context": "Designed based on existing passport setup in codebase"
          }
        ],
        "file_structures": [],
        "ui_components": [],
        "implementation_patterns": []
      }
    },
    {
      "id": "req-2",
      "description": "Token storage in Redis with TTL",
      "notes": "Extend existing Redis client at lib/redis.js",
      "priority": "high",
      "open_questions": [],
      "conversation_context": "User wants fast token access, Redis already configured",
      "suggestions": {
        "api_designs": [
          {
            "method": "storeToken",
            "signature": "storeToken(userId: string, token: string, ttl?: number): Promise<void>",
            "example": "await storeToken(user.id, accessToken, 3600)",
            "notes": "Default TTL of 1 hour",
            "source_context": "Extends existing lib/redis.js"
          }
        ],
        "code_snippets": [
          {
            "language": "javascript",
            "code": "async function storeToken(userId, token, ttl = 3600) {\n  await redis.setex(`token:${userId}`, ttl, token);\n}",
            "purpose": "Redis token storage with TTL",
            "source_context": "User confirmed Redis for speed, extends existing client"
          }
        ],
        "file_structures": [],
        "ui_components": [],
        "implementation_patterns": []
      }
    }
  ],
  "technical_decisions": [
    {
      "decision": "Use existing passport.js configuration",
      "rationale": "Passport already configured in codebase, just add Google strategy",
      "alternatives_rejected": []
    },
    {
      "decision": "Store tokens in Redis",
      "rationale": "Fast access and built-in TTL support, Redis already in stack",
      "alternatives_rejected": ["Database storage - too slow for token lookups"]
    }
  ],
  "user_decisions": [
    {
      "question": "Where to store tokens?",
      "answer": "Redis for speed",
      "implications": "Need to extend existing Redis client, add TTL-based storage"
    }
  ],
  "discussion_points": [
    {
      "topic": "OAuth provider selection",
      "summary": "Google selected as OAuth provider",
      "outcome": "Implement GoogleStrategy with passport.js"
    },
    {
      "topic": "Token storage strategy",
      "summary": "Discussed storage options for OAuth tokens",
      "outcome": "Redis chosen for performance, using existing client"
    }
  ],
  "conversation_summary": "Discussion focused on implementing OAuth2 with Google as the provider. Analysis of the codebase revealed existing passport.js configuration that can be extended with a GoogleStrategy. The user explicitly chose Redis for token storage due to performance requirements. Implementation code was designed based on the existing lib/redis.js client, adding a storeToken function with TTL support. Both code snippets are implementation-ready and should be verified against current codebase before use."
}
```

---

## Begin Analysis

Analyze the conversation below and return the structured JSON output:

[CONVERSATION LOG INSERTED HERE]
