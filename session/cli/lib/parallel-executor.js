/**
 * Parallel task executor for plan execution
 *
 * Handles grouping independent tasks into batches and
 * executing them concurrently with proper result aggregation.
 *
 * @module parallel-executor
 * @category CLI
 */

/**
 * Task for execution
 * @typedef {Object} ExecutableTask
 * @property {string} id - Task ID
 * @property {string[]} depends_on - Task dependencies
 * @property {Function} execute - Async function to execute task
 */

/**
 * Task execution result
 * @typedef {Object} TaskResult
 * @property {string} task_id - Task ID
 * @property {'completed'|'failed'|'skipped'} status - Execution status
 * @property {number} duration_ms - Execution duration
 * @property {*} [result] - Task result if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * Batch execution result
 * @typedef {Object} BatchResult
 * @property {number} batch - Batch number
 * @property {TaskResult[]} results - Individual task results
 * @property {number} duration_ms - Batch duration
 * @property {number} completed - Count completed
 * @property {number} failed - Count failed
 */

/**
 * Full execution result
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - True if all tasks completed
 * @property {TaskResult[]} results - All task results
 * @property {number} batches - Number of batches executed
 * @property {number} duration_ms - Total duration
 * @property {Object} summary - Execution summary
 */

/**
 * Parallel task executor
 *
 * @class
 * @category CLI
 * @example
 * const executor = new ParallelExecutor({ maxParallel: 4 });
 * const results = await executor.execute(tasks);
 */
class ParallelExecutor {
  /**
   * Create a new ParallelExecutor
   *
   * @param {Object} [options] - Executor options
   * @param {number} [options.maxParallel=1] - Max concurrent tasks
   * @param {Function} [options.onTaskStart] - Called when task starts
   * @param {Function} [options.onTaskComplete] - Called when task completes
   * @param {Function} [options.onBatchStart] - Called when batch starts
   * @param {Function} [options.onBatchComplete] - Called when batch completes
   */
  constructor(options = {}) {
    this.maxParallel = options.maxParallel || 1;
    this.onTaskStart = options.onTaskStart || (() => {});
    this.onTaskComplete = options.onTaskComplete || (() => {});
    this.onBatchStart = options.onBatchStart || (() => {});
    this.onBatchComplete = options.onBatchComplete || (() => {});
  }

