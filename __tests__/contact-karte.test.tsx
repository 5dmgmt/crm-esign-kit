import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContactKarte as Karte } from "@/lib/crm/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import ContactKarte from "@/app/admin/contacts/[id]/ContactKarte";

const karte: Karte = {
  contact: {
    id: "00000000-0000-4000-8000-000000000001", last_name: "山田", first_name: "花子", company_name: "株式会社サンプル商事",
    job_title: "代表", email: "sample@example.com", phone: "", postal_code: "", address: "", tags: ["見本"], stage: "見込み",
    status: "active", last_contact_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  },
  notes: [], interactions: [], documents: [], contracts: [],
};

describe("連絡先カルテ", () => {
  it("主要な部品を表示する", () => {
    render(<ContactKarte karte={karte} stageTags={["見込み", "契約"]} />);
    expect(screen.getByRole("heading", { name: "山田 花子" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "プロフィール" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "メモとフォロー" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "やりとりの時系列" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "資料" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "電子契約" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "この連絡先の契約を作る" }).getAttribute("href")).toContain(karte.contact.id);
  });
});

