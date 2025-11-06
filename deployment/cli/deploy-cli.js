#!/usr/bin/env node

const commands = {
  'init': require('./lib/commands/init'),
  'validate': require('./lib/commands/validate'),
  'config': require('./lib/commands/config'),
  'check-git': require('./lib/commands/check-git')
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error(JSON.stringify({
      success: false,
      error: 'No command specified',
      usage: 'deploy-cli <command> [options]',
      availableCommands: Object.keys(commands)
    }, null, 2));
    process.exit(1);
  }

  if (!commands[command]) {
    console.error(JSON.stringify({
      success: false,
      error: `Unknown command "${command}"`,
      availableCommands: Object.keys(commands)
    }, null, 2));
    process.exit(1);
  }

  try {
    const result = await commands[command](args.slice(1));
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, null, 2));
    process.exit(1);
  }
}

main();
