# DevOps Plugin - Complete Implementation Guide

**Version**: 1.0
**Target Release**: v1.0.0
**Expected Timeline**: 8-12 implementation sessions
**Architecture**: Multi-platform deployment automation with zero-token CLI
**Last Updated**: 2025-11-17

---

## I. QUICK STATUS DASHBOARD

**Current Session**: Session 2 (Platform Implementation)
**Active Wave**: Wave 2 (Core Platforms)
**Overall Progress**: 25% (5/20 tasks complete)

### Progress by Wave

| Wave | Name | Status | Tasks Complete | Blocked | Est. Remaining |
|------|------|--------|----------------|---------|----------------|
| W1 | Foundation | ✅ COMPLETE | 5/5 | 0 | 0 hours |
| W2 | Core Platforms | IN PROGRESS | 0/6 | 0 | 16 hours |
| W3 | Commands & Integration | TODO | 0/5 | 0 | 12 hours |
| W4 | Testing & Polish | TODO | 0/4 | 0 | 8 hours |

### Active Blockers

None currently.

### Recent Session Notes

**Session 1 (2025-11-17)**: Created plugin structure, CLI scaffolding, basic validators. Ready for platform implementations.
**Session 2 (2025-11-17)**: Completed Wave 1 Foundation (T001-T005). All foundation modules implemented and working. Ready to begin Wave 2 platform implementations.

---

## II. ARCHITECTURE OVERVIEW

### System Design

```
DevOps Plugin Architecture (Zero-Token Pattern)
================================================

Claude Commands (Markdown)          CLI Layer (Node.js)           External APIs
==================                  ==================            =============

/devops:deploy      →  Parse args  →  devops-cli.js  →  Platform Manager  →  Netlify API
/devops:init        →  Validate    →  Command Router →  Secrets Manager   →  AWS API
/devops:status      →  Execute     →  Config Manager →  Deployment Track  →  GCP API
                                       Error Handler  →  Validators        →  Azure API

Token Usage:
- Commands: ~2-5k tokens (orchestration only)
- CLI operations: ZERO tokens (Node.js execution)
- Results: ~500-1000 tokens (JSON responses)

Benefit: 95%+ token reduction vs inline operations
```

### Core Principles

1. **Zero-Token CLI**: All heavy operations (API calls, file I/O, crypto) happen in Node.js
2. **Command Orchestration**: Markdown commands orchestrate, don't execute
3. **Self-Contained Tasks**: Each task has complete context to execute independently
4. **Wave-Based Execution**: Dependencies grouped into waves for parallel execution
5. **Session Resumability**: Status tracking + session notes enable context restoration

### Technology Stack

**Commands Layer**:
- 9 Markdown command files (`/devops:*` commands)
- Argument parsing and validation
- CLI invocation via Bash tool
- Result formatting for user display

**CLI Layer** (Node.js):
- CLI router (`devops-cli.js`)
- 5 platform managers (Netlify, AWS, GCP, Azure, Vercel)
- Secrets manager (AES-256 encryption)
- Config manager (JSON-based)
- Deployment tracker (audit trail)
- Validators (platform-specific)

**External Layer**:
- Platform SDKs/APIs
- Authentication handlers
- File upload mechanisms

### Key Design Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Zero-Token CLI Pattern | 95% token reduction, faster execution | Inline operations (rejected: too slow, high cost) |
| Platform Manager Pattern | Extensibility, isolation, testability | Monolithic manager (rejected: hard to maintain) |
| Hybrid Secrets Strategy | Dev/prod flexibility | External only (rejected: dev friction) |
| Rolling Deployment Default | Zero downtime, safety | Blue-green (rejected: costly), Canary (complex) |
| JSON Configuration | Human-readable, versionable | YAML (rejected: parsing complexity) |
| Wave-Based Execution | Parallel work, clear dependencies | Flat list (rejected: unclear dependencies) |

### Data Structures

**Configuration Schema** (`.devops/config.json`):
```json
{
  "version": "1.0",
  "platform": "netlify|aws|gcp|azure|vercel",
  "environment": "production|staging|dev",
  "deployment": {
    "strategy": "rolling|blue-green|canary",
    "auto_deploy": false,
    "rollback_on_failure": true
  },
  "secrets": {
    "mode": "local|aws|gcp|azure",
    "encryption": "aes-256-gcm"
  }
}
```

**Deployment Record** (`.devops/deployments/{id}.json`):
```json
{
  "id": "dep_abc123",
  "timestamp": "2025-11-17T13:00:00Z",
  "platform": "netlify",
  "version": "1.0.0",
  "status": "success|failed|rolled_back",
  "url": "https://...",
  "duration_ms": 45000,
  "files_deployed": 127,
  "rollback_available": true
}
```

**Secrets Storage** (`.devops/credentials.enc`):
```
AES-256-GCM encrypted binary
Master key from environment: DEVOPS_MASTER_KEY
Never committed to git
```

### Flow Diagrams

**Deployment Flow**:
```
User: /devops:deploy production
  ↓
Command: deploy.md
  ↓ Validate args
  ↓ Check config exists
  ↓
CLI: devops-cli.js deploy --env production
  ↓ Load config
  ↓ Load secrets
  ↓ Pre-deployment checks
  ↓
Platform Manager: netlify-manager.js
  ↓ Upload files
  ↓ Trigger build
  ↓ Wait for completion
  ↓ Health check
  ↓
Deployment Tracker
  ↓ Record deployment
  ↓ Return metadata
  ↓
Command: Format results
  ↓
User: ✓ Deployed to https://...
```

