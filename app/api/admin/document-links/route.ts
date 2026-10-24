import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdminWrite } from "@/lib/auth/admin-api";
import { InputError, assertAllowedKeys, isUuid } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return jsonError("入力内容をご確認ください。", 400);
  try {
    assertAllowedKeys(body, ["documentId", "interactionId"]);
    if (!isUuid(body.documentId) || !isUuid(body.interactionId)) throw new InputError("資料とやりとりをご確認ください。");
    const db = getDb();
    const [document, interaction] = await Promise.all([
      db.from("documents").select("id,contact_id").eq("id", body.documentId).maybeSingle(),
      db.from("interactions").select("id,contact_id").eq("id", body.interactionId).maybeSingle(),
    ]);
    if (document.error || interaction.error) throw new Error("lookup_failed");
    if (!document.data || !interaction.data || !document.data.contact_id || document.data.contact_id !== interaction.data.contact_id) {
      throw new InputError("同じ連絡先の資料とやりとりを選んでください。");
    }
    const { data, error } = await db.from("document_links").insert({
      document_id: body.documentId,
      interaction_id: body.interactionId,
      contact_id: document.data.contact_id,
    }).select("*").single();
    if (error?.code === "23505") return jsonOk();
    if (error) throw new Error("insert_failed");
    return jsonOk(data, { status: 201 });
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("資料を紐付けられませんでした。", 500);
  }
}

export async function DELETE(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return jsonError("入力内容をご確認ください。", 400);
  try {
    assertAllowedKeys(body, ["documentId", "interactionId"]);
    if (!isUuid(body.documentId) || !isUuid(body.interactionId)) throw new InputError("資料とやりとりをご確認ください。");
    const { error } = await getDb().from("document_links").delete().eq("document_id", body.documentId).eq("interaction_id", body.interactionId);
    if (error) throw new Error("delete_failed");
    return jsonOk();
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("資料の紐付けを外せませんでした。", 500);
  }
}

