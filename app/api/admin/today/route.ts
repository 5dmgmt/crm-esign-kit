import { jsonError, jsonOk } from "@/lib/api";
import { guardAdmin } from "@/lib/auth/admin-api";
import { getTodayOverview } from "@/lib/crm/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardAdmin();
  if (denied) return denied;
  try {
    return jsonOk(await getTodayOverview());
  } catch {
    return jsonError("今日の予定を読み込めませんでした。", 500);
  }
}

