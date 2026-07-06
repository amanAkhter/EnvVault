// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Global Type Definitions
// Production-grade types for the entire platform.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore';

// ── Utility Types ───────────────────────────────────────────────────────────

/** Firestore timestamps can arrive as either a Firestore Timestamp or a number (millis). */
export type FirestoreTimestamp = Timestamp | number;

/** Convert FirestoreTimestamp to millis safely. */
export const toMillis = (ts: FirestoreTimestamp): number =>
  typeof ts === 'number' ? ts : ts.toMillis();

// ── Permissions & RBAC ──────────────────────────────────────────────────────

export type Permission =
  // Organization
  | 'organizations.read'
  | 'organizations.update'
  | 'organizations.delete'
  // Projects
  | 'projects.create'
  | 'projects.read'
  | 'projects.update'
  | 'projects.delete'
  // Environments
  | 'environments.create'
  | 'environments.read'
  | 'environments.update'
  | 'environments.delete'
  // Variables
  | 'variables.create'
  | 'variables.read'
  | 'variables.update'
  | 'variables.delete'
  | 'variables.reveal'
  | 'variables.export'
  | 'variables.rotate'
  | 'variables.sync'
  // Import / Export
  | 'imports.preview'
  | 'imports.run'
  | 'exports.preview'
  | 'exports.run'
  // Audit
  | 'audit.read'
  // Members
  | 'members.invite'
  | 'members.update'
  | 'members.remove'
  // Roles
  | 'roles.read'
  | 'roles.manage'
  // Billing
  | 'billing.read'
  | 'billing.manage'
  // Integrations
  | 'integrations.read'
  | 'integrations.manage'
  // Notifications
  | 'notifications.read'
  // Settings
  | 'settings.manage';

export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'devops'
  | 'developer'
  | 'viewer'
  | 'auditor';

// ── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user' | 'owner' | 'developer' | 'viewer' | 'auditor' | 'devops';
  globalStatus?: 'active' | 'disabled';
  defaultOrganizationId?: string;
  createdAt?: number;
  updatedAt?: number;
  lastLoginAt?: number;
}

// ── Organization ────────────────────────────────────────────────────────────

export type BillingPlan = 'free' | 'team' | 'business' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

export interface OrganizationSecurity {
  requireReauthForReveal: boolean;
  sessionTimeoutMinutes: number;
  clipboardTimeoutSeconds: number;
  allowedIpRanges: string[];
}

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  slug: string;
  description?: string;
  website?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  billingPlanId: BillingPlan;
  status: OrganizationStatus;
  security?: OrganizationSecurity;
}

// ── Organization Member ─────────────────────────────────────────────────────

export type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roleIds: OrganizationRole[];
  effectivePermissions: Permission[];
  status: MemberStatus;
  joinedAt?: number;
  invitedBy?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'archived' | 'deleted';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  language?: string;
  framework?: string;
  repositoryUrl?: string;
  deploymentUrl?: string;
  status: ProjectStatus;
  ownerId?: string;
  /** Encrypted Data Encryption Key (DEK) for this project, base64 encoded */
  encryptedDEK?: string;
  /** IV used to encrypt the DEK */
  dekIV?: string;
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;

  // Legacy fields for backward compatibility
  hostedUrl?: string;
  githubUrl?: string;
  archived?: boolean;
  environments?: {
    development: { variables: LegacyEnvVariable[] };
    production: { variables: LegacyEnvVariable[] };
  };
}

/** Legacy variable shape (for backward compat with existing Firestore data) */
export interface LegacyEnvVariable {
  id: string;
  key: string;
  value: string;
  description: string;
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Environment ─────────────────────────────────────────────────────────────

export type EnvironmentType =
  | 'development'
  | 'testing'
  | 'qa'
  | 'staging'
  | 'production'
  | 'preview'
  | 'custom';

export interface Environment {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  slug: string;
  type: EnvironmentType;
  color: string;
  description?: string;
  order: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/** Default environment definitions for new projects */
export const DEFAULT_ENVIRONMENTS: Omit<Environment, 'id' | 'projectId' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Development', slug: 'development', type: 'development', color: '#10b981', order: 0 },
  { name: 'Staging',     slug: 'staging',     type: 'staging',     color: '#f59e0b', order: 1 },
  { name: 'Production',  slug: 'production',  type: 'production',  color: '#ef4444', order: 2 },
];

// ── Variable ────────────────────────────────────────────────────────────────

export type VariableVisibility = 'plain' | 'secret';

export type SecretType =
  | 'generic'
  | 'api_key'
  | 'database_url'
  | 'jwt_secret'
  | 'oauth_token'
  | 'ssh_key'
  | 'certificate'
  | 'password'
  | 'encryption_key'
  | 'webhook_secret';

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  lastRotatedAt?: number;
  nextRotationAt?: number;
  ownerId?: string;
}

