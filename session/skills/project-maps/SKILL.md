---
name: project-maps
description: Use for project architecture, codebase structure, dependencies, components, tech stack. Explicit triggers: @map, map-ask, explore map, -map. Pre-computed maps faster than Glob for structural queries.
allowed-tools: []
---

# Project Maps

Pre-computed codebase analysis. Use instead of Glob for architecture questions.

## Explicit Triggers

- `@map`
- `map-ask`
- `explore map`
- `-map`

## When to Use

| Maps | Glob |
|------|------|
| Architecture | File patterns |
| Structure | Find by name |
| Dependencies | Content search |
| Components | Wildcards |

## Commands

```
/session:project-maps-ask "what is the architecture?"
/session:project-maps-query components
/session:project-maps-query deps
/session:project-maps-list
/session:project-maps-stats
```

## Why Maps

- **Pre-computed**: No filesystem scanning
- **Hierarchical**: Understands structure
- **Token-efficient**: Lean output
