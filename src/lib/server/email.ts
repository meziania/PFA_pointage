import { getAppUrl } from "@/lib/server/api-errors";

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
    html: `
      <p>Bonjour <strong>${params.nom}</strong>,</p>
      <p>Votre demande d'accès à <strong>TimeTrack Pro</strong> a été acceptée.</p>
      <ul>
        <li><strong>Email :</strong> ${params.email}</li>
        <li><strong>Mot de passe temporaire :</strong> ${params.temporaryPassword}</li>
      </ul>
      <p><a href="${loginUrl}">Se connecter</a></p>
      <p><a href="${changePasswordUrl}">Changer mon mot de passe</a></p>
      <p>Vous devrez changer votre mot de passe à la première connexion.</p>
    `,
  });
}

export async function sendAccessRefusedEmail(params: { to: string; nom: string }): Promise<void> {
  await sendMail({
    to: params.to,
    subject: "TimeTrack Pro — Demande d'accès refusée",
    text: [
      `Bonjour ${params.nom},`,
      "",
      "Votre demande d'accès à TimeTrack Pro a été refusée par l'administrateur.",
      "Pour plus d'informations, contactez votre responsable RH.",
    ].join("\n"),
    html: `
      <p>Bonjour <strong>${params.nom}</strong>,</p>
      <p>Votre demande d'accès à <strong>TimeTrack Pro</strong> a été refusée par l'administrateur.</p>
      <p>Pour plus d'informations, contactez votre responsable RH.</p>
    `,
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

  await sendMail({
    to: recipients.join(", "),
    subject: `TimeTrack Pro — Nouvelle demande d'accès : ${params.nom}`,
    text: [
      "Une nouvelle demande pour rejoindre TimeTrack Pro vient d'être soumise.",
      "",
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
    html: `
      <p>Une nouvelle demande pour rejoindre <strong>TimeTrack Pro</strong> vient d'être soumise.</p>
      <ul>
        <li><strong>Nom :</strong> ${params.nom}</li>
        <li><strong>Email :</strong> ${params.email}</li>
        ${params.telephone ? `<li><strong>Téléphone :</strong> ${params.telephone}</li>` : ""}
        ${params.message ? `<li><strong>Message :</strong> ${params.message}</li>` : ""}
        <li><strong>Référence :</strong> ${params.demandeId}</li>
      </ul>
      <p><a href="${adminUrl}">Ouvrir le panneau admin — Demandes d'accès</a></p>
    `,
  });
}