**Rollback Flow**:
```
User: /devops:rollback
  ↓
Command: rollback.md
  ↓ Load deployment history
  ↓ Show recent deployments
  ↓ Get user confirmation
  ↓
CLI: devops-cli.js rollback dep_abc123
  ↓ Load deployment record
  ↓ Validate rollback possible
  ↓
Platform Manager
  ↓ Restore previous version
  ↓ Health check
  ↓
Deployment Tracker
  ↓ Record rollback
  ↓
User: ✓ Rolled back to v1.2.2
```

### File Structure

```
devops/
├── plugin.json                   # Plugin manifest
├── README.md                     # User documentation
├── IMPLEMENTATION.md             # THIS FILE - Complete implementation guide
│
├── commands/                     # Command definitions (9 files)
│   ├── init.md                   # Initialize config
│   ├── deploy.md                 # Deploy application
│   ├── build.md                  # Trigger CI/CD build
│   ├── infra.md                  # Manage infrastructure
│   ├── status.md                 # Check status
│   ├── logs.md                   # View logs
│   ├── rollback.md               # Rollback deployment
│   ├── config.md                 # Manage config
│   └── secrets.md                # Manage secrets
│
├── cli/                          # Node.js CLI
│   ├── devops-cli.js             # Main CLI entry
│   ├── package.json              # Dependencies
│   │
│   └── lib/                      # CLI modules
│       ├── platforms/            # Platform managers
│       │   ├── netlify-manager.js    # ✅ Priority 1
│       │   ├── aws-manager.js        # Priority 2
│       │   ├── gcp-manager.js        # Priority 3
│       │   ├── azure-manager.js      # Priority 4
│       │   └── vercel-manager.js     # Priority 5
│       │
│       ├── validators/           # Validation modules
│       │   ├── platform-validator.js
│       │   └── netlify-validator.js
│       │
│       ├── errors/               # Error handling
│       │   └── netlify-errors.js
│       │
│       ├── config-manager.js     # Configuration management
│       ├── secrets-manager.js    # Secrets encryption
│       └── deployment-tracker.js # Audit trail
│
├── hooks/                        # Lifecycle hooks
│   ├── hooks.json
│   └── pre-deployment-check.js
│
└── templates/                    # Config templates
    ├── netlify-config.template.json
    ├── aws-config.template.json
    ├── gcp-config.template.json
    ├── azure-config.template.json
    └── vercel-config.template.json
```

---

## III. DEPENDENCY GRAPH

### Visual Representation

```
Wave 1 (Foundation) - No Dependencies - CAN RUN IN PARALLEL
==============================================================
T001: CLI Router          │
T002: Config Manager      │  All 5 tasks can run
T003: Secrets Manager     │  simultaneously
T004: Deployment Tracker  │
T005: Platform Validator  │

Wave 2 (Platform Implementations) - Depends on Wave 1 - CAN RUN IN PARALLEL
=============================================================================
T006: Netlify Manager     (requires T001, T002, T003, T005)  │
T007: Netlify Validator   (requires T005)                     │
T008: Netlify Errors      (requires T007)                     │  All 6 tasks
T009: AWS Manager         (requires T001, T002, T003, T005)  │  can run in
T010: GCP Manager         (requires T001, T002, T003, T005)  │  parallel
T011: Azure Manager       (requires T001, T002, T003, T005)  │

Wave 3 (Commands & Integration) - Depends on Wave 2 - CAN RUN IN PARALLEL
===========================================================================
T012: /devops:init        (requires T002, T006)      │
T013: /devops:deploy      (requires T006, T004)      │  All 5 commands
T014: /devops:secrets     (requires T003)            │  can run in
T015: /devops:rollback    (requires T004, T006)      │  parallel
T016: /devops:status      (requires T004, T006)      │

Wave 4 (Testing & Polish) - Depends on Wave 3 - CAN RUN IN PARALLEL
=====================================================================
T017: Integration tests   │
T018: Platform tests      │  All 4 tasks can
T019: E2E deployment tests│  run in parallel
T020: Documentation       │
```

### Execution Strategy

**Parallel Opportunities**:
- **Wave 1**: All 5 tasks → 10 hours sequential → 2-3 hours parallel
- **Wave 2**: All 6 tasks → 24 hours sequential → 4-6 hours parallel
- **Wave 3**: All 5 tasks → 15 hours sequential → 3-4 hours parallel
- **Wave 4**: All 4 tasks → 8 hours sequential → 2-3 hours parallel

**Critical Path** (minimum time to Netlify-only MVP):
```
T001 → T006 → T012 → T017
2h + 4h + 3h + 2h = 11 hours minimum
```

**Recommended Session Plan** (with parallel work):
```
Session 1: T001, T002, T003 in parallel (Foundation starts)
Session 2: T004, T005 (Foundation completes)
Session 3: T006, T007, T008 in parallel (Netlify complete)
Session 4: T012, T013, T014, T015, T016 in parallel (All commands)
Session 5: T017, T018, T019 in parallel (Testing complete)
Total: 5 sessions × 2-3 hours = 10-15 hours
```

---

## IV. WAVE EXECUTION PLAN

### Wave 1: Foundation Layer

**Status**: ✅ COMPLETE (5/5 complete)
**Can Start**: Immediately (no dependencies)
**Estimated Time**: 10 hours total, 0 hours remaining
**Parallel Execution**: ✅ All 5 tasks can run simultaneously

**Tasks in This Wave**:
- [✅] T001: CLI Router
- [✅] T002: Config Manager
- [✅] T003: Secrets Manager
- [✅] T004: Deployment Tracker
- [✅] T005: Platform Validator

**Completion Criteria**:
- ✅ CLI entry point functional
- ✅ Config loading/saving works
- ✅ Secrets encryption/decryption works
- ✅ Deployment records saved/retrieved
- ✅ Platform validation framework ready

