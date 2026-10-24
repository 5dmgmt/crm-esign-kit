import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EsignDocument } from "@/lib/esign/core";
import { resetSignRateLimitForTests } from "@/lib/esign/rate-limit";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  hook: vi.fn(),
  mail: vi.fn(),
}));

vi.mock("@/lib/esign/core", async () => {
  const actual = await vi.importActual<typeof import("@/lib/esign/core")>("@/lib/esign/core");
  return { ...actual, signEsignDocument: mocks.sign };
});
vi.mock("@/lib/esign/hooks", () => ({ onContractSigned: mocks.hook }));
vi.mock("@/lib/esign/mail", () => ({ sendSignedMails: mocks.mail }));

import { POST } from "@/app/api/esign/sign/route";

const doc = {
  id: "00000000-0000-4000-8000-000000000001",
  doc_number: 1,
  contact_id: null,
  template_id: "sample-gyomu-itaku",
  template_version: "1.0.0",
  fields: { clientName: "山田 花子" },
  client_kind: "corporation",
  stage_tag_on_sign: "契約",
  title: "見本契約書",
  client_company: "株式会社サンプル商事",
  client_representative: "山田 花子",
  client_email: "sample@example.com",
  contract_html: "<p>見本</p>",
  content_hash: "0".repeat(64),
  status: "signed",
  token_hash: "1".repeat(64),
  token_expires_at: "2099-01-01T00:00:00.000Z",
  sent_at: "2026-01-01T00:00:00.000Z",
  client_signed_at: "2026-01-01T00:01:00.000Z",
  client_sign_company: "株式会社サンプル商事",
  client_sign_name: "山田 花子",
  client_sign_ip: "127.0.0.1",
  client_sign_ua: "test",
  issuer_signed_at: "2026-01-01T00:00:00.000Z",
  issuer_name: "株式会社サンプル商事 代表取締役 山田 花子",
  void_reason: null,
  voided_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:01:00.000Z",
} satisfies EsignDocument;

function request(body: Record<string, unknown>, ip = "127.0.0.1") {
  return new Request("http://localhost/api/esign/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip, "user-agent": "test" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  token: "a".repeat(43),
  signCompany: "株式会社サンプル商事",
  signName: "山田 花子",
  consent: true,
  website: "",
};

describe("署名 API", () => {
  beforeEach(() => {
    resetSignRateLimitForTests();
    mocks.sign.mockResolvedValue({ ok: true, doc });
    mocks.hook.mockResolvedValue(undefined);
    mocks.mail.mockResolvedValue(true);
  });

  it("honeypot が埋まっていれば処理せず成功として返す", async () => {
    const response = await POST(request({ ...validBody, website: "bot" }));
    expect(response.status).toBe(200);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("1分に5回を超える入力を制限する", async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await POST(request({ ...validBody, consent: false }, "192.0.2.10"))).status).toBe(400);
    }
    expect((await POST(request({ ...validBody, consent: false }, "192.0.2.10"))).status).toBe(429);
  });

  it("署名を記録して成功を返す", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("署名済みの再送信は 409", async () => {
    mocks.sign.mockResolvedValueOnce({ ok: false, reason: "already_signed" });
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
  });

  it("フックが失敗しても署名成功を返す", async () => {
    mocks.hook.mockRejectedValueOnce(new Error("hook_failed"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
