import { getAppUrl } from "@/lib/server/api-errors";
import {
  buildAlertBanner,
  buildButton,
  buildCredentialsBox,
  buildEmailLayout,
  buildInfoRows,
  buildSecondaryLink,
  escapeHtml,
} from "@/lib/server/email-templates";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function parseRecipients(to: string): string[] {
  return [...new Set(to.split(",").map((e) => e.trim()).filter(Boolean))];
}

async function sendViaResend(payload: MailPayload): Promise<void> {
  const from = process.env.EMAIL_FROM?.trim() || "TimeTrack Pro <onboarding@resend.dev>";
  const to = parseRecipients(payload.to);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend: envoi impossible (${res.status})${detail ? ` — ${detail}` : ""}`);
  }
}

async function sendViaSmtp(payload: MailPayload): Promise<void> {
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

async function sendMail(payload: MailPayload): Promise<void> {
  if (resendConfigured()) {
    await sendViaResend(payload);
    return;
  }

  if (smtpConfigured()) {
    try {
      await sendViaSmtp(payload);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("SmtpClientAuthentication is disabled") || msg.includes("535 5.7.139")) {
        throw new Error(
          "SMTP Outlook bloqué par Microsoft sur les comptes récents. Configurez RESEND_API_KEY (gratuit sur resend.com).",
        );
      }
      throw err;
    }
  }

  console.info("[email:simulation]", payload.to, payload.subject, payload.text);
}

export async function sendAccessApprovedEmail(params: {
  to: string;
  nom: string;
  email: string;
  temporaryPassword: string;
}): Promise<void> {
  const loginUrl = `${getAppUrl()}/login`;
  const changePasswordUrl = `${getAppUrl()}/changer-mot-de-passe`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Bonjour <strong>${escapeHtml(params.nom)}</strong>,</p>
    ${buildAlertBanner("Votre demande d'accès a été acceptée. Vous pouvez dès maintenant vous connecter à TimeTrack Pro.", "success")}
    ${buildCredentialsBox({ email: params.email, password: params.temporaryPassword })}
    ${buildButton(loginUrl, "Se connecter")}
    ${buildSecondaryLink(changePasswordUrl, "Changer mon mot de passe à la première connexion")}
    <p style="margin:24px 0 0 0;font-size:13px;color:#5a6b65;">
      Pour des raisons de sécurité, vous devrez modifier votre mot de passe temporaire dès votre première connexion.
    </p>
  `;

  await sendMail({
    to: params.to,
    subject: "TimeTrack Pro — Votre accès a été approuvé",
    text: [
      `Bonjour ${params.nom},`,
      "",
      "Votre demande d'accès à TimeTrack Pro a été acceptée.",
      "",
      `Email : ${params.email}`,
      `Mot de passe temporaire : ${params.temporaryPassword}`,
      "",
      `Connexion : ${loginUrl}`,
      `Changement de mot de passe : ${changePasswordUrl}`,
      "",
      "Vous devrez changer votre mot de passe à la première connexion.",
    ].join("\n"),
    html: buildEmailLayout({
      preheader: `Accès approuvé — connectez-vous avec ${params.email}`,
      title: "Votre accès a été approuvé",
      subtitle: "Bienvenue sur TimeTrack Pro",
      variant: "success",
      bodyHtml,
    }),
  });
}

export async function sendAccessRefusedEmail(params: { to: string; nom: string }): Promise<void> {
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Bonjour <strong>${escapeHtml(params.nom)}</strong>,</p>
    ${buildAlertBanner("Votre demande d'accès à TimeTrack Pro a été refusée par l'administrateur RH.", "danger")}
    <p style="margin:0;font-size:14px;line-height:1.6;color:#1a2e28;">
      Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez obtenir plus de détails,
      veuillez contacter directement votre responsable RH ou le service des ressources humaines.
    </p>
  `;

  await sendMail({
    to: params.to,
    subject: "TimeTrack Pro — Demande d'accès refusée",
    text: [
      `Bonjour ${params.nom},`,
      "",
      "Votre demande d'accès à TimeTrack Pro a été refusée par l'administrateur.",
      "Pour plus d'informations, contactez votre responsable RH.",
    ].join("\n"),
    html: buildEmailLayout({
      preheader: "Votre demande d'accès n'a pas été acceptée",
      title: "Demande d'accès refusée",
      subtitle: "TimeTrack Pro — Notification employé",
      variant: "danger",
      bodyHtml,
    }),
  });
}

export async function sendJoinRequestAdminNotification(params: {
  adminEmails: string[];
  demandeId: string;
  nom: string;
  email: string;
  telephone?: string;
  message?: string;
}): Promise<void> {
  const recipients = [...new Set(params.adminEmails.map((e) => e.trim()).filter(Boolean))];
  if (!recipients.length) {
    console.warn("[email] Aucun destinataire admin — configurez ADMIN_NOTIFY_EMAIL ou un compte admin dans Firestore");
    return;
  }

  const adminUrl = `${getAppUrl()}/admin/demandes`;
  const telLine = params.telephone ? `Téléphone : ${params.telephone}` : "";
  const msgLine = params.message ? `Message : ${params.message}` : "";
  const nowLabel = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows = [
    { label: "Date", value: nowLabel },
    { label: "Nom", value: params.nom },
    { label: "Email", value: params.email },
    ...(params.telephone ? [{ label: "Téléphone", value: params.telephone }] : []),
    ...(params.message ? [{ label: "Message", value: params.message }] : []),
    { label: "Référence", value: params.demandeId },
  ];

  const bodyHtml = `
    ${buildAlertBanner(`Une nouvelle demande d'accès vient d'être soumise par ${params.nom}.`, "admin")}
    ${buildInfoRows(rows)}
    ${buildButton(adminUrl, "Traiter la demande")}
    ${buildSecondaryLink(adminUrl, "Ouvrir le panneau admin — Demandes d'accès")}
  `;

  await sendMail({
    to: recipients.join(", "),
    subject: `TimeTrack Pro — Nouvelle demande d'accès : ${params.nom}`,
    text: [
      "Une nouvelle demande pour rejoindre TimeTrack Pro vient d'être soumise.",
      "",
      `Date : ${nowLabel}`,
      `Nom : ${params.nom}`,
      `Email : ${params.email}`,
      telLine,
      msgLine,
      `Référence : ${params.demandeId}`,
      "",
      `Traiter la demande : ${adminUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: buildEmailLayout({
      preheader: `Nouvelle demande d'accès — ${params.nom} (${params.email})`,
      title: "Nouvelle demande d'accès",
      subtitle: "Un employé souhaite rejoindre TimeTrack Pro",
      variant: "admin",
      bodyHtml,
      footerNote: "Notification administrateur — connectez-vous au panneau RH pour approuver ou refuser cette demande.",
    }),
  });
}

