// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – admin commands
//   admin create-env / update-env / delete-env
//   admin push
//   admin add-user / remove-user / list-users
//
// All DEK generation and wrapping happens here, client-side. The server never
// sees a raw DEK or plaintext value.
// ─────────────────────────────────────────────────────────────────────────────

import ora from 'ora';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { callFunction } from '../firebase.js';
import { requireSession, type ActiveSession } from '../session.js';
import {
  generateDEK,
  wrapDEKForUser,
  unwrapDEK,
  encrypt,
  fingerprint,
} from '../crypto.js';
import { parseEnv, checksumOf } from '../envfile.js';
import { ui, fail, confirm, fmtTime } from '../ui.js';

interface EncVar {
  key: string;
  encryptedValue: string;
  iv: string;
  fingerprint: string;
}

async function encryptValues(values: Record<string, string>, dek: CryptoKey): Promise<EncVar[]> {
  const out: EncVar[] = [];
  for (const [key, value] of Object.entries(values)) {
    const enc = await encrypt(value, dek);
    out.push({ key, encryptedValue: enc.ciphertext, iv: enc.iv, fingerprint: await fingerprint(value) });
  }
  return out;
}

/** Fetch the environment's DEK by acting as a member (admin is auto-granted). */
async function resolveDEK(active: ActiveSession, envSlug: string, projectId?: string): Promise<CryptoKey> {
  const res = await callFunction<
    { organizationId: string; environmentSlug: string; projectId?: string },
    { wrappedDEK: string }
  >('fetchEnvironment', active.idToken, {
    organizationId: active.session.organizationId,
    environmentSlug: envSlug,
    projectId,
  });
  return unwrapDEK(res.wrappedDEK, active.session.privateKeyJwk);
}

