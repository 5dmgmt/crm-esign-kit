import { adminErrorResponse, requireAdmin } from "@/lib/auth/require-admin";
import { formatDocNumber, getEsignDocumentById } from "@/lib/esign/core";
import { verifyContractContent } from "@/lib/esign/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error) ?? Response.json({ ok: false, reason: "処理できませんでした。" }, { status: 500 });
  }
  try {
    const { id } = await context.params;
    const doc = await getEsignDocumentById(id);
    if (!doc) return Response.json({ ok: false, reason: "契約書が見つかりません。" }, { status: 404 });
    return Response.json({
      ok: true,
      data: {
        ...doc,
        token_hash: undefined,
        docNumber: formatDocNumber(doc.doc_number),
        hashMatches: verifyContractContent(doc.contract_html, doc.content_hash),
      },
    });
  } catch {
    return Response.json({ ok: false, reason: "契約書を読み込めませんでした。" }, { status: 500 });
  }
}
