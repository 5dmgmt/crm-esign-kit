import "server-only";

import { getDb } from "@/lib/db";
import type { EsignDocument } from "@/lib/esign/core";

export async function onContractSigned(doc: EsignDocument): Promise<void> {
  if (!doc.contact_id || !doc.stage_tag_on_sign) return;
  const { error } = await getDb()
    .from("contacts")
    .update({ stage: doc.stage_tag_on_sign, last_contact_at: doc.client_signed_at })
    .eq("id", doc.contact_id);
  if (error) throw new Error("contact_stage_update_failed");
}
