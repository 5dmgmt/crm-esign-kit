import { guardAdmin } from "@/lib/auth/admin-api";
import { CONTACT_CSV_COLUMNS, stringifyCsv, type CsvContactKey } from "@/lib/crm/csv";
import { listContacts } from "@/lib/crm/repository";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardAdmin();
  if (denied) return denied;
  try {
    const contacts = await listContacts({ status: "all", sort: "updated" });
    const { data: notes, error } = await getDb()
      .from("contact_notes")
      .select("contact_id,body,created_at")
      .eq("note_type", "note")
      .order("created_at", { ascending: false });
    if (error) throw new Error("notes_failed");
    const latestMemo = new Map<string, string>();
    for (const note of notes ?? []) if (!latestMemo.has(note.contact_id)) latestMemo.set(note.contact_id, note.body);
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

