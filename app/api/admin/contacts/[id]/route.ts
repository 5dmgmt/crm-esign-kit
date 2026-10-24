import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { contactName } from "@/lib/crm/types";
import { getContactKarte } from "@/lib/crm/repository";
import { InputError, assertAllowedKeys, isUuid, validateContact } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("連絡先が見つかりません。", 404);
  try {
    const karte = await getContactKarte(id);
    return karte ? jsonOk(karte) : jsonError("連絡先が見つかりません。", 404);
  } catch {
    return jsonError("連絡先を読み込めませんでした。", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    const value = validateContact(body);
    const { data, error } = await getDb().from("contacts").update(value).eq("id", id).select("*").maybeSingle();
    if (error?.code === "23505") return jsonError("同じメールの連絡先が登録されています。", 409);
    if (error) throw new Error("update_failed");
    return data ? jsonOk(data) : jsonError("連絡先が見つかりません。", 404);
  } catch (error) {
    if (error instanceof InputError) return jsonError(error.message, 400);
    return jsonError("連絡先を保存できませんでした。（入力内容は残っています）", 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    assertAllowedKeys(body, ["mode", "confirmation"]);
    const db = getDb();
    const { data: current, error: lookupError } = await db.from("contacts").select("*").eq("id", id).maybeSingle();
    if (lookupError) throw new Error("lookup_failed");
    if (!current) return jsonError("連絡先が見つかりません。", 404);
    if (body.mode === "archive") {
      const { error } = await db.from("contacts").update({ status: "archived" }).eq("id", id);
      if (error) throw new Error("archive_failed");
      return jsonOk();
    }
    if (body.mode !== "delete" || body.confirmation !== contactName(current)) {
      return jsonError("完全に削除するには、連絡先の氏名を入力してください。", 400);
    }
    const { error } = await db.from("contacts").delete().eq("id", id);
    if (error) throw new Error("delete_failed");
    return jsonOk();
  } catch (error) {
    if (error instanceof InputError) return jsonError(error.message, 400);
    return jsonError("連絡先を削除できませんでした。", 500);
  }
}