export interface Variable {
  id: string;
  projectId: string;
  environmentId: string;
  organizationId: string;
  key: string;
  /** Encrypted value (base64 encoded ciphertext) */
  encryptedValue: string;
  /** IV used for this variable's encryption (base64) */
  iv: string;
  /** SHA-256 fingerprint of the plaintext value (for comparison without revealing) */
  fingerprint: string;
  /** Encryption algorithm used */
  algorithm: 'AES-256-GCM';
  description?: string;
  category?: string;
  tags?: string[];
  visibility: VariableVisibility;
  secretType: SecretType;
  expirationDate?: number | null;
  rotationPolicy?: RotationPolicy;
  notes?: string;
  isPinned: boolean;
  isFavorite: boolean;
  version: number;
  revealCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;

  // Soft delete
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

// ── Version (Variable History) ──────────────────────────────────────────────

export interface VariableVersion {
  id: string;
  variableId: string;
  projectId: string;
  environmentId: string;
  organizationId: string;
  version: number;
  /** Old encrypted value */
  oldEncryptedValue: string;
  oldIV: string;
  oldFingerprint: string;
  /** New encrypted value */
  newEncryptedValue: string;
  newIV: string;
  newFingerprint: string;
  reason?: string;
  userId: string;
  userEmail: string;
  timestamp: number;
}

// ── Audit Log ───────────────────────────────────────────────────────────────

export type AuditAction =
  // Variables
  | 'variable.created'
  | 'variable.updated'
  | 'variable.deleted'
  | 'variable.revealed'
  | 'variable.copied'
  | 'variable.exported'
  | 'variable.imported'
  | 'variable.rotated'
  | 'variable.rollback'
  // Projects
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.archived'
  // Environments
  | 'environment.created'
  | 'environment.updated'
  | 'environment.deleted'
  | 'environment.synced'
  // Organization
  | 'organization.created'
  | 'organization.updated'
  // Members
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  // Auth
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.reauthenticated'
  // Exports
  | 'export.completed'
  | 'import.completed';

export interface AuditLog {
  id: string;
  organizationId: string;
  projectId?: string;
  environmentId?: string;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  actorName?: string;
  /** Structured details about the action (never contains plaintext secrets) */
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

// ── Invitation ──────────────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  roleIds: OrganizationRole[];
  status: InvitationStatus;
  invitedBy: string;
  invitedByName: string;
  expiresAt: number;
  acceptedAt?: number;
  createdAt: number;
}

// ── Notification ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'secret_expiring'
  | 'secret_expired'
  | 'project_updated'
  | 'member_invited'
  | 'member_joined'
  | 'variable_changed'
  | 'import_completed'
  | 'security_alert';

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: number;
}

// ── UI State Types ──────────────────────────────────────────────────────────

/** Decrypted variable for the UI layer only – never persisted */
export interface DecryptedVariable extends Omit<Variable, 'encryptedValue' | 'iv'> {
  /** Plaintext value – only exists in memory */
  value: string;
  /** Whether the value is currently visible in the UI */
  isRevealed: boolean;
}

export interface EnvironmentComparisonResult {
  key: string;
  sourceValue?: string;
  targetValue?: string;
  sourceFingerprint?: string;
  targetFingerprint?: string;
  status: 'missing_in_source' | 'missing_in_target' | 'different' | 'identical';
}

// ── Configuration Health ────────────────────────────────────────────────────

export interface HealthCheckResult {
  score: number; // 0-100
  issues: HealthIssue[];
  lastCheckedAt: number;
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'missing' | 'duplicate' | 'expired' | 'weak' | 'invalid_key' | 'no_description';
  message: string;
  variableKey?: string;
  environmentId?: string;
}