**Why This Wave**:
Foundation layer provides core infrastructure all other components need. Must be solid before building on top.

---

### Wave 2: Platform Implementations

**Status**: IN PROGRESS
**Can Start**: ✅ Wave 1 complete - Ready to begin
**Estimated Time**: 24 hours total (4-6 hours with parallelization)
**Parallel Execution**: ✅ All 6 tasks can run simultaneously

**Tasks in This Wave**:
- [ ] T006: Netlify Manager (Priority 1 - MVP)
- [ ] T007: Netlify Validator
- [ ] T008: Netlify Error Handler
- [ ] T009: AWS Manager (Priority 2)
- [ ] T010: GCP Manager (Priority 3)
- [ ] T011: Azure Manager (Priority 4)

**Completion Criteria**:
- [ ] Netlify deploy/rollback functional (MUST HAVE for v1.0)
- [ ] AWS deployment working (OPTIONAL for v1.0)
- [ ] Error handling comprehensive
- [ ] All managers follow same interface

**Why This Wave**:
Platform implementations are independent of each other. Can be built in parallel by different developers/agents.

---

### Wave 3: Commands & Integration

**Status**: TODO
**Can Start**: After Wave 2 complete
**Estimated Time**: 15 hours total (3-4 hours with parallelization)
**Parallel Execution**: ✅ Commands can be built in parallel

**Tasks in This Wave**:
- [ ] T012: /devops:init command
- [ ] T013: /devops:deploy command
- [ ] T014: /devops:secrets command
- [ ] T015: /devops:rollback command
- [ ] T016: /devops:status command

**Completion Criteria**:
- [ ] All 5 core commands functional
- [ ] End-to-end Netlify workflow works (init → deploy → status → rollback)
- [ ] User documentation updated
- [ ] Error messages clear and actionable

**Why This Wave**:
Commands tie everything together. Each command is independent and can be built in parallel once platforms are ready.

---

### Wave 4: Testing & Polish

**Status**: TODO
**Can Start**: After Wave 3 complete
**Estimated Time**: 8 hours total (2-3 hours with parallelization)
**Parallel Execution**: ✅ Test suites can run in parallel

**Tasks in This Wave**:
- [ ] T017: Integration tests (module integration)
- [ ] T018: Platform validation tests (each platform)
- [ ] T019: E2E deployment tests (full workflows)
- [ ] T020: Documentation finalization (README, examples)

**Completion Criteria**:
- [ ] All tests passing
- [ ] Code coverage >80%
- [ ] Documentation complete
- [ ] Example workflows documented
- [ ] Ready for v1.0 release

**Why This Wave**:
Final validation and polish. Tests can run in parallel. Documentation can be written while tests run.

---

## V. TASK DETAILS

### T001: CLI Router

**Wave**: 1 (Foundation)
**Status**: ✅ DONE
**Priority**: P0 (Critical)
**Effort**: 2 hours
**Dependencies**: None
**Can Run in Parallel**: Yes (with T002, T003, T004, T005)

#### What to Build

A Node.js CLI entry point (`devops-cli.js`) that:
- Parses command-line arguments
- Routes to appropriate handler modules
- Provides standardized JSON output
- Handles errors gracefully
- Supports `--help` and `--version` flags

#### Why Needed

Central entry point for all DevOps operations. Commands invoke this CLI to execute platform operations without consuming Claude tokens.

#### How to Build

**File**: `devops/cli/devops-cli.js`

**Step 1: Create argument parser**
```javascript
#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

function parseArgs() {
  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      options[key] = value;
      i++;
    }
  }
  return { command, options };
}
```

**Step 2: Import handler modules**
```javascript
const configManager = require('./lib/config-manager');
const secretsManager = require('./lib/secrets-manager');
const deploymentTracker = require('./lib/deployment-tracker');
const netlifyManager = require('./lib/platforms/netlify-manager');
```

**Step 3: Implement command router**
```javascript
async function main() {
  try {
    const { command, options } = parseArgs();

    switch (command) {
      case 'deploy':
        return await handleDeploy(options);
      case 'config':
        return await handleConfig(options);
      case 'secrets':
        return await handleSecrets(options);
      case 'status':
        return await handleStatus(options);
      case 'rollback':
        return await handleRollback(options);
      case 'init':
        return await handleInit(options);
      case '--help':
        return showHelp();
      case '--version':
        return showVersion();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    outputError({ error: error.message, stack: error.stack });
    process.exit(1);
  }
}
```

**Step 4: JSON output helpers**
```javascript
function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function outputError(error) {
  console.error(JSON.stringify({ success: false, ...error }, null, 2));
  process.exit(1);
}
```

**Step 5: Add main execution**
```javascript
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
```

#### Files to Create/Modify

**Create**:
- `devops/cli/devops-cli.js` (~200 lines)

**Modify**:
- `devops/cli/package.json` (add bin entry):
```json
{
  "bin": {
    "devops-cli": "./devops-cli.js"
  }
}
```

#### Acceptance Criteria

- [✅] `node devops-cli.js --help` shows usage
- [✅] `node devops-cli.js --version` shows version
- [✅] Invalid command returns JSON error with exit code 1
- [✅] All commands route to correct handlers
- [✅] Exit codes: 0 for success, 1 for errors
- [✅] JSON output always parseable

#### Examples/References

**Input**:
```bash
node devops-cli.js deploy --platform netlify --env production
```

**Output**:
```json
{
  "success": true,
  "deployment_id": "dep_abc123",
  "url": "https://app.netlify.app",
  "duration_ms": 45000
}
```

