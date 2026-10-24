import { adminErrorResponse, requireAdmin } from "@/lib/auth/require-admin";
import { formatDocNumber, listEsignDocuments } from "@/lib/esign/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error) ?? Response.json({ ok: false, reason: "処理できませんでした。" }, { status: 500 });
  }
  try {
    const documents = await listEsignDocuments(50);
    return Response.json({
      ok: true,
      data: documents.map((doc) => ({
        id: doc.id,
        docNumber: formatDocNumber(doc.doc_number),
        title: doc.title,
        clientCompany: doc.client_company,
        clientName: doc.client_representative,
        status: doc.status,
        sentAt: doc.sent_at,
        signedAt: doc.client_signed_at,
      })),
    });
  } catch {
    return Response.json({ ok: false, reason: "契約書の一覧を読み込めませんでした。" }, { status: 500 });
  }
}
