import "server-only";

import { getDb } from "@/lib/db";
import type { Contact, ContactKarte, ContactNote, CrmDocument, Interaction } from "@/lib/crm/types";

export type ContactFilters = {
  search?: string;
  stage?: string;
  status?: "active" | "archived" | "all";
  tag?: string;
  sort?: "last_contact" | "updated";
};

function searchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

export async function listContacts(filters: ContactFilters = {}): Promise<Contact[]> {
  const { data, error } = await getDb().from("contacts").select("*").limit(2000);
  if (error) throw new Error("contacts_list_failed");
  const query = searchText(filters.search?.trim() ?? "");
  const status = filters.status ?? "active";
  const rows = ((data ?? []) as Contact[]).filter((contact) => {
    if (status !== "all" && contact.status !== status) return false;
    if (filters.stage && contact.stage !== filters.stage) return false;
    if (filters.tag && !contact.tags.includes(filters.tag)) return false;
    if (!query) return true;
    return searchText([
      contact.last_name,
      contact.first_name,
      contact.company_name,
      contact.email ?? "",
      ...contact.tags,
    ].join(" ")).includes(query);
  });
  const key = filters.sort === "updated" ? "updated_at" : "last_contact_at";
  return rows.sort((left, right) => {
    const primary = (right[key] ?? "").localeCompare(left[key] ?? "");
    return primary || right.updated_at.localeCompare(left.updated_at);
  });
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await getDb().from("contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("contact_lookup_failed");
  return data as Contact | null;
}

export async function listDocumentsForContact(contactId: string): Promise<CrmDocument[]> {
  const db = getDb();
  const [{ data, error }, linkResult] = await Promise.all([
    db.from("documents").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }),
    db.from("document_links").select("document_id,interaction_id").eq("contact_id", contactId),
  ]);
  if (error || linkResult.error) throw new Error("documents_list_failed");
  const links = new Map<string, string[]>();
  for (const link of linkResult.data ?? []) {
    if (!link.interaction_id) continue;
    const current = links.get(link.document_id) ?? [];
    current.push(link.interaction_id);
    links.set(link.document_id, current);
  }
  return Promise.all(((data ?? []) as CrmDocument[]).map(async (document) => {
    let signedUrl: string | null = null;
    if (document.storage_path) {
      const result = await db.storage.from("crm-documents").createSignedUrl(document.storage_path, 600);
      signedUrl = result.data?.signedUrl ?? null;
    }
    return { ...document, signed_url: signedUrl, interaction_ids: links.get(document.id) ?? [] };
  }));
}

export async function getContactKarte(id: string): Promise<ContactKarte | null> {
  const db = getDb();
  const [contact, notes, interactions, documents, contracts] = await Promise.all([
    getContact(id),
    db.from("contact_notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
    db.from("interactions").select("*").eq("contact_id", id).order("occurred_at", { ascending: false }),
    listDocumentsForContact(id),
    db.from("esign_documents")
      .select("id,doc_number,title,status,sent_at,client_signed_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!contact) return null;
  if (notes.error || interactions.error || contracts.error) throw new Error("contact_karte_failed");
  return {
    contact,
    notes: (notes.data ?? []) as ContactNote[],
    interactions: (interactions.data ?? []) as Interaction[],
    documents,
    contracts: (contracts.data ?? []) as ContactKarte["contracts"],
  };
}

function jstDateParts(now = new Date()): { today: string; start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const startDate = new Date(`${today}T00:00:00+09:00`);
  const endDate = new Date(startDate.getTime() + 86_400_000);
  return { today, start: startDate.toISOString(), end: endDate.toISOString() };
}

export type TodayOverview = {
  date: string;
  meetings: Array<Interaction & { contact: Pick<Contact, "id" | "last_name" | "first_name" | "company_name"> | null }>;
  follows: Array<ContactNote & { contact: Pick<Contact, "id" | "last_name" | "first_name" | "company_name"> | null }>;
  recentContacts: Contact[];
};

export async function getTodayOverview(now = new Date()): Promise<TodayOverview> {
  const db = getDb();
  const { today, start, end } = jstDateParts(now);
  const [meetings, follows, recent] = await Promise.all([
    db.from("interactions")
      .select("*,contact:contacts(id,last_name,first_name,company_name)")
      .eq("interaction_type", "meeting")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true }),
    db.from("contact_notes")
      .select("*,contact:contacts(id,last_name,first_name,company_name)")
      .eq("note_type", "follow")
      .lte("due_on", today)
      .is("done_at", null)
      .order("due_on", { ascending: true }),
    db.from("contacts")
      .select("*")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);
  if (meetings.error || follows.error || recent.error) throw new Error("today_overview_failed");
  return {
    date: today,
    meetings: (meetings.data ?? []) as TodayOverview["meetings"],
    follows: (follows.data ?? []) as TodayOverview["follows"],
    recentContacts: (recent.data ?? []) as Contact[],
  };
}

