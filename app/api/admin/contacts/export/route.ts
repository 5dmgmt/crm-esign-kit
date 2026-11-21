import { guardAdmin } from "@/lib/auth/admin-api";
import { CONTACT_CSV_COLUMNS, stringifyCsv, type CsvContactKey } from "@/lib/crm/csv";
import { listContacts } from "@/lib/crm/repository";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTES_PAGE_SIZE = 1000;

export async function GET() {
  const denied = await guardAdmin();
  if (denied) return denied;
  try {
    const contacts = await listContacts({ status: "all", sort: "updated" });
    // Supabase は 1 回の取得に上限（既定 1,000 行）があるため、メモも 1,000 件ずつ全件を読む
    const latestMemo = new Map<string, string>();
    for (let from = 0; ; from += NOTES_PAGE_SIZE) {
      const { data: notes, error } = await getDb()
        .from("contact_notes")
        .select("contact_id,body,created_at")
        .eq("note_type", "note")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + NOTES_PAGE_SIZE - 1);
      if (error) throw new Error("notes_failed");
      for (const note of notes ?? []) if (!latestMemo.has(note.contact_id)) latestMemo.set(note.contact_id, note.body);
      if (!notes || notes.length < NOTES_PAGE_SIZE) break;
    }
    const rows = contacts.map((contact) => {
      const row = Object.fromEntries(CONTACT_CSV_COLUMNS.map(([key]) => [key, ""])) as Record<CsvContactKey, string>;
      return {
        ...row,
        lastName: contact.last_name,
        firstName: contact.first_name,
        companyName: contact.company_name,
        jobTitle: contact.job_title,
        email: contact.email ?? "",
        phone: contact.phone,
        postalCode: contact.postal_code,
        address: contact.address,
        tags: contact.tags.join("|"),
        stage: contact.stage,
        status: contact.status,
        memo: latestMemo.get(contact.id) ?? "",
        lastContactAt: contact.last_contact_at ?? "",
      };
    });
    return new Response(stringifyCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contacts.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ ok: false, reason: "CSVを書き出せませんでした。" }, { status: 500 });
  }
}

