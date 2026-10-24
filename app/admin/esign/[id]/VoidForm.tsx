"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export default function VoidForm({ id }: { id: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !acknowledged || !reason.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/esign/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string };
      if (!response.ok || payload.ok !== true) {
        setMessage(payload.reason ?? "契約書を無効にできませんでした。（入力内容は残っています）");
        return;
      }
      router.refresh();
    } catch {
      setMessage("契約書を無効にできませんでした。通信状態をご確認ください。（入力内容は残っています）");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack void-panel" onSubmit={submit}>
      <div><h2>契約書を無効にする</h2><p>無効にすると、この契約書の署名用リンクは利用できなくなります。</p></div>
      <label className="field"><span>理由（必須）</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required /></label>
      <label className="check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>この契約書を無効にすることを確認しました</span></label>
      <button className="danger" type="submit" disabled={submitting || !acknowledged || !reason.trim()}>{submitting ? "処理しています…" : "理由を記録して無効にする"}</button>
      {message ? <p className="message error" role="status">{message}</p> : null}
    </form>
  );
}
