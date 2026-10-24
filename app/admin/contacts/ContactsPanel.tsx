"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { getJson, postJson } from "@/lib/client/api";
import { CONTACT_CSV_COLUMNS, type CsvMapping } from "@/lib/crm/csv";
import { contactName, type Contact } from "@/lib/crm/types";

type Preview = {
  headers: string[];
  mapping: CsvMapping;
  rows: Array<{ rowNumber: number; name: string; companyName: string; email: string; duplicate: boolean; reason: string | null }>;
};

const emptyContact = {
  lastName: "", firstName: "", companyName: "", jobTitle: "", email: "", phone: "", postalCode: "", address: "", tags: "", stage: "", status: "active",
};

export default function ContactsPanel({ initialContacts, stageTags }: { initialContacts: Contact[]; stageTags: string[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [filters, setFilters] = useState({ search: "", stage: "", status: "active", tag: "", sort: "last_contact" });
  const [draft, setDraft] = useState({ ...emptyContact, stage: stageTags[0] ?? "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const tags = useMemo(() => [...new Set(contacts.flatMap((contact) => contact.tags))].sort((a, b) => a.localeCompare(b, "ja")), [contacts]);

  async function loadContacts(event?: FormEvent) {
    event?.preventDefault();
    const result = await getJson<Contact[]>(`/api/admin/contacts?${new URLSearchParams(filters)}`);
    if (!result.ok) return setMessage(result.reason);
    setContacts(result.data);
    setMessage("");
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    const result = await postJson<Contact>("/api/admin/contacts", { ...draft, tags: draft.tags.split(/[、,]/).map((tag) => tag.trim()).filter(Boolean) });
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) return setMessage(`${result.reason}（入力内容は残っています）`);
    setDraft({ ...emptyContact, stage: stageTags[0] ?? "" });
    setMessage("連絡先を登録しました。");
    await loadContacts();
  }

  async function readFile(file: File | undefined) {
    setPreview(null);
    setMapping({});
    setMessage("");
    if (!file) return setCsv("");
    const text = await file.text();
    setCsv(text);
    const result = await postJson<Preview>("/api/admin/contacts/import", { csv: text });
    if (!result.ok) return setMessage(result.reason);
    setPreview(result.data);
    setMapping(result.data.mapping);
  }

  async function updatePreview() {
    const result = await postJson<Preview>("/api/admin/contacts/import", { csv, mapping });
    if (!result.ok) return setMessage(result.reason);
    setPreview(result.data);
    setMapping(result.data.mapping);
    setMessage("見出しの対応を反映しました。内容を確かめてください。");
  }

  async function importContacts() {
    if (busyRef.current || !preview) return;
    busyRef.current = true;
    setBusy(true);
    const result = await postJson<{ imported: number; duplicates: number; invalid: number }>("/api/admin/contacts/import", { csv, mapping, confirm: true });
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) return setMessage(result.reason);
    setMessage(`${result.data.imported}件を取り込みました。重複 ${result.data.duplicates}件、要確認 ${result.data.invalid}件は取り込んでいません。`);
    setCsv("");
    setPreview(null);
    await loadContacts();
  }

  return <>
    <section className="card stack">
      <form className="filter-grid" onSubmit={loadContacts}>
        <label className="field"><span>検索</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="氏名・会社・メール・タグ" maxLength={200} /></label>
        <label className="field"><span>段階</span><select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><option value="">すべて</option>{stageTags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="field"><span>状態</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="active">利用中</option><option value="archived">アーカイブ</option><option value="all">すべて</option></select></label>
        <label className="field"><span>タグ</span><select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}><option value="">すべて</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="field"><span>並び順</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="last_contact">最終接点</option><option value="updated">更新日時</option></select></label>
        <button className="primary" type="submit">この条件で表示</button><Link className="button secondary" href="/api/admin/contacts/export" prefetch={false}>CSVを書き出す</Link>
      </form>
      <div className="table-wrap"><table><thead><tr><th>氏名</th><th>会社</th><th>メール</th><th>段階</th><th>状態</th><th>タグ</th></tr></thead><tbody>
        {contacts.map((contact) => <tr key={contact.id}><td><Link href={`/admin/contacts/${contact.id}`}>{contactName(contact)}</Link></td><td>{contact.company_name || "—"}</td><td>{contact.email || "—"}</td><td><span className="status">{contact.stage}</span></td><td>{contact.status === "active" ? "利用中" : "アーカイブ"}</td><td>{contact.tags.join("、") || "—"}</td></tr>)}
        {contacts.length === 0 ? <tr><td colSpan={6}>条件に合う連絡先はありません。</td></tr> : null}
      </tbody></table></div>
    </section>
    <div className="dashboard-grid">
      <form className="card stack" onSubmit={createContact}><h2>連絡先を新しく登録</h2><div className="form-grid">
        <label className="field"><span>姓</span><input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} maxLength={80} /></label>
        <label className="field"><span>名</span><input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} maxLength={80} /></label>
        <label className="field"><span>会社名</span><input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} maxLength={160} /></label>
        <label className="field"><span>役職</span><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} maxLength={120} /></label>
        <label className="field"><span>メール</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} maxLength={254} /></label>
        <label className="field"><span>電話</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} maxLength={40} /></label>
        <label className="field"><span>段階</span><select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>{stageTags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="field"><span>タグ（読点区切り）</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
      </div><label className="field"><span>住所</span><input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} maxLength={500} /></label><button className="primary" type="submit" disabled={busy}>{busy ? "登録しています…" : "連絡先を登録"}</button></form>
      <section className="card stack"><h2>CSVから取り込む</h2><p className="muted">BOM付きUTF-8を含むUTF-8 CSVに対応しています。確定前に重複と入力内容を表示します。</p><label className="field"><span>CSVファイル</span><input type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
        {preview ? <><div className="mapping-grid">{CONTACT_CSV_COLUMNS.map(([key, label]) => <label className="field" key={key}><span>{label}</span><select value={mapping[key] ?? ""} onChange={(event) => setMapping({ ...mapping, [key]: event.target.value || undefined })}><option value="">取り込まない</option>{preview.headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}</div><button type="button" className="secondary" onClick={() => void updatePreview()}>見出しの対応を反映</button><div className="table-wrap"><table><thead><tr><th>行</th><th>氏名</th><th>会社</th><th>メール</th><th>確認</th></tr></thead><tbody>{preview.rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.name || "—"}</td><td>{row.companyName || "—"}</td><td>{row.email || "—"}</td><td>{row.reason ?? (row.duplicate ? "メール一致の重複" : "取り込み対象")}</td></tr>)}</tbody></table></div><button type="button" className="primary" disabled={busy} onClick={() => void importContacts()}>{busy ? "取り込んでいます…" : "表示内容で取り込む"}</button></> : null}
      </section>
    </div>
    {message ? <p className={`message ${message.includes("できません") ? "error" : "success"}`} role="status">{message}</p> : null}
  </>;
}
