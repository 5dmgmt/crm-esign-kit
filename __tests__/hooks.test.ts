import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EsignDocument } from "@/lib/esign/core";

const state = vi.hoisted(() => ({ enabled: true }));
const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn() }));

vi.mock("@/lib/config", () => ({
  getKitConfig: () => ({ autoAdvanceStageOnSign: state.enabled }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({ from: mocks.from }) }));

import { onContractSigned } from "@/lib/esign/hooks";

const doc = {
  id: "00000000-0000-4000-8000-000000000001", doc_number: 7, contact_id: "00000000-0000-4000-8000-000000000002",
  template_id: "sample-gyomu-itaku", template_version: "1.0.0", fields: {}, client_kind: "corporation",
  stage_tag_on_sign: "契約", title: "見本契約書", client_company: "株式会社サンプル商事", client_representative: "山田 花子",
  client_email: "sample@example.com", contract_html: "<p>見本</p>", content_hash: "0".repeat(64), status: "signed",
  token_hash: "1".repeat(64), token_expires_at: "2099-01-01T00:00:00.000Z", sent_at: "2026-01-01T00:00:00.000Z",
  client_signed_at: "2026-01-02T00:00:00.000Z", client_sign_company: "株式会社サンプル商事", client_sign_name: "山田 花子",
  client_sign_ip: "127.0.0.1", client_sign_ua: "test", issuer_signed_at: "2026-01-01T00:00:00.000Z", issuer_name: "発行者",
  void_reason: null, voided_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z",
} satisfies EsignDocument;

describe("契約締結フック", () => {
  beforeEach(() => {
    state.enabled = true;
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => table === "contacts" ? { update: mocks.update } : { insert: mocks.insert });
  });

  it("連絡先の段階を更新して締結のやりとりを追加する", async () => {
    await onContractSigned(doc);
    expect(mocks.update).toHaveBeenCalledWith({ stage: "契約", last_contact_at: doc.client_signed_at });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      contact_id: doc.contact_id,
      interaction_type: "note",
      subject: "契約を締結（文書番号 0000007）",
    }));
  });

  it("設定がfalseなら何もしない", async () => {
    state.enabled = false;
    await onContractSigned(doc);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

