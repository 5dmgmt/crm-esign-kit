import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mocks.sendMail }) },
}));

import { sendWithResend } from "@/lib/esign/transport/resend";
import { sendWithSmtp } from "@/lib/esign/transport/smtp";

const message = {
  to: "client@example.com",
  subject: "【契約書】見本契約書のご確認をお願いします",
  text: "署名用リンク: https://example.com/contract/sign/secret-token-value",
};

function expectSingleSafeLog(logged: ReturnType<typeof vi.spyOn>, reason: string) {
  expect(logged).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledWith(`[esign] notify failed: ${reason}`);
  const output = JSON.stringify(logged.mock.calls);
  for (const secret of ["client@example.com", "見本契約書", "secret-token-value", "test-api-key", "test-smtp-pass", "internal detail"]) {
    expect(output).not.toContain(secret);
  }
}

describe("メール送信の失敗ログ（Resend）", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-api-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("送信が成功したときは、ログを出さない", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValueOnce({ data: { id: "mail-1" }, error: null });
    expect(await sendWithResend(message)).toEqual({ ok: true });
    expect(logged).not.toHaveBeenCalled();
  });

  it("API が拒否したときは rejected とだけ 1 回ログに出す（応答の中身・宛先は出さない）", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "internal detail client@example.com" } });
    expect(await sendWithResend(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "rejected");
  });

  it("通信などで例外になったときは network とだけ 1 回ログに出す", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValueOnce(new Error("internal detail client@example.com test-api-key"));
    expect(await sendWithResend(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "network");
  });

  it("API キーが無いときは config とだけ 1 回ログに出す", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendWithResend(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "config");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("メール送信の失敗ログ（SMTP）", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user@example.com");
    vi.stubEnv("SMTP_PASS", "test-smtp-pass");
    vi.stubEnv("SMTP_PORT", "587");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("送信が成功したときは、ログを出さない", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendMail.mockResolvedValueOnce({ messageId: "mail-1" });
    expect(await sendWithSmtp(message)).toEqual({ ok: true });
    expect(logged).not.toHaveBeenCalled();
  });

  it("相手のサーバーが拒否したときは rejected とだけ 1 回ログに出す", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendMail.mockRejectedValueOnce(Object.assign(new Error("internal detail client@example.com"), { code: "EENVELOPE" }));
    expect(await sendWithSmtp(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "rejected");
  });

  it("つながらなかったときは network とだけ 1 回ログに出す", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendMail.mockRejectedValueOnce(Object.assign(new Error("internal detail test-smtp-pass"), { code: "ETIMEDOUT" }));
    expect(await sendWithSmtp(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "network");
  });

  it("設定が足りないときは config とだけ 1 回ログに出す", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendWithSmtp(message)).toEqual({ ok: false });
    expectSingleSafeLog(logged, "config");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
