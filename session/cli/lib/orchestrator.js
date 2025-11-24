const fs = require('fs').promises;
const path = require('path');

/**
 * Basic Plan Orchestrator
 * Executes plans sequentially (no parallel optimization yet)
 */
class BasicOrchestrator {
  constructor(plansDir, planName) {
    this.plansDir = plansDir;
    this.planName = planName;
    this.planDir = path.join(plansDir, planName);
    this.orchestration = null;
    this.executionState = null;
  }

  /**
   * Load orchestration.json
   */
  async loadOrchestration() {
    const orchestrationPath = path.join(this.planDir, 'orchestration.json');
    const content = await fs.readFile(orchestrationPath, 'utf-8');
    this.orchestration = JSON.parse(content);
    return this.orchestration;
  }

  /**
   * Load execution-state.json
   */
  async loadExecutionState() {
    const statePath = path.join(this.planDir, 'execution-state.json');
    try {
      const content = await fs.readFile(statePath, 'utf-8');
      this.executionState = JSON.parse(content);
    } catch (error) {
      // Create new execution state if doesn't exist
      this.executionState = {
        planId: this.planName,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        tokenUsage: {
          used: 0,
          remaining: this.orchestration.execution.tokenBudget.total,
          byPhase: {}
        },
        phaseStates: {},
        globalProgress: {
          percentage: 0,
          phasesCompleted: 0,
          phasesTotal: this.orchestration.phases.length,
          tasksCompleted: 0,
          tasksTotal: this.orchestration.progress.totalTasks
        },
        executionLog: []
      };
    }
    return this.executionState;
  }

  /**
   * Save execution state
   */
  async saveExecutionState() {
    const statePath = path.join(this.planDir, 'execution-state.json');
    await fs.writeFile(statePath, JSON.stringify(this.executionState, null, 2));
  }

  /**
   * Save orchestration updates
   */
  async saveOrchestration() {
    const orchestrationPath = path.join(this.planDir, 'orchestration.json');
    await fs.writeFile(orchestrationPath, JSON.stringify(this.orchestration, null, 2));
  }

  /**
   * Load a specific phase file
   */
  async loadPhase(phaseId) {
    const phaseMeta = this.orchestration.phases.find(p => p.id === phaseId);
    if (!phaseMeta) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    const phaseFilePath = path.join(this.planDir, phaseMeta.file);
    const content = await fs.readFile(phaseFilePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save phase file
   */
  async savePhase(phaseId, phaseData) {
    const phaseMeta = this.orchestration.phases.find(p => p.id === phaseId);
    if (!phaseMeta) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    const phaseFilePath = path.join(this.planDir, phaseMeta.file);
    await fs.writeFile(phaseFilePath, JSON.stringify(phaseData, null, 2));
  }

  /**
   * Get next executable phase (sequential execution)
   */
  getNextPhase() {
    for (const phase of this.orchestration.phases) {
      if (phase.status === 'pending') {
        // Check dependencies
        const depsCompleted = phase.dependencies.every(depId => {
          const dep = this.orchestration.phases.find(p => p.id === depId);
          return dep && dep.status === 'completed';
        });

        if (depsCompleted) {
          return phase;
        }
      }
    }
    return null;
  }

  /**
   * Get next executable task within a phase
   */
  getNextTask(phaseData) {
    for (const task of phaseData.tasks) {
      if (task.status === 'pending') {
        // Check task dependencies
        const depsCompleted = (task.dependencies || []).every(depId => {
          const dep = phaseData.tasks.find(t => t.task_id === depId);
          return dep && dep.status === 'completed';
        });

        if (depsCompleted) {
          return task;
        }
      }
    }
    return null;
  }

  /**
   * Check if plan is complete
   */
  isComplete() {
    return this.orchestration.phases.every(p =>
      p.status === 'completed' || p.status === 'skipped'
    );
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const totalTasks = this.orchestration.progress.totalTasks;
    const completedTasks = this.orchestration.progress.completedTasks;
    const completedPhases = this.orchestration.progress.completedPhases;
    const totalPhases = this.orchestration.phases.length;

    const percentComplete = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    const currentPhase = this.orchestration.phases.find(p => p.status === 'in-progress');

    return {
      planId: this.orchestration.metadata.planId,
      status: this.orchestration.metadata.status,
      progress: {
        phases: `${completedPhases}/${totalPhases}`,
        tasks: `${completedTasks}/${totalTasks}`,
        percentage: percentComplete
      },
      currentPhase: currentPhase ? {
        id: currentPhase.id,
        name: currentPhase.name,
        status: currentPhase.status
      } : null,
      isComplete: this.isComplete()
    };
  }

  /**
   * Log execution event
   */
  logEvent(event, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details
    };
    this.executionState.executionLog.push(logEntry);
  }

  /**
   * Update progress tracking
   */
  async updateProgress() {
    let totalTasks = 0;
    let completedTasks = 0;

    for (const phaseMeta of this.orchestration.phases) {
      try {
        const phaseData = await this.loadPhase(phaseMeta.id);
        totalTasks += phaseData.tasks.length;
        completedTasks += phaseData.tasks.filter(t => t.status === 'completed').length;
      } catch (error) {
        console.warn(`Could not load phase ${phaseMeta.id} for progress calculation`);
      }
    }

    this.orchestration.progress.totalTasks = totalTasks;
    this.orchestration.progress.completedTasks = completedTasks;
    this.orchestration.progress.completedPhases = this.orchestration.phases.filter(
      p => p.status === 'completed'
    ).length;
    this.orchestration.progress.lastUpdated = new Date().toISOString();

    this.executionState.globalProgress = {
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      phasesCompleted: this.orchestration.progress.completedPhases,
      phasesTotal: this.orchestration.phases.length,
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks
    };

    await this.saveOrchestration();
    await this.saveExecutionState();
  }
}

module.exports = { BasicOrchestrator };
