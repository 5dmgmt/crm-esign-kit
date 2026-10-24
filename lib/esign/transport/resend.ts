import "server-only";

import { Resend } from "resend";
import { getKitConfig } from "@/lib/config";
import { safeMessage, sanitizeHeader, type MailMessage, type MailSendResult } from "./shared";

export async function sendWithResend(message: MailMessage): Promise<MailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const config = getKitConfig();
  const fromAddress = process.env.MAIL_FROM || config.issuer.contactEmail;
  if (!apiKey || !fromAddress) return { ok: false };
  const safe = safeMessage(message);
  try {
    const result = await new Resend(apiKey).emails.send({
      from: `${sanitizeHeader(config.mail.fromName)} <${sanitizeHeader(fromAddress)}>`,
      to: safe.to,
      subject: safe.subject,
      text: safe.text,
    });
    return { ok: !result.error };
  } catch {
    return { ok: false };
  }
}
