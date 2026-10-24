import { notFound } from "next/navigation";
import ContactKarte from "./ContactKarte";
import { getKitConfig } from "@/lib/config";
import { getContactKarte } from "@/lib/crm/repository";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let karte;
  try { karte = await getContactKarte(id); }
  catch { return <main className="shell"><h1>連絡先カルテ</h1><p className="message error">連絡先を読み込めませんでした。接続設定を確かめて、再読み込みしてください。</p></main>; }
  if (!karte) notFound();
  return <main className="shell"><ContactKarte karte={karte} stageTags={getKitConfig().stageTags} /></main>;
}

