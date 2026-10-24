import Link from "next/link";
import { formatDocNumber, listEsignDocuments } from "@/lib/esign/core";

function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const statusLabels = { sent: "署名待ち", signed: "締結済み", void: "無効" } as const;

export default async function EsignListPage() {
  let documents;
  try {
    documents = await listEsignDocuments(50);
  } catch {
    return (
      <main className="shell">
        <h1>契約書</h1>
        <p className="message error">契約書の一覧を読み込めませんでした。接続設定をご確認ください。</p>
      </main>
    );
  }
  return (
    <main className="shell">
      <div className="page-heading">
        <div><p className="eyebrow">電子契約</p><h1>契約書</h1></div>
        <Link className="button primary" href="/admin/esign/new">契約書を作成</Link>
      </div>
      {documents.length === 0 ? (
        <section className="card"><p>契約書はまだありません。「契約書を作成」から始められます。</p></section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>文書番号</th><th>契約書</th><th>お客様</th><th>状態</th><th>送付日時</th><th>締結日時</th></tr></thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td><Link href={`/admin/esign/${doc.id}`}>{formatDocNumber(doc.doc_number)}</Link></td>
                  <td>{doc.title}</td>
                  <td>{doc.client_company || doc.client_representative}</td>
                  <td><span className="status">{statusLabels[doc.status]}</span></td>
                  <td>{dateTime(doc.sent_at)}</td>
                  <td>{dateTime(doc.client_signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
