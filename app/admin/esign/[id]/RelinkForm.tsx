"use client";

import { useRef, useState, type FormEvent } from "react";

export default function RelinkForm({ id, signingTokenDays }: { id: string; signingTokenDays: number }) {
  const [sendMail, setSendMail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [signUrl, setSignUrl] = useState("");
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    setSignUrl("");
    try {
      const response = await fetch(`/api/admin/esign/${id}/relink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendMail }),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string; data?: { signUrl?: string } };
      if (payload.data?.signUrl) setSignUrl(payload.data.signUrl);
      if (!response.ok || payload.ok !== true) {
        setMessage(payload.reason ?? "署名用リンクを作り直せませんでした。");
        return;
      }
      setMessage(sendMail ? "新しいリンクを作り、署名依頼メールを送りました。前のリンクは使えなくなりました。" : "新しいリンクを作りました。前のリンクは使えなくなりました。");
    } catch {
      setMessage("署名用リンクを作り直せませんでした。通信状態をご確認ください。");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div><h2>署名用リンクを作り直す</h2><p>リンクをなくしたときや、署名の期限が切れたときに使います。前のリンクは使えなくなり、新しいリンクの期限は {signingTokenDays} 日後です。本文と文書番号は変わりません。</p></div>
      <label className="check"><input type="checkbox" checked={sendMail} onChange={(event) => setSendMail(event.target.checked)} /><span>新しいリンクで署名依頼メールを送る</span></label>
      <button className="secondary" type="submit" disabled={submitting}>{submitting ? "作成しています…" : "新しいリンクを作る"}</button>
      {message ? <p className={`message ${message.includes("できません") ? "error" : "success"}`} role="status">{message}</p> : null}
      {signUrl ? <div className="message success"><strong>署名用リンク</strong><br /><a href={signUrl}>{signUrl}</a></div> : null}
    </form>
  );
}
