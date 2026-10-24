import { jsonError, jsonOk, readJson } from "@/lib/api";
import { guardAdmin, guardAdminWrite } from "@/lib/auth/admin-api";
import { listDocumentsForContact } from "@/lib/crm/repository";
import { InputError, assertAllowedKeys, isUuid, normalizeStorageFileName, validateDocumentFileSize, validateHttpUrl } from "@/lib/crm/validation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new InputError(`${label}は${max}文字以内で入力してください。`);
  }
  return value.normalize("NFC").trim();
}

async function linkInteraction(documentId: string, contactId: string, interactionId: string | null): Promise<void> {
  if (!interactionId) return;
  if (!isUuid(interactionId)) throw new InputError("紐付けるやりとりをご確認ください。");
  const db = getDb();
  const { data: interaction, error } = await db.from("interactions").select("id").eq("id", interactionId).eq("contact_id", contactId).maybeSingle();
  if (error || !interaction) throw new InputError("紐付けるやりとりをご確認ください。");
  const result = await db.from("document_links").insert({ document_id: documentId, contact_id: contactId, interaction_id: interactionId });
  if (result.error && result.error.code !== "23505") throw new Error("document_link_failed");
}

export async function GET(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const contactId = new URL(request.url).searchParams.get("contact");
  if (!isUuid(contactId)) return jsonError("連絡先をご確認ください。", 400);
  try {
    return jsonOk(await listDocumentsForContact(contactId));
  } catch {
    return jsonError("資料を読み込めませんでした。", 500);
  }
}

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const contentType = request.headers.get("content-type") ?? "";
  const db = getDb();
  let storagePath: string | null = null;
  try {
    if (contentType.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const allowedFormKeys = new Set(["file", "contactId", "title", "version", "interactionId"]);
      if ([...form.keys()].some((key) => !allowedFormKeys.has(key))) throw new InputError("入力項目をご確認ください。");
      const file = form.get("file");
      const contactId = form.get("contactId");
      if (!(file instanceof File) || !isUuid(contactId)) throw new InputError("ファイルと連絡先をご確認ください。");
      validateDocumentFileSize(file.size);
      const title = requiredText(form.get("title"), "資料名", 200);
      const version = requiredText(form.get("version") || "1", "版", 50);
      const originalName = requiredText(file.name, "ファイル名", 255);
      const storedName = normalizeStorageFileName(originalName);
      // 同じファイル名の新しい版を上げても衝突しないよう、保存名に一意の接頭辞を付ける
      storagePath = `${contactId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${storedName}`;
      const upload = await db.storage.from("crm-documents").upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upload.error) throw new Error("storage_upload_failed");
      const inserted = await db.from("documents").insert({
        contact_id: contactId,
        title,
        version,
        storage_path: storagePath,
        original_file_name: originalName,
        mime_type: (file.type || "application/octet-stream").slice(0, 200),
        size_bytes: file.size,
      }).select("*").single();
      if (inserted.error || !inserted.data) throw new Error("document_insert_failed");
      await linkInteraction(inserted.data.id, contactId, typeof form.get("interactionId") === "string" ? String(form.get("interactionId")) || null : null);
      return jsonOk(inserted.data, { status: 201 });
    }

    const body = await readJson(request);
    if (!body) throw new InputError("入力内容を読み取れませんでした。");
    assertAllowedKeys(body, ["contactId", "title", "version", "sourceUrl", "interactionId"]);
    if (!isUuid(body.contactId)) throw new InputError("連絡先をご確認ください。");
    const sourceUrl = validateHttpUrl(body.sourceUrl);
    const inserted = await db.from("documents").insert({
      contact_id: body.contactId,
      title: requiredText(body.title, "資料名", 200),
      version: requiredText(body.version || "1", "版", 50),
      source_url: sourceUrl,
    }).select("*").single();
    if (inserted.error || !inserted.data) throw new Error("document_insert_failed");
    await linkInteraction(inserted.data.id, body.contactId, typeof body.interactionId === "string" ? body.interactionId || null : null);
    return jsonOk(inserted.data, { status: 201 });
  } catch (error) {
    if (storagePath) await db.storage.from("crm-documents").remove([storagePath]);
    return error instanceof InputError ? jsonError(error.message, 400) : jsonError("資料を登録できませんでした。（入力内容は残っています）", 500);
  }
}
