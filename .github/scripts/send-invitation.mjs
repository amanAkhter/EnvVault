// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Invitation Email Sender (GitHub Actions)
// Runs in the send-invitation workflow. Reads invite details from env (populated
// from repository_dispatch payload or workflow_dispatch inputs) and sends via
// Resend. RESEND_API_KEY is a repository secret and never reaches the client.
// ─────────────────────────────────────────────────────────────────────────────

import { Resend } from 'resend';
import { buildInvitationEmail } from './invitation-email-template.mjs';

const {
  RESEND_API_KEY,
  INVITE_FROM,
  INVITE_EMAIL,
  INVITE_ORG,
  INVITE_INVITER,
  INVITE_ROLE,
  INVITE_ACCEPT_URL,
  INVITE_EXPIRES,
} = process.env;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!RESEND_API_KEY) fail('RESEND_API_KEY secret is not set.');
if (!INVITE_EMAIL) fail('Recipient email (INVITE_EMAIL) is missing.');
if (!INVITE_ACCEPT_URL) fail('Accept URL (INVITE_ACCEPT_URL) is missing.');

// Only send to a plausible email; guards against a malformed dispatch payload.
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(INVITE_EMAIL)) {
  fail(`Recipient email looks invalid: ${INVITE_EMAIL}`);
}

const expiresLabel = INVITE_EXPIRES
  ? new Date(Number(INVITE_EXPIRES) || INVITE_EXPIRES).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  : undefined;

const { subject, html, text } = buildInvitationEmail({
  organizationName: INVITE_ORG,
  inviterName: INVITE_INVITER,
  role: INVITE_ROLE,
  acceptUrl: INVITE_ACCEPT_URL,
  expiresLabel,
});

const resend = new Resend(RESEND_API_KEY);

// Resend's shared onboarding sender works without domain verification.
// Set INVITE_FROM secret to your verified domain sender for production.
const from = INVITE_FROM || 'EnvVault <onboarding@resend.dev>';

try {
  const { data, error } = await resend.emails.send({
    from,
    to: INVITE_EMAIL,
    subject,
    html,
    text,
  });

  if (error) fail(`Resend error: ${JSON.stringify(error)}`);
  console.log(`✓ Invitation sent to ${INVITE_EMAIL} (id: ${data?.id ?? 'n/a'})`);
} catch (err) {
  fail(`Send failed: ${err?.message || err}`);
}
