// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Invitation email trigger (Resend)
// Fires when an invitation document is created and sends the branded email
// server-side. RESEND_API_KEY is a Cloud Functions secret and never reaches the
// client — this replaces the former GitHub Actions → Resend dispatch pipeline.
// ─────────────────────────────────────────────────────────────────────────────

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';
import { REGION, db } from './config';
import { buildInvitationEmail } from './email/template';

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
// Public base URL of the deployed app + optional verified sender.
const APP_URL = defineString('APP_URL', { default: 'http://localhost:5173' });
const INVITE_FROM = defineString('INVITE_FROM', { default: 'EnvVault <onboarding@resend.dev>' });

function buildAcceptUrl(invitationId: string, organizationId: string): string {
  const base = APP_URL.value().replace(/\/+$/, '');
  const params = new URLSearchParams({ id: invitationId, org: organizationId });
  return `${base}/accept-invite?${params.toString()}`;
}

export const onInvitationCreated = onDocumentCreated(
  { region: REGION, document: 'invitations/{invitationId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const invitation = event.data?.data();
    if (!invitation) return;
    if (invitation.status !== 'pending') return;

    const email = String(invitation.email ?? '').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn(`onInvitationCreated: skipping invalid recipient "${email}".`);
      return;
    }

    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      logger.warn('onInvitationCreated: RESEND_API_KEY not set — email not sent.');
      return;
    }

    const expiresLabel = invitation.expiresAt
      ? new Date(Number(invitation.expiresAt)).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined;

    const { subject, html, text } = buildInvitationEmail({
      organizationName: invitation.organizationName,
      inviterName: invitation.invitedByName,
      role: invitation.roleIds?.[0] ?? 'member',
      acceptUrl: buildAcceptUrl(event.params.invitationId, invitation.organizationId),
      expiresLabel,
    });

    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: INVITE_FROM.value(),
        to: email,
        subject,
        html,
        text,
      });
      if (error) {
        logger.error('onInvitationCreated: Resend error', error);
        await event.data!.ref.update({ emailStatus: 'failed', emailError: String(error.message ?? error) });
        return;
      }
      await event.data!.ref.update({ emailStatus: 'sent', emailId: data?.id ?? null, emailSentAt: Date.now() });
      logger.info(`onInvitationCreated: sent invitation to ${email} (${data?.id ?? 'n/a'}).`);
    } catch (err) {
      logger.error('onInvitationCreated: send failed', err);
      await event.data!.ref.update({ emailStatus: 'failed', emailError: (err as Error).message });
    }
    void db; // db retained for future recipient lookups
  },
);
