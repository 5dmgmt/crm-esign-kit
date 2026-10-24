export const UTF8_BOM = "\uFEFF";

export const CONTACT_CSV_COLUMNS = [
  ["lastName", "姓"],
  ["firstName", "名"],
  ["companyName", "会社名"],
  ["jobTitle", "役職"],
  ["email", "メール"],
  ["phone", "電話"],
  ["postalCode", "郵便番号"],
  ["address", "住所"],
  ["tags", "タグ"],
  ["stage", "段階"],
  ["status", "状態"],
  ["memo", "メモ"],
  ["lastContactAt", "最終接点"],
] as const;

export type CsvContactKey = (typeof CONTACT_CSV_COLUMNS)[number][0];
export type CsvMapping = Partial<Record<CsvContactKey, string>>;

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("csv_unclosed_quote");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

export function suggestCsvMapping(headers: string[]): CsvMapping {
  const aliases: Record<CsvContactKey, string[]> = {
    lastName: ["姓", "last_name", "lastname"],
    firstName: ["名", "first_name", "firstname"],
    companyName: ["会社名", "company_name", "company"],
    jobTitle: ["役職", "job_title", "title"],
    email: ["メール", "メールアドレス", "email"],
    phone: ["電話", "電話番号", "phone"],
    postalCode: ["郵便番号", "postal_code", "zip"],
    address: ["住所", "address"],
    tags: ["タグ", "tags"],
    stage: ["段階", "stage"],
    status: ["状態", "status"],
    memo: ["メモ", "memo", "note"],
    lastContactAt: ["最終接点", "last_contact_at"],
  };
  const mapping: CsvMapping = {};
  for (const [key] of CONTACT_CSV_COLUMNS) {
    const found = headers.find((header) => aliases[key].includes(header.trim().toLowerCase()));
    if (found) mapping[key] = found;
  }
  return mapping;
}

function escaped(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // 表計算ソフトが数式として実行しないよう、数式の先頭になる文字には ' を前置する
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function stringifyCsv(rows: Array<Record<CsvContactKey, string>>): string {
  const header = CONTACT_CSV_COLUMNS.map(([, label]) => escaped(label)).join(",");
  const body = rows.map((row) => CONTACT_CSV_COLUMNS.map(([key]) => escaped(row[key])).join(","));
  return `${UTF8_BOM}${[header, ...body].join("\r\n")}\r\n`;
}

export function rowsFromCsv(csv: string, mapping?: CsvMapping): {
  headers: string[];
  mapping: CsvMapping;
  rows: Array<Partial<Record<CsvContactKey, string>>>;
} {
  const parsed = parseCsv(csv);
  const headers = parsed[0]?.map((header) => header.trim()) ?? [];
  if (!headers.length) throw new Error("csv_empty");
  const resolved = mapping ?? suggestCsvMapping(headers);
  const positions = new Map(headers.map((header, index) => [header, index]));
  const rows = parsed.slice(1).map((values) => Object.fromEntries(
    CONTACT_CSV_COLUMNS.flatMap(([key]) => {
      const header = resolved[key];
      const position = header === undefined ? undefined : positions.get(header);
      return position === undefined ? [] : [[key, values[position] ?? ""]];
    }),
  ) as Partial<Record<CsvContactKey, string>>);
  return { headers, mapping: resolved, rows };
}

export function duplicateEmailRows(emails: Array<string | null | undefined>, existingEmails: Iterable<string>): Set<number> {
  const known = new Set([...existingEmails].map((email) => email.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  emails.forEach((value, index) => {
    const email = value?.trim().toLowerCase();
    if (!email) return;
    if (known.has(email) || seen.has(email)) duplicates.add(index);
    seen.add(email);
  });
  return duplicates;
}
