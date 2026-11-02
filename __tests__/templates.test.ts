import { promises as fs } from "node:fs";
import path from "node:path";
import { render as renderUi, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import EsignCreateForm from "@/app/admin/esign/new/EsignCreateForm";
import { getKitConfig } from "@/lib/config";
import { renderContract } from "@/lib/esign/render";
import {
  listContractTemplates,
  loadContractTemplateDirectory,
} from "@/lib/esign/templates";
import type {
  ClientKind,
  ContractFields,
  ContractTemplate,
  TemplateField,
} from "@/lib/esign/types";

const contractsRoot = path.join(process.cwd(), "templates", "contracts");
const examplesRoot = path.join(process.cwd(), "templates", "examples", "5dmgmt");
const deniedTerms = ["五次元経営", "望月", "藤沢", "片瀬", "江ノ島"];

async function templateDirectories(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

async function allTemplates(): Promise<ContractTemplate[]> {
  const directories = [
    ...(await templateDirectories(contractsRoot)),
    ...(await templateDirectories(examplesRoot)),
  ];
  return Promise.all(
    directories.map((directory) =>
      loadContractTemplateDirectory(directory, path.basename(directory)),
    ),
  );
}

function fieldValue(field: TemplateField): string | string[] {
  if (field.key === "clientCompany") return "株式会社テスト商事";
  if (field.key === "clientName") return "代表取締役 テスト花子";
  if (field.key === "clientAddress") return "東京都テスト区1-2-3";
  if (field.key === "purpose") return "経営課題を整理し、優先順位を明確にする";
  if (field.key === "goalSign") return "毎月の優先課題と次の行動が合意できている";
  if (field.key === "outOfScope") return ["契約外の業務", "専門家による判断"];
  if (field.type === "list") return ["テスト項目1", "テスト項目2"];
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  if (field.type === "date") return "2026-11-02";
  if (field.type === "money") return "10000";
  if (typeof field.defaultValue === "string") return field.defaultValue;
  return "テスト値";
}

function valuesFor(template: ContractTemplate): ContractFields {
  return Object.fromEntries(
    template.schema.fields.map((field) => [field.key, fieldValue(field)]),
  );
}

function expectRenders(template: ContractTemplate, kind: ClientKind) {
  const result = renderContract(template, valuesFor(template), kind);
  expect(result.html).not.toContain("{{");
  expect(result.html).toContain(getKitConfig().issuer.companyName);
  return result;
}

describe("契約書ひな形", () => {
  it("contracts と examples の全 schema を本番と同じ検証で読み込む", async () => {
    const templates = await allTemplates();
    expect(templates.map((template) => template.schema.id).sort()).toEqual([
      "ai-katsuyo",
      "ai-keiei",
      "kobetsu",
      "komon",
      "komon-gekkan",
      "komon-mokuteki",
      "sample-gyomu-itaku",
    ]);
  });

  it("全ひな形を法人として描画し、対応ひな形は個人としても描画する", async () => {
    for (const template of await allTemplates()) {
      expectRenders(template, "corporation");
      if (template.schema.allowIndividual) expectRenders(template, "individual");
    }
  });

  it("目的を絞った顧問契約へ目的・目安・対象外を差し込む", async () => {
    const template = await loadContractTemplateDirectory(
      path.join(contractsRoot, "komon-mokuteki"),
      "komon-mokuteki",
    );
    const result = expectRenders(template, "corporation");
    expect(result.html).toContain("経営課題を整理し、優先順位を明確にする");
    expect(result.html).toContain("毎月の優先課題と次の行動が合意できている");
    expect(result.html).toContain("契約外の業務");
    expect(result.html).toContain("専門家による判断");
    expect(result.html).toContain("第９条（目的の見直し）");
  });

  it("list の defaultValue を作成画面の初期値として表示する", async () => {
    const template = await loadContractTemplateDirectory(
      path.join(contractsRoot, "komon-mokuteki"),
      "komon-mokuteki",
    );
    renderUi(createElement(EsignCreateForm, { templates: [template.schema] }));
    const input = screen.getByLabelText(/この契約に含まないこと/) as HTMLTextAreaElement;
    expect(input.value).toContain("本目的の実現に直接関わらない業務");
    expect(input.value).toContain("法律、税務および会計に関する専門的な判断");
  });

  it("本番のひな形一覧へ examples を混ぜない", async () => {
    expect((await listContractTemplates()).map((template) => template.id).sort()).toEqual([
      "komon-mokuteki",
      "sample-gyomu-itaku",
    ]);
  });

  it("見本とひな形のファイルに公開禁止の固有名詞を含めない", async () => {
    const roots = [contractsRoot, examplesRoot];
    const files: string[] = [];
    for (const root of roots) {
      const directories = await templateDirectories(root);
      for (const directory of directories) {
        files.push(path.join(directory, "schema.json"), path.join(directory, "template.html"));
      }
    }
    files.push(path.join(examplesRoot, "README.md"));

    for (const file of files) {
      const text = await fs.readFile(file, "utf8");
      for (const term of deniedTerms) expect(text).not.toContain(term);
    }
  });
});
