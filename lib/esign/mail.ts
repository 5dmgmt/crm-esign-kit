import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getKitConfig } from "@/lib/config";
import { formatDocNumber, type EsignDocument } from "@/lib/esign/core";
import { sendMailMessage } from "@/lib/esign/transport";

export function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "long",
    timeStyle: "medium",
  }).format(new Date(iso));
}

async function renderMailTemplate(name: string, values: Record<string, string>): Promise<string> {
  const source = await fs.readFile(path.join(process.cwd(), "templates", "mail", `${name}.txt`), "utf8");
  return source.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_all, key) => values[key] ?? "");
}

function commonValues(doc: EsignDocument, signUrl: string): Record<string, string> {
  const issuer = getKitConfig().issuer;
  return {
    clientCompany: doc.client_company,
    clientName: doc.client_representative,
    title: doc.title.replace(/[\r\n]+/g, " ").trim(),
    signUrl,
    docNumber: formatDocNumber(doc.doc_number),
    signedAt: doc.client_signed_at ? formatJst(doc.client_signed_at) : "",
    issuerCompany: issuer.companyName,
    issuerRepresentative: `${issuer.representativeTitle} ${issuer.representativeName}`,
    issuerEmail: issuer.contactEmail,
    issuerPhone: issuer.phone ?? "",
  };
}

export async function sendSignRequestMail(doc: EsignDocument, signUrl: string): Promise<boolean> {
  const text = await renderMailTemplate("sign-request", commonValues(doc, signUrl));
  const result = await sendMailMessage({
    to: doc.client_email,
    subject: `【契約書】${doc.title}のご確認をお願いします`,
    text,
  });
  return result.ok;
}

export async function sendSignedMails(doc: EsignDocument, signUrl: string): Promise<boolean> {
  if (!doc.client_signed_at) return false;
  const values = commonValues(doc, signUrl);
  const [clientText, issuerText] = await Promise.all([
    renderMailTemplate("signed-client", values),
    renderMailTemplate("signed-issuer", values),
  ]);
  const subject = `【契約書】${doc.title}の締結記録（${values.docNumber}）`;
  const results = await Promise.allSettled([
    sendMailMessage({ to: doc.client_email, subject, text: clientText }),
    sendMailMessage({ to: getKitConfig().issuer.contactEmail, subject, text: issuerText }),
  ]);
  return results.every((result) => result.status === "fulfilled" && result.value.ok);
}
