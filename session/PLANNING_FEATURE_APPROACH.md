# Session Plugin: Planning Feature Implementation Approach

**Document Version:** 1.1.0 (Updated: File naming convention)
**Date:** 2025-11-17
**Status:** Brainstorming / Design Phase
**Feasibility:** 88% (Highly Feasible)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Concept](#core-concept)
3. [Standard JSON Schema](#standard-json-schema)
4. [Architecture Design](#architecture-design)
5. [Command Structure](#command-structure)
6. [Implementation Phases](#implementation-phases)
7. [Template System](#template-system)
8. [Internal Tracking Mechanism](#internal-tracking-mechanism)
9. [Risk Mitigation](#risk-mitigation)
10. [Past Bug Lessons](#past-bug-lessons)
11. [Technical Challenges](#technical-challenges)
12. [Design Decisions](#design-decisions)
13. [Files to Create/Modify](#files-to-createmodify)
14. [Success Metrics](#success-metrics)
15. [Open Questions](#open-questions)

---

## Executive Summary

### Vision
Create a conversation-driven planning system within the session plugin that:
- Analyzes natural conversations to extract structured plans
- Uses a standard JSON format for robust planning structure (`plan_{name}.json`)
- Saves conversation context alongside plans (`conversation_{name}.md`)
- Works with or without active sessions (flexible storage)
- Enables plan execution in fresh sessions with auto-generated prompts
- Zero user commands during work (Claude auto-updates task status)

### Feasibility Assessment
**Overall: 92% - Highly Feasible** (Increased from 88% - simpler architecture)

| Component | Feasibility | Confidence |
|-----------|-------------|------------|
| Standard JSON format | 100% | Very High |
| Conversation analysis | 90% | High |
| CLI implementation | 100% | Very High |
| Single command integration | 100% | Very High |
| Token-efficient tools | 100% | Very High |
| Plan execution tracking | 95% | Very High |
| Pattern recognition (file naming) | 100% | Very High |

### Key Recommendations
✅ **PROCEED** with implementation
🎯 **START** with Phase 1 (4-6 hours) - Core infrastructure
⚠️ **WATCH** for bash parsing, subagent reliability (conversation analysis)
🎯 **TOTAL EFFORT:** 7-11 hours (vs 26-34 in previous design)

### Value Proposition
- **Natural workflow:** Users just talk, Claude extracts plan on demand
- **Zero friction:** Single command `/save-plan {name}` - no complex interaction
- **Flexible:** Works in sessions or standalone conversations
- **Token-efficient:** 97% token savings via Node CLI tools
- **Reusable:** Plans generate execution prompts for new sessions
- **Traceable:** Conversation context saved with every plan

---

## Core Concept

### User Workflow (Conversation-Driven)
```
1. User and Claude have natural conversation about what to build
   → "I think we should use passport.js for OAuth"
   → "Let's start with Google, then add Azure AD"
   → "We'll need Redis for token storage"
   → [Discussion continues naturally...]

2. User calls: /save-plan oauth-implementation
   → Claude analyzes entire conversation
   → Extracts: goals, decisions, requirements, constraints, technical approach
   → Structures into phases and tasks
   → Saves plan_oauth-implementation.json
   → Saves conversation_oauth-implementation.md (conversation summary)

3. Claude generates execution prompt:
   "Load plan from .claude/sessions/{session}/plans/plan_oauth-implementation.json
    Review context from conversation_oauth-implementation.md
    Begin Phase 1, Task 1 and update status as work progresses."

4. User starts NEW session for execution:
   → /session:start oauth-implementation
   → Pastes execution prompt

5. Claude in new session:
   → Loads plan_oauth-implementation.json
   → Reads conversation_oauth-implementation.md for context
   → Works on task-1, completes it
   → Auto-updates via: updateTaskStatus("task-1", "completed")
   → Moves to task-2
   → [Continues systematically through plan...]

6. User checks status anytime: /session:status
   → Shows: "📋 Plan Progress: 35% (5/14 tasks), Current: task-6"

7. If Claude wants to deviate from plan:
   → Validates via: validateNextWork(planName, "add rate limiting")
   → Shows BOLD warning if deviation detected
   → Asks user permission (add to plan / continue / cancel)
```

### Command Example: Saving Plan from Conversation
```bash
[After natural discussion about OAuth implementation...]

User: /save-plan oauth-implementation

Claude: Analyzing conversation to extract plan...

✓ Analyzed entire conversation (summary + key points)
✓ Identified goal: Implement OAuth2 with Google provider
✓ Extracted 4 key decisions (passport.js, Redis, Google-first, etc.)
✓ Found 3 requirements, 2 constraints
✓ Structured into 4 phases, 12 tasks
✓ Created conversation summary

Files created:
  📄 plan_oauth-implementation.json (structured plan)
  📝 conversation_oauth-implementation.md (conversation summary)

Location: .claude/sessions/feature-auth/plans/

Plan Summary:
  • 4 phases, 12 tasks
  • Estimated: 9-13 hours
  • Goal: Implement OAuth2 authentication with Google provider
  • Key tech: passport.js, Redis, Express middleware

To execute this plan, start a new session and use this prompt:

┌─────────────────────────────────────────────────────┐
│ Load and execute plan: oauth-implementation         │
│                                                      │
│ Read plan from:                                     │
│ .claude/sessions/feature-auth/plans/                │
│   plan_oauth-implementation.json                    │
│                                                      │
│ Review context from:                                │
│   conversation_oauth-implementation.md              │
│                                                      │
│ Begin Phase 1, Task 1:                              │
│ "Set up OAuth provider configuration"              │
│                                                      │
│ Update task status as work progresses.              │
└─────────────────────────────────────────────────────┘

Copy this prompt, start a new session, and paste to begin.
```

### Execution Example: Loading and Working from Plan
```bash
User: [In new session] Load and execute plan: oauth-implementation...

Claude: 📋 Loaded plan: oauth-implementation

Progress: 0% (0/12 tasks completed)
Context: Read conversation summary - discussed passport.js, Redis, Google OAuth

Current Phase: Phase 1 - Setup & Configuration (2-3h)
Current Task: task-1 "Set up OAuth provider configuration"

Let me start by setting up the OAuth provider configuration for Google...

[Claude does the work...]
[Creates config files, sets up credentials, etc.]

✓ Completed task-1: Set up OAuth provider configuration

Progress: 8% (1/12 tasks completed)
Next Task: task-2 "Install and configure passport.js"

[Claude continues working through plan systematically...]
```

---

## Standard JSON Schema

### Schema Version 1.0.0

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Session Plan",
  "type": "object",
  "required": ["schema_version", "plan_metadata", "phases", "tasks"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of plan schema"
    },
    "plan_metadata": {
      "type": "object",
      "required": ["session_name", "goal", "created_at"],
      "properties": {
        "session_name": {"type": "string"},
        "goal": {"type": "string"},
        "created_at": {"type": "string", "format": "date-time"},
        "last_updated": {"type": "string", "format": "date-time"},
        "planning_method": {"enum": ["interactive", "automatic", "template"]},
        "status": {"enum": ["draft", "in_progress", "completed", "abandoned"]},
        "conversation_snapshot": {"type": "string"}
      }
    },
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "order", "status"],
        "properties": {
          "id": {"type": "string", "pattern": "^phase-\\d+$"},
          "name": {"type": "string"},
          "description": {"type": "string"},
          "order": {"type": "integer", "minimum": 1},
          "status": {"enum": ["pending", "in_progress", "completed", "skipped"]},
          "started_at": {"type": ["string", "null"], "format": "date-time"},
          "completed_at": {"type": ["string", "null"], "format": "date-time"},
          "estimated_duration": {"type": "string"},
          "actual_duration": {"type": ["string", "null"]},
          "task_ids": {"type": "array", "items": {"type": "string"}},
          "completion_criteria": {"type": "array", "items": {"type": "string"}},
          "checks": {"type": "array", "items": {"$ref": "#/definitions/check"}}
        }
      }
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "phase_id", "title", "status"],
        "properties": {
          "id": {"type": "string", "pattern": "^task-\\d+$"},
          "phase_id": {"type": "string"},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "status": {"enum": ["pending", "in_progress", "completed", "blocked", "skipped"]},
          "priority": {"enum": ["low", "medium", "high", "critical"]},
          "order": {"type": "integer"},
          "dependencies": {"type": "array", "items": {"type": "string"}},
          "blockers": {"type": "array", "items": {"$ref": "#/definitions/blocker"}},
          "started_at": {"type": ["string", "null"], "format": "date-time"},
          "completed_at": {"type": ["string", "null"], "format": "date-time"},
          "estimated_duration": {"type": "string"},
          "actual_duration": {"type": ["string", "null"]},
          "subtasks": {"type": "array", "items": {"$ref": "#/definitions/subtask"}},
          "files_affected": {"type": "array", "items": {"type": "string"}},
          "snapshots": {"type": "array", "items": {"type": "string"}},
          "checks": {"type": "array", "items": {"$ref": "#/definitions/check"}},
          "notes": {"type": "string"}
        }
      }
    },
    "completion_criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["description", "status"],
        "properties": {
          "description": {"type": "string"},
          "status": {"enum": ["pending", "in_progress", "partial", "completed"]},
          "progress": {"type": "string"}
        }
      }
    },
    "risks": {
      "type": "array",
      "items": {"$ref": "#/definitions/risk"}
    },
    "metrics": {
      "type": "object",
      "properties": {
        "total_phases": {"type": "integer"},
        "completed_phases": {"type": "integer"},
        "total_tasks": {"type": "integer"},
        "completed_tasks": {"type": "integer"},
        "in_progress_tasks": {"type": "integer"},
        "blocked_tasks": {"type": "integer"},
        "pending_tasks": {"type": "integer"},
        "overall_progress_percent": {"type": "integer", "minimum": 0, "maximum": 100},
        "estimated_total_duration": {"type": "string"},
        "actual_time_spent": {"type": "string"},
        "estimated_remaining": {"type": "string"}
      }
    }
  },
  "definitions": {
    "check": {
      "type": "object",
      "required": ["name", "type", "status"],
      "properties": {
        "name": {"type": "string"},
        "type": {"enum": ["manual", "automated"]},
        "command": {"type": "string"},
        "status": {"enum": ["pending", "passed", "failed", "skipped"]},
        "checked_at": {"type": "string", "format": "date-time"}
      }
    },
    "blocker": {
      "type": "object",
      "required": ["description", "severity"],
      "properties": {
        "description": {"type": "string"},
        "severity": {"enum": ["low", "medium", "high", "critical"]},
        "since": {"type": "string", "format": "date-time"}
      }
    },
    "subtask": {
      "type": "object",
      "required": ["id", "title", "status", "order"],
      "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "status": {"enum": ["pending", "in_progress", "completed"]},
        "order": {"type": "integer"}
      }
    },
    "risk": {
      "type": "object",
      "required": ["id", "description", "severity", "status"],
      "properties": {
        "id": {"type": "string"},
        "description": {"type": "string"},
        "impact": {"type": "string"},
        "probability": {"enum": ["low", "medium", "high"]},
        "severity": {"enum": ["low", "medium", "high", "critical"]},
        "mitigation": {"type": "string"},
        "status": {"enum": ["open", "mitigated", "accepted", "closed"]},
        "owner": {"type": "string"}
      }
    }
  }
}
```

### Example Plan Document

```json
{
  "schema_version": "1.0.0",
  "plan_metadata": {
    "session_name": "feature-auth",
    "goal": "Implement OAuth2 authentication system",
    "created_at": "2025-11-17T10:00:00Z",
    "last_updated": "2025-11-17T15:30:00Z",
    "planning_method": "interactive",
    "status": "in_progress",
    "conversation_snapshot": "auto_2025-11-17_10-00.md"
  },

  "phases": [
    {
      "id": "phase-1",
      "name": "Setup & Configuration",
      "description": "Initial project setup and provider configuration",
      "order": 1,
      "status": "completed",
      "started_at": "2025-11-17T10:00:00Z",
      "completed_at": "2025-11-17T12:00:00Z",
      "estimated_duration": "2h",
      "actual_duration": "2h",
      "task_ids": ["task-1", "task-2"],
      "completion_criteria": [
        "OAuth provider configured",
        "Environment variables set"
      ],
      "checks": [
        {
          "name": "Configuration validation",
          "type": "automated",
          "command": "npm run validate-config",
          "status": "passed",
          "checked_at": "2025-11-17T12:00:00Z"
        }
      ]
    },
    {
      "id": "phase-2",
      "name": "Core Implementation",
      "description": "Build authentication middleware and handlers",
      "order": 2,
      "status": "in_progress",
      "started_at": "2025-11-17T12:00:00Z",
      "completed_at": null,
      "estimated_duration": "4h",
      "actual_duration": null,
      "task_ids": ["task-3", "task-4", "task-5"],
      "completion_criteria": [
        "Middleware handles all OAuth flows",
        "Error handling implemented",
        "Tests passing"
      ],
      "checks": []
    }
  ],

  "tasks": [
    {
      "id": "task-1",
      "phase_id": "phase-1",
      "title": "Set up OAuth provider configuration",
      "description": "Configure Google OAuth provider with client credentials",
      "status": "completed",
      "priority": "high",
      "order": 1,
      "dependencies": [],
      "blockers": [],
      "started_at": "2025-11-17T10:00:00Z",
      "completed_at": "2025-11-17T11:30:00Z",
      "estimated_duration": "1-2h",
      "actual_duration": "1.5h",

      "subtasks": [
        {
          "id": "subtask-1-1",
          "title": "Create OAuth app in Google Console",
          "status": "completed",
          "order": 1
        },
        {
          "id": "subtask-1-2",
          "title": "Configure redirect URIs",
          "status": "completed",
          "order": 2
        },
        {
          "id": "subtask-1-3",
          "title": "Set environment variables",
          "status": "completed",
          "order": 3
        }
      ],

      "files_affected": [
        "src/config/oauth.ts",
        ".env.example",
        "config/providers.json"
      ],

      "snapshots": ["auto_2025-11-17_11-30.md"],

      "checks": [
        {
          "name": "Credentials valid",
          "type": "manual",
          "status": "passed",
          "checked_at": "2025-11-17T11:30:00Z"
        }
      ],

      "notes": "Chose Google as first provider for POC. Need Azure AD next."
    },
    {
      "id": "task-3",
      "phase_id": "phase-2",
      "title": "Implement authentication middleware",
      "description": "Create Express middleware for OAuth flow",
      "status": "in_progress",
      "priority": "high",
      "order": 3,
      "dependencies": ["task-1", "task-2"],
      "blockers": [
        {
          "description": "Waiting for OAuth credentials from DevOps",
          "severity": "medium",
          "since": "2025-11-17T14:00:00Z"
        }
      ],
      "started_at": "2025-11-17T12:00:00Z",
      "completed_at": null,
      "estimated_duration": "2-3h",
      "actual_duration": null,
      "subtasks": [],
      "files_affected": ["src/middleware/auth.ts"],
      "snapshots": [],
      "checks": [],
      "notes": ""
    }
  ],

  "completion_criteria": [
    {
      "description": "All OAuth providers configured",
      "status": "partial",
      "progress": "1/3 providers"
    },
    {
      "description": "Authentication middleware working",
      "status": "in_progress",
      "progress": "60%"
    },
    {
      "description": "Unit tests passing (>90% coverage)",
      "status": "pending",
      "progress": "0%"
    },
    {
      "description": "Security review completed",
      "status": "pending",
      "progress": "Not started"
    }
  ],

  "risks": [
    {
      "id": "risk-1",
      "description": "OAuth credentials needed for production",
      "impact": "Blocks deployment",
      "probability": "medium",
      "severity": "high",
      "mitigation": "Use environment variables and secrets management",
      "status": "open",
      "owner": "DevOps team"
    }
  ],

  "metrics": {
    "total_phases": 4,
    "completed_phases": 1,
    "total_tasks": 12,
    "completed_tasks": 2,
    "in_progress_tasks": 1,
    "blocked_tasks": 0,
    "pending_tasks": 9,
    "overall_progress_percent": 17,
    "estimated_total_duration": "20h",
    "actual_time_spent": "3.5h",
    "estimated_remaining": "16.5h"
  }
}
```

---

## Architecture Design

### File Structure
```
.claude/sessions/{session-name}/
├── session.md                    # High-level session metadata
├── context.md                    # Technical context and decisions
├── plans/                        # ⭐ NEW: Plans directory
│   ├── plan_oauth-implementation.json          # Structured plan
│   ├── conversation_oauth-implementation.md    # Conversation summary
│   ├── plan_api-refactoring.json
│   ├── conversation_api-refactoring.md
│   └── ...
├── .auto-capture-state           # Operational state
├── conversation-log.jsonl        # Interaction history
├── auto_YYYY-MM-DD_HH-MM.md      # Auto snapshots
├── YYYY-MM-DD_HH-MM.md           # Manual snapshots
└── git-history.json              # Git context

.claude/sessions/plans/           # Global plans (when no session active)
├── plan_quick-fix.json
├── conversation_quick-fix.md
└── ...
```

**File Naming Convention:**
- `plan_{name}.json` - Structured plan data
- `conversation_{name}.md` - Conversation summary/context
- Pattern recognition: `plan_*.json`, `conversation_*.md`

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│              /session:plan, /session:save-plan              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   COMMAND LAYER                              │
│               (commands/plan.md, etc.)                       │
│   • Parse user intent                                        │
│   • Validate session state                                   │
│   • Invoke CLI or Claude analysis                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐     ┌─────────────────────┐
│  CLAUDE ANALYSIS  │     │    CLI LAYER        │
│                   │     │                     │
│  • Analyze goal   │     │  plan-manager.js    │
│  • Extract tasks  │     │  • Create plan      │
│  • Suggest phases │     │  • Update tasks     │
│  • Link context   │     │  • Calculate metrics│
└─────────┬─────────┘     └──────────┬──────────┘
          │                          │
          └──────────┬───────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                              │
│              plan_{name}.json files                          │
│   • Atomic writes (lock-protected)                          │
│   • JSON schema validation                                   │
│   • Versioned via git                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   INDEX LAYER                                │
│                  .index.json                                 │
│   • Fast metadata queries                                    │
│   • Plan progress summary                                    │
│   • Latest task status                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   HOOK LAYER                                 │
│           (Optional auto-tracking)                           │
│   • post-tool-use.js → Link file changes to tasks           │
│   • stop.js → Detect task completion from responses         │
│   • user-prompt-submit.js → Track task interactions         │
└─────────────────────────────────────────────────────────────┘
```

### Component Interactions

**Planning Flow:**
```
1. User: /session:plan
2. Command reads session.md for goal
3. Claude analyzes goal + conversation context
4. Claude proposes phases/tasks (interactive review)
5. User confirms/edits
6. CLI creates plan_{name}.json (atomic write)
7. CLI updates .index.json with plan metadata
8. Status displayed to user
```

**Task Update Flow:**
```
1. User: /session:plan:update task-3 completed
2. Command validates task exists
3. CLI updates task status + timestamps
4. CLI recalculates metrics
5. CLI writes plan_{name}.json atomically
6. CLI updates index
7. Confirmation displayed
```

**Auto-Tracking Flow (Hook-based):**
```
1. User modifies file (e.g., Write tool on src/auth.ts)
2. post-tool-use hook detects file change
3. Hook checks plan_{name}.json for matching task
4. Hook finds task-1 references src/auth.ts
5. Hook suggests: "task-1 may be ready to complete"
6. User confirms or ignores
```

### CLI Module Structure

```
cli/lib/
├── plan-manager.js              # ⭐ NEW: Core plan operations
│   ├── createPlan()
│   ├── loadPlan()
│   ├── updateTask()
│   ├── addTask()
│   ├── calculateMetrics()
│   ├── validatePlan()
│   └── linkSnapshot()
│
├── template-manager.js          # ⭐ NEW: Template handling
│   ├── loadTemplate()
│   ├── listTemplates()
│   ├── applyTemplate()
│   └── customizeTemplate()
│
└── commands/
    ├── create-plan.js           # ⭐ NEW: CLI create plan
    ├── get-plan.js              # ⭐ NEW: CLI get plan
    ├── update-plan.js           # ⭐ NEW: CLI update task
    └── plan-status.js           # ⭐ NEW: CLI plan metrics
```

---

## Command Structure

### `/save-plan {name}` - Save Plan from Conversation

**Purpose:** Analyze current conversation and save structured plan with user-provided name

**Usage:** `/save-plan oauth-implementation`

**Flow:**

**Step 1: Parse Plan Name**
Extract plan name from arguments.

**Step 2: Check if Plan Exists**
```bash
existing=$(node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-exists "${plan_name}" "${session_name}" 2>/dev/null || echo "false")
```

If exists, ask user:
- Overwrite existing plan
- Create new version (oauth-implementation-v2)
- Cancel

**Step 3: Analyze Conversation**
Spawn subagent (Sonnet) to analyze entire conversation:
- Read conversation history
- Extract: goals, decisions, requirements, constraints, technical approach
- Structure into phases and tasks
- Create conversation summary

**Step 4: Save Plan via CLI**
```bash
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js save-plan "${plan_name}" "${session_name}" --stdin
{
  "plan": { ... plan JSON ... },
  "conversation_summary": "... markdown content ..."
}
EOF
```

**Step 5: Generate Execution Prompt**
CLI returns execution prompt for use in new session.

**Step 6: Display Confirmation**
Show files created, plan summary, and execution prompt.

---

## Implementation Phases

### Phase 1: Core Planning Infrastructure (4-6 hours)
**Goal:** Build foundation for conversation-driven planning

#### Features
- ✅ `/save-plan {name}` command
- ✅ Conversation analysis via subagent
- ✅ `plan_{name}.json` and `conversation_{name}.md` storage
- ✅ Execution prompt generation
- ✅ Duplicate handling (overwrite/version/cancel)

#### Files to Create
```
session/
├── commands/
│   └── save-plan.md                 # /save-plan command
├── cli/lib/commands/
│   └── plan-ops.js                  # All plan operations (~300 lines)
├── prompts/
│   └── analyze-conversation.md      # Conversation analysis prompt
└── schemas/
    └── plan-schema.json             # Simplified JSON schema
```

#### Files to Modify
```
session/
├── plugin.json                      # Register /save-plan
├── cli/lib/session-cli.js           # Register plan-ops commands
└── cli/lib/index-manager.js         # Add plan metadata
```

#### Success Criteria
- ✅ Can save plan from conversation with `/save-plan {name}`
- ✅ Creates both files with correct naming
- ✅ Works in session and non-session contexts
- ✅ Duplicate handling works correctly
- ✅ Generates valid execution prompt

---

### Phase 2: Plan Execution Support (2-3 hours)
**Goal:** Enable systematic plan execution in new sessions

#### Features
- ✅ Plan loading from execution prompt
- ✅ Task status tracking (`updateTaskStatus`)
- ✅ Progress display in `/session:status`
- ✅ Deviation detection with user alerts

#### Implementation
- Update `/session:status` to show plan summary
- Add deviation validation before new tasks
- Task status updates via Node CLI tools
- Bold alerts for plan deviations

#### Success Criteria
- ✅ Can load and execute plan in new session
- ✅ Task updates work atomically (~50 tokens each)
- ✅ Status shows plan progress
- ✅ Deviation alerts appear before unplanned work

---

### Phase 3: Testing & Documentation (1-2 hours)
**Goal:** Ensure reliability and provide clear guidance

#### Tasks
- Test complete workflow (planning → execution)
- Test with/without sessions
- Test duplicate handling
- Test deviation detection
- Update README with planning features
- Document `/save-plan` usage
- Add examples and best practices

#### Success Criteria
- ✅ All workflows tested and working
- ✅ Documentation complete and clear
- ✅ Zero npm dependencies
- ✅ Pattern recognition works (`plan_*.json`)

**Total Effort: 7-11 hours** (down from 26-34 hours in original design)

---

## Conversation Analysis

### How It Works

When user calls `/save-plan {name}`, Claude analyzes the entire conversation to extract structured planning information.

### Analysis Process

**Step 1: Conversation Reading**
- Subagent reads entire conversation history
- Includes both user and Claude messages
- Focuses on summary and key points (not verbatim)

**Step 2: Information Extraction**

Subagent extracts:
- **Goal:** What are we trying to build/achieve?
- **Key Decisions:** Technical choices made (libraries, tools, approaches)
- **Requirements:** Must-haves, features, capabilities
- **Constraints:** Limitations, restrictions, compatibility needs
- **Technical Approach:** Architecture patterns, integration points
- **Tasks & Phases:** Work breakdown from discussion
- **Timeline Estimates:** If mentioned in conversation

**Step 3: Structuring**
- Group related tasks into phases (2-5 phases typically)
- Assign order/priority to tasks
- Extract estimated durations
- Identify dependencies mentioned

**Step 4: Conversation Summary Creation**
- Create markdown summary of key discussion points
- Include decisions and rationale
- Document requirements and constraints
- Note technical approaches discussed

### Token Implications

- **Subagent isolation:** Analysis happens in separate context (not main conversation)
- **Main conversation cost:** ~100 tokens (just the CLI tool call)
- **Subagent cost:** Varies by conversation length, but isolated from user conversation
- **Result:** User conversation stays efficient, analysis work delegated

### Handling Edge Cases

- **Short conversations:** Extract what's available, mark as draft plan
- **Unclear goals:** Ask clarifying questions before analysis
- **No technical decisions:** Create basic structure, user can refine
- **Very long conversations:** Focus on recent discussion + key points

---

## File Naming Convention

### Pattern: Type-First Prefixes

All plan-related files use type-first prefixes for easy pattern recognition:

- `plan_{name}.json` - Structured plan data
- `conversation_{name}.md` - Conversation summary/context

### Benefits

**1. Pattern Recognition**
```bash
# Find all plans
Glob: plan_*.json

# Find all conversations
Glob: conversation_*.md

# Find all files for specific plan
Glob: *_oauth-implementation.*
```

**2. Alphabetical Grouping**
```
Directory listing:
conversation_api-refactoring.md
conversation_oauth-implementation.md
plan_api-refactoring.json
plan_oauth-implementation.json
```
All plans group together, all conversations group together.

**3. Type-First Clarity**
Immediately obvious what type of file it is when browsing or globbing.

**4. Future Extensibility**
```
plan_oauth-implementation.json
conversation_oauth-implementation.md
execution_oauth-implementation.md      # Future: execution logs
context_oauth-implementation.md        # Future: external context
review_oauth-implementation.md         # Future: code reviews
```

### CLI Tool Usage

```javascript
// Tools automatically add/remove prefixes
loadPlan("oauth-implementation")  // Reads: plan_oauth-implementation.json
savePlan("oauth-implementation", ...) // Writes: plan_* and conversation_*
planExists("oauth-implementation") // Checks: plan_oauth-implementation.json
```

Users never deal with prefixes directly - tools handle it.

---

## Execution in New Session

### Why Fresh Sessions?

Plans are executed in new sessions (not same session as planning) for several reasons:

1. **Clean context:** Fresh conversation without planning discussion noise
2. **Focused execution:** Claude loads plan and works systematically
3. **Token efficiency:** Planning conversation can be long; execution starts clean
4. **Reusability:** Same plan can be executed multiple times in different sessions

### Execution Workflow

**Step 1: Planning Phase (Original Conversation)**
```
User and Claude discuss → /save-plan oauth-implementation → Plan saved
```

**Step 2: Session Creation**
```bash
User: /session:start oauth-implementation-work
```

**Step 3: Load Plan (Execution Prompt)**
```
User: Load and execute plan: oauth-implementation
      Read plan from .claude/sessions/feature-auth/plans/plan_oauth-implementation.json
      Review context from conversation_oauth-implementation.md
      Begin Phase 1, Task 1 and update status as work progresses.
```

**Step 4: Systematic Execution**
```javascript
// Claude loads plan
const plan = loadPlan("oauth-implementation");
const status = getPlanStatus("oauth-implementation");
// Returns: { currentTask: "task-1", taskTitle: "Set up OAuth provider", ... }

// Claude works on task-1
[... does work ...]

// Claude completes task-1
updateTaskStatus("oauth-implementation", "task-1", "completed");

// Claude checks next task
const status = getPlanStatus("oauth-implementation");
// Returns: { currentTask: "task-2", ... }

// Continues through all tasks...
```

**Step 5: Progress Tracking**
User can check status anytime:
```bash
User: /session:status

Output:
Session: oauth-implementation-work
Status: Active

📋 Plan: oauth-implementation
   Progress: 35% (5/14 tasks completed)
   Phase: 2/4 - Core Implementation
   Current: task-6 "Implement auth middleware"
   Next: task-7 "Add token refresh"
```

### Deviation Handling During Execution

Before starting unplanned work, Claude validates:

```javascript
const validation = validateNextWork("oauth-implementation", "add rate limiting");
if (validation.isDeviation) {
  // Show BOLD alert, ask user permission
}
```

### Auto-Generated Execution Prompts

When plan is saved, Claude generates a standard execution prompt:

```
Load and execute plan: {plan-name}

Read plan from: {plan-path}/plan_{name}.json
Review context from: conversation_{name}.md

Begin Phase 1, Task 1: "{first-task-title}"

Update task status as work progresses.
Alert if deviating from plan.
```

User copies this prompt into new session to start execution.

---

## Template System

**Status:** TO BE DISCUSSED

Templates are a potential future enhancement to the conversation-driven planning system. Rather than core features, they could serve as:

1. **Conversation starters:** Template questions to guide planning discussions
2. **Plan validation:** Check if extracted plan matches template patterns
3. **Execution helpers:** Pre-filled plans for common workflows

This section is preserved for reference but templates are NOT part of the initial implementation. We will discuss template design separately.

[Keep existing template examples below as reference]

### Default Templates

#### 1. Feature Development Template
```json
{
  "template_name": "feature-development",
  "version": "1.0.0",
  "description": "Standard template for new feature development",
  "default_phases": [
    {
      "name": "Requirements & Design",
      "estimated_duration": "10-20% of total time",
      "default_tasks": [
        "Analyze requirements and user needs",
        "Review existing architecture",
        "Design solution approach",
        "Create technical specification",
        "Identify dependencies and risks"
      ],
      "completion_criteria": [
        "Requirements documented and validated",
        "Design reviewed and approved",
        "Technical specification complete"
      ],
      "checks": [
        {"name": "Requirements review", "type": "manual"},
        {"name": "Design review", "type": "manual"}
      ]
    },
    {
      "name": "Core Implementation",
      "estimated_duration": "40-50% of total time",
      "default_tasks": [
        "Set up project structure",
        "Implement core functionality",
        "Add error handling",
        "Create unit tests",
        "Handle edge cases"
      ],
      "completion_criteria": [
        "All core features working",
        "Error handling comprehensive",
        "Unit tests passing (>80% coverage)"
      ],
      "checks": [
        {"name": "Unit tests passing", "type": "automated", "command": "npm test"},
        {"name": "Coverage threshold met", "type": "automated", "command": "npm run coverage"}
      ]
    },
    {
      "name": "Integration & Testing",
      "estimated_duration": "20-30% of total time",
      "default_tasks": [
        "Integration testing",
        "End-to-end testing",
        "Performance testing",
        "Security review",
        "Bug fixes"
      ],
      "completion_criteria": [
        "Integration tests passing",
        "Performance benchmarks met",
        "Security scan clean",
        "All critical bugs fixed"
      ],
      "checks": [
        {"name": "Integration tests", "type": "automated"},
        {"name": "Security scan", "type": "automated"},
        {"name": "Performance benchmarks", "type": "automated"}
      ]
    },
    {
      "name": "Documentation & Deployment",
      "estimated_duration": "10-15% of total time",
      "default_tasks": [
        "Update documentation",
        "Create migration guide",
        "Deploy to staging",
        "Validate in staging",
        "Deploy to production"
      ],
      "completion_criteria": [
        "Documentation complete",
        "Deployment successful",
        "Production validation passed"
      ],
      "checks": [
        {"name": "Documentation review", "type": "manual"},
        {"name": "Staging deployment", "type": "automated"},
        {"name": "Production smoke tests", "type": "automated"}
      ]
    }
  ],
  "default_risks": [
    {
      "description": "Requirements may change during implementation",
      "mitigation": "Regular stakeholder check-ins, incremental delivery",
      "severity": "medium"
    },
    {
      "description": "Technical dependencies may cause delays",
      "mitigation": "Identify dependencies early, have fallback plans",
      "severity": "medium"
    }
  ]
}
```

#### 2. Bug Fix Template
```json
{
  "template_name": "bug-fix",
  "version": "1.0.0",
  "description": "Template for debugging and fixing issues",
  "default_phases": [
    {
      "name": "Investigation & Root Cause",
      "estimated_duration": "30-40% of total time",
      "default_tasks": [
        "Reproduce the bug",
        "Gather logs and error traces",
        "Identify affected components",
        "Trace root cause",
        "Document findings"
      ],
      "completion_criteria": [
        "Bug consistently reproducible",
        "Root cause identified",
        "Impact assessed"
      ],
      "checks": [
        {"name": "Bug reproduced", "type": "manual"},
        {"name": "Root cause documented", "type": "manual"}
      ]
    },
    {
      "name": "Fix Implementation",
      "estimated_duration": "30-40% of total time",
      "default_tasks": [
        "Implement fix",
        "Add regression tests",
        "Verify fix resolves issue",
        "Check for side effects"
      ],
      "completion_criteria": [
        "Fix implemented",
        "Bug no longer reproducible",
        "Tests prevent regression"
      ],
      "checks": [
        {"name": "Fix verified", "type": "manual"},
        {"name": "Regression tests added", "type": "manual"},
        {"name": "All tests passing", "type": "automated", "command": "npm test"}
      ]
    },
    {
      "name": "Testing & Verification",
      "estimated_duration": "20-30% of total time",
      "default_tasks": [
        "Test fix in isolation",
        "Integration testing",
        "User acceptance testing",
        "Deploy to staging"
      ],
      "completion_criteria": [
        "Fix verified across environments",
        "No new bugs introduced",
        "User confirms resolution"
      ],
      "checks": [
        {"name": "Integration tests passing", "type": "automated"},
        {"name": "User acceptance", "type": "manual"}
      ]
    }
  ],
  "default_completion_criteria": [
    "Bug no longer reproducible",
    "Root cause addressed (not just symptoms)",
    "Regression tests in place",
    "Documentation updated"
  ]
}
```

#### 3. Refactoring Template
```json
{
  "template_name": "refactoring",
  "version": "1.0.0",
  "description": "Template for code refactoring projects",
  "default_phases": [
    {
      "name": "Analysis & Planning",
      "estimated_duration": "20-25% of total time",
      "default_tasks": [
        "Identify code smells and issues",
        "Measure current metrics (complexity, coverage)",
        "Define refactoring goals",
        "Plan incremental changes",
        "Set up safety net (tests, monitoring)"
      ],
      "completion_criteria": [
        "Code issues documented",
        "Baseline metrics captured",
        "Refactoring plan approved",
        "Tests provide adequate coverage"
      ],
      "checks": [
        {"name": "Baseline tests passing", "type": "automated", "command": "npm test"},
        {"name": "Coverage baseline", "type": "automated", "command": "npm run coverage"}
      ]
    },
    {
      "name": "Incremental Refactoring",
      "estimated_duration": "50-60% of total time",
      "default_tasks": [
        "Refactor in small, safe steps",
        "Run tests after each change",
        "Commit frequently",
        "Monitor for regressions",
        "Update tests as needed"
      ],
      "completion_criteria": [
        "All planned refactorings complete",
        "Tests still passing",
        "No behavior changes",
        "Code quality metrics improved"
      ],
      "checks": [
        {"name": "Tests passing", "type": "automated", "command": "npm test"},
        {"name": "No behavior changes", "type": "manual"}
      ]
    },
    {
      "name": "Validation & Cleanup",
      "estimated_duration": "20-25% of total time",
      "default_tasks": [
        "Compare metrics before/after",
        "Performance benchmarking",
        "Code review",
        "Update documentation",
        "Clean up deprecated code"
      ],
      "completion_criteria": [
        "Metrics show improvement",
        "Performance maintained or improved",
        "Documentation current",
        "No dead code remaining"
      ],
      "checks": [
        {"name": "Performance benchmarks", "type": "automated"},
        {"name": "Code review completed", "type": "manual"}
      ]
    }
  ],
  "default_completion_criteria": [
    "Code quality metrics improved",
    "All tests passing",
    "No performance regressions",
    "Documentation updated"
  ]
}
```

#### 4. Spike/Research Template
```json
{
  "template_name": "spike",
  "version": "1.0.0",
  "description": "Template for research and exploration tasks",
  "default_phases": [
    {
      "name": "Research & Discovery",
      "estimated_duration": "40-50% of total time",
      "default_tasks": [
        "Define research questions",
        "Survey existing solutions",
        "Review documentation",
        "Prototype key concepts",
        "Document findings"
      ],
      "completion_criteria": [
        "Research questions answered",
        "Options evaluated",
        "Findings documented"
      ],
      "checks": [
        {"name": "Research questions answered", "type": "manual"},
        {"name": "Findings documented", "type": "manual"}
      ]
    },
    {
      "name": "Evaluation & Decision",
      "estimated_duration": "30-40% of total time",
      "default_tasks": [
        "Compare options",
        "Assess trade-offs",
        "Risk analysis",
        "Create recommendation",
        "Get stakeholder feedback"
      ],
      "completion_criteria": [
        "Options compared objectively",
        "Recommendation made",
        "Stakeholders aligned"
      ],
      "checks": [
        {"name": "Recommendation review", "type": "manual"}
      ]
    },
    {
      "name": "Documentation & Handoff",
      "estimated_duration": "10-20% of total time",
      "default_tasks": [
        "Write spike summary",
        "Document decision rationale",
        "Create action items",
        "Share with team"
      ],
      "completion_criteria": [
        "Spike documented",
        "Next steps clear",
        "Team informed"
      ],
      "checks": [
        {"name": "Documentation complete", "type": "manual"}
      ]
    }
  ],
  "default_completion_criteria": [
    "Research questions answered",
    "Recommendation provided",
    "Findings documented and shared"
  ]
}
```

### Template Application Logic

```javascript
// cli/lib/template-manager.js

function applyTemplate(template, sessionGoal, customizations = {}) {
  const plan = {
    schema_version: "1.0.0",
    plan_metadata: {
      session_name: customizations.session_name,
      goal: sessionGoal,
      created_at: new Date().toISOString(),
      planning_method: "template",
      status: "draft",
      template_used: template.template_name
    },
    phases: [],
    tasks: [],
    completion_criteria: template.default_completion_criteria || [],
    risks: template.default_risks || [],
    metrics: {
      total_phases: 0,
      total_tasks: 0,
      completed_tasks: 0,
      overall_progress_percent: 0
    }
  };

  // Apply phases
  let taskCounter = 1;
  template.default_phases.forEach((phaseTemplate, phaseIndex) => {
    const phaseId = `phase-${phaseIndex + 1}`;

    const phase = {
      id: phaseId,
      name: phaseTemplate.name,
      description: phaseTemplate.description,
      order: phaseIndex + 1,
      status: "pending",
      started_at: null,
      completed_at: null,
      estimated_duration: phaseTemplate.estimated_duration,
      task_ids: [],
      completion_criteria: phaseTemplate.completion_criteria,
      checks: phaseTemplate.checks
    };

    // Create tasks from template
    phaseTemplate.default_tasks.forEach((taskTitle, taskIndex) => {
      const taskId = `task-${taskCounter++}`;

      const task = {
        id: taskId,
        phase_id: phaseId,
        title: taskTitle,
        description: "",
        status: "pending",
        priority: "medium",
        order: taskIndex + 1,
        dependencies: [],
        blockers: [],
        started_at: null,
        completed_at: null,
        estimated_duration: "",
        actual_duration: null,
        subtasks: [],
        files_affected: [],
        snapshots: [],
        checks: [],
        notes: ""
      };

      plan.tasks.push(task);
      phase.task_ids.push(taskId);
    });

    plan.phases.push(phase);
  });

  // Calculate initial metrics
  plan.metrics.total_phases = plan.phases.length;
  plan.metrics.total_tasks = plan.tasks.length;

  return plan;
}
```

---

## Internal Tracking Mechanism

### Multi-Layer Tracking Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: PLAN FILES                       │
│                   (plan_{name}.json)                         │
│  • Source of truth for task structure                       │
│  • Updated via CLI (atomic writes)                          │
│  • Versioned via git                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 2: INDEX INTEGRATION                   │
│                    (.index.json)                             │
│  • Fast metadata queries (<10ms)                            │
│  • Plan progress metrics cached                             │
│  • Latest plan snapshot time                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 3: HOOK INTEGRATION                    │
│              (hooks/task-progress.js)                        │
│  • user-prompt-submit → Track interactions per task         │
│  • post-tool-use → Link file changes to tasks               │
│  • stop → Detect task completion from responses             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                LAYER 4: SNAPSHOT LINKING                     │
│           (auto_YYYY-MM-DD_HH-MM.md)                         │
│  • Snapshots reference completed tasks                       │
│  • Plan references relevant snapshots                        │
│  • Bidirectional linking                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             LAYER 5: CONVERSATION LOG                        │
│              (conversation-log.jsonl)                        │
│  • Track when tasks started/completed                        │
│  • Link planning decisions to interactions                   │
│  • Audit trail for plan changes                             │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Detection Logic (Hook)

```javascript
// hooks/task-progress.js

const fs = require('fs');
const path = require('path');
const { getLock } = require('../cli/lib/lock-manager');
const { loadPlan, updateTaskStatus } = require('../cli/lib/plan-manager');

async function detectTaskProgress() {
  // Early exit checks (graceful failure)
  const activeSession = getActiveSession();
  if (!activeSession) return;

  const planDir = path.join('.claude/sessions', activeSession, 'plans');
  if (!fs.existsSync(planDir)) return;

  // Acquire lock (prevent race conditions)
  const lock = await getLock('task-progress');
  if (!lock) return; // Someone else updating, skip

  try {
    // Load plan and current state
    const plan = await loadPlan(activeSession);
    const state = loadAutoCaptureState(activeSession);
    const recentFiles = state.modified_files.slice(-5); // Last 5 files

    // Find tasks that might be ready
    const suggestions = [];

    for (const task of plan.tasks) {
      if (task.status === 'in_progress') {
        // Check if task files were recently modified
        const taskFilesModified = task.files_affected.some(file =>
          recentFiles.some(rf => rf.path === file)
        );

        if (taskFilesModified) {
          suggestions.push({
            task_id: task.id,
            task_title: task.title,
            reason: 'Files modified',
            files: task.files_affected.filter(f =>
              recentFiles.some(rf => rf.path === f)
            )
          });
        }
      }
    }

    // Store suggestions (don't auto-complete)
    if (suggestions.length > 0) {
      fs.writeFileSync(
        path.join('.claude/sessions', activeSession, '.task-suggestions.json'),
        JSON.stringify({ suggestions, timestamp: new Date().toISOString() }, null, 2)
      );
    }

  } finally {
    lock.release();
  }
}

// Hook entry point
detectTaskProgress().catch(err => {
  // Silent failure (never block Claude Code)
  console.error('[task-progress] Error:', err.message);
});
```

### Index Integration

```javascript
// Extend .index.json with plan metadata

{
  "version": "1.0",
  "sessions": {
    "feature-auth": {
      "name": "feature-auth",
      "status": "active",
      "started": "2025-11-17 14:30",
      "lastUpdated": "2025-11-17T18:45:00Z",
      "goal": "Implement OAuth2 authentication",

      // ⭐ NEW: Plan metadata
      "hasPlan": true,
      "planMetadata": {
        "total_tasks": 12,
        "completed_tasks": 2,
        "in_progress_tasks": 1,
        "blocked_tasks": 0,
        "overall_progress_percent": 17,
        "current_phase": "phase-2",
        "current_phase_name": "Core Implementation",
        "next_task": "task-4",
        "next_task_title": "Create login/logout handlers",
        "last_plan_update": "2025-11-17T18:30:00Z"
      },

      "filesInvolved": ["src/auth.ts", "src/middleware.ts"],
      "snapshotCount": 5
    }
  }
}
```

### Snapshot Linking

```markdown
# Consolidated Snapshot: feature-auth
**Timestamp**: 2025-11-17T18:30:00Z

## Conversation Summary
Implemented OAuth provider configuration for Google authentication...

## Completed Tasks (from plan)
- [x] task-1: Set up OAuth provider configuration
  - Status: completed at 2025-11-17T11:30:00Z
  - Duration: 1.5h (estimated: 1-2h)
  - Files: src/config/oauth.ts, .env.example
  - Notes: Google provider configured successfully

- [x] task-2: Configure environment variables
  - Status: completed at 2025-11-17T12:00:00Z
  - Duration: 0.5h (estimated: 0.5-1h)
  - Files: .env.example, config/providers.json

## Current Work (from plan)
- 🔄 task-3: Implement authentication middleware (in-progress)
  - Started: 2025-11-17T12:00:00Z
  - Blocker: Waiting for OAuth credentials from DevOps
  - Files: src/middleware/auth.ts

## Plan Progress
Phase 1 (Setup & Configuration): ✓ Completed
Phase 2 (Core Implementation): 🔄 In Progress (1/3 tasks)

Overall: 17% complete (2/12 tasks)
```

---

## Risk Mitigation

### Critical Risks and Mitigation Strategies

#### Risk 1: Bash Parse Errors
**Severity:** High
**Probability:** High (if not careful)
**Impact:** Commands fail, users blocked

**Mitigation:**
```bash
# ❌ AVOID: Complex bash with pipes and command substitution
tasks=$(node cli/plan.js get | jq '.tasks | length')

# ✅ USE: CLI writes to file, Read tool loads it
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js plan-status "${session_name}" > /tmp/plan-status.txt
# Then use Read tool on /tmp/plan-status.txt

# ✅ OR: Use heredoc for JSON input
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js create-plan "${session_name}" --stdin
{
  "goal": "Implement OAuth",
  "phases": [...]
}
EOF
```

**Testing:** Test all commands in actual Claude Code environment before release

---

#### Risk 2: Subagent Reliability
**Severity:** High
**Probability:** Medium
**Impact:** Plan creation fails silently

**Mitigation:**
```markdown
# In commands/plan.md

**Step 6: Create Plan via Subagent**
Spawn planning subagent (use Sonnet, not Haiku for complex analysis):

Subagent prompt:
"""
set -e  # Exit on any error

# Step 1: Analyze goal
goal="..."

# Step 2: Create plan JSON
plan_json='{...}'

# Step 3: Save via CLI
echo "$plan_json" | node cli/session-cli.js create-plan "$session" --stdin

# Step 4: VERIFY plan was saved
if [ ! -f ".claude/sessions/$session/plans/plan_${plan_name}.json" ]; then
  echo "ERROR: Plan file not created"
  exit 1
fi

# Step 5: VERIFY plan is valid JSON
if ! node cli/session-cli.js validate-plan "$session"; then
  echo "ERROR: Plan JSON is invalid"
  exit 1
fi

# Step 6: SUCCESS - return only if all steps passed
echo "SUCCESS: Plan created with X tasks in Y phases"
"""

**Step 7: Verify Success**
Check subagent output for "SUCCESS" message.
If not present, retry ONCE.
If second attempt fails, fall back to manual plan creation.
```

**Testing:** Test subagent under various conditions (empty goal, complex goal, etc.)

---

#### Risk 3: Hook Orphaning
**Severity:** Medium
**Probability:** Low (with auto-detection)
**Impact:** Hooks run after plugin uninstalled

**Mitigation:**
```javascript
// hooks/task-progress.js - Add orphan detection

async function detectTaskProgress() {
  // Orphan check (every 20 prompts)
  const counter = incrementOrphanCheckCounter();
  if (counter % 20 === 0) {
    const pluginStillInstalled = fs.existsSync(
      path.join(process.env.CLAUDE_PLUGIN_ROOT, 'plugin.json')
    );

    if (!pluginStillInstalled) {
      console.log('[task-progress] Plugin uninstalled, self-removing hook');
      uninstallHook('task-progress');
      return;
    }
  }

  // Rest of hook logic...
}
```

**Testing:** Test uninstall flow, verify hooks cleanup

---

#### Risk 4: Race Conditions
**Severity:** High
**Probability:** Low (with locks)
**Impact:** Plan corruption, lost data

**Mitigation:**
```javascript
// ALL plan writes MUST use lock

const { getLock } = require('./lock-manager');

async function updateTaskStatus(sessionName, taskId, status) {
  const lock = await getLock(`plan-${sessionName}`);
  if (!lock) {
    throw new Error('Could not acquire lock');
  }

  try {
    // Atomic write:
    // 1. Read current plan
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

    // 2. Modify in memory
    const task = plan.tasks.find(t => t.id === taskId);
    task.status = status;
    task.completed_at = new Date().toISOString();

    // 3. Recalculate metrics
    recalculateMetrics(plan);

    // 4. Write atomically (tmp file + rename)
    const tmpPath = `${planPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(plan, null, 2));
    fs.renameSync(tmpPath, planPath);

  } finally {
    lock.release();
  }
}
```

**Testing:** Concurrent write stress test

---

#### Risk 5: Plan Mode Restrictions
**Severity:** Medium
**Probability:** Medium
**Impact:** Can't create plans in plan mode

**Mitigation:**
```bash
# Use CLI delegation (Bash tool allowed in plan mode)

# ✅ This works in plan mode:
cat <<'EOF' | node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js create-plan "${session}" --stdin
{
  "goal": "...",
  "phases": [...]
}
EOF

# Bash tool bypasses Write tool restrictions
# CLI is external process (not blocked)
```

**Testing:** Test all planning commands in plan mode

---

#### Risk 6: Large Plan Performance
**Severity:** Low
**Probability:** Medium (for complex projects)
**Impact:** Slow status queries, high token usage

**Mitigation:**
```javascript
// Use hybrid pointer pattern (like session v3.7.0)

// ❌ Don't load full plan in conversation:
const plan = loadFullPlan(); // 50KB JSON
claudeContext.add(JSON.stringify(plan)); // Wastes tokens

// ✅ Show minimal summary, lazy load details:
const summary = {
  total_tasks: 50,
  completed: 30,
  in_progress: 5,
  next_task: "task-31: Add rate limiting"
};
claudeContext.add(summary); // 100 bytes vs 50KB

// Full plan available via: /session:plan (if user needs it)
```

**Testing:** Test with 100+ task plan

---

#### Risk 7: Task Auto-Detection Accuracy
**Severity:** Low
**Probability:** High (ML is hard)
**Impact:** False suggestions annoy users

**Mitigation:**
```javascript
// Conservative matching (high precision, lower recall)

function suggestTaskCompletion(task, recentActivity) {
  let confidence = 0;

  // File matching (30 points)
  if (task.files_affected.some(f => recentActivity.files.includes(f))) {
    confidence += 30;
  }

  // Todo completion (40 points)
  if (recentActivity.todos_completed.some(t =>
    t.toLowerCase().includes(task.title.toLowerCase())
  )) {
    confidence += 40;
  }

  // Explicit user statement (30 points)
  if (recentActivity.user_statements.some(s =>
    s.includes('finished') || s.includes('completed')
  )) {
    confidence += 30;
  }

  // Only suggest if confidence >70
  return confidence > 70 ? {
    task,
    confidence,
    suggestion: `Task "${task.title}" may be complete. Update status?`
  } : null;
}

// NEVER auto-complete (always require user confirmation)
```

**Testing:** Track false positive rate, aim for <10%

---

## Past Bug Lessons

### Lesson 1: Bash Parse Errors (v3.8.5-3.8.6)
**What Happened:** Commands with `$(pipe | syntax)` failed
**Root Cause:** Bash tool doesn't handle complex command substitution
**Impact:** 100% failure rate for affected commands

**Prevention in Planning Feature:**
- ✅ Use CLI + Read tool pattern instead of bash pipes
- ✅ Test all commands before release
- ✅ Use heredoc for JSON input (not command substitution)
- ✅ Keep bash commands simple (no nesting, no pipes)

**Example:**
```bash
# ❌ Will fail:
count=$(node cli/plan.js get | jq '.tasks | length')

# ✅ Will work:
node cli/plan.js get-plan oauth-implementation > /tmp/plan_oauth-implementation.json
# Then use Read tool to parse /tmp/plan_oauth-implementation.json
```

---

### Lesson 2: Subagent Reliability (v3.7.1)
**What Happened:** Consolidation subagent failed 60% of the time
**Root Cause:**
- Wrong CLI syntax (flags instead of JSON)
- No error checking (`set -e` missing)
- No verification steps
- Wrong model (Haiku too weak)

**Prevention in Planning Feature:**
- ✅ Use `set -e` in all subagent scripts
- ✅ Verify each step before proceeding
- ✅ Use Sonnet for complex tasks (Haiku only for simple queries)
- ✅ Test CLI syntax separately first
- ✅ Add retry logic (1 retry max)

**Example:**
```bash
# Subagent script structure:
set -e  # Exit on any error

# Step 1: Do work
result=$(do_work)

# Step 2: VERIFY step 1 succeeded
if [ -z "$result" ]; then
  echo "ERROR: Step 1 failed"
  exit 1
fi

# Step 3: Only continue if verified
do_next_step "$result"

# Final: Verify complete success
verify_all_steps || exit 1

echo "SUCCESS: All verified"
```

---

### Lesson 3: Hook Orphaning
**What Happened:** Hooks remained active after plugin uninstall
**Impact:** Errors logged, hooks tried to run on missing plugin

**Prevention in Planning Feature:**
- ✅ Add orphan detection (every 20 prompts)
- ✅ Graceful failure if plugin missing
- ✅ Auto-cleanup on detection
- ✅ Document cleanup process in README

**Implementation:** See "Hook Orphaning" in Risk Mitigation

---

### Lesson 4: Stop Hook Transcript Parsing (v3.6.4)
**What Happened:** Hook couldn't parse Claude responses
**Root Cause:** Used wrong transcript field (`entry.role` vs `entry.type`)

**Prevention in Planning Feature:**
- ✅ Test hook with actual transcript data
- ✅ Add error handling for missing fields
- ✅ Add exponential backoff retry for file reads
- ✅ Log errors for debugging (silent to user)

---

### Lesson 5: Zsh Compatibility (v3.8.2)
**What Happened:** `ls -t auto_*.md` failed in zsh when no files
**Impact:** macOS default shell broke

**Prevention in Planning Feature:**
- ✅ Test on both bash and zsh
- ✅ Use `find` instead of `ls` with globs
- ✅ Check file existence before operations
- ✅ Test empty state (no plan_{name}.json, no tasks, etc.)

---

## Technical Challenges

### Challenge 1: Plan Complexity vs Performance
**Issue:** Large plans (50+ tasks) slow down queries

**Solution:**
- Cache metrics in `.index.json`
- Lazy load task details (only show summary by default)
- CLI handles parsing (zero tokens)
- Hybrid pointer pattern (80 tokens vs 50KB)

**Implementation:**
```javascript
// Fast status query (no full plan load)
function getQuickStatus(sessionName) {
  const index = loadIndex();
  return index.sessions[sessionName].planMetadata; // <100 bytes
}

// Full plan only when explicitly requested
function getFullPlan(sessionName) {
  return JSON.parse(fs.readFileSync(planPath)); // 50KB+
}
```

---

### Challenge 2: Task Auto-Detection Accuracy
**Issue:** False positives/negatives when detecting completion

**Solution:**
- Conservative matching (high precision)
- Multi-signal detection (files + todos + statements)
- Confidence scoring (only suggest >70%)
- Never auto-complete (always confirm)
- Manual override always available

**See:** "Risk 7: Task Auto-Detection Accuracy" in Risk Mitigation

---

### Challenge 3: Plan Drift from Reality
**Issue:** Users complete work without updating plan

**Solution:**
- Snapshot consolidation links work to tasks automatically
- Periodic plan review prompts (every 10 interactions)
- Show "unplanned work" in status (files modified not in plan)
- Don't enforce strict adherence (plan is guide, not law)

**Implementation:**
```javascript
// Detect unplanned work
function detectUnplannedWork(sessionName) {
  const plan = loadPlan(sessionName);
  const state = loadAutoCaptureState(sessionName);

  const plannedFiles = new Set(
    plan.tasks.flatMap(t => t.files_affected)
  );

  const unplannedFiles = state.modified_files.filter(
    f => !plannedFiles.has(f.path)
  );

  if (unplannedFiles.length > 0) {
    return {
      message: `${unplannedFiles.length} files modified outside of plan`,
      files: unplannedFiles,
      suggestion: 'Update plan or add tasks for unplanned work'
    };
  }
}
```

---

### Challenge 4: Template Rigidity
**Issue:** Templates might not fit all workflows

**Solution:**
- Templates are starting points (not constraints)
- Easy to add/remove/modify phases
- Support custom templates (user-defined)
- "Freeform" template option (no structure)
- Can ignore template and create from scratch

---

### Challenge 5: Token Overhead
**Issue:** Loading plan context uses tokens

**Solution:**
- Hybrid pointer pattern (3-line summary)
- Lazy load details (only if user asks)
- CLI delegation for queries (zero tokens)
- Cache in index (fast metadata)

**Target:** <100 tokens for plan status display

---

### Challenge 6: User Adoption
**Issue:** Users might not use planning features

**Solution:**
- Make it optional (not required)
- Show value with metrics (progress %, time tracking)
- Auto-suggest planning for complex sessions
- Quick commands (minimal friction)
- Demonstrate ROI (time saved, clarity gained)

**Adoption Strategy:**
1. **Awareness:** Mention in `/session:start` output
2. **Value:** Show progress in `/session:status`
3. **Ease:** One command to start (`/session:plan`)
4. **Proof:** Track and display metrics

---

## Design Decisions

### Decision 1: JSON vs Markdown
**Choice:** JSON for data, Markdown for display

**Reasoning:**
- **JSON:** Structured, parseable, queryable, schema-validated
- **Markdown:** Human-readable, git-friendly, easy manual editing
- **Best of both:** Store as JSON, convert to pretty markdown for viewing

**Implementation:**
```bash
# Storage: plan_{name}.json (machine-readable)
{
  "tasks": [...],
  "phases": [...]
}

# Display: CLI converts to markdown
$ node cli/session-cli.js plan-display feature-auth oauth-implementation

# Output:
## Phase 1: Setup & Configuration ✓
- [x] task-1: Set up OAuth provider (1.5h)
- [x] task-2: Configure environment (0.5h)

## Phase 2: Core Implementation 🔄
- [x] task-3: Implement middleware (2.5h)
- [ ] task-4: Create handlers (pending)
```

---

### Decision 2: Separate File vs Embedded
**Choice:** Separate `plan_{name}.json` files

**Reasoning:**
- ✅ Keeps `session.md` simple (goal + high-level milestones)
- ✅ Plan can grow large without bloating session file
- ✅ Easy to version and diff (separate git history)
- ✅ Optional feature (can ignore if not planning)
- ✅ Specialized tools can parse JSON directly
- ✅ Multiple plans can coexist (api-refactoring, oauth-implementation, etc.)

**Alternative Considered:** Embed in `session.md` as frontmatter
**Rejected Because:** Makes session.md complex, harder to parse, mixes concerns

---

### Decision 3: Manual vs Auto Updates
**Choice:** Hybrid - Auto-suggest, manual confirm

**Reasoning:**
- ❌ Full auto: Too risky (false positives break trust)
- ❌ Full manual: Too tedious (users won't maintain)
- ✅ Hybrid: Best of both (automation + control)

**User Experience:**
```
[Task suggestion appears after file change]

💡 Suggestion: task-3 (Implement middleware) may be complete.
   Reason: Files modified (src/middleware/auth.ts)

   Update status?
   1. Mark completed
   2. Still in progress
   3. Ignore
```

---

### Decision 4: Template Enforcement
**Choice:** Templates as starting points, not constraints

**Reasoning:**
- ✅ Saves time (80% of plans fit templates)
- ✅ Ensures consistency (team alignment)
- ✅ Flexible (easy to deviate when needed)
- ❌ Rigid enforcement would frustrate users

**Implementation:**
- Templates provide default structure
- User can add/remove/rename phases
- Can start with template then customize
- Can ignore templates entirely (freeform)

---

### Decision 5: CLI vs Hook Heavy
**Choice:** CLI-heavy (like session plugin pattern)

**Reasoning:**
- ✅ Faster (no token overhead)
- ✅ More reliable (no bash parsing issues)
- ✅ Testable independently (unit tests)
- ✅ Consistent with existing architecture
- ✅ Hooks only for lightweight auto-tracking

**Pattern:**
- **CLI:** All plan CRUD operations, metrics, validation
- **Hooks:** Auto-detect suggestions only (non-critical)
- **Commands:** Orchestrate CLI + Claude analysis

---

## Files to Create/Modify

### Files to Create

```
session/
├── commands/
│   └── save-plan.md                 # /save-plan command implementation
│
├── cli/lib/commands/
│   └── plan-ops.js                  # All plan operations (one file, ~300 lines)
│                                    # Functions: planExists, savePlan, loadPlan,
│                                    #            updateTaskStatus, getPlanStatus, listPlans
│
├── prompts/
│   └── analyze-conversation.md      # Subagent prompt for conversation analysis
│
└── schemas/
    └── plan-schema.json             # Simplified JSON schema (essential fields only)
```

**Total: 4 new files**

---

### Files to Modify

```
session/
├── plugin.json                      # Register /save-plan command
├── commands/
│   └── status.md                    # Add plan summary section (call listPlans)
├── cli/lib/
│   ├── session-cli.js               # Register plan-ops CLI commands
│   └── index-manager.js             # Add plan metadata to index
│                                    # Track: hasPlan, planCount, latestPlan
```

**Total: 4 modified files**

---

### Data Files (Created by System)

```
.claude/sessions/{session-name}/plans/
├── plan_{name}.json                 # Structured plan data
└── conversation_{name}.md           # Conversation summary

.claude/sessions/plans/              # Global plans (no session)
├── plan_{name}.json
└── conversation_{name}.md

.claude/sessions/.index.json         # Extended with plan metadata
```

---

**Summary:** 4 new files, 4 modified files (vs 13 new files in original design)

---

## Success Metrics

### Phase 1 (Core Infrastructure) Success Criteria
- ✅ Can save plan from conversation with `/save-plan {name}`
- ✅ Creates `plan_{name}.json` and `conversation_{name}.md`
- ✅ Works in session and non-session contexts
- ✅ Duplicate handling works (overwrite/version/cancel)
- ✅ Generates valid execution prompt
- ✅ JSON schema validates on write
- ✅ Zero crashes or data loss
- ✅ Files stored in correct location with correct naming

### Phase 2 (Execution Support) Success Criteria
- ✅ Can load and execute plan in new session
- ✅ Task status updates work atomically (~50 tokens each)
- ✅ Plan progress shows in `/session:status`
- ✅ Deviation detection works before new tasks
- ✅ Bold alerts display correctly
- ✅ User permission flow works
- ✅ getPlanStatus returns correct current task

### Phase 3 (Testing & Docs) Success Criteria
- ✅ All workflows tested and passing
- ✅ Documentation clear and complete
- ✅ Examples provided in README
- ✅ Zero npm dependencies (pure Node.js)
- ✅ Pattern recognition works (`plan_*.json`, `conversation_*.md`)
- ✅ Error handling graceful
- ✅ Cross-platform compatibility (macOS, Linux)

### Overall Success Metrics
- **Token Efficiency:** 97% savings on task updates (50 tokens vs 4000+)
- **Implementation Time:** 7-11 hours (vs 26-34 hours in original)
- **File Count:** 4 new, 4 modified (vs 13 new in original)
- **Reliability:** 99.9% uptime (no crashes)
- **User Satisfaction:** Natural workflow, zero friction, single command
- **Performance:** Conversation analysis isolated to subagent
- **Adoption:** Easy to use, minimal learning curve

---

## Open Questions

### Technical Questions
1. **Q:** Should we support task dependencies with blocking?
   **A:** Phase 4 feature. Start simple (just track dependencies, don't enforce).

2. **Q:** How to handle plan versioning (track changes over time)?
   **A:** Git provides versioning. Phase 4 can add explicit diff command.

3. **Q:** Should plans be portable across sessions?
   **A:** Not in MVP. Could add "copy plan" feature in Phase 4.

4. **Q:** Max plan size (tasks, phases)?
   **A:** No hard limit. Test with 100 tasks for performance.

5. **Q:** Support for multi-user plans (team context)?
   **A:** Phase 4 feature. Add task assignment field.

### UX Questions
1. **Q:** How often to suggest plan reviews?
   **A:** Every 10 interactions OR every snapshot. Not too aggressive.

2. **Q:** Should `/session:status` always show plan progress?
   **A:** Only if plan exists. Don't clutter if no plan.

3. **Q:** How to handle completed plans?
   **A:** Mark plan.metadata.status = "completed". Keep for reference.

4. **Q:** Should plan creation be interactive or automatic?
   **A:** Interactive by default. Option for automatic via templates.

5. **Q:** How verbose should task suggestions be?
   **A:** Minimal. One line with option to view details.

### Business/Strategy Questions
1. **Q:** Should this be a separate plugin or part of session?
   **A:** Part of session plugin. Natural evolution.

2. **Q:** How to measure ROI of planning features?
   **A:** Track: time saved, clarity gained, errors prevented.

3. **Q:** Should we charge for advanced features?
   **A:** Out of scope. Free and open source.

4. **Q:** How to handle feature requests?
   **A:** GitHub issues, prioritize by user votes.

---

## Next Steps

### Immediate (Before Implementation)
1. **Review this document** with team/stakeholders
2. **Finalize JSON schema** (get consensus on structure)
3. **Create prototype plan_{name}.json** manually (validate schema)
4. **Test CLI pattern** with simple CRUD operations
5. **Decide on MVP scope** (confirm Phase 1 features)

### Short Term (Phase 1 - Week 1)
1. **Set up development environment**
2. **Create plan-manager.js** (core operations)
3. **Implement JSON schema validation**
4. **Create CLI commands** (create/get/update)
5. **Build `/session:plan` command**
6. **Test in actual Claude Code environment**

### Medium Term (Phase 2-3 - Weeks 2-3)
1. **Add hook integration** (auto-tracking)
2. **Implement `/session:save-plan`**
3. **Create template system**
4. **Add snapshot linking**
5. **Update documentation**

### Long Term (Phase 4 - Week 4+)
1. **Add advanced features** (dependencies, risks, export)
2. **Gather user feedback**
3. **Iterate based on usage**
4. **Consider additional templates**

---

## Conclusion

This planning feature is **highly feasible (88%)** and represents a **natural evolution** of the session plugin. The architecture aligns perfectly with existing patterns, and the value proposition is clear: structured task management for complex sessions.

**Key Strengths:**
- ✅ Standardized JSON format
- ✅ Template-based consistency
- ✅ Multi-layer tracking
- ✅ Lessons learned from past bugs applied
- ✅ Incremental implementation path

**Key Risks (Mitigated):**
- ⚠️ Bash parsing (solved: CLI + Read pattern)
- ⚠️ Subagent reliability (solved: verification + Sonnet)
- ⚠️ Hook orphaning (solved: auto-detection)
- ⚠️ Race conditions (solved: lock manager)

**Recommendation:** **PROCEED with Phase 1 MVP**

Start small, validate with users, iterate based on feedback. This feature has potential to become a cornerstone of the session plugin's value proposition.

---

**Document Status:** Ready for review and brainstorming
**Next Action:** Review, update, and proceed to implementation when ready
