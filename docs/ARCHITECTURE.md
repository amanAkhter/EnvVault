# EnvVault — Architecture

EnvVault is a zero-knowledge environment variable manager. Secrets are
encrypted in the browser (AES-256-GCM) and Firestore never receives plaintext.
This document describes how the app is organized and how data flows through it.

## 1. Tech Stack

| Concern | Choice |
|---------|--------|
| UI | React 19 + TypeScript, Tailwind v4, base-ui/shadcn primitives |
| Routing | React Router (lazy-loaded routes) |
| Server state | `@tanstack/react-query` |
| Client state | `zustand` (`authStore`) |
| Backend | Firebase Auth (Google) + Firestore |
| Crypto | Web Crypto API (AES-256-GCM, envelope encryption) |
| Animation | `framer-motion` |

## 2. Directory Structure (Feature-Sliced Design)

```
src/
├── features/               # Domain modules
│   ├── auth/               # login, guards, permissions, env-access, session hook
│   ├── members/            # members page + invite dialog
│   ├── variables/          # variable editor + phase-3 dialogs
│   ├── projects/           # project list / details / create
│   ├── dashboard/, audit/, settings/
├── services/               # Backend-facing logic (no UI)
│   ├── firestore/          # repository-per-collection over a generic base
│   ├── crypto/             # encryption + key management
│   ├── audit/              # centralized audit logging
│   ├── members/            # invitation + membership business logic
│   ├── notifications/      # notification service
│   ├── analysis/           # comparison + health (phase 3)
│   └── auth/               # step-up reauth service
├── components/             # Global dumb UI + layout shell
├── routes/                 # Thin route definitions
├── types/                  # Global TS types + Zod-adjacent contracts
└── constants/
```

**Rule of thumb:** UI never imports `firebase/firestore` directly. Components →
React Query hooks → repositories/services → Firebase SDK.

## 3. Data Model (Firestore collections)

| Collection | Key fields | Notes |
|------------|-----------|-------|
| `users` | uid, role, globalStatus | Platform-level identity |
| `organizations` | slug, security{}, billingPlanId | Tenant root |
| `organizationMembers` | `${orgId}_${uid}`, roleIds[], effectivePermissions[], status | RBAC source of truth |
| `projects` | organizationId, encryptedDEK, dekIV | Per-project data-encryption key |
| `environments` | projectId, type, color, order | `type` drives env-level RBAC |
| `variables` | environmentId, encryptedValue, iv, fingerprint, version | Ciphertext only |
| `versions` | variableId, old/new ciphertext | Immutable history |
| `auditLogs` | action, actorId, details | Append-only, sanitized |
| `invitations` | email, roleIds[], status, expiresAt | 7-day TTL |
| `notifications` | userId, type, isRead | Per-user in-app inbox |

## 4. State & Request Flow

1. **Auth bootstrap** — `initAuthListener()` (in `providers.tsx`) subscribes to
   Firebase Auth. On sign-in it loads/creates the `users` doc, fetches
   memberships + organizations, bootstraps a default org if none, and pushes a
   session into `authStore`.
2. **Authorization** — `authStore.can(permission)` checks the active
   membership's `effectivePermissions`; `canAccessEnv(type)` layers
   environment-tier gating on top (see §6).
3. **Reads/writes** — pages call React Query hooks whose `queryFn` hits a
   repository. Mutations invalidate the relevant query keys
   (`['variables', projectId, envId]`, `['members', orgId]`, …).
4. **Audit** — sensitive mutations call `logAuditEvent()`, which sanitizes
   details and appends to `auditLogs` (best-effort, never blocks the flow).

## 5. Encryption (Envelope)

```
Master Key  = PBKDF2(userUid, APP_SALT)          # V1: derived client-side
Project DEK = AES-256-GCM key, wrapped by Master Key → stored as encryptedDEK
Variable    = AES-256-GCM(value, Project DEK)     → stored as encryptedValue
Fingerprint = SHA-256(value)                      # for diff without decryption
```

Comparison (env diff) and health checks operate purely on fingerprints +
metadata — **never** on plaintext. Reveal/copy decrypt in-memory only, auto-hide
after 10s, and clear the clipboard after 30s.

> V1 caveat: the master key is derived deterministically from the UID, so this
> is "encrypted at rest behind app logic," not true end-to-end zero-knowledge.
> Production would swap `getMasterKey()` for Cloud KMS / an HSM. See SECURITY.md.

## 6. RBAC & Environment Isolation

- **Org roles** → permission sets in `features/auth/services/permissions.ts`
  (`owner`, `admin`, `devops`, `developer`, `viewer`, `auditor`).
- **Environment tiers** — `environment-access.ts` marks `production`/`staging`
  as sensitive; only `owner`/`admin`/`devops` may read/reveal/write them. A
  developer with `variables.reveal` still cannot touch production secrets.
- Enforced in **three layers**: UI gating (`VariableEditor`), the `authStore`
  selectors, and Firestore rules (`canAccessEnv()` reads the environment doc).

## 7. Session & Step-up Security

- **Idle timeout** — `useSessionTimeout()` logs out after
  `security.sessionTimeoutMinutes` of inactivity (default 60), warning 60s prior.
- **Step-up reauth** — revealing/copying a sensitive-tier secret requires a
  fresh Google credential (`reauth-service.ts`), cached for 5 minutes, gated by
  `security.requireReauthForReveal`.

## 8. Server-side (Phase 5, design-only)

`functions/` documents the intended migration of version/audit/notification
writes off the client and onto Cloud Functions (with request IP + intent
capture). Not deployed — see `functions/README.md`.

## 9. Phase History

- **P1** Foundation: types, crypto, repositories, core pages.
- **P2** Connectivity: env CRUD, inline edit, import/export.
- **P3** Advanced: version history/rollback, env compare, secret generator,
  health score, bulk ops, tags.
- **P4** Collaboration & security: invitations, member CRUD, env RBAC, reauth,
  session timeout, notifications.
- **P5** Infrastructure: production rules, functions design, indexes, docs.
