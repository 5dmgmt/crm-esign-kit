import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeError = { code?: string; message: string } | null;

const state = vi.hoisted(() => ({
  contacts: [] as Array<Record<string, unknown>>,
  notes: [] as Array<Record<string, unknown>>,
  existingEmails: [] as string[],
  // 検索には出てこないが、データベースには入っているメール（同時に取り込まれた行など）
  hiddenEmails: new Set<string>(),
  inserts: [] as Array<{ table: string; payload: unknown }>,
  ranges: [] as Array<{ table: string; from: number; to: number }>,
  failContactInsert: false,
  failExistingLookup: false,
  failNoteInsert: false,
}));

vi.mock("@/lib/auth/admin-api", () => ({
  guardAdmin: async () => null,
  guardAdminWrite: async () => null,
}));

vi.mock("@/lib/db", () => {
  function storedEmail(row: Record<string, unknown>): string | null {
    return typeof row.email === "string" ? row.email : null;
  }
  function insertContacts(payload: unknown): { error: FakeError } {
    if (state.failContactInsert) return { error: { message: "failed" } };
    const rows = (Array.isArray(payload) ? payload : [payload]) as Array<Record<string, unknown>>;
    const known = new Set([...state.existingEmails, ...state.hiddenEmails, ...state.contacts.flatMap((row) => storedEmail(row) ?? [])]);
    const seen = new Set<string>();
    for (const row of rows) {
      const email = storedEmail(row);
      if (!email) continue;
      if (known.has(email) || seen.has(email)) return { error: { code: "23505", message: "duplicate key" } };
      seen.add(email);
    }
    state.contacts.push(...rows);
    return { error: null };
  }
  return {
    getDb: () => ({
      from: (table: string) => {
        const builder = {
          select: () => builder,
          not: () => builder,
          eq: () => builder,
          order: () => builder,
          range: (from: number, to: number) => {
            state.ranges.push({ table, from, to });
            if (table === "contacts" && state.failExistingLookup) return Promise.resolve({ data: null, error: { message: "failed" } });
            if (table === "contacts") {
              return Promise.resolve({ data: state.existingEmails.slice(from, to + 1).map((email) => ({ email })), error: null });
            }
            return Promise.resolve({ data: null, error: { message: "unexpected" } });
          },
          insert: (payload: unknown) => {
            state.inserts.push({ table, payload });
            if (table === "contacts") return Promise.resolve(insertContacts(payload));
            if (state.failNoteInsert) return Promise.resolve({ error: { message: "failed" } });
            state.notes.push(...(Array.isArray(payload) ? payload : [payload]));
            return Promise.resolve({ error: null });
          },
        };
        return builder;
      },
    }),
  };
});

import { POST, maxDuration } from "@/app/api/admin/contacts/import/route";

function importRequest(csv: string, confirm = true) {
  return new Request("http://localhost:3000/api/admin/contacts/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv, confirm }),
  });
}

function csvOf(count: number, options: { duplicateAt?: number; withEmail?: boolean } = {}): string {
  const lines = ["姓,名,メール,メモ"];
  for (let index = 1; index <= count; index += 1) {
    const email = index === options.duplicateAt ? "dup@example.com" : options.withEmail === false ? "" : `person${index}@example.com`;
    lines.push(`姓${index},名${index},${email},メモ${index}`);
  }
  return lines.join("\r\n");
}

function contactInserts() {
  return state.inserts.filter((call) => call.table === "contacts");
}

function noteInserts() {
  return state.inserts.filter((call) => call.table === "contact_notes");
}

beforeEach(() => {
  state.contacts = [];
  state.notes = [];
  state.existingEmails = [];
  state.hiddenEmails = new Set();
  state.inserts = [];
  state.ranges = [];
  state.failContactInsert = false;
  state.failExistingLookup = false;
  state.failNoteInsert = false;
});

