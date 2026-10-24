import { getKitConfig } from "@/lib/config";
import { buildSealSvg } from "@/lib/esign/seal";
import type {
  ClientKind,
  ContractFields,
  ContractTemplate,
  ContractTemplateSchema,
} from "@/lib/esign/types";

export class ContractValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
    this.name = "ContractValidationError";
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    // 差し込み値に {{…}} が入っていても、後段の置換でひな形の変数として展開されないようにする
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

function fieldIsRequired(required: boolean, requiredFor: ClientKind | undefined, kind: ClientKind) {
  return required && (!requiredFor || requiredFor === kind);
}

export function validateContractFields(
  schema: ContractTemplateSchema,
  input: unknown,
  clientKind: ClientKind,
): ContractFields {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ContractValidationError(["入力項目の形式が正しくありません。"]);
  }
  if (clientKind === "individual" && !schema.allowIndividual) {
    throw new ContractValidationError(["このひな形は個人のお客様に対応していません。"]);
  }

  const source = input as Record<string, unknown>;
  const allowed = new Set(schema.fields.map((field) => field.key));
  const unknownKeys = Object.keys(source).filter((key) => !allowed.has(key));
  const issues = unknownKeys.map((key) => `ひな形にない項目「${key}」は使用できません。`);
  const result: ContractFields = {};

  for (const field of schema.fields) {
    const raw = source[field.key] ?? field.defaultValue ?? (field.type === "list" ? [] : "");
    const required = fieldIsRequired(field.required, field.requiredFor, clientKind);
    if (field.type === "list") {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        issues.push(`${field.label}の形式が正しくありません。`);
        continue;
      }
      const values = raw.map((item) => item.trim()).filter(Boolean);
      if (required && values.length === 0) issues.push(`${field.label}を入力してください。`);
      if (values.length > field.max) issues.push(`${field.label}は${field.max}件以内で入力してください。`);
      if (values.some((item) => item.length > 500)) {
        issues.push(`${field.label}の各項目は500文字以内で入力してください。`);
      }
      result[field.key] = values;
      continue;
    }

    if (typeof raw !== "string" && typeof raw !== "number") {
      issues.push(`${field.label}の形式が正しくありません。`);
      continue;
    }
    const value = String(raw).trim();
    if (required && !value) issues.push(`${field.label}を入力してください。`);
    if (value.length > field.max) issues.push(`${field.label}は${field.max}文字以内で入力してください。`);
    if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      issues.push(`${field.label}は日付の形式で入力してください。`);
    }
    if (field.type === "money" && value && !/^\d+(?:\.\d{1,2})?$/.test(value)) {
      issues.push(`${field.label}は数字で入力してください。`);
    }
    result[field.key] = value;
  }

  if (issues.length > 0) throw new ContractValidationError(issues);
  return result;
}

function renderEachBlocks(html: string, fields: ContractFields): string {
  return html.replace(/{{#each\s+([A-Za-z0-9_.-]+)}}([\s\S]*?){{\/each}}/g, (_all, key, body) => {
    const values = fields[key];
    if (!Array.isArray(values)) return "";
    return values
      .map((value) => body.replace(/{{\s*this\s*}}/g, escapeHtml(value)))
      .join("");
  });
}

function renderKindBlocks(html: string, clientKind: ClientKind): string {
  return html
    .replace(/{{#corporation}}([\s\S]*?){{\/corporation}}/g, (_all, body) =>
      clientKind === "corporation" ? body : "",
    )
    .replace(/{{#individual}}([\s\S]*?){{\/individual}}/g, (_all, body) =>
      clientKind === "individual" ? body : "",
    );
}

export function renderContract(
  template: ContractTemplate,
  input: unknown,
  clientKind: ClientKind,
): { html: string; fields: ContractFields } {
  const fields = validateContractFields(template.schema, input, clientKind);
  const issuer = getKitConfig().issuer;
  const replacements: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? "" : escapeHtml(String(value))]),
    ),
    "issuer.companyName": escapeHtml(issuer.companyName),
    "issuer.representativeTitle": escapeHtml(issuer.representativeTitle),
    "issuer.representativeName": escapeHtml(issuer.representativeName),
    "issuer.addressLine1": escapeHtml(issuer.addressLines[0]),
    "issuer.addressLine2": escapeHtml(issuer.addressLines[1]),
    "issuer.contactEmail": escapeHtml(issuer.contactEmail),
    "issuer.phone": escapeHtml(issuer.phone ?? ""),
    "issuer.seal": buildSealSvg(issuer.sealText, issuer.sealColor),
  };

  let html = renderEachBlocks(template.html, fields);
  html = renderKindBlocks(html, clientKind);
  html = html.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_all, key) => replacements[key] ?? "");
  if (/{{[\s\S]*?}}/.test(html)) throw new Error("template_contains_unresolved_placeholders");
  return { html, fields };
}
