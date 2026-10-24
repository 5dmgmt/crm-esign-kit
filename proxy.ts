import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth";

function cspHeader(): string {
  const development = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminApi || isAdminPage) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const email = typeof token?.email === "string" ? token.email : null;
    if (!email) {
      if (isAdminApi) {
        return NextResponse.json({ ok: false, reason: "認証が必要です。" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminEmail(email)) {
      if (isAdminApi) {
        return NextResponse.json({ ok: false, reason: "権限がありません。" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  const response = NextResponse.next();
  if (!pathname.startsWith("/api/")) response.headers.set("Content-Security-Policy", cspHeader());
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
