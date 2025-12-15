#!/usr/bin/env node

/**
 * Session Management CLI Tool
 *
 * Lightweight Node.js CLI for managing Claude Code sessions.
 * Handles file I/O, metadata indexing, and data management without Claude involvement.
 *
 * Usage:
 *   node session-cli.js <command> [options]
 *
 * Commands:
 *   list                    List all sessions
 *   get <name>              Get session details
 *   activate <name>         Activate a session
 *   close                   Close the currently active session
 *   delete <name>           Delete a session permanently
 *   update-index            Update metadata index
 *   update-status <name> <status>  Update session status (active/closed)
 *   validate                Validate index integrity
 *   stats <name>            Get session statistics
 *   stats-all               Get statistics for all sessions
 *   write-snapshot          Write snapshot file
 *   get-state <name>        Get session state
 *   update-state <name>     Update session state
 *   capture-git <name>      Capture git history in compressed format
 *
 *   Plan Commands (Global):
 *   create-plan <name> <json>                     Create a new plan
 *   get-plan <name>                                Get plan details
 *   list-plans                                     List all global plans
 *   plan-list                                      List all global plans (alias)
 *   finalize-plan <name>                           Finalize conceptual plan for execution
 *   update-task-status <plan> <taskId> <status>   Update task status
 *   plan-status <plan>                             Get plan execution status
 *   detect-work-type <session>                     Detect work type from conversation
 *   select-template <type>                         Load template by work type
 */

const fs = require('fs');
const path = require('path');

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  SESSION_NOT_FOUND: 2,
  INVALID_ARGUMENTS: 3,
  FILE_SYSTEM_ERROR: 4,
  INDEX_CORRUPTION: 5
};

