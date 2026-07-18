// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Variable Editor Component
// Core component for viewing and editing encrypted environment variables.
// Features: inline editing, secret reveal with timer, copy, pin, tags,
// version history + rollback, secret generator, bulk ops, env compare, health.
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
  MoreHorizontal,
  Loader2,
  Lock,
  Shield,
  Pencil,
  Wand2,
  History,
  GitCompare,
  Tag,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  EmptyState,
  LoadingTableSkeleton,
} from '../../../components/ui/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { variableRepository, versionRepository } from '../../../services/firestore';
import {
  encrypt,
  decrypt,
  generateFingerprint,
  getMasterKey,
  unwrapDEK,
} from '../../../services/crypto/encryption';
import { logAuditEvent, createAuditContext } from '../../../services/audit/audit-service';
import { ensureReauthenticated, isReauthFresh } from '../../../services/auth/reauth-service';
import { isSensitiveEnvironment } from '../../auth/services/environment-access';
import { useAuthStore } from '../../auth/store/authStore';
import { cn } from '../../../lib/utils';
import { getCategory } from '../../../constants/variableCategories.constants';
import type {
  Project,
  Environment,
  Variable,
  VariableVersion,
} from '../../../types';
import { SecretGeneratorDialog } from './SecretGeneratorDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { EnvironmentCompareDialog } from './EnvironmentCompareDialog';
import { HealthScoreCard } from './HealthScoreCard';
import { TagEditor } from './TagEditor';

// ── Constants ───────────────────────────────────────────────────────────────

const REVEAL_TIMEOUT_SECONDS = 10;
const CLIPBOARD_TIMEOUT_SECONDS = 30;

// ── Props ───────────────────────────────────────────────────────────────────

interface VariableEditorProps {
  project: Project;
  environment: Environment;
  environments?: Environment[];
}

