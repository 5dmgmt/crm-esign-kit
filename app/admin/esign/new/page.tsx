import EsignCreateForm from "./EsignCreateForm";
import { listContractTemplates } from "@/lib/esign/templates";
import { getContact } from "@/lib/crm/repository";
import { contactName } from "@/lib/crm/types";
import { isUuid } from "@/lib/crm/validation";

export default async function NewEsignPage({ searchParams }: { searchParams: Promise<{ contact?: string | string[] }> }) {
  const templates = await listContractTemplates();
  const query = await searchParams;
  const contactId = typeof query.contact === "string" ? query.contact : "";
  const contact = isUuid(contactId) ? await getContact(contactId) : null;
  const initialContact = contact ? {
    id: contact.id,
    companyName: contact.company_name,
    name: contactName(contact),
    email: contact.email ?? "",
    address: [contact.postal_code, contact.address].filter(Boolean).join(" "),
  } : null;
  return (
    <main className="shell">
      <div className="page-heading"><div><p className="eyebrow">電子契約</p><h1>契約書を作成</h1></div></div>
      {initialContact ? <p className="message success">{initialContact.name} の連絡先情報を初期値に入れました。</p> : null}
      <EsignCreateForm templates={templates} initialContact={initialContact} />
    </main>
  );
}
