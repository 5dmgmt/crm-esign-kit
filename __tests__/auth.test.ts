import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_MAX_AGE_SECONDS, authOptions, isAdminEmail } from "@/lib/auth";

type SignInArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["signIn"]>>[0];

async function signIn(email: string | null | undefined, profile: unknown): Promise<boolean | string> {
  const callback = authOptions.callbacks?.signIn;
  if (!callback) throw new Error("signIn callback missing");
  return callback({
    user: { id: "user-1", email },
    account: null,
    profile,
  } as SignInArgs);
}

describe("管理ログイン", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Google が確認済みと答えたメールはログインできる", async () => {
    expect(await signIn("admin@example.com", { email_verified: true })).toBe(true);
  });

  it("email_verified が false のときはログインできない", async () => {
    expect(await signIn("admin@example.com", { email_verified: false })).toBe(false);
  });

  it("email_verified が無いとき・profile が無いときはログインできない", async () => {
    expect(await signIn("admin@example.com", {})).toBe(false);
    expect(await signIn("admin@example.com", undefined)).toBe(false);
  });

  it("email_verified が true 以外の値（文字列など）のときはログインできない", async () => {
    expect(await signIn("admin@example.com", { email_verified: "true" })).toBe(false);
    expect(await signIn("admin@example.com", { email_verified: 1 })).toBe(false);
  });

  it("確認済みでも、メールが空のときはログインできない", async () => {
    expect(await signIn("  ", { email_verified: true })).toBe(false);
    expect(await signIn(null, { email_verified: true })).toBe(false);
  });

  it("ログインは 7 日で切れる（セッションとログインの記録の両方）", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(authOptions.session?.maxAge).toBe(7 * 24 * 60 * 60);
    expect(authOptions.jwt?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("管理者の判定は ADMIN_EMAILS のままで、大文字と小文字は同じものとして扱う", () => {
    vi.stubEnv("ADMIN_EMAILS", "Owner@Example.com, staff@example.com");
    expect(isAdminEmail("owner@example.com")).toBe(true);
    expect(isAdminEmail(" STAFF@example.com ")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});
