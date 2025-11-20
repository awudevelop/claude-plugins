You are analyzing a conversation to extract structured planning information for a session plan.

## Input

You receive a conversation log (JSONL format). Each entry contains:
- `timestamp`: Unix timestamp
- `role`: 'user' or 'assistant'
- `content`: Message text

## Task

Extract the following structured information:

### 1. Goal
- **Primary goal**: Main objective (1-2 sentences)
- **Success criteria**: How to measure completion (array of criteria)

### 2. Technical Decisions
All technology, architecture, or approach decisions made.

Format:
```json
{
  "category": "technology|architecture|approach",
  "decision": "What was decided",
  "rationale": "Why this decision",
  "alternatives": ["Other options considered"]
}
```

### 3. Requirements
- **Functional**: What the system must do
- **Non-functional**: Performance, security, scalability, etc.

### 4. Constraints
Limitations or restrictions:
- Technical (must use X, can't modify Y)
- Time (deadline, milestones)
- Resource (budget, team size)
- Policy (compliance, standards)

### 5. Discussion Points
Top 5 important topics discussed:
```json
{
  "topic": "Brief topic name",
  "summary": "1-2 sentence summary"
}
```

### 6. Conversation Summary
2-3 paragraphs covering:
- What was discussed
- Key decisions made
- Plan direction

## Output Format

Return ONLY valid JSON (no markdown, no explanations):

```json
{
  "goal": {
    "primary": "string",
    "success_criteria": ["criterion1", "criterion2"]
  },
  "technical_decisions": [
    {
      "category": "technology",
      "decision": "string",
      "rationale": "string",
      "alternatives": ["alt1", "alt2"]
    }
  ],
  "requirements": {
    "functional": ["req1", "req2"],
    "non_functional": ["req1", "req2"]
  },
  "constraints": [
    {
      "type": "technical|time|resource|policy",
      "description": "string"
    }
  ],
  "discussion_points": [
    {
      "topic": "string",
      "summary": "string"
    }
  ],
  "conversation_summary": "2-3 paragraph string"
}
```

## Guidelines

1. **Be specific**: Extract exact details mentioned
2. **Be concise**: Summarize, don't copy verbatim
3. **Be accurate**: Only include what was actually discussed
4. **Handle gaps**: Use empty arrays if no data for a section
5. **Stay objective**: Don't add opinions

## Example

**Input conversation:**
```
User: I want to implement OAuth with Google
Assistant: Great! We could use passport.js for that
User: Yes, and store tokens in Redis for speed
Assistant: Good choice. Redis has built-in TTL support
```

**Output:**
```json
{
  "goal": {
    "primary": "Implement OAuth2 authentication with Google provider",
    "success_criteria": [
      "Users can log in with Google",
      "Tokens stored securely"
    ]
  },
  "technical_decisions": [
    {
      "category": "technology",
      "decision": "Use passport.js for OAuth",
      "rationale": "Mature library with good provider support",
      "alternatives": []
    },
    {
      "category": "architecture",
      "decision": "Store tokens in Redis",
      "rationale": "Fast access and built-in TTL support",
      "alternatives": []
    }
  ],
  "requirements": {
    "functional": [
      "Google OAuth login flow",
      "Token storage and retrieval"
    ],
    "non_functional": [
      "Fast authentication response"
    ]
  },
  "constraints": [],
  "discussion_points": [
    {
      "topic": "OAuth library selection",
      "summary": "Chose passport.js for maturity and provider support"
    }
  ],
  "conversation_summary": "Discussion focused on implementing OAuth2 with Google as the provider. Key decisions included using passport.js for its maturity and Redis for token storage due to its speed and TTL capabilities."
}
```

---

## Begin Analysis

Analyze the conversation below and return the structured JSON output:

[CONVERSATION LOG INSERTED HERE]
