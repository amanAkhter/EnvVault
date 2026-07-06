// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Settings Page
// Organization and security settings.
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthStore } from '../../auth/store/authStore';
import { Settings, Shield, Lock, Clock, Clipboard, Globe, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader, Badge } from '../../../components/ui/feedback';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { migrateLegacyProjects } from '../../../services/firestore/migration';

export const SettingsPage = () => {
  const { user, activeOrganization } = useAuthStore();

  const securitySettings = activeOrganization?.security ?? {
    requireReauthForReveal: true,
    sessionTimeoutMinutes: 60,
    clipboardTimeoutSeconds: 30,
    allowedIpRanges: [],
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Configure your workspace and security preferences."
      />

      {/* Organization */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Building2 size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Organization</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label>Workspace Name</Label>
            <Input value={activeOrganization?.name || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={activeOrganization?.slug || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Billing Plan</Label>
            <div className="flex items-center gap-2">
              <Badge variant="success">{activeOrganization?.billingPlanId || 'free'}</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Security Settings */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Shield size={16} className="text-emerald-500" />
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Require Re-authentication</p>
                <p className="text-xs text-muted-foreground">Require Google re-auth before revealing production secrets</p>
              </div>
            </div>
            <Badge variant={securitySettings.requireReauthForReveal ? 'success' : 'warning'}>
              {securitySettings.requireReauthForReveal ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          <hr className="border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-logout after period of inactivity</p>
              </div>
            </div>
            <Badge variant="outline">{securitySettings.sessionTimeoutMinutes} min</Badge>
          </div>

          <hr className="border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clipboard size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Clipboard Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-clear clipboard after copying secrets</p>
              </div>
            </div>
            <Badge variant="outline">{securitySettings.clipboardTimeoutSeconds}s</Badge>
          </div>

          <hr className="border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">IP Restrictions</p>
                <p className="text-xs text-muted-foreground">Restrict access to specific IP ranges</p>
              </div>
            </div>
            <Badge variant={securitySettings.allowedIpRanges.length > 0 ? 'success' : 'outline'}>
              {securitySettings.allowedIpRanges.length > 0
                ? `${securitySettings.allowedIpRanges.length} ranges`
                : 'All IPs'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Encryption Info */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Lock size={16} className="text-emerald-500" />
          <h2 className="text-sm font-semibold text-foreground">Encryption</h2>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Algorithm</span>
            <span className="font-mono text-foreground">AES-256-GCM</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Key Management</span>
            <span className="text-foreground">Per-project DEK with envelope encryption</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fingerprinting</span>
            <span className="font-mono text-foreground">SHA-256</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Crypto Engine</span>
            <span className="text-foreground">Web Crypto API (Browser-native)</span>
          </div>
        </div>
      </section>

      {/* Advanced / Migration */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Settings size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Advanced</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Migrate Legacy Projects</p>
              <p className="text-xs text-muted-foreground">Scan and migrate legacy v1 projects to the new v2 architecture with organization support and envelope encryption.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user || !activeOrganization) return;
                try {
                  const toastId = toast.loading('Migrating legacy projects...');
                  const count = await migrateLegacyProjects(user.uid, activeOrganization.id);
                  toast.success(`Successfully migrated ${count} project(s).`, { id: toastId });
                } catch (error) {
                  toast.error('Migration failed.');
                  console.error(error);
                }
              }}
            >
              Run Migration
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
