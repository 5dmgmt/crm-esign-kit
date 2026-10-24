import type { MailMessage, MailSendResult } from "./shared";

export async function sendWithNone(message: MailMessage): Promise<MailSendResult> {
  void message;
  return { ok: true, skipped: true };
}
