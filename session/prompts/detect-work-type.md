You are detecting the type of work being planned from a conversation.

## Work Types

1. **feature**: New functionality, capabilities, or enhancements
2. **bug**: Fixing errors, issues, or broken behavior
3. **spike**: Research, exploration, proof-of-concept, or investigation
4. **refactor**: Code restructuring, cleanup, or quality improvements

## Input

Conversation log (JSONL format) containing user-assistant discussion.

## Task

Analyze the conversation and determine the work type based on:

### Feature Indicators
- Keywords: implement, build, create, add, develop, feature, new
- Phrases: "new functionality", "add capability", "integration"
- Patterns: Requirements discussion, user stories, phase planning

### Bug Indicators
- Keywords: fix, bug, error, issue, broken, failing, crash
- Phrases: "not working", "exception", "regression"
- Patterns: Error discussion, reproduction steps, expected vs actual

### Spike Indicators
- Keywords: explore, investigate, research, experiment, spike, evaluate
- Phrases: "proof of concept", "feasibility", "compare options"
- Patterns: High question density, comparisons, uncertainty

### Refactor Indicators
- Keywords: refactor, restructure, reorganize, cleanup, improve
- Phrases: "technical debt", "code quality", "maintainability"
- Patterns: Code quality discussion, no new features mentioned

## Scoring

Rate each work type 0-100 based on:
1. Keyword matches (10 points per primary keyword, 5 per secondary)
2. Pattern matches (10 points per matched pattern)
3. Context strength

Calculate confidence as:
```
confidence = (topScore - secondScore) / topScore * 100
```

Adjust for conversation length:
- < 5 messages: confidence * 0.6
- 5-10 messages: confidence * 0.8
- 10+ messages: full confidence

If confidence < 50%, return 'unknown'.

## Output Format

Return ONLY valid JSON:

```json
{
  "type": "feature|bug|spike|refactor|unknown",
  "confidence": 85,
  "scores": {
    "feature": 87,
    "bug": 23,
    "spike": 15,
    "refactor": 8
  },
  "signals": {
    "keywords_matched": ["implement", "build", "create"],
    "patterns_matched": ["requirements_discussion", "user_story"],
    "conversation_length": 12
  },
  "reasoning": "Strong feature indicators with requirements discussion and implementation keywords. High confidence due to clear signal separation and sufficient conversation length."
}
```

## Example

**Input:**
```
User: The login page is throwing a TypeError
Assistant: Can you share the error message?
User: "Cannot read property 'email' of undefined"
Assistant: Looks like user object is null. Let's fix it.
```

**Output:**
```json
{
  "type": "bug",
  "confidence": 92,
  "scores": {
    "feature": 5,
    "bug": 95,
    "spike": 3,
    "refactor": 7
  },
  "signals": {
    "keywords_matched": ["error", "fix", "TypeError"],
    "patterns_matched": ["error_discussion", "expected_vs_actual"],
    "conversation_length": 4
  },
  "reasoning": "Clear bug indicators with error message, TypeError mentioned, and fix intent. High confidence despite short conversation due to strong signal."
}
```

---

## Begin Detection

Analyze the conversation below and return the work type detection:

[CONVERSATION LOG INSERTED HERE]
