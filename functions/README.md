# EnvVault Cloud Functions — Design Reference

> **Status: NOT DEPLOYED.** This directory documents the intended server-side
> hardening for Phase 5. The functions compile against `firebase-functions` v2
> but are intentionally excluded from the active deploy pipeline until the
> backend milestone. The client app works today without them.

## Why these exist

The current client performs three sensitive writes directly (guarded only by
Firestore rules):

1. **Version history** (`versions`) — client-authored, so a malicious client
   could forge or skip history entries.
2. **Audit logs** (`auditLogs`) — client sets `actorId`; IP is unavailable in
   the browser.
3. **Notifications** (`notifications`) — fan-out happens client-side.

Moving these server-side removes client trust and captures request IP + intent.

## Functions

| Export | Trigger | Purpose |
|--------|---------|---------|
| `onUserSignup` | `users/{userId}` onCreate | Provision default org + owner membership. |
| `onVariableChange` | `variables/{id}` onWrite | Server-authored version + audit entry on value change. |
| `onSecretReveal` | HTTPS callable | Tamper-proof reveal log with IP + intent for production secrets. |
| `cleanupExpiredSecrets` | Scheduled (daily 03:00 UTC) | Flag expired secrets, notify owners. |
| `sendNotifications` | `auditLogs/{id}` onCreate | Fan critical events out to org admins. |

## Migration path

When ready to deploy:

1. `cd functions && npm install`
2. Remove the client-side `versionRepository.recordChange()` call in
   `VariableEditor` (the function takes over history).
3. Tighten `firestore.rules`: change `versions` and `auditLogs` `create` rules
   to `if false` (only the Admin SDK writes them).
4. Wire the client reveal flow to call `onSecretReveal` before decrypting a
   production secret.
5. `firebase deploy --only functions,firestore:rules`.

Until then, keep the client behavior and these functions as the documented
target architecture.
