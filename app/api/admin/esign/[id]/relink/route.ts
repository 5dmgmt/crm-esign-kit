import { getKitConfig } from "@/lib/config";
import { guardAdminWrite } from "@/lib/auth/admin-api";
import { formatDocNumber, reissueSignToken } from "@/lib/esign/core";
import { sendSignRequestMail } from "@/lib/esign/mail";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "入力内容を読み取れませんでした。" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "sendMail") ||
    typeof (body as Record<string, unknown>).sendMail !== "boolean"
  ) {
    return Response.json({ ok: false, reason: "入力項目をご確認ください。" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const result = await reissueSignToken(id);
    if (!result) {
      return Response.json({ ok: false, reason: "署名待ちの契約書だけ、リンクを作り直せます。" }, { status: 404 });
    }
    const signUrl = `${getKitConfig().siteUrl}/contract/sign/${result.token}`;
    const data = { docNumber: formatDocNumber(result.doc.doc_number), signUrl };
    if ((body as { sendMail: boolean }).sendMail && !(await sendSignRequestMail(result.doc, signUrl))) {
      return Response.json(
        { ok: false, reason: "新しいリンクを作りましたが、メールを送信できませんでした。署名用リンクをお渡しください。", data },
        { status: 502 },
      );
    }
    return Response.json({ ok: true, data });
  } catch {
    return Response.json({ ok: false, reason: "署名用リンクを作り直せませんでした。" }, { status: 500 });
  }
}
