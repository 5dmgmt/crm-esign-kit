import "server-only";

import nodemailer from "nodemailer";
import { getKitConfig } from "@/lib/config";
import { logNotifyFailure } from "@/lib/esign/notify-log";
import { safeMessage, sanitizeHeader, type MailMessage, type MailSendResult } from "./shared";

// 相手のサーバーが受け付けなかった（認証・宛先・本文の拒否）か、つながらなかったかを、コードで分ける。
const REJECTED_CODES = new Set(["EAUTH", "EENVELOPE", "EMESSAGE"]);

function failureReason(error: unknown): "rejected" | "network" {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && REJECTED_CODES.has(code) ? "rejected" : "network";
}

export async function sendWithSmtp(message: MailMessage): Promise<MailSendResult> {
  const port = Number(process.env.SMTP_PORT ?? "587");
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !Number.isInteger(port)) {
    logNotifyFailure("config");
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
  } catch (error) {
    logNotifyFailure(failureReason(error));
    return { ok: false };
  }
}
