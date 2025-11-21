# CRITICAL GAP: Conceptual vs Implementation Plan Transformation

**Date:** 2025-11-21
**Status:** IDENTIFIED - Needs Implementation
**Priority:** HIGH - Fundamental to three-phase workflow

---

## 🔴 THE PROBLEM

### User's Actual Workflow

**Planning Phase (Conceptual):**
```
User: "I want to restrict products"
User: "Track who created each product"
User: "Maybe add categories later"
```

**Expected After Finalization (Implementation):**
```
Phase 1: Database Layer
  ✓ t1: Add restriction_level column to public.new_product table
  ✓ t2: Create migration script for ALTER TABLE
  ✓ t3: Add database constraint for restriction logic
  ✓ t4: Add created_by column with foreign key to users
  ✓ t5: Add index on created_by for performance

Phase 2: API Layer
  ✓ t6: Add validation in POST /api/products endpoint
  ✓ t7: Add validation in PUT /api/products/:id endpoint
  ✓ t8: Return 403 error for restricted products
  ✓ t9: Add audit logging for product creation

Phase 3: UI Layer
  ✓ t10: Add restriction checkbox in product form
  ✓ t11: Show error message when restriction fails
  ✓ t12: Display creator info in product details
  ✓ t13: Disable product actions when restricted
```

**Key Insight:** Requirements ≠ Tasks

Planning discusses **WHAT** (requirements).
Implementation defines **HOW** (concrete tasks).

---

## ❌ WHAT'S BROKEN IN CURRENT IMPLEMENTATION

### Current Flow

