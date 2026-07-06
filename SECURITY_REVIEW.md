# EnvVault — Security Review

**Date:** 2026-07-06
**Scope:** Full codebase — authentication, Firestore security rules, client-side
encryption, data-access layer, and env-file parsing.
**App:** Multi-tenant secrets/environment-variable manager on Firebase + React.

---

## Summary

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | 🔴 Critical | Auth | Any Google account self-provisions as platform admin (login bypass) |
| 2 | 🟠 High | Crypto | Master key derived from public UID + hardcoded salt (not zero-knowledge) |
| 3 | 🟠 High | Crypto | DEK unwrappable by anyone but its creator — team sharing broken |
| 4 | 🟠 High | Data | Cross-tenant project read via falsy `organizationId` |
| 5 | 🟠 High | Data | Migration steals other users' projects and destroys their encrypted data |
| 6 | 🟡 Medium | Rules | Rules forbid `users` create, but first login requires it (inconsistency) |
| 7 | 🟡 Medium | Auth | Entire org-role system is dead code (admin-only gate) |
| 8 | 🟡 Medium | Data | Export/import round-trip corrupts secrets with quotes/spaces |
| 9 | 🟡 Medium | Data | Plaintext secrets held in DOM in EnvEditor |
| 10 | 🟢 Low | Various | Rules/crypto/UX hardening items (see below) |

---

## 🔴 CRITICAL

### 1. Any Google account self-provisions as platform admin — total auth bypass

**File:** `src/features/auth/api/authApi.ts:175-209`

On first login the app auto-creates the user document with a hardcoded
`role: 'admin'`:

```ts
if (!userDoc.exists()) {
  const newUser: User = { ...firebaseUser..., role: 'admin', globalStatus: 'active', ... };
  await setDoc(userRef, newUser);   // line 188
}
```

There is **no email allowlist, no domain restriction, no invitation check**.
`AuthGuard` (`AuthGuard.tsx:20`) and `authApi.ts:203` gate access purely on
`user.role === 'admin'` — which every new user is granted. Then
`ensureAdminBootstrapOrganization` hands them an org with `roleIds: ['owner']`
and the full permission set (`authApi.ts:142-156`).

**Impact:** anyone on the internet with any Google account logs in and becomes a
platform admin + org owner. The login screen's claim *"Access is restricted to
authorized team members only"* (`LoginPage.tsx:126`) is false.

**Fix:** gate provisioning on a server-side allowlist (custom claims / an
`allowedEmails` collection / domain check). Never let the client assert its own
`role`.

---

## 🟠 HIGH

### 2. Encryption is not zero-knowledge — master key derives from the public UID + a hardcoded salt

**File:** `src/services/crypto/encryption.ts:293-299`

```ts
const APP_SALT = 'envvault-v1-master-key-salt-2024';
export const getMasterKey = async (userUid) =>
  deriveKeyFromPassphrase(userUid, encode(`${APP_SALT}:${userUid}`), 100_000);
```

The only secret input is the Firebase UID, which is **not secret** (it appears in
member lists, tokens, Firestore docs). The salt is baked into the shipped JS
bundle. Anyone with a Firestore dump (or read access) can reproduce the exact
master key, `unwrapDEK` the project DEK, and decrypt every secret. The
"Firestore never sees plaintext" promise provides **no real confidentiality**.
Iteration count here is `100_000` vs the `600_000` OWASP default used elsewhere —
moot given the input isn't secret.

**Fix:** derive from a real secret (KMS-wrapped key, or a user passphrase never
sent to the server).

### 3. Team sharing is cryptographically broken — DEK unwrappable by anyone but its creator

**File:** `src/services/crypto/encryption.ts:295-320`, used in `VariableEditor.tsx`

The project DEK is wrapped with the **creator's** UID-derived master key, but
every reader unwraps it with `getMasterKey(theirOwnUid)`. Different UID →
different master key → AES-GCM auth-tag mismatch → throw. A second org member
granted `variables.reveal` gets *"Failed to decrypt"* on every
reveal/edit/export. Secrets are effectively single-user, contradicting the
multi-member RBAC design.

### 4. Cross-tenant project read

**File:** `src/features/dashboard/api/projectsApi.ts:21-27, 35`

```ts
return !project.organizationId || project.organizationId === organizationId ? project : null;  // :35
```

`fetchProjectById` returns **any** project whose `organizationId` is falsy to
**any** caller, and the `includeLegacyProjects` path (`:21`) queries the entire
`projects` collection unscoped. A user in org X reads another tenant's org-less
project metadata — including its `encryptedDEK`/`dekIV`.

### 5. Migration silently steals other users' projects and destroys their data

**File:** `src/services/firestore/migration.ts:21-36`

