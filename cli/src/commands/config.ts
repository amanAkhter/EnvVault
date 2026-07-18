// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – config command: view/set Firebase project settings
// ─────────────────────────────────────────────────────────────────────────────

import { getProjectConfig, setProjectConfig } from '../config.js';
import { ui } from '../ui.js';

export function showConfig(): void {
  const cfg = getProjectConfig();
  ui.raw('EnvVault project configuration:');
  ui.dim(`  projectId:  ${cfg.projectId || '(unset)'}`);
  ui.dim(`  apiKey:     ${cfg.apiKey ? cfg.apiKey.slice(0, 8) + '…' : '(unset)'}`);
  ui.dim(`  authDomain: ${cfg.authDomain || '(unset)'}`);
  ui.dim(`  appId:      ${cfg.appId || '(unset)'}`);
  ui.dim(`  region:     ${cfg.region}`);
}

export function setConfig(opts: {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  region?: string;
}): void {
  const patch: Record<string, string> = {};
  if (opts.apiKey) patch.apiKey = opts.apiKey;
  if (opts.authDomain) patch.authDomain = opts.authDomain;
  if (opts.projectId) patch.projectId = opts.projectId;
  if (opts.appId) patch.appId = opts.appId;
  if (opts.region) patch.region = opts.region;
  if (Object.keys(patch).length === 0) {
    ui.warn('Nothing to set. Provide --api-key, --project-id, --app-id, --auth-domain, or --region.');
    return;
  }
  setProjectConfig(patch);
  ui.success('Configuration updated.');
  showConfig();
}
