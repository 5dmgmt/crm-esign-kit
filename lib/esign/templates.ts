import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContractTemplate, ContractTemplateSchema, TemplateFieldType } from "@/lib/esign/types";

const FIELD_TYPES = new Set<TemplateFieldType>(["text", "textarea", "date", "money", "list", "select"]);

function validOptions(options: unknown): boolean {
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every(
      (option) =>
        option &&
        typeof option === "object" &&
        typeof (option as Record<string, unknown>).value === "string" &&
        typeof (option as Record<string, unknown>).label === "string",
    )
  );
}

function validateSchema(value: unknown, expectedId: string): ContractTemplateSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_template_schema");
  const schema = value as Partial<ContractTemplateSchema>;
  if (
    schema.id !== expectedId ||
    typeof schema.name !== "string" ||
    typeof schema.version !== "string" ||
    typeof schema.allowIndividual !== "boolean" ||
    !(schema.stageTagOnSign === null || typeof schema.stageTagOnSign === "string") ||
    !Array.isArray(schema.fields)
  ) {
    throw new Error("invalid_template_schema");
  }
  for (const field of schema.fields) {
    if (
      !field ||
      typeof field.key !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(field.key) ||
      typeof field.label !== "string" ||
      !FIELD_TYPES.has(field.type) ||
      typeof field.required !== "boolean" ||
      !Number.isInteger(field.max) ||
      field.max <= 0 ||
      (field.type === "select" && !validOptions(field.options))
    ) {
      throw new Error("invalid_template_field");
    }
  }
  return schema as ContractTemplateSchema;
}

export async function loadContractTemplate(id: string): Promise<ContractTemplate> {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error("template_not_found");
  const directory = path.join(process.cwd(), "templates", "contracts", id);
  const [html, schemaText] = await Promise.all([
    fs.readFile(path.join(directory, "template.html"), "utf8"),
    fs.readFile(path.join(directory, "schema.json"), "utf8"),
  ]);
  return { html, schema: validateSchema(JSON.parse(schemaText) as unknown, id) };
}

export async function listContractTemplates(): Promise<ContractTemplateSchema[]> {
  const root = path.join(process.cwd(), "templates", "contracts");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const schemas = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => (await loadContractTemplate(entry.name)).schema),
  );
  return schemas.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
