import { adminErrorResponse, requireAdmin } from "@/lib/auth/require-admin";
import { jsonError, sameOriginError } from "@/lib/api";

export async function guardAdmin(): Promise<Response | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    return adminErrorResponse(error) ?? jsonError("処理できませんでした。", 500);
  }
}

export async function guardAdminWrite(request: Request): Promise<Response | null> {
  const authError = await guardAdmin();
  return authError ?? sameOriginError(request);
}

