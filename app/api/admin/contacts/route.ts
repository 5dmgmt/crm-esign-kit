import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { getKitConfig } from "@/lib/config";
import { listContacts } from "@/lib/crm/repository";
import { InputError, validateContact } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  if (status && status !== "active" && status !== "archived" && status !== "all") {
    return jsonError("状態をご確認ください。", 400);
  }
  const contactStatus = status as "active" | "archived" | "all" | null;
  const stage = url.searchParams.get("stage")?.trim() || undefined;
  if (stage && !getKitConfig().stageTags.includes(stage)) return jsonError("段階をご確認ください。", 400);
  const search = url.searchParams.get("search")?.slice(0, 200);
  const tag = url.searchParams.get("tag")?.slice(0, 50);
  const sort = url.searchParams.get("sort") === "updated" ? "updated" : "last_contact";
  try {
    return jsonOk(await listContacts({ search, tag, stage, status: contactStatus ?? undefined, sort }));
  } catch {
    return jsonError("連絡先を読み込めませんでした。時間をおいてもう一度お試しください。", 500);
  }
}

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return jsonError("入力内容を読み取れませんでした。", 400);
  try {
    const value = validateContact(body);
    const { data, error } = await getDb().from("contacts").insert(value).select("*").single();
    if (error?.code === "23505") return jsonError("同じメールの連絡先が登録されています。", 409);
    if (error || !data) throw new Error("insert_failed");
    return jsonOk(data, { status: 201 });
  } catch (error) {
    if (error instanceof InputError) return jsonError(error.message, 400);
    return jsonError("連絡先を登録できませんでした。（入力内容は残っています）", 500);
  }
}
