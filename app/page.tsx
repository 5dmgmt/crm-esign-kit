import Link from "next/link";

export default function Home() {
  return (
    <main className="shell narrow hero">
      <p className="eyebrow">CRM + E-SIGN</p>
      <h1>顧客台帳と電子契約キット</h1>
      <p className="lead">契約書の作成、送付、署名、締結記録を一つの画面で管理できます。</p>
      <div className="actions">
        <Link className="button primary" href="/admin/esign">管理画面を開く</Link>
        <Link className="button secondary" href="/login">ログイン</Link>
      </div>
    </main>
  );
}
