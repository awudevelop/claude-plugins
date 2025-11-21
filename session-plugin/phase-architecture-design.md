# Phase-Based File Architecture: Complete Design

## 1. File Structure

```
plans/implementation/{plan-name}/
├── orchestration.json          # Lightweight coordination metadata
├── phases/
│   ├── phase-1-setup.json     # Independent phase: Environment setup
│   ├── phase-2-backend.json   # Independent phase: Backend implementation
│   ├── phase-3-frontend.json  # Independent phase: Frontend implementation
│   └── phase-4-testing.json   # Independent phase: Testing & validation
├── execution-state.json        # Current execution state
└── logs/
    ├── phase-1.log            # Phase-specific execution logs
    ├── phase-2.log
    └── phase-3.log
```

## 2. Orchestration.json Schema & Example

### Schema
```typescript
interface Orchestration {
  metadata: {
    planId: string;
    name: string;
    description: string;
    created: string;
    modified: string;
    version: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
  };

  phases: Array<{
    id: string;
    name: string;
    file: string;
    type: 'sequential' | 'parallel';
    dependencies: string[];  // Phase IDs this phase depends on
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
    estimatedTokens: number;
    estimatedDuration: string;
  }>;

  execution: {
    strategy: 'sequential' | 'parallel' | 'adaptive';
    maxParallelPhases: number;
    tokenBudget: {
      total: number;
      perPhase: number;
      warningThreshold: number;
    };
    retryPolicy: {
      maxAttempts: number;
      backoffMs: number;
    };
  };

  progress: {
    completedPhases: number;
    totalPhases: number;
    currentPhases: string[];  // Currently executing phase IDs
    lastUpdated: string;
    tokenUsage: {
      used: number;
      remaining: number;
    };
  };
}
```

### Complete Example
```json
{
  "metadata": {
    "planId": "oauth-impl-2024-11-20",
    "name": "OAuth 2.0 Implementation",
    "description": "Complete OAuth 2.0 integration with Google and GitHub providers",
    "created": "2024-11-20T10:00:00Z",
    "modified": "2024-11-20T14:30:00Z",
    "version": "1.0.0",
    "status": "in-progress"
  },

  "phases": [
    {
      "id": "phase-1-setup",
      "name": "Environment Setup",
      "file": "phases/phase-1-setup.json",
      "type": "sequential",
      "dependencies": [],
      "status": "completed",
      "estimatedTokens": 2000,
      "estimatedDuration": "10m"
    },
    {
      "id": "phase-2-backend",
      "name": "Backend OAuth Implementation",
      "file": "phases/phase-2-backend.json",
      "type": "parallel",
      "dependencies": ["phase-1-setup"],
      "status": "in-progress",
      "estimatedTokens": 5000,
      "estimatedDuration": "30m"
    },
    {
      "id": "phase-3-frontend",
      "name": "Frontend OAuth UI",
      "file": "phases/phase-3-frontend.json",
      "type": "parallel",
      "dependencies": ["phase-1-setup"],
      "status": "in-progress",
      "estimatedTokens": 4000,
      "estimatedDuration": "25m"
    },
    {
      "id": "phase-4-testing",
      "name": "Integration Testing",
      "file": "phases/phase-4-testing.json",
      "type": "sequential",
      "dependencies": ["phase-2-backend", "phase-3-frontend"],
      "status": "pending",
      "estimatedTokens": 3000,
      "estimatedDuration": "20m"
    }
  ],

  "execution": {
    "strategy": "adaptive",
    "maxParallelPhases": 3,
    "tokenBudget": {
      "total": 15000,
      "perPhase": 6000,
      "warningThreshold": 12000
    },
    "retryPolicy": {
      "maxAttempts": 3,
      "backoffMs": 5000
    }
  },

  "progress": {
    "completedPhases": 1,
    "totalPhases": 4,
    "currentPhases": ["phase-2-backend", "phase-3-frontend"],
    "lastUpdated": "2024-11-20T14:30:00Z",
    "tokenUsage": {
      "used": 4500,
      "remaining": 10500
    }
  }
}
```

## 3. Phase File Schema & Example

### Schema
```typescript
interface PhaseFile {
  phase: {
    id: string;
    name: string;
    description: string;
    type: 'setup' | 'implementation' | 'testing' | 'deployment';
    priority: 'critical' | 'high' | 'medium' | 'low';
  };

  configuration: {
    agent: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
    tools: string[];  // Required tools/capabilities
    environment: Record<string, string>;  // Environment variables
    workingDirectory: string;
  };

  tasks: Array<{
    id: string;
    name: string;
    description: string;
    type: 'code' | 'config' | 'test' | 'documentation';
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    dependencies: string[];  // Task IDs within this phase
    estimatedTokens: number;

    actions: Array<{
      type: 'create' | 'modify' | 'delete' | 'execute' | 'verify';
      target: string;  // File path or command
      content?: string;  // For create/modify actions
      validation?: {
        type: 'test' | 'lint' | 'compile';
        command: string;
        expectedOutput?: string;
      };
    }>;

    output?: {
      files: string[];
      logs: string[];
      artifacts: Record<string, any>;
    };
  }>;

  metrics: {
    estimatedDuration: string;
    estimatedTokens: number;
    actualTokens?: number;
    startTime?: string;
    endTime?: string;
    successRate?: number;
  };
}
```

