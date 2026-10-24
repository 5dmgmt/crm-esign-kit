import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEsignDocument,
  generateToken,
  sha256Hex,
  signEsignDocument,
  voidEsignDocument,
  type EsignDocument,
  type EsignInsert,
  type EsignRepository,
  type EsignSignUpdate,
} from "@/lib/esign/core";

function repository(seed?: Partial<EsignDocument>) {
  let row: EsignDocument | null = null;
  const repo: EsignRepository = {
    async create(input: EsignInsert) {
      row = {
        ...input,
        id: "00000000-0000-4000-8000-000000000001",
        doc_number: 1,
        client_signed_at: null,
        client_sign_company: null,
        client_sign_name: null,
        client_sign_ip: null,
        client_sign_ua: null,
        void_reason: null,
        voided_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...seed,
      };
      return row;
    },
    async findByTokenHash(tokenHash: string) {
      return row?.token_hash === tokenHash ? row : null;
    },
    async findById() { return row; },
    async list() { return row ? [row] : []; },
    async signIfSent(_id: string, update: EsignSignUpdate) {
      if (!row || row.status !== "sent") return null;
      row = { ...row, ...update };
      return row;
    },
    async void(_id: string, reason: string, at: string) {
      if (!row || row.status !== "sent") return null;
      row = { ...row, status: "void", void_reason: reason, voided_at: at };
      return row;
    },
  };
  return repo;
}

async function create(repo: EsignRepository) {
  return createEsignDocument({
    templateId: "sample-gyomu-itaku",
    templateVersion: "1.0.0",
    fields: { clientName: "山田 花子" },
    clientKind: "corporation",
    title: "見本契約書",
    clientCompany: "株式会社サンプル商事",
    clientRepresentative: "山田 花子",
    clientEmail: "sample@example.com",
    contractHtml: "<p>見本</p>",
  }, repo);
}

describe("電子契約の中核", () => {
  beforeEach(() => vi.useRealTimers());

  it("締結済みの文書は無効にできない", async () => {
    const repo = repository({ status: "signed" });
    const { doc } = await create(repo);
    expect(doc.status).toBe("signed");
    expect(await voidEsignDocument(doc.id, "取り下げ", repo)).toEqual({ ok: false, reason: "not_found" });
  });

  it("32バイトの base64url トークンを生成する", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("本文を SHA-256 でハッシュ化する", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("二重署名を拒否する", async () => {
    const repo = repository();
    const { token } = await create(repo);
    const input = { token, signCompany: "株式会社サンプル商事", signName: "山田 花子", ip: "127.0.0.1", userAgent: "test" };
    expect((await signEsignDocument(input, repo)).ok).toBe(true);
    expect(await signEsignDocument(input, repo)).toEqual({ ok: false, reason: "already_signed" });
  });

  it("期限切れでは署名できない", async () => {
    const repo = repository({ token_expires_at: "2000-01-01T00:00:00.000Z" });
    const { token } = await create(repo);
    expect((await signEsignDocument({ token, signCompany: "株式会社サンプル商事", signName: "山田 花子", ip: "127.0.0.1", userAgent: "test" }, repo))).toEqual({ ok: false, reason: "expired" });
  });

  it("無効な契約書には署名できない", async () => {
    const repo = repository({ status: "void" });
    const { token } = await create(repo);
    expect((await signEsignDocument({ token, signCompany: "株式会社サンプル商事", signName: "山田 花子", ip: "127.0.0.1", userAgent: "test" }, repo))).toEqual({ ok: false, reason: "void" });
  });
});