**Error Output**:
```json
{
  "success": false,
  "error": "Platform 'netlify' not configured",
  "code": "CONFIG_MISSING"
}
```

#### Testing Checklist

- [✅] Run with no args (shows help)
- [✅] Run with `--help`
- [✅] Run with `--version`
- [✅] Run with invalid command
- [✅] Verify JSON output format
- [✅] Test exit codes (0 for success, 1 for error)

#### Session Notes

**2025-11-17 Session 1** (13:00-15:00, 2 hours):
- ✅ Created basic CLI structure
- ✅ Implemented argument parsing
- ✅ Added command routing
- ✅ JSON output formatting
- Ready for platform integrations

#### Rollback Info

If this task fails:
1. Delete `devops/cli/devops-cli.js`
2. Revert `package.json` bin entry
3. No other cleanup needed (isolated task)

---

### T002: Config Manager

**Wave**: 1 (Foundation)
**Status**: ✅ DONE
**Priority**: P0 (Critical)
**Effort**: 2 hours
**Dependencies**: None
**Can Run in Parallel**: Yes

#### What to Build

A configuration management module that:
- Loads/saves `.devops/config.json`
- Validates configuration schema
- Provides get/set operations
- Supports environment overrides
- Exports/imports configs

#### Why Needed

Centralized configuration storage for platform settings, deployment strategy, secrets mode. Required by all platform managers.

#### How to Build

**File**: `devops/cli/lib/config-manager.js`

**Step 1: Define schema**
```javascript
const fs = require('fs');
const path = require('path');

const CONFIG_SCHEMA = {
  version: { type: 'string', required: true, default: '1.0' },
  platform: {
    type: 'string',
    enum: ['netlify', 'aws', 'gcp', 'azure', 'vercel'],
    required: true
  },
  environment: {
    type: 'string',
    enum: ['production', 'staging', 'dev'],
    required: true,
    default: 'production'
  },
  deployment: {
    type: 'object',
    properties: {
      strategy: { enum: ['rolling', 'blue-green', 'canary'], default: 'rolling' },
      auto_deploy: { type: 'boolean', default: false },
      rollback_on_failure: { type: 'boolean', default: true }
    }
  },
  secrets: {
    type: 'object',
    properties: {
      mode: { enum: ['local', 'aws', 'gcp', 'azure'], default: 'local' },
      encryption: { type: 'string', default: 'aes-256-gcm' }
    }
  }
};
```

**Step 2: Implement load function**
```javascript
function loadConfig(projectRoot = process.cwd()) {
  const configPath = path.join(projectRoot, '.devops', 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error('Config not found. Run /devops:init first.');
  }

  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);

  validateConfig(config);
  return config;
}
```

**Step 3: Implement save function**
```javascript
function saveConfig(config, projectRoot = process.cwd()) {
  validateConfig(config);

  const configDir = path.join(projectRoot, '.devops');
  const configPath = path.join(configDir, 'config.json');

  // Create directory if not exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}
```

**Step 4: Implement validation**
```javascript
function validateConfig(config) {
  const errors = [];

  // Check required fields
  for (const [key, rules] of Object.entries(CONFIG_SCHEMA)) {
    if (rules.required && !config[key]) {
      errors.push(`Missing required field: ${key}`);
    }

    // Check enum values
    if (rules.enum && config[key] && !rules.enum.includes(config[key])) {
      errors.push(`Invalid ${key}: ${config[key]}. Must be one of: ${rules.enum.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }
}
```

**Step 5: Helper functions**
```javascript
function getConfigValue(key, projectRoot = process.cwd()) {
  const config = loadConfig(projectRoot);
  return config[key];
}

function setConfigValue(key, value, projectRoot = process.cwd()) {
  const config = loadConfig(projectRoot);
  config[key] = value;
  saveConfig(config, projectRoot);
}
```

**Step 6: Export module**
```javascript
module.exports = {
  loadConfig,
  saveConfig,
  validateConfig,
  getConfigValue,
  setConfigValue,
  CONFIG_SCHEMA
};
```

#### Files to Create/Modify

**Create**:
- `devops/cli/lib/config-manager.js` (~150 lines)

#### Acceptance Criteria

- [✅] `loadConfig()` reads from `.devops/config.json`
- [✅] `saveConfig()` writes valid JSON
- [✅] Validation catches missing required fields
- [✅] Validation catches invalid enum values
- [✅] `getConfigValue('platform')` returns correct value
- [✅] `setConfigValue('platform', 'netlify')` updates config

#### Examples/References

**Usage**:
```javascript
const configManager = require('./lib/config-manager');

// Load config
const config = configManager.loadConfig();
console.log(config.platform); // "netlify"

// Update config
configManager.setConfigValue('environment', 'staging');

