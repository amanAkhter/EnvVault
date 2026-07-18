# EnvVault — Security Guide

EnvVault treats all data as highly sensitive. This document describes the
threat model, encryption design, access controls, and known trade-offs.

## 1. Threat Model

| Threat | Mitigation |
|--------|-----------|
| Firestore breach / at-rest exposure | Values stored as AES-256-GCM ciphertext; DEK wrapped by a master key never persisted in plaintext |
| Plaintext leaking to server | Encryption/decryption happen only in the browser; rules reject any variable write containing a `value` field |
| Cross-tenant access | Every rule gates on `organizationMembers/${orgId}_${uid}` membership + permission |
| Privilege escalation | `effectivePermissions` immutable on member self-update; owner role can't be self-assigned via invite |
| Production secret exposure to low-priv roles | Environment-level RBAC (owner/admin/devops only) in UI, store, and rules |
| Session hijack via idle machine | Inactivity auto-logout + step-up reauth for prod reveals |
| History/audit tampering | `versions` + `auditLogs` are append-only; actor pinned to `request.auth.uid` |
| Secret lingering in clipboard | Clipboard auto-cleared 30s after copy; reveal auto-hides after 10s |

## 2. Encryption

- **Algorithm:** AES-256-GCM (Web Crypto API).
- **Envelope:** per-project Data Encryption Key (DEK), wrapped by a per-user
  master key; only the wrapped DEK (`encryptedDEK` + `dekIV`) is stored.
- **Master key (V1):** `PBKDF2(userUid, APP_SALT)`. Deterministic from the UID
  — pragmatic for V1, **not** true zero-knowledge. Production must replace
  `getMasterKey()` with Cloud KMS / HSM-backed key material.
- **Fingerprints:** SHA-256 of plaintext, used for environment diff and
  duplicate detection without ever decrypting.

## 3. RBAC Matrix

| Role | Prod secrets | Write vars | Invite/manage members | Audit | Billing |
|------|:---:|:---:|:---:|:---:|:---:|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | — |
| DevOps | ✅ | ✅ (non-billing) | — | ✅ | — |
| Developer | ❌ | ✅ (non-prod) | — | — | — |
| Viewer | ❌ | ❌ | — | — | — |
| Auditor | ❌ | ❌ | — | ✅ | — |

Permissions derive from roles in `features/auth/services/permissions.ts`.
Environment gating (`environment-access.ts`) further restricts `production` and
`staging` to owner/admin/devops regardless of the org-wide `variables.reveal`
grant.

## 4. Session & Step-up Policy

- **Idle timeout** — configurable per org (`security.sessionTimeoutMinutes`,
  default 60). A 60s warning precedes forced logout.
- **Step-up reauthentication** — controlled by
  `security.requireReauthForReveal` (default on). Revealing or copying a
  sensitive-tier secret requires a fresh Google credential, cached 5 minutes.
- Both reset the cached reauth (`clearReauth()`) on logout/expiry.

## 5. Firestore Rule Guarantees

- **Default deny** — a catch-all `match /{document=**} { allow read,write: if false }`.
- **Variables** — read/write require `variables.*` permission **and**
  `canAccessEnv()` (reads the environment doc; sensitive tiers need a cleared
  role). Writes must not carry a `value` field and must carry `encryptedValue`.
- **Invitations** — creatable only by invite-managers with `status: pending`
  and `invitedBy == uid`; the invited user may read their own invite and update
  only `status`/`acceptedAt`.
- **Notifications** — recipient-only read; recipients may flip only `isRead`.
- **Audit / versions** — append-only, no update/delete, actor pinned to caller.

## 6. Audit Logging

Every sensitive action (create/update/delete/reveal/copy/export, member and
invite changes, reauth) is logged via `logAuditEvent()`. Details are sanitized:
keys matching `value|secret|password|token|key|credential` are redacted before
write. Logging is best-effort and never blocks the user action.

## 7. Known Trade-offs (V1)

1. **Deterministic master key** — encryption is "at rest behind app logic," not
   end-to-end. Replace with KMS/HSM for production zero-knowledge.
2. **Client-authored history/audit** — `versions`, `auditLogs`, and
   `notifications` are currently written by the client (rule-guarded). The
   Cloud Functions in `functions/` are the intended server-side replacement
   (captures IP + intent, removes client trust) but are not yet deployed.
3. **Email delivery** — invitation emails are sent by a GitHub Actions workflow
   calling Resend; the Resend key is a repo secret, never shipped to the
   browser. The client triggers the workflow with a fine-grained PAT scoped to
   this repo only. See `docs/EMAIL.md`. Do **not** use `VITE_RESEND_API_KEY` —
   a `VITE_` var is bundled into client JS and would leak the key.

## 8. Reporting

For a real deployment, add a security contact and disclosure policy here.
