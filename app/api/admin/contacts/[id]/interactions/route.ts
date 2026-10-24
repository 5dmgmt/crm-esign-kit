import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { InputError, isUuid, validateInteraction } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("連絡先が見つかりません。", 404);
  const { data, error } = await getDb().from("interactions").select("*").eq("contact_id", id).order("occurred_at", { ascending: false });
  return error ? jsonError("やりとりを読み込めませんでした。", 500) : jsonOk(data ?? []);
}

export async function POST(request: Request, context: Context) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return jsonError("入力内容をご確認ください。", 400);
  try {
    const value = validateInteraction(body);
    const db = getDb();
    const { data, error } = await db.from("interactions").insert({ contact_id: id, ...value }).select("*").single();
    if (error) throw new Error("insert_failed");
    const { error: contactError } = await db.from("contacts").update({ last_contact_at: value.occurred_at }).eq("id", id);
    if (contactError) throw new Error("contact_update_failed");
    return jsonOk(data, { status: 201 });
  } catch (error) {
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("やりとりを保存できませんでした。（入力内容は残っています）", 500);
  }
}