export async function createEnv(
  name: string,
  opts: { project: string; slug?: string; type?: string; description?: string },
): Promise<void> {
  if (!opts.project) fail('--project <projectId> is required.');
  const active = await requireSession();
  const slug = (opts.slug ?? name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

  const spinner = ora(`Creating environment "${slug}"…`).start();
  try {
    // Generate a fresh DEK and wrap it for ourselves.
    const dek = await generateDEK();
    const adminWrappedDEK = await wrapDEKForUser(dek, active.session.publicKeyJwk);

    const res = await callFunction<Record<string, unknown>, { environmentId: string; keyVersion: number }>(
      'createEnvironment',
      active.idToken,
      {
        organizationId: active.session.organizationId,
        projectId: opts.project,
        name,
        slug,
        type: opts.type ?? 'custom',
        description: opts.description ?? '',
        adminWrappedDEK,
      },
    );
    spinner.succeed(`Created environment "${slug}" (key v${res.keyVersion}).`);
    ui.dim(`  Environment ID: ${res.environmentId}`);
    ui.dim(`  Push variables with: envvault admin push ${slug} --project ${opts.project}`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function updateEnv(
  envSlug: string,
  opts: { project?: string; name?: string; description?: string; color?: string },
): Promise<void> {
  const active = await requireSession();
  const spinner = ora(`Updating "${envSlug}"…`).start();
  try {
    await callFunction<Record<string, unknown>, { ok: boolean }>('updateEnvironment', active.idToken, {
      organizationId: active.session.organizationId,
      environmentSlug: envSlug,
      projectId: opts.project,
      name: opts.name,
      description: opts.description,
      color: opts.color,
    });
    spinner.succeed(`Updated "${envSlug}".`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function deleteEnv(envSlug: string, opts: { project?: string; yes?: boolean }): Promise<void> {
  const active = await requireSession();
  if (!opts.yes) {
    const ok = await confirm(`Delete environment "${envSlug}"? This revokes all members and soft-deletes variables.`);
    if (!ok) return ui.info('Cancelled.');
  }
  const spinner = ora(`Deleting "${envSlug}"…`).start();
  try {
    await callFunction<Record<string, unknown>, { ok: boolean }>('deleteEnvironment', active.idToken, {
      organizationId: active.session.organizationId,
      environmentSlug: envSlug,
      projectId: opts.project,
    });
    spinner.succeed(`Deleted "${envSlug}".`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function push(
  envSlug: string,
  opts: { project?: string; file?: string },
): Promise<void> {
  const active = await requireSession();
  const filePath = resolve(process.cwd(), opts.file ?? '.env');
  if (!existsSync(filePath)) fail(`File not found: ${opts.file ?? '.env'}`);

  const parsed = parseEnv(readFileSync(filePath, 'utf8'));
  const keys = Object.keys(parsed.values);
  if (keys.length === 0) fail('No variables found in the file.');

  const spinner = ora(`Encrypting ${keys.length} variable(s)…`).start();
  try {
    const dek = await resolveDEK(active, envSlug, opts.project);
    const encrypted = await encryptValues(parsed.values, dek);
    spinner.text = `Pushing to ${envSlug}…`;
    const res = await callFunction<Record<string, unknown>, { variableCount: number; softDeleted: number }>(
      'pushEnvironment',
      active.idToken,
      {
        organizationId: active.session.organizationId,
        environmentSlug: envSlug,
        projectId: opts.project,
        variables: encrypted,
        checksum: checksumOf(parsed.values),
      },
    );
    spinner.succeed(`Pushed ${res.variableCount} variable(s) to ${envSlug} (${res.softDeleted} removed).`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function addUser(
  envSlug: string,
  email: string,
  opts: { project?: string },
): Promise<void> {
  const active = await requireSession();
  const spinner = ora(`Fetching public key for ${email}…`).start();
  try {
    const target = await callFunction<{ email: string }, { userId: string; email: string; publicKeyJwk: string }>(
      'getUserPublicKey',
      active.idToken,
      { email },
    );

    // Unwrap the current DEK, re-wrap it for the target user.
    spinner.text = 'Wrapping key for user…';
    const dek = await resolveDEK(active, envSlug, opts.project);
    const userWrappedDEK = await wrapDEKForUser(dek, target.publicKeyJwk);

    spinner.text = `Granting ${email} access…`;
    await callFunction<Record<string, unknown>, { keyVersion: number }>('addUserToEnvironment', active.idToken, {
      organizationId: active.session.organizationId,
      environmentSlug: envSlug,
      projectId: opts.project,
      targetUserId: target.userId,
      targetEmail: target.email,
      userWrappedDEK,
    });
    spinner.succeed(`Granted ${email} access to ${envSlug}.`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

/**
 * removeUser — revoke access. With --rotate (default), performs a full DEK
 * rotation: generate a new DEK, re-encrypt all variables, re-wrap for every
 * remaining member, and submit atomically so the removed user's cached copy is
 * instantly worthless.
 */
export async function removeUser(
  envSlug: string,
  email: string,
  opts: { project?: string; rotate?: boolean; yes?: boolean },
): Promise<void> {
  const active = await requireSession();
  const rotate = opts.rotate !== false;
  if (!opts.yes) {
    const ok = await confirm(`Remove ${email} from "${envSlug}"${rotate ? ' and rotate the DEK' : ''}?`);
    if (!ok) return ui.info('Cancelled.');
  }

  const spinner = ora(`Revoking ${email}…`).start();
  try {
    let rotation: unknown;
    if (rotate) {
      spinner.text = 'Rotating environment key…';
      // Pull remaining members' public keys + current variables.
      const ctx = await callFunction<
        Record<string, unknown>,
        {
          members: { userId: string; email: string; publicKeyJwk: string }[];
          variables: { key: string; encryptedValue: string; iv: string; fingerprint: string }[];
        }
      >('getEnvironmentRotationContext', active.idToken, {
        organizationId: active.session.organizationId,
        environmentSlug: envSlug,
        projectId: opts.project,
        excludeEmail: email,
      });

      // Decrypt with the OLD dek, re-encrypt with a NEW dek.
      const oldDek = await resolveDEK(active, envSlug, opts.project);
      const plain: Record<string, string> = {};
      for (const v of ctx.variables) {
        plain[v.key] = await (await import('../crypto.js')).decrypt(v.encryptedValue, v.iv, oldDek);
      }
      const newDek = await generateDEK();
      const reEncrypted = await encryptValues(plain, newDek);
      const newWraps = await Promise.all(
        ctx.members.map(async (m) => ({
          userId: m.userId,
          wrappedDEK: await wrapDEKForUser(newDek, m.publicKeyJwk),
        })),
      );
      rotation = { newWraps, variables: reEncrypted };
    }

    spinner.text = `Removing ${email}…`;
    const res = await callFunction<Record<string, unknown>, { rotated: boolean; keyVersion?: number }>(
      'removeUserFromEnvironment',
      active.idToken,
      {
        organizationId: active.session.organizationId,
        environmentSlug: envSlug,
        projectId: opts.project,
        targetEmail: email,
        rotation,
      },
    );
    spinner.succeed(
      res.rotated
        ? `Removed ${email} and rotated DEK to v${res.keyVersion}. Their cached copy is now worthless.`
        : `Removed ${email} from ${envSlug}.`,
    );
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function listUsers(envSlug: string, opts: { project?: string }): Promise<void> {
  const active = await requireSession();
  const spinner = ora('Loading members…').start();
  try {
    const res = await callFunction<
      Record<string, unknown>,
      { users: { email: string; status: string; keyVersion: number; lastSyncAt: number | null }[] }
    >('listEnvironmentUsers', active.idToken, {
      organizationId: active.session.organizationId,
      environmentSlug: envSlug,
      projectId: opts.project,
    });
    spinner.stop();
    if (res.users.length === 0) return ui.info('No members.');
    ui.raw(chalk.bold('\n  EMAIL                          STATUS     KEY   LAST SYNC'));
    for (const u of res.users) {
      const status = u.status === 'active' ? chalk.green(u.status) : chalk.yellow(u.status);
      ui.raw(`  ${u.email.padEnd(30)} ${status.padEnd(19)} v${String(u.keyVersion).padEnd(3)} ${fmtTime(u.lastSyncAt)}`);
    }
    ui.raw('');
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}
