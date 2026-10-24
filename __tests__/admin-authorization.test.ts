import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ status: 401 as 401 | 403 }));

vi.mock("@/lib/auth/require-admin", () => {
  class AdminAuthorizationError extends Error {
    constructor(public readonly status: 401 | 403) { super("authorization"); }
  }
  return {
    AdminAuthorizationError,
    requireAdmin: vi.fn(async () => { throw new AdminAuthorizationError(authState.status); }),
    adminErrorResponse: (error: unknown) => {
      if (!(error instanceof AdminAuthorizationError)) return null;
      return Response.json({ ok: false, reason: error.status === 401 ? "認証が必要です。" : "権限がありません。" }, { status: error.status });
    },
  };
});

type RouteHandler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Record<string, RouteHandler>;

const routeModules = import.meta.glob<RouteModule>("../app/api/admin/**/route.ts", { eager: true });

async function callEveryRoute(expectedStatus: number) {
  const results: Array<{ path: string; method: string; status: number }> = [];
  for (const [path, module] of Object.entries(routeModules)) {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const handler = module[method];
      if (typeof handler !== "function") continue;
      const request = new Request(`http://localhost${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      });
      const response = await handler(request, { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) });
      results.push({ path, method, status: response.status });
    }
  }
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((result) => result.status === expectedStatus), JSON.stringify(results)).toBe(true);
}

describe("管理 API の認可総当たり", () => {
  beforeEach(() => { authState.status = 401; });
  it("未ログインは全ルートが 401", async () => callEveryRoute(401));
  it("許可外のメールは全ルートが 403", async () => { authState.status = 403; await callEveryRoute(403); });
});
