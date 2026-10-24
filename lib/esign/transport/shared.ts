export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type MailSendResult = {
  ok: boolean;
  skipped?: boolean;
};

export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim();
}

export function safeMessage(message: MailMessage): MailMessage {
  return {
    to: sanitizeHeader(message.to),
    subject: sanitizeHeader(message.subject),
    text: message.text,
  };
}