### Complete Example - phase-2-backend.json
```json
{
  "phase": {
    "id": "phase-2-backend",
    "name": "Backend OAuth Implementation",
    "description": "Implement OAuth 2.0 server-side flow with Google and GitHub providers",
    "type": "implementation",
    "priority": "critical"
  },

  "configuration": {
    "agent": {
      "model": "claude-3-sonnet",
      "temperature": 0.3,
      "maxTokens": 4000
    },
    "tools": ["file-editor", "terminal", "web-search"],
    "environment": {
      "NODE_ENV": "development",
      "PORT": "3000"
    },
    "workingDirectory": "/src/backend"
  },

  "tasks": [
    {
      "id": "task-2.1",
      "name": "Create OAuth Strategy Base",
      "description": "Implement abstract OAuth strategy pattern",
      "type": "code",
      "status": "completed",
      "dependencies": [],
      "estimatedTokens": 800,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/auth/strategies/OAuthStrategy.js",
          "content": "// Base OAuth strategy class implementation"
        },
        {
          "type": "verify",
          "target": "/src/backend/auth/strategies/OAuthStrategy.js",
          "validation": {
            "type": "lint",
            "command": "eslint /src/backend/auth/strategies/OAuthStrategy.js"
          }
        }
      ],

      "output": {
        "files": ["/src/backend/auth/strategies/OAuthStrategy.js"],
        "logs": ["Created base OAuth strategy class"],
        "artifacts": {
          "classStructure": {
            "methods": ["authorize", "callback", "refreshToken"],
            "properties": ["clientId", "clientSecret", "redirectUri"]
          }
        }
      }
    },

    {
      "id": "task-2.2",
      "name": "Implement Google OAuth",
      "description": "Create Google-specific OAuth implementation",
      "type": "code",
      "status": "in-progress",
      "dependencies": ["task-2.1"],
      "estimatedTokens": 1200,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/auth/strategies/GoogleOAuth.js",
          "content": "// Google OAuth implementation"
        },
        {
          "type": "create",
          "target": "/src/backend/auth/config/google.config.js",
          "content": "// Google OAuth configuration"
        },
        {
          "type": "execute",
          "target": "npm install googleapis",
          "validation": {
            "type": "test",
            "command": "npm list googleapis"
          }
        }
      ]
    },

    {
      "id": "task-2.3",
      "name": "Implement GitHub OAuth",
      "description": "Create GitHub-specific OAuth implementation",
      "type": "code",
      "status": "pending",
      "dependencies": ["task-2.1"],
      "estimatedTokens": 1000,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/auth/strategies/GitHubOAuth.js",
          "content": "// GitHub OAuth implementation"
        }
      ]
    },

    {
      "id": "task-2.4",
      "name": "Create Auth Router",
      "description": "Set up Express routes for OAuth endpoints",
      "type": "code",
      "status": "pending",
      "dependencies": ["task-2.2", "task-2.3"],
      "estimatedTokens": 600,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/routes/auth.routes.js",
          "content": "// OAuth routes implementation"
        }
      ]
    },

    {
      "id": "task-2.5",
      "name": "Add Token Management",
      "description": "Implement JWT token generation and validation",
      "type": "code",
      "status": "pending",
      "dependencies": ["task-2.4"],
      "estimatedTokens": 800,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/auth/tokenManager.js",
          "content": "// JWT token management"
        },
        {
          "type": "execute",
          "target": "npm install jsonwebtoken",
          "validation": {
            "type": "test",
            "command": "npm list jsonwebtoken"
          }
        }
      ]
    },

    {
      "id": "task-2.6",
      "name": "Create Unit Tests",
      "description": "Write comprehensive unit tests for OAuth implementation",
      "type": "test",
      "status": "pending",
      "dependencies": ["task-2.5"],
      "estimatedTokens": 600,

      "actions": [
        {
          "type": "create",
          "target": "/src/backend/auth/__tests__/oauth.test.js",
          "content": "// OAuth unit tests"
        },
        {
          "type": "execute",
          "target": "npm test -- auth/__tests__/oauth.test.js",
          "validation": {
            "type": "test",
            "command": "npm test",
            "expectedOutput": "All tests passed"
          }
        }
      ]
    }
  ],

  "metrics": {
    "estimatedDuration": "30m",
    "estimatedTokens": 5000,
    "actualTokens": 2100,
    "startTime": "2024-11-20T14:00:00Z",
    "successRate": 100
  }
}
```

## 4. Token Efficiency Analysis

### Before (Single File Approach)
```javascript
// Single monolithic plan file
const tokenCalculation = {
  structure: {
    metadata: 500,          // Plan metadata
    phases: 5,              // 5 phases
    tasksPerPhase: 10,      // 10 tasks per phase
    tokensPerTask: 200,     // Details for each task
    contextOverhead: 1000   // JSON structure, formatting
  },

  calculation: {
    taskTokens: 5 * 10 * 200,  // 10,000 tokens
    metadata: 500,
    overhead: 1000,
    total: 11500  // TOTAL TOKENS PER LOAD
  },

  usage: {
    loadForPhase1: 11500,  // Load entire file
    loadForPhase2: 11500,  // Load entire file again
    loadForPhase3: 11500,  // Load entire file again
    loadForPhase4: 11500,  // Load entire file again
    loadForPhase5: 11500,  // Load entire file again
    totalTokensUsed: 57500 // 5 phases × 11,500
  }
};
```

### After (Phase Files Approach)
```javascript
const optimizedTokenCalculation = {
  orchestration: {
    metadata: 200,
    phaseRegistry: 100,
    executionConfig: 100,
    progressSummary: 100,
    total: 500  // Lightweight orchestration file
  },

  perPhaseFile: {
    phaseMetadata: 100,
    tasks: 10 * 200,  // 2000 tokens
    configuration: 100,
    total: 2200  // Per phase file
  },

  usage: {
    initial: 500,           // Load orchestration once
    phase1: 500 + 2200,    // Orchestration + Phase 1
    phase2: 500 + 2200,    // Orchestration + Phase 2
    phase3: 500 + 2200,    // Orchestration + Phase 3
    phase4: 500 + 2200,    // Orchestration + Phase 4
    phase5: 500 + 2200,    // Orchestration + Phase 5
    totalTokensUsed: 13500 // 500 + (5 × 2200) + overhead
  },

  savings: {
    absolute: 57500 - 13500,  // 44,000 tokens saved
    percentage: 76.5,          // 76.5% reduction
    perPhaseReduction: 8800    // Per phase: 11,500 → 2,700
  }
};
```

