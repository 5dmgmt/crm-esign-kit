"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { deleteJson, patchJson, postForm, postJson } from "@/lib/client/api";
import { contactName, type ContactKarte as Karte } from "@/lib/crm/types";

function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTimeValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function useSaveState() {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const start = () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    return true;
  };
  const finish = () => { savingRef.current = false; setSaving(false); };
  return { saving, start, finish };
}

export function ContactProfileSection({ karte, stageTags, onMessage }: { karte: Karte; stageTags: string[]; onMessage: (message: string, error?: boolean) => void }) {
  const router = useRouter();
  const contact = karte.contact;
  const save = useSaveState();
  const [draft, setDraft] = useState({
    lastName: contact.last_name, firstName: contact.first_name, companyName: contact.company_name,
    jobTitle: contact.job_title, email: contact.email ?? "", phone: contact.phone,
    postalCode: contact.postal_code, address: contact.address, tags: contact.tags.join("、"), stage: contact.stage, status: contact.status,
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.start()) return;
    const result = await patchJson(`/api/admin/contacts/${contact.id}`, { ...draft, tags: draft.tags.split(/[、,]/).map((tag) => tag.trim()).filter(Boolean) });
    save.finish();
    if (!result.ok) return onMessage(`${result.reason}（入力内容は残っています）`, true);
    onMessage("プロフィールを保存しました。");
    router.refresh();
  }
  return <form className="card stack" onSubmit={submit}><h2>プロフィール</h2><div className="form-grid">
    <label className="field"><span>姓</span><input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} maxLength={80} /></label>
    <label className="field"><span>名</span><input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} maxLength={80} /></label>
    <label className="field"><span>会社名</span><input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} maxLength={160} /></label>
    <label className="field"><span>役職</span><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} maxLength={120} /></label>
    <label className="field"><span>メール</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} maxLength={254} /></label>
    <label className="field"><span>電話</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} maxLength={40} /></label>
    <label className="field"><span>郵便番号</span><input value={draft.postalCode} onChange={(event) => setDraft({ ...draft, postalCode: event.target.value })} maxLength={20} /></label>
    <label className="field"><span>段階</span><select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>{stageTags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
    <label className="field"><span>状態</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as "active" | "archived" })}><option value="active">利用中</option><option value="archived">アーカイブ</option></select></label>
    <label className="field"><span>タグ（読点区切り）</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
  </div><label className="field"><span>住所</span><textarea value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} maxLength={500} /></label><button className="primary" disabled={save.saving}>{save.saving ? "保存しています…" : "プロフィールを保存"}</button></form>;
}

function NoteSection({ karte, onMessage }: { karte: Karte; onMessage: (message: string, error?: boolean) => void }) {
  const router = useRouter();
  const save = useSaveState();
  const [noteType, setNoteType] = useState("note");
  const [body, setBody] = useState("");
  const [dueOn, setDueOn] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.start()) return;
    const result = await postJson(`/api/admin/contacts/${karte.contact.id}/notes`, { noteType, body, dueOn: noteType === "follow" ? dueOn : null });
    save.finish();
    if (!result.ok) return onMessage(`${result.reason}（入力内容は残っています）`, true);
    setBody(""); setDueOn(""); onMessage("メモを保存しました。"); router.refresh();
  }
  async function toggleFollow(id: string, done: boolean) {
    const result = await patchJson(`/api/admin/contacts/${karte.contact.id}/notes`, { id, done });
    if (!result.ok) return onMessage(result.reason, true);
    onMessage(done ? "フォローを完了にしました。" : "フォローを未完了に戻しました。"); router.refresh();
  }
  return <section className="card stack"><h2>メモとフォロー</h2><form className="stack" onSubmit={submit}><div className="form-grid"><label className="field"><span>種類</span><select value={noteType} onChange={(event) => setNoteType(event.target.value)}><option value="note">メモ</option><option value="meeting">面談メモ</option><option value="follow">フォロー</option></select></label>{noteType === "follow" ? <label className="field"><span>フォロー期日</span><input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required /></label> : null}</div><label className="field"><span>内容</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} required /></label><button className="primary" disabled={save.saving}>{save.saving ? "保存しています…" : "メモを保存"}</button></form>
    <div className="timeline">{karte.notes.map((note) => <article className="timeline-item" key={note.id}><div><span className="status">{note.note_type === "follow" ? "フォロー" : note.note_type === "meeting" ? "面談" : "メモ"}</span><time>{dateTime(note.created_at)}</time></div><p>{note.body}</p>{note.due_on ? <p>期日: {note.due_on} / {note.done_at ? `完了 ${dateTime(note.done_at)}` : "未完了"}</p> : null}{note.note_type === "follow" ? <button type="button" className="secondary compact" onClick={() => void toggleFollow(note.id, !note.done_at)}>{note.done_at ? "未完了に戻す" : "フォローを完了"}</button> : null}</article>)}{karte.notes.length === 0 ? <p className="muted">メモはまだありません。</p> : null}</div>
  </section>;
}

