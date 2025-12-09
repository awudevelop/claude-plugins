# Project Maps Ask Command

Ask natural language questions about project architecture using pre-computed maps.

**CRITICAL - Command Format:**
All session plugin commands use the `/session:` prefix. DO NOT suggest commands without this prefix.
- Correct: `/session:project-maps-ask`
- Wrong: `/project-maps-ask`

## Usage

```
/session:project-maps-ask "your question here"
```

## How It Works

This command uses an intent router to:
1. Parse your natural language question
2. Determine which maps contain the answer
3. Load only the relevant maps
4. Return a focused response

## Implementation

### Step 1: Run Ask Command

Execute the unified CLI with the question:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps ask "{question}"
```

For a specific project path:
```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps ask "{question}" --path {project_path}
```

### Step 2: Parse Response

The response includes:
- `success`: Boolean indicating success
- `intent`: Detected intent from the question
- `maps`: Which maps were consulted
- `answer`: The response data

### Step 3: Display Results

Present the answer in a readable format based on the detected intent.

## Example Questions

**Architecture questions:**
```bash
/session:project-maps-ask "what framework is this project using?"
/session:project-maps-ask "what is the backend architecture?"
/session:project-maps-ask "show me the project structure"
```

**Dependency questions:**
```bash
/session:project-maps-ask "what would break if I change auth.js?"
/session:project-maps-ask "what files import UserService?"
/session:project-maps-ask "show me the module dependencies"
```

**Component questions:**
```bash
/session:project-maps-ask "what components does this project have?"
/session:project-maps-ask "where are the React hooks?"
/session:project-maps-ask "show me the UI layer"
```

**Database questions:**
```bash
/session:project-maps-ask "what tables exist in the database?"
/session:project-maps-ask "show me the database schema"
/session:project-maps-ask "what ORM is being used?"
```

**Discovery questions:**
```bash
/session:project-maps-ask "where are the tests?"
/session:project-maps-ask "what are the largest files?"
/session:project-maps-ask "show me the entry points"
```

## Error Handling

If maps don't exist:
```
No maps found for this project.
Run: /session:project-maps-generate
```

If question is unclear:
```
I couldn't understand that question. Try asking about:
- Framework/architecture
- Dependencies/imports
- Components/modules
- Database/schema
- Tests/structure
```

## Performance

Intent routing adds ~10-50ms overhead, but only loads relevant maps (vs loading all maps).

## Comparison with Query

| Ask | Query |
|-----|-------|
| Natural language | Predefined types |
| Flexible | Predictable |
| Intent detection | Direct lookup |
| Best for exploration | Best for scripts |

Use `/session:project-maps-query` when you know the exact data type you need.