export async function sendPasswordResetRequestAdminNotification(params: {
  adminEmails: string[];
  demandeId: string;
  nom: string;
  email: string;
  message?: string;
  reminder?: boolean;
}): Promise<void> {
  const recipients = [...new Set(params.adminEmails.map((e) => e.trim()).filter(Boolean))];
  if (!recipients.length) {
    console.warn("[email] Aucun destinataire admin — configurez ADMIN_NOTIFY_EMAIL ou un compte admin dans Firestore");
    return;
  }

  const adminUrl = `${getAppUrl()}/admin/reinitialisation-mdp`;
  const msgLine = params.message ? `Message : ${params.message}` : "";
  const nowLabel = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const intro = params.reminder
    ? "Rappel : une demande de réinitialisation de mot de passe est toujours en attente de traitement."
    : "Un employé a demandé la réinitialisation de son mot de passe.";

  const rows = [
    { label: "Date", value: nowLabel },
    { label: "Nom", value: params.nom },
    { label: "Email employé", value: params.email },
    ...(params.message ? [{ label: "Message", value: params.message }] : []),
    { label: "Référence", value: params.demandeId },
  ];

  const bodyHtml = `
    ${buildAlertBanner(intro, params.reminder ? "warning" : "admin")}
    ${buildInfoRows(rows)}
    ${buildButton(adminUrl, "Générer un nouveau mot de passe")}
    ${buildSecondaryLink(adminUrl, "Ouvrir — Réinitialisation MDP")}
  `;

  await sendMail({
    to: recipients.join(", "),
    subject: params.reminder
      ? `[Rappel] TimeTrack Pro — Réinitialisation MDP : ${params.nom}`
      : `TimeTrack Pro — Réinitialisation mot de passe : ${params.nom}`,
    text: [
      intro,
      "",
      `Date de la notification : ${nowLabel}`,
      `Nom : ${params.nom}`,
      `Email employé : ${params.email}`,
      msgLine,
      `Référence : ${params.demandeId}`,
      "",
      `Traiter la demande : ${adminUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: buildEmailLayout({
      preheader: `${params.reminder ? "[Rappel] " : ""}Réinitialisation MDP — ${params.nom}`,
      title: params.reminder ? "Rappel — réinitialisation MDP" : "Demande de réinitialisation MDP",
      subtitle: `${params.nom} — ${params.email}`,
      variant: params.reminder ? "warning" : "admin",
      bodyHtml,
      footerNote: "Notification administrateur — générez un mot de passe temporaire depuis le panneau RH.",
    }),
  });
}

export async function sendPasswordResetApprovedEmail(params: {
  to: string;
  nom: string;
  email: string;
  temporaryPassword: string;
}): Promise<void> {
  const loginUrl = `${getAppUrl()}/login`;
  const changePasswordUrl = `${getAppUrl()}/changer-mot-de-passe`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Bonjour <strong>${escapeHtml(params.nom)}</strong>,</p>
    ${buildAlertBanner("Votre demande de réinitialisation de mot de passe a été traitée par l'administrateur.", "success")}
    ${buildCredentialsBox({
      email: params.email,
      password: params.temporaryPassword,
      passwordLabel: "Nouveau mot de passe temporaire",
    })}
    ${buildButton(loginUrl, "Se connecter")}
    ${buildSecondaryLink(changePasswordUrl, "Changer mon mot de passe immédiatement")}
    <p style="margin:24px 0 0 0;font-size:13px;color:#5a6b65;">
      Connectez-vous avec ce mot de passe, puis modifiez-le dès la première connexion pour sécuriser votre compte.
    </p>
  `;

  await sendMail({
    to: params.to,
    subject: "TimeTrack Pro — Nouveau mot de passe temporaire",
    text: [
      `Bonjour ${params.nom},`,
      "",
      "Votre demande de réinitialisation de mot de passe a été traitée par l'administrateur.",
      "",
      `Email : ${params.email}`,
      `Nouveau mot de passe temporaire : ${params.temporaryPassword}`,
      "",
      `Connexion : ${loginUrl}`,
      "",
      "Connectez-vous avec ce mot de passe, puis changez-le immédiatement.",
      `Page de changement : ${changePasswordUrl}`,
    ].join("\n"),
    html: buildEmailLayout({
      preheader: `Nouveau mot de passe temporaire pour ${params.email}`,
      title: "Mot de passe réinitialisé",
      subtitle: "Vos nouveaux identifiants de connexion",
      variant: "success",
      bodyHtml,
    }),
  });
}
