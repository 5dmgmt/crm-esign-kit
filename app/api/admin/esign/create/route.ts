import { getKitConfig } from "@/lib/config";
import { adminErrorResponse, requireAdmin } from "@/lib/auth/require-admin";
import { createEsignDocument, formatDocNumber } from "@/lib/esign/core";
import { sendSignRequestMail } from "@/lib/esign/mail";
import { ContractValidationError, renderContract } from "@/lib/esign/render";
import { loadContractTemplate } from "@/lib/esign/templates";
import type { ClientKind } from "@/lib/esign/types";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set(["templateId", "clientKind", "clientEmail", "contactId", "sendMail", "fields"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isClientKind(value: unknown): value is ClientKind {
  return value === "individual" || value === "corporation";
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error) ?? Response.json({ ok: false, reason: "処理できませんでした。" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "入力内容を読み取れませんでした。" }, { status: 400 });
  }
  if (!isObject(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    return Response.json({ ok: false, reason: "入力項目をご確認ください。" }, { status: 400 });
  }
  if (
    typeof body.templateId !== "string" ||
    !isClientKind(body.clientKind) ||
    typeof body.clientEmail !== "string" ||
    !EMAIL_PATTERN.test(body.clientEmail.trim()) ||
    (body.contactId !== null && body.contactId !== undefined && typeof body.contactId !== "string") ||
    (body.sendMail !== undefined && typeof body.sendMail !== "boolean")
  ) {
    return Response.json({ ok: false, reason: "入力項目をご確認ください。" }, { status: 400 });
  }

  try {
    const template = await loadContractTemplate(body.templateId);
    const rendered = renderContract(template, body.fields, body.clientKind);
    const title = typeof rendered.fields.title === "string" ? rendered.fields.title : template.schema.name;
    const clientName = typeof rendered.fields.clientName === "string" ? rendered.fields.clientName : "";
    const clientCompany =
      body.clientKind === "corporation" && typeof rendered.fields.clientCompany === "string"
        ? rendered.fields.clientCompany
        : "";
    if (!clientName) {
      return Response.json({ ok: false, reason: "お客様の氏名を入力してください。" }, { status: 400 });
    }
    const stageTag = template.schema.stageTagOnSign;
    if (stageTag && !getKitConfig().stageTags.includes(stageTag)) {
      return Response.json(
        { ok: false, reason: "ひな形の段階タグが設定の一覧にありません。" },
        { status: 400 },
      );
    }
    const { doc, token } = await createEsignDocument({
      contactId: typeof body.contactId === "string" ? body.contactId : null,
      templateId: template.schema.id,
      templateVersion: template.schema.version,
      fields: rendered.fields,
      clientKind: body.clientKind,
      stageTagOnSign: stageTag,
      title,
      clientCompany,
      clientRepresentative: clientName,
      clientEmail: body.clientEmail,
      contractHtml: rendered.html,
    });
    const signUrl = `${getKitConfig().siteUrl}/contract/sign/${token}`;
    if (body.sendMail === true && !(await sendSignRequestMail(doc, signUrl))) {
      return Response.json(
        {
          ok: false,
          reason: "契約書は作成されましたが、メールを送信できませんでした。署名用リンクをお渡しください。",
          data: { id: doc.id, docNumber: formatDocNumber(doc.doc_number), signUrl },
        },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      data: { id: doc.id, docNumber: formatDocNumber(doc.doc_number), signUrl },
    });
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return Response.json({ ok: false, reason: error.issues.join(" ") }, { status: 400 });
    }
    return Response.json(
      { ok: false, reason: "契約書を作成できませんでした。少し時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
