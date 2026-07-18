// ─────────────────────────────────────────────────────────────────────────────
// EnvVault Backend – Invitation email template
// Branded, email-client-safe HTML (table layout, inline styles). Ported from
// the former GitHub Actions script so all sending is server-side.
// ─────────────────────────────────────────────────────────────────────────────

export interface InvitationEmailParams {
  organizationName?: string;
  inviterName?: string;
  role?: string;
  acceptUrl: string;
  expiresLabel?: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildInvitationEmail(p: InvitationEmailParams): BuiltEmail {
  const org = escapeHtml(p.organizationName || 'a workspace');
  const inviter = escapeHtml(p.inviterName || 'A teammate');
  const role = escapeHtml(capitalize(p.role || 'member'));
  const url = p.acceptUrl;
  const expires = p.expiresLabel ? escapeHtml(p.expiresLabel) : null;

  const subject = `${inviter} invited you to ${org} on EnvVault`;

  const text = [
    `${inviter} has invited you to join ${p.organizationName} on EnvVault as a ${p.role}.`,
    '',
    `Accept your invitation: ${url}`,
    expires ? `\nThis invitation expires on ${p.expiresLabel}.` : '',
    '',
    'EnvVault — secure environment variable management.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${inviter} invited you to ${org} on EnvVault as a ${role}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111111;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #1f1f1f;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;vertical-align:middle;">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:rgba(16,185,129,0.12);text-align:center;line-height:40px;">
                      <span style="color:#10b981;font-size:20px;">&#128274;</span>
                    </div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.2;">EnvVault</div>
                    <div style="color:#6b7280;font-size:12px;line-height:1.2;">Secure configuration platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:700;">You're invited</h1>
              <p style="margin:0 0 24px 0;color:#a1a1aa;font-size:14px;line-height:1.6;">
                <strong style="color:#e4e4e7;">${inviter}</strong> has invited you to join
                <strong style="color:#e4e4e7;">${org}</strong> on EnvVault.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px 14px;">
                    <span style="color:#6b7280;font-size:12px;">Role:&nbsp;</span>
                    <span style="color:#10b981;font-size:13px;font-weight:600;">${role}</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${url}" target="_blank"
                      style="display:inline-block;background-color:#10b981;color:#052e16;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;color:#6b7280;font-size:12px;line-height:1.6;text-align:center;">
                Or paste this link into your browser:<br />
                <a href="${url}" target="_blank" style="color:#10b981;word-break:break-all;">${url}</a>
              </p>
              ${expires ? `<p style="margin:24px 0 0 0;color:#71717a;font-size:12px;text-align:center;">This invitation expires on <strong style="color:#a1a1aa;">${expires}</strong>.</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f1f1f;background-color:#0d0d0d;">
              <p style="margin:0;color:#52525b;font-size:11px;line-height:1.6;text-align:center;">
                You received this email because someone invited you to a workspace on EnvVault.
                If you weren't expecting this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;color:#3f3f46;font-size:11px;">&copy; EnvVault. Encrypted with AES-256-GCM.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
