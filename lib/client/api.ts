export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "network" | "auth" | "server"; reason: string };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (response.redirected || !contentType.includes("application/json")) {
      return { ok: false, kind: "auth", reason: "ログイン状態を確認できませんでした。画面を再読み込みしてください。" };
    }
    const payload = (await response.json()) as { ok?: boolean; data?: T; reason?: string };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: "auth", reason: payload.reason ?? "操作する権限を確認できませんでした。画面を再読み込みしてください。" };
    }
    if (!response.ok || payload.ok !== true) {
      return { ok: false, kind: "server", reason: payload.reason ?? "処理を完了できませんでした。" };
    }
    return { ok: true, data: payload.data as T };
  } catch {
    return { ok: false, kind: "network", reason: "通信が途切れたようです。接続を確かめて、もう一度お試しください。" };
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function getJson<T>(url: string): Promise<ApiResult<T>> { return request<T>(url); }
export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> { return request<T>(url, jsonInit("POST", body)); }
export function patchJson<T>(url: string, body: unknown): Promise<ApiResult<T>> { return request<T>(url, jsonInit("PATCH", body)); }
export function deleteJson<T>(url: string, body?: unknown): Promise<ApiResult<T>> { return request<T>(url, jsonInit("DELETE", body)); }
export function postForm<T>(url: string, body: FormData): Promise<ApiResult<T>> { return request<T>(url, { method: "POST", body }); }

