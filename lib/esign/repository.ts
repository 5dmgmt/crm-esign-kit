import "server-only";

import { getDb } from "@/lib/db";
import type { EsignDocument, EsignInsert, EsignRepository, EsignSignUpdate } from "@/lib/esign/core";

export const supabaseEsignRepository: EsignRepository = {
  async create(input: EsignInsert) {
    const { data, error } = await getDb().from("esign_documents").insert(input).select("*").single();
    if (error || !data) throw new Error("esign_create_failed");
    return data as EsignDocument;
  },
  async findByTokenHash(tokenHash: string) {
    const { data, error } = await getDb()
      .from("esign_documents")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new Error("esign_lookup_failed");
    return data as EsignDocument | null;
  },
  async findById(id: string) {
    const { data, error } = await getDb().from("esign_documents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("esign_lookup_failed");
    return data as EsignDocument | null;
  },
  async list(limit: number) {
    const { data, error } = await getDb()
      .from("esign_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("esign_list_failed");
    return (data ?? []) as EsignDocument[];
  },
  async signIfSent(id: string, update: EsignSignUpdate) {
    const { data, error } = await getDb()
      .from("esign_documents")
      .update(update)
      .eq("id", id)
      .eq("status", "sent")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("esign_sign_failed");
    return data as EsignDocument | null;
  },
  async reissueToken(id: string, tokenHash: string, expiresAt: string) {
    const { data, error } = await getDb()
      .from("esign_documents")
      .update({ token_hash: tokenHash, token_expires_at: expiresAt })
      .eq("id", id)
      // 署名後や無効化後のリンクは差し替えない
      .eq("status", "sent")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("esign_reissue_failed");
    return data as EsignDocument | null;
  },
  async void(id: string, reason: string, at: string) {
    const { data, error } = await getDb()
      .from("esign_documents")
      .update({ status: "void", void_reason: reason, voided_at: at })
      .eq("id", id)
      // 締結済みの記録を消さないため、無効にできるのは署名前の文書だけ
      .eq("status", "sent")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("esign_void_failed");
    return data as EsignDocument | null;
  },
};
