import { randomUUID } from "node:crypto";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdminWrite } from "@/lib/auth/admin-api";
import { getKitConfig } from "@/lib/config";
import { CONTACT_CSV_COLUMNS, duplicateEmailRows, rowsFromCsv, type CsvContactKey, type CsvMapping } from "@/lib/crm/csv";
import { InputError, assertAllowedKeys, validateContact } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// 連絡先とメモは、この件数ごとにまとめて保存する（1 行ずつだと Vercel の時間切れで途中までしか入らないため）
const INSERT_CHUNK_SIZE = 200;
// Supabase は 1 回の取得に上限（既定 1,000 行）があるため、既存のメールも 1,000 件ずつ全件を読む
const EXISTING_PAGE_SIZE = 1000;

const CSV_KEYS = new Set<CsvContactKey>(CONTACT_CSV_COLUMNS.map(([key]) => key));

function mappingFrom(value: unknown): CsvMapping | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("見出しの対応づけをご確認ください。");
  const mapping: CsvMapping = {};
  for (const [key, header] of Object.entries(value)) {
    if (!CSV_KEYS.has(key as CsvContactKey) || typeof header !== "string" || header.length > 200) {
      throw new InputError("見出しの対応づけをご確認ください。");
    }
    mapping[key as CsvContactKey] = header;
  }
  return mapping;
}

function contactInput(row: Partial<Record<CsvContactKey, string>>): Record<string, unknown> {
  const stage = row.stage?.trim() || getKitConfig().stageTags[0];
  const statusValue = row.status?.trim().toLowerCase();
  return {
    lastName: row.lastName ?? "",
    firstName: row.firstName ?? "",
    companyName: row.companyName ?? "",
    jobTitle: row.jobTitle ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    postalCode: row.postalCode ?? "",
    address: row.address ?? "",
    tags: (row.tags ?? "").split(/[|;、]/).map((tag) => tag.trim()).filter(Boolean),
    stage,
    status: statusValue === "archived" || statusValue === "アーカイブ" ? "archived" : "active",
  };
}

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || typeof body.csv !== "string" || body.csv.length > 5_000_000 || (body.confirm !== undefined && typeof body.confirm !== "boolean")) {
    return jsonError("CSVは5MB以内のUTF-8ファイルをご用意ください。", 400);
  }
  let writing = false;
  try {
    assertAllowedKeys(body, ["csv", "mapping", "confirm"]);
    const parsed = rowsFromCsv(body.csv, mappingFrom(body.mapping));
    if (parsed.rows.length > 5000) return jsonError("一度に取り込めるのは5,000行までです。", 400);
    const knownEmails = new Set<string>();
    for (let from = 0; ; from += EXISTING_PAGE_SIZE) {
      const { data: existing, error } = await getDb()
        .from("contacts")
        .select("email")
        .not("email", "is", null)
        .order("id")
        .range(from, from + EXISTING_PAGE_SIZE - 1);
      if (error) throw new Error("existing_lookup_failed");
      for (const item of existing ?? []) if (item.email) knownEmails.add(item.email.toLowerCase());
      if (!existing || existing.length < EXISTING_PAGE_SIZE) break;
    }
    const validated = parsed.rows.map((row, index) => {
      try {
        const value = validateContact(contactInput(row));
        return { rowNumber: index + 2, value, memo: (row.memo ?? "").trim().slice(0, 5000), reason: null as string | null };
      } catch (error) {
        return {
          rowNumber: index + 2,
          value: null,
          memo: "",
          reason: error instanceof InputError ? error.message : "入力内容をご確認ください。",
        };
      }
    });
    const duplicateIndexes = duplicateEmailRows(validated.map((row) => row.value?.email), knownEmails);
    const preview = validated.map((row, index) => ({ ...row, duplicate: duplicateIndexes.has(index) }));
    if (body.confirm !== true) {
      return jsonOk({
        headers: parsed.headers,
        mapping: parsed.mapping,
        rows: preview.map((row) => ({
          rowNumber: row.rowNumber,
          name: row.value ? `${row.value.last_name} ${row.value.first_name}`.trim() : "",
          companyName: row.value?.company_name ?? "",
          email: row.value?.email ?? "",
          duplicate: row.duplicate,
          reason: row.reason,
        })),
      });
    }
    const importable = preview.filter((row) => row.value && !row.duplicate && !row.reason) as Array<{
      rowNumber: number;
      value: ReturnType<typeof validateContact>;
      memo: string;
      duplicate: false;
      reason: null;
    }>;
    let imported = 0;
    for (let start = 0; start < importable.length; start += INSERT_CHUNK_SIZE) {
      writing = true;
      // メモを結び付けるため、連絡先の id は送る側で決めて一緒に入れる
      const chunk = importable.slice(start, start + INSERT_CHUNK_SIZE).map((item) => ({ ...item, id: randomUUID() }));
      const { error: chunkError } = await getDb().from("contacts").insert(chunk.map((item) => ({ id: item.id, ...item.value })));
      let saved = chunk;
      if (chunkError) {
        if (chunkError.code !== "23505") throw new Error("contact_insert_failed");
        // まとまりの中に重複があったときは、そのまとまりだけ 1 行ずつに戻す（重複は飛ばし、ほかは入れる）
        saved = [];
        for (const item of chunk) {
          const { error: insertError } = await getDb().from("contacts").insert({ id: item.id, ...item.value });
          if (insertError?.code === "23505") continue;
          if (insertError) throw new Error("contact_insert_failed");
          saved.push(item);
        }
      }
      const notes = saved.filter((item) => item.memo).map((item) => ({ contact_id: item.id, note_type: "note", body: item.memo }));
      if (notes.length > 0) {
        const { error: noteError } = await getDb().from("contact_notes").insert(notes);
        if (noteError) throw new Error("memo_insert_failed");
      }
      imported += saved.length;
    }
    return jsonOk({
      imported,
      duplicates: preview.filter((row) => row.duplicate).length,
      invalid: preview.filter((row) => row.reason).length,
    });
  } catch (error) {
    if (error instanceof InputError) return jsonError(error.message, 400);
    if (error instanceof Error && (error.message === "csv_unclosed_quote" || error.message === "csv_empty")) {
      return jsonError("CSVの見出し行と引用符をご確認ください。", 400);
    }
    if (writing) {
      return jsonError(
        "CSVを取り込めませんでした。（途中まで取り込まれている場合があります。連絡先の一覧をご確認のうえ、同じファイルをもう一度取り込むと、取り込み済みのメールアドレスの行は重複として飛ばされます。メールアドレスの無い行は、もう一度入ります）",
        500,
      );
    }
    return jsonError("CSVを取り込めませんでした。（ファイルの内容は変更されていません）", 500);
  }
}
