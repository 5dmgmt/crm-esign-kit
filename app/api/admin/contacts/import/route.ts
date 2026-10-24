import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdminWrite } from "@/lib/auth/admin-api";
import { getKitConfig } from "@/lib/config";
import { CONTACT_CSV_COLUMNS, duplicateEmailRows, rowsFromCsv, type CsvContactKey, type CsvMapping } from "@/lib/crm/csv";
import { InputError, assertAllowedKeys, validateContact } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

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
  try {
    assertAllowedKeys(body, ["csv", "mapping", "confirm"]);
    const parsed = rowsFromCsv(body.csv, mappingFrom(body.mapping));
    if (parsed.rows.length > 5000) return jsonError("一度に取り込めるのは5,000行までです。", 400);
    const { data: existing, error } = await getDb().from("contacts").select("email").not("email", "is", null);
    if (error) throw new Error("existing_lookup_failed");
    const knownEmails = new Set((existing ?? []).flatMap((item) => item.email ? [item.email.toLowerCase()] : []));
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
    for (const item of importable) {
      const { data: contact, error: insertError } = await getDb().from("contacts").insert(item.value).select("id").single();
      if (insertError?.code === "23505") continue;
      if (insertError || !contact) throw new Error("contact_insert_failed");
      if (item.memo) {
        const { error: noteError } = await getDb().from("contact_notes").insert({
          contact_id: contact.id,
          note_type: "note",
          body: item.memo,
        });
        if (noteError) throw new Error("memo_insert_failed");
      }
      imported += 1;
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
    return jsonError("CSVを取り込めませんでした。（ファイルの内容は変更されていません）", 500);
  }
}