describe("CSV 取り込み", () => {
  it("1 回の処理時間の上限を 60 秒にしている", () => {
    expect(maxDuration).toBe(60);
  });

  it("450 行を 200・200・50 行ずつまとめて保存し、メモを正しい連絡先に付ける", async () => {
    const response = await POST(importRequest(csvOf(450)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { imported: 450, duplicates: 0, invalid: 0 } });

    expect(contactInserts().map((call) => (call.payload as unknown[]).length)).toEqual([200, 200, 50]);
    expect(noteInserts().map((call) => (call.payload as unknown[]).length)).toEqual([200, 200, 50]);

    expect(state.contacts).toHaveLength(450);
    expect(new Set(state.contacts.map((row) => row.id)).size).toBe(450);
    const lastNameById = new Map(state.contacts.map((row) => [row.id, row.last_name]));
    expect(state.notes).toHaveLength(450);
    for (const note of state.notes) {
      const lastName = String(lastNameById.get(note.contact_id));
      expect(note.body).toBe(lastName.replace("姓", "メモ"));
      expect(note.note_type).toBe("note");
    }
  });

  it("メモの無い行にはメモを作らない", async () => {
    const csv = ["姓,名,メール,メモ", "山田,花子,hanako@example.com,", "佐藤,太郎,taro@example.com,打ち合わせ済み"].join("\r\n");
    const response = await POST(importRequest(csv));
    expect(response.status).toBe(200);
    expect(noteInserts()).toHaveLength(1);
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0].body).toBe("打ち合わせ済み");
    const taro = state.contacts.find((row) => row.last_name === "佐藤");
    expect(state.notes[0].contact_id).toBe(taro?.id);
  });

  it("2 回目のまとまりに重複があると、そのまとまりだけ 1 行ずつに戻し、重複の 1 行だけ飛ばす", async () => {
    // 事前の確認をすり抜けた重複（同時に取り込まれた行など）を想定して、データベースにだけ入れておく
    state.hiddenEmails.add("dup@example.com");
    const response = await POST(importRequest(csvOf(450, { duplicateAt: 250 })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { imported: 449, duplicates: 0, invalid: 0 } });

    const calls = contactInserts().map((call) => (Array.isArray(call.payload) ? (call.payload as unknown[]).length : 1));
    // 1 回目のまとまり（200）→ 2 回目のまとまり（200・重複で失敗）→ 1 行ずつ 200 回 → 3 回目のまとまり（50）
    expect(calls).toEqual([200, 200, ...Array.from({ length: 200 }, () => 1), 50]);

    expect(state.contacts).toHaveLength(449);
    expect(state.contacts.some((row) => row.email === "dup@example.com")).toBe(false);
    // 飛ばした行のメモは作らず、ほかの行のメモは、正しい連絡先に付く
    expect(state.notes).toHaveLength(449);
    expect(state.notes.some((note) => note.body === "メモ250")).toBe(false);
    const lastNameById = new Map(state.contacts.map((row) => [row.id, row.last_name]));
    for (const note of state.notes) {
      expect(note.body).toBe(String(lastNameById.get(note.contact_id)).replace("姓", "メモ"));
    }
    // 重複のまとまりのメモは、1 行ずつに戻したあと、そのまとまりの分をまとめて 1 回で保存する
    expect(noteInserts().map((call) => (call.payload as unknown[]).length)).toEqual([200, 199, 50]);
  });

  it("確認の段階で見つかった重複は、保存せず duplicates に数える", async () => {
    state.existingEmails = ["person2@example.com"];
    const response = await POST(importRequest(csvOf(3)));
    expect(await response.json()).toEqual({ ok: true, data: { imported: 2, duplicates: 1, invalid: 0 } });
    expect(contactInserts()).toHaveLength(1);
    expect((contactInserts()[0].payload as unknown[]).length).toBe(2);
  });

  it("メールの無い行も取り込む", async () => {
    const response = await POST(importRequest(csvOf(3, { withEmail: false })));
    expect(await response.json()).toEqual({ ok: true, data: { imported: 3, duplicates: 0, invalid: 0 } });
    expect(state.contacts).toHaveLength(3);
  });

  it("既存の連絡先のメールを 1,000 件ずつ全部読んで、重複を見つける", async () => {
    state.existingEmails = Array.from({ length: 1500 }, (_, index) => `old${index + 1}@example.com`);
    const csv = ["姓,名,メール", "山田,花子,old1200@example.com", "佐藤,太郎,new@example.com"].join("\r\n");
    const response = await POST(importRequest(csv, false));
    const body = await response.json();
    expect(body.data.rows.map((row: { duplicate: boolean }) => row.duplicate)).toEqual([true, false]);
    expect(state.ranges.filter((call) => call.table === "contacts")).toEqual([
      { table: "contacts", from: 0, to: 999 },
      { table: "contacts", from: 1000, to: 1999 },
    ]);
  });

  it("書き込みが始まったあとの失敗では、途中まで取り込まれている場合があることを伝える", async () => {
    state.failContactInsert = true;
    const response = await POST(importRequest(csvOf(3)));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason).toContain("途中まで取り込まれている場合があります");
    expect(body.reason).toContain("同じファイルをもう一度取り込むと");
    expect(body.reason).not.toContain("変更されていません");
  });

  it("メモの保存に失敗したときも、同じ案内を返す", async () => {
    state.failNoteInsert = true;
    const response = await POST(importRequest(csvOf(3)));
    expect(response.status).toBe(500);
    expect((await response.json()).reason).toContain("途中まで取り込まれている場合があります");
  });

  it("書き込みの前の失敗では、ファイルの内容は変更されていないと伝える", async () => {
    state.failExistingLookup = true;
    const response = await POST(importRequest(csvOf(3)));
    expect(response.status).toBe(500);
    expect((await response.json()).reason).toContain("変更されていません");
    expect(state.inserts).toHaveLength(0);
  });
});
