// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Variable Editor Component
// Core component for viewing and editing encrypted environment variables.
// Features: inline editing, secret reveal with timer, copy, pin, tags.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pin,
  Star,
  MoreHorizontal,
  Loader2,
  Lock,
  Timer,
  Shield,
  Pencil,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  EmptyState,
  LoadingTableSkeleton,
  Badge,
} from '../../../components/ui/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { variableRepository } from '../../../services/firestore';
import {
  encrypt,
  decrypt,
  generateFingerprint,
  getMasterKey,
  unwrapDEK,
} from '../../../services/crypto/encryption';
import { logAuditEvent, createAuditContext } from '../../../services/audit/audit-service';
import { useAuthStore } from '../../auth/store/authStore';
import { cn } from '../../../lib/utils';
import type { Project, Environment, Variable, DecryptedVariable } from '../../../types';

// ── Constants ───────────────────────────────────────────────────────────────

const REVEAL_TIMEOUT_SECONDS = 10;
const CLIPBOARD_TIMEOUT_SECONDS = 30;

// ── Props ───────────────────────────────────────────────────────────────────

interface VariableEditorProps {
  project: Project;
  environment: Environment;
}

export const VariableEditor = ({ project, environment }: VariableEditorProps) => {
  const [search, setSearch] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Map<string, string>>(new Map());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const queryClient = useQueryClient();
  const { user, activeOrganization, can } = useAuthStore();
  const revealTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const canCreate = can('variables.create');
  const canUpdate = can('variables.update');
  const canDelete = can('variables.delete');
  const canReveal = can('variables.reveal');
  const canExport = can('variables.export');

  // ── Fetch Variables ─────────────────────────────────────────────────────

  const { data: variables, isLoading, error } = useQuery({
    queryKey: ['variables', project.id, environment.id],
    queryFn: () => variableRepository.getByEnvironment(project.id, environment.id),
    enabled: !!project.id && !!environment.id,
  });

  // ── Crypto Helpers ────────────────────────────────────────────────────

  const getProjectDEK = useCallback(async () => {
    if (!user || !project.encryptedDEK || !project.dekIV) {
      throw new Error('Project encryption key not found');
    }
    const masterKey = await getMasterKey(user.uid);
    return unwrapDEK(project.encryptedDEK, project.dekIV, masterKey);
  }, [user, project.encryptedDEK, project.dekIV]);

  // ── Create Variable ─────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');

      const dek = await getProjectDEK();
      const encrypted = await encrypt(value, dek);
      const fingerprint = await generateFingerprint(value);

      const variable: Omit<Variable, 'id'> = {
        projectId: project.id,
        environmentId: environment.id,
        organizationId: activeOrganization.id,
        key: key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        encryptedValue: encrypted.ciphertext,
        iv: encrypted.iv,
        fingerprint,
        algorithm: 'AES-256-GCM',
        visibility: 'secret',
        secretType: 'generic',
        isPinned: false,
        isFavorite: false,
        version: 1,
        revealCount: 0,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await variableRepository.create(variable);

      await logAuditEvent(
        createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
        'variable.created',
        { variableKey: key, environmentName: environment.name },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variable created.');
      setNewKey('');
      setNewValue('');
      setIsAddingNew(false);
    },
    onError: () => toast.error('Failed to create variable.'),
  });

  // ── Update Variable ─────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async ({ variableId, value }: { variableId: string; value: string }) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');

      const dek = await getProjectDEK();
      const encrypted = await encrypt(value, dek);
      const fingerprint = await generateFingerprint(value);

      const variable = variables?.find((v) => v.id === variableId);
      if (!variable) throw new Error('Variable not found');

      await variableRepository.update(variableId, {
        encryptedValue: encrypted.ciphertext,
        iv: encrypted.iv,
        fingerprint,
        version: variable.version + 1,
        updatedBy: user.uid,
        updatedAt: Date.now(),
      } as Partial<Variable>);

      await logAuditEvent(
        createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
        'variable.updated',
        { variableKey: variable.key, environmentName: environment.name },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variable updated.');
      setEditingId(null);
      setEditValue('');
    },
    onError: () => toast.error('Failed to update variable.'),
  });

  // ── Delete Variable ─────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (variableId: string) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      const variable = variables?.find((v) => v.id === variableId);
      await variableRepository.softDelete(variableId, user.uid);
      await logAuditEvent(
        createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
        'variable.deleted',
        { variableKey: variable?.key },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variable deleted.');
    },
    onError: () => toast.error('Failed to delete variable.'),
  });

  // ── Reveal Secret ─────────────────────────────────────────────────────

  const handleReveal = useCallback(async (variable: Variable) => {
    if (!canReveal) {
      toast.error('You do not have permission to reveal secrets.');
      return;
    }

    if (revealedIds.has(variable.id)) {
      // Hide it
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.delete(variable.id);
        return next;
      });
      setDecryptedValues((prev) => {
        const next = new Map(prev);
        next.delete(variable.id);
        return next;
      });
      const timer = revealTimers.current.get(variable.id);
      if (timer) clearTimeout(timer);
      revealTimers.current.delete(variable.id);
      return;
    }

    try {
      const dek = await getProjectDEK();
      const plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);

      setDecryptedValues((prev) => new Map(prev).set(variable.id, plaintext));
      setRevealedIds((prev) => new Set(prev).add(variable.id));

      // Auto-hide after timeout
      const timer = setTimeout(() => {
        setRevealedIds((prev) => {
          const next = new Set(prev);
          next.delete(variable.id);
          return next;
        });
        setDecryptedValues((prev) => {
          const next = new Map(prev);
          next.delete(variable.id);
          return next;
        });
        revealTimers.current.delete(variable.id);
      }, REVEAL_TIMEOUT_SECONDS * 1000);

      revealTimers.current.set(variable.id, timer);

      // Audit the reveal
      if (user && activeOrganization) {
        logAuditEvent(
          createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
          'variable.revealed',
          { variableKey: variable.key },
        );
      }
    } catch {
      toast.error('Failed to decrypt variable.');
    }
  }, [canReveal, revealedIds, getProjectDEK, user, activeOrganization, project.id, environment.id]);

  // ── Copy to Clipboard ─────────────────────────────────────────────────

  const handleCopy = useCallback(async (variable: Variable, type: 'key' | 'value') => {
    if (type === 'value' && !canReveal) {
      toast.error('You do not have permission to copy secret values.');
      return;
    }

    try {
      let textToCopy: string;
      if (type === 'key') {
        textToCopy = variable.key;
      } else {
        // Need to decrypt first
        let plaintext = decryptedValues.get(variable.id);
        if (!plaintext) {
          const dek = await getProjectDEK();
          plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);
        }
        textToCopy = plaintext;
      }

      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${type === 'key' ? 'Key' : 'Value'} copied.`, { duration: 1500 });

      // Clipboard protection: clear after timeout
      if (type === 'value') {
        setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, CLIPBOARD_TIMEOUT_SECONDS * 1000);

        if (user && activeOrganization) {
          logAuditEvent(
            createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
            'variable.copied',
            { variableKey: variable.key, copyType: type },
          );
        }
      }
    } catch {
      toast.error('Failed to copy.');
    }
  }, [canReveal, decryptedValues, getProjectDEK, user, activeOrganization, project.id, environment.id]);

  // ── Import / Export ───────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      let imported = 0;
      
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2]?.trim() || '';
          
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }

          if (!variables?.some(v => v.key === key)) {
            createMutation.mutate({ key, value });
            imported++;
          }
        }
      }
      
      if (imported > 0) {
        toast.success(`Importing ${imported} variables...`);
      } else {
        toast.success('No new variables to import.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    if (!variables || variables.length === 0 || !canExport) return;
    
    const loadingToast = toast.loading('Decrypting for export...');
    try {
      const dek = await getProjectDEK();
      
      let envContent = `# Exported from EnvVault - ${project.name} (${environment.name})\n`;
      envContent += `# Date: ${new Date().toISOString()}\n\n`;

      for (const variable of variables) {
        const plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);
        const formattedValue = /[\\s='"]/.test(plaintext) ? `"${plaintext.replace(/"/g, '\\"')}"` : plaintext;
        envContent += `${variable.key}=${formattedValue}\n`;
      }

      const blob = new Blob([envContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `.env.${environment.name.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Export completed.', { id: loadingToast });
      
      if (user && activeOrganization) {
        logAuditEvent(
          createAuditContext(activeOrganization.id, user.uid, user.email, user.name, project.id, environment.id),
          'export.completed',
          { environmentName: environment.name },
        );
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to export variables.', { id: loadingToast });
    }
  };

  // ── Toggle Pin ────────────────────────────────────────────────────────

  const togglePinMutation = useMutation({
    mutationFn: async (variable: Variable) => {
      await variableRepository.update(variable.id, {
        isPinned: !variable.isPinned,
        updatedAt: Date.now(),
      } as Partial<Variable>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
    },
  });

  // ── Cleanup timers on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      revealTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // ── Filter & Sort ─────────────────────────────────────────────────────

  const filteredVariables = (variables ?? []).filter((v) => {
    const q = search.toLowerCase();
    return (
      v.key.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q) ||
      v.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Sort: pinned first, then alphabetical
  const sortedVariables = [...filteredVariables].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.key.localeCompare(b.key);
  });

  // ── Partial Reveal (masking) ──────────────────────────────────────────

  const getMaskedValue = (variable: Variable): string => {
    if (revealedIds.has(variable.id)) {
      return decryptedValues.get(variable.id) || '••••••••';
    }
    return '••••••••••••••••';
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".env, .txt, *.*" 
                className="hidden" 
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} className="mr-2" />
                Import
              </Button>
            </>
          )}
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={variables?.length === 0}>
              <Download size={14} className="mr-2" />
              Export
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setIsAddingNew(true)}>
              <Plus size={14} className="mr-2" />
              Add Variable
            </Button>
          )}
        </div>
      </div>

      {/* Encryption status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
        <Shield size={14} className="text-emerald-500 shrink-0" />
        <span>
          Variables are encrypted with <strong>AES-256-GCM</strong>. Values auto-hide after {REVEAL_TIMEOUT_SECONDS}s. Clipboard clears after {CLIPBOARD_TIMEOUT_SECONDS}s.
        </span>
      </div>

      {/* Add New Variable Form */}
      <AnimatePresence>
        {isAddingNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-card border border-emerald-500/20 rounded-lg p-3">
              <Input
                placeholder="VARIABLE_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                className="font-mono text-sm flex-1"
                autoFocus
              />
              <Input
                placeholder="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                type="password"
                className="font-mono text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newKey.trim()) return toast.error('Key is required.');
                  if (!newValue.trim()) return toast.error('Value is required.');
                  createMutation.mutate({ key: newKey, value: newValue });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsAddingNew(false); setNewKey(''); setNewValue(''); }}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variable List */}
      {isLoading ? (
        <LoadingTableSkeleton rows={5} />
      ) : error ? (
        <div className="text-center py-8 text-destructive text-sm">Failed to load variables.</div>
      ) : sortedVariables.length === 0 ? (
        <EmptyState
          icon={<Lock size={24} className="text-muted-foreground" />}
          title={search ? 'No matching variables' : 'No variables yet'}
          description={
            search
              ? 'Try a different search term.'
              : `Add your first environment variable to ${environment.name}.`
          }
          action={
            canCreate && !search
              ? { label: 'Add Variable', onClick: () => setIsAddingNew(true) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {sortedVariables.map((variable) => {
            const isRevealed = revealedIds.has(variable.id);

            return (
              <motion.div
                key={variable.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-border/80',
                  variable.isPinned ? 'border-emerald-500/20' : 'border-border',
                )}
              >
                {/* Pin Indicator */}
                {variable.isPinned && (
                  <Pin size={12} className="text-emerald-500 shrink-0 -rotate-45" />
                )}

                {/* Key */}
                <div className="w-1/3 min-w-0">
                  <span className="font-mono text-sm font-medium text-foreground truncate block">
                    {variable.key}
                  </span>
                  {variable.description && (
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {variable.description}
                    </span>
                  )}
                </div>

                {/* Value */}
                <div className="flex-1 min-w-0 relative">
                  {editingId === variable.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="New value..."
                        className="h-7 text-sm font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateMutation.mutate({ variableId: variable.id, value: editValue });
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-emerald-500 hover:text-emerald-400"
                        onClick={() => updateMutation.mutate({ variableId: variable.id, value: editValue })}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <span className={cn(
                      'font-mono text-sm truncate block',
                      isRevealed ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {getMaskedValue(variable)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Edit */}
                  {canUpdate && editingId !== variable.id && (
                    <button
                      onClick={async () => {
                        try {
                          const dek = await getProjectDEK();
                          const plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);
                          setEditValue(plaintext);
                          setEditingId(variable.id);
                        } catch {
                          toast.error('Failed to decrypt variable for editing.');
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit value"
                    >
                      <Pencil size={14} />
                      <span className="text-[10px] uppercase font-bold ml-1">Edit</span>
                    </button>
                  )}

                  {/* Reveal */}
                  <button
                    onClick={() => handleReveal(variable)}
                    disabled={!canReveal}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title={isRevealed ? 'Hide' : `Reveal for ${REVEAL_TIMEOUT_SECONDS}s`}
                  >
                    {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  {/* Copy Key */}
                  <button
                    onClick={() => handleCopy(variable, 'key')}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy key"
                  >
                    <Copy size={14} />
                  </button>

                  {/* Copy Value */}
                  <button
                    onClick={() => handleCopy(variable, 'value')}
                    disabled={!canReveal}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-emerald-500 transition-colors"
                    title="Copy value"
                  >
                    <Lock size={14} />
                  </button>

                  {/* More */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                      <MoreHorizontal size={14} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => togglePinMutation.mutate(variable)}>
                        <Pin size={14} className="mr-2" />
                        {variable.isPinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(variable.id)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      {variables && variables.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>{variables.length} variable{variables.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1">
            <Lock size={10} /> AES-256-GCM encrypted
          </span>
        </div>
      )}
    </div>
  );
};
