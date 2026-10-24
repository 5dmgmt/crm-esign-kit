"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import type { ClientKind, ContractTemplateSchema, TemplateField } from "@/lib/esign/types";

type Values = Record<string, string>;
type InitialContact = { id: string; companyName: string; name: string; email: string; address: string };

function initialValues(schema: ContractTemplateSchema, contact?: InitialContact | null): Values {
  const values = Object.fromEntries(
    schema.fields.map((field) => [
      field.key,
      Array.isArray(field.defaultValue)
        ? field.defaultValue.join("\n")
        // 必須の選択肢は画面で先頭が選ばれて見えるため、値も先頭にそろえる
        : field.defaultValue ?? (field.type === "select" && field.required ? field.options?.[0]?.value ?? "" : ""),
    ]),
  );
  if (contact) {
    if ("clientCompany" in values) values.clientCompany = contact.companyName;
    if ("clientName" in values) values.clientName = contact.name;
    if ("clientAddress" in values) values.clientAddress = contact.address;
  }
  return values;
}

function FieldInput({ field, value, onChange }: { field: TemplateField; value: string; onChange: (value: string) => void }) {
  if (field.type === "select") {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} required={field.required && !field.requiredFor}>
        {field.required ? null : <option value="">選ばない</option>}
        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  if (field.type === "textarea" || field.type === "list") {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={field.type === "list" ? undefined : field.max}
        required={field.required && !field.requiredFor}
        placeholder={field.type === "list" ? "1行に1項目ずつ入力" : undefined}
      />
    );
  }
  return (
    <input
      type={field.type === "date" ? "date" : field.type === "money" ? "number" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={field.type === "money" ? undefined : field.max}
      min={field.type === "money" ? 0 : undefined}
      step={field.type === "money" ? "0.01" : undefined}
      required={field.required && !field.requiredFor}
    />
  );
}

function displayValue(field: TemplateField, value: string | undefined): string {
  if (field.type !== "select") return value ?? "";
  return field.options?.find((option) => option.value === value)?.label ?? "";
}

export default function EsignCreateForm({ templates, initialContact = null }: { templates: ContractTemplateSchema[]; initialContact?: InitialContact | null }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const schema = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId, templates],
  );
  const [clientKind, setClientKind] = useState<ClientKind>(initialContact && !initialContact.companyName ? "individual" : "corporation");
  const [clientEmail, setClientEmail] = useState(initialContact?.email ?? "");
  const [sendMail, setSendMail] = useState(true);
  const [values, setValues] = useState<Values>(() => (schema ? initialValues(schema, initialContact) : {}));
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!schema) return <p className="message error">利用できるひな形がありません。</p>;

  function changeTemplate(nextId: string) {
    const next = templates.find((template) => template.id === nextId);
    setTemplateId(nextId);
    if (next) {
      setValues(initialValues(next, initialContact));
      if (!next.allowIndividual) setClientKind("corporation");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    setResultUrl("");
    const fields = Object.fromEntries(
      schema.fields.map((field) => [
        field.key,
        field.type === "list" ? (values[field.key] ?? "").split("\n").map((item) => item.trim()).filter(Boolean) : values[field.key] ?? "",
      ]),
    );
    try {
      const response = await fetch("/api/admin/esign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, clientKind, clientEmail, contactId: initialContact?.id ?? null, sendMail, fields }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        reason?: string;
        data?: { signUrl?: string; docNumber?: string };
      };
      if (payload.data?.signUrl) setResultUrl(payload.data.signUrl);
      if (!response.ok || payload.ok !== true) {
        setMessage(payload.reason ?? "契約書を作成できませんでした。入力内容は残っています。");
        return;
      }
      setMessage(`契約書を作成しました。文書番号は ${payload.data?.docNumber ?? "—"} です。`);
    } catch {
      setMessage("契約書を作成できませんでした。通信状態をご確認ください。（入力内容は残っています）");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const visibleFields = schema.fields.filter(
    (field) => !field.requiredFor || field.requiredFor === clientKind,
  );

  return (
    <form className="grid-two" onSubmit={submit}>
      <section className="card stack">
        <label className="field"><span>ひな形</span>
          <select value={templateId} onChange={(event) => changeTemplate(event.target.value)}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}（版 {template.version}）</option>)}
          </select>
        </label>
        {schema.allowIndividual ? (
          <label className="field"><span>お客様の区分</span>
            <select value={clientKind} onChange={(event) => setClientKind(event.target.value as ClientKind)}>
              <option value="corporation">法人</option><option value="individual">個人</option>
            </select>
          </label>
        ) : null}
        <label className="field"><span>送付先メール</span>
          <input type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} maxLength={254} required />
        </label>
        {visibleFields.map((field) => (
          <label className="field" key={field.key}>
            <span>{field.label}{field.required ? "（必須）" : ""}</span>
            <FieldInput field={field} value={values[field.key] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={sendMail} onChange={(event) => setSendMail(event.target.checked)} />
          <span>作成後に署名依頼メールを送る</span>
        </label>
        <button className="primary" type="submit" disabled={submitting}>{submitting ? "作成しています…" : "契約書を作成"}</button>
        {message ? <p className={`message ${resultUrl && !message.includes("できません") ? "success" : "error"}`} role="status">{message}</p> : null}
        {resultUrl ? <div className="message success"><strong>署名用リンク</strong><br /><a href={resultUrl}>{resultUrl}</a></div> : null}
      </section>
      <aside className="card preview" aria-live="polite">
        <p className="eyebrow">入力内容のプレビュー</p>
        <h2>{values.title || schema.name}</h2>
        <dl>
          {visibleFields.map((field) => (
            <div key={field.key}><dt>{field.label}</dt><dd>{displayValue(field, values[field.key]) || "未入力"}</dd></div>
          ))}
          <div><dt>送付先</dt><dd>{clientEmail || "未入力"}</dd></div>
        </dl>
        <p className="muted">作成時に、この内容をひな形へ差し込んで契約書を固定します。</p>
      </aside>
    </form>
  );
}
