import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

// `@media print { … }` の中身を、波かっこの対応を数えて取り出す
function printBlock(source: string): string {
  const start = source.indexOf("@media print");
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return "";
}

type Rule = { selectors: string[]; declarations: Map<string, string> };

function parseRules(block: string): Rule[] {
  const rules: Rule[] = [];
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const declaration of match[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      declarations.set(
        declaration.slice(0, colon).trim().toLowerCase(),
        declaration.slice(colon + 1).replace(/!important/i, "").trim().toLowerCase(),
      );
    }
    rules.push({ selectors: match[1].split(",").map((selector) => selector.trim()), declarations });
  }
  return rules;
}

const printRules = parseRules(printBlock(css));

function declarationsFor(selector: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of printRules) {
    if (rule.selectors.includes(selector)) for (const [key, value] of rule.declarations) merged.set(key, value);
  }
  return merged;
}

describe("契約書の印刷の改ページ（@media print）", () => {
  it("@media print の中身を読み取れている", () => {
    expect(printRules.length).toBeGreaterThan(0);
    expect(declarationsFor(".sign-form").get("display")).toBe("none");
  });

  it.each([".contract-frame h1", ".contract-frame h2", ".contract-frame h3"])(
    "%s は、ページの最後に取り残されない",
    (selector) => {
      expect(declarationsFor(selector).get("break-after")).toBe("avoid");
    },
  );

  it("本文の段落は、1 行だけ前後のページに残らない", () => {
    const paragraph = declarationsFor(".contract-frame p");
    expect(paragraph.get("orphans")).toBe("2");
    expect(paragraph.get("widows")).toBe("2");
  });

  it.each([".esign-signatures", ".esign-signatures section", ".esign-issuer-seal", ".record-grid > div"])(
    "署名欄・押印の欄・締結記録 %s は、2 ページに割れない",
    (selector) => {
      expect(declarationsFor(selector).get("break-inside")).toBe("avoid");
    },
  );

  it("契約締結日の行は、署名欄と離れない", () => {
    expect(declarationsFor(".esign-contract__date").get("break-after")).toBe("avoid");
  });

  it("表の行は、2 ページに割れない", () => {
    expect(declarationsFor(".contract-frame tr").get("break-inside")).toBe("avoid");
  });

  it("強制改ページは入れない（条文は自然に流す）", () => {
    const block = printBlock(css);
    expect(block).not.toMatch(/break-(before|after)\s*:\s*(page|always|left|right|recto|verso)/i);
    expect(block).not.toMatch(/page-break-(before|after)\s*:\s*(always|left|right)/i);
  });

  it("印刷の指定に、色の直書きを足していない（色は :root のトークンだけ）", () => {
    expect(printBlock(css)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
