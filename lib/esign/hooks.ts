import "server-only";

import { getKitConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { formatDocNumber, type EsignDocument } from "@/lib/esign/core";

export async function onContractSigned(doc: EsignDocument): Promise<void> {
  if (!getKitConfig().autoAdvanceStageOnSign || !doc.contact_id || !doc.stage_tag_on_sign) return;
  const db = getDb();
  const { error } = await db
    .from("contacts")
    .update({ stage: doc.stage_tag_on_sign, last_contact_at: doc.client_signed_at })
    .eq("id", doc.contact_id);
  if (error) throw new Error("contact_stage_update_failed");
  const { error: interactionError } = await db.from("interactions").insert({
    contact_id: doc.contact_id,
    interaction_type: "note",
    occurred_at: doc.client_signed_at ?? new Date().toISOString(),
    subject: `契約を締結（文書番号 ${formatDocNumber(doc.doc_number)}）`,
    body: doc.title,
  });
  if (interactionError) throw new Error("contract_interaction_create_failed");
}
