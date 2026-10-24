import LoginButton from "./LoginButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/admin";
  return (
    <main className="shell narrow hero">
      <section className="card stack">
        <div>
          <p className="eyebrow">管理者ログイン</p>
          <h1>管理画面へログイン</h1>
          <p className="muted">許可された Google アカウントでお進みいただけます。</p>
        </div>
        <LoginButton callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
