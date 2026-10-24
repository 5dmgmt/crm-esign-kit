import { describe, expect, it } from "vitest";
import { InputError, MAX_CRM_DOCUMENT_BYTES, normalizeStorageFileName, validateDocumentFileSize, validateHttpUrl } from "@/lib/crm/validation";

describe("CRM資料", () => {
  it("保存ファイル名を英数字へ正規化し元の拡張子を残す", () => {
    const value = normalizeStorageFileName("提案 資料（最終）.PDF");
    expect(value).toMatch(/^[0-9a-f-]+-file\.pdf$/);
    expect(value).not.toContain("提案");
  });

  it("20MBを超えるファイルを拒否する", () => {
    expect(() => validateDocumentFileSize(MAX_CRM_DOCUMENT_BYTES)).not.toThrow();
    expect(() => validateDocumentFileSize(MAX_CRM_DOCUMENT_BYTES + 1)).toThrow(InputError);
  });

  it("URLはhttpとhttpsだけを許可する", () => {
    expect(validateHttpUrl("https://example.com/document")).toBe("https://example.com/document");
    expect(() => validateHttpUrl("javascript:alert(1)")).toThrow(InputError);
    expect(() => validateHttpUrl("ftp://example.com/file")).toThrow(InputError);
  });
});

