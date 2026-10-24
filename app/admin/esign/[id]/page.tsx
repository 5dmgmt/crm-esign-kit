import { notFound } from "next/navigation";
import { formatDocNumber, getEsignDocumentById } from "@/lib/esign/core";
import { verifyContractContent } from "@/lib/esign/verify";
import VoidForm from "./VoidForm";

function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "medium" }).format(new Date(value));
}

const statusLabels = { sent: "署名待ち", signed: "締結済み", void: "無効" } as const;

export default async function EsignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getEsignDocumentById(id);
  if (!doc) notFound();
  const hashMatches = verifyContractContent(doc.contract_html, doc.content_hash);
  return (
    <main className="shell stack">
      <div className="page-heading"><div><p className="eyebrow">文書番号 {formatDocNumber(doc.doc_number)}</p><h1>{doc.title}</h1></div><span className="status">{statusLabels[doc.status]}</span></div>
      {!hashMatches ? <p className="message error"><strong>ハッシュ不一致:</strong> 保存後に契約本文が変わっています。署名を進めず、内容をご確認ください。</p> : <p className="message success">ハッシュ照合: 一致</p>}
      <section className="card">
        <h2>締結記録</h2>
        <dl className="record-grid">
          <div><dt>お客様</dt><dd>{doc.client_company ? `${doc.client_company} / ` : ""}{doc.client_representative}</dd></div>
          <div><dt>送付日時</dt><dd>{dateTime(doc.sent_at)}（日本時間）</dd></div>
          <div><dt>締結日時</dt><dd>{doc.client_signed_at ? `${dateTime(doc.client_signed_at)}（日本時間）` : "—"}</dd></div>
          <div><dt>署名者</dt><dd>{doc.client_sign_name ?? "—"}</dd></div>
          <div><dt>発行者の署名記録</dt><dd>{doc.issuer_name} / {dateTime(doc.issuer_signed_at)}（日本時間）</dd></div>
          <div><dt>本文 SHA-256</dt><dd className="hash">{doc.content_hash}</dd></div>
          {doc.voided_at ? <div><dt>無効にした日時・理由</dt><dd>{dateTime(doc.voided_at)}（日本時間） / {doc.void_reason}</dd></div> : null}
        </dl>
      </section>
      <article className="contract-frame" dangerouslySetInnerHTML={{ __html: doc.contract_html }} />
      {doc.status === "sent" ? <VoidForm id={doc.id} /> : null}
    </main>
  );
}
