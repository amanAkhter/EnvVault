// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – auth commands: login, logout, whoami
// ─────────────────────────────────────────────────────────────────────────────

import ora from 'ora';
import { signInWithPassword, callFunction } from '../firebase.js';
import { generateUserKeypair } from '../crypto.js';
import { getSession, setSession, clearSession, getProjectConfig } from '../config.js';
import { requireSession } from '../session.js';
import { ui, prompt, promptHidden, fail } from '../ui.js';

interface RegisterKeyResult {
  ok: boolean;
  rotated: boolean;
}

export async function login(opts: { email?: string; organization?: string }): Promise<void> {
  const { apiKey, projectId } = getProjectConfig();
  if (!apiKey) {
    fail('No Firebase project configured. Set ENVVAULT_API_KEY or run "envvault config set --api-key <key> --app-id <id>".');
  }

  const email = opts.email ?? (await prompt('Email: '));
  const password = await promptHidden('Password: ');
  if (!email || !password) fail('Email and password are required.');

  const spinner = ora('Signing in…').start();
  try {
    const tokens = await signInWithPassword(email, password);

    // Generate an RSA keypair on first login; reuse the existing one otherwise.
    const existing = getSession();
    let publicKeyJwk: string;
    let privateKeyJwk: string;
    if (existing && existing.uid === tokens.uid && existing.privateKeyJwk) {
      publicKeyJwk = existing.publicKeyJwk;
      privateKeyJwk = existing.privateKeyJwk;
    } else {
      spinner.text = 'Generating encryption keypair…';
      const pair = await generateUserKeypair();
      publicKeyJwk = pair.publicKeyJwk;
      privateKeyJwk = pair.privateKeyJwk;
    }

    spinner.text = 'Registering public key…';
    const result = await callFunction<{ publicKeyJwk: string }, RegisterKeyResult>(
      'registerUserKey',
      tokens.idToken,
      { publicKeyJwk },
    );

    const organizationId = opts.organization ?? existing?.organizationId ?? `org_${tokens.uid}`;

    setSession({
      uid: tokens.uid,
      email: tokens.email,
      displayName: tokens.displayName,
      organizationId,
      refreshToken: tokens.refreshToken,
      privateKeyJwk,
      publicKeyJwk,
      loggedInAt: Date.now(),
    });

    spinner.succeed(`Logged in as ${tokens.email}`);
    ui.dim(`  Organization: ${organizationId}`);
    ui.dim(`  Project: ${projectId}`);
    if (result.rotated) {
      ui.warn('Public key was rotated. Ask an admin to re-grant your environment access.');
    }
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}

export async function logout(): Promise<void> {
  const session = getSession();
  clearSession();
  if (session) {
    ui.success(`Logged out ${session.email}.`);
  } else {
    ui.info('No active session.');
  }
}

export async function whoami(): Promise<void> {
  try {
    const { session } = await requireSession();
    ui.raw(`Logged in as ${session.email}`);
    if (session.displayName) ui.dim(`  Name: ${session.displayName}`);
    ui.dim(`  User ID: ${session.uid}`);
    ui.dim(`  Organization: ${session.organizationId}`);
    ui.dim(`  Since: ${new Date(session.loggedInAt).toISOString()}`);
  } catch (err) {
    fail((err as Error).message);
  }
}
