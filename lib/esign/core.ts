import { createHash, randomBytes } from "node:crypto";
import { getKitConfig } from "@/lib/config";
import type { ClientKind, ContractFields } from "@/lib/esign/types";

export type EsignStatus = "sent" | "signed" | "void";

export type EsignDocument = {
  id: string;
  doc_number: number;
  contact_id: string | null;
  template_id: string;
  template_version: string;
  fields: ContractFields;
  client_kind: ClientKind;
  stage_tag_on_sign: string | null;
  title: string;
  client_company: string;
  client_representative: string;
  client_email: string;
  contract_html: string;
  content_hash: string;
  status: EsignStatus;
  token_hash: string;
  token_expires_at: string;
  sent_at: string;
  client_signed_at: string | null;
  client_sign_company: string | null;
  client_sign_name: string | null;
  client_sign_ip: string | null;
  client_sign_ua: string | null;
  issuer_signed_at: string;
  issuer_name: string;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EsignInsert = Omit<
  EsignDocument,
  "id" | "doc_number" | "client_signed_at" | "client_sign_company" | "client_sign_name" |
    "client_sign_ip" | "client_sign_ua" | "void_reason" | "voided_at" | "created_at" | "updated_at"
>;

export type EsignSignUpdate = Pick<
  EsignDocument,
  "status" | "client_signed_at" | "client_sign_company" | "client_sign_name" | "client_sign_ip" | "client_sign_ua"
>;

export type EsignRepository = {
  create(input: EsignInsert): Promise<EsignDocument>;
  findByTokenHash(tokenHash: string): Promise<EsignDocument | null>;
  findById(id: string): Promise<EsignDocument | null>;
  list(limit: number): Promise<EsignDocument[]>;
  signIfSent(id: string, update: EsignSignUpdate): Promise<EsignDocument | null>;
  void(id: string, reason: string, at: string): Promise<EsignDocument | null>;
};

async function defaultRepository(): Promise<EsignRepository> {
  return (await import("@/lib/esign/repository")).supabaseEsignRepository;
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function formatDocNumber(value: number): string {
  return String(value).padStart(7, "0");
}

export function normalizeSignerInput(value: string, max = 60): string {
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function isTokenExpired(doc: EsignDocument, now = Date.now()): boolean {
  return new Date(doc.token_expires_at).getTime() < now;
}

export function isSignedViewExpired(doc: EsignDocument, now = Date.now()): boolean {
  const days = getKitConfig().signedDocumentViewDays;
  if (!days || !doc.client_signed_at) return false;
  return new Date(doc.client_signed_at).getTime() + days * 86_400_000 < now;
}

export type CreateEsignParams = {
  contactId?: string | null;
  templateId: string;
  templateVersion: string;
  fields: ContractFields;
  clientKind: ClientKind;
  stageTagOnSign?: string | null;
  title: string;
  clientCompany: string;
  clientRepresentative: string;
  clientEmail: string;
  contractHtml: string;
};

export async function createEsignDocument(
  params: CreateEsignParams,
  repository?: EsignRepository,
): Promise<{ doc: EsignDocument; token: string }> {
  const repo = repository ?? (await defaultRepository());
  const token = generateToken();
  const now = new Date();
  const config = getKitConfig();
  const expires = new Date(now.getTime() + config.signingTokenDays * 86_400_000);
  const doc = await repo.create({
    contact_id: params.contactId ?? null,
    template_id: params.templateId,
    template_version: params.templateVersion,
    fields: params.fields,
    client_kind: params.clientKind,
    stage_tag_on_sign: params.stageTagOnSign ?? null,
    title: params.title,
    client_company: normalizeSignerInput(params.clientCompany),
    client_representative: normalizeSignerInput(params.clientRepresentative),
    client_email: params.clientEmail.trim().toLowerCase(),
    contract_html: params.contractHtml,
    content_hash: sha256Hex(params.contractHtml),
    status: "sent",
    token_hash: sha256Hex(token),
    token_expires_at: expires.toISOString(),
    sent_at: now.toISOString(),
    issuer_signed_at: now.toISOString(),
    issuer_name: `${config.issuer.companyName} ${config.issuer.representativeTitle} ${config.issuer.representativeName}`,
  });
  return { doc, token };
}

export async function findEsignDocumentByToken(token: string, repository?: EsignRepository) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const repo = repository ?? (await defaultRepository());
  return repo.findByTokenHash(sha256Hex(token));
}

export async function getEsignDocumentById(id: string, repository?: EsignRepository) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const repo = repository ?? (await defaultRepository());
  return repo.findById(id);
}

export async function listEsignDocuments(limit = 50, repository?: EsignRepository) {
  const repo = repository ?? (await defaultRepository());
  return repo.list(Math.max(1, Math.min(limit, 100)));
}

export type SignResult =
  | { ok: true; doc: EsignDocument }
  | {
      ok: false;
      reason: "not_found" | "expired" | "already_signed" | "void" | "invalid_name" | "content_mismatch";
    };

export async function signEsignDocument(
  params: { token: string; signCompany: string; signName: string; ip: string; userAgent: string },
  repository?: EsignRepository,
): Promise<SignResult> {
  const repo = repository ?? (await defaultRepository());
  const doc = await findEsignDocumentByToken(params.token, repo);
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.status === "void") return { ok: false, reason: "void" };
  if (doc.status === "signed") return { ok: false, reason: "already_signed" };
  if (isTokenExpired(doc)) return { ok: false, reason: "expired" };
  if (sha256Hex(doc.contract_html) !== doc.content_hash) {
    return { ok: false, reason: "content_mismatch" };
  }

  const signName = normalizeSignerInput(params.signName);
  const signCompany = normalizeSignerInput(params.signCompany);
  if (signName.length < 2 || (doc.client_kind === "corporation" && !signCompany)) {
    return { ok: false, reason: "invalid_name" };
  }
  const updated = await repo.signIfSent(doc.id, {
    status: "signed",
    client_signed_at: new Date().toISOString(),
    client_sign_company: doc.client_kind === "individual" ? "" : signCompany,
    client_sign_name: signName,
    client_sign_ip: normalizeSignerInput(params.ip, 64),
    client_sign_ua: normalizeSignerInput(params.userAgent, 256),
  });
  return updated ? { ok: true, doc: updated } : { ok: false, reason: "already_signed" };
}

export async function voidEsignDocument(id: string, reason: string, repository?: EsignRepository) {
  const normalizedReason = normalizeSignerInput(reason, 500);
  if (!normalizedReason) return { ok: false as const, reason: "reason_required" as const };
  const repo = repository ?? (await defaultRepository());
  const doc = await repo.void(id, normalizedReason, new Date().toISOString());
  return doc ? { ok: true as const, doc } : { ok: false as const, reason: "not_found" as const };
}
