import { guardAdminWrite } from "@/lib/auth/admin-api";
import { voidEsignDocument } from "@/lib/esign/core";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "無効にする理由を入力してください。" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "reason")) {
    return Response.json({ ok: false, reason: "入力項目をご確認ください。" }, { status: 400 });
  }
  const reason = (body as Record<string, unknown>).reason;
  if (typeof reason !== "string") {
    return Response.json({ ok: false, reason: "無効にする理由を入力してください。" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const result = await voidEsignDocument(id, reason);
    if (!result.ok) {
      const status = result.reason === "reason_required" ? 400 : 404;
      return Response.json(
        { ok: false, reason: status === 400 ? "無効にする理由を入力してください。" : "契約書が見つかりません。" },
        { status },
      );
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, reason: "契約書を無効にできませんでした。" }, { status: 500 });
  }
}
