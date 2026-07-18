// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Inline Tag & Category Editor
// Manage a variable's tags and category without leaving the row.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  VARIABLE_CATEGORIES,
  DEFAULT_CATEGORY_ID,
} from '../../../constants/variableCategories.constants';
import { cn } from '../../../lib/utils';

interface TagEditorProps {
  tags: string[];
  category?: string;
  onSave: (tags: string[], category: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const TagEditor = ({ tags, category, onSave, onCancel, isSaving }: TagEditorProps) => {
  const [draft, setDraft] = useState<string[]>(tags ?? []);
  const [input, setInput] = useState('');
  const [cat, setCat] = useState(category ?? DEFAULT_CATEGORY_ID);

  const addTag = () => {
    const t = input.trim().toLowerCase();
    if (t && !draft.includes(t)) setDraft([...draft, t]);
    setInput('');
  };

  const removeTag = (t: string) => setDraft(draft.filter((x) => x !== t));

  return (
    <div className="w-full rounded-lg border border-emerald-500/20 bg-card p-3 space-y-3">
      {/* Category */}
      <div className="flex flex-wrap gap-1.5">
        {VARIABLE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[11px] font-medium transition-all',
              cat === c.id ? c.color + ' ring-1 ring-inset ring-current' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {draft.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono"
          >
            {t}
            <button onClick={() => removeTag(t)} className="hover:text-destructive">
              <X size={11} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              } else if (e.key === 'Escape') {
                onCancel();
              }
            }}
            placeholder="add tag..."
            className="h-6 w-24 text-[11px]"
          />
          <Button size="icon-xs" variant="ghost" onClick={addTag}>
            <Plus size={12} />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" onClick={() => onSave(draft, cat)} disabled={isSaving}>
          Save
        </Button>
      </div>
    </div>
  );
};
