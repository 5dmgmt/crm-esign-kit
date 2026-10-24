import { describe, expect, it } from "vitest";
import { CONTACT_CSV_COLUMNS, UTF8_BOM, duplicateEmailRows, rowsFromCsv, stringifyCsv, type CsvContactKey } from "@/lib/crm/csv";

function emptyRow(): Record<CsvContactKey, string> {
  return Object.fromEntries(CONTACT_CSV_COLUMNS.map(([key]) => [key, ""])) as Record<CsvContactKey, string>;
}

describe("連絡先CSV", () => {
  it("数式として実行される先頭文字に ' を前置して書き出す", () => {
    const row = Object.fromEntries(CONTACT_CSV_COLUMNS.map(([key]) => [key, ""])) as Record<CsvContactKey, string>;
    const keys = CONTACT_CSV_COLUMNS.map(([key]) => key);
    row[keys[0]] = "=1+1";
    row[keys[1]] = "@SUM(A1)";
    const csv = stringifyCsv([row]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'@SUM(A1)");
  });

  it("BOM付きCSVの見出しを対応づける", () => {
    const result = rowsFromCsv(`${UTF8_BOM}姓,名,メール\r\n山田,花子,sample@example.com\r\n`);
    expect(result.mapping).toMatchObject({ lastName: "姓", firstName: "名", email: "メール" });
    expect(result.rows[0]).toMatchObject({ lastName: "山田", firstName: "花子", email: "sample@example.com" });
  });

  it("明示した見出しの対応を使う", () => {
    const result = rowsFromCsv("氏,名まえ\r\n山田,花子\r\n", { lastName: "氏", firstName: "名まえ" });
    expect(result.rows[0]).toEqual({ lastName: "山田", firstName: "花子" });
  });

  it("既存メールとファイル内の重複を検出する", () => {
    const duplicates = duplicateEmailRows(["known@example.com", "new@example.com", "NEW@example.com", null], ["known@example.com"]);
    expect([...duplicates]).toEqual([0, 2]);
  });

  it("カンマ・引用符・改行を含む値を書き出して読み戻す", () => {
    const row = { ...emptyRow(), lastName: "山田", firstName: "花子", companyName: "株式会社サンプル,商事", memo: "1行目\n\"引用\"の2行目", email: "sample@example.com" };
    const csv = stringifyCsv([row]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(rowsFromCsv(csv).rows[0]).toMatchObject(row);
  });
});