export function ContactTimelineSection({ karte, onMessage }: { karte: Karte; onMessage: (message: string, error?: boolean) => void }) {
  const router = useRouter();
  const save = useSaveState();
  const [draft, setDraft] = useState({ interactionType: "meeting", occurredAt: localDateTimeValue(), subject: "", body: "" });
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!save.start()) return;
    const result = await postJson(`/api/admin/contacts/${karte.contact.id}/interactions`, { ...draft, occurredAt: new Date(draft.occurredAt).toISOString() });
    save.finish();
    if (!result.ok) return onMessage(`${result.reason}（入力内容は残っています）`, true);
    setDraft({ ...draft, subject: "", body: "" }); onMessage("やりとりを保存しました。"); router.refresh();
  }
  const labels = { meeting: "面談", phone: "電話", email: "メール", note: "メモ" } as const;
  return <section className="card stack"><h2>やりとりの時系列</h2><form className="stack" onSubmit={submit}><div className="form-grid"><label className="field"><span>種類</span><select value={draft.interactionType} onChange={(event) => setDraft({ ...draft, interactionType: event.target.value })}><option value="meeting">面談</option><option value="phone">電話</option><option value="email">メール</option><option value="note">メモ</option></select></label><label className="field"><span>日時</span><input type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft({ ...draft, occurredAt: event.target.value })} required /></label></div><label className="field"><span>件名</span><input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} maxLength={200} /></label><label className="field"><span>{draft.interactionType === "meeting" ? "議事録" : "内容"}</span><textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} maxLength={100000} required /></label><button className="primary" disabled={save.saving}>{save.saving ? "保存しています…" : "やりとりを保存"}</button></form>
    <div className="timeline">{karte.interactions.map((interaction) => <article className="timeline-item" key={interaction.id}><div><span className="status">{labels[interaction.interaction_type]}</span><time>{dateTime(interaction.occurred_at)}</time></div>{interaction.subject ? <h3>{interaction.subject}</h3> : null}<p className="pre-wrap">{interaction.body}</p>{karte.documents.filter((document) => document.interaction_ids?.includes(interaction.id)).map((document) => <p key={document.id}>資料: <a href={document.signed_url || document.source_url || "#"}>{document.title}（{document.version}）</a></p>)}</article>)}{karte.interactions.length === 0 ? <p className="muted">やりとりはまだありません。</p> : null}</div>
  </section>;
}

export function ContactDocumentsSection({ karte, onMessage }: { karte: Karte; onMessage: (message: string, error?: boolean) => void }) {
  const router = useRouter();
  const save = useSaveState();
  const [mode, setMode] = useState<"url" | "file">("url");
  const [title, setTitle] = useState(""); const [version, setVersion] = useState("1"); const [sourceUrl, setSourceUrl] = useState(""); const [file, setFile] = useState<File | null>(null); const [interactionId, setInteractionId] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!save.start()) return;
    const result = mode === "url"
      ? await postJson(`/api/admin/documents`, { contactId: karte.contact.id, title, version, sourceUrl, interactionId: interactionId || null })
      : await (async () => { const form = new FormData(); form.set("contactId", karte.contact.id); form.set("title", title); form.set("version", version); if (interactionId) form.set("interactionId", interactionId); if (file) form.set("file", file); return postForm(`/api/admin/documents`, form); })();
    save.finish();
    if (!result.ok) return onMessage(`${result.reason}（入力内容は残っています）`, true);
    setTitle(""); setSourceUrl(""); setFile(null); onMessage("資料を登録しました。"); router.refresh();
  }
  async function link(documentId: string, selectedInteractionId: string) {
    if (!selectedInteractionId) return;
    const result = await postJson(`/api/admin/document-links`, { documentId, interactionId: selectedInteractionId });
    if (!result.ok) return onMessage(result.reason, true);
    onMessage("資料をやりとりに紐付けました。"); router.refresh();
  }
  return <section className="card stack"><h2>資料</h2><form className="stack" onSubmit={submit}><div className="form-grid"><label className="field"><span>登録方法</span><select value={mode} onChange={(event) => setMode(event.target.value as "url" | "file")}><option value="url">URL</option><option value="file">ファイル</option></select></label><label className="field"><span>版</span><input value={version} onChange={(event) => setVersion(event.target.value)} maxLength={50} required /></label></div><label className="field"><span>資料名</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></label>{mode === "url" ? <label className="field"><span>URL（http/https）</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} required /></label> : <label className="field"><span>ファイル（20MB以内）</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>}<label className="field"><span>やりとりへの紐付け（任意）</span><select value={interactionId} onChange={(event) => setInteractionId(event.target.value)}><option value="">紐付けない</option>{karte.interactions.map((interaction) => <option key={interaction.id} value={interaction.id}>{dateTime(interaction.occurred_at)} {interaction.subject || interaction.interaction_type}</option>)}</select></label><button className="primary" disabled={save.saving}>{save.saving ? "登録しています…" : "資料を登録"}</button></form>
    <div className="document-grid">{karte.documents.map((document) => <article className="list-item" key={document.id}><strong>{document.title}</strong><span>版 {document.version}</span>{document.original_file_name ? <span>元のファイル名: {document.original_file_name}</span> : null}<a href={document.signed_url || document.source_url || "#"} target="_blank" rel="noreferrer">資料を開く（リンクは10分間有効）</a><label className="field"><span>既存のやりとりに紐付ける</span><select defaultValue="" onChange={(event) => void link(document.id, event.target.value)}><option value="">選んで紐付ける</option>{karte.interactions.filter((interaction) => !document.interaction_ids?.includes(interaction.id)).map((interaction) => <option key={interaction.id} value={interaction.id}>{dateTime(interaction.occurred_at)} {interaction.subject || interaction.interaction_type}</option>)}</select></label></article>)}{karte.documents.length === 0 ? <p className="muted">資料はまだありません。</p> : null}</div>
  </section>;
}

