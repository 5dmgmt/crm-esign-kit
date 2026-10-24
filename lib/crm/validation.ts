import { randomUUID } from "node:crypto";
import { getKitConfig } from "@/lib/config";
import type { ContactStatus, InteractionType, NoteType } from "@/lib/crm/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_CRM_DOCUMENT_BYTES = 20 * 1024 * 1024;

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function assertAllowedKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(input).some((key) => !allowedSet.has(key))) throw new InputError("入力項目をご確認ください。");
}

function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new InputError(`${label}をご確認ください。`);
  }
  const normalized = value.normalize("NFC").trim();
  if ((required && !normalized) || normalized.length > max) {
    throw new InputError(`${label}は${max}文字以内で入力してください。`);
  }
  return normalized;
}

function nullableText(value: unknown, label: string, max: number): string | null {
  const normalized = text(value, label, max);
  return normalized || null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export type ContactWrite = {
  last_name: string;
  first_name: string;
  company_name: string;
  job_title: string;
  email: string | null;
  phone: string;
  postal_code: string;
  address: string;
  tags: string[];
  stage: string;
  status: ContactStatus;
};

export const CONTACT_KEYS = [
  "lastName", "firstName", "companyName", "jobTitle", "email", "phone", "postalCode", "address", "tags", "stage", "status",
] as const;

export function validateContact(input: Record<string, unknown>): ContactWrite {
  assertAllowedKeys(input, CONTACT_KEYS);
  const lastName = text(input.lastName, "姓", 80);
  const firstName = text(input.firstName, "名", 80);
  if (!lastName && !firstName) throw new InputError("氏名を入力してください。");
  const email = nullableText(input.email, "メール", 254)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) throw new InputError("メールの形式をご確認ください。");
  if (!Array.isArray(input.tags) || input.tags.length > 20) throw new InputError("タグは20件以内で選んでください。");
  const tags = [...new Set(input.tags.map((tag) => text(tag, "タグ", 50, true)))];
  const stage = text(input.stage, "段階", 50, true);
  if (!getKitConfig().stageTags.includes(stage)) throw new InputError("段階は設定の一覧から選んでください。");
  if (input.status !== "active" && input.status !== "archived") throw new InputError("状態をご確認ください。");
  return {
    last_name: lastName,
    first_name: firstName,
    company_name: text(input.companyName, "会社名", 160),
    job_title: text(input.jobTitle, "役職", 120),
    email,
    phone: text(input.phone, "電話", 40),
    postal_code: text(input.postalCode, "郵便番号", 20),
    address: text(input.address, "住所", 500),
    tags,
    stage,
    status: input.status,
  };
}

export function validateNote(input: Record<string, unknown>): {
  note_type: NoteType;
  body: string;
  due_on: string | null;
} {
  assertAllowedKeys(input, ["noteType", "body", "dueOn"]);
  if (input.noteType !== "note" && input.noteType !== "meeting" && input.noteType !== "follow") {
    throw new InputError("メモの種類をご確認ください。");
  }
  const dueOn = input.dueOn ? text(input.dueOn, "期日", 10, true) : null;
  if (dueOn && !DATE_PATTERN.test(dueOn)) throw new InputError("期日は日付で入力してください。");
  if (input.noteType === "follow" && !dueOn) throw new InputError("フォローの期日を入力してください。");
  return { note_type: input.noteType, body: text(input.body, "内容", 5000, true), due_on: dueOn };
}

const INTERACTION_TYPES = new Set<InteractionType>(["meeting", "phone", "email", "note"]);

export function validateInteraction(input: Record<string, unknown>): {
  interaction_type: InteractionType;
  occurred_at: string;
  subject: string;
  body: string;
} {
  assertAllowedKeys(input, ["interactionType", "occurredAt", "subject", "body"]);
  if (!INTERACTION_TYPES.has(input.interactionType as InteractionType)) throw new InputError("やりとりの種類をご確認ください。");
  const occurredAt = text(input.occurredAt, "日時", 40, true);
  if (!Number.isFinite(Date.parse(occurredAt))) throw new InputError("日時をご確認ください。");
  return {
    interaction_type: input.interactionType as InteractionType,
    occurred_at: new Date(occurredAt).toISOString(),
    subject: text(input.subject, "件名", 200),
    body: text(input.body, "内容", 100_000, true),
  };
}

export function validateHttpUrl(value: unknown): string {
  const raw = text(value, "URL", 2000, true);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new InputError("URLは http または https で始まる形式にしてください。");
  }
}

export function normalizeStorageFileName(originalName: string): string {
  const normalized = originalName.normalize("NFKC");
  const dot = normalized.lastIndexOf(".");
  const rawBase = dot > 0 ? normalized.slice(0, dot) : normalized;
  const rawExtension = dot > 0 ? normalized.slice(dot + 1) : "";
  const base = rawBase
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80) || "file";
  const extension = rawExtension.replace(/[^A-Za-z0-9]+/g, "").slice(0, 12).toLowerCase();
  return `${randomUUID()}-${base}${extension ? `.${extension}` : ""}`;
}

export function validateDocumentFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) throw new InputError("空のファイルは登録できません。");
  if (size > MAX_CRM_DOCUMENT_BYTES) throw new InputError("ファイルは20MB以内にしてください。");
}
