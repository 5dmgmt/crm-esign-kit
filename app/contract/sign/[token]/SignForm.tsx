"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export default function SignForm({ token, clientKind, defaultCompany }: { token: string; clientKind: "individual" | "corporation"; defaultCompany: string }) {
  const router = useRouter();
  const [signCompany, setSignCompany] = useState(defaultCompany);
  const [signName, setSignName] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!signName.trim() || (clientKind === "corporation" && !signCompany.trim()) || !consent) {
      setMessage("署名者情報の入力と、同意のチェックをご確認ください。");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/esign/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signCompany, signName, consent, website }),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string };
      if (response.status === 409) {
        router.refresh();
        return;
      }
      if (!response.ok || payload.ok !== true) {
        setMessage(payload.reason ?? "電子署名を記録できませんでした。（入力内容は残っています）");
        return;
      }
      router.refresh();
    } catch {
      setMessage("電子署名を記録できませんでした。通信状態をご確認ください。（入力内容は残っています）");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack sign-form no-print" onSubmit={submit}>
      <div><p className="eyebrow">電子署名</p><h2>契約内容への同意を記録</h2></div>
      {clientKind === "corporation" ? <label className="field"><span>会社名</span><input value={signCompany} onChange={(event) => setSignCompany(event.target.value)} maxLength={60} autoComplete="organization" required /></label> : null}
      <label className="field"><span>署名者氏名</span><input value={signName} onChange={(event) => setSignName(event.target.value)} maxLength={60} autoComplete="name" required /></label>
      <label className="check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>契約書の全文を確認し、内容に同意して電子署名します</span></label>
      <div className="honeypot" aria-hidden="true"><label>ウェブサイト<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
      <button className="primary" type="submit" disabled={submitting}>{submitting ? "記録しています…" : "同意して電子署名"}</button>
      {message ? <p className="message error" role="status">{message}</p> : null}
    </form>
  );
}
