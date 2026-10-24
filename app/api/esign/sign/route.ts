import { getKitConfig } from "@/lib/config";
import { onContractSigned } from "@/lib/esign/hooks";
import { sendSignedMails } from "@/lib/esign/mail";
import { checkSignRateLimit, clientIp } from "@/lib/esign/rate-limit";
import { normalizeSignerInput, signEsignDocument } from "@/lib/esign/core";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set(["token", "signCompany", "signName", "consent", "website"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "入力内容を読み取れませんでした。" }, { status: 400 });
  }
  if (!isObject(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    return Response.json({ ok: false, reason: "入力項目をご確認ください。" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });

  const ip = normalizeSignerInput(clientIp(request), 64);
  if (!checkSignRateLimit(ip)) {
    return Response.json(
      { ok: false, reason: "短時間に送信が続きました。少し時間をおいてお試しください。" },
      { status: 429 },
    );
  }
  if (body.consent !== true) {
    return Response.json({ ok: false, reason: "契約内容への同意をご確認ください。" }, { status: 400 });
  }
  if (
    typeof body.token !== "string" ||
    body.token.length > 60 ||
    typeof body.signCompany !== "string" ||
    typeof body.signName !== "string"
  ) {
    return Response.json({ ok: false, reason: "署名内容をご確認ください。" }, { status: 400 });
  }

  try {
    const result = await signEsignDocument({
      token: body.token,
      signCompany: normalizeSignerInput(body.signCompany),
      signName: normalizeSignerInput(body.signName),
      ip,
      userAgent: normalizeSignerInput(request.headers.get("user-agent") ?? "", 256),
    });
    if (!result.ok) {
      const status = result.reason === "already_signed" ? 409 : result.reason === "expired" || result.reason === "void" ? 410 : 400;
      const reason =
        result.reason === "content_mismatch"
          ? "契約書の内容を確認できませんでした。発行者へお知らせください。"
          : result.reason === "already_signed"
            ? "この契約書は署名済みです。"
            : result.reason === "expired" || result.reason === "void"
              ? "この署名用リンクは現在利用できません。"
              : "署名内容をご確認ください。";
      return Response.json({ ok: false, reason }, { status });
    }

    const signUrl = `${getKitConfig().siteUrl}/contract/sign/${body.token}`;
    try {
      await onContractSigned(result.doc);
    } catch {
      // 署名記録を優先し、付随する台帳更新の失敗では巻き戻しません。
    }
    try {
      await sendSignedMails(result.doc, signUrl);
    } catch {
      // 署名記録を優先し、通知の失敗では巻き戻しません。
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, reason: "電子署名を記録できませんでした。少し時間をおいてお試しください。" },
      { status: 500 },
    );
  }
}
