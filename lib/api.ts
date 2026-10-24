import { getKitConfig } from "@/lib/config";

export function jsonOk<T>(data?: T, init?: ResponseInit): Response {
  return Response.json(data === undefined ? { ok: true } : { ok: true, data }, init);
}

export function jsonError(reason: string, status: number): Response {
  return Response.json({ ok: false, reason }, { status });
}

export function sameOriginError(request: Request): Response | null {
  const origin = request.headers.get("origin");
  let expected: string;
  try {
    expected = new URL(getKitConfig().siteUrl).origin;
  } catch {
    return jsonError("サイトのURL設定をご確認ください。", 500);
  }
  if (!origin) return jsonError("この操作は管理画面から行ってください。", 403);
  try {
    if (new URL(origin).origin !== expected) {
      return jsonError("この操作は管理画面から行ってください。", 403);
    }
  } catch {
    return jsonError("この操作は管理画面から行ってください。", 403);
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