// Command handlers
const commands = {
  list: require('./lib/commands/list'),
  get: require('./lib/commands/get'),
  activate: require('./lib/commands/activate'),
  delete: require('./lib/commands/delete'),
  'update-index': require('./lib/commands/update-index'),
  'update-status': require('./lib/commands/update-status'),
  validate: require('./lib/commands/validate'),
  stats: require('./lib/commands/stats'),
  'stats-all': require('./lib/commands/stats-all'),
  'write-snapshot': require('./lib/commands/write-snapshot'),
  'get-state': require('./lib/commands/get-state'),
  'update-state': require('./lib/commands/update-state'),
  'setup-hooks': require('./lib/commands/setup-hooks'),
  'capture-git': require('./lib/commands/capture-git'),
  close: require('./lib/commands/close'),
  // Plan operations
  'create-plan': require('./lib/commands/plan-ops').createPlan,
  'get-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, loadPhases] = args;
    return await planOps.getPlan(planName, loadPhases === 'true');
  },
  'update-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, updates] = args;
    return await planOps.updatePlan(planName, JSON.parse(updates));
  },
  'delete-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.deletePlan(planName);
  },
  'list-plans': require('./lib/commands/plan-ops').listPlans,
  'plan-list': require('./lib/commands/plan-ops').listPlans,  // Alias for list-plans
  'validate-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.validatePlan(planName);
  },
  'finalize-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.finalizePlan(planName);
  },
  'update-task-status': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, taskId, status] = args;
    return await planOps.updateTaskStatus(planName, taskId, status);
  },
  'plan-status': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    return await planOps.getPlanStatus(args);
  },
  'export-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, format] = args;
    return await planOps.exportPlan(planName, format);
  },
  'plan-exists': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.planExists(planName);
  },
  'plan-summary': async (args) => {
    const planSummary = require('./lib/commands/plan-summary');
    const [planName] = args;
    return await planSummary.generatePlanSummary(planName);
  },
  'plan-update': async (args) => {
    const planUpdate = require('./lib/commands/plan-update');
    return await planUpdate(args);
  },
  'plan-review': async (args) => {
    const planReview = require('./lib/commands/plan-review');
    const [planName] = args;
    return await planReview.reviewPlan(planName);
  },
  // Requirements-based workflow operations
  'save-requirements': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, requirementsJson] = args;
    const requirementsData = JSON.parse(requirementsJson);
    return await planOps.saveRequirements(planName, requirementsData);
  },
  'validate-requirements': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [requirementsJson] = args;
    const requirementsData = JSON.parse(requirementsJson);
    return await planOps.validateRequirements(requirementsData);
  },
  'load-requirements': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.loadRequirements(planName);
  },
  'get-plan-format': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.getPlanFormat(planName);
  },
  'transform-plan': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, breakdownJson] = args;
    const breakdownData = JSON.parse(breakdownJson);
    return await planOps.transformPlan(planName, breakdownData);
  },
  // Work type and template operations
  'detect-work-type': async (sessionName) => {
    const workTypeDetector = require('./lib/work-type-detector');
    const conversationPath = path.join(process.cwd(), '.claude/sessions', sessionName, 'conversation-log.jsonl');
    try {
      const content = fs.readFileSync(conversationPath, 'utf-8');
      const conversationLog = content.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
      return await workTypeDetector.detectWorkType(conversationLog);
    } catch (error) {
      return { type: 'unknown', confidence: 0, reason: error.message };
    }
  },
  'select-template': async (workType) => {
    const templateSelector = require('./lib/template-selector');
    return await templateSelector.selectTemplate(workType);
  },
  // Project Maps operations
  'project-maps': require('./lib/commands/project-maps'),

  // v2.0: Confidence and Spec operations
  'analyze-confidence': async (args) => {
    const { ConfidenceDetector } = require('./lib/confidence-detector');
    const [taskJson, optionsJson] = args;
    const task = JSON.parse(taskJson);
    const options = optionsJson ? JSON.parse(optionsJson) : {};
    const detector = new ConfidenceDetector(options);
    return await detector.analyze(task);
  },
  'analyze-confidence-all': async (args) => {
    const { ConfidenceDetector } = require('./lib/confidence-detector');
    const [tasksJson, optionsJson] = args;
    const tasks = JSON.parse(tasksJson);
    const options = optionsJson ? JSON.parse(optionsJson) : {};
    const detector = new ConfidenceDetector(options);
    return await detector.analyzeAll(tasks);
  },
  'validate-spec': async (args) => {
    const { SpecValidator } = require('./lib/spec-validator');
    const [taskJson] = args;
    const task = JSON.parse(taskJson);
    const validator = new SpecValidator();
    return await validator.validate(task);
  },
  'validate-specs-all': async (args) => {
    const { SpecValidator } = require('./lib/spec-validator');
    const [tasksJson] = args;
    const tasks = JSON.parse(tasksJson);
    const validator = new SpecValidator();
    return await validator.validateAll(tasks);
  },
  'fetch-docs': async (args) => {
    const { DocFetcher } = require('./lib/doc-fetcher');
    const [sourcesJson, optionsJson] = args;
    const sources = JSON.parse(sourcesJson);
    const options = optionsJson ? JSON.parse(optionsJson) : {};
    const fetcher = new DocFetcher(options);
    return await fetcher.fetchAll(sources);
  },
  'get-next-task': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.getNextTask(planName);
  },
  'get-confidence-stats': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName] = args;
    return await planOps.getConfidenceStats(planName);
  },
  'get-task-context': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, taskId] = args;
    return await planOps.getTaskContext(planName, taskId);
  },
  'batch-update-tasks': async (args) => {
    const planOps = require('./lib/commands/plan-ops');
    const [planName, updatesJson] = args;
    const updates = JSON.parse(updatesJson);
    return await planOps.batchUpdateTasks(planName, updates);
  }
};

/**
 * Display help text
 */