1. **Save Plan** (`/session:plan-save`)
   - Calls analyze-conversation subagent
   - Tries to extract structured tasks from requirements
   - **Problem:** Creates vague tasks like "Restrict products"
   - Immediately converts to orchestration.json + phases/
   - Files created: orchestration.json, phases/*.json, execution-state.json
   - Sets `planType: "conceptual"`

2. **Finalize Plan** (`/session:plan-finalize`)
   - Just changes field: `planType: "conceptual"` → `"implementation"`
   - **Problem:** Doesn't transform requirements into tasks!
   - No breakdown, no AI assistance, no user interaction

3. **Execute Plan** (`/session:plan-execute`)
   - Shows vague tasks like "Restrict products"
   - **Problem:** Not actionable, can't execute

### The Gap

```
Requirements → ??? → Tasks
   (vague)          (concrete)

The ??? is MISSING!
```

---

## ✅ WHAT'S IMPLEMENTED (And Works)

### File Structure ✓
```
plans/{name}/
├── orchestration.json    (metadata, phase registry)
├── phases/*.json         (phase files with tasks)
└── execution-state.json  (runtime tracking)
```

### Commands ✓
- `/session:plan-save` - Creates plan
- `/session:plan-finalize` - Changes planType field
- `/session:plan-execute` - Shows tasks
- `/session:plan-status` - Progress tracking

### CLI Functions ✓
- `createPlan()` - Creates orchestration + phases
- `finalizePlan()` - Updates planType
- `updateTaskStatus()` - Updates tasks
- `getPlan()` - Reads orchestration
- `listPlans()` - Lists plans

### Schemas ✓
- orchestration-schema.json (with planType field)
- phase-schema.json
- plan-converter.js (splits monolithic → orchestration)

---

## 💡 PROPOSED SOLUTIONS

### Option 1: Two-Format Approach ⭐ RECOMMENDED

**Conceptual Format** (requirements.json or plan.json):
```json
{
  "plan_name": "product-restrictions",
  "plan_type": "conceptual",
  "goal": "Add product restrictions",
  "requirements": [
    {
      "id": "req-1",
      "description": "Restrict products based on user permissions",
      "notes": "Need validation at all layers",
      "open_questions": [
        "Which permission system?",
        "What layers need validation?"
      ],
      "priority": "high"
    },
    {
      "id": "req-2",
      "description": "Track who created each product",
      "notes": "For audit purposes",
      "open_questions": []
    }
  ],
  "discussion_notes": "...",
  "conversation_summary": "..."
}
```

**Implementation Format** (orchestration.json + phases/):
```json
{
  "metadata": {
    "planType": "implementation",
    "derivedFrom": ["req-1", "req-2"]
  },
  "phases": [
    {
      "id": "phase-1-database",
      "name": "Database Layer",
      "tasks": [
        {
          "task_id": "task-1-1",
          "description": "Add restriction_level column to public.new_product",
          "details": "ALTER TABLE public.new_product ADD COLUMN restriction_level VARCHAR(20) CHECK (restriction_level IN ('public', 'private', 'restricted'))",
          "from_requirement": "req-1",
          "status": "pending"
        }
      ]
    }
  ]
}
```

**Workflow:**
1. **Save** → Creates requirements.json (simple, unstructured)
2. **Finalize** → Transforms requirements.json → orchestration.json + phases/
3. **Execute** → Uses orchestration.json + phases/

**Benefits:**
- ✅ Clear separation: requirements vs tasks
- ✅ Lightweight conceptual phase
- ✅ Optimization happens when needed
- ✅ Matches user's mental model

**Implementation Effort:** 6-8 hours
- Create requirements schema
- Update plan-save to create requirements.json
- Rewrite finalize to do transformation
- Add AI-assisted task breakdown
- Update execute to verify implementation format

---

### Option 2: Smart Finalization (Keep Current Structure)

Keep orchestration.json throughout, but make finalize actually TRANSFORM:

```javascript
async function finalizePlan(sessionName, planName) {
  // 1. Load conceptual plan
  const plan = await getPlan(sessionName, planName);

  // 2. Detect vague tasks
  const vagueTasks = findVagueTasks(plan); // Tasks with keywords like "restrict", "add", "implement"

  // 3. For each vague task, break it down
  for (const task of vagueTasks) {
    // Use AI to break down: "Restrict products" → 10 concrete tasks
    const breakdown = await breakdownTaskWithAI(task);

    // Ask user to confirm/modify
    const confirmed = await getUserConfirmation(breakdown);

    // Replace vague task with concrete subtasks
    replaceTask(task, confirmed);
  }

  // 4. Reorganize into proper phases (DB, API, UI)
  const reorganized = reorganizeIntoPhases(plan);

  // 5. Update all phase files
  await updatePhaseFiles(reorganized);

  // 6. Mark as implementation
  orchestration.metadata.planType = 'implementation';
}
```

**Benefits:**
- ✅ Less refactoring (keep current files)
- ✅ AI-assisted breakdown
- ✅ Interactive transformation

**Drawbacks:**
- ❌ Still creates optimized structure too early
- ❌ Conceptual plans have unnecessary complexity

**Implementation Effort:** 4-6 hours

---

### Option 3: Hybrid (Both Formats Side-by-Side)

```
plans/product-restrictions/
├── conceptual-plan.json      (original requirements)
├── orchestration.json        (derived implementation)
├── phases/                   (derived tasks)
└── execution-state.json      (runtime)
```

Keep both for traceability.

**Benefits:**
- ✅ Preserves original thinking
- ✅ Clear transformation audit trail

**Drawbacks:**
- ❌ More files to manage
- ❌ Potential for drift/inconsistency

**Implementation Effort:** 5-7 hours

---

## 🎯 RECOMMENDED APPROACH

**Implement Option 1: Two-Format Approach**

**Why:**
1. Matches user's mental model (requirements → tasks)
2. Clean separation of concerns
3. Lightweight conceptual phase
4. Transformation is explicit and traceable
5. Future-proof for AI-assisted breakdown

**Implementation Plan:**

### Phase 1: Requirements Format (2-3 hours)
- [ ] Create requirements-schema.json
- [ ] Update plan-save.md to create requirements.json
- [ ] Update analyze-conversation.md to extract requirements (not tasks)
- [ ] Test: Create conceptual plan with requirements

### Phase 2: Transformation Logic (3-4 hours)
- [ ] Create requirement-to-task transformer
- [ ] Add AI-assisted task breakdown
- [ ] Implement interactive confirmation
- [ ] Update finalize-plan to do transformation
- [ ] Test: Finalize requirements → orchestration

### Phase 3: Validation (1-2 hours)
- [ ] Update plan-execute to verify implementation format
- [ ] Add migration utility (old plans → new format)
- [ ] Update documentation
- [ ] End-to-end test: save → finalize → execute

**Total Effort:** 6-9 hours

---

## 📋 NEXT SESSION TODO

1. **Review this document** - Validate the problem understanding
2. **Choose solution** - Option 1, 2, or 3?
3. **Implement transformation** - Make finalize actually work
4. **Test workflow** - Requirements → Tasks → Execution
5. **Update documentation** - Reflect new workflow

---

## 🔍 KEY INSIGHTS

1. **Planning is exploratory** - Users discuss WHAT, not HOW
2. **Finalization is transformation** - Requirements → Concrete tasks
3. **Current implementation skips transformation** - Major gap
4. **File structure is good** - orchestration.json + phases/ works
5. **Semantic distinction preserved** - planType field is correct
6. **But need format distinction** - requirements.json vs orchestration.json

---

## 📊 CURRENT STATUS

**What Works:**
- ✅ File structure (orchestration + phases)
- ✅ Phase-based architecture (76.5% token savings)
- ✅ Progress tracking
- ✅ CLI integration
- ✅ Commands exist

**What's Broken:**
- ❌ Conceptual plans have task structure (too early)
- ❌ Finalize doesn't transform (just changes field)
- ❌ Can't handle "restrict products" → detailed tasks
- ❌ Execution gets vague, unactionable tasks

**Impact:**
- Planning phase feels forced/structured
- Finalize step is useless
- Execution is blocked on vague tasks
- User has to manually break down requirements

---

## 💬 USER FEEDBACK

> "My only concern with current flow is when we plan we generally talk about the requirements. There is never a concrete structure. For eg in planning I may say, I want to restrict products, but in implementation we will actually have t1- restrict public.new_product table in DB. t2- add validation in api. t3 - add validation on ui."

**Translation:** Planning = Requirements. Implementation = Tasks.
**Current system:** Planning = Tasks (broken for user's workflow).

---

## 🚀 DECISION NEEDED

Before next implementation session:

**Question 1:** Which solution? (Option 1, 2, or 3)
**Question 2:** Priority? (High/Medium - affects next session focus)
**Question 3:** Test plans available? (Can we create real examples?)

---

**Session Context:** 143k/200k tokens (72% used)
**Files Modified:** 15+ files in this session
**Lines Added:** ~2,500 lines (schemas, converter, orchestrator, commands)

**Ready to continue in next session with clear direction on transformation implementation.**
