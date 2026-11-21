import { beforeEach, describe, expect, it, vi } from "vitest";
import { rowsFromCsv } from "@/lib/crm/csv";

const state = vi.hoisted(() => ({
  contacts: [] as Array<Record<string, unknown>>,
  notes: [] as Array<{ contact_id: string; body: string; created_at: string }>,
  ranges: [] as Array<{ table: string; from: number; to: number }>,
}));

vi.mock("@/lib/auth/admin-api", () => ({ guardAdmin: async () => null }));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: (from: number, to: number) => {
          state.ranges.push({ table, from, to });
          const source = table === "contacts" ? state.contacts : state.notes;
          return Promise.resolve({ data: source.slice(from, to + 1), error: null });
        },
      };
      return builder;
    },
  }),
}));

import { GET } from "@/app/api/admin/contacts/export/route";

function contact(id: string, lastName: string) {
  return {
    id,
    last_name: lastName,
    first_name: "太郎",
    company_name: "",
    job_title: "",
    email: `${id}@example.com`,
    phone: "",
    postal_code: "",
    address: "",
    tags: [],
    stage: "見込み",
    status: "active",
    last_contact_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

// 新しい順に並んだメモを作る（index が大きいほど古い）
function notesNewestFirst(count: number, owner: (index: number) => string) {
  return Array.from({ length: count }, (_, index) => ({
    contact_id: owner(index),
    body: `メモ${index}`,
    created_at: new Date(Date.UTC(2026, 0, 1) - index * 1000).toISOString(),
  }));
}

async function exportRows() {
  const response = await GET();
  expect(response.status).toBe(200);
  return rowsFromCsv(await response.text()).rows;
}

function notesRanges() {
  return state.ranges.filter((call) => call.table === "contact_notes");
}

beforeEach(() => {
  state.contacts = [];
  state.notes = [];
  state.ranges = [];
});

describe("CSV 書き出し", () => {
  it("メモが 2,500 件あっても、古い連絡先のメモまで 1,000 件ずつ読んで CSV に入れる", async () => {
    state.contacts = [contact("c1", "新しい"), contact("c2", "中間"), contact("c3", "古い")];
    // c1 は先頭、c2 は 2 ページ目、c3 は 3 ページ目（最後の 500 件の中）にだけメモがある
    state.notes = notesNewestFirst(2500, (index) => (index === 0 ? "c1" : index === 1500 ? "c2" : index === 2499 ? "c3" : "other"));
    const rows = await exportRows();
    const memoOf = (lastName: string) => rows.find((row) => row.lastName === lastName)?.memo;
    expect(memoOf("新しい")).toBe("メモ0");
    expect(memoOf("中間")).toBe("メモ1500");
    expect(memoOf("古い")).toBe("メモ2499");
    expect(notesRanges()).toEqual([
      { table: "contact_notes", from: 0, to: 999 },
      { table: "contact_notes", from: 1000, to: 1999 },
      { table: "contact_notes", from: 2000, to: 2999 },
    ]);
  });

  it("連絡先ごとに、いちばん新しいメモだけを入れる", async () => {
    state.contacts = [contact("c1", "山田")];
    state.notes = [
      { contact_id: "c1", body: "新しいメモ", created_at: "2026-02-01T00:00:00.000Z" },
      { contact_id: "c1", body: "古いメモ", created_at: "2026-01-01T00:00:00.000Z" },
    ];
    const rows = await exportRows();
    expect(rows[0].memo).toBe("新しいメモ");
    expect(notesRanges()).toHaveLength(1);
  });

  it("2 ページにまたがる同じ連絡先のメモは、新しい方を入れる", async () => {
    state.contacts = [contact("c1", "山田")];
    state.notes = notesNewestFirst(1500, (index) => (index === 10 || index === 1200 ? "c1" : "other"));
    const rows = await exportRows();
    expect(rows[0].memo).toBe("メモ10");
  });

  it("ちょうど 1,000 件のときは、次のページが空であることを確かめてから終える", async () => {
    state.contacts = [contact("c1", "山田")];
    state.notes = notesNewestFirst(1000, (index) => (index === 999 ? "c1" : "other"));
    const rows = await exportRows();
    expect(rows[0].memo).toBe("メモ999");
    expect(notesRanges()).toHaveLength(2);
  });

  it("連絡先が 1,000 件を超えても全件を書き出す", async () => {
    state.contacts = Array.from({ length: 1200 }, (_, index) => contact(`c${index}`, `姓${index}`));
    const rows = await exportRows();
    expect(rows).toHaveLength(1200);
    expect(state.ranges.filter((call) => call.table === "contacts")).toEqual([
      { table: "contacts", from: 0, to: 999 },
      { table: "contacts", from: 1000, to: 1999 },
    ]);
  });
});
