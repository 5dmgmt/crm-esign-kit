import "server-only";

import { getKitConfig } from "@/lib/config";
import { sendWithNone } from "./none";
import { sendWithResend } from "./resend";
import { sendWithSmtp } from "./smtp";
import type { MailMessage, MailSendResult } from "./shared";

export async function sendMailMessage(message: MailMessage): Promise<MailSendResult> {
  const transport = getKitConfig().mail.transport;
  if (transport === "smtp") return sendWithSmtp(message);
  if (transport === "resend") return sendWithResend(message);
  return sendWithNone(message);
}