export const VariableEditor = ({ project, environment, environments = [] }: VariableEditorProps) => {
  const [search, setSearch] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Map<string, string>>(new Map());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatorTarget, setGeneratorTarget] = useState<'new' | 'edit' | null>(null);
  const [historyVariable, setHistoryVariable] = useState<Variable | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user, activeOrganization, can, canAccessEnv } = useAuthStore();
  const revealTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ── Environment-level access gate ───────────────────────────────────────
  // Sensitive tiers (production/staging) are restricted to cleared roles even
  // if the org-wide permission is granted.
  const isSensitive = isSensitiveEnvironment(environment.type);
  const hasEnvAccess = canAccessEnv(environment.type);
  const requiresReauth =
    isSensitive && (activeOrganization?.security?.requireReauthForReveal ?? true);

  const canCreate = can('variables.create') && hasEnvAccess;
  const canUpdate = can('variables.update') && hasEnvAccess;
  const canDelete = can('variables.delete') && hasEnvAccess;
  const canReveal = can('variables.reveal') && hasEnvAccess;
  const canExport = can('variables.export') && hasEnvAccess;

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

  const decryptWithDEK = useCallback(
    async (ciphertext: string, iv: string) => {
      const dek = await getProjectDEK();
      return decrypt(ciphertext, iv, dek);
    },
    [getProjectDEK],
  );

  const auditCtx = useCallback(
    () =>
      createAuditContext(
        activeOrganization!.id,
        user!.uid,
        user!.email,
        user!.name,
        project.id,
        environment.id,
      ),
    [activeOrganization, user, project.id, environment.id],
  );

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
        category: 'general',
        tags: [],
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

      await logAuditEvent(auditCtx(), 'variable.created', {
        variableKey: key,
        environmentName: environment.name,
      });
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

  // ── Update Variable (records a version) ──────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async ({ variableId, value }: { variableId: string; value: string }) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');

      const previous = variables?.find((v) => v.id === variableId);
      if (!previous) throw new Error('Variable not found');

      const dek = await getProjectDEK();
      const encrypted = await encrypt(value, dek);
      const fingerprint = await generateFingerprint(value);
      const nextVersion = previous.version + 1;

      await variableRepository.update(variableId, {
        encryptedValue: encrypted.ciphertext,
        iv: encrypted.iv,
        fingerprint,
        version: nextVersion,
        updatedBy: user.uid,
        updatedAt: Date.now(),
      } as Partial<Variable>);

      // Immutable history entry
      await versionRepository.recordChange(
        previous,
        { encryptedValue: encrypted.ciphertext, iv: encrypted.iv, fingerprint, version: nextVersion },
        { userId: user.uid, userEmail: user.email },
        'Edited value',
      );

      await logAuditEvent(auditCtx(), 'variable.updated', {
        variableKey: previous.key,
        environmentName: environment.name,
        version: nextVersion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variable updated.');
      setEditingId(null);
      setEditValue('');
    },
    onError: () => toast.error('Failed to update variable.'),
  });

  // ── Rollback to a historical value ───────────────────────────────────────

  const rollbackMutation = useMutation({
    mutationFn: async (version: VariableVersion) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      const current = variables?.find((v) => v.id === version.variableId);
      if (!current) throw new Error('Variable not found');

      const nextVersion = current.version + 1;

      await variableRepository.update(current.id, {
        encryptedValue: version.oldEncryptedValue,
        iv: version.oldIV,
        fingerprint: version.oldFingerprint,
        version: nextVersion,
        updatedBy: user.uid,
        updatedAt: Date.now(),
      } as Partial<Variable>);

      await versionRepository.recordChange(
        current,
        {
          encryptedValue: version.oldEncryptedValue,
          iv: version.oldIV,
          fingerprint: version.oldFingerprint,
          version: nextVersion,
        },
        { userId: user.uid, userEmail: user.email },
        `Rolled back to v${version.version}`,
      );

      await logAuditEvent(auditCtx(), 'variable.rollback', {
        variableKey: current.key,
        toVersion: version.version,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      toast.success('Value restored.');
      setHistoryVariable(null);
    },
    onError: () => toast.error('Failed to roll back.'),
  });

  // ── Delete Variable ─────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (variableId: string) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      const variable = variables?.find((v) => v.id === variableId);
      await variableRepository.softDelete(variableId, user.uid);
      await logAuditEvent(auditCtx(), 'variable.deleted', { variableKey: variable?.key });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variable deleted.');
    },
    onError: () => toast.error('Failed to delete variable.'),
  });

  // ── Bulk Delete ──────────────────────────────────────────────────────────

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user || !activeOrganization) throw new Error('Not authenticated');
      await variableRepository.bulkDelete(ids, user.uid);
      await logAuditEvent(auditCtx(), 'variable.deleted', {
        count: ids.length,
        environmentName: environment.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Variables deleted.');
      setSelectedIds(new Set());
    },
    onError: () => toast.error('Failed to delete variables.'),
  });

  // ── Update Tags & Category ───────────────────────────────────────────────

  const tagMutation = useMutation({
    mutationFn: async ({ id, tags, category }: { id: string; tags: string[]; category: string }) => {
      await variableRepository.update(id, { tags, category, updatedAt: Date.now() } as Partial<Variable>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', project.id, environment.id] });
      toast.success('Tags updated.');
      setTaggingId(null);
    },
    onError: () => toast.error('Failed to update tags.'),
  });

  // ── Reveal Secret ─────────────────────────────────────────────────────

  const handleReveal = useCallback(async (variable: Variable) => {
    if (!canReveal) {
      toast.error('You do not have permission to reveal secrets.');
      return;
    }

    if (revealedIds.has(variable.id)) {
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
      if (requiresReauth) {
        await ensureReauthenticated(
          auditCtx(),
          `reveal ${environment.name} secret`,
        );
      }

      const dek = await getProjectDEK();
      const plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);

      setDecryptedValues((prev) => new Map(prev).set(variable.id, plaintext));
      setRevealedIds((prev) => new Set(prev).add(variable.id));

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

      if (user && activeOrganization) {
        logAuditEvent(auditCtx(), 'variable.revealed', { variableKey: variable.key });
      }
    } catch (err) {
      if (requiresReauth && !isReauthFresh()) {
        toast.error('Re-authentication required to reveal production secrets.');
      } else {
        toast.error('Failed to decrypt variable.');
      }
    }
  }, [canReveal, revealedIds, getProjectDEK, user, activeOrganization, auditCtx, requiresReauth, environment.name]);

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
        if (requiresReauth) {
          await ensureReauthenticated(auditCtx(), `copy ${environment.name} secret`);
        }
        let plaintext = decryptedValues.get(variable.id);
        if (!plaintext) {
          const dek = await getProjectDEK();
          plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);
        }
        textToCopy = plaintext;
      }

      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${type === 'key' ? 'Key' : 'Value'} copied.`, { duration: 1500 });

      if (type === 'value') {
        setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, CLIPBOARD_TIMEOUT_SECONDS * 1000);

        if (user && activeOrganization) {
          logAuditEvent(auditCtx(), 'variable.copied', { variableKey: variable.key, copyType: type });
        }
      }
    } catch {
      toast.error('Failed to copy.');
    }
  }, [canReveal, decryptedValues, getProjectDEK, user, activeOrganization, auditCtx, requiresReauth, environment.name]);

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

          if (!variables?.some((v) => v.key === key)) {
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

  const exportVariables = async (subset?: Variable[]) => {
    const list = subset ?? variables;
    if (!list || list.length === 0 || !canExport) return;

    const loadingToast = toast.loading('Decrypting for export...');
    try {
      const dek = await getProjectDEK();

      let envContent = `# Exported from EnvVault - ${project.name} (${environment.name})\n`;
      envContent += `# Date: ${new Date().toISOString()}\n\n`;

      for (const variable of list) {
        const plaintext = await decrypt(variable.encryptedValue, variable.iv, dek);
        const formattedValue = /[\s='"]/.test(plaintext) ? `"${plaintext.replace(/"/g, '\\"')}"` : plaintext;
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
        logAuditEvent(auditCtx(), 'export.completed', {
          environmentName: environment.name,
          count: list.length,
        });
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

  // ── Selection helpers ──────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Cleanup timers on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      revealTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Clear selection when environment changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [environment.id]);

  // ── Filter & Sort ─────────────────────────────────────────────────────

  const filteredVariables = (variables ?? []).filter((v) => {
    const q = search.toLowerCase();
    return (
      v.key.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q) ||
      v.category?.toLowerCase().includes(q) ||
      v.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const sortedVariables = [...filteredVariables].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.key.localeCompare(b.key);
  });

  const allSelected = sortedVariables.length > 0 && sortedVariables.every((v) => selectedIds.has(v.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedVariables.map((v) => v.id)));
  };

  const getMaskedValue = (variable: Variable): string => {
    if (revealedIds.has(variable.id)) {
      return decryptedValues.get(variable.id) || '••••••••';
    }
    return '••••••••••••••••';
  };

  // ── Render ────────────────────────────────────────────────────────────

  // Environment-level lockout: role not cleared for this sensitive tier.
  if (!hasEnvAccess) {
    return (
      <EmptyState
        icon={<Lock size={24} className="text-amber-500" />}
        title={`${environment.name} is restricted`}
        description={`Your role doesn't have access to ${environment.type} secrets. Contact an owner or admin if you need production access.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sensitive environment notice */}
      {isSensitive && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg px-3 py-2">
          <Shield size={14} className="shrink-0" />
          <span>
            <strong className="uppercase">{environment.type}</strong> environment.
            {requiresReauth
              ? ' Revealing or copying a secret requires Google re-authentication.'
              : ' Handle these secrets with care.'}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {environments.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setCompareOpen(true)}>
              <GitCompare size={14} className="mr-2" />
              Compare
            </Button>
          )}
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => setGeneratorTarget('new')}>
              <Wand2 size={14} className="mr-2" />
              Generate
            </Button>
          )}
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
            <Button variant="outline" size="sm" onClick={() => exportVariables()} disabled={variables?.length === 0}>
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

      {/* Config Health Score */}
      {variables && <HealthScoreCard variables={variables} />}

      {/* Encryption status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
        <Shield size={14} className="text-emerald-500 shrink-0" />
        <span>
          Variables are encrypted with <strong>AES-256-GCM</strong>. Values auto-hide after {REVEAL_TIMEOUT_SECONDS}s. Clipboard clears after {CLIPBOARD_TIMEOUT_SECONDS}s.
        </span>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
          >
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              {canExport && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportVariables((variables ?? []).filter((v) => selectedIds.has(v.id)))}
                >
                  <Download size={14} className="mr-2" /> Export
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedIds.size} variables?`)) {
                      bulkDeleteMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <Trash2 size={14} className="mr-2" />
                  )}
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X size={14} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <Button size="icon-sm" variant="outline" onClick={() => setGeneratorTarget('new')} title="Generate secret">
                <Wand2 size={14} />
              </Button>
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

      {/* Select-all row */}
      {sortedVariables.length > 0 && (
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground pl-1"
        >
          {allSelected ? <CheckSquare size={14} className="text-emerald-500" /> : <Square size={14} />}
          Select all
        </button>
      )}

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
            const isSelected = selectedIds.has(variable.id);
            const category = getCategory(variable.category);

            return (
              <motion.div
                key={variable.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'group rounded-lg border bg-card p-3 transition-all hover:border-border/80',
                  isSelected ? 'border-emerald-500/40 bg-emerald-500/5' : variable.isPinned ? 'border-emerald-500/20' : 'border-border',
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(variable.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {isSelected ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} />}
                  </button>

                  {/* Pin Indicator */}
                  {variable.isPinned && (
                    <Pin size={12} className="text-emerald-500 shrink-0 -rotate-45" />
                  )}

                  {/* Key + meta */}
                  <div className="w-1/3 min-w-0">
                    <span className="font-mono text-sm font-medium text-foreground truncate block">
                      {variable.key}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium uppercase', category.color)}>
                        {category.label}
                      </span>
                      {variable.tags?.map((t) => (
                        <span key={t} className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{t}
                        </span>
                      ))}
                    </div>
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
                        <Button size="icon-sm" variant="outline" onClick={() => setGeneratorTarget('edit')} title="Generate">
                          <Wand2 size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-emerald-500 hover:text-emerald-400"
                          onClick={() => updateMutation.mutate({ variableId: variable.id, value: editValue })}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>
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
                      </button>
                    )}

                    <button
                      onClick={() => handleReveal(variable)}
                      disabled={!canReveal}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title={isRevealed ? 'Hide' : `Reveal for ${REVEAL_TIMEOUT_SECONDS}s`}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    <button
                      onClick={() => handleCopy(variable, 'key')}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy key"
                    >
                      <Copy size={14} />
                    </button>

                    <button
                      onClick={() => handleCopy(variable, 'value')}
                      disabled={!canReveal}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-emerald-500 transition-colors"
                      title="Copy value"
                    >
                      <Lock size={14} />
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                        <MoreHorizontal size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setHistoryVariable(variable)}>
                          <History size={14} className="mr-2" />
                          Version history
                        </DropdownMenuItem>
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => setTaggingId(variable.id)}>
                            <Tag size={14} className="mr-2" />
                            Edit tags
                          </DropdownMenuItem>
                        )}
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
                </div>

                {/* Inline tag editor */}
                <AnimatePresence>
                  {taggingId === variable.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <TagEditor
                        tags={variable.tags ?? []}
                        category={variable.category}
                        isSaving={tagMutation.isPending}
                        onCancel={() => setTaggingId(null)}
                        onSave={(tags, category) => tagMutation.mutate({ id: variable.id, tags, category })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
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

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      <SecretGeneratorDialog
        open={generatorTarget !== null}
        onOpenChange={(o) => !o && setGeneratorTarget(null)}
        onUse={(val) => {
          if (generatorTarget === 'edit') setEditValue(val);
          else {
            setIsAddingNew(true);
            setNewValue(val);
          }
        }}
      />

      <VersionHistoryDialog
        open={historyVariable !== null}
        onOpenChange={(o) => !o && setHistoryVariable(null)}
        variable={historyVariable}
        decrypt={decryptWithDEK}
        onRollback={(v) => rollbackMutation.mutate(v)}
        isRollingBack={rollbackMutation.isPending}
        canRollback={canUpdate}
      />

      {environments.length > 1 && (
        <EnvironmentCompareDialog
          open={compareOpen}
          onOpenChange={setCompareOpen}
          project={project}
          sourceEnv={environment}
          environments={environments}
        />
      )}
    </div>
  );
};
