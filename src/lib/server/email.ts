import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/server/api-auth";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail(payload: MailPayload): Promise<void> {
  if (!smtpConfigured()) {
    console.info("[email:simulation]", payload.to, payload.subject, payload.text);
    return;
  }

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
