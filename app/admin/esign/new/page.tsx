import EsignCreateForm from "./EsignCreateForm";
import { listContractTemplates } from "@/lib/esign/templates";

export default async function NewEsignPage() {
  const templates = await listContractTemplates();
  return (
    <main className="shell">
      <div className="page-heading"><div><p className="eyebrow">電子契約</p><h1>契約書を作成</h1></div></div>
      <EsignCreateForm templates={templates} />
    </main>
  );
}
