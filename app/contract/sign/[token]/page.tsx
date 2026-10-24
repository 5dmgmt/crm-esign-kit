import type { Metadata } from "next";
import { findEsignDocumentByToken, formatDocNumber, isSignedViewExpired, isTokenExpired } from "@/lib/esign/core";
import { verifyContractContent } from "@/lib/esign/verify";
import PrintButton from "./PrintButton";
import SignForm from "./SignForm";

export const metadata: Metadata = { title: "電子契約", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "medium" }).format(new Date(value));
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="public-contract"><section className="card"><h1>{title}</h1><div>{children}</div></section></main>;
}

export default async function ContractSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await findEsignDocumentByToken(token);
  if (!doc) return <Notice title="契約書が見つかりません"><p>リンクをご確認いただくか、発行者へお問い合わせください。</p></Notice>;
  if (doc.status === "void") return <Notice title="この契約書は無効です"><p>無効として記録されているため、署名と閲覧はできません。詳しくは発行者へお問い合わせください。</p></Notice>;
  if (doc.status === "sent" && isTokenExpired(doc)) return <Notice title="署名期限を過ぎています"><p>新しい署名用リンクについて、発行者へお問い合わせください。</p></Notice>;
  if (doc.status === "signed" && isSignedViewExpired(doc)) return <Notice title="閲覧期限を過ぎています"><p>契約書の控えについて、発行者へお問い合わせください。</p></Notice>;

  const hashMatches = verifyContractContent(doc.contract_html, doc.content_hash);
  return (
    <main className="public-contract stack">
      <section className="card no-print"><p className="eyebrow">電子契約</p><h1>{doc.title}</h1><p>{doc.status === "signed" ? "電子署名と締結記録を確認できます。" : "契約書の全文をご確認いただき、内容に同意いただけましたら署名へお進みください。"}</p></section>
      {!hashMatches ? <section className="message error"><strong>ハッシュ不一致</strong><p>保存後に契約本文が変わっているため、署名できません。発行者へお知らせください。</p></section> : null}
      <article className="contract-frame" dangerouslySetInnerHTML={{ __html: doc.contract_html }} />
      {doc.status === "sent" && hashMatches ? <SignForm token={token} clientKind={doc.client_kind} defaultCompany={doc.client_company} /> : null}
      {doc.status === "signed" ? (
        <section className="card stack">
          <div><p className="eyebrow">締結記録</p><h2>電子署名が完了しています</h2></div>
          <p className={hashMatches ? "message success" : "message error"}>ハッシュ照合: {hashMatches ? "一致" : "不一致"}</p>
          <dl className="record-grid">
            <div><dt>文書番号</dt><dd>{formatDocNumber(doc.doc_number)}</dd></div>
            <div><dt>締結日時</dt><dd>{doc.client_signed_at ? `${dateTime(doc.client_signed_at)}（日本時間）` : "—"}</dd></div>
            <div><dt>署名者</dt><dd>{doc.client_sign_company ? `${doc.client_sign_company} / ` : ""}{doc.client_sign_name ?? "—"}</dd></div>
            <div><dt>発行者の署名記録</dt><dd>{doc.issuer_name} / {dateTime(doc.issuer_signed_at)}（日本時間）</dd></div>
            <div><dt>本文 SHA-256</dt><dd className="hash">{doc.content_hash}</dd></div>
          </dl>
          <PrintButton />
        </section>
      ) : null}
    </main>
  );
}
