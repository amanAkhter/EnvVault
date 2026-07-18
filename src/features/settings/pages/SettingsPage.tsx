// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Settings Page
// Editable organization profile + security settings, user profile, CLI keys.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import {
  Settings,
  Shield,
  Lock,
  Clock,
  Clipboard,
  Globe,
  Building2,
  User as UserIcon,
  ScrollText,
  Save,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader, Badge } from '../../../components/ui/feedback';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { migrateLegacyProjects } from '../../../services/firestore/migration';
import {
  updateOrganizationProfile,
  updateOrganizationSecurity,
  updateUserProfile,
} from '../../../services/settings/settings-service';
import type { OrganizationSecurity } from '../../../types';
import { CliAccessSection } from '../components/CliAccessSection';

export const SettingsPage = () => {
  const { user, activeOrganization, setActiveOrganization, setUser, can } = useAuthStore();
  const canManageOrg = can('organizations.update');
  const canManageSettings = can('settings.manage') || canManageOrg;

  // ── Organization profile form ──────────────────────────────────────────────
  const [orgName, setOrgName] = useState(activeOrganization?.name ?? '');
  const [orgDescription, setOrgDescription] = useState(activeOrganization?.description ?? '');
  const [orgWebsite, setOrgWebsite] = useState(activeOrganization?.website ?? '');
  const [savingOrg, setSavingOrg] = useState(false);

  // ── Security settings ───────────────────────────────────────────────────────
  const security: OrganizationSecurity = activeOrganization?.security ?? {
    requireReauthForReveal: true,
    sessionTimeoutMinutes: 60,
    clipboardTimeoutSeconds: 30,
    allowedIpRanges: [],
    auditLoggingEnabled: true,
  };

  // ── User profile form ───────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profilePhoto, setProfilePhoto] = useState(user?.photoURL ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const orgDirty =
    orgName !== (activeOrganization?.name ?? '') ||
    orgDescription !== (activeOrganization?.description ?? '') ||
    orgWebsite !== (activeOrganization?.website ?? '');

  const profileDirty =
    profileName !== (user?.name ?? '') || profilePhoto !== (user?.photoURL ?? '');

  const saveOrg = async () => {
    if (!activeOrganization) return;
    if (!orgName.trim()) return toast.error('Workspace name cannot be empty.');
    setSavingOrg(true);
    try {
      await updateOrganizationProfile(activeOrganization.id, {
        name: orgName.trim(),
        description: orgDescription.trim(),
        website: orgWebsite.trim(),
      });
      setActiveOrganization({
        ...activeOrganization,
        name: orgName.trim(),
        description: orgDescription.trim(),
        website: orgWebsite.trim(),
      });
      toast.success('Organization updated.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update organization.');
    } finally {
      setSavingOrg(false);
    }
  };

  const toggleSecurity = async (patch: Partial<OrganizationSecurity>) => {
    if (!activeOrganization) return;
    try {
      const merged = await updateOrganizationSecurity(activeOrganization.id, patch);
      setActiveOrganization({ ...activeOrganization, security: merged });
      toast.success('Security settings updated.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update security settings.');
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!profileName.trim()) return toast.error('Name cannot be empty.');
    setSavingProfile(true);
    try {
      await updateUserProfile(user.uid, {
        name: profileName.trim(),
        photoURL: profilePhoto.trim(),
      });
      setUser({ ...user, name: profileName.trim(), photoURL: profilePhoto.trim() });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title="Settings" description="Configure your workspace, security, and profile." />

      {/* User Profile */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <UserIcon size={16} className="text-cyan-500" />
          <h2 className="text-sm font-semibold text-foreground">Your Profile</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Photo URL</Label>
            <Input value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveProfile} disabled={!profileDirty || savingProfile}>
              <Save size={14} className="mr-1.5" />
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </section>

      {/* Organization */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Building2 size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Organization</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label>Workspace Name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canManageOrg} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="What is this workspace for?"
              disabled={!canManageOrg}
            />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={orgWebsite}
              onChange={(e) => setOrgWebsite(e.target.value)}
              placeholder="https://…"
              disabled={!canManageOrg}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={activeOrganization?.slug || ''} disabled className="w-64" />
            </div>
            <Badge variant="success">{activeOrganization?.billingPlanId || 'free'}</Badge>
          </div>
          {canManageOrg && (
            <div className="flex justify-end">
              <Button size="sm" onClick={saveOrg} disabled={!orgDirty || savingOrg}>
                <Save size={14} className="mr-1.5" />
                {savingOrg ? 'Saving…' : 'Save Organization'}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Security Settings */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Shield size={16} className="text-emerald-500" />
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          <ToggleRow
            icon={<Lock size={16} className="text-muted-foreground" />}
            title="Require Re-authentication"
            description="Require re-auth before revealing production secrets"
            checked={security.requireReauthForReveal}
            disabled={!canManageSettings}
            onChange={(v) => toggleSecurity({ requireReauthForReveal: v })}
          />
          <hr className="border-border" />
          <ToggleRow
            icon={<ScrollText size={16} className="text-muted-foreground" />}
            title="Audit Logging"
            description="Record an immutable trail of actions in this organization"
            checked={security.auditLoggingEnabled !== false}
            disabled={!canManageSettings}
            onChange={(v) => toggleSecurity({ auditLoggingEnabled: v })}
          />
          <hr className="border-border" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">Auto-logout after period of inactivity</p>
              </div>
            </div>
            <Badge variant="outline">{security.sessionTimeoutMinutes} min</Badge>
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
            <Badge variant="outline">{security.clipboardTimeoutSeconds}s</Badge>
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
            <Badge variant={security.allowedIpRanges.length > 0 ? 'success' : 'outline'}>
              {security.allowedIpRanges.length > 0 ? `${security.allowedIpRanges.length} ranges` : 'All IPs'}
            </Badge>
          </div>
        </div>
      </section>

      {/* CLI Access & Encryption Keys */}
      <CliAccessSection />

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
              <p className="text-xs text-muted-foreground">
                Scan and migrate legacy v1 projects to the new v2 architecture with organization support and envelope
                encryption.
              </p>
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

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow = ({ icon, title, description, checked, disabled, onChange }: ToggleRowProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={title} />
  </div>
);