function showHelp() {
  console.log(`
Session Management CLI Tool

Usage:
  session-cli <command> [options]

Commands:
  list [--json] [--active-only]
      List all sessions with metadata

  get <session-name> [--include-snapshots]
      Get detailed information about a specific session

  activate <session-name>
      Set a session as active

  close [--name <name>] [--formatted]
      Close the currently active session
      --name: Validate active session matches this name (safety check)
      --formatted: Output pre-rendered for display

  delete <session-name>
      Delete a session permanently (cannot be undone)

  update-index [--session <name>] [--full-rebuild]
      Update the metadata index

  update-status <session-name> <status>
      Update session status (active or closed) in .auto-capture-state

  validate [--fix]
      Validate index integrity and optionally fix issues

  stats <session-name> [--detailed]
      Get statistics for a specific session

  stats-all
      Get statistics for all sessions

  write-snapshot <session-name> [--type auto|manual] [--stdin] [--content "..."]
      Write a snapshot file (content via stdin or --content flag)

  get-state <session-name>
      Get auto-capture state for a session

  update-state <session-name> <json-data>
      Update session state with JSON data

  setup-hooks [--remove] [--status] [--force-cleanup] [--dry-run]
      Manage session plugin hooks in .claude/settings.json
      --remove: Remove hooks instead of installing
      --status: Show current hook configuration
      --force-cleanup: Clean up orphaned hooks
      --dry-run: Preview changes without applying

  capture-git <session-name>
      Capture git history in compressed JSON format (~2-3KB)

  project-maps <subcommand> [options]
      Manage project context maps

      Subcommands:
        generate [path]           Generate maps for project
        load [--tier N|--map X]   Load and display maps
        refresh [--full|--incr]   Refresh maps
        list                      List all mapped projects
        query <type>              Query project info
        stats                     Show compression stats

      Examples:
        session-cli project-maps generate
        session-cli project-maps load --tier 1
        session-cli project-maps list
        session-cli project-maps query framework

Plan Commands:
  validate-requirements '<json>'
      Validate requirements JSON against schema

  save-requirements <plan-name> '<json>'
      Save requirements to .claude/plans/{plan-name}/requirements.json

  load-requirements <plan-name>
      Load requirements for a plan

  get-plan-format <plan-name>
      Get the format of a plan (conceptual or execution)

  transform-plan <plan-name> '<breakdown-json>'
      Transform conceptual plan to execution format

  plan-exists <plan-name>
      Check if a plan exists

  plan-update <plan-name> [options]
      Update plan tasks and phases

  detect-work-type <session-name>
      Detect work type from conversation log

  select-template <work-type>
      Get template path for work type

Options:
  --help              Show this help message
  --version           Show version information
  --json              Output in JSON format

Exit Codes:
  0  Success
  1  General error
  2  Session not found
  3  Invalid arguments
  4  File system error
  5  Index corruption

Examples:
  session-cli list --json
  session-cli get my-session --include-snapshots
  session-cli activate my-session
  session-cli update-index --full-rebuild
  echo "snapshot content" | session-cli write-snapshot my-session --stdin --type auto
`);
}

/**
 * Show version information
 */
function showVersion() {
  const plugin = require('../plugin.json');
  console.log(`Session CLI v${plugin.version}`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle no arguments or help flag
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Check if command exists
  if (!commands.hasOwnProperty(command)) {
    console.error(`Error: Unknown command '${command}'`);
    console.error('Run "session-cli --help" for usage information');
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  // Check if command is implemented
  const handler = commands[command];
  if (!handler) {
    console.error(`Error: Command '${command}' not yet implemented`);
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  // Execute command
  try {
    const result = await handler(commandArgs);

    // Output result if present
    if (result !== undefined && result !== null) {
      // Handle lean output format (has 'output' property with raw string)
      if (result.output !== undefined && !commandArgs.includes('--json')) {
        console.log(result.output);
        // Print metadata to stderr so it doesn't pollute output
        if (result.count !== undefined) {
          console.error(`# ${result.count} results in ${result.time}`);
        }
      } else if (result.formatted && !commandArgs.includes('--json')) {
        // Handle verbose/claude format (has 'formatted' property with markdown)
        console.log(result.formatted);
        if (result.message) {
          console.log(`\n---\n${result.message}`);
        }
      } else if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Handle known error types
    if (error.code === 'ENOENT') {
      console.error(`Error: File or directory not found - ${error.path}`);
      process.exit(EXIT_CODES.FILE_SYSTEM_ERROR);
    } else if (error.code === 'EACCES') {
      console.error(`Error: Permission denied - ${error.path}`);
      process.exit(EXIT_CODES.FILE_SYSTEM_ERROR);
    } else if (error.message && error.message.includes('not found')) {
      console.error(`Error: ${error.message}`);
      process.exit(EXIT_CODES.SESSION_NOT_FOUND);
    } else if (error.message && error.message.includes('Index corrupt')) {
      console.error(`Error: ${error.message}`);
      process.exit(EXIT_CODES.INDEX_CORRUPTION);
    } else {
      console.error(`Error: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { EXIT_CODES };