  /**
   * Execute tasks respecting dependencies and parallelism
   *
   * @param {ExecutableTask[]} tasks - Tasks to execute
   * @returns {Promise<ExecutionResult>} Execution result
   *
   * @example
   * const tasks = [
   *   { id: 'task-1', depends_on: [], execute: async () => { ... } },
   *   { id: 'task-2', depends_on: ['task-1'], execute: async () => { ... } },
   *   { id: 'task-3', depends_on: [], execute: async () => { ... } }
   * ];
   * const result = await executor.execute(tasks);
   */
  async execute(tasks) {
    const startTime = Date.now();
    const results = [];
    const completed = new Set();
    const remaining = new Map(tasks.map(t => [t.id, t]));
    let batchNumber = 0;

    while (remaining.size > 0) {
      // Find tasks with satisfied dependencies
      const ready = [];
      for (const [id, task] of remaining) {
        const depsCompleted = !task.depends_on?.length ||
          task.depends_on.every(dep => completed.has(dep));

        if (depsCompleted) {
          ready.push(task);
        }
      }

      if (ready.length === 0 && remaining.size > 0) {
        // Circular dependency or unsatisfied deps
        const blocked = Array.from(remaining.keys());
        throw new Error(`Blocked tasks with unresolved dependencies: ${blocked.join(', ')}`);
      }

      // Execute batch
      batchNumber++;
      const batch = ready.slice(0, this.maxParallel);

      this.onBatchStart({
        batch: batchNumber,
        tasks: batch.map(t => t.id),
        total: remaining.size
      });

      const batchStart = Date.now();
      const batchResults = await this.executeBatch(batch);
      const batchDuration = Date.now() - batchStart;

      this.onBatchComplete({
        batch: batchNumber,
        results: batchResults,
        duration_ms: batchDuration
      });

      // Process results
      for (const result of batchResults) {
        results.push(result);
        if (result.status === 'completed') {
          completed.add(result.task_id);
        }
        remaining.delete(result.task_id);
      }
    }

    const duration = Date.now() - startTime;
    const completedCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    return {
      success: failedCount === 0,
      results,
      batches: batchNumber,
      duration_ms: duration,
      summary: {
        total: results.length,
        completed: completedCount,
        failed: failedCount,
        skipped: skippedCount,
        successRate: ((completedCount / results.length) * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Execute a batch of tasks concurrently
   *
   * @param {ExecutableTask[]} batch - Tasks to execute
   * @returns {Promise<TaskResult[]>} Task results
   */
  async executeBatch(batch) {
    const promises = batch.map(task => this.executeTask(task));
    return Promise.all(promises);
  }

  /**
   * Execute a single task with timing and error handling
   *
   * @param {ExecutableTask} task - Task to execute
   * @returns {Promise<TaskResult>} Task result
   */
  async executeTask(task) {
    const startTime = Date.now();

    this.onTaskStart({ task_id: task.id });

    try {
      const result = await task.execute();
      const duration = Date.now() - startTime;

      const taskResult = {
        task_id: task.id,
        status: 'completed',
        duration_ms: duration,
        result
      };

      this.onTaskComplete(taskResult);
      return taskResult;

    } catch (error) {
      const duration = Date.now() - startTime;

      const taskResult = {
        task_id: task.id,
        status: 'failed',
        duration_ms: duration,
        error: error.message
      };

      this.onTaskComplete(taskResult);
      return taskResult;
    }
  }
}

/**
 * Group tasks by independence for parallel execution
 *
 * Analyzes task dependencies and creates execution layers
 * where tasks in the same layer can run in parallel.
 *
 * @param {Array<{id: string, depends_on: string[]}>} tasks - Tasks with dependencies
 * @returns {Array<string[]>} Array of layers, each containing task IDs
 *
 * @example
 * const tasks = [
 *   { id: 'a', depends_on: [] },
 *   { id: 'b', depends_on: ['a'] },
 *   { id: 'c', depends_on: [] },
 *   { id: 'd', depends_on: ['b', 'c'] }
 * ];
 * const layers = groupByDependency(tasks);
 * // Result: [['a', 'c'], ['b'], ['d']]
 *
 * @category CLI
 */
function groupByDependency(tasks) {
  const layers = [];
  const completed = new Set();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  while (completed.size < tasks.length) {
    const layer = [];

    for (const task of tasks) {
      if (completed.has(task.id)) continue;

      const depsCompleted = !task.depends_on?.length ||
        task.depends_on.every(dep => completed.has(dep));

      if (depsCompleted) {
        layer.push(task.id);
      }
    }

    if (layer.length === 0 && completed.size < tasks.length) {
      // Remaining tasks have circular or unsatisfied dependencies
      const remaining = tasks.filter(t => !completed.has(t.id)).map(t => t.id);
      throw new Error(`Circular or unsatisfied dependencies: ${remaining.join(', ')}`);
    }

    layers.push(layer);
    layer.forEach(id => completed.add(id));
  }

  return layers;
}

/**
 * Find tasks that can run independently (no shared files or dependencies)
 *
 * @param {Array<{id: string, depends_on: string[], file: string}>} tasks - Tasks
 * @returns {string[][]} Groups of independent task IDs
 *
 * @example
 * const independent = findIndependentTasks(tasks);
 * // Can safely run each group in parallel
 *
 * @category CLI
 */
function findIndependentTasks(tasks) {
  const groups = [];
  const assigned = new Set();

  for (const task of tasks) {
    if (assigned.has(task.id)) continue;

    // Find tasks that share no dependencies or files with this task
    const group = [task.id];
    assigned.add(task.id);

    for (const other of tasks) {
      if (assigned.has(other.id)) continue;

      const hasDependencyConflict =
        task.depends_on?.includes(other.id) ||
        other.depends_on?.includes(task.id) ||
        task.depends_on?.some(d => other.depends_on?.includes(d));

      const hasFileConflict = task.file === other.file;

      if (!hasDependencyConflict && !hasFileConflict) {
        group.push(other.id);
        assigned.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Create a parallel executor
 *
 * @param {Object} [options] - Executor options
 * @returns {ParallelExecutor} Executor instance
 *
 * @example
 * const executor = createParallelExecutor({ maxParallel: 4 });
 */
function createParallelExecutor(options) {
  return new ParallelExecutor(options);
}

module.exports = {
  ParallelExecutor,
  createParallelExecutor,
  groupByDependency,
  findIndependentTasks
};
