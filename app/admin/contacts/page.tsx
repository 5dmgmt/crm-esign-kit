import ContactsPanel from "./ContactsPanel";
import { getKitConfig } from "@/lib/config";
import { listContacts } from "@/lib/crm/repository";
import type { Contact } from "@/lib/crm/types";

export default async function ContactsPage() {
  let contacts: Contact[] = [];
  let error = "";
  try { contacts = await listContacts({ status: "active" }); }
  catch { error = "連絡先を読み込めませんでした。接続設定を確かめて、再読み込みしてください。"; }
  return <main className="shell stack"><div className="page-heading"><div><p className="eyebrow">CRM</p><h1>連絡先</h1></div></div>{error ? <p className="message error">{error}</p> : null}<ContactsPanel initialContacts={contacts} stageTags={getKitConfig().stageTags} /></main>;
}
