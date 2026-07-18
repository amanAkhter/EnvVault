// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Secret Generator Dialog
// Cryptographically secure secret generation (Web Crypto API).
// Supports random strings, API keys, JWT secrets, and UUIDs.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Copy, Check, Wand2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  generateSecureRandom,
  generateAPIKey,
  generateJWTSecret,
  generateUUID,
} from '../../../services/crypto/encryption';
import { cn } from '../../../lib/utils';

type GenKind = 'random' | 'apiKey' | 'jwt' | 'uuid';

const KINDS: { id: GenKind; label: string }[] = [
  { id: 'random', label: 'Password' },
  { id: 'apiKey', label: 'API Key' },
  { id: 'jwt', label: 'JWT Secret' },
  { id: 'uuid', label: 'UUID' },
];

interface SecretGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user clicks "Use" — receives the generated secret. */
  onUse?: (value: string) => void;
}

export const SecretGeneratorDialog = ({
  open,
  onOpenChange,
  onUse,
}: SecretGeneratorDialogProps) => {
  const [kind, setKind] = useState<GenKind>('random');
  const [length, setLength] = useState(32);
  const [opts, setOpts] = useState({ lowercase: true, uppercase: true, digits: true, symbols: true });
  const [prefix, setPrefix] = useState('evk');
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    let out = '';
    switch (kind) {
      case 'random':
        out = generateSecureRandom(length, opts);
        break;
      case 'apiKey':
        out = generateAPIKey(prefix || 'evk');
        break;
      case 'jwt':
        out = generateJWTSecret(Math.max(32, Math.floor(length / 2)));
        break;
      case 'uuid':
        out = generateUUID();
        break;
    }
    setValue(out);
    setCopied(false);
  }, [kind, length, opts, prefix]);

  // Regenerate whenever the dialog opens or config changes.
  useEffect(() => {
    if (open) generate();
  }, [open, generate]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Secret copied.', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy.');
    }
  };

  const toggleOpt = (k: keyof typeof opts) =>
    setOpts((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={16} className="text-emerald-500" /> Secret Generator
          </DialogTitle>
          <DialogDescription>
            Generate cryptographically secure secrets locally. Nothing leaves your browser.
          </DialogDescription>
        </DialogHeader>

        {/* Kind selector */}
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                kind === k.id
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Options */}
        {kind === 'random' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Length</span>
                <span className="font-mono text-foreground">{length}</span>
              </div>
              <input
                type="range"
                min={8}
                max={128}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['lowercase', 'uppercase', 'digits', 'symbols'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => toggleOpt(k)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs border transition-colors capitalize',
                    opts[k]
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'apiKey' && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prefix</label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              className="font-mono text-sm h-8"
              placeholder="evk"
            />
          </div>
        )}

        {/* Output */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
            {value || '—'}
          </div>
          <Button size="icon-sm" variant="outline" onClick={generate} title="Regenerate">
            <RefreshCw size={14} />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={handleCopy} title="Copy">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </Button>
        </div>

        <DialogFooter showCloseButton>
          {onUse && (
            <Button
              onClick={() => {
                onUse(value);
                onOpenChange(false);
              }}
              disabled={!value}
            >
              Use secret
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
