// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – .env file format
// Reads/writes dotenv files with an EnvVault metadata header carrying sync time,
// expiry, key version, and a checksum so staleness can be enforced offline.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export interface EnvHeader {
  environment: string;
  environmentId: string;
  keyVersion: number;
  syncedAt: number;
  expiresAt: number;
  checksum: string;
}

export interface EnvFile {
  header?: EnvHeader;
  values: Record<string, string>;
}

const HEADER_PREFIX = '# ENVVAULT:';

/** Deterministic checksum over the sorted KEY=value pairs. */
export function checksumOf(values: Record<string, string>): string {
  const canonical = Object.keys(values)
    .sort()
    .map((k) => `${k}=${values[k]}`)
    .join('\n');
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

export function serializeEnv(
  values: Record<string, string>,
  meta: { environment: string; environmentId: string; keyVersion: number; syncedAt: number },
): string {
  const checksum = checksumOf(values);
  const expiresAt = meta.syncedAt + SYNC_TTL_MS;
  const header: EnvHeader = { ...meta, expiresAt, checksum };

  const lines = [
    '# ╔════════════════════════════════════════════════════════════╗',
    '# ║  ENVVAULT MANAGED FILE — DO NOT EDIT MANUALLY               ║',
    '# ╚════════════════════════════════════════════════════════════╝',
    `${HEADER_PREFIX}${JSON.stringify(header)}`,
    `# Environment: ${meta.environment}`,
    `# Synced:  ${new Date(meta.syncedAt).toISOString()}`,
    `# Expires: ${new Date(expiresAt).toISOString()}`,
    `# Key version: ${meta.keyVersion}`,
    '',
  ];
  for (const key of Object.keys(values).sort()) {
    lines.push(`${key}=${quoteIfNeeded(values[key])}`);
  }
  return lines.join('\n') + '\n';
}

function quoteIfNeeded(value: string): string {
  if (/[\s"'#=]/.test(value) || value === '') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return trimmed;
}

export function parseEnv(content: string): EnvFile {
  const values: Record<string, string> = {};
  let header: EnvHeader | undefined;

  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith(HEADER_PREFIX)) {
      try {
        header = JSON.parse(line.slice(HEADER_PREFIX.length)) as EnvHeader;
      } catch {
        /* ignore malformed header */
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    values[key] = unquote(trimmed.slice(eq + 1));
  }
  return { header, values };
}

export function isExpired(header: EnvHeader | undefined): boolean {
  if (!header) return true;
  return Date.now() > header.expiresAt;
}
