/** Couleurs alignées sur globals.css — rendu fiable dans Outlook (styles inline). */
const COLORS = {
  brand: "#0f6e56",
  brandDark: "#04342c",
  brandLight: "#e1f5ee",
  brandMuted: "#5a8f82",
  bg: "#f4f7f6",
  card: "#ffffff",
  text: "#1a2e28",
  textMuted: "#5a6b65",
  border: "#d4e8e0",
  success: "#0f6e56",
  successBg: "#e1f5ee",
  warning: "#b45309",
  warningBg: "#fef3c7",
  danger: "#b91c1c",
  dangerBg: "#fee2e2",
  info: "#0369a1",
  infoBg: "#e0f2fe",
} as const;

export type EmailVariant = "success" | "warning" | "danger" | "info" | "admin";

const VARIANT_STYLES: Record<
  EmailVariant,
  { accent: string; accentBg: string; badge: string }
> = {
  success: { accent: COLORS.success, accentBg: COLORS.successBg, badge: "Succès" },
  warning: { accent: COLORS.warning, accentBg: COLORS.warningBg, badge: "Rappel" },
  danger: { accent: COLORS.danger, accentBg: COLORS.dangerBg, badge: "Refusé" },
  info: { accent: COLORS.info, accentBg: COLORS.infoBg, badge: "Information" },
  admin: { accent: COLORS.brand, accentBg: COLORS.brandLight, badge: "Action requise" },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildButton(href: string, label: string, accent = COLORS.brand): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 8px auto;">
      <tr>
        <td align="center" bgcolor="${accent}" style="border-radius:8px;background-color:${accent};mso-padding-alt:14px 28px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${safeHref}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="12%" strokecolor="${accent}" fillcolor="${accent}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${safeHref}" target="_blank"
            style="display:inline-block;padding:14px 28px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${accent};border:1px solid ${accent};">
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `.trim();
}

function buildSecondaryLink(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <p style="margin:12px 0 0 0;text-align:center;font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:${COLORS.brandMuted};">
      <a href="${safeHref}" target="_blank" style="color:${COLORS.brand};text-decoration:underline;">${safeLabel}</a>
    </p>
  `.trim();
}

export function buildInfoRows(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:10px 14px;font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:600;color:${COLORS.textMuted};width:38%;vertical-align:top;border-bottom:1px solid ${COLORS.border};background-color:${COLORS.bg};">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px 14px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:${COLORS.text};vertical-align:top;border-bottom:1px solid ${COLORS.border};background-color:${COLORS.card};">
            ${escapeHtml(value)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin:20px 0;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;border-collapse:separate;">
      ${cells}
    </table>
  `.trim();
}

export function buildCredentialsBox(params: {
  email: string;
  password: string;
  passwordLabel?: string;
}): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin:20px 0;border:2px dashed ${COLORS.brand};border-radius:10px;background-color:${COLORS.brandLight};">
      <tr>
        <td style="padding:20px 22px;font-family:Segoe UI,Arial,sans-serif;">
          <p style="margin:0 0 14px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.brandDark};">
            Vos identifiants de connexion
          </p>
          <p style="margin:0 0 8px 0;font-size:14px;color:${COLORS.text};">
            <strong style="color:${COLORS.brandDark};">Email :</strong>
            <span style="color:${COLORS.text};">${escapeHtml(params.email)}</span>
          </p>
          <p style="margin:0;font-size:14px;color:${COLORS.text};">
            <strong style="color:${COLORS.brandDark};">${escapeHtml(params.passwordLabel ?? "Mot de passe temporaire")} :</strong>
            <code style="display:inline-block;margin-top:4px;padding:6px 12px;font-family:Consolas,Monaco,monospace;font-size:15px;font-weight:700;color:${COLORS.brandDark};background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:6px;">
              ${escapeHtml(params.password)}
            </code>
          </p>
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildAlertBanner(text: string, variant: EmailVariant): string {
  const style = VARIANT_STYLES[variant];
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin:0 0 20px 0;border-left:4px solid ${style.accent};background-color:${style.accentBg};border-radius:0 8px 8px 0;">
      <tr>
        <td style="padding:14px 18px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.text};">
          ${escapeHtml(text)}
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildEmailLayout(params: {
  preheader?: string;
  title: string;
  subtitle?: string;
  variant?: EmailVariant;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const variant = params.variant ?? "info";
  const style = VARIANT_STYLES[variant];
  const preheader = params.preheader ? escapeHtml(params.preheader) : "";
  const title = escapeHtml(params.title);
  const subtitle = params.subtitle ? escapeHtml(params.subtitle) : "";
  const footerNote = params.footerNote
    ? escapeHtml(params.footerNote)
    : "Cet email a été envoyé automatiquement par TimeTrack Pro. Ne répondez pas à ce message.";

  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td { font-family: Segoe UI, Arial, sans-serif; }
    a { color: ${COLORS.brand}; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${
    preheader
      ? `<div style="display:none;font-size:1px;color:${COLORS.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
      : ""
  }
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="600"
          style="max-width:600px;width:100%;background-color:${COLORS.card};border-radius:12px;border:1px solid ${COLORS.border};overflow:hidden;box-shadow:0 4px 24px rgba(4,52,44,0.08);">

          <!-- En-tête -->
          <tr>
            <td bgcolor="${COLORS.brandDark}" style="background:linear-gradient(135deg,${COLORS.brandDark} 0%,${COLORS.brand} 100%);background-color:${COLORS.brandDark};padding:28px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0;font-family:Segoe UI,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
                      Système de pointage
                    </p>
                    <p style="margin:6px 0 0 0;font-family:Segoe UI,Arial,sans-serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">
                      TimeTrack Pro
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 12px;font-family:Segoe UI,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${style.accent};background-color:#ffffff;border-radius:20px;">
                      ${style.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td class="email-padding" style="padding:28px 32px 0 32px;">
              <h1 style="margin:0 0 8px 0;font-family:Segoe UI,Arial,sans-serif;font-size:22px;font-weight:700;color:${COLORS.brandDark};line-height:1.3;">
                ${title}
              </h1>
              ${
                subtitle
                  ? `<p style="margin:0;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:${COLORS.textMuted};">${subtitle}</p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td class="email-padding" style="padding:20px 32px 32px 32px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.text};">
              ${params.bodyHtml}
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding:20px 32px 28px 32px;background-color:${COLORS.bg};border-top:1px solid ${COLORS.border};">
              <p style="margin:0 0 8px 0;font-family:Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:${COLORS.textMuted};text-align:center;">
                ${footerNote}
              </p>
              <p style="margin:0;font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:${COLORS.brandMuted};text-align:center;">
                &copy; ${new Date().getFullYear()} TimeTrack Pro &mdash; Gestion du pointage numérique
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { buildButton, buildSecondaryLink, COLORS };