function ContactRemoval({ karte, onMessage }: { karte: Karte; onMessage: (message: string, error?: boolean) => void }) {
  const router = useRouter(); const [confirmation, setConfirmation] = useState(""); const expected = contactName(karte.contact);
  async function archive() { const result = await deleteJson(`/api/admin/contacts/${karte.contact.id}`, { mode: "archive" }); if (!result.ok) return onMessage(result.reason, true); onMessage("連絡先をアーカイブしました。"); router.refresh(); }
  async function remove() { const result = await deleteJson(`/api/admin/contacts/${karte.contact.id}`, { mode: "delete", confirmation }); if (!result.ok) return onMessage(result.reason, true); router.push("/admin/contacts"); }
  return <section className="card stack danger-zone"><h2>連絡先の整理</h2><p>通常はアーカイブをお使いください。契約書はどちらの操作でも残ります。</p><button type="button" className="secondary" onClick={() => void archive()}>連絡先をアーカイブ</button><label className="field"><span>完全に削除する場合は「{expected}」と入力</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="button" className="danger" disabled={confirmation !== expected} onClick={() => void remove()}>連絡先を完全に削除</button></section>;
}

export default function ContactKarte({ karte, stageTags }: { karte: Karte; stageTags: string[] }) {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const onMessage = (text: string, error = false) => setNotice({ text, error });
  return <div className="stack"><div className="page-heading"><div><p className="eyebrow">連絡先カルテ</p><h1>{contactName(karte.contact)}</h1><p>{karte.contact.company_name}{karte.contact.job_title ? ` / ${karte.contact.job_title}` : ""}</p></div><Link className="button primary" href={`/admin/esign/new?contact=${karte.contact.id}`}>この連絡先の契約を作る</Link></div>{notice ? <p className={`message ${notice.error ? "error" : "success"}`} role="status">{notice.text}</p> : null}<div className="karte-grid"><ContactProfileSection karte={karte} stageTags={stageTags} onMessage={onMessage} /><NoteSection karte={karte} onMessage={onMessage} /></div><ContactTimelineSection karte={karte} onMessage={onMessage} /><ContactDocumentsSection karte={karte} onMessage={onMessage} /><section className="card stack"><h2>電子契約</h2>{karte.contracts.length === 0 ? <p className="muted">この連絡先の契約はまだありません。</p> : <div className="compact-list">{karte.contracts.map((contract) => <Link key={contract.id} href={`/admin/esign/${contract.id}`}><strong>{String(contract.doc_number).padStart(7, "0")} {contract.title}</strong><span>{contract.status === "signed" ? "締結済み" : contract.status === "void" ? "無効" : "署名待ち"}</span><span>{dateTime(contract.client_signed_at || contract.sent_at)}</span></Link>)}</div>}</section><ContactRemoval karte={karte} onMessage={onMessage} /></div>;
}