### Parallel Execution Token Benefits
```javascript
const parallelBenefits = {
  sequential: {
    phase2: 2200,  // Load phase 2
    waitForCompletion: true,
    phase3: 2200,  // Load phase 3 AFTER phase 2
    totalTime: "55m",
    totalTokens: 4400
  },

  parallel: {
    phase2and3: 2200 + 2200,  // Load both simultaneously
    simultaneousExecution: true,
    totalTime: "30m",  // Max of (30m, 25m)
    totalTokens: 4400,  // Same tokens
    timeSaved: "25m"   // 45% faster
  }
};
```

## 5. Orchestrator Implementation

```javascript
class PhaseBasedOrchestrator {
  constructor(planPath) {
    this.planPath = planPath;
    this.orchestration = null;
    this.executionState = null;
    this.activePhases = new Map();
    this.phaseCache = new Map();
  }

  /**
   * Main execution entry point
   */
  async execute(planName) {
    try {
      // 1. Load orchestration metadata (lightweight)
      this.orchestration = await this.loadOrchestration(planName);

      // 2. Load or create execution state
      this.executionState = await this.loadExecutionState(planName);

      // 3. Main execution loop
      while (!this.isComplete()) {
        // Get next executable phases
        const executablePhases = this.getExecutablePhases();

        if (executablePhases.length === 0) {
          if (this.hasActivePhases()) {
            // Wait for active phases to complete
            await this.waitForActivePhases();
          } else {
            // No phases can run - check for deadlock
            throw new Error('No executable phases - possible dependency deadlock');
          }
          continue;
        }

        // Execute phases (in parallel if possible)
        await this.executePhases(executablePhases);
      }

      return {
        success: true,
        completedPhases: this.orchestration.phases.length,
        tokenUsage: this.executionState.tokenUsage
      };

    } catch (error) {
      console.error('Orchestration failed:', error);
      await this.saveExecutionState();
      throw error;
    }
  }

  /**
   * Load only the lightweight orchestration file
   */
  async loadOrchestration(planName) {
    const orchestrationPath = `${this.planPath}/${planName}/orchestration.json`;
    const data = await fs.readFile(orchestrationPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Load a specific phase file only when needed
   */
  async loadPhase(phaseId) {
    // Check cache first
    if (this.phaseCache.has(phaseId)) {
      console.log(`Using cached phase: ${phaseId}`);
      return this.phaseCache.get(phaseId);
    }

    // Find phase metadata
    const phaseMeta = this.orchestration.phases.find(p => p.id === phaseId);
    if (!phaseMeta) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    // Load phase file
    const phasePath = `${this.planPath}/${this.orchestration.metadata.planId}/${phaseMeta.file}`;
    console.log(`Loading phase file: ${phasePath}`);

    const startTokens = this.getTokenCount();
    const data = await fs.readFile(phasePath, 'utf8');
    const phase = JSON.parse(data);

    // Track token usage
    const tokensUsed = this.getTokenCount() - startTokens;
    console.log(`Phase ${phaseId} loaded: ${tokensUsed} tokens`);

    // Cache for potential reuse
    this.phaseCache.set(phaseId, phase);

    return phase;
  }

  /**
   * Determine which phases can be executed
   */
  getExecutablePhases() {
    const executable = [];

    for (const phase of this.orchestration.phases) {
      if (this.canExecutePhase(phase)) {
        executable.push(phase);
      }
    }

    // Apply parallel execution limits
    const maxParallel = this.orchestration.execution.maxParallelPhases;
    const currentActive = this.activePhases.size;
    const slotsAvailable = maxParallel - currentActive;

    return executable.slice(0, slotsAvailable);
  }

  /**
   * Check if a phase can be executed
   */
  canExecutePhase(phase) {
    // Already completed or running
    if (phase.status !== 'pending') {
      return false;
    }

    // Check if already active
    if (this.activePhases.has(phase.id)) {
      return false;
    }

    // Check dependencies
    for (const depId of phase.dependencies) {
      const dep = this.orchestration.phases.find(p => p.id === depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }

    // Check token budget
    const tokensRemaining = this.orchestration.execution.tokenBudget.total -
                           this.executionState.tokenUsage.used;
    if (phase.estimatedTokens > tokensRemaining) {
      console.warn(`Phase ${phase.id} would exceed token budget`);
      return false;
    }

    return true;
  }

  /**
   * Check if two phases can run in parallel
   */
  async canRunInParallel(phase1, phase2) {
    // Check dependency conflicts
    if (phase1.dependencies.includes(phase2.id) ||
        phase2.dependencies.includes(phase1.id)) {
      return false;
    }

    // Check resource conflicts (files they modify)
    const phase1Data = await this.loadPhase(phase1.id);
    const phase2Data = await this.loadPhase(phase2.id);

    const phase1Files = this.getPhaseFiles(phase1Data);
    const phase2Files = this.getPhaseFiles(phase2Data);

    // Check for file conflicts
    const intersection = phase1Files.filter(f => phase2Files.includes(f));
    if (intersection.length > 0) {
      console.log(`Phases ${phase1.id} and ${phase2.id} have file conflicts:`, intersection);
      return false;
    }

    // Check combined token usage
    const combinedTokens = phase1.estimatedTokens + phase2.estimatedTokens;
    const perPhaseLimit = this.orchestration.execution.tokenBudget.perPhase;
    if (combinedTokens > perPhaseLimit * 1.5) {
      console.log(`Combined token usage too high for parallel execution`);
      return false;
    }

    return true;
  }

  /**
   * Execute phases (potentially in parallel)
   */
  async executePhases(phases) {
    const executionPromises = [];

    for (const phase of phases) {
      // Mark as active
      this.activePhases.set(phase.id, {
        startTime: new Date().toISOString(),
        promise: null
      });

      // Update phase status
      phase.status = 'in-progress';
      this.orchestration.progress.currentPhases.push(phase.id);

      // Create execution promise
      const promise = this.executePhase(phase);
      this.activePhases.get(phase.id).promise = promise;
      executionPromises.push(promise);

      console.log(`Started phase: ${phase.id} (${phase.name})`);
    }

    // Wait for all phases to complete
    const results = await Promise.allSettled(executionPromises);

    // Process results
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        phase.status = 'completed';
        this.orchestration.progress.completedPhases++;
        console.log(`Phase completed: ${phase.id}`);
      } else {
        phase.status = 'failed';
        console.error(`Phase failed: ${phase.id}`, result.reason);

        // Handle retry logic
        if (this.shouldRetry(phase)) {
          phase.status = 'pending';
          phase.retryCount = (phase.retryCount || 0) + 1;
        }
      }

      // Remove from active phases
      this.activePhases.delete(phase.id);
      const index = this.orchestration.progress.currentPhases.indexOf(phase.id);
      if (index > -1) {
        this.orchestration.progress.currentPhases.splice(index, 1);
      }
    }

    // Save state after phase completion
    await this.saveExecutionState();
  }

  /**
   * Execute a single phase
   */
  async executePhase(phaseMeta) {
    const phaseData = await this.loadPhase(phaseMeta.id);
    const agent = new PhaseAgent(phaseData.configuration);

    try {
      // Execute tasks in order
      for (const task of phaseData.tasks) {
        if (task.status === 'completed') {
          continue;
        }

        // Check task dependencies
        const depsComplete = task.dependencies.every(depId => {
          const depTask = phaseData.tasks.find(t => t.id === depId);
          return depTask && depTask.status === 'completed';
        });

        if (!depsComplete) {
          console.log(`Skipping task ${task.id} - dependencies not met`);
          continue;
        }

        // Execute task
        console.log(`Executing task: ${task.id} - ${task.name}`);
        task.status = 'in-progress';

        const result = await agent.executeTask(task);

        if (result.success) {
          task.status = 'completed';
          task.output = result.output;
        } else {
          task.status = 'failed';
          throw new Error(`Task failed: ${task.id} - ${result.error}`);
        }

        // Update token usage
        this.executionState.tokenUsage.used += result.tokensUsed || 0;
      }

      // Phase completed successfully
      phaseData.metrics.endTime = new Date().toISOString();
      phaseData.metrics.actualTokens = this.executionState.tokenUsage.used;

      // Save phase results
      await this.savePhase(phaseMeta.id, phaseData);

      return { success: true, phase: phaseMeta.id };

    } catch (error) {
      console.error(`Phase execution failed: ${phaseMeta.id}`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  isComplete() {
    return this.orchestration.phases.every(p =>
      p.status === 'completed' || p.status === 'skipped'
    );
  }

  hasActivePhases() {
    return this.activePhases.size > 0;
  }

  async waitForActivePhases() {
    const promises = Array.from(this.activePhases.values()).map(p => p.promise);
    await Promise.race(promises);
  }

  getPhaseFiles(phaseData) {
    const files = new Set();
    for (const task of phaseData.tasks) {
      for (const action of task.actions) {
        if (action.target && action.target.startsWith('/')) {
          files.add(action.target);
        }
      }
    }
    return Array.from(files);
  }

  shouldRetry(phase) {
    const retryCount = phase.retryCount || 0;
    const maxRetries = this.orchestration.execution.retryPolicy.maxAttempts;
    return retryCount < maxRetries;
  }

  getTokenCount() {
    // Simulated token counting - in reality, use tokenizer
    return this.executionState?.tokenUsage?.used || 0;
  }

  async loadExecutionState(planName) {
    const statePath = `${this.planPath}/${planName}/execution-state.json`;
    try {
      const data = await fs.readFile(statePath, 'utf8');
      return JSON.parse(data);
    } catch {
      // Create new state if doesn't exist
      return {
        planId: planName,
        startTime: new Date().toISOString(),
        tokenUsage: { used: 0, remaining: this.orchestration.execution.tokenBudget.total },
        phaseStates: {}
      };
    }
  }

  async saveExecutionState() {
    const statePath = `${this.planPath}/${this.orchestration.metadata.planId}/execution-state.json`;
    await fs.writeFile(statePath, JSON.stringify(this.executionState, null, 2));
  }

  async savePhase(phaseId, phaseData) {
    const phaseMeta = this.orchestration.phases.find(p => p.id === phaseId);
    const phasePath = `${this.planPath}/${this.orchestration.metadata.planId}/${phaseMeta.file}`;
    await fs.writeFile(phasePath, JSON.stringify(phaseData, null, 2));
  }
}

/**
 * Phase Agent - Executes individual tasks within a phase
 */
class PhaseAgent {
  constructor(configuration) {
    this.config = configuration;
    this.model = configuration.agent.model;
    this.tools = configuration.tools;
  }

  async executeTask(task) {
    try {
      const results = {
        success: true,
        output: {
          files: [],
          logs: [],
          artifacts: {}
        },
        tokensUsed: 0
      };

      for (const action of task.actions) {
        const actionResult = await this.executeAction(action);

        if (!actionResult.success) {
          return { success: false, error: actionResult.error };
        }

        // Collect outputs
        if (actionResult.file) {
          results.output.files.push(actionResult.file);
        }
        if (actionResult.log) {
          results.output.logs.push(actionResult.log);
        }

        results.tokensUsed += actionResult.tokensUsed || 0;
      }

      return results;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeAction(action) {
    switch (action.type) {
      case 'create':
        return await this.createFile(action.target, action.content);

      case 'modify':
        return await this.modifyFile(action.target, action.content);

      case 'execute':
        return await this.executeCommand(action.target);

      case 'verify':
        return await this.verifyAction(action.validation);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async createFile(path, content) {
    // Simulate file creation
    console.log(`Creating file: ${path}`);
    return {
      success: true,
      file: path,
      log: `Created ${path}`,
      tokensUsed: Math.ceil(content.length / 4)
    };
  }

  async modifyFile(path, content) {
    // Simulate file modification
    console.log(`Modifying file: ${path}`);
    return {
      success: true,
      file: path,
      log: `Modified ${path}`,
      tokensUsed: Math.ceil(content.length / 4)
    };
  }

  async executeCommand(command) {
    // Simulate command execution
    console.log(`Executing: ${command}`);
    return {
      success: true,
      log: `Executed: ${command}`,
      tokensUsed: 50
    };
  }

  async verifyAction(validation) {
    // Simulate validation
    console.log(`Running validation: ${validation.type}`);
    return {
      success: true,
      log: `Validation passed: ${validation.type}`,
      tokensUsed: 100
    };
  }
}

// For Node.js CommonJS compatibility
const fs = require('fs').promises;

module.exports = { PhaseBasedOrchestrator, PhaseAgent };
```

