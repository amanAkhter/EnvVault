// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Invitation Email Trigger
// Fires the GitHub Actions `send-invitation` workflow via repository_dispatch.
// The actual Resend send happens in CI where the API key is a repo secret; the
// browser only carries a fine-grained PAT scoped to trigger this one workflow.
//
// Best-effort: a failed dispatch never breaks invite creation — the invitation
// record already exists in Firestore and can be re-sent.
// ─────────────────────────────────────────────────────────────────────────────

import type { Invitation } from '../../types';

const GH_TOKEN = import.meta.env.VITE_GH_DISPATCH_TOKEN as string | undefined;
// Format: "owner/repo"
const GH_REPO = import.meta.env.VITE_GH_REPO as string | undefined;
// Public base URL of the deployed app, e.g. https://envvault.example.com
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? window.location.origin;

export interface InvitationEmailPayload {
  invitation: Invitation;
  inviterName: string;
}

/**
 * Build the public acceptance URL for an invitation.
 * Encodes the org so the accept page can disambiguate without a lookup round-trip.
 */
export const buildAcceptUrl = (invitation: Invitation): string => {
  const base = APP_URL.replace(/\/+$/, '');
  const params = new URLSearchParams({
    id: invitation.id,
    org: invitation.organizationId,
  });
  return `${base}/accept-invite?${params.toString()}`;
};

/**
 * Trigger the invitation email workflow. Returns true if the dispatch was
 * accepted (HTTP 204). Missing config is a no-op (returns false) so local dev
 * without a token doesn't error — the invite still lands in the UI.
 */
export const sendInvitationEmail = async ({
  invitation,
  inviterName,
}: InvitationEmailPayload): Promise<boolean> => {
  if (!GH_TOKEN || !GH_REPO) {
    console.warn(
      '[email] VITE_GH_DISPATCH_TOKEN / VITE_GH_REPO not set — skipping email dispatch.',
    );
    return false;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'send-invitation',
        client_payload: {
          email: invitation.email,
          organizationName: invitation.organizationName,
          inviterName,
          role: invitation.roleIds[0] ?? 'member',
          acceptUrl: buildAcceptUrl(invitation),
          expiresAt: invitation.expiresAt,
        },
      }),
    });

    if (!res.ok) {
      console.error(`[email] Dispatch failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Dispatch error:', err);
    return false;
  }
};
