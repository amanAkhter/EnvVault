// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – entry point
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';
import { login, logout, whoami } from './commands/auth.js';
import { listEnvs, fetchEnv, run, validate } from './commands/sync.js';
import {
  createEnv,
  updateEnv,
  deleteEnv,
  push,
  addUser,
  removeUser,
  listUsers,
} from './commands/admin.js';
import { showConfig, setConfig } from './commands/config.js';

const program = new Command();

program
  .name('envvault')
  .description('Securely sync encrypted environment variables from the cloud.')
  .version('0.1.0');

// ── Auth ─────────────────────────────────────────────────────────────────────
program
  .command('login')
  .description('Sign in and register your encryption key')
  .option('-e, --email <email>', 'account email')
  .option('-o, --organization <orgId>', 'organization to operate in')
  .action(login);

program.command('logout').description('Sign out and clear local credentials').action(logout);
program.command('whoami').description('Show the current logged-in user').action(whoami);

// ── Sync ─────────────────────────────────────────────────────────────────────
program
  .command('list')
  .alias('list-envs')
  .description('List environments you can access')
  .action(listEnvs);

program
  .command('fetch <env>')
  .description('Sync a cloud environment to a local .env file')
  .option('-f, --file <path>', 'output file', '.env')
  .option('-p, --project <projectId>', 'disambiguate environments by project')
  .action((env, opts) => fetchEnv(env, opts));

program
  .command('run <env>')
  .description('Run a command with the environment injected (no file written)')
  .option('-p, --project <projectId>', 'disambiguate environments by project')
  .allowUnknownOption(true)
  .helpOption(false)
  .action((env, opts, cmd) => {
    // Everything after `--` is the command to run.
    const argv = cmd.parent?.args ?? [];
    const sep = process.argv.indexOf('--');
    const command = sep === -1 ? [] : process.argv.slice(sep + 1);
    void argv;
    return run(env, command, opts);
  });

program
  .command('validate')
  .description('Check the local .env is EnvVault-managed and not expired')
  .option('-f, --file <path>', 'file to check', '.env')
  .action(validate);

// ── Admin ────────────────────────────────────────────────────────────────────
const admin = program.command('admin').description('Admin operations (requires admin role)');

admin
  .command('create-env <name>')
  .description('Create a new environment')
  .requiredOption('-p, --project <projectId>', 'owning project')
  .option('-s, --slug <slug>', 'url-safe slug (defaults from name)')
  .option('-t, --type <type>', 'development|staging|production|custom', 'custom')
  .option('-d, --description <text>', 'description')
  .action((name, opts) => createEnv(name, opts));

admin
  .command('update-env <env>')
  .description('Update environment metadata')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .option('-n, --name <name>', 'new display name')
  .option('-d, --description <text>', 'new description')
  .option('-c, --color <hex>', 'new color')
  .action((env, opts) => updateEnv(env, opts));

admin
  .command('delete-env <env>')
  .description('Delete an environment (revokes members, soft-deletes variables)')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .option('-y, --yes', 'skip confirmation')
  .action((env, opts) => deleteEnv(env, opts));

admin
  .command('push <env>')
  .description('Encrypt a local .env and push it to the cloud')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .option('-f, --file <path>', 'input file', '.env')
  .action((env, opts) => push(env, opts));

admin
  .command('add-user <env> <email>')
  .description('Grant a user access to an environment')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .action((env, email, opts) => addUser(env, email, opts));

admin
  .command('remove-user <env> <email>')
  .description('Revoke a user and rotate the DEK (use --no-rotate to skip)')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .option('--no-rotate', 'do not rotate the DEK after removal')
  .option('-y, --yes', 'skip confirmation')
  .action((env, email, opts) => removeUser(env, email, opts));

admin
  .command('list-users <env>')
  .description('List members of an environment')
  .option('-p, --project <projectId>', 'disambiguate by project')
  .action((env, opts) => listUsers(env, opts));

// ── Config ───────────────────────────────────────────────────────────────────
const config = program.command('config').description('View or set project configuration');
config.command('show').description('Show current config').action(showConfig);
config
  .command('set')
  .description('Set project configuration')
  .option('--api-key <key>', 'Firebase Web API key')
  .option('--auth-domain <domain>', 'Firebase auth domain')
  .option('--project-id <id>', 'Firebase project id')
  .option('--app-id <id>', 'Firebase app id')
  .option('--region <region>', 'Cloud Functions region')
  .action(setConfig);

program.configureOutput({
  outputError: (str, write) => write(chalk.red(str)),
});

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`✗ ${err.message}`));
  process.exit(1);
});