```ts
if (data.userId === userId || !data.organizationId) {   // :21
  const dek = await generateDEK();                        // brand-new DEK
  const wrappedDEK = await wrapDEK(dek, masterKey);
  await setDoc(..., { ...data, organizationId, encryptedDEK: wrappedDEK.encryptedDEK, ... });
}
```

Two bugs: (a) `!data.organizationId` matches **every** org-less project in the
whole collection, including other users', and reassigns them to the migrating
user's org — silent cross-tenant takeover. (b) A **fresh random DEK** is written
without re-encrypting existing variables, so all previously-encrypted values
become permanently undecryptable — irreversible data loss. (Aside: this file
imports from `../encryption/crypto-service`, a different module than the actual
`crypto/encryption.ts` — likely a broken/dead import too.)

---

## 🟡 MEDIUM

### 6. Rules forbid `users` create, but the app requires it on every first login

**Files:** `firestore.rules:51` vs `authApi.ts:188`

`allow create, delete: if false` on `/users` means the first-login
`setDoc(userRef, newUser)` is **denied**. New-user provisioning (and the whole
bootstrap chain, since `organizationMembers` create requires `isPlatformAdmin()`
which needs that user doc) can't succeed under the committed rules. Either new
logins are broken, or the deployed rules differ from the repo — a dangerous
inconsistency. If deployed rules *do* allow it, finding #1 becomes fully
persistable escalation.

### 7. The entire org-role system is dead code

**Files:** `authApi.ts:203-208` + `AuthGuard.tsx:20`

Both hard-require `role === 'admin'` and sign out everyone else. So `viewer`,
`developer`, `devops`, `auditor`, `owner` (the whole `ROLE_PERMISSIONS` matrix in
`permissions.ts`) can **never log in**. The RBAC UI/permissions are
non-functional.

### 8. Export/import round-trip corrupts secrets containing quotes/spaces

**Files:** `src/features/env/utils/envParser.ts:15-16`, `VariableEditor.tsx:375`

- Export escapes `"` → `\"`, but the parser strips outer quotes **without
  unescaping**, so `a"b` becomes `a\"b` and gets re-encrypted corrupted — silent,
  irreversible mutation of secrets like JSON/connection strings each cycle.
- The quoting test `/[\\s='"]/` is a char class of `{backslash, 's', '=', ', "}` —
  the `\\s` is an escaped backslash + literal `s`, **not** `\s`. Values with
  spaces (e.g. `Bearer token here`) are exported **unquoted** and truncate at the
  first space when re-imported/sourced.
- Parser also mishandles `export ` prefix and inline `# comments`, folding them
  into keys/values.

### 9. Plaintext secrets held in DOM in EnvEditor

**File:** `src/features/env/pages/EnvEditor.tsx:241`

All values live decrypted in the zustand store and bind to
`<Input value={variable.value}>`; the `hidden` flag only flips `type=password`,
which does **not** hide the value from the DOM/JS.
`document.querySelector('input').value` (or any extension) reads every secret at
once — no reveal-gating or audit, unlike `VariableEditor`.

---

## 🟢 LOW / Hardening

- **`firestore.rules:167`** — `notifications` `allow update` has no field
  restriction; a user can write arbitrary fields to their own notification doc.
- **`encryption.ts:254`** — `generateSecureRandom` uses `x % charset.length` on
  `Uint32Array`, introducing modulo bias in a "cryptographically secure"
  generator; use rejection sampling.
- **`encryption.ts:39`** — `btoa(String.fromCharCode(...buffer))` spreads the
  whole array onto the stack; large values (big exports) throw `RangeError`.
  Chunk the encoding.
- **`VariableEditor.tsx:301`** — the 30 s clipboard-clear writes `''`
  unconditionally (clobbers unrelated clipboard content) and silently fails when
  the tab is unfocused (the common case), giving false assurance.
- **Import regex ReDoS** (`VariableEditor.tsx:335`) — quadratic backtracking on
  multi-MB pasted content; not catastrophic but can freeze the UI.

---

## No issues found

- **XSS:** no `dangerouslySetInnerHTML` / `innerHTML` / `eval` anywhere; React
  auto-escaping covers rendered values. External links use `rel="noreferrer"`.
- **Prototype pollution:** env parsing uses arrays of `{key, value}` and
  sanitizes keys; `__proto__` is not reachable.
- **Plaintext `value` to Firestore:** no code path writes a `value` field on
  variables (rules-compliant).

---

## Priority order to fix

1. **#1** (auth bypass) — ship an allowlist before anything else touches production.
2. **#2 / #3** (crypto key model) — the encryption needs a real key-management
   redesign; the current scheme is both insecure and non-functional for teams.
3. **#4 / #5** (cross-tenant read + migration takeover/data-loss) — disable the
   legacy/migration paths until scoped correctly.
