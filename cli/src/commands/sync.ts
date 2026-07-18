// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – sync commands: list, fetch, run
// ─────────────────────────────────────────────────────────────────────────────

import ora from 'ora';
import { writeFileSync, chmodSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { callFunction } from '../firebase.js';
import { requireSession } from '../session.js';
import { unwrapDEK, decrypt } from '../crypto.js';
import { serializeEnv, parseEnv, isExpired } from '../envfile.js';
import { ui, fail, fmtTime } from '../ui.js';

interface EnvListRow {
  environmentId: string;
  projectId: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  keyVersion: number;
  lastSyncAt: number | null;
}

interface FetchResult {
  environmentId: string;
  slug: string;
  name: string;
  keyVersion: number;
  wrappedDEK: string;
  variables: { key: string; encryptedValue: string; iv: string; fingerprint: string }[];
  syncedAt: number;
  expiresAt: number;
}

export async function listEnvs(): Promise<void> {
  const { idToken, session } = await requireSession();
  const spinner = ora('Loading environments…').start();
  try {
    const res = await callFunction<{ organizationId: string }, { environments: EnvListRow[] }>(
      'listEnvironments',
      idToken,
      { organizationId: session.organizationId },
    );
    spinner.stop();
    if (res.environments.length === 0) {
      ui.info('No environments. Ask an admin to grant you access.');
      return;
    }
    ui.raw(chalk.bold('\n  ENVIRONMENT          TYPE         STATUS    LAST SYNC'));
    for (const e of res.environments) {
      const status = e.status === 'active' ? chalk.green(e.status) : chalk.yellow(e.status);
      ui.raw(
        `  ${e.slug.padEnd(20)} ${e.type.padEnd(12)} ${status.padEnd(18)} ${fmtTime(e.lastSyncAt)}`,
      );
    }
    ui.raw('');
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

/** Decrypt a fetched environment into a plaintext key/value map. */
async function decryptEnvironment(res: FetchResult, privateKeyJwk: string): Promise<Record<string, string>> {
  const dek = await unwrapDEK(res.wrappedDEK, privateKeyJwk);
  const values: Record<string, string> = {};
  for (const v of res.variables) {
    values[v.key] = await decrypt(v.encryptedValue, v.iv, dek);
  }
  return values;
}

async function fetchEnvironment(
  idToken: string,
  organizationId: string,
  slug: string,
  projectId?: string,
): Promise<FetchResult> {
  return callFunction<
    { organizationId: string; environmentSlug: string; projectId?: string },
    FetchResult
  >('fetchEnvironment', idToken, { organizationId, environmentSlug: slug, projectId });
}

export async function fetchEnv(
  envSlug: string,
  opts: { file?: string; project?: string },
): Promise<void> {
  const { idToken, session } = await requireSession();
  const spinner = ora(`Fetching ${envSlug}…`).start();
  try {
    const res = await fetchEnvironment(idToken, session.organizationId, envSlug, opts.project);
    spinner.text = 'Decrypting…';
    const values = await decryptEnvironment(res, session.privateKeyJwk);

    const outPath = resolve(process.cwd(), opts.file ?? '.env');
    const content = serializeEnv(values, {
      environment: res.slug,
      environmentId: res.environmentId,
      keyVersion: res.keyVersion,
      syncedAt: res.syncedAt,
    });
    writeFileSync(outPath, content, { encoding: 'utf8', mode: 0o600 });
    try {
      chmodSync(outPath, 0o600);
    } catch {
      /* Windows: mode is best-effort */
    }

    spinner.succeed(`Synced ${Object.keys(values).length} variable(s) to ${opts.file ?? '.env'} (${res.slug})`);
    ui.dim(`  Expires ${new Date(res.expiresAt).toISOString()} — re-run fetch after that.`);
  } catch (err) {
    spinner.fail((err as Error).message);
    // Security: if access was revoked, wipe any stale local file.
    const msg = (err as Error).message;
    if (msg.includes('revoked') || msg.includes('access')) {
      const outPath = resolve(process.cwd(), opts.file ?? '.env');
      if (existsSync(outPath)) {
        const parsed = parseEnv(readFileSync(outPath, 'utf8'));
        if (parsed.header?.environmentId === undefined || parsed.header?.environment === envSlug) {
          writeFileSync(outPath, '', 'utf8');
          ui.warn('Removed local .env for the revoked environment.');
        }
      }
    }
    process.exit(1);
  }
}

/**
 * run — inject decrypted variables into a child process WITHOUT writing them to
 * disk. This is the recommended workflow: nothing to copy, values vanish when
 * the process exits.
 *
 *   envvault run production -- npm start
 */
export async function run(
  envSlug: string,
  command: string[],
  opts: { project?: string },
): Promise<void> {
  if (command.length === 0) {
    fail('No command given. Usage: envvault run <env> -- <command> [args…]');
  }
  const { idToken, session } = await requireSession();
  const spinner = ora(`Resolving ${envSlug}…`).start();
  let values: Record<string, string>;
  try {
    const res = await fetchEnvironment(idToken, session.organizationId, envSlug, opts.project);
    values = await decryptEnvironment(res, session.privateKeyJwk);
    spinner.succeed(`Injecting ${Object.keys(values).length} variable(s) into: ${command.join(' ')}`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
    return;
  }

  const [bin, ...args] = command;
  const child = spawn(bin, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...values, ENVVAULT_ACTIVE: envSlug },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => fail(`Failed to run "${bin}": ${err.message}`));
}

/** validate — check the local .env is EnvVault-managed and not expired. */
export async function validate(opts: { file?: string }): Promise<void> {
  const outPath = resolve(process.cwd(), opts.file ?? '.env');
  if (!existsSync(outPath)) fail('No .env file found.');
  const parsed = parseEnv(readFileSync(outPath, 'utf8'));
  if (!parsed.header) fail('This .env is not EnvVault-managed.');
  if (isExpired(parsed.header)) {
    fail(`Env "${parsed.header.environment}" is expired. Run: envvault fetch ${parsed.header.environment}`);
  }
  ui.success(`Env "${parsed.header.environment}" is valid (key v${parsed.header.keyVersion}).`);
  ui.dim(`  Expires ${new Date(parsed.header.expiresAt).toISOString()}`);
}
