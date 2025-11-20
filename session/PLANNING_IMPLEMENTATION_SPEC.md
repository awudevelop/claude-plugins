# Session Plugin: Planning Feature Implementation Specification

**Filename:** `PLANNING_IMPLEMENTATION_SPEC.md`
**Document Version:** 1.0.0
**Date:** 2025-11-19
**Status:** Implementation Ready
**Companion Document:** `PLANNING_FEATURE_APPROACH.md` v2.0.0

---

## Document Purpose

This is the **implementation specification** for the session plugin planning feature. While PLANNING_FEATURE_APPROACH.md provides the high-level design, architecture, and rationale, this document provides **concrete, executable specifications** that developers can use to build the system with zero ambiguity.

**Key Differences:**
- **Planning Doc**: Why we're building this, what the architecture is, risk analysis
- **Implementation Doc**: Exact code to write, schemas, algorithms, test cases, deployment steps

**Target Audience:** Developers implementing the planning feature

---

## Table of Contents

### Part 1: Complete Code Specifications
1.1 [File Structure and Responsibilities](#11-file-structure-and-responsibilities)
1.2 [Function Signatures and Contracts](#12-function-signatures-and-contracts)
1.3 [Data Flow Diagrams](#13-data-flow-diagrams)
1.4 [Integration Points](#14-integration-points)

### Part 2: Algorithms and Logic
2.1 [Work Type Detection Algorithm](#21-work-type-detection-algorithm)
2.2 [Template Selection Logic](#22-template-selection-logic)
2.3 [Plan Extraction Algorithm](#23-plan-extraction-algorithm)
2.4 [Template Merging Algorithm](#24-template-merging-algorithm)

### Part 3: Data Specifications
3.1 [Complete JSON Schemas](#31-complete-json-schemas)
3.2 [File Formats](#32-file-formats)
3.3 [API Contracts](#33-api-contracts)
3.4 [Validation Rules](#34-validation-rules)

### Part 4: CLI Implementation
4.1 [Command Specifications](#41-command-specifications)
4.2 [Argument Parsing](#42-argument-parsing)
4.3 [Output Formatting](#43-output-formatting)
4.4 [Error Handling](#44-error-handling)

### Part 5: Prompts and Subagents
5.1 [Complete Prompt Texts](#51-complete-prompt-texts)
5.2 [Input/Output Examples](#52-inputoutput-examples)
5.3 [Token Optimization](#53-token-optimization)
5.4 [Error Recovery](#54-error-recovery)

### Part 6: Templates
6.1 [Complete Template Files](#61-complete-template-files)
6.2 [Variable System](#62-variable-system)
6.3 [Customization Guide](#63-customization-guide)
6.4 [Template Validation](#64-template-validation)

### Part 7: Testing
7.1 [Unit Test Specifications](#71-unit-test-specifications)
7.2 [Integration Test Scenarios](#72-integration-test-scenarios)
7.3 [Test Data Sets](#73-test-data-sets)
7.4 [Coverage Requirements](#74-coverage-requirements)

### Part 8: Integration
8.1 [Code Modifications](#81-code-modifications)
8.2 [Hook Integration Points](#82-hook-integration-points)
8.3 [Migration Scripts](#83-migration-scripts)
8.4 [Compatibility Matrix](#84-compatibility-matrix)

### Part 9: Deployment
9.1 [Pre-flight Checklist](#91-pre-flight-checklist)
9.2 [Deployment Steps](#92-deployment-steps)
9.3 [Validation Tests](#93-validation-tests)
9.4 [Rollback Procedures](#94-rollback-procedures)

### Part 10: Appendices
A. [Error Code Reference](#appendix-a-error-code-reference)
B. [Performance Benchmarks](#appendix-b-performance-benchmarks)
C. [Security Considerations](#appendix-c-security-considerations)
D. [Future Extensions](#appendix-d-future-extensions)

---

# Part 1: Complete Code Specifications

## 1.1 File Structure and Responsibilities

### Complete File Tree

```
session/
├── commands/
│   └── save-plan.md                    # [NEW] /save-plan command prompt
│
├── cli/lib/
│   ├── work-type-detector.js           # [NEW] Work type detection algorithm
│   └── template-selector.js            # [NEW] Template selection logic
│
├── cli/lib/commands/
│   └── plan-ops.js                     # [NEW] All CLI plan operations
│
├── prompts/
│   ├── analyze-conversation.md         # [NEW] Conversation analysis subagent
│   └── detect-work-type.md             # [NEW] Work type detection subagent
│
├── schemas/
│   └── plan-schema.json                # [NEW] JSON Schema for plan validation
│
├── templates/
│   ├── feature-template.json           # [NEW] Feature development template
│   ├── bug-template.json               # [NEW] Bug fix template
│   ├── spike-template.json             # [NEW] Spike/exploration template
│   └── refactor-template.json          # [NEW] Refactoring template
│
├── tests/
│   ├── work-type-detector.test.js      # [NEW] Detector unit tests
│   ├── template-selector.test.js       # [NEW] Selector unit tests
│   ├── plan-ops.test.js                # [NEW] Plan operations tests
│   └── fixtures/
│       ├── conversations/              # [NEW] Sample conversation data
│       └── plans/                      # [NEW] Sample plan files
│
├── IMPLEMENTATION_SPEC.md              # [THIS FILE] Implementation specification
└── PLANNING_FEATURE_APPROACH.md        # [EXISTING] Design document
```

### File Responsibilities

#### `commands/save-plan.md`
**Purpose:** Claude Code command prompt for `/save-plan {name}`
**Responsibilities:**
- Parse command arguments (plan name, optional flags)
- Coordinate entire plan creation workflow
- Invoke work type detection
- Invoke conversation analysis
- Show preview to user
- Handle user selection (template choice)
- Save plan file and conversation context
- Display success message with next steps

**Dependencies:**
- `cli/lib/work-type-detector.js` (via CLI call)
- `cli/lib/template-selector.js` (via CLI call)
- `prompts/analyze-conversation.md` (subagent)
- `prompts/detect-work-type.md` (subagent)

#### `cli/lib/work-type-detector.js`
**Purpose:** Analyze conversation to detect work type
**Responsibilities:**
- Extract keywords and patterns from conversation
- Score conversation against work type indicators
- Calculate confidence scores
- Return detection result (type + confidence)

**Interface:**
```javascript
async function detectWorkType(conversationLog) {
  // Returns: { type: 'feature'|'bug'|'spike'|'refactor', confidence: 0-100, signals: {...} }
}
```

#### `cli/lib/template-selector.js`
**Purpose:** Select appropriate template based on detection
**Responsibilities:**
- Load template file based on work type
- Validate template structure
- Return template data or null
- Handle missing templates gracefully

**Interface:**
```javascript
async function selectTemplate(workType, options = {}) {
  // Returns: { template: {...}, path: string } or null
}
```

#### `cli/lib/commands/plan-ops.js`
**Purpose:** All CLI operations for plan management
**Responsibilities:**
- Create, read, update, delete plan files
- Validate plan structure
- Update task status
- Check plan existence
- Export plans to different formats

**Interface:** (See Section 1.2)

#### `prompts/analyze-conversation.md`
**Purpose:** Subagent prompt for extracting plan details from conversation
**Responsibilities:**
- Analyze conversation log entries
- Extract goal, decisions, requirements, constraints
- Identify key technical choices
- Generate conversation summary
- Format as JSON

#### `prompts/detect-work-type.md`
**Purpose:** Subagent prompt for work type detection
**Responsibilities:**
- Analyze conversation for work type signals
- Apply scoring algorithm
- Return structured detection result

#### `schemas/plan-schema.json`
**Purpose:** JSON Schema for plan file validation
**Responsibilities:**
- Define all plan fields and types
- Specify required vs optional fields
- Define validation constraints
- Enable automated validation

#### `templates/*.json`
**Purpose:** Template files for each work type
**Responsibilities:**
- Provide standard phase/task structure
- Define default values
- Include placeholders for conversation content
- Serve as scaffolding for plan creation

---

## 1.2 Function Signatures and Contracts

### `cli/lib/work-type-detector.js`

```javascript
/**
 * Detects work type from conversation log
 * @param {Array} conversationLog - Array of conversation entries
 * @returns {Promise<DetectionResult>}
 */
async function detectWorkType(conversationLog) {
  // Returns: DetectionResult
}

/**
 * @typedef {Object} DetectionResult
 * @property {'feature'|'bug'|'spike'|'refactor'|'unknown'} type
 * @property {number} confidence - 0-100
 * @property {Object} signals - Detailed signal analysis
 * @property {number} signals.featureScore - 0-100
 * @property {number} signals.bugScore - 0-100
 * @property {number} signals.spikeScore - 0-100
 * @property {number} signals.refactorScore - 0-100
 * @property {Array<string>} signals.keywords - Matched keywords
 * @property {Object} signals.patterns - Matched patterns
 */

/**
 * Analyzes keywords in conversation
 * @param {string} text - Conversation text
 * @returns {Object} - Keyword analysis
 */
function analyzeKeywords(text) {
  // Returns: { feature: Array, bug: Array, spike: Array, refactor: Array }
}

/**
 * Analyzes patterns in conversation
 * @param {Array} conversationLog - Conversation entries
 * @returns {Object} - Pattern analysis
 */
function analyzePatterns(conversationLog) {
  // Returns: { hasRequirements: bool, hasErrorDiscussion: bool, ... }
}

/**
 * Calculates scores for each work type
 * @param {Object} keywords - Keyword analysis
 * @param {Object} patterns - Pattern analysis
 * @returns {Object} - Scores for each type
 */
function calculateScores(keywords, patterns) {
  // Returns: { feature: number, bug: number, spike: number, refactor: number }
}

module.exports = { detectWorkType, analyzeKeywords, analyzePatterns, calculateScores };
```

### `cli/lib/template-selector.js`

```javascript
/**
 * Selects template based on work type
 * @param {string} workType - Detected work type
 * @param {Object} options - Selection options
 * @param {boolean} options.allowFallback - Use default if template missing
 * @returns {Promise<TemplateResult|null>}
 */
async function selectTemplate(workType, options = {}) {
  // Returns: TemplateResult or null
}

/**
 * @typedef {Object} TemplateResult
 * @property {Object} template - Template data
 * @property {string} path - Template file path
 * @property {string} type - Template type
 */

/**
 * Loads template file
 * @param {string} templatePath - Path to template file
 * @returns {Promise<Object>} - Template data
 */
async function loadTemplate(templatePath) {
  // Returns: Template JSON object
}

/**
 * Validates template structure
 * @param {Object} template - Template data
 * @returns {boolean} - Is valid
 */
function validateTemplate(template) {
  // Returns: true if valid, false otherwise
}

/**
 * Lists all available templates
 * @returns {Promise<Array<string>>} - Template names
 */
async function listTemplates() {
  // Returns: ['feature', 'bug', 'spike', 'refactor']
}

module.exports = { selectTemplate, loadTemplate, validateTemplate, listTemplates };
```

### `cli/lib/commands/plan-ops.js`

```javascript
/**
 * Creates a new plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {Object} planData - Plan data
 * @returns {Promise<CreateResult>}
 */
async function createPlan(sessionName, planName, planData) {
  // Returns: { success: bool, path: string, message: string }
}

/**
 * Retrieves a plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
async function getPlan(sessionName, planName) {
  // Returns: Plan object or null
}

/**
 * Updates an existing plan
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {Object} updates - Partial plan data to update
 * @returns {Promise<UpdateResult>}
 */
async function updatePlan(sessionName, planName, updates) {
  // Returns: { success: bool, message: string }
}

/**
 * Deletes a plan file
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<DeleteResult>}
 */
async function deletePlan(sessionName, planName) {
  // Returns: { success: bool, message: string }
}

/**
 * Lists all plans for a session
 * @param {string} sessionName - Session name
 * @returns {Promise<Array<string>>} - Plan names
 */
async function listPlans(sessionName) {
  // Returns: Array of plan names
}

/**
 * Validates a plan against schema
 * @param {Object} planData - Plan data
 * @returns {ValidationResult}
 */
function validatePlan(planData) {
  // Returns: { valid: bool, errors: Array }
}

/**
 * Updates task status in a plan
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending|in_progress|completed)
 * @returns {Promise<UpdateResult>}
 */
async function updateTaskStatus(sessionName, planName, taskId, status) {
  // Returns: { success: bool, message: string }
}

/**
 * Gets plan execution status
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<StatusResult>}
 */
async function getPlanStatus(sessionName, planName) {
  // Returns: { totalTasks, completed, inProgress, pending, percentComplete }
}

/**
 * Exports plan to different format
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @param {string} format - Export format (json|markdown|csv)
 * @returns {Promise<string>} - Formatted output
 */
async function exportPlan(sessionName, planName, format) {
  // Returns: Formatted string
}

/**
 * Checks if plan exists
 * @param {string} sessionName - Session name
 * @param {string} planName - Plan name
 * @returns {Promise<boolean>}
 */
async function planExists(sessionName, planName) {
  // Returns: true if exists
}

module.exports = {
  createPlan,
  getPlan,
  updatePlan,
  deletePlan,
  listPlans,
  validatePlan,
  updateTaskStatus,
  getPlanStatus,
  exportPlan,
  planExists
};
```

---

## 1.3 Data Flow Diagrams

### Flow 1: Save Plan Command

```
User: /save-plan oauth-implementation
         |
         v
[save-plan.md] Parse arguments
         |
         v
[save-plan.md] Read conversation log (.claude/sessions/{session}/conversation-log.jsonl)
         |
         v
[Subagent: detect-work-type.md] Analyze conversation
         |
         v
[work-type-detector.js] Calculate scores → DetectionResult
         |
         v
[save-plan.md] Display detection result
         |
         v
[template-selector.js] Load template based on type
         |
         v
[Subagent: analyze-conversation.md] Extract plan details
         |
         v
[save-plan.md] Merge template + conversation data
         |
         v
[save-plan.md] Show preview to user
         |
         v
[User Choice] → 1) Accept, 2) Choose different template, 3) No template
         |
         v
[plan-ops.js] validatePlan(planData)
         |
         v
[plan-ops.js] createPlan(session, name, data)
         |
         v
[File System] Write plan_{name}.json
         |
         v
[File System] Write conversation_{name}.md
         |
         v
[save-plan.md] Display success + execution prompt
```

### Flow 2: Plan Execution Tracking

```
Claude executing task
         |
         v
[Task Completed] Claude recognizes completion
         |
         v
[Auto-update] Call: updateTaskStatus(planName, taskId, 'completed')
         |
         v
[plan-ops.js] Read plan_{name}.json
         |
         v
[plan-ops.js] Update task status in JSON
         |
         v
[plan-ops.js] Calculate new progress percentage
         |
         v
[plan-ops.js] Write updated plan_{name}.json
         |
         v
[Success] Return update confirmation
```

### Flow 3: Plan Validation

```
User: /session:status (or manual check)
         |
         v
[Status command] Call: getPlanStatus(session, plan)
         |
         v
[plan-ops.js] Read plan_{name}.json
         |
         v
[plan-ops.js] Count tasks by status
         |
         v
[plan-ops.js] Calculate completion percentage
         |
         v
[plan-ops.js] Return StatusResult
         |
         v
[Status command] Display formatted progress
```

---

## 1.4 Integration Points

### Integration with Existing Session Plugin

#### 1.4.1 `plugin.json` Modifications

**File:** `session/plugin.json`

**Add:**
```json
{
  "commands": "./commands",
  "additionalCommands": {
    "save-plan": "./commands/save-plan.md"
  }
}
```

#### 1.4.2 `session-cli.js` Integration

**File:** `session/cli/session-cli.js`

**Location:** Line ~56 (command registry)

**Add:**
```javascript
const planOps = require('./lib/commands/plan-ops');

// In command switch/handler:
case 'create-plan':
  return await planOps.createPlan(args[0], args[1], JSON.parse(args[2]));
case 'get-plan':
  return await planOps.getPlan(args[0], args[1]);
case 'update-plan':
  return await planOps.updatePlan(args[0], args[1], JSON.parse(args[2]));
case 'delete-plan':
  return await planOps.deletePlan(args[0], args[1]);
case 'list-plans':
  return await planOps.listPlans(args[0]);
case 'validate-plan':
  return planOps.validatePlan(JSON.parse(args[0]));
case 'update-task-status':
  return await planOps.updateTaskStatus(args[0], args[1], args[2], args[3]);
case 'plan-status':
  return await planOps.getPlanStatus(args[0], args[1]);
case 'export-plan':
  return await planOps.exportPlan(args[0], args[1], args[2]);
case 'plan-exists':
  return await planOps.planExists(args[0], args[1]);
```

#### 1.4.3 Index.json Schema Extensions

**File:** `.claude/sessions/index.json`

**Add to each session object:**
```json
{
  "sessionName": "example-session",
  // ... existing fields ...
  "plans": {
    "count": 2,
    "names": ["oauth-implementation", "refactor-auth"],
    "latest": "refactor-auth",
    "latestUpdated": "2025-11-19T12:00:00.000Z"
  }
}
```

**Migration:** When plan is created/updated, update index.json

#### 1.4.4 Session Start/Continue Integration

**Optional Future Enhancement:** Auto-detect plans on session start

**File:** `commands/start.md` (potential addition)

```markdown
<!-- After session is created -->

4. Check for existing plans:
   - Call: node {plugin_root}/cli/session-cli.js list-plans {session_name}
   - If plans exist, display: "📋 {count} plan(s) found. Use /session:status to view."
```

---

# Part 2: Algorithms and Logic

## 2.1 Work Type Detection Algorithm

### Complete Implementation

**File:** `cli/lib/work-type-detector.js`

```javascript
const fs = require('fs').promises;
const path = require('path');

// Keyword dictionaries with weights
const KEYWORDS = {
  feature: {
    primary: ['implement', 'build', 'create', 'add', 'develop', 'feature'],
    secondary: ['new functionality', 'enhancement', 'capability', 'integration'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  bug: {
    primary: ['fix', 'bug', 'error', 'issue', 'broken', 'failing'],
    secondary: ['crash', 'exception', 'not working', 'regression'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  spike: {
    primary: ['explore', 'investigate', 'research', 'experiment', 'spike'],
    secondary: ['proof of concept', 'poc', 'feasibility', 'evaluate'],
    weight: {
      primary: 10,
      secondary: 5
    }
  },
  refactor: {
    primary: ['refactor', 'restructure', 'reorganize', 'cleanup', 'improve'],
    secondary: ['technical debt', 'code quality', 'maintainability'],
    weight: {
      primary: 10,
      secondary: 5
    }
  }
};

// Pattern detectors
const PATTERNS = {
  feature: {
    hasRequirements: (log) => log.some(entry =>
      entry.content.toLowerCase().includes('requirement') ||
      entry.content.toLowerCase().includes('should') ||
      entry.content.match(/we need to/i)
    ),
    hasUserStory: (log) => log.some(entry =>
      entry.content.match(/as a .* I want/i) ||
      entry.content.match(/user should be able to/i)
    ),
    hasPhases: (log) => log.some(entry =>
      entry.content.match(/phase \d+/i) ||
      entry.content.match(/step \d+/i)
    )
  },
  bug: {
    hasErrorDiscussion: (log) => log.some(entry =>
      entry.content.match(/error:|exception:|stack trace/i) ||
      entry.content.includes('TypeError') ||
      entry.content.includes('ReferenceError')
    ),
    hasReproSteps: (log) => log.some(entry =>
      entry.content.match(/steps to reproduce/i) ||
      entry.content.match(/to reproduce:/i)
    ),
    hasExpectedVsActual: (log) => log.some(entry =>
      entry.content.match(/expected.*actual/i) ||
      entry.content.match(/should.*but.*instead/i)
    )
  },
  spike: {
    hasQuestions: (log) => {
      const questionCount = log.reduce((count, entry) => {
        const matches = entry.content.match(/\?/g);
        return count + (matches ? matches.length : 0);
      }, 0);
      return questionCount > 5; // High question density
    },
    hasComparison: (log) => log.some(entry =>
      entry.content.match(/compare|versus|vs\.|alternative|option/i)
    ),
    hasUncertainty: (log) => log.some(entry =>
      entry.content.match(/not sure|unclear|investigate|explore/i)
    )
  },
  refactor: {
    hasCodeQualityDiscussion: (log) => log.some(entry =>
      entry.content.match(/code smell|technical debt|cleanup|messy/i)
    ),
    hasStructureDiscussion: (log) => log.some(entry =>
      entry.content.match(/structure|organization|architecture|pattern/i)
    ),
    hasNoNewFeature: (log) => {
      const featureKeywords = ['new feature', 'add functionality', 'implement'];
      return !log.some(entry =>
        featureKeywords.some(kw => entry.content.toLowerCase().includes(kw))
      );
    }
  }
};

/**
 * Main detection function
 */
async function detectWorkType(conversationLog) {
  if (!conversationLog || conversationLog.length === 0) {
    return {
      type: 'unknown',
      confidence: 0,
      signals: {},
      reason: 'No conversation data provided'
    };
  }

  // Step 1: Analyze keywords
  const conversationText = conversationLog
    .map(entry => entry.content)
    .join(' ')
    .toLowerCase();

  const keywordAnalysis = analyzeKeywords(conversationText);

  // Step 2: Analyze patterns
  const patternAnalysis = analyzePatterns(conversationLog);

  // Step 3: Calculate scores
  const scores = calculateScores(keywordAnalysis, patternAnalysis);

  // Step 4: Determine winner
  const sortedScores = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  const [topType, topScore] = sortedScores[0];
  const [secondType, secondScore] = sortedScores[1];

  // Step 5: Calculate confidence
  const confidence = calculateConfidence(topScore, secondScore, conversationLog.length);

  return {
    type: confidence < 50 ? 'unknown' : topType,
    confidence: Math.round(confidence),
    signals: {
      featureScore: Math.round(scores.feature),
      bugScore: Math.round(scores.bug),
      spikeScore: Math.round(scores.spike),
      refactorScore: Math.round(scores.refactor),
      keywords: keywordAnalysis,
      patterns: patternAnalysis,
      conversationLength: conversationLog.length
    }
  };
}

/**
 * Analyzes keywords in conversation text
 */
function analyzeKeywords(text) {
  const analysis = {};

  for (const [workType, keywords] of Object.entries(KEYWORDS)) {
    let score = 0;
    const matched = { primary: [], secondary: [] };

    // Check primary keywords
    keywords.primary.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * keywords.weight.primary;
        matched.primary.push(keyword);
      }
    });

    // Check secondary keywords
    keywords.secondary.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * keywords.weight.secondary;
        matched.secondary.push(keyword);
      }
    });

    analysis[workType] = { score, matched };
  }

  return analysis;
}

/**
 * Analyzes patterns in conversation
 */
function analyzePatterns(conversationLog) {
  const analysis = {};

  for (const [workType, patterns] of Object.entries(PATTERNS)) {
    analysis[workType] = {};
    for (const [patternName, detector] of Object.entries(patterns)) {
      analysis[workType][patternName] = detector(conversationLog);
    }
  }

  return analysis;
}

/**
 * Calculates final scores combining keywords and patterns
 */
function calculateScores(keywordAnalysis, patternAnalysis) {
  const scores = {
    feature: 0,
    bug: 0,
    spike: 0,
    refactor: 0
  };

  // Add keyword scores (max 100 points each)
  for (const [workType, data] of Object.entries(keywordAnalysis)) {
    scores[workType] += Math.min(data.score, 100);
  }

  // Add pattern bonuses (10 points per matched pattern)
  for (const [workType, patterns] of Object.entries(patternAnalysis)) {
    const matchedPatterns = Object.values(patterns).filter(Boolean).length;
    scores[workType] += matchedPatterns * 10;
  }

  return scores;
}

/**
 * Calculates confidence based on score separation and conversation length
 */
function calculateConfidence(topScore, secondScore, conversationLength) {
  // Base confidence from score separation
  const scoreSeparation = topScore - secondScore;
  let confidence = Math.min((scoreSeparation / topScore) * 100, 100);

  // Adjust for conversation length (more data = higher confidence)
  if (conversationLength < 5) {
    confidence *= 0.6; // Low confidence for short conversations
  } else if (conversationLength < 10) {
    confidence *= 0.8; // Medium confidence
  }
  // else: full confidence for 10+ messages

  // Minimum threshold
  if (topScore < 20) {
    confidence = Math.min(confidence, 40); // Cap at 40% if overall score is low
  }

  return confidence;
}

module.exports = {
  detectWorkType,
  analyzeKeywords,
  analyzePatterns,
  calculateScores,
  KEYWORDS,
  PATTERNS
};
```

### Algorithm Complexity
- **Time Complexity:** O(n * m) where n = conversation length, m = keyword count
- **Space Complexity:** O(n) for conversation text storage
- **Expected Runtime:** < 100ms for typical conversations (10-50 messages)

---

## 2.2 Template Selection Logic

### Complete Implementation

**File:** `cli/lib/template-selector.js`

```javascript
const fs = require('fs').promises;
const path = require('path');

// Template mapping
const TEMPLATE_MAP = {
  feature: 'feature-template.json',
  bug: 'bug-template.json',
  spike: 'spike-template.json',
  refactor: 'refactor-template.json'
};

// Default template (fallback)
const DEFAULT_TEMPLATE = 'feature-template.json';

/**
 * Selects template based on work type
 */
async function selectTemplate(workType, options = {}) {
  const {
    allowFallback = true,
    customPath = null
  } = options;

  // Handle custom template path
  if (customPath) {
    try {
      const template = await loadTemplate(customPath);
      return {
        template,
        path: customPath,
        type: 'custom'
      };
    } catch (error) {
      if (!allowFallback) {
        throw new Error(`Custom template not found: ${customPath}`);
      }
      // Fall through to default selection
    }
  }

  // Get template filename
  const templateFile = TEMPLATE_MAP[workType] || DEFAULT_TEMPLATE;
  const templateDir = path.join(__dirname, '../../templates');
  const templatePath = path.join(templateDir, templateFile);

  try {
    const template = await loadTemplate(templatePath);

    if (!validateTemplate(template)) {
      throw new Error(`Invalid template structure: ${templateFile}`);
    }

    return {
      template,
      path: templatePath,
      type: workType
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    // Fallback to default template
    const defaultPath = path.join(templateDir, DEFAULT_TEMPLATE);
    const defaultTemplate = await loadTemplate(defaultPath);

    return {
      template: defaultTemplate,
      path: defaultPath,
      type: 'feature' // Default type
    };
  }
}

/**
 * Loads template file
 */
async function loadTemplate(templatePath) {
  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Template not found: ${templatePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in template: ${templatePath}`);
    }
    throw error;
  }
}

/**
 * Validates template structure
 */
function validateTemplate(template) {
  // Required fields
  const requiredFields = ['work_type', 'phases', 'version'];

  for (const field of requiredFields) {
    if (!template[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate phases structure
  if (!Array.isArray(template.phases)) {
    console.error('Phases must be an array');
    return false;
  }

  // Validate each phase
  for (const phase of template.phases) {
    if (!phase.phase_name || !Array.isArray(phase.tasks)) {
      console.error('Invalid phase structure');
      return false;
    }

    // Validate each task
    for (const task of phase.tasks) {
      if (!task.task_id || !task.description) {
        console.error('Invalid task structure');
        return false;
      }
    }
  }

  return true;
}

/**
 * Lists all available templates
 */
async function listTemplates() {
  const templateDir = path.join(__dirname, '../../templates');

  try {
    const files = await fs.readdir(templateDir);
    return files
      .filter(f => f.endsWith('-template.json'))
      .map(f => f.replace('-template.json', ''));
  } catch (error) {
    console.error('Error listing templates:', error);
    return [];
  }
}

/**
 * Gets template metadata without loading full template
 */
async function getTemplateMetadata(workType) {
  const templateFile = TEMPLATE_MAP[workType];
  if (!templateFile) {
    return null;
  }

  const templatePath = path.join(__dirname, '../../templates', templateFile);

  try {
    const template = await loadTemplate(templatePath);
    return {
      type: workType,
      phaseCount: template.phases.length,
      taskCount: template.phases.reduce((sum, p) => sum + p.tasks.length, 0),
      version: template.version
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  selectTemplate,
  loadTemplate,
  validateTemplate,
  listTemplates,
  getTemplateMetadata,
  TEMPLATE_MAP
};
```

### Decision Tree

```
Input: workType, confidence, options
         |
         v
  [Custom path provided?]
    Yes → Load custom template → Validate → Return
    No ↓
         v
  [Work type in TEMPLATE_MAP?]
    Yes → Load mapped template
    No → Use DEFAULT_TEMPLATE
         |
         v
  [Template file exists?]
    Yes → Load template
    No → Fallback to default (if allowed)
         |
         v
  [Validate template structure]
    Valid → Return template
    Invalid → Fallback to default (if allowed) or throw error
```

---

## 2.3 Plan Extraction Algorithm

### Conversation Analysis Logic

**Location:** `prompts/analyze-conversation.md` (subagent prompt)

```markdown
You are analyzing a conversation to extract structured planning information.

## Input

You will receive a conversation log in JSONL format. Each entry contains:
- `timestamp`: When the message was sent
- `role`: 'user' or 'assistant'
- `content`: The message text

## Your Task

Analyze the conversation and extract the following information:

### 1. Goal (Required)
- **Primary goal**: What is the main objective? (1-2 sentences)
- **Success criteria**: How will we know when it's done?

### 2. Technical Decisions (List all mentioned)
- Technology choices (libraries, frameworks, tools)
- Architecture decisions
- Implementation approaches

### 3. Requirements (List all identified)
- Functional requirements
- Non-functional requirements (performance, security, etc.)
- User requirements

### 4. Constraints (List all mentioned)
- Technical constraints
- Time constraints
- Resource constraints
- Policy/business constraints

### 5. Key Discussion Points (Top 5)
- Important decisions made
- Alternatives considered
- Risks identified

### 6. Conversation Summary
- 2-3 paragraph summary of the conversation
- Focus on: what was discussed, what was decided, what's the plan

## Output Format

Return ONLY a JSON object (no markdown, no explanations):

```json
{
  "goal": {
    "primary": "string",
    "success_criteria": ["string"]
  },
  "technical_decisions": [
    {
      "category": "technology|architecture|approach",
      "decision": "string",
      "rationale": "string"
    }
  ],
  "requirements": {
    "functional": ["string"],
    "non_functional": ["string"]
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
  "conversation_summary": "string (2-3 paragraphs)"
}
```

## Guidelines

1. **Be specific**: Extract exact technologies/decisions mentioned
2. **Be concise**: Summarize, don't copy verbatim
3. **Be accurate**: Only include what was actually discussed
4. **Handle missing info**: If a section has no data, use empty arrays/objects
5. **Stay objective**: Don't add your own opinions

## Example

Input conversation discussing OAuth implementation...

Output:
```json
{
  "goal": {
    "primary": "Implement OAuth2 authentication with Google provider",
    "success_criteria": [
      "Users can log in with Google account",
      "JWT tokens stored securely in Redis",
      "Session management working"
    ]
  },
  "technical_decisions": [
    {
      "category": "technology",
      "decision": "Use passport.js for OAuth",
      "rationale": "Mature library with good Google provider support"
    },
    {
      "category": "architecture",
      "decision": "Store tokens in Redis",
      "rationale": "Fast access and automatic expiration support"
    }
  ],
  "requirements": {
    "functional": [
      "Google OAuth login flow",
      "JWT token generation",
      "Session persistence"
    ],
    "non_functional": [
      "Secure token storage",
      "Fast authentication (< 500ms)"
    ]
  },
  "constraints": [
    {
      "type": "technical",
      "description": "Must work with existing Express.js setup"
    }
  ],
  "discussion_points": [
    {
      "topic": "Provider selection",
      "summary": "Chose Google first, will add Azure AD later"
    }
  ],
  "conversation_summary": "Discussion focused on implementing OAuth2 authentication..."
}
```

Now analyze the conversation provided below.
```

### Extraction Process

```javascript
// Pseudo-code for extraction process

async function extractPlanFromConversation(conversationLog) {
  // 1. Prepare conversation for analysis
  const conversationText = prepareConversation(conversationLog);

  // 2. Invoke subagent with analyze-conversation.md prompt
  const analysis = await invokeSubagent('analyze-conversation', {
    input: conversationText
  });

  // 3. Parse subagent response
  const extractedData = JSON.parse(analysis.output);

  // 4. Validate extracted data
  if (!extractedData.goal || !extractedData.goal.primary) {
    throw new Error('Failed to extract goal from conversation');
  }

  // 5. Return structured data
  return extractedData;
}

function prepareConversation(log) {
  // Format conversation for analysis
  return log.map(entry => ({
    timestamp: entry.timestamp,
    role: entry.role,
    content: entry.content
  }));
}
```

---

## 2.4 Template Merging Algorithm

### Merge Strategy

**Goal:** Combine template structure with conversation-extracted content

**Process:**

```javascript
/**
 * Merges template with conversation analysis
 * @param {Object} template - Template data
 * @param {Object} analysis - Extracted conversation data
 * @param {Object} detection - Work type detection result
 * @returns {Object} - Merged plan data
 */
function mergeTemplatePlan(template, analysis, detection) {
  // 1. Start with template structure
  const plan = JSON.parse(JSON.stringify(template)); // Deep clone

  // 2. Add metadata
  plan.plan_name = ''; // Will be set by command
  plan.created_at = new Date().toISOString();
  plan.work_type = detection.type;
  plan.auto_detected = true;
  plan.detection_confidence = detection.confidence;
  plan.version = '1.0.0';

  // 3. Add goal from conversation
  plan.goal = analysis.goal.primary;
  plan.success_criteria = analysis.goal.success_criteria;

  // 4. Add requirements
  plan.requirements = {
    functional: analysis.requirements.functional,
    non_functional: analysis.requirements.non_functional
  };

  // 5. Add constraints
  plan.constraints = analysis.constraints.map(c => c.description);

  // 6. Add technical decisions
  plan.technical_decisions = analysis.technical_decisions;

  // 7. Enhance phases with conversation context
  plan.phases = enhancePhases(template.phases, analysis);

  // 8. Add conversation summary
  plan.conversation_summary = analysis.conversation_summary;

  // 9. Initialize tracking
  plan.progress = {
    total_tasks: countTasks(plan.phases),
    completed: 0,
    in_progress: 0,
    pending: countTasks(plan.phases)
  };

  return plan;
}

/**
 * Enhances template phases with conversation-specific details
 */
function enhancePhases(templatePhases, analysis) {
  const enhancedPhases = JSON.parse(JSON.stringify(templatePhases));

  // Map conversation discussion points to phases
  const discussionsByPhase = categorizeDiscussions(
    analysis.discussion_points,
    templatePhases
  );

  enhancedPhases.forEach((phase, index) => {
    // Add phase-specific context from discussion
    if (discussionsByPhase[index]) {
      phase.context = discussionsByPhase[index];
    }

    // Enhance task descriptions with specific technologies
    phase.tasks = enhanceTasks(phase.tasks, analysis.technical_decisions);
  });

  return enhancedPhases;
}

/**
 * Enhances task descriptions with conversation specifics
 */
function enhanceTasks(tasks, technicalDecisions) {
  return tasks.map(task => {
    const enhanced = { ...task };

    // Find relevant technical decisions for this task
    const relevantDecisions = technicalDecisions.filter(decision =>
      taskMatchesDecision(task, decision)
    );

    // Add tech stack info to task description
    if (relevantDecisions.length > 0) {
      enhanced.technical_notes = relevantDecisions.map(d =>
        `${d.decision} - ${d.rationale}`
      );
    }

    return enhanced;
  });
}

/**
 * Categorizes discussion points by phase
 */
function categorizeDiscussions(discussions, phases) {
  // Simple keyword matching for now
  // Could be enhanced with ML/semantic matching

  const phaseKeywords = phases.map(p =>
    extractKeywords(p.phase_name)
  );

  const categorized = {};

  discussions.forEach(discussion => {
    const discussionKeywords = extractKeywords(discussion.topic);

    // Find best matching phase
    let bestMatch = 0;
    let bestScore = 0;

    phaseKeywords.forEach((keywords, index) => {
      const score = calculateOverlap(keywords, discussionKeywords);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = index;
      }
    });

    if (!categorized[bestMatch]) {
      categorized[bestMatch] = [];
    }
    categorized[bestMatch].push(discussion.summary);
  });

  return categorized;
}

/**
 * Helper: Extract keywords from text
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3); // Filter short words
}

/**
 * Helper: Calculate keyword overlap
 */
function calculateOverlap(keywords1, keywords2) {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  return intersection.size;
}

/**
 * Helper: Check if task matches technical decision
 */
function taskMatchesDecision(task, decision) {
  const taskText = (task.description + ' ' + (task.details || '')).toLowerCase();
  const decisionText = (decision.decision + ' ' + decision.rationale).toLowerCase();

  // Simple keyword matching
  const decisionKeywords = extractKeywords(decisionText);
  return decisionKeywords.some(keyword => taskText.includes(keyword));
}

/**
 * Helper: Count total tasks
 */
function countTasks(phases) {
  return phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
}

module.exports = {
  mergeTemplatePlan,
  enhancePhases,
  enhanceTasks,
  categorizeDiscussions
};
```

### Merge Conflict Resolution

**Scenario:** Template and conversation have conflicting information

**Resolution Strategy:**

1. **Priority:** Conversation data > Template defaults
2. **Additive:** Combine arrays (tasks, requirements) rather than replace
3. **Preserve Structure:** Keep template phase/task IDs
4. **Enrich, Don't Replace:** Add conversation context to template structure

**Example:**

```javascript
// Template has generic task:
{
  "task_id": "task-1",
  "description": "Set up authentication library"
}

// Conversation specifies passport.js
analysis.technical_decisions = [
  { decision: "Use passport.js for OAuth", rationale: "..." }
]

// Merged result:
{
  "task_id": "task-1",
  "description": "Set up authentication library",
  "technical_notes": ["Use passport.js for OAuth - Mature library with good Google provider support"]
}
```

---

# Part 3: Data Specifications

## 3.1 Complete JSON Schemas

### Plan File Schema (`plan-schema.json`)

**File:** `session/schemas/plan-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://claude.ai/session-plugin/schemas/plan.json",
  "title": "Session Plan",
  "description": "Schema for session planning files",
  "type": "object",
  "required": [
    "plan_name",
    "work_type",
    "goal",
    "phases",
    "created_at",
    "version"
  ],
  "properties": {
    "plan_name": {
      "type": "string",
      "description": "Unique identifier for the plan",
      "pattern": "^[a-z0-9-]+$",
      "minLength": 1,
      "maxLength": 50
    },
    "work_type": {
      "type": "string",
      "description": "Type of work being planned",
      "enum": ["feature", "bug", "spike", "refactor", "other"]
    },
    "auto_detected": {
      "type": "boolean",
      "description": "Whether work type was auto-detected",
      "default": false
    },
    "detection_confidence": {
      "type": "number",
      "description": "Confidence score for auto-detection (0-100)",
      "minimum": 0,
      "maximum": 100
    },
    "goal": {
      "type": "string",
      "description": "Primary goal of this plan",
      "minLength": 10,
      "maxLength": 500
    },
    "success_criteria": {
      "type": "array",
      "description": "Criteria for success",
      "items": {
        "type": "string",
        "minLength": 5,
        "maxLength": 200
      },
      "minItems": 0,
      "maxItems": 10
    },
    "phases": {
      "type": "array",
      "description": "Work phases",
      "items": {
        "$ref": "#/definitions/phase"
      },
      "minItems": 1,
      "maxItems": 10
    },
    "requirements": {
      "type": "object",
      "description": "Project requirements",
      "properties": {
        "functional": {
          "type": "array",
          "items": { "type": "string" }
        },
        "non_functional": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "constraints": {
      "type": "array",
      "description": "Project constraints",
      "items": { "type": "string" }
    },
    "technical_decisions": {
      "type": "array",
      "description": "Technical decisions made",
      "items": {
        "$ref": "#/definitions/technical_decision"
      }
    },
    "conversation_summary": {
      "type": "string",
      "description": "Summary of planning conversation",
      "maxLength": 2000
    },
    "created_at": {
      "type": "string",
      "description": "ISO 8601 timestamp",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "description": "ISO 8601 timestamp",
      "format": "date-time"
    },
    "version": {
      "type": "string",
      "description": "Plan version",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "progress": {
      "type": "object",
      "description": "Execution progress tracking",
      "properties": {
        "total_tasks": { "type": "integer", "minimum": 0 },
        "completed": { "type": "integer", "minimum": 0 },
        "in_progress": { "type": "integer", "minimum": 0 },
        "pending": { "type": "integer", "minimum": 0 }
      },
      "required": ["total_tasks", "completed", "in_progress", "pending"]
    }
  },
  "definitions": {
    "phase": {
      "type": "object",
      "required": ["phase_name", "tasks"],
      "properties": {
        "phase_name": {
          "type": "string",
          "minLength": 3,
          "maxLength": 100
        },
        "description": {
          "type": "string",
          "maxLength": 500
        },
        "tasks": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/task"
          },
          "minItems": 1,
          "maxItems": 50
        },
        "context": {
          "type": "array",
          "description": "Phase-specific context from conversation",
          "items": { "type": "string" }
        }
      }
    },
    "task": {
      "type": "object",
      "required": ["task_id", "description", "status"],
      "properties": {
        "task_id": {
          "type": "string",
          "pattern": "^task-[a-z0-9-]+$"
        },
        "description": {
          "type": "string",
          "minLength": 10,
          "maxLength": 300
        },
        "details": {
          "type": "string",
          "maxLength": 1000
        },
        "status": {
          "type": "string",
          "enum": ["pending", "in_progress", "completed", "blocked"],
          "default": "pending"
        },
        "technical_notes": {
          "type": "array",
          "description": "Conversation-specific technical details",
          "items": { "type": "string" }
        },
        "dependencies": {
          "type": "array",
          "description": "Task IDs this task depends on",
          "items": {
            "type": "string",
            "pattern": "^task-[a-z0-9-]+$"
          }
        },
        "estimated_effort": {
          "type": "string",
          "description": "Time estimate (e.g., '2h', '1d')",
          "pattern": "^\\d+[hdw]$"
        }
      }
    },
    "technical_decision": {
      "type": "object",
      "required": ["category", "decision"],
      "properties": {
        "category": {
          "type": "string",
          "enum": ["technology", "architecture", "approach", "other"]
        },
        "decision": {
          "type": "string",
          "minLength": 5,
          "maxLength": 200
        },
        "rationale": {
          "type": "string",
          "maxLength": 500
        },
        "alternatives": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

### Conversation Context File Structure

**File Format:** Markdown (`.md`)
**Naming:** `conversation_{plan_name}.md`

**Template:**
```markdown
# Conversation Context: {plan_name}

**Created:** {ISO timestamp}
**Work Type:** {detected type}
**Confidence:** {confidence score}%

## Summary

{2-3 paragraph summary}

## Key Points

- {point 1}
- {point 2}

## Technical Decisions

1. **{Category}**: {decision}
   - Rationale: {rationale}

## Requirements

### Functional
- {req 1}

### Non-Functional
- {req 1}

## Constraints

- {constraint 1}

## Original Conversation

[Full conversation log]
```

---

## 3.2 File Formats

### Plan File Naming

**Pattern:** `plan_{name}.json`
- Underscore separator (not hyphen)
- Lowercase only
- {name} can contain hyphens
- Max 50 chars

**Examples:**
- ✅ `plan_oauth-implementation.json`
- ✅ `plan_fix-login-bug.json`
- ❌ `plan-oauth.json` (hyphen instead of underscore)
- ❌ `PLAN_oauth.json` (uppercase)

---

## 3.3 API Contracts

### CLI Response Format

**Success:**
```json
{
  "success": true,
  "data": { },
  "message": "Operation completed"
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description",
    "details": {}
  }
}
```

### Error Codes

| Code | Description | HTTP Equivalent |
|------|-------------|-----------------|
| `INVALID_SESSION` | Session not found | 404 |
| `INVALID_PLAN_NAME` | Name doesn't match pattern | 400 |
| `PLAN_EXISTS` | Plan already exists | 409 |
| `PLAN_NOT_FOUND` | Plan doesn't exist | 404 |
| `VALIDATION_ERROR` | Schema validation failed | 400 |
| `TASK_NOT_FOUND` | Task ID invalid | 404 |
| `INVALID_STATUS` | Status not in enum | 400 |
| `FILE_WRITE_ERROR` | Cannot write file | 500 |
| `FILE_READ_ERROR` | Cannot read file | 500 |
| `PARSE_ERROR` | JSON parse failed | 500 |

---

## 3.4 Validation Rules

### Plan Name Validation

```javascript
const PLAN_NAME_RULES = {
  pattern: /^[a-z0-9-]+$/,
  minLength: 1,
  maxLength: 50,
  reserved: ['index', 'schema', 'template']
};
```

### Task ID Validation

```javascript
const TASK_ID_PATTERN = /^task-[a-z0-9-]+$/;
```

### Status Validation

```javascript
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
```

### Constraint Summary

| Field | Min | Max | Pattern | Enum |
|-------|-----|-----|---------|------|
| plan_name | 1 | 50 | `^[a-z0-9-]+$` | - |
| goal | 10 | 500 | - | - |
| success_criteria items | 5 | 200 | - | - |
| phases | 1 | 10 | - | - |
| tasks per phase | 1 | 50 | - | - |
| task_id | - | - | `^task-[a-z0-9-]+$` | - |
| task description | 10 | 300 | - | - |
| task status | - | - | - | See above |
| work_type | - | - | - | feature/bug/spike/refactor/other |
| confidence | 0 | 100 | - | - |

---


# Part 4: CLI Implementation

## 4.1 Command Specifications

### `/save-plan` Command

**File:** `session/commands/save-plan.md`

**Syntax:**
```
/save-plan {plan_name} [--template {type}] [--no-template]
```

**Arguments:**
- `plan_name` (required): Plan identifier (matches `/^[a-z0-9-]+$/`, 1-50 chars)
- `--template {type}` (optional): Force specific template (feature|bug|spike|refactor)
- `--no-template` (optional): Skip template selection, use conversation-only

**Examples:**
```
/save-plan oauth-implementation
/save-plan fix-login-bug --template bug
/save-plan research-graphql --no-template
```

### CLI Plan Operations

All operations use: `node session-cli.js {command} {args...}`

#### `create-plan`
```bash
node session-cli.js create-plan {session} {plan_name} '{plan_json}'
```

#### `get-plan`
```bash
node session-cli.js get-plan {session} {plan_name}
```

#### `update-plan`
```bash
node session-cli.js update-plan {session} {plan_name} '{updates_json}'
```

#### `delete-plan`
```bash
node session-cli.js delete-plan {session} {plan_name}
```

#### `list-plans`
```bash
node session-cli.js list-plans {session}
```

#### `update-task-status`
```bash
node session-cli.js update-task-status {session} {plan} {task_id} {status}
```

#### `plan-status`
```bash
node session-cli.js plan-status {session} {plan_name}
```

#### `export-plan`
```bash
node session-cli.js export-plan {session} {plan_name} {format}
```
Formats: `json`, `markdown`, `csv`

---

## 4.2 Argument Parsing

### Command Line Parser

**File:** `session/cli/lib/arg-parser.js`

```javascript
/**
 * Parses command line arguments
 */
function parseArgs(argv) {
  const args = {
    positional: [],
    flags: {},
    options: {}
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Long flag: --no-template
    if (arg.startsWith('--no-')) {
      const flagName = arg.slice(5);
      args.flags[flagName] = false;
      continue;
    }

    // Long option: --template feature
    if (arg.startsWith('--')) {
      const optionName = arg.slice(2);
      const optionValue = argv[i + 1];
      if (!optionValue || optionValue.startsWith('-')) {
        throw new Error(`Option --${optionName} requires a value`);
      }
      args.options[optionName] = optionValue;
      i++; // Skip next arg (the value)
      continue;
    }

    // Short flag: -v
    if (arg.startsWith('-') && arg.length === 2) {
      const flagName = arg[1];
      args.flags[flagName] = true;
      continue;
    }

    // Positional argument
    args.positional.push(arg);
  }

  return args;
}

module.exports = { parseArgs };
```

### save-plan.md Argument Parsing

```markdown
## Step 1: Parse Arguments

Extract plan name and options from command arguments:

```javascript
const args = parseArgs(commandArgs); // From user input

const planName = args.positional[0];
const forceTemplate = args.options.template; // --template {type}
const skipTemplate = args.flags.template === false; // --no-template

// Validate plan name
if (!planName || !planName.match(/^[a-z0-9-]+$/)) {
  throw new Error('Invalid plan name. Use lowercase, numbers, and hyphens only.');
}
```
\`\`\`
```

---

## 4.3 Output Formatting

### Success Output

#### Plan Created

```
✓ Plan saved: oauth-implementation

📋 Plan Details:
   • Work type: feature (detected with 87% confidence)
   • Phases: 4
   • Tasks: 11
   • File: .claude/sessions/my-session/plans/plan_oauth-implementation.json

📝 Next Steps:
   1. Start a new session: /session:start oauth-implementation
   2. Load the plan with this prompt:

   "Load plan from .claude/sessions/my-session/plans/plan_oauth-implementation.json
    and begin execution starting with Phase 1, Task 1."

   3. Claude will automatically update task status as work progresses
```

#### Task Status Updated

```
✓ Task completed: task-1-1

📊 Progress: 1/11 tasks (9%)
   • Completed: 1
   • In progress: 0
   • Pending: 10

🎯 Next task: task-1-2 - Set up Redis for token storage
```

#### Plan Status

```
📋 Plan Status: oauth-implementation

Work Type: feature
Created: 2025-11-19 12:00:00

Progress: 3/11 tasks (27%)
├─ Completed: 3
├─ In progress: 1
├─ Pending: 7
└─ Blocked: 0

Current Phase: Phase 2: OAuth Flow Implementation
Current Task: task-2-1 (in_progress)
   └─ Create OAuth callback routes

Completed Tasks:
  ✓ task-1-1: Install and configure passport.js
  ✓ task-1-2: Set up Redis for token storage
  ✓ task-1-3: Configure environment variables

Pending Tasks:
  ⋯ task-2-2: Implement JWT token generation
  ⋯ task-2-3: Add session middleware
  [6 more...]
```

### Error Output

#### Invalid Plan Name

```
❌ Error: Invalid plan name

Plan name must:
  • Use only lowercase letters, numbers, and hyphens
  • Be between 1-50 characters
  • Not be a reserved name (index, schema, template)

Examples:
  ✓ oauth-implementation
  ✓ fix-bug-123
  ❌ OAuth_Implementation (no uppercase/underscores)
  ❌ my.plan (no dots)
```

#### Plan Not Found

```
❌ Error: Plan not found

Plan 'oauth-implementation' does not exist in session 'my-session'

Available plans:
  • fix-login-bug
  • refactor-auth

Use /save-plan oauth-implementation to create it.
```

#### Validation Error

```
❌ Error: Plan validation failed

The following errors were found:

  1. Field 'goal': Must be at least 10 characters
     Current value: "OAuth"

  2. Field 'phases': Must have at least 1 phase
     Current value: []

  3. Field 'progress.total_tasks': Must equal sum of task statuses
     Expected: 11, Got: 10

Fix these errors and try again.
```

---

## 4.4 Error Handling

### Error Handling Strategy

```javascript
/**
 * Centralized error handler for CLI operations
 */
function handleCliError(error, context = {}) {
  const errorMap = {
    INVALID_SESSION: {
      message: `Session '${context.session}' not found`,
      suggestion: 'Use /session list to see available sessions'
    },
    INVALID_PLAN_NAME: {
      message: 'Invalid plan name format',
      suggestion: 'Use lowercase letters, numbers, and hyphens only (1-50 chars)'
    },
    PLAN_EXISTS: {
      message: `Plan '${context.plan}' already exists`,
      suggestion: 'Use a different name or delete the existing plan first'
    },
    PLAN_NOT_FOUND: {
      message: `Plan '${context.plan}' not found`,
      suggestion: 'Use list-plans command to see available plans'
    },
    VALIDATION_ERROR: {
      message: 'Plan validation failed',
      suggestion: 'Check the error details and fix the issues'
    },
    TASK_NOT_FOUND: {
      message: `Task '${context.taskId}' not found`,
      suggestion: 'Check task ID format (should be task-xxx)'
    },
    INVALID_STATUS: {
      message: `Invalid status '${context.status}'`,
      suggestion: 'Use: pending, in_progress, completed, or blocked'
    },
    FILE_WRITE_ERROR: {
      message: 'Failed to write plan file',
      suggestion: 'Check file permissions and disk space'
    },
    FILE_READ_ERROR: {
      message: 'Failed to read plan file',
      suggestion: 'Plan file may be corrupted or missing'
    },
    PARSE_ERROR: {
      message: 'Failed to parse plan file',
      suggestion: 'Plan file contains invalid JSON'
    }
  };

  const errorInfo = errorMap[error.code] || {
    message: error.message,
    suggestion: 'Check the error details'
  };

  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: errorInfo.message,
      suggestion: errorInfo.suggestion,
      details: context
    }
  };
}
```

### Per-Command Error Handling

#### create-plan

```javascript
async function createPlan(sessionName, planName, planData) {
  try {
    // Validate session exists
    const sessionPath = path.join(workingDir, '.claude/sessions', sessionName);
    if (!await fs.access(sessionPath).then(() => true).catch(() => false)) {
      throw { code: 'INVALID_SESSION' };
    }

    // Validate plan name
    const nameValidation = validatePlanName(planName);
    if (!nameValidation.valid) {
      throw { code: 'INVALID_PLAN_NAME', message: nameValidation.error };
    }

    // Check if plan already exists
    const planPath = path.join(sessionPath, 'plans', `plan_${planName}.json`);
    if (await fs.access(planPath).then(() => true).catch(() => false)) {
      throw { code: 'PLAN_EXISTS' };
    }

    // Validate plan data
    const dataValidation = validatePlanData(planData);
    if (!dataValidation.valid) {
      throw {
        code: 'VALIDATION_ERROR',
        details: dataValidation.errors
      };
    }

    // Create plan file
    await fs.writeFile(planPath, JSON.stringify(planData, null, 2));

    return {
      success: true,
      data: {
        plan_name: planName,
        path: planPath
      },
      message: `Plan '${planName}' created successfully`
    };

  } catch (error) {
    return handleCliError(error, { session: sessionName, plan: planName });
  }
}
```

#### update-task-status

```javascript
async function updateTaskStatus(sessionName, planName, taskId, status) {
  try {
    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (!validStatuses.includes(status)) {
      throw { code: 'INVALID_STATUS' };
    }

    // Get plan
    const plan = await getPlan(sessionName, planName);
    if (!plan) {
      throw { code: 'PLAN_NOT_FOUND' };
    }

    // Find task
    let taskFound = false;
    let oldStatus = null;

    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.task_id === taskId) {
          taskFound = true;
          oldStatus = task.status;
          task.status = status;
          break;
        }
      }
      if (taskFound) break;
    }

    if (!taskFound) {
      throw { code: 'TASK_NOT_FOUND' };
    }

    // Update progress counts
    plan.progress = calculateProgress(plan.phases);
    plan.updated_at = new Date().toISOString();

    // Save plan
    await updatePlan(sessionName, planName, plan);

    return {
      success: true,
      data: {
        task_id: taskId,
        old_status: oldStatus,
        new_status: status,
        progress: plan.progress
      },
      message: 'Task status updated successfully'
    };

  } catch (error) {
    return handleCliError(error, {
      session: sessionName,
      plan: planName,
      taskId,
      status
    });
  }
}
```

### Error Recovery Patterns

#### File System Errors

```javascript
// Pattern: Retry with exponential backoff
async function writeWithRetry(filePath, data, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.writeFile(filePath, data);
      return { success: true };
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw { code: 'FILE_WRITE_ERROR', original: error };
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    }
  }
}
```

#### JSON Parse Errors

```javascript
// Pattern: Graceful degradation
async function readPlanSafe(planPath) {
  try {
    const content = await fs.readFile(planPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Attempt recovery by creating backup and returning null
      const backupPath = `${planPath}.corrupted.${Date.now()}`;
      await fs.copyFile(planPath, backupPath);
      console.error(`Corrupted plan backed up to: ${backupPath}`);
      throw { code: 'PARSE_ERROR', backup: backupPath };
    }
    throw { code: 'FILE_READ_ERROR', original: error };
  }
}
```

---


# Part 5: Prompts and Subagents

## 5.1 Complete Prompt Texts

### analyze-conversation.md

**File:** `session/prompts/analyze-conversation.md`

```markdown
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
```

---

### detect-work-type.md

**File:** `session/prompts/detect-work-type.md`

```markdown
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
```

---

### save-plan.md Command Prompt

**File:** `session/commands/save-plan.md`

```markdown
You are executing the /save-plan command to create a structured plan from the current conversation.

## Arguments

Parsed from user input:
- `plan_name`: {name} (required)
- `--template {type}`: Force specific template (optional)
- `--no-template`: Skip template selection (optional)

## Workflow

### Step 1: Validate Session

Check that there is an active session:
```bash
[ -f .claude/sessions/.active-session ] && cat .claude/sessions/.active-session || echo "none"
```

If no active session, show:
```
❌ Error: No active session

You must start or continue a session before creating a plan.
Use /session:start {name} or /session:continue {name}
```

### Step 2: Read Conversation Log

Load the conversation log for analysis:
```bash
Read file: .claude/sessions/{session_name}/conversation-log.jsonl
```

If no conversation log exists:
```
❌ Error: No conversation found

Cannot create plan without conversation history.
Have a discussion first, then use /save-plan
```

### Step 3: Detect Work Type (unless --no-template)

If `--template` flag provided, skip to Step 4 with forced type.
If `--no-template` flag provided, skip to Step 5.

Otherwise, invoke work type detection:

```bash
# Use subagent to detect work type
node {plugin_root}/cli/session-cli.js detect-work-type {session_name}
```

Expected response:
```json
{
  "type": "feature",
  "confidence": 87,
  "scores": {...},
  "signals": {...}
}
```

Show detection result:
```
🔍 Analyzing conversation...
✓ Detected work type: FEATURE (87% confidence)
```

### Step 4: Select Template

Based on detected work type (or forced type):

```bash
node {plugin_root}/cli/session-cli.js select-template {work_type}
```

Returns template JSON structure.

### Step 5: Extract Plan Details

Invoke conversation analysis subagent:

Use Task tool with subagent_type='general-purpose', prompt reads:
{plugin_root}/prompts/analyze-conversation.md and processes conversation log.

Returns extracted data:
```json
{
  "goal": {...},
  "technical_decisions": [...],
  "requirements": {...},
  "constraints": [...],
  "discussion_points": [...],
  "conversation_summary": "..."
}
```

### Step 6: Merge Template + Conversation

If template selected:
```javascript
Merge template structure with extracted conversation data
Apply merging algorithm (see Part 2.4)
```

If no template:
```javascript
Create plan structure from conversation data only
Use standard 3-phase structure (Setup, Implementation, Testing)
```

### Step 7: Show Preview

Display plan preview:
```
📋 Plan Preview: {plan_name}

Work Type: {type} {confidence}% confidence)
Goal: {primary_goal}

Phases: {phase_count}
Tasks: {task_count}

Phase 1: {phase_1_name}
  • task-1-1: {description}
  • task-1-2: {description}
  ...

Phase 2: {phase_2_name}
  ...

[Show first 2 phases, summarize rest]

Options:
  1. ✓ Save this plan (recommended)
  2. Choose different template
  3. Skip template (conversation-only plan)
  4. Cancel
```

### Step 8: User Choice

Wait for user selection (via AskUserQuestion tool).

If option 2 (different template):
- Show template list
- User selects new template
- Go back to Step 4

If option 3 (skip template):
- Set template to null
- Go to Step 5

If option 4 (cancel):
- Abort, show "Plan creation cancelled"

If option 1 (save):
- Continue to Step 9

### Step 9: Validate Plan

```bash
node {plugin_root}/cli/session-cli.js validate-plan '{plan_json}'
```

If validation fails:
```
❌ Validation errors found:
  1. {error_1}
  2. {error_2}

Cannot save invalid plan. Please review.
```
Abort.

If validation succeeds, continue.

### Step 10: Save Plan Files

Create plan file:
```bash
node {plugin_root}/cli/session-cli.js create-plan {session} {plan_name} '{plan_json}'
```

Create conversation context file:
```bash
Write file: .claude/sessions/{session}/plans/conversation_{plan_name}.md
[Use template from Part 3.1]
```

### Step 11: Display Success

```
✓ Plan saved: {plan_name}

📋 Plan Details:
   • Work type: {type} (detected with {confidence}% confidence)
   • Phases: {phase_count}
   • Tasks: {task_count}
   • File: .claude/sessions/{session}/plans/plan_{plan_name}.json

📝 Next Steps:
   1. Start execution session:
      /session:start {plan_name}

   2. Use this execution prompt:

      "Load plan from .claude/sessions/{session}/plans/plan_{plan_name}.json
       and begin execution starting with Phase 1, Task 1.
       
       Auto-update task status as work progresses using:
       updateTaskStatus('{plan_name}', 'task-id', 'status')"

   3. Monitor progress anytime:
      /session:status

💡 The plan will guide your work through all {phase_count} phases systematically.
```

---

## Error Handling

At each step, handle errors gracefully:
- File not found: Show clear message with suggestion
- Validation failed: Show specific errors
- Detection low confidence: Ask user to clarify work type
- Parse errors: Show debug info and abort

Use error handling patterns from Part 4.4.

---


## 5.2 Input/Output Examples

[Already covered in prompt texts above - each prompt includes examples]

## 5.3 Token Optimization

### Strategies
1. **Template scaffolding**: Reduces extraction by 40% (template provides structure)
2. **CLI tools**: 97% token savings vs conversation-based updates
3. **Lazy loading**: Only analyze conversation when /save-plan called
4. **Focused prompts**: Subagents get specific tasks, not full context

### Token Budgets
- Work type detection: ~500-800 tokens
- Conversation analysis: ~1500-2500 tokens (depends on conversation length)
- Template selection: ~100-200 tokens
- Total /save-plan operation: ~2500-4000 tokens

## 5.4 Error Recovery

[Covered in Part 4.4 - Error handling patterns apply to subagents]

---

# Part 6: Templates

## 6.1 Complete Template Files

### feature-template.json

**File:** `session/templates/feature-template.json`

```json
{
  "work_type": "feature",
  "version": "1.0.0",
  "template_version": "1.0.0",
  "phases": [
    {
      "phase_name": "Phase 1: Setup and Configuration",
      "description": "Initial setup, dependencies, and configuration",
      "tasks": [
        {
          "task_id": "task-1-1",
          "description": "Install required dependencies and libraries",
          "details": "Set up project dependencies, install npm packages, configure build tools",
          "status": "pending",
          "estimated_effort": "1h"
        },
        {
          "task_id": "task-1-2",
          "description": "Configure environment and settings",
          "details": "Set up environment variables, configuration files, and secrets management",
          "status": "pending",
          "estimated_effort": "1h"
        },
        {
          "task_id": "task-1-3",
          "description": "Set up database schema or data structures",
          "details": "Create database migrations, schemas, or initialize data structures",
          "status": "pending",
          "estimated_effort": "2h"
        }
      ]
    },
    {
      "phase_name": "Phase 2: Core Implementation",
      "description": "Implement main feature functionality",
      "tasks": [
        {
          "task_id": "task-2-1",
          "description": "Implement core feature logic",
          "details": "Build main functionality, business logic, and algorithms",
          "status": "pending",
          "estimated_effort": "4h",
          "dependencies": ["task-1-1", "task-1-2"]
        },
        {
          "task_id": "task-2-2",
          "description": "Create API endpoints or interfaces",
          "details": "Build REST/GraphQL endpoints, CLI commands, or UI components",
          "status": "pending",
          "estimated_effort": "3h",
          "dependencies": ["task-2-1"]
        },
        {
          "task_id": "task-2-3",
          "description": "Implement data persistence layer",
          "details": "Add database operations, caching, or file storage",
          "status": "pending",
          "estimated_effort": "2h",
          "dependencies": ["task-1-3"]
        }
      ]
    },
    {
      "phase_name": "Phase 3: Testing and Validation",
      "description": "Test feature functionality and edge cases",
      "tasks": [
        {
          "task_id": "task-3-1",
          "description": "Write unit tests",
          "details": "Create unit tests for core logic and utility functions",
          "status": "pending",
          "estimated_effort": "2h",
          "dependencies": ["task-2-1"]
        },
        {
          "task_id": "task-3-2",
          "description": "Write integration tests",
          "details": "Test API endpoints, database interactions, and external integrations",
          "status": "pending",
          "estimated_effort": "3h",
          "dependencies": ["task-2-2", "task-2-3"]
        },
        {
          "task_id": "task-3-3",
          "description": "Perform manual testing and validation",
          "details": "Test user workflows, edge cases, and error scenarios",
          "status": "pending",
          "estimated_effort": "2h",
          "dependencies": ["task-3-1", "task-3-2"]
        }
      ]
    },
    {
      "phase_name": "Phase 4: Deployment and Documentation",
      "description": "Deploy feature and create documentation",
      "tasks": [
        {
          "task_id": "task-4-1",
          "description": "Write user documentation",
          "details": "Create API docs, user guides, or README updates",
          "status": "pending",
          "estimated_effort": "2h"
        },
        {
          "task_id": "task-4-2",
          "description": "Deploy to production",
          "details": "Push to production, run migrations, update configs",
          "status": "pending",
          "estimated_effort": "1h",
          "dependencies": ["task-3-3", "task-4-1"]
        },
        {
          "task_id": "task-4-3",
          "description": "Monitor and validate deployment",
          "details": "Check logs, metrics, and user feedback post-deployment",
          "status": "pending",
          "estimated_effort": "1h",
          "dependencies": ["task-4-2"]
        }
      ]
    }
  ]
}
```

### bug-template.json

```json
{
  "work_type": "bug",
  "version": "1.0.0",
  "phases": [
    {
      "phase_name": "Phase 1: Investigation and Diagnosis",
      "tasks": [
        {"task_id": "task-1-1", "description": "Reproduce the bug", "status": "pending"},
        {"task_id": "task-1-2", "description": "Identify root cause", "status": "pending"},
        {"task_id": "task-1-3", "description": "Determine fix approach", "status": "pending"}
      ]
    },
    {
      "phase_name": "Phase 2: Fix Implementation",
      "tasks": [
        {"task_id": "task-2-1", "description": "Implement bug fix", "status": "pending", "dependencies": ["task-1-3"]},
        {"task_id": "task-2-2", "description": "Add regression test", "status": "pending", "dependencies": ["task-2-1"]}
      ]
    },
    {
      "phase_name": "Phase 3: Testing and Deployment",
      "tasks": [
        {"task_id": "task-3-1", "description": "Verify fix resolves issue", "status": "pending", "dependencies": ["task-2-1"]},
        {"task_id": "task-3-2", "description": "Deploy fix", "status": "pending", "dependencies": ["task-3-1", "task-2-2"]}
      ]
    }
  ]
}
```

### spike-template.json

```json
{
  "work_type": "spike",
  "version": "1.0.0",
  "phases": [
    {
      "phase_name": "Phase 1: Research and Exploration",
      "tasks": [
        {"task_id": "task-1-1", "description": "Research available options and approaches", "status": "pending"},
        {"task_id": "task-1-2", "description": "Document findings and comparisons", "status": "pending"}
      ]
    },
    {
      "phase_name": "Phase 2: Prototyping",
      "tasks": [
        {"task_id": "task-2-1", "description": "Build proof of concept", "status": "pending", "dependencies": ["task-1-1"]},
        {"task_id": "task-2-2", "description": "Test and validate approach", "status": "pending", "dependencies": ["task-2-1"]}
      ]
    },
    {
      "phase_name": "Phase 3: Recommendation",
      "tasks": [
        {"task_id": "task-3-1", "description": "Create recommendation document", "status": "pending", "dependencies": ["task-2-2"]},
        {"task_id": "task-3-2", "description": "Present findings and next steps", "status": "pending", "dependencies": ["task-3-1"]}
      ]
    }
  ]
}
```

### refactor-template.json

```json
{
  "work_type": "refactor",
  "version": "1.0.0",
  "phases": [
    {
      "phase_name": "Phase 1: Analysis",
      "tasks": [
        {"task_id": "task-1-1", "description": "Identify code smells and issues", "status": "pending"},
        {"task_id": "task-1-2", "description": "Plan refactoring approach", "status": "pending"}
      ]
    },
    {
      "phase_name": "Phase 2: Refactoring",
      "tasks": [
        {"task_id": "task-2-1", "description": "Refactor code structure", "status": "pending", "dependencies": ["task-1-2"]},
        {"task_id": "task-2-2", "description": "Ensure tests pass", "status": "pending", "dependencies": ["task-2-1"]}
      ]
    },
    {
      "phase_name": "Phase 3: Validation",
      "tasks": [
        {"task_id": "task-3-1", "description": "Code review and validation", "status": "pending", "dependencies": ["task-2-2"]},
        {"task_id": "task-3-2", "description": "Deploy refactored code", "status": "pending", "dependencies": ["task-3-1"]}
      ]
    }
  ]
}
```

## 6.2 Variable System

Templates use placeholders that get replaced with conversation-specific content:

- `{goal}` → Extracted primary goal
- `{technology}` → Specific tech stack mentioned
- `{approach}` → Implementation approach discussed

**Replacement happens during merge** (see Part 2.4)

## 6.3 Customization Guide

Users can create custom templates by:
1. Copying existing template
2. Modifying phases/tasks
3. Saving to `session/templates/custom-{name}-template.json`
4. Using `--template custom-{name}` flag

## 6.4 Template Validation

Templates must pass schema validation (see Part 3.1) and include:
- `work_type` field
- At least 1 phase
- Each phase has at least 1 task
- All tasks have required fields (task_id, description, status)

---

# Part 7: Testing

## 7.1 Unit Test Specifications

### work-type-detector.test.js

```javascript
const { detectWorkType, analyzeKeywords } = require('../cli/lib/work-type-detector');

describe('Work Type Detector', () => {
  test('detects feature from keywords', async () => {
    const conversation = [
      { role: 'user', content: 'I want to implement OAuth authentication' },
      { role: 'assistant', content: 'We can build that with passport.js' }
    ];
    
    const result = await detectWorkType(conversation);
    expect(result.type).toBe('feature');
    expect(result.confidence).toBeGreaterThan(70);
  });

  test('detects bug from error discussion', async () => {
    const conversation = [
      { role: 'user', content: 'Login is broken, throwing TypeError' },
      { role: 'assistant', content: 'Let me fix that error' }
    ];
    
    const result = await detectWorkType(conversation);
    expect(result.type).toBe('bug');
  });

  test('returns unknown for ambiguous conversation', async () => {
    const conversation = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    const result = await detectWorkType(conversation);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBeLessThan(50);
  });

  test('analyzes keywords correctly', () => {
    const text = 'implement new feature build authentication';
    const analysis = analyzeKeywords(text);
    
    expect(analysis.feature.score).toBeGreaterThan(0);
    expect(analysis.feature.matched.primary).toContain('implement');
  });
});
```

### plan-ops.test.js

```javascript
const { createPlan, getPlan, updateTaskStatus } = require('../cli/lib/commands/plan-ops');

describe('Plan Operations', () => {
  const testSession = 'test-session';
  const testPlan = 'test-plan';

  afterEach(async () => {
    // Cleanup test files
  });

  test('creates plan successfully', async () => {
    const planData = {
      plan_name: testPlan,
      work_type: 'feature',
      goal: 'Test goal',
      phases: [/* ... */],
      version: '1.0.0'
    };
    
    const result = await createPlan(testSession, testPlan, planData);
    expect(result.success).toBe(true);
  });

  test('rejects invalid plan name', async () => {
    const result = await createPlan(testSession, 'Invalid Name!', {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PLAN_NAME');
  });

  test('updates task status correctly', async () => {
    // Setup: create plan first
    await createPlan(testSession, testPlan, validPlanData);
    
    const result = await updateTaskStatus(testSession, testPlan, 'task-1-1', 'completed');
    expect(result.success).toBe(true);
    expect(result.data.new_status).toBe('completed');
  });
});
```

## 7.2 Integration Test Scenarios

### Scenario 1: Full Plan Creation Flow

```javascript
test('complete plan creation from conversation', async () => {
  // 1. Create session
  await createSession('integration-test');
  
  // 2. Add conversation entries
  await addConversationEntry('user', 'Implement OAuth');
  await addConversationEntry('assistant', 'Using passport.js');
  
  // 3. Detect work type
  const detection = await detectWorkType(sessionName);
  expect(detection.type).toBe('feature');
  
  // 4. Select template
  const template = await selectTemplate(detection.type);
  expect(template).toBeDefined();
  
  // 5. Analyze conversation
  const analysis = await analyzeConversation(sessionName);
  expect(analysis.goal).toBeDefined();
  
  // 6. Merge and create plan
  const planData = mergePlan(template, analysis, detection);
  const result = await createPlan(sessionName, 'oauth-test', planData);
  expect(result.success).toBe(true);
  
  // 7. Verify plan file exists
  const plan = await getPlan(sessionName, 'oauth-test');
  expect(plan).toBeDefined();
  expect(plan.work_type).toBe('feature');
});
```

## 7.3 Test Data Sets

### Sample Conversations

**Feature conversation:**
```json
[
  {"role": "user", "content": "I want to add user authentication to our app"},
  {"role": "assistant", "content": "Great! We could use passport.js for that"},
  {"role": "user", "content": "Yes, with Google OAuth and JWT tokens"},
  {"role": "assistant", "content": "Perfect. We'll store tokens in Redis"}
]
```

**Bug conversation:**
```json
[
  {"role": "user", "content": "Login page is throwing TypeError: Cannot read property 'email' of undefined"},
  {"role": "assistant", "content": "Can you share the full stack trace?"},
  {"role": "user", "content": "It happens when user object is null"},
  {"role": "assistant", "content": "I see the issue. We need to add null checking"}
]
```

## 7.4 Coverage Requirements

- Unit tests: >80% code coverage
- Integration tests: All major workflows covered
- Edge cases: Invalid inputs, missing files, corrupted data
- Performance: Large plans (100+ tasks) tested

---

# Part 8: Integration

## 8.1 Code Modifications

### plugin.json

```json
{
  "name": "session",
  "version": "4.0.0",
  "commands": "./commands",
  "additionalCommands": {
    "save-plan": "./commands/save-plan.md"
  }
}
```

### session-cli.js (additions)

```javascript
// Add to command handler (line ~56)
const planOps = require('./lib/commands/plan-ops');
const workTypeDetector = require('./lib/work-type-detector');
const templateSelector = require('./lib/template-selector');

// Add to switch statement
case 'create-plan':
  return await planOps.createPlan(args[0], args[1], JSON.parse(args[2]));
case 'get-plan':
  return await planOps.getPlan(args[0], args[1]);
case 'update-task-status':
  return await planOps.updateTaskStatus(args[0], args[1], args[2], args[3]);
case 'detect-work-type':
  const conversation = await readConversationLog(args[0]);
  return await workTypeDetector.detectWorkType(conversation);
case 'select-template':
  return await templateSelector.selectTemplate(args[0]);
```

## 8.2 Hook Integration Points

### Optional: Auto-suggest plan on session start

Add to `commands/start.md` (after session creation):

```markdown
5. Check for conversation without plan:
   - If conversation log exists but no plans directory
   - Suggest: "💡 You have a conversation going. Consider creating a plan with /save-plan"
```

## 8.3 Migration Scripts

### Migrate existing sessions (v3.x → v4.0)

```bash
#!/bin/bash
# migrate-to-v4.sh

for session in .claude/sessions/*/; do
  session_name=$(basename "$session")
  
  # Create plans directory if missing
  mkdir -p "$session/plans"
  
  # Update index.json to include plans field
  # (Add plans: { count: 0, names: [], latest: null })
done
```

## 8.4 Compatibility Matrix

| Session Version | Planning Support | Migration Required |
|-----------------|------------------|-------------------|
| v3.0-3.9 | No | Yes (auto-create plans dir) |
| v4.0+ | Yes | No |

---

# Part 9: Deployment

## 9.1 Pre-flight Checklist

- [ ] All template files created in `session/templates/`
- [ ] Schema file created: `session/schemas/plan-schema.json`
- [ ] CLI commands added to `session-cli.js`
- [ ] save-plan.md command created
- [ ] Prompts created: `analyze-conversation.md`, `detect-work-type.md`
- [ ] Tests passing (unit + integration)
- [ ] plugin.json updated with new version
- [ ] CHANGELOG updated

## 9.2 Deployment Steps

1. **Version Bump**
   ```bash
   # Update version in plugin.json
   sed -i '' 's/"version": "3.9.0"/"version": "4.0.0"/' session/plugin.json
   ```

2. **Run Tests**
   ```bash
   npm test
   ```

3. **Build/Package** (if applicable)
   ```bash
   # No build step for this plugin
   ```

4. **Commit Changes**
   ```bash
   git add session/
   git commit -m "feat: Add planning feature (v4.0.0)"
   ```

5. **Tag Release**
   ```bash
   git tag -a v4.0.0 -m "Planning feature release"
   ```

6. **Push to Repository**
   ```bash
   git push origin main
   git push --tags
   ```

## 9.3 Validation Tests

After deployment, verify:

```bash
# Test 1: Command available
claude-code /save-plan --help

# Test 2: CLI operations work
node session/cli/session-cli.js list-plans test-session

# Test 3: Template loading
node session/cli/session-cli.js select-template feature

# Test 4: Full workflow (in active session)
# - Have conversation
# - Run /save-plan test-plan
# - Verify plan file created
# - Check plan can be loaded
```

## 9.4 Rollback Procedures

If issues found post-deployment:

1. **Revert commit**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Restore previous version**
   ```bash
   git checkout v3.9.0
   ```

3. **Clean up plan files** (optional)
   ```bash
   # Remove plans directories from sessions
   find .claude/sessions -name "plans" -type d -exec rm -rf {} +
   ```

---

# Part 10: Appendices

## Appendix A: Error Code Reference

| Code | HTTP | Description | User Action |
|------|------|-------------|-------------|
| INVALID_SESSION | 404 | Session not found | Check session name, use /session list |
| INVALID_PLAN_NAME | 400 | Name format invalid | Use lowercase, numbers, hyphens only |
| PLAN_EXISTS | 409 | Plan already exists | Choose different name or delete existing |
| PLAN_NOT_FOUND | 404 | Plan doesn't exist | Check plan name, use list-plans |
| VALIDATION_ERROR | 400 | Schema validation failed | Fix validation errors shown |
| TASK_NOT_FOUND | 404 | Task ID not found | Verify task ID format |
| INVALID_STATUS | 400 | Status not allowed | Use: pending, in_progress, completed, blocked |
| FILE_WRITE_ERROR | 500 | Can't write file | Check permissions, disk space |
| FILE_READ_ERROR | 500 | Can't read file | Check file exists, not corrupted |
| PARSE_ERROR | 500 | JSON parse failed | File may be corrupted |

## Appendix B: Performance Benchmarks

| Operation | Expected Time | Token Usage |
|-----------|---------------|-------------|
| Detect work type | < 2s | 500-800 |
| Analyze conversation (10 msgs) | < 3s | 1500-2000 |
| Analyze conversation (50 msgs) | < 5s | 3000-4000 |
| Create plan (with template) | < 4s | 2500-3500 |
| Create plan (no template) | < 5s | 3500-5000 |
| Update task status | < 100ms | 0 (CLI only) |
| Get plan status | < 50ms | 0 (CLI only) |
| Validate plan | < 100ms | 0 (CLI only) |

**Large Plan Performance:**
- 100 tasks: All operations < 200ms
- 500 tasks: Read/write < 500ms

## Appendix C: Security Considerations

1. **File Access**
   - Plans stored in session directories (user-owned)
   - No cross-session access
   - File permissions inherited from session

2. **Input Validation**
   - All user inputs validated against patterns
   - JSON schema validation prevents injection
   - Plan name restricted to safe characters

3. **Secrets**
   - No secrets stored in plan files
   - Conversation summaries may contain sensitive info (user responsibility)
   - Recommend: Don't include API keys/passwords in planning conversations

4. **Code Injection**
   - Template files are JSON (no code execution)
   - CLI uses parameterized commands (no shell injection)

## Appendix D: Future Extensions

### Potential Enhancements (Post-v4.0)

1. **Plan Templates Marketplace**
   - Community-contributed templates
   - Template versioning and updates
   - Template search and discovery

2. **Plan Collaboration**
   - Share plans across sessions
   - Plan forking and merging
   - Team plan synchronization

3. **Advanced Tracking**
   - Time tracking per task
   - Burndown charts
   - Velocity metrics

4. **AI Enhancements**
   - Suggested next tasks based on progress
   - Risk detection (blocked tasks, dependencies)
   - Automatic plan adjustments

5. **Integrations**
   - Export to Jira, Linear, GitHub Issues
   - Import from existing project management tools
   - Webhook notifications for plan updates

---

# Document Completion

This implementation specification provides complete, executable details for building the session plugin planning feature. All critical components are fully specified:

✅ Code structure and organization
✅ Complete algorithms with real implementations
✅ Full JSON schemas and validations
✅ CLI commands with exact syntax
✅ Complete prompt texts for subagents
✅ All 4 template files
✅ Test specifications and scenarios
✅ Integration modifications
✅ Deployment procedures
✅ Error handling and recovery

**Implementation Readiness: 9/10**

Ready to begin implementation. Estimated effort: 9-14 hours as specified in PLANNING_FEATURE_APPROACH.md.

---

**End of Implementation Specification**

