import Link from "next/link";
import { contactName } from "@/lib/crm/types";
import { getTodayOverview } from "@/lib/crm/repository";

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function AdminPage() {
  let overview;
  try {
    overview = await getTodayOverview();
  } catch {
    return <main className="shell"><h1>今日の予定</h1><p className="message error">今日の予定を読み込めませんでした。接続設定を確かめて、再読み込みしてください。</p></main>;
  }
  return (
    <main className="shell stack">
      <div className="page-heading"><div><p className="eyebrow">{overview.date}（日本時間）</p><h1>今日の予定</h1></div><Link className="button primary" href="/admin/contacts">連絡先を開く</Link></div>
      <div className="dashboard-grid">
        <section className="card stack"><h2>今日の面談（{overview.meetings.length}件）</h2>
          {overview.meetings.length === 0 ? <p className="muted">今日の面談はありません。</p> : overview.meetings.map((meeting) => <article className="list-item" key={meeting.id}><time>{dateTime(meeting.occurred_at)}</time><strong>{meeting.subject || "面談"}</strong>{meeting.contact ? <Link href={`/admin/contacts/${meeting.contact.id}`}>{contactName(meeting.contact)}{meeting.contact.company_name ? ` / ${meeting.contact.company_name}` : ""}</Link> : null}</article>)}
        </section>
        <section className="card stack"><h2>期限が今日までのフォロー（{overview.follows.length}件）</h2>
          {overview.follows.length === 0 ? <p className="muted">期限を迎えたフォローはありません。</p> : overview.follows.map((follow) => <article className="list-item" key={follow.id}><span className="status">期日 {follow.due_on}</span><strong>{follow.body}</strong>{follow.contact ? <Link href={`/admin/contacts/${follow.contact.id}`}>{contactName(follow.contact)}{follow.contact.company_name ? ` / ${follow.contact.company_name}` : ""}</Link> : null}</article>)}
        </section>
      </div>
      <section className="card stack"><h2>最近更新した連絡先</h2>
        {overview.recentContacts.length === 0 ? <p className="muted">連絡先はまだありません。</p> : <div className="compact-list">{overview.recentContacts.map((contact) => <Link key={contact.id} href={`/admin/contacts/${contact.id}`}><strong>{contactName(contact)}</strong><span>{contact.company_name || "会社名なし"}</span><span>{contact.stage}</span></Link>)}</div>}
      </section>
    </main>
  );
}
