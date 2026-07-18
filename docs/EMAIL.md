# EnvVault — Invitation Email Setup

Invitation emails are sent by a **GitHub Actions** workflow that calls the
**Resend** API. The Resend key lives as a repository **secret** and is never
shipped to the browser — the client only *triggers* the workflow.

```
Invite created (app)
      │  repository_dispatch  (fine-grained PAT, browser)
      ▼
GitHub Actions: send-invitation.yml
      │  RESEND_API_KEY  (repo secret, server-side)
      ▼
Resend  →  branded email  →  recipient  →  /accept-invite
```

## Why not call Resend from the browser?

A `VITE_`-prefixed variable is compiled into the client bundle — anyone can read
it in DevTools. Putting a Resend key there leaks it to every visitor, and Resend
blocks browser-origin calls via CORS anyway. So the send runs in CI.

> If you previously set `VITE_RESEND_API_KEY`, **rotate that key now** — assume
> it was exposed — and use the secret-based flow below.

## One-time setup

### 1. Resend

1. Create an API key at https://resend.com/api-keys.
2. (Production) Verify your sending domain and note a verified `from` address.
   The default `onboarding@resend.dev` works for testing only.

### 2. GitHub repository secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value |
|--------|-------|
| `RESEND_API_KEY` | your `re_...` key |
| `INVITE_FROM` | *(optional)* e.g. `EnvVault <invites@yourdomain.com>` |

### 3. Fine-grained PAT for the client trigger

Create a **fine-grained** personal access token (Settings → Developer settings →
Fine-grained tokens):

- **Repository access:** only this repository.
- **Permissions:** `Actions` → Read and write. `Contents` → Read-only.
- Nothing else.

This token can *only* trigger workflows in this one repo — that is its entire
blast radius. Rotate it periodically.

### 4. App env vars

In `.env.development` / `.env.production` (gitignored):

```
VITE_GH_REPO="your-org/env-vault"
VITE_GH_DISPATCH_TOKEN="github_pat_..."
VITE_APP_URL="https://your-deployed-app.com"
```

`VITE_APP_URL` builds the `/accept-invite?id=...` link in the email. It falls
back to `window.location.origin` if unset.

## Testing

- **Manual:** Actions tab → *Send Invitation Email* → *Run workflow*, fill the
  inputs (email, org, inviter, role, acceptUrl).
- **End-to-end:** invite a member in the app; a `repository_dispatch` fires the
  workflow. Check the Actions run log for `✓ Invitation sent`.

## Acceptance flow

The email CTA links to `/accept-invite?id=<invitationId>&org=<orgId>` (public
route). The page:

1. Loads the invitation; blocks if missing / expired / revoked / already used.
2. Requires sign-in with the **matching email** (mismatch is rejected).
3. Calls `acceptInvitation()` — creates the membership with role-derived
   permissions, marks the invite accepted, notifies the inviter.

## Failure behavior

Email dispatch is **best-effort**. If the PAT/repo vars are missing or the
dispatch fails, invite creation still succeeds — the record exists and can be
re-sent. Local dev without a token simply skips the email (logged to console).
