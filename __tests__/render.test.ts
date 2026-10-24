import { describe, expect, it } from "vitest";
import { ContractValidationError, renderContract } from "@/lib/esign/render";
import type { ContractTemplate } from "@/lib/esign/types";

const template: ContractTemplate = {
  schema: {
    id: "sample",
    name: "見本",
    version: "1",
    allowIndividual: true,
    stageTagOnSign: "契約",
    fields: [
      { key: "clientCompany", label: "会社名", type: "text", required: true, requiredFor: "corporation", max: 30 },
      { key: "clientName", label: "氏名", type: "text", required: true, max: 30 },
      { key: "items", label: "項目", type: "list", required: true, max: 2 },
      {
        key: "plan",
        label: "プラン",
        type: "select",
        required: false,
        max: 10,
        options: [
          { value: "basic", label: "ベーシック" },
          { value: "pro", label: "プロ" },
        ],
      },
    ],
  },
  html: "{{#corporation}}<p>法人: {{clientCompany}}</p>{{/corporation}}{{#individual}}<p>個人</p>{{/individual}}<h1>{{clientName}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul><p>{{issuer.companyName}}</p>",
};

describe("契約書レンダリング", () => {
  it("差し込み値の {{…}} をひな形の変数として展開しない", () => {
    const result = renderContract(template, { clientCompany: "{{issuer.companyName}}", clientName: "{{issuer.seal}}", items: ["{{this}}"] }, "corporation");
    expect(result.html).not.toContain("<svg");
    expect(result.html).toContain("&#123;&#123;issuer.companyName&#125;&#125;");
  });

  it("HTML を escape する", () => {
    const result = renderContract(template, { clientCompany: "株式会社サンプル商事", clientName: "<script>alert(1)</script>", items: ["<b>項目</b>"] }, "corporation");
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&lt;b&gt;項目&lt;/b&gt;");
  });

  it("schema にないキーを拒否する", () => {
    expect(() => renderContract(template, { clientCompany: "株式会社サンプル商事", clientName: "山田 花子", items: ["項目"], extra: "不可" }, "corporation")).toThrow(ContractValidationError);
  });

  it("必須項目を検証する", () => {
    expect(() => renderContract(template, { clientCompany: "", clientName: "", items: [] }, "corporation")).toThrow(/入力してください/);
  });

  it("リストの最大数を検証する", () => {
    expect(() => renderContract(template, { clientCompany: "株式会社サンプル商事", clientName: "山田 花子", items: ["1", "2", "3"] }, "corporation")).toThrow(/2件以内/);
  });

  it("選択肢にない値を拒否し、選択肢の値は差し込む", () => {
    const base = { clientCompany: "株式会社サンプル商事", clientName: "山田 花子", items: ["項目"] };
    expect(() => renderContract(template, { ...base, plan: "gold" }, "corporation")).toThrow(/選択肢から選んでください/);
    expect(renderContract(template, { ...base, plan: "pro" }, "corporation").fields.plan).toBe("pro");
  });

  it("個人では会社名を求めず、法人欄を表示しない", () => {
    const result = renderContract(template, { clientName: "山田 花子", items: ["項目"] }, "individual");
    expect(result.html).toContain("<p>個人</p>");
    expect(result.html).not.toContain("法人:");
  });
});
