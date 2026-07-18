// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Variable Category Presets
// Central source of truth for category chips used across the variable UI.
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryPreset {
  id: string;
  label: string;
  /** Tailwind classes for the category badge. */
  color: string;
}

export const VARIABLE_CATEGORIES: CategoryPreset[] = [
  { id: 'general',    label: 'General',    color: 'bg-slate-500/15 text-slate-400' },
  { id: 'database',   label: 'Database',   color: 'bg-blue-500/15 text-blue-400' },
  { id: 'auth',       label: 'Auth',       color: 'bg-violet-500/15 text-violet-400' },
  { id: 'api',        label: 'API',        color: 'bg-emerald-500/15 text-emerald-400' },
  { id: 'payment',    label: 'Payment',    color: 'bg-amber-500/15 text-amber-400' },
  { id: 'storage',    label: 'Storage',    color: 'bg-cyan-500/15 text-cyan-400' },
  { id: 'messaging',  label: 'Messaging',  color: 'bg-pink-500/15 text-pink-400' },
  { id: 'monitoring', label: 'Monitoring', color: 'bg-orange-500/15 text-orange-400' },
];

export const DEFAULT_CATEGORY_ID = 'general';

export const getCategory = (id?: string): CategoryPreset =>
  VARIABLE_CATEGORIES.find((c) => c.id === id) ?? VARIABLE_CATEGORIES[0];
