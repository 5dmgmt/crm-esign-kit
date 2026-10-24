import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="shell narrow hero">
      <section className="card">
        <p className="eyebrow">ACCESS</p>
        <h1>権限がありません</h1>
        <p>この Google アカウントには管理画面の利用権限が設定されていません。</p>
        <Link className="button secondary" href="/login">別のアカウントでログイン</Link>
      </section>
    </main>
  );
}