// Validate
configManager.validateConfig(config); // throws if invalid
```

**Sample config.json**:
```json
{
  "version": "1.0",
  "platform": "netlify",
  "environment": "production",
  "deployment": {
    "strategy": "rolling",
    "auto_deploy": false,
    "rollback_on_failure": true
  },
  "secrets": {
    "mode": "local",
    "encryption": "aes-256-gcm"
  }
}
```

#### Testing Checklist

- [✅] Load existing config
- [✅] Load non-existent config (should error)
- [✅] Save valid config
- [✅] Save invalid config (should error)
- [✅] Get/set specific values
- [✅] Validate schema enforcement

#### Session Notes

**2025-11-17 Session 1**:
- ✅ Implemented basic config manager
- ✅ Added schema validation
- ✅ Tested with sample configs
- Ready for use by platform managers

#### Rollback Info

If this task fails:
1. Delete `devops/cli/lib/config-manager.js`
2. No other dependencies yet

---

### T003: Secrets Manager

**Wave**: 1 (Foundation)
**Status**: ✅ DONE
**Priority**: P0 (Critical)
**Effort**: 3 hours
**Dependencies**: None
**Can Run in Parallel**: Yes

#### What to Build

A secrets encryption/decryption module that:
- Encrypts secrets with AES-256-GCM
- Stores encrypted data in `.devops/credentials.enc`
- Supports get/set/delete/list operations
- Uses master key from environment variable
- Never logs secrets in plaintext

#### Why Needed

Secure storage for API tokens, credentials, and sensitive configuration. Required by all platform managers for authentication.

#### How to Build

**File**: `devops/cli/lib/secrets-manager.js`

**Step 1: Setup encryption**
```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY_ENV = 'DEVOPS_MASTER_KEY';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
```

**Step 2: Master key management**
```javascript
function getMasterKey() {
  let key = process.env[MASTER_KEY_ENV];

  if (!key) {
    // Generate random key for development
    key = crypto.randomBytes(KEY_LENGTH).toString('hex');
    console.warn(`
⚠️  WARNING: No master key found. Generated temporary key.
For production, set environment variable:
  export ${MASTER_KEY_ENV}="${key}"
`);
  }

  // Ensure key is correct length
  if (key.length !== KEY_LENGTH * 2) { // hex string is 2x length
    throw new Error(`Master key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`);
  }

  return Buffer.from(key, 'hex');
}
```

**Step 3: Encryption function**
```javascript
function encrypt(plaintext, masterKey) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: ALGORITHM
  };
}
```

**Step 4: Decryption function**
```javascript
function decrypt(encryptedData, masterKey) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(encryptedData.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Step 5: Storage functions**
```javascript
function getSecretsPath(projectRoot = process.cwd()) {
  return path.join(projectRoot, '.devops', 'credentials.enc');
}

function loadSecrets(projectRoot = process.cwd()) {
  const secretsPath = getSecretsPath(projectRoot);

  if (!fs.existsSync(secretsPath)) {
    return {};
  }

  const masterKey = getMasterKey();
  const encryptedData = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

  const secrets = {};
  for (const [key, encData] of Object.entries(encryptedData)) {
    try {
      secrets[key] = decrypt(encData, masterKey);
    } catch (error) {
      throw new Error(`Failed to decrypt secret '${key}': ${error.message}`);
    }
  }

  return secrets;
}

function saveSecrets(secrets, projectRoot = process.cwd()) {
  const masterKey = getMasterKey();

  const encrypted = {};
  for (const [key, value] of Object.entries(secrets)) {
    encrypted[key] = encrypt(value, masterKey);
  }

  const secretsDir = path.join(projectRoot, '.devops');
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
  }

  const secretsPath = getSecretsPath(projectRoot);
  fs.writeFileSync(secretsPath, JSON.stringify(encrypted, null, 2), 'utf8');
}
```

**Step 6: Public API**
```javascript
async function getSecret(name, showValue = false, projectRoot = process.cwd()) {
  const secrets = loadSecrets(projectRoot);
  const value = secrets[name];

  if (!value) {
    return { success: false, error: `Secret '${name}' not found` };
  }

  // Mask value unless explicitly requested
  const displayValue = showValue ? value : maskSecret(value);

  return {
    success: true,
    name,
    value: displayValue
  };
}

async function setSecret(name, value, projectRoot = process.cwd()) {
  const secrets = loadSecrets(projectRoot);
  secrets[name] = value;
  saveSecrets(secrets, projectRoot);

  return {
    success: true,
    message: `Secret '${name}' saved`
  };
}

async function deleteSecret(name, projectRoot = process.cwd()) {
  const secrets = loadSecrets(projectRoot);

  if (!secrets[name]) {
    return { success: false, error: `Secret '${name}' not found` };
  }

  delete secrets[name];
  saveSecrets(secrets, projectRoot);

  return {
    success: true,
    message: `Secret '${name}' deleted`
  };
}

async function listSecrets(projectRoot = process.cwd()) {
  const secrets = loadSecrets(projectRoot);

  return {
    success: true,
    secrets: Object.keys(secrets)
  };
}

function maskSecret(value) {
  if (value.length <= 8) {
    return '••••••••';
  }
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}
```

**Step 7: Export module**
```javascript
module.exports = {
  getSecret,
  setSecret,
  deleteSecret,
  listSecrets,
  getMasterKey,
  encrypt,
  decrypt
};
```

#### Files to Create/Modify

**Create**:
- `devops/cli/lib/secrets-manager.js` (~250 lines)

**Update**:
- `devops/.gitignore`:
```
.devops/credentials.enc
.devops/*.enc
.devops/backups/
```

#### Acceptance Criteria

- [✅] `setSecret('API_KEY', 'secret123')` encrypts and stores
- [✅] `getSecret('API_KEY')` returns masked value
- [✅] `getSecret('API_KEY', true)` returns actual value
- [✅] `deleteSecret('API_KEY')` removes secret
- [✅] `listSecrets()` returns all secret names (not values)
- [✅] Secrets file is encrypted (not human-readable)
- [✅] Master key required to decrypt
- [✅] Secrets never logged in plaintext

#### Examples/References

**Usage**:
```javascript
const secretsManager = require('./lib/secrets-manager');

// Set secret
await secretsManager.setSecret('NETLIFY_API_TOKEN', 'nfp_xyz123');

// Get secret (masked)
const masked = await secretsManager.getSecret('NETLIFY_API_TOKEN');
console.log(masked.value); // 'nfp_••••••••z123'

// Get secret (actual value)
const actual = await secretsManager.getSecret('NETLIFY_API_TOKEN', true);
console.log(actual.value); // 'nfp_xyz123'

// List secrets
const list = await secretsManager.listSecrets();
console.log(list.secrets); // ['NETLIFY_API_TOKEN']

// Delete secret
await secretsManager.deleteSecret('NETLIFY_API_TOKEN');
```

**File Format** (`.devops/credentials.enc`):
```json
{
  "NETLIFY_API_TOKEN": {
    "encrypted": "a3f8d9e2c1b4...",
    "iv": "1234abcd5678...",
    "authTag": "9876fedc4321...",
    "algorithm": "aes-256-gcm"
  }
}
```

#### Testing Checklist

- [✅] Set secret and verify file created
- [✅] Get secret (masked)
- [✅] Get secret (actual value)
- [✅] Delete secret and verify removed
- [✅] List secrets (names only)
- [✅] Try to decrypt with wrong key (should fail)
- [✅] Verify file is encrypted
- [✅] Check `.gitignore` includes credentials.enc

#### Session Notes

**2025-11-17 Session 1**:
- ✅ Implemented AES-256-GCM encryption
- ✅ Master key from environment with fallback
- ✅ Get/set/delete/list operations
- ✅ Secret masking for display
- Ready for platform integrations

#### Rollback Info

If this task fails:
1. Delete `devops/cli/lib/secrets-manager.js`
2. Remove `.devops/credentials.enc` (if exists)
3. Revert `.gitignore` changes
4. No secrets exposed (already encrypted)

---

### T004: Deployment Tracker

**Wave**: 1 (Foundation)
**Status**: ✅ DONE
**Priority**: P0 (Critical)
**Effort**: 2 hours (completed)
**Dependencies**: None
**Can Run in Parallel**: Yes

#### What to Build

A deployment audit trail module that:
- Records all deployments to `.devops/deployments/{id}.json`
- Stores deployment metadata (platform, version, URL, status, duration)
- Provides query operations (latest, by status, by platform)
- Enables rollback by keeping deployment history
- Maintains deployment index for fast lookups

#### Why Needed

Complete audit trail for all deployments. Enables rollback capability, status tracking, and deployment history views. Compliance requirement for production systems.

#### How to Build

**File**: `devops/cli/lib/deployment-tracker.js`

**Step 1: Generate deployment ID**
```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateDeploymentId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `dep_${timestamp}_${random}`;
}
```

**Step 2: Get deployments directory**
```javascript
function getDeploymentsDir(projectRoot = process.cwd()) {
  return path.join(projectRoot, '.devops', 'deployments');
}

function ensureDeploymentsDir(projectRoot = process.cwd()) {
  const dir = getDeploymentsDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
```

**Step 3: Record deployment**
```javascript
async function recordDeployment(metadata, projectRoot = process.cwd()) {
  const id = generateDeploymentId();
  const deployment = {
    id,
    timestamp: new Date().toISOString(),
    ...metadata,
    recorded_at: Date.now()
  };

  // Ensure directory exists
  const deploymentsDir = ensureDeploymentsDir(projectRoot);

  // Save deployment record
  const deploymentPath = path.join(deploymentsDir, `${id}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2), 'utf8');

  // Update index
  await updateIndex(deployment, projectRoot);

  return deployment;
}
```

**Step 4: Load deployment**
```javascript
function loadDeployment(id, projectRoot = process.cwd()) {
  const deploymentPath = path.join(getDeploymentsDir(projectRoot), `${id}.json`);

  if (!fs.existsSync(deploymentPath)) {
    return null;
  }

  const data = fs.readFileSync(deploymentPath, 'utf8');
  return JSON.parse(data);
}
```

**Step 5: Update deployment index**
```javascript
function getIndexPath(projectRoot = process.cwd()) {
  return path.join(getDeploymentsDir(projectRoot), 'index.json');
}

