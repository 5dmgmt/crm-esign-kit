import "server-only";

import nodemailer from "nodemailer";
import { getKitConfig } from "@/lib/config";
import { safeMessage, sanitizeHeader, type MailMessage, type MailSendResult } from "./shared";

export async function sendWithSmtp(message: MailMessage): Promise<MailSendResult> {
  const port = Number(process.env.SMTP_PORT ?? "587");
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !Number.isInteger(port)) {
    return { ok: false };
  }
  const config = getKitConfig();
  const fromAddress = process.env.SMTP_FROM || process.env.MAIL_FROM || config.issuer.contactEmail;
  const safe = safeMessage(message);
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({
      from: `${sanitizeHeader(config.mail.fromName)} <${sanitizeHeader(fromAddress)}>`,
      to: safe.to,
      subject: safe.subject,
      text: safe.text,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
