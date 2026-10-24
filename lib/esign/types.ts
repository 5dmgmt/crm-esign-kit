export type ClientKind = "individual" | "corporation";
export type TemplateFieldType = "text" | "textarea" | "date" | "money" | "list" | "select";

export type TemplateFieldOption = { value: string; label: string };

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  max: number;
  defaultValue?: string | string[];
  requiredFor?: ClientKind;
  options?: TemplateFieldOption[];
};

export type ContractTemplateSchema = {
  id: string;
  name: string;
  version: string;
  fields: TemplateField[];
  allowIndividual: boolean;
  stageTagOnSign: string | null;
};

export type ContractFieldValue = string | number | string[];
export type ContractFields = Record<string, ContractFieldValue>;

export type ContractTemplate = {
  schema: ContractTemplateSchema;
  html: string;
};