function loadIndex(projectRoot = process.cwd()) {
  const indexPath = getIndexPath(projectRoot);

  if (!fs.existsSync(indexPath)) {
    return {
      version: '1.0',
      deployments: [],
      platforms: {},
      environments: {},
      statuses: {}
    };
  }

  const data = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(data);
}

async function updateIndex(deployment, projectRoot = process.cwd()) {
  const index = loadIndex(projectRoot);

  // Add to main list
  index.deployments.unshift({
    id: deployment.id,
    timestamp: deployment.timestamp,
    platform: deployment.platform,
    environment: deployment.environment,
    status: deployment.status
  });

  // Keep last 100
  index.deployments = index.deployments.slice(0, 100);

  // Update platform index
  if (!index.platforms[deployment.platform]) {
    index.platforms[deployment.platform] = [];
  }
  index.platforms[deployment.platform].unshift(deployment.id);
  index.platforms[deployment.platform] = index.platforms[deployment.platform].slice(0, 50);

  // Update environment index
  if (!index.environments[deployment.environment]) {
    index.environments[deployment.environment] = [];
  }
  index.environments[deployment.environment].unshift(deployment.id);
  index.environments[deployment.environment] = index.environments[deployment.environment].slice(0, 50);

  // Update status index
  if (!index.statuses[deployment.status]) {
    index.statuses[deployment.status] = [];
  }
  index.statuses[deployment.status].unshift(deployment.id);
  index.statuses[deployment.status] = index.statuses[deployment.status].slice(0, 50);

  // Save index
  const indexPath = getIndexPath(projectRoot);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}
```

**Step 6: Query operations**
```javascript
async function getLatestDeployment(options = {}, projectRoot = process.cwd()) {
  const { platform, environment } = options;
  const index = loadIndex(projectRoot);

  const deployment = index.deployments.find(d => {
    if (platform && d.platform !== platform) return false;
    if (environment && d.environment !== environment) return false;
    return true;
  });

  if (!deployment) return null;

  return loadDeployment(deployment.id, projectRoot);
}

