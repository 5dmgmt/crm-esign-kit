import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { InputError, assertAllowedKeys, isUuid, validateNote } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("連絡先が見つかりません。", 404);
  const { data, error } = await getDb().from("contact_notes").select("*").eq("contact_id", id).order("created_at", { ascending: false });
  return error ? jsonError("メモを読み込めませんでした。", 500) : jsonOk(data ?? []);
}

export async function POST(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    const value = validateNote(body);
    const { data, error } = await getDb().from("contact_notes").insert({ contact_id: id, ...value }).select("*").single();
    if (error) throw new Error("insert_failed");
    return jsonOk(data, { status: 201 });
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("メモを保存できませんでした。（入力内容は残っています）", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id: contactId } = await context.params;
  const body = await readJson(request);
  if (!isUuid(contactId) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    assertAllowedKeys(body, ["id", "done"]);
    if (!isUuid(body.id) || typeof body.done !== "boolean") throw new InputError("フォロー予定をご確認ください。");
    const { data, error } = await getDb().from("contact_notes")
      .update({ done_at: body.done ? new Date().toISOString() : null })
      .eq("id", body.id)
      .eq("contact_id", contactId)
      .eq("note_type", "follow")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("update_failed");
    return data ? jsonOk(data) : jsonError("フォロー予定が見つかりません。", 404);
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("フォロー予定を更新できませんでした。", 500);
  }
}