## 6. Parallel Execution Design

### Dependency Analysis Algorithm
```javascript
class DependencyAnalyzer {
  constructor(phases) {
    this.phases = phases;
    this.dependencyGraph = this.buildDependencyGraph();
  }

  /**
   * Build a dependency graph for all phases
   */
  buildDependencyGraph() {
    const graph = new Map();

    for (const phase of this.phases) {
      graph.set(phase.id, {
        phase,
        dependencies: new Set(phase.dependencies),
        dependents: new Set(),
        level: -1
      });
    }

    // Build reverse dependencies (dependents)
    for (const phase of this.phases) {
      for (const dep of phase.dependencies) {
        if (graph.has(dep)) {
          graph.get(dep).dependents.add(phase.id);
        }
      }
    }

    // Calculate execution levels
    this.calculateLevels(graph);

    return graph;
  }

  /**
   * Calculate execution levels (phases at same level can run in parallel)
   */
  calculateLevels(graph) {
    const visited = new Set();
    const queue = [];

    // Find phases with no dependencies (level 0)
    for (const [id, node] of graph) {
      if (node.dependencies.size === 0) {
        node.level = 0;
        queue.push(id);
      }
    }

    // BFS to assign levels
    while (queue.length > 0) {
      const currentId = queue.shift();
      const current = graph.get(currentId);
      visited.add(currentId);

      // Process dependents
      for (const dependentId of current.dependents) {
        const dependent = graph.get(dependentId);

        // Check if all dependencies have been visited
        const allDepsVisited = Array.from(dependent.dependencies)
          .every(dep => visited.has(dep));

        if (allDepsVisited) {
          // Calculate level as max of dependencies + 1
          let maxDepLevel = -1;
          for (const depId of dependent.dependencies) {
            const depLevel = graph.get(depId).level;
            maxDepLevel = Math.max(maxDepLevel, depLevel);
          }
          dependent.level = maxDepLevel + 1;

          if (!queue.includes(dependentId)) {
            queue.push(dependentId);
          }
        }
      }
    }
  }

  /**
   * Get phases that can execute in parallel
   */
  getParallelGroups() {
    const groups = new Map();

    for (const [id, node] of this.dependencyGraph) {
      const level = node.level;
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level).push(node.phase);
    }

    return groups;
  }

  /**
   * Check if specific phases can run in parallel
   */
  canRunInParallel(phaseIds) {
    const phases = phaseIds.map(id => this.dependencyGraph.get(id));

    // Check if all phases are at the same level
    const levels = new Set(phases.map(p => p.level));
    if (levels.size > 1) {
      return false;
    }

    // Check for cross-dependencies
    for (let i = 0; i < phaseIds.length; i++) {
      for (let j = i + 1; j < phaseIds.length; j++) {
        const phase1 = this.dependencyGraph.get(phaseIds[i]);
        const phase2 = this.dependencyGraph.get(phaseIds[j]);

        // Check if either depends on the other
        if (phase1.dependencies.has(phaseIds[j]) ||
            phase2.dependencies.has(phaseIds[i])) {
          return false;
        }

        // Check for common dependents that might cause conflicts
        const commonDependents = new Set(
          [...phase1.dependents].filter(x => phase2.dependents.has(x))
        );

        if (commonDependents.size > 0) {
          console.warn('Phases share common dependents:', commonDependents);
        }
      }
    }

    return true;
  }
}

/**
 * Parallel Execution Coordinator
 */
class ParallelCoordinator {
  constructor(orchestrator, maxParallel = 3) {
    this.orchestrator = orchestrator;
    this.maxParallel = maxParallel;
    this.runningPhases = new Map();
    this.phaseQueues = new Map();
  }

  /**
   * Coordinate parallel execution of phases
   */
  async executeInParallel(phases) {
    const analyzer = new DependencyAnalyzer(phases);
    const parallelGroups = analyzer.getParallelGroups();

    console.log('Execution plan:');
    for (const [level, group] of parallelGroups) {
      console.log(`  Level ${level}:`, group.map(p => p.id).join(', '));
    }

    // Execute each level sequentially, but phases within level in parallel
    for (const [level, group] of parallelGroups) {
      console.log(`\nExecuting Level ${level} with ${group.length} phases`);

      // Split into batches based on maxParallel
      const batches = this.createBatches(group, this.maxParallel);

      for (const batch of batches) {
        await this.executeBatch(batch);
      }
    }
  }

  /**
   * Create batches of phases to run in parallel
   */
  createBatches(phases, batchSize) {
    const batches = [];
    for (let i = 0; i < phases.length; i += batchSize) {
      batches.push(phases.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Execute a batch of phases in parallel
   */
  async executeBatch(batch) {
    const startTime = Date.now();
    console.log(`Starting batch execution: ${batch.map(p => p.id).join(', ')}`);

    const promises = batch.map(phase => this.executePhaseWithMonitoring(phase));

    try {
      const results = await Promise.allSettled(promises);

      // Process results
      for (let i = 0; i < batch.length; i++) {
        const phase = batch[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          console.log(`✓ Phase ${phase.id} completed successfully`);
        } else {
          console.error(`✗ Phase ${phase.id} failed:`, result.reason);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Batch completed in ${duration}ms`);

    } catch (error) {
      console.error('Batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute phase with resource monitoring
   */
  async executePhaseWithMonitoring(phase) {
    const monitoring = {
      phaseId: phase.id,
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      tokenUsage: 0
    };

    this.runningPhases.set(phase.id, monitoring);

    try {
      // Execute the phase
      const result = await this.orchestrator.executePhase(phase);

      // Update monitoring
      monitoring.endTime = Date.now();
      monitoring.duration = monitoring.endTime - monitoring.startTime;
      monitoring.endMemory = process.memoryUsage();
      monitoring.memoryDelta = monitoring.endMemory.heapUsed - monitoring.startMemory.heapUsed;

      console.log(`Phase ${phase.id} metrics:`, {
        duration: `${monitoring.duration}ms`,
        memoryUsed: `${Math.round(monitoring.memoryDelta / 1024 / 1024)}MB`,
        tokensUsed: monitoring.tokenUsage
      });

      return result;

    } finally {
      this.runningPhases.delete(phase.id);
    }
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage() {
    const usage = {
      runningPhases: Array.from(this.runningPhases.keys()),
      totalMemory: 0,
      totalTokens: 0
    };

    for (const [id, monitoring] of this.runningPhases) {
      usage.totalTokens += monitoring.tokenUsage;
    }

    usage.totalMemory = process.memoryUsage().heapUsed;

    return usage;
  }
}

// Example usage showing parallel execution
async function demonstrateParallelExecution() {
  // Sample phases with dependencies
  const phases = [
    { id: 'setup', dependencies: [] },
    { id: 'backend', dependencies: ['setup'] },
    { id: 'frontend', dependencies: ['setup'] },
    { id: 'database', dependencies: ['setup'] },
    { id: 'api-tests', dependencies: ['backend', 'database'] },
    { id: 'ui-tests', dependencies: ['frontend'] },
    { id: 'integration', dependencies: ['api-tests', 'ui-tests'] }
  ];

  const coordinator = new ParallelCoordinator(new PhaseBasedOrchestrator('./plans'), 3);

  // This will execute:
  // Level 0: setup (alone)
  // Level 1: backend, frontend, database (in parallel)
  // Level 2: api-tests, ui-tests (in parallel)
  // Level 3: integration (alone)

  await coordinator.executeInParallel(phases);
}
```

## 7. Complete Working Example

### orchestration.json
```json
{
  "metadata": {
    "planId": "oauth-feature-2024-11-20",
    "name": "OAuth Feature Implementation",
    "description": "Complete OAuth 2.0 integration with Google and GitHub providers",
    "created": "2024-11-20T10:00:00Z",
    "modified": "2024-11-20T14:30:00Z",
    "version": "1.0.0",
    "status": "in-progress"
  },

  "phases": [
    {
      "id": "phase-1-setup",
      "name": "Environment Setup",
      "file": "phases/phase-1-setup.json",
      "type": "sequential",
      "dependencies": [],
      "status": "completed",
      "estimatedTokens": 1500,
      "estimatedDuration": "10m"
    },
    {
      "id": "phase-2-implementation",
      "name": "OAuth Implementation",
      "file": "phases/phase-2-implementation.json",
      "type": "sequential",
      "dependencies": ["phase-1-setup"],
      "status": "in-progress",
      "estimatedTokens": 4000,
      "estimatedDuration": "30m"
    },
    {
      "id": "phase-3-testing",
      "name": "Testing & Validation",
      "file": "phases/phase-3-testing.json",
      "type": "sequential",
      "dependencies": ["phase-2-implementation"],
      "status": "pending",
      "estimatedTokens": 2000,
      "estimatedDuration": "15m"
    }
  ],

  "execution": {
    "strategy": "adaptive",
    "maxParallelPhases": 2,
    "tokenBudget": {
      "total": 10000,
      "perPhase": 5000,
      "warningThreshold": 8000
    },
    "retryPolicy": {
      "maxAttempts": 2,
      "backoffMs": 3000
    }
  },

  "progress": {
    "completedPhases": 1,
    "totalPhases": 3,
    "currentPhases": ["phase-2-implementation"],
    "lastUpdated": "2024-11-20T14:30:00Z",
    "tokenUsage": {
      "used": 3200,
      "remaining": 6800
    }
  }
}
```

### phase-1-setup.json
```json
{
  "phase": {
    "id": "phase-1-setup",
    "name": "Environment Setup",
    "description": "Set up development environment and install dependencies",
    "type": "setup",
    "priority": "critical"
  },

  "configuration": {
    "agent": {
      "model": "claude-3-sonnet",
      "temperature": 0.2,
      "maxTokens": 2000
    },
    "tools": ["terminal", "file-editor"],
    "environment": {
      "NODE_ENV": "development"
    },
    "workingDirectory": "/project"
  },

  "tasks": [
    {
      "id": "task-1.1",
      "name": "Install OAuth Dependencies",
      "description": "Install required npm packages for OAuth",
      "type": "config",
      "status": "completed",
      "dependencies": [],
      "estimatedTokens": 300,

      "actions": [
        {
          "type": "execute",
          "target": "npm install passport passport-google-oauth20 passport-github2",
          "validation": {
            "type": "test",
            "command": "npm list passport"
          }
        }
      ],

      "output": {
        "files": [],
        "logs": ["Dependencies installed successfully"],
        "artifacts": {
          "packages": ["passport", "passport-google-oauth20", "passport-github2"]
        }
      }
    },

    {
      "id": "task-1.2",
      "name": "Create Environment Config",
      "description": "Set up environment variables for OAuth",
      "type": "config",
      "status": "completed",
      "dependencies": ["task-1.1"],
      "estimatedTokens": 400,

      "actions": [
        {
          "type": "create",
          "target": "/.env.example",
          "content": "GOOGLE_CLIENT_ID=your_google_client_id\nGOOGLE_CLIENT_SECRET=your_google_client_secret\nGITHUB_CLIENT_ID=your_github_client_id\nGITHUB_CLIENT_SECRET=your_github_client_secret\nSESSION_SECRET=your_session_secret"
        },
        {
          "type": "create",
          "target": "/config/oauth.config.js",
          "content": "module.exports = {\n  google: {\n    clientID: process.env.GOOGLE_CLIENT_ID,\n    clientSecret: process.env.GOOGLE_CLIENT_SECRET,\n    callbackURL: '/auth/google/callback'\n  },\n  github: {\n    clientID: process.env.GITHUB_CLIENT_ID,\n    clientSecret: process.env.GITHUB_CLIENT_SECRET,\n    callbackURL: '/auth/github/callback'\n  }\n};"
        }
      ],

      "output": {
        "files": ["/.env.example", "/config/oauth.config.js"],
        "logs": ["Environment configuration created"],
        "artifacts": {}
      }
    },

    {
      "id": "task-1.3",
      "name": "Create Directory Structure",
      "description": "Set up required directories for OAuth implementation",
      "type": "config",
      "status": "completed",
      "dependencies": [],
      "estimatedTokens": 200,

      "actions": [
        {
          "type": "execute",
          "target": "mkdir -p src/auth/strategies src/auth/middleware src/auth/__tests__"
        }
      ],

      "output": {
        "files": [],
        "logs": ["Directory structure created"],
        "artifacts": {
          "directories": [
            "src/auth/strategies",
            "src/auth/middleware",
            "src/auth/__tests__"
          ]
        }
      }
    }
  ],

  "metrics": {
    "estimatedDuration": "10m",
    "estimatedTokens": 1500,
    "actualTokens": 1450,
    "startTime": "2024-11-20T10:00:00Z",
    "endTime": "2024-11-20T10:09:30Z",
    "successRate": 100
  }
}
```

### phase-2-implementation.json
```json
{
  "phase": {
    "id": "phase-2-implementation",
    "name": "OAuth Implementation",
    "description": "Implement OAuth strategies and authentication flow",
    "type": "implementation",
    "priority": "critical"
  },

  "configuration": {
    "agent": {
      "model": "claude-3-sonnet",
      "temperature": 0.3,
      "maxTokens": 4000
    },
    "tools": ["file-editor", "terminal", "web-search"],
    "environment": {
      "NODE_ENV": "development"
    },
    "workingDirectory": "/project"
  },

  "tasks": [
    {
      "id": "task-2.1",
      "name": "Implement Google OAuth Strategy",
      "description": "Create Google OAuth strategy using Passport.js",
      "type": "code",
      "status": "completed",
      "dependencies": [],
      "estimatedTokens": 800,

      "actions": [
        {
          "type": "create",
          "target": "/src/auth/strategies/googleStrategy.js",
          "content": "const GoogleStrategy = require('passport-google-oauth20').Strategy;\nconst config = require('../../../config/oauth.config');\n\nmodule.exports = new GoogleStrategy(\n  config.google,\n  async (accessToken, refreshToken, profile, done) => {\n    try {\n      // User handling logic\n      const user = {\n        id: profile.id,\n        email: profile.emails[0].value,\n        name: profile.displayName,\n        provider: 'google',\n        accessToken\n      };\n      return done(null, user);\n    } catch (error) {\n      return done(error, null);\n    }\n  }\n);"
        }
      ],

      "output": {
        "files": ["/src/auth/strategies/googleStrategy.js"],
        "logs": ["Google OAuth strategy implemented"],
        "artifacts": {}
      }
    },

    {
      "id": "task-2.2",
      "name": "Implement GitHub OAuth Strategy",
      "description": "Create GitHub OAuth strategy using Passport.js",
      "type": "code",
      "status": "completed",
      "dependencies": [],
      "estimatedTokens": 800,

      "actions": [
        {
          "type": "create",
          "target": "/src/auth/strategies/githubStrategy.js",
          "content": "const GitHubStrategy = require('passport-github2').Strategy;\nconst config = require('../../../config/oauth.config');\n\nmodule.exports = new GitHubStrategy(\n  config.github,\n  async (accessToken, refreshToken, profile, done) => {\n    try {\n      // User handling logic\n      const user = {\n        id: profile.id,\n        username: profile.username,\n        email: profile.emails[0].value,\n        name: profile.displayName,\n        provider: 'github',\n        accessToken\n      };\n      return done(null, user);\n    } catch (error) {\n      return done(error, null);\n    }\n  }\n);"
        }
      ],

      "output": {
        "files": ["/src/auth/strategies/githubStrategy.js"],
        "logs": ["GitHub OAuth strategy implemented"],
        "artifacts": {}
      }
    },

    {
      "id": "task-2.3",
      "name": "Create Authentication Routes",
      "description": "Set up Express routes for OAuth endpoints",
      "type": "code",
      "status": "in-progress",
      "dependencies": ["task-2.1", "task-2.2"],
      "estimatedTokens": 1000,

      "actions": [
        {
          "type": "create",
          "target": "/src/routes/auth.routes.js",
          "content": "const router = require('express').Router();\nconst passport = require('passport');\n\n// Google OAuth routes\nrouter.get('/auth/google',\n  passport.authenticate('google', { scope: ['profile', 'email'] })\n);\n\nrouter.get('/auth/google/callback',\n  passport.authenticate('google', { failureRedirect: '/login' }),\n  (req, res) => res.redirect('/dashboard')\n);\n\n// GitHub OAuth routes\nrouter.get('/auth/github',\n  passport.authenticate('github', { scope: ['user:email'] })\n);\n\nrouter.get('/auth/github/callback',\n  passport.authenticate('github', { failureRedirect: '/login' }),\n  (req, res) => res.redirect('/dashboard')\n);\n\nmodule.exports = router;"
        }
      ]
    },

    {
      "id": "task-2.4",
      "name": "Configure Passport Middleware",
      "description": "Set up Passport initialization and session handling",
      "type": "code",
      "status": "pending",
      "dependencies": ["task-2.3"],
      "estimatedTokens": 600,

      "actions": [
        {
          "type": "create",
          "target": "/src/auth/passport.config.js",
          "content": "// Passport configuration"
        }
      ]
    },

    {
      "id": "task-2.5",
      "name": "Implement JWT Token Generation",
      "description": "Create JWT token generation for authenticated users",
      "type": "code",
      "status": "pending",
      "dependencies": ["task-2.4"],
      "estimatedTokens": 800,

      "actions": [
        {
          "type": "create",
          "target": "/src/auth/tokenManager.js",
          "content": "// JWT token management"
        }
      ]
    }
  ],

  "metrics": {
    "estimatedDuration": "30m",
    "estimatedTokens": 4000,
    "actualTokens": 1750,
    "startTime": "2024-11-20T10:10:00Z",
    "successRate": 40
  }
}
```

### execution-state.json
```json
{
  "planId": "oauth-feature-2024-11-20",
  "startTime": "2024-11-20T10:00:00Z",
  "lastUpdate": "2024-11-20T14:30:00Z",

  "tokenUsage": {
    "used": 3200,
    "remaining": 6800,
    "byPhase": {
      "phase-1-setup": 1450,
      "phase-2-implementation": 1750,
      "phase-3-testing": 0
    }
  },

  "phaseStates": {
    "phase-1-setup": {
      "status": "completed",
      "startTime": "2024-11-20T10:00:00Z",
      "endTime": "2024-11-20T10:09:30Z",
      "tasksCompleted": 3,
      "tasksTotal": 3,
      "errors": []
    },

    "phase-2-implementation": {
      "status": "in-progress",
      "startTime": "2024-11-20T10:10:00Z",
      "tasksCompleted": 2,
      "tasksTotal": 5,
      "currentTask": "task-2.3",
      "errors": [],
      "progress": 40
    },

    "phase-3-testing": {
      "status": "pending",
      "tasksCompleted": 0,
      "tasksTotal": 4
    }
  },

  "globalProgress": {
    "percentage": 50,
    "phasesCompleted": 1,
    "phasesTotal": 3,
    "tasksCompleted": 5,
    "tasksTotal": 12,
    "estimatedCompletion": "2024-11-20T15:00:00Z"
  },

  "executionLog": [
    {
      "timestamp": "2024-11-20T10:00:00Z",
      "event": "execution_started",
      "details": "Plan execution initiated"
    },
    {
      "timestamp": "2024-11-20T10:09:30Z",
      "event": "phase_completed",
      "details": "phase-1-setup completed successfully"
    },
    {
      "timestamp": "2024-11-20T10:10:00Z",
      "event": "phase_started",
      "details": "phase-2-implementation started"
    },
    {
      "timestamp": "2024-11-20T14:30:00Z",
      "event": "checkpoint",
      "details": "State saved at 50% completion"
    }
  ],

  "resourceMetrics": {
    "cpuUsage": "15%",
    "memoryUsage": "120MB",
    "apiCalls": 45,
    "averageResponseTime": "1.2s"
  }
}
```

## 8. Benefits Summary

### Token Efficiency
- **Reduction**: 76.5% fewer tokens per execution
- **Before**: 57,500 tokens for 5-phase plan
- **After**: 13,500 tokens for same plan
- **Savings**: 44,000 tokens ($0.88 at $0.02/1K tokens)
- **Per-phase overhead**: Reduced from 11,500 to 2,700 tokens

### Speed Improvements
- **Parallel Execution**: 45% faster for independent phases
- **Sequential (old)**: Phase1(10m) + Phase2(30m) + Phase3(25m) + Phase4(20m) = 85m
- **Parallel (new)**: Phase1(10m) + Max(Phase2,Phase3)(30m) + Phase4(20m) = 60m
- **Time saved**: 25 minutes per execution
- **Resource utilization**: Better CPU/memory usage with parallel agents

### Parallel Capabilities
- **Concurrent phases**: Up to 3 phases simultaneously
- **Smart dependency resolution**: Automatic detection of parallelizable work
- **Resource management**: Token budget awareness prevents overload
- **Failure isolation**: Phase failures don't affect parallel siblings

### Maintainability Benefits
- **Modular structure**: Each phase is self-contained
- **Easy updates**: Modify single phase without loading entire plan
- **Clear dependencies**: Explicit phase relationships
- **Incremental testing**: Test phases independently
- **Version control**: Better diff tracking with separate files
- **Debugging**: Isolated phase logs and state

### Scalability Advantages
- **Large plans**: Handles 50+ phase plans efficiently
- **Memory usage**: Only active phases in memory
- **Network efficiency**: Smaller file transfers
- **Cache effectiveness**: Phase files can be cached individually
- **Progressive loading**: Load phases as needed

### Developer Experience
- **Clear separation**: Business logic separated from orchestration
- **Reusable phases**: Share common phases across plans
- **Template support**: Easy to create phase templates
- **Progress visibility**: Real-time phase status updates
- **Resume capability**: Restart from any phase after failure