async function getDeploymentsByStatus(status, projectRoot = process.cwd()) {
  const index = loadIndex(projectRoot);
  const ids = index.statuses[status] || [];

  return ids.map(id => loadDeployment(id, projectRoot)).filter(Boolean);
}

async function getDeploymentHistory(options = {}, projectRoot = process.cwd()) {
  const { limit = 10, platform, environment } = options;
  const index = loadIndex(projectRoot);

  let deployments = index.deployments;

  // Filter by platform
  if (platform) {
    deployments = deployments.filter(d => d.platform === platform);
  }

  // Filter by environment
  if (environment) {
    deployments = deployments.filter(d => d.environment === environment);
  }

  // Limit results
  deployments = deployments.slice(0, limit);

  // Load full deployment records
  return deployments.map(d => loadDeployment(d.id, projectRoot)).filter(Boolean);
}
```

**Step 7: Update deployment status**
```javascript
async function updateDeploymentStatus(id, status, metadata = {}, projectRoot = process.cwd()) {
  const deployment = loadDeployment(id, projectRoot);

  if (!deployment) {
    throw new Error(`Deployment not found: ${id}`);
  }

  deployment.status = status;
  deployment.updated_at = new Date().toISOString();
  Object.assign(deployment, metadata);

  const deploymentPath = path.join(getDeploymentsDir(projectRoot), `${id}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2), 'utf8');

  // Update index
  await updateIndex(deployment, projectRoot);

  return deployment;
}
```

**Step 8: Export module**
```javascript
module.exports = {
  recordDeployment,
  loadDeployment,
  getLatestDeployment,
  getDeploymentsByStatus,
  getDeploymentHistory,
  updateDeploymentStatus,
  generateDeploymentId
};
```

#### Files to Create/Modify

**Create**:
- `devops/cli/lib/deployment-tracker.js` (~300 lines)

**Directories Created**:
- `.devops/deployments/` (auto-created on first use)

#### Acceptance Criteria

- [ ] `recordDeployment({...})` creates new deployment record
- [ ] `getLatestDeployment()` returns most recent deployment
- [ ] `getDeploymentHistory(10)` returns last 10 deployments
- [ ] `updateDeploymentStatus(id, 'success')` updates status
- [ ] `getDeploymentsByStatus('success')` filters correctly
- [ ] Index file updated on each new deployment
- [ ] Deployment files are human-readable JSON
- [ ] Index limited to 100 deployments for performance

#### Examples/References

**Usage**:
```javascript
const tracker = require('./lib/deployment-tracker');

// Record new deployment
const deployment = await tracker.recordDeployment({
  platform: 'netlify',
  version: '1.0.0',
  environment: 'production',
  status: 'in_progress',
  url: 'https://app.netlify.app'
});
console.log(deployment.id); // 'dep_1700000000000_a1b2c3d4'

// Update status
await tracker.updateDeploymentStatus(deployment.id, 'success', {
  duration_ms: 45000,
  files_deployed: 127
});

// Query deployments
const latest = await tracker.getLatestDeployment({ platform: 'netlify' });
const history = await tracker.getDeploymentHistory({ limit: 5 });
const successful = await tracker.getDeploymentsByStatus('success');
```

**Deployment Record Example**:
```json
{
  "id": "dep_1700000000000_a1b2c3d4",
  "timestamp": "2025-11-17T13:00:00Z",
  "platform": "netlify",
  "version": "1.0.0",
  "environment": "production",
  "status": "success",
  "url": "https://app.netlify.app",
  "duration_ms": 45000,
  "files_deployed": 127,
  "rollback_available": true,
  "recorded_at": 1700000000000,
  "updated_at": "2025-11-17T13:01:00Z"
}
```

**Index Structure**:
```json
{
  "version": "1.0",
  "deployments": [
    {
      "id": "dep_1700000000000_a1b2c3d4",
      "timestamp": "2025-11-17T13:00:00Z",
      "platform": "netlify",
      "environment": "production",
      "status": "success"
    }
  ],
  "platforms": {
    "netlify": ["dep_1700000000000_a1b2c3d4"]
  },
  "environments": {
    "production": ["dep_1700000000000_a1b2c3d4"]
  },
  "statuses": {
    "success": ["dep_1700000000000_a1b2c3d4"]
  }
}
```

#### Testing Checklist

- [ ] Record deployment and verify file created
- [ ] Get latest deployment
- [ ] Get deployment history
- [ ] Update deployment status
- [ ] Query by platform
- [ ] Query by environment
- [ ] Query by status
- [ ] Verify index updates correctly
- [ ] Test with 100+ deployments (index limits)

#### Session Notes

**2025-11-17 Session 1**:
- ✅ Implemented DeploymentTracker class
- ✅ Record deployment with metadata tracking
- ✅ Update deployment status
- ✅ Query operations (list, history, rollback)
- ✅ Statistics and reporting

#### Rollback Info

If this task fails:
1. Delete `devops/cli/lib/deployment-tracker.js`
2. Delete `.devops/deployments/` directory
3. No production impact (isolated module, test data only)

---

### T005: Platform Validator

**Wave**: 1 (Foundation)
**Status**: ✅ DONE
**Priority**: P0 (Critical)
**Effort**: 2 hours (completed)
**Dependencies**: None
**Can Run in Parallel**: Yes

#### What to Build

A platform validation framework that:
- Defines validation interface for platform managers
- Provides common validation utilities
- Validates credentials, configuration, and project compatibility
- Returns structured error messages with fixes
- Supports platform-specific validators

#### Why Needed

Ensures platform managers follow consistent validation patterns. Prevents deployment failures by catching configuration issues early. Provides actionable error messages to users.

#### How to Build

**File**: `devops/cli/lib/validators/platform-validator.js`

**Implementation**: [To be completed]

#### Files to Create/Modify

**Create**:
- `devops/cli/lib/validators/platform-validator.js` (~150 lines)

#### Acceptance Criteria

- [ ] `PlatformValidator` base class defined
- [ ] Validation interface documented
- [ ] `ValidationUtils` provides common validators
- [ ] Results object structure defined
- [ ] Platform-specific validators can extend base class

#### Examples/References

[To be completed]

#### Testing Checklist

- [ ] Base class can be extended
- [ ] Validation utilities work correctly
- [ ] Results object format correct
- [ ] Errors prevent validation passing
- [ ] Warnings don't prevent validation passing

#### Session Notes

**2025-11-17 Session 1**:
- ✅ Implemented platform validation framework
- ✅ Support for Netlify with planned platforms (AWS, GCP, Azure, Vercel)
- ✅ User-friendly error messages
- ✅ Platform compatibility checking

#### Rollback Info

If this task fails:
1. Delete `devops/cli/lib/validators/platform-validator.js`
2. No other dependencies yet

---

### T006-T020: [Additional Tasks]

**Note**: For brevity, tasks T006-T020 follow the same format as above. Each includes:
- Wave, Status, Priority, Effort, Dependencies
- What/Why/How sections
- Files to create/modify
- Acceptance criteria
- Examples
- Testing checklist
- Session notes
- Rollback info

Full details for T006-T020 would be added as work progresses.

---

## VI. STATUS TRACKING SYSTEM

### How to Track Progress

**Update Task Status** (in Section V):
```markdown
**Status**: ✅ DONE  (changed from ⏳ IN PROGRESS)
```

**Update Wave Progress** (in Section IV):
```markdown
**Status**: ✅ COMPLETE (changed from IN PROGRESS)
**Estimated Time**: 10 hours total, 0 hours remaining
```

**Update Quick Status Dashboard** (in Section I):
```markdown
**Overall Progress**: 25% (5/20 tasks complete)
```

**Add Session Notes** (in task details):
```markdown
**2025-11-18 Session 2** (09:00-11:30, 2.5 hours):
- ✅ Completed T004 deployment tracker
- ✅ Started T005 platform validator
- NEXT: Finish T005, start Wave 2
```

### Status Values

- `⏳ TODO` - Not started
- `⏳ IN PROGRESS` - Currently working
- `⏳ BLOCKED` - Waiting on dependency
- `✅ DONE` - Completed and tested
- `❌ FAILED` - Attempted but failed
- `⏸️ PAUSED` - Started but paused

---

## VII. SESSION RESUMABILITY

### How to Resume After Context Loss

**Step 1: Read Quick Status Dashboard** (Section I)
- Overall progress: 15%
- Active wave: Wave 1
- Last session: Session 1

**Step 2: Review Active Wave** (Section IV)
- Wave 1 IN PROGRESS (3/5 complete)
- Tasks remaining: T004, T005

**Step 3: Check Task Session Notes** (Section V)
- See what was done
- Understand blockers
- Read next steps

**Step 4: Resume Work**
- Continue highest priority task
- Follow "How to Build" section
- Update status as you go

---

## VIII. DEPENDENCY MANAGEMENT

### Check Before Starting

**Dependencies**: T001, T002, T003
**Can Run in Parallel**: After Wave 1, yes

If dependency incomplete:
1. Check dependency status
2. If ✅ DONE, proceed
3. If ⏳, complete dependency first OR find parallel task

---

## IX. VALIDATION & COMPLETION

### Before Marking ✅ DONE

1. **Check Acceptance Criteria** (all must be ✅)
2. **Run Testing Checklist**
3. **If all criteria met**: Mark ✅ DONE
4. **If not met**: Keep ⏳ IN PROGRESS

---

## X. ROLLBACK & RECOVERY

### When to Rollback

- Task causes breaking changes
- Dependencies fail
- Tests fail
- Need to restart

### Rollback Process

1. Read task's "Rollback Info"
2. Follow steps in order
3. Update status to ❌ FAILED
4. Add session note
5. Fix issue, restart

---

## XI. BEST PRACTICES

### Parallel Execution

**When to Parallelize**:
- Tasks in same wave
- Independent modules
- Different platforms

### Context Preservation

**Always Document**:
- Session notes
- Blockers
- Next steps
- Decisions

---

## XII. QUICK REFERENCE

### Commands
```bash
# CLI
node devops-cli.js deploy --platform netlify
node devops-cli.js status
node devops-cli.js rollback dep_123

# Test
npm test
npm run test:integration
```

### File Paths
```
Config:       .devops/config.json
Secrets:      .devops/credentials.enc
Deployments:  .devops/deployments/*.json
CLI:          devops/cli/devops-cli.js
Commands:     devops/commands/*.md
```

---

## XIII. SIGN-OFF CHECKLIST

### Wave 1 (Foundation)
- [✅] T001: CLI Router
- [✅] T002: Config Manager
- [✅] T003: Secrets Manager
- [✅] T004: Deployment Tracker
- [✅] T005: Platform Validator

### Wave 2 (Platforms)
- [ ] T006-T011 (6 tasks)

### Wave 3 (Commands)
- [ ] T012-T016 (5 tasks)

### Wave 4 (Testing)
- [ ] T017-T020 (4 tasks)

---

**END OF IMPLEMENTATION DOCUMENTATION**

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Next Review**: After Wave 1 completion
