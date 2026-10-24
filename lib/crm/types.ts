export type ContactStatus = "active" | "archived";
export type NoteType = "note" | "meeting" | "follow";
export type InteractionType = "meeting" | "phone" | "email" | "note";

export type Contact = {
  id: string;
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
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactNote = {
  id: string;
  contact_id: string;
  note_type: NoteType;
  body: string;
  due_on: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  contact_id: string;
  interaction_type: InteractionType;
  occurred_at: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type CrmDocument = {
  id: string;
  contact_id: string | null;
  title: string;
  version: string;
  source_url: string | null;
  storage_path: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
  interaction_ids?: string[];
};

export type ContactKarte = {
  contact: Contact;
  notes: ContactNote[];
  interactions: Interaction[];
  documents: CrmDocument[];
  contracts: Array<{
    id: string;
    doc_number: number;
    title: string;
    status: "sent" | "signed" | "void";
    sent_at: string;
    client_signed_at: string | null;
  }>;
};

export function contactName(contact: Pick<Contact, "last_name" | "first_name">): string {
  return `${contact.last_name} ${contact.first_name}`.trim();
}

