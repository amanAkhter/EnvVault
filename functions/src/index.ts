// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Cloud Functions entry point
// Barrel that re-exports every deployed function. Firebase deploys one function
// per exported symbol.
// ─────────────────────────────────────────────────────────────────────────────

import './config'; // ensure admin app initializes first

// Firestore triggers, reveal audit, expiry + notification fan-out.
export {
  onUserSignup,
  onVariableChange,
  onSecretReveal,
  cleanupExpiredSecrets,
  sendNotifications,
} from './triggers';

// Per-user key registry.
export { registerUserKey, getUserPublicKey } from './keys';

// CLI environment sync.
export { listEnvironments, fetchEnvironment, pushEnvironment } from './environments-sync';

// Admin environment lifecycle + membership.
export {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  addUserToEnvironment,
  removeUserFromEnvironment,
  listEnvironmentUsers,
  getEnvironmentRotationContext,
} from './environments-admin';

// Scheduled maintenance.
export { cleanupStaleSync } from './scheduled';

// Invitation email (Resend, server-side).
export { onInvitationCreated } from './email-invitations';

// CLI session management.
export { revokeCliSession } from './cli-sessions';
