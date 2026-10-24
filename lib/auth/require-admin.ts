import "server-only";

import { getServerSession } from "next-auth";
import { authOptions, isAdminEmail } from "@/lib/auth";

export class AdminAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "unauthenticated" : "forbidden");
    this.name = "AdminAuthorizationError";
  }
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) throw new AdminAuthorizationError(401);
  if (!isAdminEmail(email)) throw new AdminAuthorizationError(403);
  return { email };
}

export function adminErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AdminAuthorizationError)) return null;
  return Response.json(
    { ok: false, reason: error.status === 401 ? "認証が必要です。" : "権限がありません。" },
    { status: error.status },
  );
}
