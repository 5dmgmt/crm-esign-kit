import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { InputError, assertAllowedKeys, isUuid, validateHttpUrl } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("資料が見つかりません。", 404);
  const db = getDb();
  const { data, error } = await db.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) return jsonError("資料を読み込めませんでした。", 500);
  if (!data) return jsonError("資料が見つかりません。", 404);
  let signedUrl: string | null = null;
  if (data.storage_path) {
    const signed = await db.storage.from("crm-documents").createSignedUrl(data.storage_path, 600);
    if (signed.error) return jsonError("資料を開くためのURLを作れませんでした。", 500);
    signedUrl = signed.data.signedUrl;
  }
  return jsonOk({ ...data, signedUrl });
}

export async function PATCH(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    assertAllowedKeys(body, ["title", "version", "sourceUrl"]);
    const update: Record<string, string> = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 200) throw new InputError("資料名は200文字以内で入力してください。");
      update.title = body.title.trim();
    }
    if (body.version !== undefined) {
      if (typeof body.version !== "string" || !body.version.trim() || body.version.trim().length > 50) throw new InputError("版は50文字以内で入力してください。");
      update.version = body.version.trim();
    }
    if (body.sourceUrl !== undefined) update.source_url = validateHttpUrl(body.sourceUrl);
    if (!Object.keys(update).length) throw new InputError("変更する項目を入力してください。");
    const { data, error } = await getDb().from("documents").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error("update_failed");
    return data ? jsonOk(data) : jsonError("資料が見つかりません。", 404);
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("資料を保存できませんでした。（入力内容は残っています）", 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("資料が見つかりません。", 404);
  const db = getDb();
  const { data, error: lookupError } = await db.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (lookupError) return jsonError("資料を確認できませんでした。", 500);
  if (!data) return jsonError("資料が見つかりません。", 404);
  const { error } = await db.from("documents").delete().eq("id", id);
  if (error) return jsonError("資料を削除できませんでした。", 500);
  if (data.storage_path) await db.storage.from("crm-documents").remove([data.storage_path]);
  return jsonOk();
}

