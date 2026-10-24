import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAuthorizationError, requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      redirect(error.status === 401 ? "/login?callbackUrl=/admin" : "/unauthorized");
    }
    throw error;
  }
  return (
    <>
      <header className="admin-header">
        <div className="admin-nav">
          <Link href="/admin/esign">顧客台帳と電子契約</Link>
          <nav aria-label="管理メニュー">
            <Link href="/admin/esign">契約書</Link>
            <Link href="/admin/esign/new">新規作成</Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
